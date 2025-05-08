"""
Direct Run Script

This script provides a simplified way to run the backend service without a virtual environment.
It implements a minimal Flask server with the core functionality needed for the Options Earnings Screener.
"""

import sys
import os
import time
import logging
from datetime import datetime, timedelta
import json
import importlib.util
import concurrent.futures
import threading
import queue
from functools import wraps

# Import configuration
try:
    from config import YF_RATE_LIMIT, SEQUENTIAL_PROCESSING, QUICK_FILTER
    logger = logging.getLogger(__name__)
    logger.info("Loaded configuration from config.py")
except ImportError:
    # Default configuration if config.py is not found
    logger = logging.getLogger(__name__)
    logger.warning("config.py not found, using default configuration")
    YF_RATE_LIMIT = {"rate": 5, "per": 1.0, "burst": 10}
    SEQUENTIAL_PROCESSING = {
        "api_calls_per_ticker": 8,
        "requests_per_minute": 60,
        "max_consecutive_requests": 10,
        "pause_duration": 2.0
    }
    QUICK_FILTER = {"min_price": 2.50, "min_volume": 1500000}

# Add app directory to path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG to see detailed logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress excessive debug logging from external libraries
logging.getLogger('yfinance').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('peewee').setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)

# Check for required packages
required_packages = ['flask', 'flask_cors', 'yfinance', 'numpy', 'scipy', 'finance_calendars', 'pandas']
missing_packages = []

for package in required_packages:
    if importlib.util.find_spec(package) is None:
        missing_packages.append(package)

if missing_packages:
    print(f"Missing required packages: {', '.join(missing_packages)}")
    print("Please install them using:")
    print(f"python -m pip install --user {' '.join(missing_packages)}")
    sys.exit(1)

# Import required packages
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import yfinance as yf
import numpy as np
import pandas as pd
from scipy.interpolate import interp1d

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configure Flask to properly handle JSON serialization
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, bool):
            return str(obj).lower()  # Convert True/False to "true"/"false"
        return super().default(obj)

app.json_encoder = CustomJSONEncoder

# Core functions from calculator.py
def filter_dates(dates):
    """Filter option expiration dates to include only those within 45 days."""
    today = datetime.today().date()
    cutoff_date = today + timedelta(days=45)
    
    sorted_dates = sorted(datetime.strptime(date, "%Y-%m-%d").date() for date in dates)

    arr = []
    for i, date in enumerate(sorted_dates):
        if date >= cutoff_date:
            arr = [d.strftime("%Y-%m-%d") for d in sorted_dates[:i+1]]
            break
    
    if len(arr) > 0:
        if arr[0] == today.strftime("%Y-%m-%d"):
            return arr[1:]
        return arr

    raise ValueError("No date 45 days or more in the future found.")

def yang_zhang(price_data, window=30, trading_periods=252, return_last_only=True):
    """Calculate Yang-Zhang volatility estimator."""
    log_ho = (price_data['High'] / price_data['Open']).apply(np.log)
    log_lo = (price_data['Low'] / price_data['Open']).apply(np.log)
    log_co = (price_data['Close'] / price_data['Open']).apply(np.log)
    
    log_oc = (price_data['Open'] / price_data['Close'].shift(1)).apply(np.log)
    log_oc_sq = log_oc**2
    
    log_cc = (price_data['Close'] / price_data['Close'].shift(1)).apply(np.log)
    log_cc_sq = log_cc**2
    
    rs = log_ho * (log_ho - log_co) + log_lo * (log_lo - log_co)
    
    close_vol = log_cc_sq.rolling(
        window=window,
        center=False
    ).sum() * (1.0 / (window - 1.0))

    open_vol = log_oc_sq.rolling(
        window=window,
        center=False
    ).sum() * (1.0 / (window - 1.0))

    window_rs = rs.rolling(
        window=window,
        center=False
    ).sum() * (1.0 / (window - 1.0))

    k = 0.34 / (1.34 + ((window + 1) / (window - 1)) )
    result = (open_vol + k * close_vol + (1 - k) * window_rs).apply(np.sqrt) * np.sqrt(trading_periods)

    if return_last_only:
        return result.iloc[-1]
    else:
        return result.dropna()

def get_liquidity_score(stock, expiration, strike):
    """
    Calculate a liquidity score for an option and return detailed liquidity information.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        strike (float): Strike price
        
    Returns:
        dict: Dictionary containing liquidity details including score, spread_pct, volume, open_interest, etc.
    """
    try:
        chain = stock.option_chain(expiration)
        calls = chain.calls
        
        if calls.empty:
            logger.debug(f"No calls data for {expiration} at strike {strike}")
            return {
                "score": 0.0,
                "spread_pct": 0.0,
                "volume": 0,
                "open_interest": 0,
                "has_zero_bid": True,
                "spread_dollars": 0.0
            }
        
        # Find the option with the given strike
        options = calls[calls['strike'] == strike]
        
        if options.empty:
            logger.debug(f"No options at strike {strike} for {expiration}")
            return {
                "score": 0.0,
                "spread_pct": 0.0,
                "volume": 0,
                "open_interest": 0,
                "has_zero_bid": True,
                "spread_dollars": 0.0
            }
        
        option = options.iloc[0]
        
        # Calculate bid-ask spread as a percentage of the mid price
        bid = float(option['bid'])
        ask = float(option['ask'])
        has_zero_bid = bool(bid == 0)  # Convert to standard Python boolean
        
        # Get volume and open interest
        volume = int(option['volume']) if 'volume' in option and not pd.isna(option['volume']) else 0
        open_interest = int(option['openInterest']) if 'openInterest' in option and not pd.isna(option['openInterest']) else 0
        
        # If bid or ask is zero, return minimal liquidity
        if bid == 0 or ask == 0:
            logger.debug(f"Bid or ask is zero for {expiration} at strike {strike}")
            return {
                "score": 0.0,
                "spread_pct": 1.0,  # 100% spread
                "volume": volume,
                "open_interest": open_interest,
                "has_zero_bid": bool(has_zero_bid),  # Ensure it's a standard Python boolean
                "spread_dollars": float(ask)
            }
        
        mid = (bid + ask) / 2.0
        spread_pct = (ask - bid) / mid
        spread_dollars = ask - bid
        
        # Less punitive liquidity scoring - using square root instead of log10
        liquidity_score = (1 / spread_pct) * np.sqrt(max(1, volume)) * np.sqrt(max(1, open_interest))
        
        # Cap and normalize
        score = min(10.0, max(0.0, liquidity_score / 100.0))
        
        # Return detailed liquidity information with all values converted to standard Python types
        return {
            "score": float(score),
            "spread_pct": float(spread_pct),
            "volume": int(volume),
            "open_interest": int(open_interest),
            "has_zero_bid": bool(has_zero_bid),  # Ensure it's a standard Python boolean
            "spread_dollars": float(spread_dollars)
        }
    except Exception as e:
        logger.debug(f"Error calculating liquidity score: {str(e)}")
        return {
            "score": 0.0,
            "spread_pct": 0.0,
            "volume": 0,
            "open_interest": 0,
            "has_zero_bid": True,
            "spread_dollars": 0.0
        }

def get_atm_iv(stock, expiration, strike):
    """
    Get at-the-money implied volatility for a specific expiration and strike.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        strike (float): Strike price
        
    Returns:
        float: Implied volatility
    """
    try:
        chain = stock.option_chain(expiration)
        calls = chain.calls
        puts = chain.puts
        
        # Check if we have any options data
        if calls.empty and puts.empty:
            logger.warning(f"IV DATA: No options data for {stock.ticker} {expiration}")
            return 0.0
        
        # Initialize variables
        call_iv = 0.0
        put_iv = 0.0
        has_call = False
        has_put = False
        
        # Check for call options at this strike
        if not calls.empty:
            call_options = calls[calls['strike'] == strike]
            if not call_options.empty:
                has_call = True
                call_iv = call_options.iloc[0]['impliedVolatility']
                call_bid = call_options.iloc[0]['bid']
                call_ask = call_options.iloc[0]['ask']
                has_call_pricing = call_bid > 0 and call_ask > 0
                
                if call_iv > 0:
                    logger.warning(f"IV DATA: Call option for {stock.ticker} {expiration} strike ${strike}")
                    logger.warning(f"  Call IV: {call_iv:.4f}, Bid/Ask: {call_bid}/{call_ask}, Valid pricing: {has_call_pricing}")
        
        # Check for put options at this strike
        if not puts.empty:
            put_options = puts[puts['strike'] == strike]
            if not put_options.empty:
                has_put = True
                put_iv = put_options.iloc[0]['impliedVolatility']
                put_bid = put_options.iloc[0]['bid']
                put_ask = put_options.iloc[0]['ask']
                has_put_pricing = put_bid > 0 and put_ask > 0
                
                if put_iv > 0:
                    logger.warning(f"IV DATA: Put option for {stock.ticker} {expiration} strike ${strike}")
                    logger.warning(f"  Put IV: {put_iv:.4f}, Bid/Ask: {put_bid}/{put_ask}, Valid pricing: {has_put_pricing}")
        
        # If neither call nor put options exist at this strike
        if not has_call and not has_put:
            logger.warning(f"IV DATA: No options at strike ${strike} for {stock.ticker} {expiration}")
            return 0.0
        
        # If both call and put have IV, use average
        if call_iv > 0 and put_iv > 0:
            avg_iv = (call_iv + put_iv) / 2.0
            logger.warning(f"IV DATA: Using average IV: {avg_iv:.4f} for {stock.ticker} {expiration} strike ${strike}")
            return avg_iv
        # Otherwise use whichever is available
        elif call_iv > 0:
            logger.warning(f"IV DATA: Using call IV: {call_iv:.4f} for {stock.ticker} {expiration} strike ${strike}")
            return call_iv
        elif put_iv > 0:
            logger.warning(f"IV DATA: Using put IV: {put_iv:.4f} for {stock.ticker} {expiration} strike ${strike}")
            return put_iv
        else:
            logger.warning(f"IV DATA: No valid IV data for {stock.ticker} {expiration} at strike ${strike}")
            return 0.0
    except Exception as e:
        logger.debug(f"Error getting ATM IV: {str(e)}")
        return 0.0

