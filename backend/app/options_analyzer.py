"""
Options Analyzer Module

This module contains the core analysis functions for options data.
Extracted and refactored from the original calculator.py file.
"""

import numpy as np
from typing import Dict, List, Union, Any
import logging
import concurrent.futures
import time
import math
from datetime import datetime, timedelta
from scipy.interpolate import interp1d
from scipy.stats import norm
from app.data_fetcher import get_stock_data, get_options_data, get_current_price
import yfinance as yf

# Set up logging first
logger = logging.getLogger(__name__)

# Logger is already set up above

def filter_dates(dates):
    """
    Filter option expiration dates to include only those within 45 days.
    
    Args:
        dates (list): List of date strings in YYYY-MM-DD format
        
    Returns:
        list: Filtered list of date strings
        
    Raises:
        ValueError: If no suitable dates are found
    """
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


def get_strikes_near_price(stock, expiration, current_price, range_percent=10):
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
        chain = stock.option_chain(expiration)
        calls = chain.calls
        
        if calls.empty:
            return []
        
        # Calculate price range
        min_price = current_price * (1 - range_percent/100)
        max_price = current_price * (1 + range_percent/100)
        
        # Filter strikes within range
        strikes = calls['strike'].unique()
        return [strike for strike in strikes if min_price <= strike <= max_price]
    except Exception as e:
        return []


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
        
        if calls.empty or puts.empty:
            return 0.0
        
        # Find the call and put with the given strike
        call_options = calls[calls['strike'] == strike]
        put_options = puts[puts['strike'] == strike]
        
        if call_options.empty or put_options.empty:
            return 0.0
        
        call_iv = call_options.iloc[0]['impliedVolatility']
        put_iv = put_options.iloc[0]['impliedVolatility']
        
        # Average of call and put IV
        return (call_iv + put_iv) / 2.0
    except Exception as e:
        return 0.0


def calculate_spread_cost(stock, front_month, back_month, strike, option_type='call'):
    """
    Calculate the cost of a calendar spread.
    
    Args:
        stock (Ticker): yfinance Ticker object
        front_month (str): Front month expiration in YYYY-MM-DD format
        back_month (str): Back month expiration in YYYY-MM-DD format
        strike (float): Strike price
        option_type (str): 'call' or 'put'
        
    Returns:
        float: Cost of the calendar spread
    """
    try:
        # Get front month option
        front_chain = stock.option_chain(front_month)
        front_options = front_chain.calls if option_type.lower() == 'call' else front_chain.puts
        
        # Get back month option
        back_chain = stock.option_chain(back_month)
        back_options = back_chain.calls if option_type.lower() == 'call' else back_chain.puts
        
        if front_options.empty or back_options.empty:
            return 0.0
        
        # Find the options with the given strike
        front_options = front_options[front_options['strike'] == strike]
        back_options = back_options[back_options['strike'] == strike]
        
        if front_options.empty or back_options.empty:
            return 0.0
        
        # Calculate mid prices
        front_bid = front_options.iloc[0]['bid']
        front_ask = front_options.iloc[0]['ask']
        front_mid = (front_bid + front_ask) / 2.0 if front_bid and front_ask else 0.0
        
        back_bid = back_options.iloc[0]['bid']
        back_ask = back_options.iloc[0]['ask']
        back_mid = (back_bid + back_ask) / 2.0 if back_bid and back_ask else 0.0
        
        # Calendar spread cost = back month price - front month price
        return back_mid - front_mid
    except Exception as e:
        return 0.0


def get_improved_liquidity_score(option, option_price=None):
    """
    Calculate a more realistic liquidity score for an option that better reflects trading challenges.
    
    Args:
        option (dict): Option data containing bid, ask, volume, openInterest
        option_price (float, optional): Current mid price of the option, if different from (bid+ask)/2
        
    Returns:
        dict: Liquidity details including:
            - score: Overall liquidity score (0-10, higher is better)
            - spread_pct: Bid-ask spread as percentage of option price
            - volume: Trading volume
            - open_interest: Open interest
            - has_zero_bid: Whether the option has a zero bid
            - spread_dollars: Absolute spread in dollars
    """
    import numpy as np
    
    try:
        # Extract basic values
        bid = option['bid'] if 'bid' in option else 0.0
        ask = option['ask'] if 'ask' in option else 0.0
        volume = option['volume'] if 'volume' in option and option['volume'] > 0 else 0
        open_interest = option['openInterest'] if 'openInterest' in option and option['openInterest'] > 0 else 0
        
        # Flag for zero bids
        has_zero_bid = bid <= 0.001  # Consider very small bids effectively zero
        
        # Calculate mid price
        mid_price = (bid + ask) / 2.0 if not has_zero_bid else option_price or ask / 2.0
        
        # If both bid and ask are zero or extremely low, this is an extremely illiquid option
        if ask <= 0.001 or mid_price <= 0.001:
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': True,
                'spread_dollars': 0.0
            }
        
        # Calculate absolute spread
        spread_dollars = ask - bid
        
        # Calculate percentage spread - more heavily penalize wide spreads
        spread_pct = spread_dollars / mid_price
        
        # More aggressive penalty for wide spreads
        # Old formula: base_score = 10.0 * (1.0 / (1.0 + (spread_pct * 10)))
        # New formula is more punishing for wide spreads
        spread_factor = 1.0 / (1.0 + (spread_pct * 20))
        
        # Volume factor with more pragmatic scaling
        # Volume below 100 is penalized more heavily
        volume_factor = min(1.0, np.sqrt(volume / 500))
        
        # Open interest factor
        # We want at least 500+ open interest for good liquidity
        oi_factor = min(1.0, np.sqrt(open_interest / 500))
        
        # For low-priced options (under $0.20), penalize more as they're harder to trade efficiently
        low_price_penalty = 0.7 if mid_price < 0.20 else 1.0
        
        # Apply more severe penalty for zero bids - realistically these are very hard to trade
        zero_bid_penalty = 0.3 if has_zero_bid else 1.0
        
        # Absolute spread penalty - spreads over $0.10 become increasingly difficult in practice
        abs_spread_penalty = 1.0 if spread_dollars < 0.10 else 1.0 / (1.0 + (spread_dollars - 0.10) * 5)
        
        # Calculate final score with revised weights
        # 70% spread factors, 15% volume, 15% open interest
        liquidity_score = (
            (spread_factor * abs_spread_penalty * 0.7) +
            (volume_factor * 0.15) +
            (oi_factor * 0.15)
        ) * low_price_penalty * zero_bid_penalty
        
        # Scale to 0-10
        final_score = 10.0 * liquidity_score
        
        return {
            'score': min(10.0, max(0.0, final_score)),
            'spread_pct': float(spread_pct),
            'volume': int(volume),
            'open_interest': int(open_interest),
            'has_zero_bid': has_zero_bid,
            'spread_dollars': float(spread_dollars)
        }
    except Exception as e:
        # Fallback to worst liquidity score on error
        return {
            'score': 0.0,
            'spread_pct': 1.0,
            'volume': 0,
            'open_interest': 0,
            'has_zero_bid': True,
            'spread_dollars': 0.0
        }


def calculate_calendar_spread_liquidity(front_month_liquidity, back_month_liquidity, spread_cost):
    """
    Calculate a combined liquidity score for a calendar spread.
    
    Args:
        front_month_liquidity (dict): Liquidity details for front month option
        back_month_liquidity (dict): Liquidity details for back month option
        spread_cost (float): Cost of the calendar spread
        
    Returns:
        dict: Combined liquidity details for the calendar spread
    """
    # Front month is more important as it's harder to roll/exit
    front_weight = 0.6
    back_weight = 0.4
    
    # Calculate combined score with weighting
    combined_score = (
        front_month_liquidity['score'] * front_weight +
        back_month_liquidity['score'] * back_weight
    )
    
    # Calculate combined spread percentage relative to spread cost
    # This shows how much of your edge might be lost to bid-ask spread
    total_spread_dollars = (
        front_month_liquidity['spread_dollars'] +
        back_month_liquidity['spread_dollars']
    )
    
    # Calculate how much of the spread cost is consumed by the bid-ask spread
    # This is a key metric for calendar spreads - if too high, the trade isn't viable
    spread_impact = total_spread_dollars / spread_cost if spread_cost > 0 else 1.0
    
    # Apply severe penalty if spreads eat more than 30% of the spread cost
    viability_factor = 1.0 if spread_impact < 0.3 else 1.0 / (1.0 + (spread_impact - 0.3) * 5)
    
    # Penalize severely if either leg has zero bids
    zero_bid_penalty = 0.3 if (
        front_month_liquidity['has_zero_bid'] or
        back_month_liquidity['has_zero_bid']
    ) else 1.0
    
    # Apply penalties to the combined score
    adjusted_score = combined_score * viability_factor * zero_bid_penalty
    
    return {
        'score': min(10.0, max(0.0, adjusted_score)),
        'front_liquidity': front_month_liquidity,
        'back_liquidity': back_month_liquidity,
        'spread_impact': float(spread_impact),
        'has_zero_bids': front_month_liquidity['has_zero_bid'] or back_month_liquidity['has_zero_bid']
    }