def calculate_spread_cost(stock, front_month, back_month, strike):
    """
    Calculate the cost of a calendar spread.
    
    Args:
        stock (Ticker): yfinance Ticker object
        front_month (str): Front month expiration in YYYY-MM-DD format
        back_month (str): Back month expiration in YYYY-MM-DD format
        strike (float): Strike price
        
    Returns:
        float: Cost of the calendar spread
    """
    try:
        # Get front month option
        front_chain = stock.option_chain(front_month)
        front_calls = front_chain.calls
        
        # Get back month option
        back_chain = stock.option_chain(back_month)
        back_calls = back_chain.calls
        
        if front_calls.empty or back_calls.empty:
            logger.debug(f"Missing options data for {front_month} or {back_month}")
            return 0.0
        
        # Find the options with the given strike
        front_options = front_calls[front_calls['strike'] == strike]
        back_options = back_calls[back_calls['strike'] == strike]
        
        if front_options.empty or back_options.empty:
            return 0.0
        
        # Calculate mid prices
        front_bid = front_options.iloc[0]['bid']
        front_ask = front_options.iloc[0]['ask']
        
        # Handle missing or zero bid/ask data
        if front_bid == 0 or pd.isna(front_bid):
            front_bid = front_options.iloc[0]['lastPrice'] * 0.9 if 'lastPrice' in front_options.columns else 0.0
        if front_ask == 0 or pd.isna(front_ask):
            front_ask = front_options.iloc[0]['lastPrice'] * 1.1 if 'lastPrice' in front_options.columns else 0.0
            
        front_mid = (front_bid + front_ask) / 2.0 if front_bid > 0 and front_ask > 0 else 0.0
        
        back_bid = back_options.iloc[0]['bid']
        back_ask = back_options.iloc[0]['ask']
        
        # Handle missing or zero bid/ask data
        if back_bid == 0 or pd.isna(back_bid):
            back_bid = back_options.iloc[0]['lastPrice'] * 0.9 if 'lastPrice' in back_options.columns else 0.0
        if back_ask == 0 or pd.isna(back_ask):
            back_ask = back_options.iloc[0]['lastPrice'] * 1.1 if 'lastPrice' in back_options.columns else 0.0
            
        back_mid = (back_bid + back_ask) / 2.0 if back_bid > 0 and back_ask > 0 else 0.0
        
        # Check if we have valid bid/ask data
        front_has_price = front_bid > 0 and front_ask > 0
        back_has_price = back_bid > 0 and back_ask > 0
        
        # Log detailed information about the options data
        logger.warning(f"SPREAD PRICING CHECK: {stock.ticker} {front_month}/{back_month} strike ${strike}")
        logger.warning(f"  Front month option:")
        logger.warning(f"    Bid: {front_bid}, Ask: {front_ask}, Mid: {front_mid}")
        logger.warning(f"    Valid pricing: {front_has_price}")
        logger.warning(f"  Back month option:")
        logger.warning(f"    Bid: {back_bid}, Ask: {back_ask}, Mid: {back_mid}")
        logger.warning(f"    Valid pricing: {back_has_price}")
        
        if not front_has_price or not back_has_price:
            # This is the critical issue - log when we're missing pricing data
            logger.warning(f"  PRICING DATA ISSUE: Missing valid bid/ask data")
            return 0.0
        
        # Calendar spread cost = back month price - front month price
        return back_mid - front_mid
    except Exception as e:
        logger.debug(f"Error calculating spread cost: {str(e)}")
        return 0.0

def find_closest_expiration(exp_dates, target_date):
    """
    Find the closest expiration date to a target date.
    
    Args:
        exp_dates (list): List of date strings in YYYY-MM-DD format
        target_date (date): Target date to find closest expiration to
        
    Returns:
        str: Closest expiration date in YYYY-MM-DD format
        
    Raises:
        ValueError: If no expiration dates are provided
    """
    if not exp_dates:
        raise ValueError("No expiration dates provided")
    
    date_objs = [datetime.strptime(date, "%Y-%m-%d").date() for date in exp_dates]
    
    # Find the date with the minimum absolute difference from target_date
    closest_date = min(date_objs, key=lambda date_obj: abs((date_obj - target_date).days))
    
    return closest_date.strftime("%Y-%m-%d")

def get_common_strikes(stock, front_month, back_month):
    """
    Get strike prices that exist in both front and back month expirations.
    
    Args:
        stock (yf.Ticker): Stock ticker object
        front_month (str): Front month expiration date in YYYY-MM-DD format
        back_month (str): Back month expiration date in YYYY-MM-DD format
        
    Returns:
        list: List of strike prices that exist in both expirations, sorted
    """
    try:
        # Get option chains for both expirations
        front_chain = stock.option_chain(front_month)
        back_chain = stock.option_chain(back_month)
        
        # Get unique strikes from each expiration
        front_strikes = set(front_chain.calls['strike'].unique())
        back_strikes = set(back_chain.calls['strike'].unique())
        
        # Find the intersection (common strikes)
        common_strikes = list(front_strikes.intersection(back_strikes))
        
        logger.warning(f"COMMON STRIKES: {stock.ticker} {front_month}/{back_month}")
        logger.warning(f"  Front month strikes: {len(front_strikes)}, Back month strikes: {len(back_strikes)}")
        logger.warning(f"  Common strikes: {len(common_strikes)} - {sorted(common_strikes)}")
        
        return sorted(common_strikes)
    except Exception as e:
        logger.error(f"Error getting common strikes: {str(e)}")
        return []

def get_strikes_near_price(stock, expiration, current_price, range_percent=15):
    """
    Get option strikes near the current price.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        current_price (float): Current stock price
        range_percent (float): Percentage range around current price to include
        
    Returns:
        list: List of strike prices near the current price
    """
    try:
        # Calculate price range
        min_price = current_price * (1 - range_percent/100)
        max_price = current_price * (1 + range_percent/100)
        
        # Get option chain
        chain = stock.option_chain(expiration)
        calls = chain.calls
        
        if calls.empty:
            logger.debug(f"No calls data for {expiration}")
            return []
        
        # Get all available strikes
        all_strikes = calls['strike'].unique()
        
        # Filter strikes within range
        strikes = [strike for strike in all_strikes if min_price <= strike <= max_price]
        
        return strikes
    except Exception as e:
        logger.debug(f"Error getting strikes near price: {str(e)}")
        return []

def calculate_spread_score(iv_differential, spread_cost, front_liquidity, back_liquidity,
                          strike_distance_from_atm, days_between_expirations=30,
                          days_to_front_expiration=14):
    """
    Calculate a composite score for a potential calendar spread.
    
    Args:
        iv_differential (float): IV differential between front and back month
        spread_cost (float): Cost of the spread
        front_liquidity (float or dict): Liquidity score or details for front month
        back_liquidity (float or dict): Liquidity score or details for back month
        strike_distance_from_atm (float): Distance from ATM in dollars
        days_between_expirations (int): Days between front and back month expirations
        days_to_front_expiration (int): Days to front month expiration
        
    Returns:
        float: Composite score for the spread
    """
    # Extract liquidity scores if objects were passed
    front_liquidity_score = front_liquidity["score"] if isinstance(front_liquidity, dict) else front_liquidity
    back_liquidity_score = back_liquidity["score"] if isinstance(back_liquidity, dict) else back_liquidity
    
    logger.debug(f"Calculating spread score with: iv_diff={iv_differential}, cost={spread_cost}, " +
                f"liquidity={front_liquidity_score}/{back_liquidity_score}, distance={strike_distance_from_atm}, " +
                f"days_between={days_between_expirations}, days_to_front={days_to_front_expiration}")
    
    # Avoid division by zero
    if spread_cost <= 0:
        logger.debug("Score calculation aborted: spread_cost <= 0")
        return 0.0
    
    # IV differential factors
    iv_diff_score = iv_differential * 100  # Scale up for scoring
    
    # IV differential to cost ratio (bang for buck)
    cost_efficiency = iv_differential / spread_cost
    
    # Liquidity factor (average of front and back month)
    liquidity_score = (front_liquidity_score + back_liquidity_score) / 2.0
    
    # Delta neutrality factor (closer to ATM is better)
    delta_neutrality = 1.0 / (1.0 + strike_distance_from_atm)
    
    # Days between expirations factor (optimal is 30-45 days)
    days_between_factor = 1.0 - abs(days_between_expirations - 37.5) / 37.5
    
    # Days to front expiration factor (optimal is 2-5 days after earnings)
    days_to_front_factor = 1.0 - abs(days_to_front_expiration - 3.5) / 14.0
    
    # Calculate individual components for logging
    iv_component = iv_diff_score * 0.3
    cost_component = cost_efficiency * 50 * 0.3  # Reduced scaling factor from 100 to 50
    liquidity_component = liquidity_score * 0.15
    delta_component = delta_neutrality * 0.1
    days_between_component = days_between_factor * 0.1
    days_to_front_component = days_to_front_factor * 0.05
    
    score = (
        iv_component +
        cost_component +
        liquidity_component +
        delta_component +
        days_between_component +
        days_to_front_component
    )
    
    # Only log scores that are close to or above the threshold
    if score >= 0.5:
        logger.info(f"Spread score: {score:.2f} (threshold: 1.0) - " +
                   f"IV: {iv_component:.2f}, Cost: {cost_component:.2f}, " +
                   f"Liquidity: {liquidity_component:.2f}")
    
    return max(0.0, score)