def get_liquidity_score(stock, expiration, strike, option_type='call'):
    """
    Calculate a comprehensive liquidity score for an option.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        strike (float): Strike price
        option_type (str): 'call' or 'put'
        
    Returns:
        dict: Liquidity details including:
            - score: Overall liquidity score (0-10, higher is better)
            - spread_pct: Bid-ask spread as percentage of option price
            - volume: Trading volume
            - open_interest: Open interest
            - has_zero_bid: Whether the option has a zero bid
            - spread_dollars: Absolute spread in dollars
    """
    try:
        chain = stock.option_chain(expiration)
        options_chain = chain.calls if option_type.lower() == 'call' else chain.puts
        
        if options_chain.empty:
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': True,
                'spread_dollars': 0.0
            }
        
        # Find the option with the given strike
        options = options_chain[options_chain['strike'] == strike]
        
        if options.empty:
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': True,
                'spread_dollars': 0.0
            }
        
        option = options.iloc[0]
        
        # Convert pandas Series to dict for the improved liquidity calculation
        option_dict = option.to_dict()
        
        # Use the improved liquidity score calculation
        return get_improved_liquidity_score(option_dict)
    except Exception as e:
        logger.error(f"Error calculating liquidity score: {str(e)}")
        return {
            'score': 0.0,
            'spread_pct': 1.0,
            'volume': 0,
            'open_interest': 0,
            'has_zero_bid': True,
            'spread_dollars': 0.0
        }

def calculate_spread_score(iv_differential, spread_cost, front_liquidity, back_liquidity,
                          strike_distance_from_atm, days_between_expirations=30,
                          days_to_front_expiration=14):
    logger.debug(f"Calculating spread score with: iv_diff={iv_differential}, cost={spread_cost}, " +
                f"liquidity={front_liquidity}/{back_liquidity}, distance={strike_distance_from_atm}, " +
                f"days_between={days_between_expirations}, days_to_front={days_to_front_expiration}")
    """
    Calculate a composite score for a potential calendar spread.
    
    Args:
        iv_differential (float): Difference between front and back month IV
        spread_cost (float): Cost of the spread
        front_liquidity (float): Liquidity score for front month option
        back_liquidity (float): Liquidity score for back month option
        strike_distance_from_atm (float): Distance of strike from current price
        days_between_expirations (int): Days between front and back month expirations
        days_to_front_expiration (int): Days until front month expiration
        
    Returns:
        float: Composite score (higher is better)
    """
    # Avoid division by zero
    if spread_cost <= 0:
        logger.debug("Score calculation aborted: spread_cost <= 0")
        return 0.0
    
    # IV differential factors
    iv_diff_score = iv_differential * 100  # Scale up for scoring
    
    # IV differential to cost ratio (bang for buck)
    cost_efficiency = iv_differential / spread_cost
    
    # Liquidity factor (average of front and back month)
    liquidity_score = (front_liquidity + back_liquidity) / 2.0
    
    # Delta neutrality factor (closer to ATM is better)
    delta_neutrality = 1.0 / (1.0 + strike_distance_from_atm)
    
    # Days between expirations factor (optimal is 30-45 days)
    days_between_factor = 1.0 - abs(days_between_expirations - 37.5) / 37.5
    
    # Days to front expiration factor (optimal is 2-5 days after earnings)
    days_to_front_factor = 1.0 - abs(days_to_front_expiration - 3.5) / 14.0
    
    # Composite score with weights
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
    
    logger.debug(f"Score components: iv={iv_component:.2f}, cost={cost_component:.2f}, " +
                f"liquidity={liquidity_component:.2f}, delta={delta_component:.2f}, " +
                f"days_between={days_between_component:.2f}, days_to_front={days_to_front_component:.2f}")
    logger.debug(f"Final score: {score:.2f}")
    
    return max(0.0, score)


def find_optimal_calendar_spread(ticker, back_month_exp_options=[30, 45, 60]):
    """
    Find the optimal calendar spread for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        back_month_exp_options (list): List of days out to consider for back month expiration
        
    Returns:
        dict or None: Details of the optimal calendar spread, or None if no worthwhile spread is found
    """
    logger.info(f"Finding optimal calendar spread for {ticker}")
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) == 0:
            logger.warning(f"No options data found for {ticker}")
            return None
        
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            logger.warning(f"Could not get current price for {ticker}")
            return None
        
        logger.info(f"{ticker} current price: ${current_price}")
        
        # Get expiration dates
        exp_dates = stock.options
        if not exp_dates:
            logger.warning(f"No expiration dates found for {ticker}")
            return None
        
        logger.info(f"{ticker} available expiration dates: {exp_dates}")
        
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
        
        # Define a function to evaluate a single spread combination
        def evaluate_spread(params):
            days_out, strike, option_type = params
            
            target_date = today + timedelta(days=days_out)
            
            # Find closest expiration to target date
            back_month = find_closest_expiration(exp_dates, target_date)
            back_month_date = datetime.strptime(back_month, "%Y-%m-%d").date()
            
            # Calculate days between expirations
            days_between_expirations = (back_month_date - front_month_date).days
            
            # Calculate key metrics for this potential spread
            front_iv = get_atm_iv(stock, front_month, strike)
            back_iv = get_atm_iv(stock, back_month, strike)
            
            # Skip if we couldn't get IV data
            if front_iv == 0 or back_iv == 0:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Skipping due to missing IV data - front_iv: {front_iv}, back_iv: {back_iv}")
                return None
            
            # IV differential (front month should be higher)
            iv_differential = front_iv - back_iv
            
            # Allow small negative IV differentials (front month can be slightly lower)
            # Skip only if the differential is significantly negative
            if iv_differential < -0.1:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Skipping due to low IV differential: {iv_differential}")
                return None
            
            # Get pricing information
            spread_cost = calculate_spread_cost(stock, front_month, back_month, strike, option_type)
            
            # Skip if spread cost is invalid
            if spread_cost <= 0:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Skipping due to invalid spread cost: {spread_cost}")
                return None
            
            # Calculate liquidity metrics
            front_liquidity = get_liquidity_score(stock, front_month, strike, option_type)
            back_liquidity = get_liquidity_score(stock, back_month, strike, option_type)
            
            # Calculate combined liquidity score for the calendar spread
            combined_liquidity = calculate_calendar_spread_liquidity(
                front_liquidity,
                back_liquidity,
                spread_cost
            )
            
            # Calculate a composite score
            score = calculate_spread_score(
                iv_differential,
                spread_cost,
                combined_liquidity['score'],  # Use the combined liquidity score
                combined_liquidity['score'],  # Use the same score for both params
                strike_distance_from_atm=abs(strike - current_price),
                days_between_expirations=days_between_expirations,
                days_to_front_expiration=days_to_front_expiration
            )
            
            logger.debug(f"{ticker} {option_type} strike ${strike}, back month {back_month}: Calculated score: {score}")
            
            return {
                'score': float(score),
                'spread': {
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
                    'optionType': option_type
                }
            }
        
        # Get strikes near current price (using wider range)
        strikes = get_strikes_near_price(stock, front_month, current_price, range_percent=15)
        logger.info(f"{ticker} considering {len(strikes)} strikes near price: {strikes}")
        
        # Create a list of all combinations to evaluate - include both calls and puts
        combinations = [
            (days_out, strike, option_type)
            for days_out in back_month_exp_options
            for strike in strikes
            for option_type in ['call', 'put']
        ]
        
        # Use ThreadPoolExecutor to parallelize the evaluation
        best_spread = None
        best_score = 0
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(20, len(combinations))) as executor:
            # Submit all tasks and collect futures
            future_to_combo = {executor.submit(evaluate_spread, combo): combo for combo in combinations}
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_combo):
                try:
                    result = future.result()
                    if result and result['score'] > best_score:
                        best_score = result['score']
                        best_spread = result['spread']
                        days_out, strike, option_type = future_to_combo[future]
                        logger.info(f"{ticker} {option_type} strike ${strike}, days out {days_out}: New best score: {best_score}")
                except Exception as e:
                    days_out, strike, option_type = future_to_combo[future]
                    logger.warning(f"Error evaluating spread for {ticker} {option_type} strike ${strike}, days out {days_out}: {str(e)}")
        
        # Set a minimum threshold score (lowered from 5.0)
        MINIMUM_VIABLE_SCORE = 3.0
        logger.info(f"{ticker} best score found: {best_score}, minimum threshold: {MINIMUM_VIABLE_SCORE}")
        
        if best_score < MINIMUM_VIABLE_SCORE:
            logger.warning(f"{ticker}: No worthwhile spread found - best score {best_score} below threshold {MINIMUM_VIABLE_SCORE}")
            return None  # No worthwhile play
        
        logger.info(f"{ticker}: Found optimal spread with score {best_score}: {best_spread}")
        return best_spread
    
    except Exception as e:
        logger.error(f"Error finding optimal calendar spread for {ticker}: {str(e)}")
        return None


def find_optimal_naked_options(ticker):
    """
    Find the optimal naked options for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict or None: Details of the optimal naked options, or None if no worthwhile options are found
    """
    logger.info(f"NAKED OPTIONS DEBUG: Starting search for {ticker}")
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) == 0:
            logger.warning(f"NAKED OPTIONS DEBUG: No options data found for {ticker}")
            return None
        
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            logger.warning(f"Could not get current price for {ticker}")
            return None
        
        logger.info(f"{ticker} current price: ${current_price}")
        
        # Get expiration dates
        exp_dates = stock.options
        if not exp_dates:
            logger.warning(f"No expiration dates found for {ticker}")
            return None
        
        logger.info(f"{ticker} available expiration dates: {exp_dates}")
        
        # Convert to datetime objects for sorting
        date_objs = [datetime.strptime(date, "%Y-%m-%d").date() for date in exp_dates]
        sorted_dates = sorted(date_objs)
        
        # Filter for dates in the future
        today = datetime.today().date()
        future_dates = [d for d in sorted_dates if d > today]
        
        if not future_dates:
            logger.warning(f"No future expiration dates found for {ticker}")
            return None
        
        # Get the first expiration date after earnings
        target_exp = future_dates[0]
        target_exp_str = target_exp.strftime("%Y-%m-%d")
        days_to_expiration = (target_exp - today).days
        
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} target expiration: {target_exp_str}, days to expiration: {days_to_expiration}")
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} all available expirations: {[d.strftime('%Y-%m-%d') for d in future_dates]}")
        
        # Get options chain for the target expiration
        try:
            chain = stock.option_chain(target_exp_str)
            calls = chain.calls
            puts = chain.puts
            
            logger.info(f"NAKED OPTIONS DEBUG: {ticker} options chain retrieved for {target_exp_str}")
            logger.info(f"NAKED OPTIONS DEBUG: {ticker} calls count: {len(calls)}, puts count: {len(puts)}")
            
            if not calls.empty:
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} call strikes: {sorted(calls['strike'].unique().tolist())}")
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} call bid/ask sample: {calls[['strike', 'bid', 'ask', 'impliedVolatility']].head(3).to_dict('records')}")
            
            if not puts.empty:
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} put strikes: {sorted(puts['strike'].unique().tolist())}")
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} put bid/ask sample: {puts[['strike', 'bid', 'ask', 'impliedVolatility']].head(3).to_dict('records')}")
            
            if calls.empty or puts.empty:
                logger.warning(f"NAKED OPTIONS DEBUG: No options data found for {ticker} on {target_exp_str}")
                return None
        except Exception as e:
            logger.error(f"NAKED OPTIONS DEBUG: Error getting options chain for {ticker} on {target_exp_str}: {str(e)}")
            return None
        
        # Calculate expected move based on straddle price
        atm_call_idx = (calls['strike'] - current_price).abs().idxmin()
        atm_put_idx = (puts['strike'] - current_price).abs().idxmin()
        
        atm_call = calls.loc[atm_call_idx]
        atm_put = puts.loc[atm_put_idx]
        
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} current price: ${current_price}")
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} ATM call strike: ${atm_call['strike']}, bid: {atm_call['bid']}, ask: {atm_call['ask']}")
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} ATM put strike: ${atm_put['strike']}, bid: {atm_put['bid']}, ask: {atm_put['ask']}")
        
        call_mid = (atm_call['bid'] + atm_call['ask']) / 2 if atm_call['bid'] > 0 and atm_call['ask'] > 0 else 0
        put_mid = (atm_put['bid'] + atm_put['ask']) / 2 if atm_put['bid'] > 0 and atm_put['ask'] > 0 else 0
        
        straddle_price = call_mid + put_mid
        expected_move_pct = straddle_price / current_price
        expected_move_dollars = current_price * expected_move_pct
        
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} call mid: ${call_mid}, put mid: ${put_mid}")
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} straddle price: ${straddle_price}")
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} expected move: ${expected_move_dollars:.2f} ({expected_move_pct:.2%})")
        
        # Get price history for historical earnings moves
        price_history = stock.history(period='1y')
        
        # Calculate historical volatility
        historical_vol = yang_zhang(price_history)
        
        # Define a function to evaluate a single option
        def evaluate_option(option, is_call):
            try:
                strike = option['strike']
                bid = option['bid']
                ask = option['ask']
                iv = option['impliedVolatility']
                delta = abs(option['delta']) if 'delta' in option else None
                
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} Evaluating {is_call and 'call' or 'put'} at strike ${strike}")
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} {is_call and 'call' or 'put'} at strike ${strike}: bid=${bid}, ask=${ask}, IV={iv:.2f}, delta={delta}")
                
                # Skip if no valid pricing
                if bid <= 0 or ask <= 0:
                    logger.info(f"NAKED OPTIONS DEBUG: {ticker} {is_call and 'call' or 'put'} at strike ${strike}: REJECTED - Invalid pricing - bid: ${bid}, ask: ${ask}")
                    return None
                
                # Calculate mid price
                mid_price = (bid + ask) / 2
                
                # Calculate distance from current price
                distance_pct = abs(strike - current_price) / current_price
                
                # Calculate return on capital (ROC)
                if is_call:
                    max_loss = float('inf')  # Unlimited for calls
                    margin_req = current_price * 0.2  # Simplified margin calculation
                else:
                    max_loss = strike  # For puts, max loss is the strike price
                    margin_req = min(strike * 0.2, strike - (current_price * 0.1))  # Simplified margin calculation
                
                roc = mid_price / margin_req
                
                # Calculate probability metrics
                if delta is not None:
                    prob_otm = 1 - delta if is_call else delta
                else:
                    # Estimate delta if not available
                    moneyness = (current_price / strike) if is_call else (strike / current_price)
                    prob_otm = 0.5 + (0.5 * (1 - moneyness) / expected_move_pct) if expected_move_pct > 0 else 0.5
                
                # Calculate IV crush potential
                # Typically IV drops by 30-50% after earnings
                iv_crush_potential = iv * 0.4  # Assuming 40% IV reduction
                
                # Calculate liquidity score
                spread_pct = (ask - bid) / mid_price
                volume = option['volume'] if 'volume' in option and option['volume'] > 0 else 1
                open_interest = option['openInterest'] if 'openInterest' in option and option['openInterest'] > 0 else 1
                liquidity_score = min(10.0, (1 / spread_pct) * np.sqrt(volume) * np.sqrt(open_interest) / 100.0)
                
                # Calculate composite score
                # Weights for different factors
                iv_weight = 0.3
                delta_weight = 0.25
                premium_weight = 0.25
                liquidity_weight = 0.1
                historical_weight = 0.1
                
                # Individual component scores
                iv_score = (iv / historical_vol) * iv_weight if historical_vol > 0 else 0
                delta_score = prob_otm * delta_weight
                premium_score = (roc * 10) * premium_weight  # Scale ROC to 0-10 range
                liquidity_score = liquidity_score * liquidity_weight
                
                # Historical behavior score - simplified for now
                historical_score = historical_weight * 0.5  # Placeholder
                
                # Composite score
                score = iv_score + delta_score + premium_score + liquidity_score + historical_score
                
                # Calculate break-even price
                break_even = float(strike - mid_price) if not is_call else float(strike + mid_price)
                break_even_pct = float((break_even - current_price) / current_price * 100)
                
                # Check if break-even is outside expected move range
                expected_move_dollars = current_price * (expected_move_pct / 100)
                expected_move_lower = current_price - expected_move_dollars
                expected_move_upper = current_price + expected_move_dollars
                outside_expected_move = (not is_call and break_even < expected_move_lower) or \
                                       (is_call and break_even > expected_move_upper)
                
                # Add bonus to score if break-even is outside expected move
                bonus_score = 0
                if outside_expected_move:
                    bonus_score = score * 0.2  # 20% bonus
                    score += bonus_score
                
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} {is_call and 'call' or 'put'} at strike ${strike}: Break-even ${break_even:.2f} ({break_even_pct:.2f}%), Outside expected move: {outside_expected_move}")
                
                # Return option details with score
                return {
                    'type': 'call' if is_call else 'put',
                    'strike': float(strike),
                    'expiration': target_exp_str,
                    'premium': float(mid_price),
                    'iv': float(iv),
                    'delta': float(delta) if delta is not None else None,
                    'probOtm': float(prob_otm),
                    'roc': float(roc),
                    'marginRequirement': float(margin_req),
                    'maxLoss': float(max_loss) if max_loss != float('inf') else None,
                    'liquidity': float(liquidity_score / liquidity_weight),  # Normalize back to 0-10
                    'breakEven': break_even,
                    'breakEvenPct': break_even_pct,
                    'outsideExpectedMove': "true" if outside_expected_move else "false",  # Convert boolean to string for JSON serialization
                    'score': float(score)
                }
            except Exception as e:
                logger.warning(f"Error evaluating option: {str(e)}")
                return None
        
        # Filter for OTM options with appropriate delta range
        otm_calls = calls[calls['strike'] > current_price]
        otm_puts = puts[puts['strike'] < current_price]
        
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} OTM calls count: {len(otm_calls)}")
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} OTM puts count: {len(otm_puts)}")
        
        if not otm_calls.empty:
            logger.info(f"NAKED OPTIONS DEBUG: {ticker} OTM call strikes: {sorted(otm_calls['strike'].unique().tolist())}")
        
        if not otm_puts.empty:
            logger.info(f"NAKED OPTIONS DEBUG: {ticker} OTM put strikes: {sorted(otm_puts['strike'].unique().tolist())}")
        
        # Evaluate all options
        call_results = []
        put_results = []
        
        # Use a more lenient delta range (0.10-0.50 instead of 0.15-0.40)
        min_delta = 0.10
        max_delta = 0.50
        
        logger.info(f"NAKED OPTIONS DEBUG: {ticker} Using delta range: {min_delta}-{max_delta}")
        
        for _, call in otm_calls.iterrows():
            result = evaluate_option(call, True)
            if result:
                if result['delta'] is None or (min_delta <= result['delta'] <= max_delta):
                    logger.info(f"NAKED OPTIONS DEBUG: {ticker} ACCEPTED call at strike ${result['strike']}: Delta {result['delta']} within range {min_delta}-{max_delta}")
                    call_results.append(result)
                else:
                    logger.info(f"NAKED OPTIONS DEBUG: {ticker} REJECTED call at strike ${result['strike']}: Delta {result['delta']} outside range {min_delta}-{max_delta}")
        
        for _, put in otm_puts.iterrows():
            result = evaluate_option(put, False)
            if result:
                if result['delta'] is None or (min_delta <= result['delta'] <= max_delta):
                    logger.info(f"NAKED OPTIONS DEBUG: {ticker} ACCEPTED put at strike ${result['strike']}: Delta {result['delta']} within range {min_delta}-{max_delta}")
                    put_results.append(result)
                else:
                    logger.info(f"NAKED OPTIONS DEBUG: {ticker} REJECTED put at strike ${result['strike']}: Delta {result['delta']} outside range {min_delta}-{max_delta}")
        
        # Sort by score
        call_results.sort(key=lambda x: x['score'], reverse=True)
        put_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Get top options
        top_calls = call_results[:3] if call_results else []
        top_puts = put_results[:3] if put_results else []
        
        # Combine and sort
        top_options = sorted(top_calls + top_puts, key=lambda x: x['score'], reverse=True)
        
        if not top_options:
            logger.warning(f"NAKED OPTIONS DEBUG: {ticker} No suitable naked options found")
            # Log more details about why no options were found
            logger.warning(f"NAKED OPTIONS DEBUG: {ticker} Call results: {len(call_results)}, Put results: {len(put_results)}")
            
            # Do NOT create fake data - return None if no valid options are found
            return None
        
        # Return top options
        result = {
            'expectedMove': {
                'percent': float(expected_move_pct),
                'dollars': float(expected_move_dollars)
            },
            'daysToExpiration': days_to_expiration,
            'topOptions': top_options[:5]  # Return top 5 options
        }
        
        logger.warning(f"NAKED OPTIONS DEBUG: {ticker} Returning naked options result with {len(top_options)} options")
        logger.warning(f"NAKED OPTIONS DEBUG: {ticker} Top options: {[f'{opt['type'].upper()} ${opt['strike']} (score: {opt['score']})' for opt in top_options[:3]]}")
        return result
    
    except Exception as e:
        logger.error(f"NAKED OPTIONS DEBUG: {ticker} Error finding optimal naked options: {str(e)}")
        logger.error(f"NAKED OPTIONS DEBUG: {ticker} Exception details: {type(e).__name__}")
        import traceback
        logger.error(f"NAKED OPTIONS DEBUG: {ticker} Traceback: {traceback.format_exc()}")
        return None