def find_optimal_calendar_spread(ticker, back_month_exp_options=[30, 45, 60], ts_slope=None):
    """
    Find the optimal calendar spread for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        back_month_exp_options (list): List of days out to consider for back month expiration
        
    Returns:
        dict or None: Details of the optimal calendar spread, or None if no worthwhile spread is found
    """
    logger.info(f"Finding optimal calendar spread for {ticker} with term structure slope: {ts_slope}")
    
    try:
        # Get stock data
        stock = yf.Ticker(ticker)
        if not stock or len(stock.options) == 0:
            logger.warning(f"No options data found for {ticker}")
            return None
        
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            logger.warning(f"Could not get current price for {ticker}")
            return None
        
        logger.info(f"{ticker} current price: ${current_price}")
        
        best_spread = None
        best_score = 0
        
        # Get expiration dates
        exp_dates = stock.options
        if not exp_dates:
            logger.warning(f"No expiration dates found for {ticker}")
            return None
        
        logger.info(f"{ticker} available expiration dates: {exp_dates}")
        
        # Check if pricing data is available for key expirations
        logger.warning(f"API PRICING CHECK: {ticker}")
        has_pricing_data = False
        
        # Sample a few expirations to check for pricing data
        sample_expirations = exp_dates[:min(3, len(exp_dates))]
        for exp_date in sample_expirations:
            try:
                chain = stock.option_chain(exp_date)
                calls = chain.calls
                puts = chain.puts
                
                if not calls.empty and not puts.empty:
                    sample_call = calls.iloc[0]
                    sample_put = puts.iloc[0]
                    
                    # Check if bid/ask data is available
                    call_has_price = sample_call['bid'] > 0 and sample_call['ask'] > 0
                    put_has_price = sample_put['bid'] > 0 and sample_put['ask'] > 0
                    
                    # Log detailed pricing information for the first strike
                    strike = sample_call['strike']
                    logger.warning(f"  {exp_date} Strike ${strike}: Call bid/ask: {sample_call['bid']}/{sample_call['ask']}, Put bid/ask: {sample_put['bid']}/{sample_put['ask']}")
                    
                    if call_has_price or put_has_price:
                        has_pricing_data = True
                        logger.warning(f"  {exp_date}: Valid pricing data available")
                    else:
                        logger.warning(f"  {exp_date}: No valid pricing data (bid/ask = 0)")
            except Exception as e:
                logger.warning(f"  Error checking {exp_date}: {str(e)}")
        
        if not has_pricing_data:
            logger.warning(f"API PRICING ISSUE: No valid pricing data found for any expiration for {ticker}")
        
        # Convert to datetime objects for sorting
        date_objs = [datetime.strptime(date, "%Y-%m-%d").date() for date in exp_dates]
        sorted_dates = sorted(date_objs)
        
        # Filter for dates in the future
        today = datetime.today().date()
        future_dates = [d for d in sorted_dates if d > today]
        
        if not future_dates:
            logger.warning(f"No future expiration dates found for {ticker}")
            return None
        
        logger.info(f"{ticker} future expiration dates: {[d.strftime('%Y-%m-%d') for d in future_dates]}")
        
        # First, find the front month expiration (closest to today)
        front_month_date = future_dates[0]
        front_month = front_month_date.strftime("%Y-%m-%d")
        days_to_front_expiration = (front_month_date - today).days
        
        logger.info(f"{ticker} front month: {front_month}, days to expiration: {days_to_front_expiration}")
        
        # For each potential back month expiration
        for days_out in back_month_exp_options:
            target_date = today + timedelta(days=days_out)
            
            # Find closest expiration to target date
            back_month = find_closest_expiration(exp_dates, target_date)
            back_month_date = datetime.strptime(back_month, "%Y-%m-%d").date()
            
            # Calculate days between expirations
            days_between_expirations = (back_month_date - front_month_date).days
            
            logger.info(f"{ticker} considering back month: {back_month}, days between expirations: {days_between_expirations}")
            
            # Get ALL strikes for each expiration (not just near the current price)
            front_chain = stock.option_chain(front_month)
            back_chain = stock.option_chain(back_month)
            
            # Get ALL strikes from BOTH calls AND puts
            front_call_strikes = set(front_chain.calls['strike'].unique())
            front_put_strikes = set(front_chain.puts['strike'].unique())
            front_strikes = front_call_strikes.union(front_put_strikes)
            
            back_call_strikes = set(back_chain.calls['strike'].unique())
            back_put_strikes = set(back_chain.puts['strike'].unique())
            back_strikes = back_call_strikes.union(back_put_strikes)
            
            logger.warning(f"Front month call strikes: {len(front_call_strikes)} - {sorted(front_call_strikes)}")
            logger.warning(f"Front month put strikes: {len(front_put_strikes)} - {sorted(front_put_strikes)}")
            logger.warning(f"Back month call strikes: {len(back_call_strikes)} - {sorted(back_call_strikes)}")
            logger.warning(f"Back month put strikes: {len(back_put_strikes)} - {sorted(back_put_strikes)}")
            
            # Get strikes that exist in BOTH front and back month expirations
            common_strikes = list(front_strikes.intersection(back_strikes))
            
            logger.warning(f"STRIKE SELECTION: {ticker} {front_month}/{back_month}")
            logger.warning(f"  Front month ALL strikes: {len(front_strikes)} - {sorted(front_strikes)}")
            logger.warning(f"  Back month ALL strikes: {len(back_strikes)} - {sorted(back_strikes)}")
            logger.warning(f"  Common strikes: {len(common_strikes)} - {sorted(common_strikes)}")
            
            if not common_strikes:
                logger.warning(f"  No common strikes found between {front_month} and {back_month}")
                continue
            
            # Sort common strikes by distance from current price
            sorted_strikes = sorted(common_strikes, key=lambda x: abs(x - current_price))
            
            # Take the closest 5 strikes to current price (or all if less than 5)
            filtered_strikes = sorted_strikes[:min(5, len(sorted_strikes))]
            
            # Log the strikes we're considering
            logger.warning(f"  Selected strikes closest to current price: {filtered_strikes}")
            
            # Also log the distance of each strike from current price
            for strike in filtered_strikes:
                distance_pct = abs(strike - current_price) / current_price * 100
                logger.warning(f"  Strike ${strike}: {distance_pct:.2f}% from current price (${current_price:.2f})")
            
            # Skip if no strikes found (should never happen now since we're taking all common strikes)
            if not filtered_strikes:
                logger.warning(f"  No valid strikes found between {front_month} and {back_month}")
                continue
                
            logger.warning(f"  Proceeding with {len(filtered_strikes)} strikes for {front_month}/{back_month}")
                
            for strike in filtered_strikes:
                # Calculate key metrics for this potential spread
                front_iv = get_atm_iv(stock, front_month, strike)
                back_iv = get_atm_iv(stock, back_month, strike)
                
                # Log distance from current price as percentage
                strike_distance_pct = abs(strike - current_price) / current_price * 100
                logger.warning(f"  Strike ${strike}: {strike_distance_pct:.2f}% from current price (${current_price:.2f})")
                
                # Handle missing IV data
                if front_iv == 0:
                    logger.debug(f"{ticker} strike ${strike}: Skipping due to missing front month IV data")
                    continue
                
                # If back month IV is missing, estimate it using term structure slope
                if back_iv == 0:
                    logger.warning(f"IV DATA CHECK: {ticker} strike ${strike} - Front IV: {front_iv:.4f}, Back IV missing")
                    
                    if ts_slope is not None:
                        # Use the estimate_back_month_iv function with the term structure slope
                        back_iv = estimate_back_month_iv(
                            front_iv,
                            front_month_date,
                            back_month_date,
                            ts_slope
                        )
                        logger.warning(f"  ESTIMATED BACK IV: {back_iv:.4f} using term structure slope {ts_slope:.6f}")
                    else:
                        # Fallback to simple estimation if ts_slope is not available
                        back_iv = front_iv * 0.85
                        logger.warning(f"  ESTIMATED BACK IV: {back_iv:.4f} using fallback method (85% of front)")
                
                # IV differential (front month should be higher)
                iv_differential = front_iv - back_iv
                
                # Log whether back month IV was estimated
                estimated_iv = back_iv == front_iv * 0.85
                
                # Allow small negative IV differentials (front month can be slightly lower)
                # Skip only if the differential is significantly negative
                if iv_differential < -0.1:
                    logger.debug(f"{ticker} strike ${strike}: Skipping due to low IV differential: {iv_differential}")
                    continue
                
                logger.debug(f"{ticker} strike ${strike}: IV differential: {iv_differential}, front_iv: {front_iv}, back_iv: {back_iv} (estimated: {estimated_iv})")
                
                # Get pricing information
                logger.warning(f"SPREAD COST CHECK: {ticker} {front_month}/{back_month} strike ${strike}")
                spread_cost = calculate_spread_cost(stock, front_month, back_month, strike)
                
                # Skip if spread cost is invalid
                if spread_cost <= 0:
                    logger.warning(f"  INVALID SPREAD COST: ${spread_cost:.2f}")
                    continue
                
                # Calculate cost as percentage of underlying price for reference
                cost_percent = (spread_cost / current_price) * 100
                logger.warning(f"  VALID SPREAD COST: ${spread_cost:.2f} ({cost_percent:.2f}% of underlying)")
                
                # Calculate liquidity metrics
                front_liquidity = get_liquidity_score(stock, front_month, strike)
                back_liquidity = get_liquidity_score(stock, back_month, strike)
                
                # Calculate combined liquidity metrics
                combined_liquidity = {
                    "score": float((front_liquidity["score"] + back_liquidity["score"]) / 2),
                    "front_liquidity": front_liquidity,
                    "back_liquidity": back_liquidity,
                    "spread_impact": float((front_liquidity["spread_dollars"] + back_liquidity["spread_dollars"]) / spread_cost if spread_cost > 0 else 0),
                    "has_zero_bids": bool(front_liquidity["has_zero_bid"] or back_liquidity["has_zero_bid"])
                }
                
                logger.debug(f"{ticker} strike ${strike}: Liquidity scores - front: {front_liquidity['score']}, back: {back_liquidity['score']}")
                
                # Calculate a composite score
                score = calculate_spread_score(
                    iv_differential,
                    spread_cost,
                    front_liquidity["score"],
                    back_liquidity["score"],
                    strike_distance_from_atm=abs(strike - current_price),
                    days_between_expirations=days_between_expirations,
                    days_to_front_expiration=days_to_front_expiration
                )
                
                # Log detailed score information
                logger.debug(f"{ticker} strike ${strike}: Calculated score: {score:.2f}")
                # Don't try to access variables from calculate_spread_score function
                
                if score > best_score:
                    best_score = score
                    logger.info(f"{ticker} strike ${strike}: New best score: {score}")
                    best_spread = {
                        'strike': float(strike),
                        'frontMonth': front_month,
                        'backMonth': back_month,
                        'spreadCost': float(spread_cost),
                        'ivDifferential': float(iv_differential),
                        'frontIv': float(front_iv),
                        'backIv': float(back_iv),
                        'frontLiquidity': front_liquidity,
                        'backLiquidity': back_liquidity,
                        'combinedLiquidity': combined_liquidity,
                        'daysBetweenExpirations': days_between_expirations,
                        'daysToFrontExpiration': days_to_front_expiration,
                        'score': float(score),
                        'optionType': 'call'  # Default to call options for now
                    }
        
        # Set a minimum threshold score (lowered from 5.0 to 1.0)
        MINIMUM_VIABLE_SCORE = 1.0
        
        # Log summary of what we found
        logger.warning(f"SPREAD SEARCH RESULTS FOR {ticker}:")
        
        if best_score > 0:
            logger.warning(f"  Best score: {best_score:.2f}, Threshold: {MINIMUM_VIABLE_SCORE}")
            if best_spread:
                logger.warning(f"  Best spread - Strike: ${best_spread['strike']}, " +
                           f"Front/Back: {best_spread['frontMonth']}/{best_spread['backMonth']}, " +
                           f"Cost: ${best_spread['spreadCost']:.2f}, IV Diff: {best_spread['ivDifferential']:.4f}")
                
                # Add detailed pricing information for the best spread
                logger.warning(f"  Pricing details for best spread:")
                logger.warning(f"    Front month: {best_spread['frontMonth']} - IV: {best_spread['frontIv']:.4f}")
                logger.warning(f"    Back month: {best_spread['backMonth']} - IV: {best_spread['backIv']:.4f}")
        else:
            logger.warning(f"  No valid spreads found with non-zero scores")
            logger.warning(f"  This suggests no spreads had valid pricing data")
        
        if best_score < MINIMUM_VIABLE_SCORE:
            logger.warning(f"  RESULT: Best score {best_score:.2f} below threshold {MINIMUM_VIABLE_SCORE}")
            return None  # No worthwhile play
        
        logger.warning(f"  RESULT: Found optimal spread with score {best_score:.2f}")
        return best_spread
    
    except Exception as e:
        logger.error(f"Error finding optimal calendar spread for {ticker}: {str(e)}")
        return None