def black_scholes_d1(S, K, T, r, sigma):
    """
    Calculate d1 from the Black-Scholes formula.
    
    Args:
        S (float): Current stock price
        K (float): Strike price
        T (float): Time to expiration in years
        r (float): Risk-free interest rate
        sigma (float): Volatility
        
    Returns:
        float: d1 value
    """
    if sigma <= 0 or T <= 0:
        return 0
    return (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))

def black_scholes_d2(d1, sigma, T):
    """
    Calculate d2 from the Black-Scholes formula.
    
    Args:
        d1 (float): d1 value
        sigma (float): Volatility
        T (float): Time to expiration in years
        
    Returns:
        float: d2 value
    """
    if sigma <= 0 or T <= 0:
        return 0
    return d1 - sigma * np.sqrt(T)

def black_scholes_call_price(S, K, T, r, sigma):
    """
    Calculate call option price using the Black-Scholes formula.
    
    Args:
        S (float): Current stock price
        K (float): Strike price
        T (float): Time to expiration in years
        r (float): Risk-free interest rate
        sigma (float): Volatility
        
    Returns:
        float: Call option price
    """
    if sigma <= 0 or T <= 0:
        return max(0, S - K)
    
    d1 = black_scholes_d1(S, K, T, r, sigma)
    d2 = black_scholes_d2(d1, sigma, T)
    
    return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

def black_scholes_put_price(S, K, T, r, sigma):
    """
    Calculate put option price using the Black-Scholes formula.
    
    Args:
        S (float): Current stock price
        K (float): Strike price
        T (float): Time to expiration in years
        r (float): Risk-free interest rate
        sigma (float): Volatility
        
    Returns:
        float: Put option price
    """
    if sigma <= 0 or T <= 0:
        return max(0, K - S)
    
    d1 = black_scholes_d1(S, K, T, r, sigma)
    d2 = black_scholes_d2(d1, sigma, T)
    
    return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

def calculate_option_greeks(S, K, T, r, sigma, option_type='call'):
    """
    Calculate option greeks using the Black-Scholes model.
    
    Args:
        S (float): Current stock price
        K (float): Strike price
        T (float): Time to expiration in years
        r (float): Risk-free interest rate
        sigma (float): Volatility
        option_type (str): 'call' or 'put'
        
    Returns:
        dict: Dictionary containing option greeks (delta, gamma, theta, vega, rho)
    """
    if sigma <= 0 or T <= 0:
        return {
            'delta': 1.0 if option_type.lower() == 'call' and S > K else -1.0 if option_type.lower() == 'put' and S < K else 0.0,
            'gamma': 0.0,
            'theta': 0.0,
            'vega': 0.0,
            'rho': 0.0
        }
    
    d1 = black_scholes_d1(S, K, T, r, sigma)
    d2 = black_scholes_d2(d1, sigma, T)
    
    # Common calculations
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T) / 100  # Divided by 100 to get the change per 1% change in volatility
    
    if option_type.lower() == 'call':
        delta = norm.cdf(d1)
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * norm.cdf(d2)) / 365.0  # Daily theta
        rho = K * T * np.exp(-r * T) * norm.cdf(d2) / 100  # Divided by 100 to get the change per 1% change in interest rate
    else:  # put
        delta = -norm.cdf(-d1)
        theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T)) + r * K * np.exp(-r * T) * norm.cdf(-d2)) / 365.0  # Daily theta
        rho = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100  # Divided by 100 to get the change per 1% change in interest rate
    
    return {
        'delta': delta,
        'gamma': gamma,
        'theta': theta,
        'vega': vega,
        'rho': rho
    }

def find_optimal_iron_condor(ticker):
    """
    Find the optimal iron condor for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict or None: Details of the optimal iron condor, or None if no worthwhile iron condor is found
    """
    logger.info(f"IRON CONDOR DEBUG: Starting search for {ticker}")
    logger.warning(f"IRON CONDOR DEBUG: Starting search for {ticker}")
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) == 0:
            logger.warning(f"IRON CONDOR DEBUG: No options data found for {ticker}")
            logger.info(f"IRON CONDOR DEBUG: No options data found for {ticker}")
            return None
        
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            logger.warning(f"IRON CONDOR DEBUG: Could not get current price for {ticker}")
            logger.info(f"IRON CONDOR DEBUG: Could not get current price for {ticker}")
            return None
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} current price: ${current_price}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} current price: ${current_price}")
        
        # Get expiration dates
        exp_dates = stock.options
        if not exp_dates:
            logger.warning(f"IRON CONDOR DEBUG: No expiration dates found for {ticker}")
            logger.info(f"IRON CONDOR DEBUG: No expiration dates found for {ticker}")
            return None
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} available expiration dates: {exp_dates}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} available expiration dates: {exp_dates}")
        
        # Convert to datetime objects for sorting
        date_objs = [datetime.strptime(date, "%Y-%m-%d").date() for date in exp_dates]
        sorted_dates = sorted(date_objs)
        
        # Filter for dates in the future
        today = datetime.today().date()
        future_dates = [d for d in sorted_dates if d > today]
        
        if not future_dates:
            logger.warning(f"IRON CONDOR DEBUG: No future expiration dates found for {ticker}")
            logger.info(f"IRON CONDOR DEBUG: No future expiration dates found for {ticker}")
            return None
        
        logger.warning(f"IRON CONDOR DEBUG: {ticker} future expiration dates: {[d.strftime('%Y-%m-%d') for d in future_dates]}")
        
        # Get the first expiration date after earnings
        target_exp = future_dates[0]
        target_exp_str = target_exp.strftime("%Y-%m-%d")
        days_to_expiration = (target_exp - today).days
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} target expiration: {target_exp_str}, days to expiration: {days_to_expiration}")
        
        # Get options chain for the target expiration
        try:
            chain = stock.option_chain(target_exp_str)
            calls = chain.calls
            puts = chain.puts
            
            logger.info(f"IRON CONDOR DEBUG: {ticker} options chain retrieved for {target_exp_str}")
            logger.warning(f"IRON CONDOR DEBUG: {ticker} options chain retrieved for {target_exp_str}")
            logger.info(f"IRON CONDOR DEBUG: {ticker} calls count: {len(calls)}, puts count: {len(puts)}")
            logger.warning(f"IRON CONDOR DEBUG: {ticker} calls count: {len(calls)}, puts count: {len(puts)}")
            
            if not calls.empty:
                logger.warning(f"IRON CONDOR DEBUG: {ticker} call strikes: {sorted(calls['strike'].unique().tolist())}")
                logger.warning(f"IRON CONDOR DEBUG: {ticker} call bid/ask sample: {calls[['strike', 'bid', 'ask', 'impliedVolatility']].head(3).to_dict('records')}")
            
            if not puts.empty:
                logger.warning(f"IRON CONDOR DEBUG: {ticker} put strikes: {sorted(puts['strike'].unique().tolist())}")
                logger.warning(f"IRON CONDOR DEBUG: {ticker} put bid/ask sample: {puts[['strike', 'bid', 'ask', 'impliedVolatility']].head(3).to_dict('records')}")
            
            if calls.empty or puts.empty:
                logger.warning(f"IRON CONDOR DEBUG: No options data found for {ticker} on {target_exp_str}")
                logger.info(f"IRON CONDOR DEBUG: No options data found for {ticker} on {target_exp_str}")
                return None
        except Exception as e:
            logger.error(f"IRON CONDOR DEBUG: Error getting options chain for {ticker} on {target_exp_str}: {str(e)}")
            logger.warning(f"IRON CONDOR DEBUG: Error getting options chain for {ticker} on {target_exp_str}: {str(e)}")
            return None
        
        # Calculate expected move based on straddle price
        atm_call_idx = (calls['strike'] - current_price).abs().idxmin()
        atm_put_idx = (puts['strike'] - current_price).abs().idxmin()
        
        atm_call = calls.loc[atm_call_idx]
        atm_put = puts.loc[atm_put_idx]
        
        call_mid = (atm_call['bid'] + atm_call['ask']) / 2 if atm_call['bid'] > 0 and atm_call['ask'] > 0 else 0
        put_mid = (atm_put['bid'] + atm_put['ask']) / 2 if atm_put['bid'] > 0 and atm_put['ask'] > 0 else 0
        
        straddle_price = call_mid + put_mid
        expected_move_pct = straddle_price / current_price
        expected_move_dollars = current_price * expected_move_pct
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} expected move: ${expected_move_dollars:.2f} ({expected_move_pct:.2%})")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} expected move: ${expected_move_dollars:.2f} ({expected_move_pct:.2%})")
        
        logger.warning(f"IRON CONDOR DEBUG: {ticker} ATM call strike: ${atm_call['strike']}, bid: {atm_call['bid']}, ask: {atm_call['ask']}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} ATM put strike: ${atm_put['strike']}, bid: {atm_put['bid']}, ask: {atm_put['ask']}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} call mid: ${call_mid}, put mid: ${put_mid}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} straddle price: ${straddle_price}")
        
        # Filter for OTM options
        otm_calls = calls[calls['strike'] > current_price]
        otm_puts = puts[puts['strike'] < current_price]
        
        if otm_calls.empty or otm_puts.empty:
            logger.warning(f"IRON CONDOR DEBUG: Not enough OTM options for {ticker}")
            logger.info(f"IRON CONDOR DEBUG: Not enough OTM options for {ticker}")
            return None
            
        logger.warning(f"IRON CONDOR DEBUG: {ticker} OTM calls count: {len(otm_calls)}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} OTM puts count: {len(otm_puts)}")
        
        if not otm_calls.empty:
            logger.warning(f"IRON CONDOR DEBUG: {ticker} OTM call strikes: {sorted(otm_calls['strike'].unique().tolist())}")
        
        if not otm_puts.empty:
            logger.warning(f"IRON CONDOR DEBUG: {ticker} OTM put strikes: {sorted(otm_puts['strike'].unique().tolist())}")
        
        # Define target delta range for short options (making it more lenient)
        min_short_delta = 0.10
        max_short_delta = 0.45
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} Using delta range: {min_short_delta}-{max_short_delta}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Using delta range: {min_short_delta}-{max_short_delta}")
        
        # Define function to evaluate a single iron condor
        def evaluate_iron_condor(call_short_idx, call_long_idx, put_short_idx, put_long_idx):
            try:
                # Get option details - CORRECTED INDEXING
                # For OTM puts, index 0 = closest to money (highest strike)
                # For OTM calls, index 0 = closest to money (lowest strike)
                call_short = otm_calls.iloc[call_short_idx]
                call_long = otm_calls.iloc[call_long_idx]
                
                put_short = otm_puts.iloc[put_long_idx]  # Lower strike (further OTM) - THIS IS THE SHORT PUT
                put_long = otm_puts.iloc[put_short_idx]  # Higher strike (closer to money) - THIS IS THE LONG PUT
                
                # Calculate liquidity scores for each leg
                call_short_liquidity = get_liquidity_score(stock, target_exp_str, call_short['strike'], 'call')
                call_long_liquidity = get_liquidity_score(stock, target_exp_str, call_long['strike'], 'call')
                put_short_liquidity = get_liquidity_score(stock, target_exp_str, put_short['strike'], 'put')
                put_long_liquidity = get_liquidity_score(stock, target_exp_str, put_long['strike'], 'put')
                
                # Calculate overall liquidity score (weighted average with more weight on short options)
                overall_liquidity_score = (
                    call_short_liquidity['score'] * 0.35 +
                    put_short_liquidity['score'] * 0.35 +
                    call_long_liquidity['score'] * 0.15 +
                    put_long_liquidity['score'] * 0.15
                )
                
                # Flag for zero bids
                has_zero_bids = (
                    call_short_liquidity['has_zero_bid'] or
                    call_long_liquidity['has_zero_bid'] or
                    put_short_liquidity['has_zero_bid'] or
                    put_long_liquidity['has_zero_bid']
                )
                
                # Calculate time to expiration in years
                today = datetime.today().date()
                expiry = datetime.strptime(target_exp_str, "%Y-%m-%d").date()
                days_to_expiry = (expiry - today).days
                time_to_expiry = days_to_expiry / 365.0
                
                # Use a standard risk-free rate (can be updated to use current treasury rates)
                risk_free_rate = 0.05
                
                try:
                    logger.warning(f"IRON CONDOR DEBUG: {ticker} Calculating greeks using Black-Scholes model")
                    
                    # Get implied volatilities from options data
                    call_short_iv = call_short['impliedVolatility']
                    call_long_iv = call_long['impliedVolatility']
                    put_short_iv = put_short['impliedVolatility']
                    put_long_iv = put_long['impliedVolatility']
                    
                    # Calculate greeks for each option
                    call_short_greeks = calculate_option_greeks(
                        S=current_price,
                        K=call_short['strike'],
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=call_short_iv,
                        option_type='call'
                    )
                    
                    call_long_greeks = calculate_option_greeks(
                        S=current_price,
                        K=call_long['strike'],
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=call_long_iv,
                        option_type='call'
                    )
                    
                    put_short_greeks = calculate_option_greeks(
                        S=current_price,
                        K=put_short['strike'],
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=put_short_iv,
                        option_type='put'
                    )
                    
                    put_long_greeks = calculate_option_greeks(
                        S=current_price,
                        K=put_long['strike'],
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=put_long_iv,
                        option_type='put'
                    )
                    
                    # Get deltas (convert to absolute values)
                    call_short_delta = abs(call_short_greeks['delta'])
                    call_long_delta = abs(call_long_greeks['delta'])
                    put_short_delta = abs(put_short_greeks['delta'])
                    put_long_delta = abs(put_long_greeks['delta'])
                    
                    logger.warning(f"IRON CONDOR DEBUG: {ticker} Successfully calculated deltas using Black-Scholes - Call short: {call_short_delta:.4f}, Call long: {call_long_delta:.4f}, Put short: {put_short_delta:.4f}, Put long: {put_long_delta:.4f}")
                    
                except Exception as e:
                    logger.warning(f"IRON CONDOR DEBUG: {ticker} Error calculating greeks using Black-Scholes: {str(e)}")
                    
                    # Fall back to API delta values if available
                    if 'delta' in call_short and 'delta' in call_long and 'delta' in put_short and 'delta' in put_long:
                        call_short_delta = abs(call_short['delta'])
                        call_long_delta = abs(call_long['delta'])
                        put_short_delta = abs(put_short['delta'])
                        put_long_delta = abs(put_long['delta'])
                        
                        logger.warning(f"IRON CONDOR DEBUG: {ticker} Using API delta values - Call short: {call_short_delta:.4f}, Call long: {call_long_delta:.4f}, Put short: {put_short_delta:.4f}, Put long: {put_long_delta:.4f}")
                    else:
                        logger.warning(f"IRON CONDOR DEBUG: {ticker} Missing delta values for one or more options")
                        return None
                
                # Check if deltas are within target range for short options
                if not (min_short_delta <= call_short_delta <= max_short_delta and min_short_delta <= put_short_delta <= max_short_delta):
                    return None
                
                # Check if options have appropriate delta relationship
                # For calls: long (further OTM) should have lower delta than short (closer to money)
                # For puts: long (closer to money) should have higher delta than short (further OTM)
                # Note: Delta is always positive in our calculations (we use abs())
                if not (call_long_delta <= call_short_delta * 1.1 and put_long_delta <= put_short_delta * 0.9):
                    logger.debug(f"IRON CONDOR DEBUG: {ticker} Delta relationship check failed: call_long={call_long_delta}, call_short={call_short_delta}, put_long={put_long_delta}, put_short={put_short_delta}")
                    return None
                
                # Get strikes
                call_short_strike = call_short['strike']
                call_long_strike = call_long['strike']
                put_short_strike = put_short['strike']
                put_long_strike = put_long['strike']
                
                # Check if strikes are in correct order for a short iron condor
                # For put credit spreads: put_short is further OTM (LOWER price), put_long is closer to money (HIGHER price)
                # For call credit spreads: call_short is closer to money (LOWER price), call_long is further OTM (HIGHER price)
                # The correct ordering is: put_short < put_long < current_price < call_short < call_long
                if not (put_long_strike < put_short_strike < current_price < call_short_strike < call_long_strike):
                    logger.debug(f"IRON CONDOR DEBUG: {ticker} Strike order check failed: put_short={put_short_strike}, put_long={put_long_strike}, current_price={current_price}, call_short={call_short_strike}, call_long={call_long_strike}")
                    return None
                
                # Calculate premiums (mid prices or 80% of ask when bid is zero)
                call_short_premium = (call_short['bid'] + call_short['ask']) / 2 if call_short['bid'] > 0 and call_short['ask'] > 0 else call_short['ask'] * 0.8
                call_long_premium = (call_long['bid'] + call_long['ask']) / 2 if call_long['bid'] > 0 and call_long['ask'] > 0 else call_long['ask'] * 0.8
                put_short_premium = (put_short['bid'] + put_short['ask']) / 2 if put_short['bid'] > 0 and put_short['ask'] > 0 else put_short['ask'] * 0.8
                put_long_premium = (put_long['bid'] + put_long['ask']) / 2 if put_long['bid'] > 0 and put_long['ask'] > 0 else put_long['ask'] * 0.8
                
                # Check if we have valid premiums
                if call_short_premium <= 0 or call_long_premium <= 0 or put_short_premium <= 0 or put_long_premium <= 0:
                    logger.debug(f"IRON CONDOR DEBUG: {ticker} Rejected due to invalid premiums: call_short={call_short_premium}, call_long={call_long_premium}, put_short={put_short_premium}, put_long={put_long_premium}")
                    return None
                
                # Calculate net credit
                call_spread_credit = call_short_premium - call_long_premium
                put_spread_credit = put_short_premium - put_long_premium
                net_credit = call_spread_credit + put_spread_credit
                
                # Check if net credit is positive
                if net_credit <= 0:
                    return None
                
                # Calculate max loss
                call_spread_width = call_long_strike - call_short_strike
                put_spread_width = put_short_strike - put_long_strike
                max_width = max(call_spread_width, put_spread_width)
                max_loss = max_width - net_credit
                
                # Calculate break-even points
                break_even_low = put_short_strike - net_credit
                break_even_high = call_short_strike + net_credit
                
                # Calculate standard probability of profit (approximate)
                # Based on delta of short options
                prob_profit = 1 - (call_short_delta + put_short_delta)
                
                # Get IV30/RV30 ratio and term structure slope for volatility crush calculation
                iv30_rv30 = get_iv30_rv30_ratio(ticker)
                ts_slope = get_term_structure_slope(ticker)
                
                # Calculate enhanced probability of profit that accounts for volatility crush
                enhanced_prob_profit = calculate_simplified_enhanced_probability(
                    prob_profit,
                    iv30_rv30,
                    ts_slope
                )
                
                # Calculate return on risk
                return_on_risk = net_credit / max_loss
                
                # Calculate score components
                premium_score = net_credit / current_price * 100  # Premium as percentage of stock price
                width_score = 10 - (max_width / current_price * 100)  # Narrower spreads get higher scores
                delta_score = prob_profit * 10  # Higher probability of profit gets higher score
                
                # Check if short strikes are outside expected move
                expected_move_upper = current_price + expected_move_dollars
                expected_move_lower = current_price - expected_move_dollars
                
                outside_expected_move = (call_short_strike > expected_move_upper and put_short_strike < expected_move_lower)
                expected_move_score = 10 if outside_expected_move else 5
                
                # Calculate composite score
                score = (
                    premium_score * 0.3 +  # Weight premium capture (30%)
                    delta_score * 0.3 +    # Weight probability of profit (30%)
                    width_score * 0.2 +    # Weight width (20%)
                    expected_move_score * 0.1 +  # Weight expected move (10%)
                    (return_on_risk * 10) * 0.1  # Weight risk/reward ratio (10%)
                )
                
                logger.info(f"IRON CONDOR DEBUG: {ticker} Evaluated iron condor - Score: {score:.2f}, Net Credit: ${net_credit:.2f}, Prob Profit: {prob_profit:.2%}")
                logger.warning(f"IRON CONDOR DEBUG: {ticker} Evaluated iron condor - Call spread: ${call_short_strike}-${call_long_strike}, Put spread: ${put_long_strike}-${put_short_strike}")
                logger.warning(f"IRON CONDOR DEBUG: {ticker} Evaluated iron condor - Score: {score:.2f}, Net Credit: ${net_credit:.2f}, Prob Profit: {prob_profit:.2%}")
                
                # Convert NumPy types to Python native types for JSON serialization
                def convert_numpy_types(obj):
                    if isinstance(obj, dict):
                        return {k: convert_numpy_types(v) for k, v in obj.items()}
                    elif isinstance(obj, (list, tuple)):
                        return [convert_numpy_types(item) for item in obj]
                    elif isinstance(obj, np.bool_):
                        return bool(obj)
                    elif isinstance(obj, np.integer):
                        return int(obj)
                    elif isinstance(obj, np.floating):
                        return float(obj)
                    else:
                        return obj
                
                # Return iron condor details
                result = {
                    "callSpread": {
                        "shortStrike": float(call_short_strike),
                        "longStrike": float(call_long_strike),
                        "shortDelta": float(call_short_delta),
                        "shortPremium": float(call_short_premium),
                        "longPremium": float(call_long_premium),
                        "shortLiquidity": call_short_liquidity,
                        "longLiquidity": call_long_liquidity
                    },
                    "putSpread": {
                        "shortStrike": float(put_short_strike),
                        "longStrike": float(put_long_strike),
                        "shortDelta": float(put_short_delta),
                        "shortPremium": float(put_short_premium),
                        "longPremium": float(put_long_premium),
                        "shortLiquidity": put_short_liquidity,
                        "longLiquidity": put_long_liquidity
                    },
                    "netCredit": float(net_credit),
                    "maxLoss": float(max_loss),
                    "breakEvenLow": float(break_even_low),
                    "breakEvenHigh": float(break_even_high),
                    "probProfit": float(prob_profit),
                    "enhancedProbProfit": enhanced_prob_profit,
                    "returnOnRisk": float(return_on_risk),
                    "score": float(score),
                    "liquidityScore": float(overall_liquidity_score),
                    "hasZeroBids": bool(has_zero_bids)
                }
                
                return convert_numpy_types(result)
            except Exception as e:
                logger.warning(f"IRON CONDOR DEBUG: Error evaluating iron condor: {str(e)}")
                logger.info(f"IRON CONDOR DEBUG: Error evaluating iron condor: {str(e)}")
                return None
        
        # Find all possible iron condors
        iron_condors = []
        
        # Increase the number of options to evaluate to find more potential iron condors
        max_options = 15
        otm_calls_subset = otm_calls.head(min(len(otm_calls), max_options))
        otm_puts_subset = otm_puts.head(min(len(otm_puts), max_options))
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} Evaluating {len(otm_calls_subset)} call options and {len(otm_puts_subset)} put options")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Evaluating {len(otm_calls_subset)} call options and {len(otm_puts_subset)} put options")
        
        # Evaluate all possible combinations
        for call_short_idx in range(len(otm_calls_subset) - 1):
            for call_long_idx in range(call_short_idx + 1, len(otm_calls_subset)):
                # For puts, we need put_short to be closer to the money (lower index in sorted array)
                # and put_long to be further OTM (higher index in sorted array)
                for put_short_idx in range(len(otm_puts_subset) - 1):
                    for put_long_idx in range(put_short_idx + 1, len(otm_puts_subset)):
                        result = evaluate_iron_condor(call_short_idx, call_long_idx, put_short_idx, put_long_idx)
                        if result:
                            iron_condors.append(result)
        
        if not iron_condors:
            logger.warning(f"IRON CONDOR DEBUG: No suitable iron condors found for {ticker}")
            logger.info(f"IRON CONDOR DEBUG: No suitable iron condors found for {ticker}")
            return None
        
        # Sort iron condors by score
        iron_condors.sort(key=lambda x: x['score'], reverse=True)
        
        # Get top iron condors (increased from 5 to 25 for more flexibility)
        top_iron_condors = iron_condors[:25]
        
        # Find the best alternative play with good liquidity
        # This will be used when the top mathematical play has liquidity issues
        next_best_play = None
        
        # Define minimum liquidity threshold
        MIN_LIQUIDITY_SCORE = 4.5
        
        # If the top iron condor has liquidity issues, find an alternative
        if top_iron_condors and len(top_iron_condors) > 1:
            top_condor = top_iron_condors[0]
            
            # Check if top condor has liquidity issues
            if top_condor['liquidityScore'] < MIN_LIQUIDITY_SCORE or top_condor['hasZeroBids']:
                # Look for an alternative with better liquidity
                for condor in iron_condors[1:]:
                    # If top condor has zero bids, prioritize finding any alternative without zero bids
                    if top_condor['hasZeroBids']:
                        if (not condor['hasZeroBids'] and
                            condor['score'] > top_condor['score'] * 0.7):  # At least 70% as good as top play
                            next_best_play = condor
                            break
                    # Otherwise use the liquidity score threshold
                    elif (condor['liquidityScore'] >= MIN_LIQUIDITY_SCORE and
                          not condor['hasZeroBids'] and
                          condor['score'] > top_condor['score'] * 0.7):  # At least 70% as good as top play
                        next_best_play = condor
                        break
        
        # Return result
        # Convert NumPy types to Python native types for JSON serialization
        def convert_numpy_types(obj):
            if isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            elif isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            else:
                return obj
        
        result = {
            'expectedMove': {
                'percent': float(expected_move_pct),
                'dollars': float(expected_move_dollars)
            },
            'daysToExpiration': days_to_expiration,
            'topIronCondors': top_iron_condors,
            'nextBestPlay': next_best_play
        }
        
        # Convert any NumPy types to Python native types
        result = convert_numpy_types(result)
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} Found {len(top_iron_condors)} optimal iron condors")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Found {len(top_iron_condors)} optimal iron condors")
        
        # Log details of the top iron condor
        if len(top_iron_condors) > 0:
            top_condor = top_iron_condors[0]
            logger.warning(f"IRON CONDOR DEBUG: {ticker} Top iron condor details: " +
                          f"Call spread: {top_condor['callSpread']['shortStrike']}-{top_condor['callSpread']['longStrike']}, " +
                          f"Put spread: {top_condor['putSpread']['longStrike']}-{top_condor['putSpread']['shortStrike']}, " +
                          f"Net credit: ${top_condor['netCredit']:.2f}, Score: {top_condor['score']:.2f}")
        return result
    
    except Exception as e:
        logger.error(f"IRON CONDOR DEBUG: Error finding optimal iron condors for {ticker}: {str(e)}")
        logger.warning(f"IRON CONDOR DEBUG: Error finding optimal iron condors for {ticker}: {str(e)}")
        import traceback
        logger.error(f"IRON CONDOR DEBUG: {ticker} Traceback: {traceback.format_exc()}")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Traceback: {traceback.format_exc()}")
        return None