def estimate_back_month_iv(front_iv, front_month_date, back_month_date, ts_slope_0_45):
    """
    Estimate back month IV using the calculated term structure slope.
    
    Args:
        front_iv (float): Front month implied volatility
        front_month_date (date): Front month expiration date
        back_month_date (date): Back month expiration date
        ts_slope_0_45 (float): Term structure slope between day 0 and day 45
        
    Returns:
        float: Estimated back month implied volatility
    """
    today = datetime.today().date()
    
    # Calculate days to expiration for front and back month
    days_to_front = (front_month_date - today).days
    days_to_back = (back_month_date - today).days
    
    # Calculate the difference in days between the months
    days_diff = days_to_back - days_to_front
    
    # Estimate back month IV using the term structure slope
    estimated_back_iv = front_iv + (ts_slope_0_45 * days_diff)
    
    # Ensure IV doesn't go below a minimum threshold
    min_iv = front_iv * 0.5  # Set a minimum floor as 50% of front month IV
    return max(estimated_back_iv, min_iv)

def build_term_structure(days, ivs):
    """Build a term structure spline from days to expiry and implied volatilities."""
    days = np.array(days)
    ivs = np.array(ivs)

    sort_idx = days.argsort()
    days = days[sort_idx]
    ivs = ivs[sort_idx]

    spline = interp1d(days, ivs, kind='linear', fill_value="extrapolate")

    def term_spline(dte):
        if dte < days[0]:
            return ivs[0]
        elif dte > days[-1]:
            return ivs[-1]
        else:
            return float(spline(dte))

    return term_spline