def get_iv30_rv30_ratio(ticker):
    """
    Calculate the IV30/RV30 ratio for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        float: IV30/RV30 ratio, or 1.5 as a default if calculation fails
    """
    try:
        # Get stock data
        stock = yf.Ticker(ticker)
        
        # Get historical price data for realized volatility calculation
        price_history = stock.history(period='3mo')
        
        # Calculate realized volatility using Yang-Zhang estimator
        rv30 = yang_zhang(price_history)
        
        # Get option chain for closest expiration
        expirations = stock.options
        if not expirations:
            return 1.5  # Default if no options data available
            
        # Get implied volatility term structure
        ivs = []
        dtes = []
        today = datetime.today().date()
        
        for exp_date in expirations[:min(4, len(expirations))]:
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_exp = (exp_date_obj - today).days
            
            if days_to_exp <= 0:
                continue
                
            try:
                # Get ATM IV
                options = stock.option_chain(exp_date)
                
                # Get current price
                current_price = stock.history(period='1d')['Close'].iloc[-1]
                
                # Find ATM options
                calls = options.calls
                puts = options.puts
                
                calls['strike_diff'] = abs(calls['strike'] - current_price)
                puts['strike_diff'] = abs(puts['strike'] - current_price)
                
                atm_call = calls.loc[calls['strike_diff'].idxmin()]
                atm_put = puts.loc[puts['strike_diff'].idxmin()]
                
                # Average the IVs
                atm_iv = (atm_call['impliedVolatility'] + atm_put['impliedVolatility']) / 2
                
                if atm_iv > 0:
                    ivs.append(atm_iv)
                    dtes.append(days_to_exp)
            except Exception:
                continue
                
        # If we have at least 2 points, build term structure
        if len(ivs) >= 2:
            from scipy.interpolate import CubicSpline
            term_spline = CubicSpline(dtes, ivs)
            
            # Get 30-day implied volatility
            iv30 = term_spline(30)
            
            # Calculate IV30/RV30 ratio
            if rv30 > 0:
                return iv30 / rv30
                
        # Default value if calculation fails
        return 1.5
        
    except Exception as e:
        logger.warning(f"Error calculating IV30/RV30 ratio for {ticker}: {str(e)}")
        return 1.5  # Default value

def get_term_structure_slope(ticker):
    """
    Calculate the term structure slope for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        float: Term structure slope, or -0.005 as a default if calculation fails
    """
    try:
        # Get stock data
        stock = yf.Ticker(ticker)
        
        # Get option chain for closest expiration
        expirations = stock.options
        if not expirations:
            return -0.005  # Default if no options data available
            
        # Get implied volatility term structure
        ivs = []
        dtes = []
        today = datetime.today().date()
        
        for exp_date in expirations[:min(4, len(expirations))]:
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_exp = (exp_date_obj - today).days
            
            if days_to_exp <= 0:
                continue
                
            try:
                # Get ATM IV
                options = stock.option_chain(exp_date)
                
                # Get current price
                current_price = stock.history(period='1d')['Close'].iloc[-1]
                
                # Find ATM options
                calls = options.calls
                puts = options.puts
                
                calls['strike_diff'] = abs(calls['strike'] - current_price)
                puts['strike_diff'] = abs(puts['strike'] - current_price)
                
                atm_call = calls.loc[calls['strike_diff'].idxmin()]
                atm_put = puts.loc[puts['strike_diff'].idxmin()]
                
                # Average the IVs
                atm_iv = (atm_call['impliedVolatility'] + atm_put['impliedVolatility']) / 2
                
                if atm_iv > 0:
                    ivs.append(atm_iv)
                    dtes.append(days_to_exp)
            except Exception:
                continue
                
        # If we have at least 2 points, calculate slope
        if len(ivs) >= 2 and 0 in dtes:
            # Calculate slope between 0 and 45 days
            from scipy.interpolate import CubicSpline
            term_spline = CubicSpline(dtes, ivs)
            
            # Calculate slope as (IV45 - IV0) / 45
            iv0 = term_spline(0)
            iv45 = term_spline(45)
            
            return (iv45 - iv0) / 45
                
        # Default value if calculation fails
        return -0.005
        
    except Exception as e:
        logger.warning(f"Error calculating term structure slope for {ticker}: {str(e)}")
        return -0.005  # Default value

def calculate_simplified_enhanced_probability(standard_probability, iv30_rv30, ts_slope):
    """
    Calculate enhanced probability using only iv30/rv30 and ts_slope.
    
    Args:
        standard_probability (float): Standard delta-based probability
        iv30_rv30 (float): IV30/RV30 ratio
        ts_slope (float): Term structure slope
        
    Returns:
        dict: Enhanced probability details
    """
    try:
        # iv30/rv30 effect - higher ratio suggests more volatility crush potential
        # Typical screening threshold is iv30/rv30 >= 1.25
        iv_rv_boost = 0.0
        if iv30_rv30 >= 1.25:
            # Scale from 0-30% boost as ratio increases from 1.25 to 2.5+
            iv_rv_boost = min(0.3, (iv30_rv30 - 1.25) * 0.24)
        
        # ts_slope effect - more negative slope suggests more term structure decay
        # Typical screening threshold is ts_slope <= -0.00406
        slope_boost = 0.0
        if ts_slope <= -0.00406:
            # Scale from 0-25% boost as slope decreases from -0.00406 to -0.02+
            slope_boost = min(0.25, (-ts_slope - 0.00406) * 12.5)
        
        # Combine the boosts (multiplicatively to avoid excessive boost)
        # This ensures both factors contribute but individual boosts are capped
        combined_boost = (1 + iv_rv_boost) * (1 + slope_boost) - 1
        
        # Cap the maximum boost at 50%
        combined_boost = min(0.5, combined_boost)
        
        # Apply boost to standard probability, with a maximum of 95%
        enhanced_probability = standard_probability * (1 + combined_boost)
        enhanced_probability = min(0.95, enhanced_probability)
        
        # Calculate confidence interval
        confidence_low = max(0.05, enhanced_probability * 0.9)
        confidence_high = min(0.95, enhanced_probability * 1.1)
        
        # Return in the same format as before for compatibility
        return {
            'ensemble_probability': float(enhanced_probability),
            'confidence_interval': {
                'low': float(confidence_low),
                'high': float(confidence_high)
            },
            'component_probabilities': {
                'iv_based': float(standard_probability),
                'iv_rv_boost': float(iv_rv_boost),
                'slope_boost': float(slope_boost),
                'combined_boost': float(combined_boost)
            }
        }
    except Exception as e:
        logger.warning(f"Error calculating simplified enhanced probability: {str(e)}")
        # Fallback to standard probability
        return {
            'ensemble_probability': float(standard_probability),
            'confidence_interval': {
                'low': float(max(0.05, standard_probability * 0.9)),
                'high': float(min(0.95, standard_probability * 1.1))
            },
            'component_probabilities': {
                'iv_based': float(standard_probability),
                'iv_rv_boost': 0.0,
                'slope_boost': 0.0,
                'combined_boost': 0.0
            }
        }