# Rate limiter for API calls
class RateLimiter:
    """
    Enhanced rate limiter to prevent hitting API rate limits.
    
    This class implements a token bucket algorithm to limit the rate of API calls.
    It allows for bursts of requests up to a maximum number, but enforces an
    average rate over time. It also supports pausing after a certain number of
    consecutive requests to avoid triggering rate limits.
    """
    def __init__(self, rate=5, per=1.0, burst=10, max_consecutive=10, pause_duration=2.0):
        """
        Initialize the rate limiter.
        
        Args:
            rate (float): Number of requests allowed per time period
            per (float): Time period in seconds
            burst (int): Maximum burst size (token bucket capacity)
            max_consecutive (int): Maximum number of consecutive requests before pausing
            pause_duration (float): Duration to pause after max consecutive requests in seconds
        """
        self.rate = rate  # requests per time period
        self.per = per    # time period in seconds
        self.tokens = burst  # initial tokens
        self.capacity = burst  # maximum tokens
        self.last_refill = time.time()
        self.lock = threading.RLock()
        self.consecutive_requests = 0
        self.max_consecutive = max_consecutive
        self.pause_duration = pause_duration
        
    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill
        new_tokens = elapsed * (self.rate / self.per)
        self.tokens = min(self.capacity, self.tokens + new_tokens)
        self.last_refill = now
        
    def update_config(self, rate=None, per=None, burst=None, max_consecutive=None, pause_duration=None):
        """
        Update rate limiter configuration.
        
        Args:
            rate (float, optional): New rate value
            per (float, optional): New per value
            burst (int, optional): New burst value
            max_consecutive (int, optional): New max consecutive requests value
            pause_duration (float, optional): New pause duration value
        """
        with self.lock:
            if rate is not None:
                self.rate = rate
            if per is not None:
                self.per = per
            if burst is not None:
                self.capacity = burst
                # Don't immediately give all tokens, just update the capacity
            if max_consecutive is not None:
                self.max_consecutive = max_consecutive
            if pause_duration is not None:
                self.pause_duration = pause_duration
            
            logger.info(f"Rate limiter updated: {self.rate} req/{self.per}s, burst={self.capacity}, " +
                       f"max_consecutive={self.max_consecutive}, pause={self.pause_duration}s")
        
    def acquire(self, block=True, timeout=None):
        """
        Acquire a token from the bucket.
        
        Args:
            block (bool): Whether to block until a token is available
            timeout (float): Maximum time to wait for a token
            
        Returns:
            bool: True if a token was acquired, False otherwise
        """
        start_time = time.time()
        
        # Check if we need to pause due to consecutive requests
        with self.lock:
            if self.consecutive_requests >= self.max_consecutive:
                logger.info(f"Pausing for {self.pause_duration}s after {self.consecutive_requests} consecutive requests")
                time.sleep(self.pause_duration)
                self.consecutive_requests = 0
        
        while True:
            with self.lock:
                self._refill()
                
                if self.tokens >= 1:
                    self.tokens -= 1
                    self.consecutive_requests += 1
                    return True
                
                if not block:
                    return False
                
                if timeout is not None and time.time() - start_time > timeout:
                    logger.warning(f"Rate limit timeout after {timeout}s")
                    return False
                
                # Calculate wait time based on token refill rate
                wait_time = (1 - self.tokens) * (self.per / self.rate)
                logger.debug(f"Waiting {wait_time:.2f}s for token refill")
            
            # Wait for tokens to refill
            time.sleep(min(wait_time, 0.5))  # Cap wait time to avoid long sleeps
    
    def __call__(self, func):
        """
        Decorator to rate-limit a function.
        
        Args:
            func: The function to rate-limit
            
        Returns:
            The rate-limited function
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            self.acquire(block=True)
            return func(*args, **kwargs)
        return wrapper

# Function to update rate limiter configuration
def update_rate_limiter_config():
    """Update the rate limiter configuration based on the current settings."""
    # Calculate rate and per values from requests_per_minute
    requests_per_minute = SEQUENTIAL_PROCESSING.get("requests_per_minute", 60)
    rate = requests_per_minute / 60.0  # Convert to requests per second
    per = 1.0  # Keep time period as 1 second for simplicity
    
    # Get other configuration values
    burst = YF_RATE_LIMIT.get("burst", 10)
    max_consecutive = SEQUENTIAL_PROCESSING.get("max_consecutive_requests", 10)
    pause_duration = SEQUENTIAL_PROCESSING.get("pause_duration", 2.0)
    
    # Update the rate limiter
    yf_rate_limiter.update_config(
        rate=rate,
        per=per,
        burst=burst,
        max_consecutive=max_consecutive,
        pause_duration=pause_duration
    )
    
    logger.info(f"Rate limiter updated: {requests_per_minute} requests/minute " +
               f"({rate:.2f} req/s), burst={burst}, max_consecutive={max_consecutive}, " +
               f"pause={pause_duration}s")

# Create a rate limiter for yfinance API calls
# Calculate initial rate from requests_per_minute
requests_per_minute = SEQUENTIAL_PROCESSING.get("requests_per_minute", 60)
rate = requests_per_minute / 60.0  # Convert to requests per second

yf_rate_limiter = RateLimiter(
    rate=rate,
    per=1.0,  # Keep time period as 1 second for simplicity
    burst=YF_RATE_LIMIT["burst"],
    max_consecutive=SEQUENTIAL_PROCESSING.get("max_consecutive_requests", 10),
    pause_duration=SEQUENTIAL_PROCESSING.get("pause_duration", 2.0)
)

# Create a lock for thread-safe API access (still needed for some operations)
_yf_api_lock = threading.RLock()

# Log the rate limiter configuration
logger.info(f"Yahoo Finance rate limiter configured with {requests_per_minute} " +
           f"requests per minute ({rate:.2f} req/s), burst size {YF_RATE_LIMIT['burst']}, " +
           f"max consecutive {SEQUENTIAL_PROCESSING.get('max_consecutive_requests', 10)}, " +
           f"pause duration {SEQUENTIAL_PROCESSING.get('pause_duration', 2.0)}s")

def get_current_price(ticker):
    """
    Get the current price for a stock.
    Thread-safe implementation with rate limiting and retry logic.
    
    Args:
        ticker: yfinance Ticker object
        
    Returns:
        float: Current price or None if there's an error
    """
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            # Acquire a token from the rate limiter
            if not yf_rate_limiter.acquire(block=True, timeout=10):
                logger.warning(f"Rate limit timeout for {ticker.ticker} - could not acquire token within 10 seconds")
                if attempt < max_retries - 1:
                    continue
                else:
                    return None
            
            # Use a lock to prevent too many simultaneous API calls
            with _yf_api_lock:
                todays_data = ticker.history(period='1d')
                if todays_data.empty:
                    logger.warning(f"No price data available for {ticker.ticker}")
                    return None
                return todays_data['Close'].iloc[0]
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Error getting current price for {ticker.ticker} (attempt {attempt+1}/{max_retries}): {str(e)}. Retrying...")
                time.sleep(retry_delay)
            else:
                logger.warning(f"Error getting current price for {ticker.ticker} after {max_retries} attempts: {str(e)}")
                return None

def analyze_options(ticker_symbol, is_scan_mode=False):
    """
    Analyze options data for a given ticker and provide a recommendation.
    Optimized for parallel execution with thread safety and retry logic.
    
    Args:
        ticker_symbol (str): The ticker symbol to analyze
        is_scan_mode (bool): Whether this is being called from scan mode (default: False)
    """
    try:
        ticker_symbol = ticker_symbol.strip().upper()
        if not ticker_symbol:
            return {"error": "No stock symbol provided."}
        
        # Get stock data with thread safety
        with _yf_api_lock:
            stock = yf.Ticker(ticker_symbol)
        
        # Get current price early to filter out low-priced stocks
        current_price = get_current_price(stock)
        
        # Skip stocks with price under $2.50
        if current_price is None:
            return {"error": "Could not retrieve current price."}
        elif current_price < 2.50:
            logger.info(f"{ticker_symbol}: Skipping analysis - price ${current_price} is below $2.50 minimum threshold")
            return {"error": f"Stock price (${current_price}) is below the minimum threshold of $2.50"}
        
        # Get options data with thread safety
        with _yf_api_lock:
            if len(stock.options) == 0:
                return {"error": f"No options found for stock symbol '{ticker_symbol}'."}
            
            # Filter expiration dates
            exp_dates = list(stock.options)
        
        try:
            exp_dates = filter_dates(exp_dates)
        except Exception:
            return {"error": "Not enough option data."}
        
        # Get options chains for each expiration date with thread safety and retry logic
        options_chains = {}
        for exp_date in exp_dates:
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    with _yf_api_lock:
                        options_chains[exp_date] = stock.option_chain(exp_date)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Error getting option chain for {ticker_symbol} {exp_date} (attempt {attempt+1}/{max_retries}): {str(e)}. Retrying...")
                        time.sleep(1)
                    else:
                        logger.error(f"Failed to get option chain for {ticker_symbol} {exp_date} after {max_retries} attempts")
                        return {"error": f"Failed to get option data for {exp_date}: {str(e)}"}
        
        # Use the current price we already retrieved
        underlying_price = current_price
        
        # Calculate ATM IV for each expiration
        atm_iv = {}
        straddle = None
        i = 0
        for exp_date, chain in options_chains.items():
            calls = chain.calls
            puts = chain.puts
            
            if calls.empty or puts.empty:
                continue
            
            call_diffs = (calls['strike'] - underlying_price).abs()
            call_idx = call_diffs.idxmin()
            call_iv = calls.loc[call_idx, 'impliedVolatility']
            
            put_diffs = (puts['strike'] - underlying_price).abs()
            put_idx = put_diffs.idxmin()
            put_iv = puts.loc[put_idx, 'impliedVolatility']
            
            atm_iv_value = (call_iv + put_iv) / 2.0
            atm_iv[exp_date] = atm_iv_value
            
            if i == 0:
                call_bid = calls.loc[call_idx, 'bid']
                call_ask = calls.loc[call_idx, 'ask']
                put_bid = puts.loc[put_idx, 'bid']
                put_ask = puts.loc[put_idx, 'ask']
                
                if call_bid is not None and call_ask is not None:
                    call_mid = (call_bid + call_ask) / 2.0
                else:
                    call_mid = None
                
                if put_bid is not None and put_ask is not None:
                    put_mid = (put_bid + put_ask) / 2.0
                else:
                    put_mid = None
                
                if call_mid is not None and put_mid is not None:
                    straddle = (call_mid + put_mid)
            
            i += 1
        
        if not atm_iv:
            return {"error": "Could not determine ATM IV for any expiration dates."}
        
        # Calculate days to expiry and build term structure
        today = datetime.today().date()
        dtes = []
        ivs = []
        for exp_date, iv in atm_iv.items():
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_expiry = (exp_date_obj - today).days
            dtes.append(days_to_expiry)
            ivs.append(iv)
        
        term_spline = build_term_structure(dtes, ivs)
        
        # Calculate metrics
        ts_slope_0_45 = (term_spline(45) - term_spline(dtes[0])) / (45-dtes[0])
        
        price_history = stock.history(period='3mo')
        iv30_rv30 = term_spline(30) / yang_zhang(price_history)
        
        avg_volume = price_history['Volume'].rolling(30).mean().dropna().iloc[-1]
        
        expected_move = round(straddle / underlying_price * 100, 2) if straddle else None
        expected_move_str = f"{expected_move}%" if expected_move is not None else "N/A"
        
        # Determine recommendation
        # The original calculator.py thresholds
        avg_volume_pass = avg_volume >= 1500000
        iv30_rv30_pass = iv30_rv30 >= 1.25
        ts_slope_pass = ts_slope_0_45 <= -0.00406
        
        # Debug log
        logger.info(f"{ticker_symbol} Analysis - Volume: {avg_volume} (Pass: {avg_volume_pass}), IV30/RV30: {iv30_rv30} (Pass: {iv30_rv30_pass}), TS Slope: {ts_slope_0_45} (Pass: {ts_slope_pass})")
        
        if avg_volume_pass and iv30_rv30_pass and ts_slope_pass:
            recommendation = "Recommended"
        elif ts_slope_pass and ((avg_volume_pass and not iv30_rv30_pass) or (iv30_rv30_pass and not avg_volume_pass)):
            recommendation = "Consider"
        else:
            recommendation = "Avoid"
        
        # Double-check the pass/fail conditions
        # The original calculator.py thresholds
        avg_volume_pass = avg_volume >= 1500000
        iv30_rv30_pass = iv30_rv30 >= 1.25
        ts_slope_pass = ts_slope_0_45 <= -0.00406
        
        # Log the actual values and thresholds
        logger.info(f"{ticker_symbol} Analysis - Final Check:")
        logger.info(f"  Volume: {avg_volume} >= 1500000? {avg_volume_pass}")
        logger.info(f"  IV30/RV30: {iv30_rv30} >= 1.25? {iv30_rv30_pass}")
        logger.info(f"  TS Slope: {ts_slope_0_45} <= -0.00406? {ts_slope_pass}")
        
        # Handle NaN values for JSON serialization
        if np.isnan(avg_volume):
            avg_volume = None
        if np.isnan(iv30_rv30):
            iv30_rv30 = None
        if np.isnan(ts_slope_0_45):
            ts_slope_0_45 = None
            
        # Prepare result - convert all values to JSON-serializable types
        result = {
            "ticker": ticker_symbol,
            "currentPrice": float(underlying_price) if not np.isnan(underlying_price) else None,
            "metrics": {
                "avgVolume": float(avg_volume) if avg_volume is not None else None,
                "avgVolumePass": "true" if avg_volume_pass else "false",  # Convert to string
                "iv30Rv30": float(iv30_rv30) if iv30_rv30 is not None else None,
                "iv30Rv30Pass": "true" if iv30_rv30_pass else "false",    # Convert to string
                "tsSlope": float(ts_slope_0_45) if ts_slope_0_45 is not None else None,
                "tsSlopePass": "true" if ts_slope_pass else "false"       # Convert to string
            },
            "expectedMove": expected_move_str,
            "recommendation": recommendation,
            "timestamp": datetime.now().timestamp()
        }
        
        # Only search for optimal calendar spread in direct search mode
        if not is_scan_mode:
            logger.info(f"{ticker_symbol}: Direct search mode - Searching for optimal calendar spread (metrics pass: {avg_volume_pass and iv30_rv30_pass and ts_slope_pass})")
            optimal_spread = find_optimal_calendar_spread(ticker_symbol, ts_slope=ts_slope_0_45)
            if optimal_spread:
                logger.info(f"{ticker_symbol}: Found optimal calendar spread: {optimal_spread}")
                result["optimalCalendarSpread"] = optimal_spread
                
                # Add metrics pass status to the optimal spread result - convert boolean to string for JSON serialization
                metrics_pass = avg_volume_pass and iv30_rv30_pass and ts_slope_pass
                result["optimalCalendarSpread"]["metricsPass"] = "true" if metrics_pass else "false"
            else:
                logger.info(f"{ticker_symbol}: No optimal calendar spread found")
                
            # Also search for optimal naked options in direct search mode
            logger.info(f"{ticker_symbol}: Direct search mode - Searching for optimal naked options (metrics pass: {avg_volume_pass and iv30_rv30_pass and ts_slope_pass})")
            
            # Import the find_optimal_naked_options function from options_analyzer
            # and the optimized iron condor implementation
            from app.options_analyzer import find_optimal_naked_options
            try:
                # Try to import the optimized iron condor implementation
                from app.optimized_iron_condor import find_optimal_iron_condor
                logger.info(f"{ticker_symbol}: Using optimized iron condor implementation")
            except ImportError:
                # Fall back to the original implementation if the optimized one is not available
                from app.options_analyzer import find_optimal_iron_condor
                logger.info(f"{ticker_symbol}: Using original iron condor implementation")
            
            # Find optimal naked options
            optimal_naked = find_optimal_naked_options(ticker_symbol)
            if optimal_naked:
                logger.info(f"{ticker_symbol}: Found optimal naked options: {optimal_naked}")
                result["optimalNakedOptions"] = optimal_naked
            else:
                logger.info(f"{ticker_symbol}: No optimal naked options found")
                
            # Find optimal iron condors
            logger.info(f"{ticker_symbol}: Direct search mode - Searching for optimal iron condors (metrics pass: {avg_volume_pass and iv30_rv30_pass and ts_slope_pass})")
            optimal_iron_condors = find_optimal_iron_condor(ticker_symbol)
            if optimal_iron_condors:
                logger.info(f"{ticker_symbol}: Found optimal iron condors: {optimal_iron_condors}")
                result["optimalIronCondors"] = optimal_iron_condors
            else:
                logger.info(f"{ticker_symbol}: No optimal iron condors found")
        else:
            logger.info(f"{ticker_symbol}: Scan mode - Skipping optimal calendar spread search to improve performance")
            
            # But still search for optimal naked options in scan mode
            # This is important for the screener tab to show naked options
            logger.info(f"{ticker_symbol}: Scan mode - Searching for optimal naked options (metrics pass: {avg_volume_pass and iv30_rv30_pass and ts_slope_pass})")
            
            # Import the find_optimal_naked_options function from options_analyzer
            # and the optimized iron condor implementation if not already imported
            from app.options_analyzer import find_optimal_naked_options
            try:
                # Try to import the optimized iron condor implementation
                from app.optimized_iron_condor import find_optimal_iron_condor
                logger.info(f"{ticker_symbol}: Using optimized iron condor implementation in scan mode")
            except ImportError:
                # Fall back to the original implementation if the optimized one is not available
                from app.options_analyzer import find_optimal_iron_condor
                logger.info(f"{ticker_symbol}: Using original iron condor implementation in scan mode")
            
            if avg_volume_pass and iv30_rv30_pass and ts_slope_pass:
                # Find optimal naked options
                optimal_naked = find_optimal_naked_options(ticker_symbol)
                if optimal_naked:
                    logger.info(f"{ticker_symbol}: Found optimal naked options: {optimal_naked}")
                    result["optimalNakedOptions"] = optimal_naked
                else:
                    logger.info(f"{ticker_symbol}: No optimal naked options found")
                
                # Find optimal iron condors
                logger.info(f"{ticker_symbol}: Scan mode - Searching for optimal iron condors (metrics pass: {avg_volume_pass and iv30_rv30_pass and ts_slope_pass})")
                optimal_iron_condors = find_optimal_iron_condor(ticker_symbol)
                if optimal_iron_condors:
                    logger.info(f"{ticker_symbol}: Found optimal iron condors: {optimal_iron_condors}")
                    result["optimalIronCondors"] = optimal_iron_condors
                else:
                    logger.info(f"{ticker_symbol}: No optimal iron condors found")
        
        return result
    
    except Exception as e:
        return {"error": f"Error analyzing options: {str(e)}"}

def handle_pandas_dataframe(df, date_str):
    """
    Handle pandas DataFrame returned by finance_calendars.
    
    Args:
        df (pandas.DataFrame): DataFrame with earnings data
        date_str (str): Date string in YYYY-MM-DD format
        
    Returns:
        list: List of earnings calendar items in our format
    """
    import pandas as pd
    
    logger.info(f"Processing pandas DataFrame with {len(df)} rows")
    
    # Log column names for debugging
    if not df.empty:
        logger.info(f"DataFrame columns: {list(df.columns)}")
    
    formatted_data = []
    
    # Check if we have the expected column format from finance_calendars
    has_finance_calendars_format = all(col in df.columns for col in ['time', 'name'])
    
    # Get the index column if it exists (might contain ticker symbols)
    index_is_ticker = False
    if hasattr(df, 'index') and hasattr(df.index, 'name'):
        logger.info(f"DataFrame index name: {df.index.name}")
        if df.index.name == 'symbol' or df.index.name == 'Symbol' or df.index.name == 'ticker' or df.index.name == 'Ticker':
            index_is_ticker = True
            logger.info("Using DataFrame index as ticker symbols")
    
    # Convert DataFrame to list of dictionaries
    for idx, row in df.iterrows():
        try:
            # Extract data from row
            ticker = ''
            company = ''
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format:
                # In finance_calendars format, the index is the ticker symbol
                if index_is_ticker:
                    ticker = str(idx)
                else:
                    # Try to extract ticker from the name (e.g., "AAPL Apple Inc.")
                    name_parts = str(row['name']).split()
                    if name_parts and len(name_parts[0]) <= 5 and name_parts[0].isupper():
                        ticker = name_parts[0]
                    else:
                        # Generate a placeholder ticker
                        ticker = f"UNKNOWN_{idx}"
                
                company = str(row['name'])
                
                # Log the extraction for debugging
                logger.info(f"Extracted ticker: {ticker}, company: {company} from row: {row['name']}")
            else:
                # Try different column names for ticker symbol
                if 'Symbol' in row:
                    ticker = str(row['Symbol'])
                elif 'symbol' in row:
                    ticker = str(row['symbol'])
                elif 'Ticker' in row:
                    ticker = str(row['Ticker'])
                elif 'ticker' in row:
                    ticker = str(row['ticker'])
                elif index_is_ticker:
                    ticker = str(idx)
                    
                # Try different column names for company name
                if 'Company' in row:
                    company = str(row['Company'])
                elif 'company' in row:
                    company = str(row['company'])
                elif 'Name' in row:
                    company = str(row['Name'])
                elif 'name' in row:
                    company = str(row['name'])
                else:
                    company = ticker  # Use ticker as company name
            
            # Determine report time
            report_time = 'AMC'  # Default to After Market Close
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format and 'time' in row:
                time_val = str(row['time']).lower()
                if 'bmo' in time_val or 'before' in time_val or 'morning' in time_val:
                    report_time = 'BMO'
                elif 'amc' in time_val or 'after' in time_val or 'evening' in time_val:
                    report_time = 'AMC'
                # Log the time value for debugging
                logger.info(f"Time value: {time_val}, interpreted as: {report_time}")
            else:
                # Try standard column names
                if 'Call Time' in row:
                    call_time = str(row['Call Time'])
                    if 'bmo' in call_time.lower() or 'before' in call_time.lower():
                        report_time = 'BMO'
                elif 'Time' in row:
                    call_time = str(row['Time'])
                    if 'bmo' in call_time.lower() or 'before' in call_time.lower():
                        report_time = 'BMO'
            
            # Get EPS estimates if available
            eps_estimate = None
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format and 'epsForecast' in row:
                try:
                    val = row['epsForecast']
                    if val is not None and not pd.isna(val):
                        eps_estimate = float(val)
                        # Log the EPS forecast for debugging
                        logger.info(f"EPS forecast: {eps_estimate}")
                except:
                    pass
            else:
                # Try standard column names
                for col in ['EPS Estimate', 'eps_estimate', 'Estimate', 'estimate']:
                    if col in row:
                        try:
                            val = row[col]
                            if val is not None and not pd.isna(val):
                                eps_estimate = float(val)
                                break
                        except:
                            pass
            
            # Get actual EPS if available
            actual_eps = None
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format and 'lastYearEPS' in row:
                try:
                    val = row['lastYearEPS']
                    if val is not None and not pd.isna(val):
                        actual_eps = float(val)
                        # Log the last year EPS for debugging
                        logger.info(f"Last year EPS: {actual_eps}")
                except:
                    pass
            else:
                # Try standard column names
                for col in ['Reported EPS', 'reported_eps', 'Actual EPS', 'actual_eps', 'Actual', 'actual']:
                    if col in row:
                        try:
                            val = row[col]
                            if val is not None and not pd.isna(val):
                                actual_eps = float(val)
                                break
                        except:
                            pass
            
            formatted_data.append({
                "ticker": ticker,
                "companyName": company,
                "reportTime": report_time,
                "date": date_str,
                "estimatedEPS": eps_estimate,
                "actualEPS": actual_eps
            })
        except Exception as e:
            logger.warning(f"Error processing row: {e}")
            continue
    
    return formatted_data

def get_earnings_calendar(date_str=None):
    """
    Get earnings calendar for a specific date or today using finance_calendars API.
    
    Args:
        date_str (str, optional): Date in YYYY-MM-DD format. Defaults to today.
        
    Returns:
        list: List of earnings calendar items
    """
    try:
        # Check if finance_calendars is available
        if importlib.util.find_spec("finance_calendars") is None:
            logger.error("finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7")
            raise ImportError("finance_calendars package is not installed")
        
        # Import finance_calendars
        from finance_calendars import finance_calendars as fc
        
        # Use provided date or default to today
        if date_str is None:
            logger.info("No date provided, using today's date")
            # Get today's earnings
            earnings_data = fc.get_earnings_today()
            date_str = datetime.now().strftime('%Y-%m-%d')
        else:
            # Convert string date to datetime object
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                logger.info(f"Getting earnings for date: {date_str}")
                earnings_data = fc.get_earnings_by_date(date_obj)
            except ValueError:
                logger.error(f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD")
                raise ValueError(f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD")
        
        # Log the number of earnings found
        logger.info(f"Found {len(earnings_data)} earnings announcements for {date_str}")
        
        # Log the raw data for debugging
        logger.info(f"Raw earnings data type: {type(earnings_data)}")
        
        # Check if it's a pandas DataFrame
        if str(type(earnings_data)).startswith("<class 'pandas.core.frame.DataFrame"):
            # Handle pandas DataFrame
            formatted_data = handle_pandas_dataframe(earnings_data, date_str)
        else:
            # For list-like data
            if len(earnings_data) > 0:
                logger.info(f"First item type: {type(earnings_data[0])}")
                logger.info(f"First item: {earnings_data[0]}")
            
            # Convert to our format
            formatted_data = []
            for item in earnings_data:
                # Handle different possible formats
                if isinstance(item, dict):
                    # If item is already a dictionary
                    formatted_data.append({
                        "ticker": item.get('symbol', ''),
                        "companyName": item.get('name', ''),
                        "reportTime": item.get('when', 'AMC'),  # Default to AMC if not specified
                        "date": date_str,
                        "estimatedEPS": item.get('estimate'),
                        "actualEPS": item.get('actual')
                    })
                elif isinstance(item, str):
                    # If item is a string (likely a ticker symbol)
                    formatted_data.append({
                        "ticker": item,
                        "companyName": item,  # Use ticker as company name
                        "reportTime": "AMC",  # Default to AMC
                        "date": date_str,
                        "estimatedEPS": None,
                        "actualEPS": None
                    })
                elif hasattr(item, '__getitem__') and len(item) >= 2:
                    # If item is a list-like object with at least 2 elements
                    # Assuming format is [symbol, name, ...]
                    formatted_data.append({
                        "ticker": item[0] if isinstance(item[0], str) else str(item[0]),
                        "companyName": item[1] if isinstance(item[1], str) else str(item[1]),
                        "reportTime": "AMC",  # Default to AMC
                        "date": date_str,
                        "estimatedEPS": None,
                        "actualEPS": None
                    })
                else:
                    # For any other format, try to convert to string
                    try:
                        ticker = str(item)
                        formatted_data.append({
                            "ticker": ticker,
                            "companyName": ticker,  # Use ticker as company name
                            "reportTime": "AMC",  # Default to AMC
                            "date": date_str,
                            "estimatedEPS": None,
                            "actualEPS": None
                        })
                    except:
                        logger.warning(f"Skipping item due to unknown format: {item}")
        
        return formatted_data
    except ImportError as e:
        logger.error(f"ImportError: {str(e)}")
        raise ImportError(f"finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7")
    except Exception as e:
        logger.error(f"Error fetching earnings calendar: {str(e)}")
        raise Exception(f"Error fetching earnings calendar: {str(e)}")


def quick_filter_ticker(ticker_symbol):
    """
    Quickly filter tickers based on price and volume criteria.
    Rate-limited implementation to prevent hitting API limits.
    
    Args:
        ticker_symbol (str): The ticker symbol to filter
        
    Returns:
        bool: True if the ticker passes the quick filter, False otherwise
    """
    try:
        logger.info(f"Quick filtering ticker: {ticker_symbol}")
        
        # Get stock data with rate limiting
        if not yf_rate_limiter.acquire(block=True, timeout=10):
            logger.warning(f"Rate limit timeout for {ticker_symbol} - skipping quick filter")
            return False
            
        with _yf_api_lock:
            stock = yf.Ticker(ticker_symbol)
        
        # Check price
        current_price = get_current_price(stock)
        min_price = QUICK_FILTER["min_price"]
        if current_price is None or current_price < min_price:
            logger.info(f"{ticker_symbol}: Failed quick filter - price ${current_price} is below ${min_price} minimum threshold")
            return False
            
        # Check volume
        try:
            # Acquire a token from the rate limiter
            if not yf_rate_limiter.acquire(block=True, timeout=10):
                logger.warning(f"Rate limit timeout for {ticker_symbol} volume check - skipping")
                return False
                
            with _yf_api_lock:
                price_history = stock.history(period='5d')
                
            if price_history.empty:
                logger.info(f"{ticker_symbol}: Failed quick filter - no price history available")
                return False
                
            avg_volume = price_history['Volume'].mean()
            min_volume = QUICK_FILTER["min_volume"]
            if avg_volume < min_volume:
                logger.info(f"{ticker_symbol}: Failed quick filter - average volume {avg_volume} is below {min_volume:,} threshold")
                return False
                
            logger.info(f"{ticker_symbol}: Passed quick filter - price: ${current_price}, volume: {avg_volume}")
            return True
        except Exception as e:
            logger.warning(f"Error checking volume for {ticker_symbol}: {str(e)}")
            return False
            
    except Exception as e:
        logger.warning(f"Error in quick filter for {ticker_symbol}: {str(e)}")
        return False

# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().timestamp()
    })

@app.route('/api/analyze/<ticker>', methods=['GET'])
def analyze_ticker(ticker):
    """Analyze options data for a given ticker."""
    try:
        # Explicitly set is_scan_mode=False for direct searches
        result = analyze_options(ticker, is_scan_mode=False)
        if "error" in result:
            return jsonify({
                "error": result["error"],
                "ticker": ticker,
                "timestamp": datetime.now().timestamp()
            }), 400
        return jsonify(result)
    except Exception as e:
        logger.error(f"Unexpected error analyzing {ticker}: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred",
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

def process_ticker(earning):
    """
    Process a single ticker for the earnings scan.
    This function is designed to be used with ThreadPoolExecutor.
    
    Args:
        earning (dict): Earnings data for a ticker
        
    Returns:
        dict: Analysis result for the ticker
    """
    ticker = earning.get('ticker')
    if not ticker:
        logger.warning(f"Skipping earning without ticker: {earning}")
        return None
        
    logger.info(f"Processing ticker: {ticker}, company: {earning.get('companyName', '')}")
    
    try:
        # First apply quick filter
        if not quick_filter_ticker(ticker):
            logger.info(f"{ticker} did not pass quick filter, skipping detailed analysis")
            return {
                "ticker": ticker,
                "companyName": earning.get('companyName', ''),
                "reportTime": earning.get('reportTime', ''),
                "currentPrice": None,
                "metrics": {
                    "avgVolume": None,
                    "avgVolumePass": "false",
                    "iv30Rv30": None,
                    "iv30Rv30Pass": "false",
                    "tsSlope": None,
                    "tsSlopePass": "false"
                },
                "expectedMove": "N/A",
                "recommendation": "Filtered Out",
                "error": "Did not pass quick filter criteria",
                "timestamp": datetime.now().timestamp()
            }
        
        # If it passes quick filter, perform detailed analysis
        logger.info(f"{ticker} passed quick filter, performing detailed analysis")
        analysis = analyze_options(ticker, is_scan_mode=True)
        
        if "error" not in analysis:
            # Add company name from earnings data
            analysis['companyName'] = earning.get('companyName', '')
            analysis['reportTime'] = earning.get('reportTime', '')
            logger.info(f"Successfully analyzed {ticker}")
            return analysis
        else:
            # Include failed analysis with error message but with valid structure
            error_msg = analysis["error"]
            logger.warning(f"Analysis error for {ticker}: {error_msg}")
            
            # Create a placeholder result with the error but valid structure
            return {
                "ticker": ticker,
                "companyName": earning.get('companyName', ''),
                "reportTime": earning.get('reportTime', ''),
                "currentPrice": None,
                "metrics": {
                    "avgVolume": None,
                    "avgVolumePass": "false",
                    "iv30Rv30": None,
                    "iv30Rv30Pass": "false",
                    "tsSlope": None,
                    "tsSlopePass": "false"
                },
                "expectedMove": "N/A",
                "recommendation": "No Data",
                "error": error_msg,
                "timestamp": datetime.now().timestamp()
            }
    except Exception as e:
        logger.warning(f"Error analyzing {ticker}: {str(e)}")
        # Include failed analysis with error message but with valid structure
        return {
            "ticker": ticker,
            "companyName": earning.get('companyName', ''),
            "reportTime": earning.get('reportTime', ''),
            "currentPrice": None,
            "metrics": {
                "avgVolume": None,
                "avgVolumePass": "false",
                "iv30Rv30": None,
                "iv30Rv30Pass": "false",
                "tsSlope": None,
                "tsSlopePass": "false"
            },
            "expectedMove": "N/A",
            "recommendation": "No Data",
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }


@app.route('/api/scan/earnings', methods=['GET'])
def scan_earnings():
    """Scan stocks with earnings announcements for options analysis using sequential processing."""
    try:
        # Get date parameter if provided
        date_str = request.args.get('date')
        logger.info(f"Scanning earnings with date parameter: {date_str}")
        
        # Check if finance_calendars is installed
        if importlib.util.find_spec("finance_calendars") is None:
            return jsonify({
                "error": "finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        try:
            # Get earnings calendar
            earnings = get_earnings_calendar(date_str)
            
            # Verify earnings data format
            if not isinstance(earnings, list):
                logger.error(f"Unexpected earnings data format: {type(earnings)}")
                return jsonify({
                    "error": f"Unexpected earnings data format: {type(earnings)}",
                    "timestamp": datetime.now().timestamp()
                }), 500
                
            if len(earnings) == 0:
                logger.warning(f"No earnings found for date: {date_str or datetime.now().strftime('%Y-%m-%d')}")
                return jsonify({
                    "date": date_str or datetime.now().strftime('%Y-%m-%d'),
                    "count": 0,
                    "results": [],
                    "message": "No earnings announcements found for this date",
                    "timestamp": datetime.now().timestamp()
                })
        except ImportError as e:
            return jsonify({
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Error fetching earnings calendar: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        # Log the earnings data for debugging
        logger.info(f"Processing {len(earnings)} earnings announcements sequentially")
        for i, earning in enumerate(earnings[:5]):  # Log first 5 for debugging
            logger.info(f"Earning {i+1}: {earning}")
        
        # Process tickers sequentially with rate limiting
        results = []
        
        # Get rate limiting configuration
        rate_per_second = yf_rate_limiter.rate / yf_rate_limiter.per  # Requests per second
        api_calls_per_ticker = SEQUENTIAL_PROCESSING["api_calls_per_ticker"]
        
        logger.info(f"Starting sequential processing (rate: {rate_per_second:.1f} req/s, " +
                   f"estimated {api_calls_per_ticker} API calls per ticker)")
        
        # Process each ticker sequentially
        completed = 0
        total = len(earnings)
        filtered_out = 0
        no_data = 0
        
        # Create a response object with streaming capability
        def generate():
            nonlocal completed, filtered_out, no_data, results
            
            # Send initial progress information
            progress_data = {
                "status": "in_progress",
                "progress": {
                    "completed": completed,
                    "total": total,
                    "percent": 0,
                    "filtered_out": filtered_out,
                    "no_data": no_data
                },
                "results": [],
                "timestamp": datetime.now().timestamp()
            }
            yield f"data: {json.dumps(progress_data)}\n\n"
            
            # Process each ticker
            for earning in earnings:
                ticker = earning.get('ticker')
                if not ticker:
                    logger.warning(f"Skipping earning without ticker: {earning}")
                    continue
                    
                completed += 1
                
                if completed % 5 == 0 or completed == total:
                    logger.info(f"Progress: {completed}/{total} tickers processed ({(completed/total*100):.1f}%)")
                    
                    # Send progress update
                    progress_data = {
                        "status": "in_progress",
                        "progress": {
                            "completed": completed,
                            "total": total,
                            "percent": round((completed/total*100), 1),
                            "filtered_out": filtered_out,
                            "no_data": no_data
                        },
                        "results": results,
                        "timestamp": datetime.now().timestamp()
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"
                
                try:
                    result = process_ticker(earning)
                    if result is not None:
                        # Skip both "Filtered Out" and "No Data" tickers
                        if result.get("recommendation") == "Filtered Out":
                            filtered_out += 1
                            logger.info(f"Filtered out {ticker} - not adding to results")
                        elif result.get("recommendation") == "No Data":
                            no_data += 1
                            logger.info(f"Skipping {ticker} with No Data - not adding to results")
                        else:
                            # Only add tickers with valid recommendations
                            results.append(result)
                            logger.info(f"Completed analysis for {ticker} and added to results")
                except Exception as e:
                    logger.error(f"Unhandled exception for {ticker}: {str(e)}")
                    # Count as no data but don't add to results
                    no_data += 1
            
            # Filter out results with no data or filtered out
            filtered_results = [result for result in results if result.get("recommendation") not in ["No Data", "Filtered Out"]]
            
            # Send final results
            final_data = {
                "status": "complete",
                "date": date_str or datetime.now().strftime('%Y-%m-%d'),
                "count": len(filtered_results),
                "results": filtered_results,
                "filtered_out": filtered_out,
                "no_data": no_data,
                "timestamp": datetime.now().timestamp()
            }
            yield f"data: {json.dumps(final_data)}\n\n"
            
            logger.info(f"Scan complete. Found {len(filtered_results)} valid results out of {total} earnings announcements")
            logger.info(f"Quick filtered: {filtered_out}, No data: {no_data}")
        
        # Return a streaming response
        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        logger.error(f"Error scanning earnings: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@app.route('/api/calendar/today', methods=['GET'])
def get_today_calendar():
    """Get today's earnings calendar."""
    try:
        # Check if finance_calendars is installed
        if importlib.util.find_spec("finance_calendars") is None:
            return jsonify({
                "error": "finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        try:
            earnings = get_earnings_calendar()
            
            # Verify earnings data format
            if not isinstance(earnings, list):
                logger.error(f"Unexpected earnings data format: {type(earnings)}")
                return jsonify({
                    "error": f"Unexpected earnings data format: {type(earnings)}",
                    "timestamp": datetime.now().timestamp()
                }), 500
                
            if len(earnings) == 0:
                logger.warning("No earnings found for today")
                return jsonify({
                    "date": datetime.now().strftime('%Y-%m-%d'),
                    "count": 0,
                    "earnings": [],
                    "message": "No earnings announcements found for today",
                    "timestamp": datetime.now().timestamp()
                })
                
            return jsonify({
                "date": datetime.now().strftime('%Y-%m-%d'),
                "count": len(earnings),
                "earnings": earnings,
                "timestamp": datetime.now().timestamp()
            })
        except ImportError as e:
            return jsonify({
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Error fetching earnings calendar: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }), 500
    except Exception as e:
        logger.error(f"Error getting today's earnings calendar: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@app.route('/api/calendar/<date>', methods=['GET'])
def get_calendar_by_date(date):
    """Get earnings calendar for a specific date."""
    try:
        # Check if finance_calendars is installed
        if importlib.util.find_spec("finance_calendars") is None:
            return jsonify({
                "error": "finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                "error": f"Invalid date format: {date}. Expected format: YYYY-MM-DD",
                "timestamp": datetime.now().timestamp()
            }), 400
            
        logger.info(f"Getting earnings calendar for date: {date}")
        
        try:
            earnings = get_earnings_calendar(date)
            
            # Verify earnings data format
            if not isinstance(earnings, list):
                logger.error(f"Unexpected earnings data format: {type(earnings)}")
                return jsonify({
                    "error": f"Unexpected earnings data format: {type(earnings)}",
                    "timestamp": datetime.now().timestamp()
                }), 500
                
            if len(earnings) == 0:
                logger.warning(f"No earnings found for date: {date}")
                return jsonify({
                    "date": date,
                    "count": 0,
                    "earnings": [],
                    "message": f"No earnings announcements found for {date}",
                    "timestamp": datetime.now().timestamp()
                })
            
            return jsonify({
                "date": date,
                "count": len(earnings),
                "earnings": earnings,
                "timestamp": datetime.now().timestamp()
            })
        except ImportError as e:
            return jsonify({
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Error fetching earnings calendar: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }), 500
    except Exception as e:
        logger.error(f"Error getting earnings calendar for {date}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

def generate_sample_earnings(date_str):
    """
    Generate sample earnings data for a specific date.
    
    Args:
        date_str (str): Date in YYYY-MM-DD format
        
    Returns:
        list: List of sample earnings calendar items
    """
    # Generate different sample data based on the date to make it more realistic
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    day_of_week = date_obj.weekday()  # 0 = Monday, 6 = Sunday
    month = date_obj.month
    day = date_obj.day
    
    # Use a combination of day of week, month, and day to generate varied data
    # This ensures different dates show different companies
    seed = day_of_week + month * 10 + day
    
    # List of actual companies with their real sectors
    all_companies = [
        {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "eps": 1.52},
        {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "eps": 2.35},
        {"ticker": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "eps": 0.83},
        {"ticker": "GOOGL", "name": "Alphabet Inc.", "sector": "Communication Services", "eps": 1.89},
        {"ticker": "META", "name": "Meta Platforms, Inc.", "sector": "Communication Services", "eps": 4.71},
        {"ticker": "TSLA", "name": "Tesla, Inc.", "sector": "Consumer Cyclical", "eps": 0.73},
        {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "eps": 5.16},
        {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financial Services", "eps": 3.41},
        {"ticker": "V", "name": "Visa Inc.", "sector": "Financial Services", "eps": 2.37},
        {"ticker": "WMT", "name": "Walmart Inc.", "sector": "Consumer Defensive", "eps": 0.62},
        {"ticker": "PG", "name": "Procter & Gamble Company", "sector": "Consumer Defensive", "eps": 1.83},
        {"ticker": "DIS", "name": "The Walt Disney Company", "sector": "Communication Services", "eps": 1.21},
        {"ticker": "NFLX", "name": "Netflix, Inc.", "sector": "Communication Services", "eps": 4.52},
        {"ticker": "INTC", "name": "Intel Corporation", "sector": "Technology", "eps": 0.13},
        {"ticker": "AMD", "name": "Advanced Micro Devices, Inc.", "sector": "Technology", "eps": 0.68},
        {"ticker": "CSCO", "name": "Cisco Systems, Inc.", "sector": "Technology", "eps": 0.87},
        {"ticker": "ADBE", "name": "Adobe Inc.", "sector": "Technology", "eps": 4.13},
        {"ticker": "CRM", "name": "Salesforce, Inc.", "sector": "Technology", "eps": 2.26},
        {"ticker": "PYPL", "name": "PayPal Holdings, Inc.", "sector": "Financial Services", "eps": 1.18},
        {"ticker": "COST", "name": "Costco Wholesale Corporation", "sector": "Consumer Defensive", "eps": 3.92},
        {"ticker": "MCD", "name": "McDonald's Corporation", "sector": "Consumer Cyclical", "eps": 2.82},
        {"ticker": "NKE", "name": "NIKE, Inc.", "sector": "Consumer Cyclical", "eps": 0.98},
        {"ticker": "BA", "name": "The Boeing Company", "sector": "Industrials", "eps": -1.15},
        {"ticker": "GS", "name": "The Goldman Sachs Group, Inc.", "sector": "Financial Services", "eps": 8.79},
        {"ticker": "IBM", "name": "International Business Machines", "sector": "Technology", "eps": 1.63},
        {"ticker": "T", "name": "AT&T Inc.", "sector": "Communication Services", "eps": 0.57},
        {"ticker": "VZ", "name": "Verizon Communications Inc.", "sector": "Communication Services", "eps": 1.15},
        {"ticker": "CAT", "name": "Caterpillar Inc.", "sector": "Industrials", "eps": 5.12},
        {"ticker": "CVX", "name": "Chevron Corporation", "sector": "Energy", "eps": 3.45},
        {"ticker": "XOM", "name": "Exxon Mobil Corporation", "sector": "Energy", "eps": 2.14},
        {"ticker": "PFE", "name": "Pfizer Inc.", "sector": "Healthcare", "eps": 0.47},
        {"ticker": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare", "eps": 2.31},
        {"ticker": "UNH", "name": "UnitedHealth Group Incorporated", "sector": "Healthcare", "eps": 6.57},
        {"ticker": "HD", "name": "The Home Depot, Inc.", "sector": "Consumer Cyclical", "eps": 3.81},
        {"ticker": "BAC", "name": "Bank of America Corporation", "sector": "Financial Services", "eps": 0.78},
        {"ticker": "MA", "name": "Mastercard Incorporated", "sector": "Financial Services", "eps": 3.07},
        {"ticker": "KO", "name": "The Coca-Cola Company", "sector": "Consumer Defensive", "eps": 0.49},
        {"ticker": "PEP", "name": "PepsiCo, Inc.", "sector": "Consumer Defensive", "eps": 2.15},
        {"ticker": "ABBV", "name": "AbbVie Inc.", "sector": "Healthcare", "eps": 2.91},
        {"ticker": "MRK", "name": "Merck & Co., Inc.", "sector": "Healthcare", "eps": 1.83}
    ]
    
    # Select companies based on the seed
    # This ensures different dates show different companies
    import random
    random.seed(seed)
    
    # Shuffle the companies list
    shuffled_companies = all_companies.copy()
    random.shuffle(shuffled_companies)
    
    # Select 5-8 companies based on the seed
    num_companies = (seed % 4) + 5  # 5 to 8 companies
    selected_companies = shuffled_companies[:num_companies]
    
    # Create the earnings data
    result = []
    for company in selected_companies:
        # Alternate between BMO and AMC
        report_time = "BMO" if len(result) % 2 == 0 else "AMC"
        
        result.append({
            "ticker": company["ticker"],
            "companyName": company["name"],
            "reportTime": report_time,
            "date": date_str,
            "estimatedEPS": company["eps"],
            "actualEPS": None
        })
    
    return result

# Import and register the earnings history endpoint
try:
    from run_direct_earnings_history import register_earnings_history_endpoint
    register_earnings_history_endpoint(app)
    print("Earnings history endpoint registered successfully")
except ImportError as e:
    print(f"Warning: Could not import earnings history module: {e}")
    print("The earnings history endpoint will not be available")
except Exception as e:
    print(f"Warning: Error registering earnings history endpoint: {e}")
    print("The earnings history endpoint will not be available")

if __name__ == "__main__":
    print("Options Earnings Screener Backend - Direct Run")
    print("=============================================")
    print("This script runs a minimal Flask server with the core functionality.")
    print("No virtual environment or additional dependencies are needed.")
    print()
    
    # Check if any packages are missing
    if missing_packages:
        print(f"Missing required packages: {', '.join(missing_packages)}")
        print("Please install them using:")
        print(f"python -m pip install --user {' '.join(missing_packages)}")
        sys.exit(1)
    
    # Run the server
    print("Starting server on http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    print()
    # Disable auto-reloader to prevent server restarts during scans
    # while keeping debug mode for better error reporting
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)