def build_term_structure(days_to_expiration, implied_volatilities):
    """
    Build a term structure model using cubic spline interpolation.
    
    Args:
        days_to_expiration (list): List of days to expiration
        implied_volatilities (list): List of implied volatilities
        
    Returns:
        function: Spline function that can be called with any DTE
    """
    from scipy.interpolate import CubicSpline
    
    # Create the spline
    cs = CubicSpline(days_to_expiration, implied_volatilities)
    
    return cs

def get_atm_iv(stock, expiration_date, current_price):
    """
    Get the at-the-money implied volatility for a given expiration date.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration_date (str): Expiration date in YYYY-MM-DD format
        current_price (float): Current stock price
        
    Returns:
        float: At-the-money implied volatility
    """
    try:
        # Get option chain for the expiration date
        options = stock.option_chain(expiration_date)
        
        # Get calls and puts
        calls = options.calls
        puts = options.puts
        
        # Find the closest strike to current price for calls
        calls['strike_diff'] = abs(calls['strike'] - current_price)
        atm_call = calls.loc[calls['strike_diff'].idxmin()]
        
        # Find the closest strike to current price for puts
        puts['strike_diff'] = abs(puts['strike'] - current_price)
        atm_put = puts.loc[puts['strike_diff'].idxmin()]
        
        # Average the IVs
        atm_iv = (atm_call['impliedVolatility'] + atm_put['impliedVolatility']) / 2
        
        return atm_iv
    except Exception:
        return 0.0

def yang_zhang(price_data, window=30, trading_periods=252, return_last_only=True):
    """
    Calculate Yang-Zhang volatility estimator.
    
    Args:
        price_data (DataFrame): Price data with High, Low, Open, Close columns
        window (int): Window size for rolling calculation
        trading_periods (int): Number of trading periods in a year
        return_last_only (bool): Whether to return only the last value
        
    Returns:
        float or Series: Volatility estimate
    """
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


def build_term_structure(days, ivs):
    """
    Build a term structure spline from days to expiry and implied volatilities.
    
    Args:
        days (list): List of days to expiry
        ivs (list): List of implied volatilities
        
    Returns:
        function: Spline function that maps days to implied volatility
    """
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


def analyze_options(ticker):
    """
    Analyze options data for a given ticker and provide a recommendation.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict: Analysis results including metrics and recommendation
        
    Raises:
        ValueError: If there's an issue with the data or analysis
    """
    try:
        ticker = ticker.strip().upper()
        if not ticker:
            raise ValueError("No stock symbol provided.")
        
        # Get stock and options data
        stock_data = get_stock_data(ticker)
        if not stock_data or len(stock_data.options) == 0:
            raise ValueError(f"No options found for stock symbol '{ticker}'.")
        
        # Filter expiration dates
        exp_dates = list(stock_data.options)
        try:
            exp_dates = filter_dates(exp_dates)
        except Exception:
            raise ValueError("Error: Not enough option data.")
        
        # Get options chains for each expiration date in parallel
        import concurrent.futures
        
        def fetch_option_chain(exp_date):
            return exp_date, stock_data.option_chain(exp_date)
        
        options_chains = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(exp_dates))) as executor:
            # Submit all tasks and collect futures
            future_to_date = {executor.submit(fetch_option_chain, exp_date): exp_date for exp_date in exp_dates}
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_date):
                try:
                    exp_date, chain = future.result()
                    options_chains[exp_date] = chain
                except Exception as e:
                    logger.warning(f"Error fetching option chain for {ticker} on {future_to_date[future]}: {str(e)}")
        
        # Get current price
        underlying_price = get_current_price(stock_data)
        if underlying_price is None:
            raise ValueError("No market price found.")
        
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
            raise ValueError("Could not determine ATM IV for any expiration dates.")
        
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
        
        price_history = stock_data.history(period='3mo')
        iv30_rv30 = term_spline(30) / yang_zhang(price_history)
        
        avg_volume = price_history['Volume'].rolling(30).mean().dropna().iloc[-1]
        
        expected_move = round(straddle / underlying_price * 100, 2) if straddle else None
        expected_move_str = f"{expected_move}%" if expected_move is not None else "N/A"
        
        # Determine recommendation
        avg_volume_pass = avg_volume >= 1500000
        iv30_rv30_pass = iv30_rv30 >= 1.25
        ts_slope_pass = ts_slope_0_45 <= -0.00406
        
        if avg_volume_pass and iv30_rv30_pass and ts_slope_pass:
            recommendation = "Recommended"
        elif ts_slope_pass and ((avg_volume_pass and not iv30_rv30_pass) or (iv30_rv30_pass and not avg_volume_pass)):
            recommendation = "Consider"
        else:
            recommendation = "Avoid"
        
        # Prepare result
        result = {
            "ticker": ticker,
            "currentPrice": underlying_price,
            "metrics": {
                "avgVolume": float(avg_volume),
                "avgVolumePass": avg_volume_pass,
                "iv30Rv30": float(iv30_rv30),
                "iv30Rv30Pass": iv30_rv30_pass,
                "tsSlope": float(ts_slope_0_45),
                "tsSlopePass": ts_slope_pass
            },
            "expectedMove": expected_move_str,
            "recommendation": recommendation,
            "timestamp": datetime.now().timestamp()
        }
        
        # Find optimal calendar spread if all metrics pass
        if avg_volume_pass and iv30_rv30_pass and ts_slope_pass:
            optimal_spread = find_optimal_calendar_spread(ticker)
            if optimal_spread:
                result["optimalCalendarSpread"] = optimal_spread
            
            # Find optimal naked options if all metrics pass
            # Always try to find naked options for recommended stocks
            logger.info(f"NAKED OPTIONS DEBUG: {ticker} Calling find_optimal_naked_options from analyze_options")
            optimal_naked = find_optimal_naked_options(ticker)
            
            if optimal_naked:
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} Found optimal naked options with {len(optimal_naked.get('topOptions', []))} options")
            else:
                logger.info(f"NAKED OPTIONS DEBUG: {ticker} No optimal naked options found")
                
            # Always set optimalNakedOptions for recommended stocks
            result["optimalNakedOptions"] = optimal_naked
            
            # Find optimal iron condors if all metrics pass
            logger.info(f"IRON CONDOR DEBUG: {ticker} Calling find_optimal_iron_condor from analyze_options")
            logger.warning(f"IRON CONDOR DEBUG: {ticker} Calling find_optimal_iron_condor from analyze_options")
            try:
                optimal_iron_condors = find_optimal_iron_condor(ticker)
                
                if optimal_iron_condors:
                    logger.info(f"IRON CONDOR DEBUG: {ticker} Found optimal iron condors with {len(optimal_iron_condors.get('topIronCondors', []))} condors")
                    logger.warning(f"IRON CONDOR DEBUG: {ticker} Found optimal iron condors with {len(optimal_iron_condors.get('topIronCondors', []))} condors")
                    # Log details of the top iron condor
                    if len(optimal_iron_condors.get('topIronCondors', [])) > 0:
                        top_condor = optimal_iron_condors['topIronCondors'][0]
                        logger.info(f"IRON CONDOR DEBUG: {ticker} Top iron condor details: " +
                                   f"Call spread: {top_condor['callSpread']['shortStrike']}-{top_condor['callSpread']['longStrike']}, " +
                                   f"Put spread: {top_condor['putSpread']['longStrike']}-{top_condor['putSpread']['shortStrike']}, " +
                                   f"Net credit: ${top_condor['netCredit']:.2f}, Score: {top_condor['score']:.2f}")
                        logger.warning(f"IRON CONDOR DEBUG: {ticker} Top iron condor details: " +
                                   f"Call spread: {top_condor['callSpread']['shortStrike']}-{top_condor['callSpread']['longStrike']}, " +
                                   f"Put spread: {top_condor['putSpread']['longStrike']}-{top_condor['putSpread']['shortStrike']}, " +
                                   f"Net credit: ${top_condor['netCredit']:.2f}, Score: {top_condor['score']:.2f}")
                else:
                    logger.info(f"IRON CONDOR DEBUG: {ticker} No optimal iron condors found")
                    logger.warning(f"IRON CONDOR DEBUG: {ticker} No optimal iron condors found")
            except Exception as e:
                logger.error(f"IRON CONDOR DEBUG: {ticker} Error in find_optimal_iron_condor: {str(e)}")
                logger.warning(f"IRON CONDOR DEBUG: {ticker} Error in find_optimal_iron_condor: {str(e)}")
                import traceback
                logger.error(f"IRON CONDOR DEBUG: {ticker} Traceback: {traceback.format_exc()}")
                logger.warning(f"IRON CONDOR DEBUG: {ticker} Traceback: {traceback.format_exc()}")
                optimal_iron_condors = None
                
            # Always set optimalIronCondors for recommended stocks
            result["optimalIronCondors"] = optimal_iron_condors
        
        return result
    
    except Exception as e:
        raise ValueError(f"Error analyzing options: {str(e)}")