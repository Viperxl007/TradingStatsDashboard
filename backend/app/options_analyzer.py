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
from app.data_fetcher import get_stock_data, get_options_data, get_current_price, get_stock_info
import yfinance as yf

# Custom exception for data validation errors
class DataValidationError(Exception):
    """Exception raised when option data fails validation checks."""
    pass

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see detailed logs

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


def get_strikes_near_price(stock, expiration, current_price, range_percent=15):
    """
    Get option strikes near the current price within a reasonable range for calendar spreads.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        current_price (float): Current stock price
        range_percent (float): Percentage range around current price to include
        
    Returns:
        list: List of strike prices near the current price with distance information
    """
    try:
        chain = stock.option_chain(expiration)
        calls = chain.calls
        
        if calls.empty:
            return []
        
        # Calculate price range with constraints for calendar spreads
        # Hard limit: reject strikes >30% from current price
        min_price = current_price * 0.7  # Max 30% ITM
        max_price = current_price * 1.3  # Max 30% OTM
        
        # Filter strikes within hard limit range
        strikes = calls['strike'].unique()
        filtered_strikes = []
        
        for strike in strikes:
            if min_price <= strike <= max_price:
                # Calculate distance from ATM as percentage
                distance_pct = abs((strike / current_price) - 1.0)
                
                # Prioritize strikes within 20% of current price
                priority = 1.0
                if distance_pct <= 0.2:
                    # Higher priority (lower distance = higher priority)
                    priority = 2.0 - distance_pct * 5.0  # Scales from 2.0 (at 0%) to 1.0 (at 20%)
                else:
                    # Lower priority for strikes between 20% and 30%
                    priority = 1.0 - (distance_pct - 0.2) * 5.0  # Scales from 1.0 (at 20%) to 0.5 (at 30%)
                
                filtered_strikes.append({
                    'strike': strike,
                    'distance_pct': distance_pct,
                    'priority': max(0.1, priority)  # Ensure minimum priority of 0.1
                })
        
        # Sort by priority (highest first)
        filtered_strikes.sort(key=lambda x: x['priority'], reverse=True)
        
        # Return just the strike prices, but maintain the priority order
        return [item['strike'] for item in filtered_strikes]
    except Exception as e:
        return []


def get_atm_strikes_for_earnings(stock, expiration, current_price):
    """
    Get ATM strikes specifically for earnings calendar spreads.
    Returns only the strikes closest to current price (ATM).
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        current_price (float): Current stock price
        
    Returns:
        list: List of ATM strike prices (typically 1-2 strikes)
    """
    try:
        chain = stock.option_chain(expiration)
        calls = chain.calls
        
        if calls.empty:
            return []
        
        # Get all available strikes
        strikes = sorted(calls['strike'].unique())
        
        if not strikes:
            return []
        
        # Find the strike closest to current price (true ATM)
        atm_strike = min(strikes, key=lambda x: abs(x - current_price))
        
        # For earnings trades, we want ONLY the ATM strike
        # But we'll include the strike immediately above and below if they're very close
        atm_strikes = [atm_strike]
        
        # Find strikes immediately above and below ATM
        atm_index = strikes.index(atm_strike)
        
        # Add the strike below if it exists and is within 2% of current price
        if atm_index > 0:
            strike_below = strikes[atm_index - 1]
            if abs(strike_below - current_price) / current_price <= 0.02:
                atm_strikes.append(strike_below)
        
        # Add the strike above if it exists and is within 2% of current price
        if atm_index < len(strikes) - 1:
            strike_above = strikes[atm_index + 1]
            if abs(strike_above - current_price) / current_price <= 0.02:
                atm_strikes.append(strike_above)
        
        # Sort strikes and return unique values
        atm_strikes = sorted(list(set(atm_strikes)))
        
        logger.info(f"ATM strikes for earnings trade at price ${current_price}: {atm_strikes}")
        return atm_strikes
        
    except Exception as e:
        logger.error(f"Error getting ATM strikes for earnings: {str(e)}")
        return []


def get_common_atm_strikes(stock, front_expiration, back_expiration, current_price):
    """
    Get ATM strikes that exist in both front and back month expirations.
    
    Args:
        stock (Ticker): yfinance Ticker object
        front_expiration (str): Front month expiration date in YYYY-MM-DD format
        back_expiration (str): Back month expiration date in YYYY-MM-DD format
        current_price (float): Current stock price
        
    Returns:
        list: List of common ATM strike prices that exist in both expirations
    """
    try:
        # Get available strikes from both expirations
        front_chain = stock.option_chain(front_expiration)
        back_chain = stock.option_chain(back_expiration)
        
        if front_chain.calls.empty or back_chain.calls.empty:
            logger.debug(f"Empty options chain - front_calls: {front_chain.calls.empty}, back_calls: {back_chain.calls.empty}")
            return []
        
        # Get all available strikes from both months
        front_strikes = set(front_chain.calls['strike'].unique())
        back_strikes = set(back_chain.calls['strike'].unique())
        
        # Find intersection of strikes
        common_strikes = front_strikes.intersection(back_strikes)
        
        if not common_strikes:
            logger.debug(f"No common strikes between {front_expiration} and {back_expiration}")
            logger.debug(f"Front strikes: {sorted(front_strikes)}")
            logger.debug(f"Back strikes: {sorted(back_strikes)}")
            return []
        
        # Convert to sorted list
        common_strikes_list = sorted(list(common_strikes))
        
        # Find the best ATM strikes from common strikes
        # We want strikes within 5% of current price, prioritizing closest to ATM
        atm_strikes = []
        
        for strike in common_strikes_list:
            distance_pct = abs((strike / current_price) - 1.0)
            if distance_pct <= 0.05:  # Within 5% of current price
                atm_strikes.append({
                    'strike': strike,
                    'distance_pct': distance_pct
                })
        
        if not atm_strikes:
            # If no strikes within 5%, take the closest available common strikes
            logger.debug(f"No common strikes within 5% of current price ${current_price}, using closest available")
            closest_strike = min(common_strikes_list, key=lambda x: abs(x - current_price))
            atm_strikes = [{'strike': closest_strike, 'distance_pct': abs((closest_strike / current_price) - 1.0)}]
        
        # Sort by distance from current price and return just the strike prices
        atm_strikes.sort(key=lambda x: x['distance_pct'])
        result_strikes = [item['strike'] for item in atm_strikes[:3]]  # Return top 3 closest
        
        logger.info(f"Common ATM strikes between {front_expiration} and {back_expiration} at price ${current_price}: {result_strikes}")
        return result_strikes
        
    except Exception as e:
        logger.error(f"Error getting common ATM strikes: {str(e)}")
        return []


def get_next_earnings_date(ticker):
    """
    Get the next earnings date for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        str or None: Next earnings date in YYYY-MM-DD format, or None if not found
    """
    try:
        from app.data_fetcher import get_stock_data
        
        stock = get_stock_data(ticker)
        if not stock:
            return None
        
        # Try to get earnings calendar from yfinance
        try:
            earnings_calendar = stock.calendar
            if earnings_calendar is not None and isinstance(earnings_calendar, dict) and 'Earnings Date' in earnings_calendar:
                next_earnings_date = earnings_calendar['Earnings Date']
                if hasattr(next_earnings_date, 'strftime'):
                    return next_earnings_date.strftime('%Y-%m-%d')
                elif isinstance(next_earnings_date, str):
                    return next_earnings_date
        except Exception as e:
            logger.debug(f"Could not get earnings calendar for {ticker}: {str(e)}")
        
        # Fallback: try to get from market data provider
        try:
            from app.market_data import MarketDataProvider
            provider = MarketDataProvider.get_provider()
            start_date = datetime.now()
            earnings_dates = provider.get_historical_earnings_dates(ticker, start_date)
            
            if earnings_dates:
                # Return the first future earnings date
                today = datetime.now().date()
                for date_str in sorted(earnings_dates):
                    earnings_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    if earnings_date >= today:
                        return date_str
        except Exception as e:
            logger.debug(f"Could not get earnings dates from market data for {ticker}: {str(e)}")
        
        # Additional fallback: try to get earnings history from yfinance
        try:
            earnings_history = stock.earnings_history
            if earnings_history is not None and not earnings_history.empty:
                # Get the most recent earnings date and estimate next one
                last_earnings = earnings_history.index[-1]
                if hasattr(last_earnings, 'strftime'):
                    last_date = last_earnings.date()
                    # Estimate next earnings (roughly 90 days later)
                    estimated_next = last_date + timedelta(days=90)
                    today = datetime.now().date()
                    if estimated_next >= today:
                        logger.debug(f"Estimated next earnings date for {ticker}: {estimated_next.strftime('%Y-%m-%d')}")
                        return estimated_next.strftime('%Y-%m-%d')
        except Exception as e:
            logger.debug(f"Could not get earnings history for {ticker}: {str(e)}")
        
        logger.debug(f"No earnings date found for {ticker}")
        return None
        
    except Exception as e:
        logger.error(f"Error getting next earnings date for {ticker}: {str(e)}")
        return None


def get_dynamic_liquidity_threshold(ticker):
    """
    Get dynamic liquidity threshold based on market cap tiers.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict: Contains threshold and tier information
    """
    try:
        stock_info = get_stock_info(ticker)
        market_cap = stock_info.get('marketCap', 0)
        
        # Define market cap tiers (in billions)
        if market_cap >= 10_000_000_000:  # >= $10B
            return {
                'threshold': 4.0,
                'tier': 'Large Cap',
                'market_cap': market_cap,
                'description': 'High liquidity expected'
            }
        elif market_cap >= 2_000_000_000:  # $2B - $10B
            return {
                'threshold': 2.5,
                'tier': 'Mid Cap',
                'market_cap': market_cap,
                'description': 'Moderate liquidity acceptable'
            }
        elif market_cap >= 300_000_000:  # $300M - $2B
            return {
                'threshold': 1.5,
                'tier': 'Small Cap',
                'market_cap': market_cap,
                'description': 'Limited liquidity is normal'
            }
        else:  # < $300M (should be filtered by price screener)
            return {
                'threshold': 1.0,
                'tier': 'Micro Cap',
                'market_cap': market_cap,
                'description': 'Very limited liquidity - high execution risk'
            }
    except Exception as e:
        logger.warning(f"Could not determine market cap for {ticker}: {str(e)}")
        # Default to mid-cap threshold if we can't determine market cap
        return {
            'threshold': 2.5,
            'tier': 'Unknown',
            'market_cap': 0,
            'description': 'Market cap unknown - using moderate threshold'
        }


def get_liquidity_warning_level(liquidity_score, threshold):
    """
    Determine the warning level for liquidity based on score vs threshold.
    
    Args:
        liquidity_score (float): Current liquidity score
        threshold (float): Required threshold
        
    Returns:
        dict: Warning level and description
    """
    if liquidity_score >= threshold:
        return {
            'level': 'safe',
            'color': 'green',
            'description': 'Good liquidity for execution'
        }
    elif liquidity_score >= threshold - 0.5:
        return {
            'level': 'caution',
            'color': 'yellow',
            'description': 'Moderate liquidity - wider spreads possible'
        }
    else:
        return {
            'level': 'high_risk',
            'color': 'red',
            'description': 'Low liquidity - difficult execution expected'
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
        
    Raises:
        DataValidationError: If option data fails validation checks
    """
    try:
        logger.debug(f"DIAGNOSTIC: get_atm_iv called for expiration {expiration}, strike {strike}")
        chain = stock.option_chain(expiration)
        calls = chain.calls
        puts = chain.puts
        
        if calls.empty or puts.empty:
            logger.debug(f"DIAGNOSTIC: Empty options chain in get_atm_iv - calls_empty: {calls.empty}, puts_empty: {puts.empty}")
            return 0.0
        
        # Find the call and put with the given strike
        call_options = calls[calls['strike'] == strike]
        put_options = puts[puts['strike'] == strike]
        
        if call_options.empty or put_options.empty:
            logger.debug(f"DIAGNOSTIC: No options at strike {strike} in get_atm_iv - calls_empty: {call_options.empty}, puts_empty: {put_options.empty}")
            
            # Log available strikes for debugging
            available_call_strikes = sorted(calls['strike'].unique().tolist())
            available_put_strikes = sorted(puts['strike'].unique().tolist())
            logger.debug(f"DIAGNOSTIC: Available call strikes: {available_call_strikes}")
            logger.debug(f"DIAGNOSTIC: Available put strikes: {available_put_strikes}")
            
            return 0.0
        
        # Extract option data for validation
        call_option = call_options.iloc[0]
        put_option = put_options.iloc[0]
        
        # Validate bid/ask prices for call option
        call_bid = call_option['bid']
        call_ask = call_option['ask']
        
        if call_bid < 0 or call_ask < 0:
            error_msg = f"Negative bid/ask prices in call option: bid={call_bid}, ask={call_ask}"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
            
        if call_bid > call_ask:
            error_msg = f"Call option bid ({call_bid}) is greater than ask ({call_ask})"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
        
        # Validate bid/ask prices for put option
        put_bid = put_option['bid']
        put_ask = put_option['ask']
        
        if put_bid < 0 or put_ask < 0:
            error_msg = f"Negative bid/ask prices in put option: bid={put_bid}, ask={put_ask}"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
            
        if put_bid > put_ask:
            error_msg = f"Put option bid ({put_bid}) is greater than ask ({put_ask})"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
        
        # Extract implied volatility values
        call_iv = call_option['impliedVolatility']
        put_iv = put_option['impliedVolatility']
        
        # Validate implied volatility values
        if call_iv < 0.01 or call_iv > 5.0:
            error_msg = f"Call option implied volatility ({call_iv}) is outside valid range [0.01, 5.0]"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
            
        if put_iv < 0.01 or put_iv > 5.0:
            error_msg = f"Put option implied volatility ({put_iv}) is outside valid range [0.01, 5.0]"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
        
        # Log IV values
        logger.debug(f"DIAGNOSTIC: IV values for strike {strike} - call_iv: {call_iv}, put_iv: {put_iv}")
        
        # Average of call and put IV
        return (call_iv + put_iv) / 2.0
    except DataValidationError:
        # Re-raise DataValidationError to be handled by caller
        raise
    except Exception as e:
        logger.debug(f"DIAGNOSTIC: Exception in get_atm_iv for strike {strike}, expiration {expiration}: {str(e)}")
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
            logger.debug(f"DIAGNOSTIC: Empty options chain - front_empty: {front_options.empty}, back_empty: {back_options.empty}")
            return 0.0
        
        # Find the options with the given strike
        front_options = front_options[front_options['strike'] == strike]
        back_options = back_options[back_options['strike'] == strike]
        
        if front_options.empty or back_options.empty:
            logger.debug(f"DIAGNOSTIC: No options at strike {strike} - front_empty: {front_options.empty}, back_empty: {back_options.empty}")
            return 0.0
        
        # Calculate mid prices
        front_bid = front_options.iloc[0]['bid']
        front_ask = front_options.iloc[0]['ask']
        
        # Log zero bid/ask values
        if front_bid <= 0.001 or front_ask <= 0.001:
            logger.debug(f"DIAGNOSTIC: Zero or near-zero front month bid/ask for {option_type} at strike {strike}: bid={front_bid}, ask={front_ask}")
        
        front_mid = (front_bid + front_ask) / 2.0 if front_bid and front_ask else 0.0
        
        back_bid = back_options.iloc[0]['bid']
        back_ask = back_options.iloc[0]['ask']
        
        # Log zero bid/ask values
        if back_bid <= 0.001 or back_ask <= 0.001:
            logger.debug(f"DIAGNOSTIC: Zero or near-zero back month bid/ask for {option_type} at strike {strike}: bid={back_bid}, ask={back_ask}")
        
        back_mid = (back_bid + back_ask) / 2.0 if back_bid and back_ask else 0.0
        
        # Log mid prices
        if front_mid <= 0.001 or back_mid <= 0.001:
            logger.debug(f"DIAGNOSTIC: Zero or near-zero mid prices for {option_type} at strike {strike}: front_mid={front_mid}, back_mid={back_mid}")
        
        # Calendar spread cost = back month price - front month price
        spread_cost = back_mid - front_mid
        
        # Log spread cost
        if spread_cost <= 0.001:
            logger.debug(f"DIAGNOSTIC: Zero or negative spread cost for {option_type} at strike {strike}: spread_cost={spread_cost}")
            
        return spread_cost
    except Exception as e:
        logger.debug(f"DIAGNOSTIC: Exception in calculate_spread_cost for {option_type} at strike {strike}: {str(e)}")
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
            - confidence_interval: Low and high bounds for the liquidity score
    """
    import numpy as np
    
    try:
        # Extract basic values
        bid = option['bid'] if 'bid' in option else 0.0
        ask = option['ask'] if 'ask' in option else 0.0
        
        # Add diagnostic logging for volume
        if 'volume' not in option:
            logger.debug(f"DIAGNOSTIC: Volume key missing in option data: {option.keys()}")
            volume = 0
        elif option['volume'] <= 0:
            logger.debug(f"DIAGNOSTIC: Zero or negative volume in API response: {option['volume']}")
            volume = 0
        else:
            volume = option['volume']
        
        # Add diagnostic logging for open interest
        if 'openInterest' not in option:
            logger.debug(f"DIAGNOSTIC: OpenInterest key missing in option data: {option.keys()}")
            open_interest = 0
        elif option['openInterest'] <= 0:
            logger.debug(f"DIAGNOSTIC: Zero or negative open interest in API response: {option['openInterest']}")
            open_interest = 0
        else:
            open_interest = option['openInterest']
        
        # Log the full option data if volume or open interest is missing/zero
        if 'volume' not in option or 'openInterest' not in option or option['volume'] <= 0 or option['openInterest'] <= 0:
            logger.debug(f"DIAGNOSTIC: Full option data with missing/zero volume or OI: {option}")
        
        iv = option.get('impliedVolatility', 0.3)  # Default to 30% if not available
        if 'impliedVolatility' not in option:
            logger.debug(f"DIAGNOSTIC: ImpliedVolatility key missing in option data: {option.keys()}")
        
        # Flag for zero bids - only consider actual zero bids as zero
        has_zero_bid = bid == 0.0  # Only consider actual zero bids as zero
        
        # Calculate mid price
        mid_price = (bid + ask) / 2.0 if not has_zero_bid else option_price or ask / 2.0
        
        if mid_price <= 0.001:
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': bid == 0.0,  # Only set to true if bid is actually zero
                'spread_dollars': 0.0,
                'iv': float(iv),
                'confidence_interval': {'low': 0.0, 'high': 0.0},
                'execution_difficulty': 'Extreme'
            }

        # If both bid and ask are zero or extremely low, this is an extremely illiquid option
        if ask <= 0.001 or mid_price <= 0.001:
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': bid == 0.0,  # Only set to true if bid is actually zero
                'spread_dollars': 0.0,
                'iv': float(iv),
                'confidence_interval': {'low': 0.0, 'high': 0.0},
                'execution_difficulty': 'Extreme'
            }
        
        # Calculate absolute spread
        spread_dollars = ask - bid
        
        # Calculate percentage spread - more heavily penalize wide spreads
        # Add safety check for division by zero
        if mid_price <= 0:
            spread_pct = 1.0  # Maximum penalty for invalid price
        else:
            spread_pct = spread_dollars / mid_price
        
        # Calculate volatility-adjusted spread with more realistic scaling
        # Higher IV options naturally have wider spreads
        # Add safety check for division by zero and invalid IV
        if iv <= 0 or np.isnan(iv):
            vol_adjusted_spread = spread_pct  # Use raw spread if IV is invalid
        else:
            # More realistic IV adjustment - don't over-penalize normal IV levels
            iv_factor = max(0.15, min(1.0, iv))  # Clamp IV between 15% and 100%
            vol_adjusted_spread = spread_pct / (iv_factor * 3)  # Increased divisor from 2 to 3
        
        # More realistic spread penalty - less harsh for higher-priced stocks
        # For stocks like MU at $119, a $0.25 spread on a $2.50 option is normal
        spread_factor = 1.0 / (1.0 + (vol_adjusted_spread * 8))  # Reduced from 15x to 8x
        
        # VOLUME FIX: Address daily volume problem with enhanced smoothing
        # For high-volume stocks like MU, use a more generous baseline that reflects the underlying's liquidity
        # Use Open Interest to establish a volume baseline to prevent morning/quiet day penalties
        oi_baseline = max(50, open_interest * 0.1)  # Traditional OI baseline
        
        # For options on high-volume stocks, add a stock volume component to the baseline
        # This ensures options on liquid stocks like MU get proper credit
        if open_interest > 1000:  # Only for reasonably active options
            # Estimate stock volume impact: assume 0.1% of stock volume could trade in this option
            stock_volume_estimate = open_interest * 2  # Conservative estimate based on OI
            enhanced_baseline = max(oi_baseline, stock_volume_estimate)
        else:
            enhanced_baseline = oi_baseline
            
        smoothed_volume = max(volume, enhanced_baseline)
        
        # Enhanced volume scaling that rewards exceptional volume like MU's 18.7M
        # Base factor for normal volume (200 threshold)
        base_volume_factor = min(1.0, np.sqrt(smoothed_volume / 200))
        
        # Multi-tier bonus system for high volume
        if smoothed_volume > 100000:  # 100K+ volume gets exceptional bonus
            exceptional_bonus = min(0.6, np.log10(smoothed_volume / 100000) * 0.15)  # Up to 0.6 bonus
            volume_factor = min(1.6, base_volume_factor + exceptional_bonus)  # Cap at 1.6
        elif smoothed_volume > 10000:  # 10K+ volume gets moderate bonus
            moderate_bonus = min(0.3, np.log10(smoothed_volume / 10000) * 0.1)  # Up to 0.3 bonus
            volume_factor = min(1.3, base_volume_factor + moderate_bonus)  # Cap at 1.3
        else:
            volume_factor = base_volume_factor
        
        # More realistic open interest requirements (was 1000, now 300)
        oi_factor = min(1.0, np.sqrt(open_interest / 300))
        
        # More lenient low price penalty (was $0.20, now $0.10)
        low_price_penalty = 0.8 if mid_price < 0.10 else 1.0
        
        # Less severe penalty for zero bids (was 0.3, now 0.5)
        zero_bid_penalty = 0.5 if has_zero_bid else 1.0
        
        # Dynamic absolute spread penalty based on option price
        # Higher-priced options naturally have wider dollar spreads
        if mid_price < 1.0:
            spread_threshold = 0.10  # $0.10 for cheap options
        elif mid_price < 5.0:
            spread_threshold = 0.25  # $0.25 for mid-priced options
        else:
            spread_threshold = 0.40  # $0.40 for expensive options like MU
        
        abs_spread_penalty = 1.0 if spread_dollars < spread_threshold else 1.0 / (1.0 + (spread_dollars - spread_threshold) * 2)  # Reduced multiplier from 3 to 2
        
        # Rebalanced weights with higher volume contribution for exceptional cases
        # Dynamically adjust weights based on volume factor
        if volume_factor > 1.0:  # Exceptional volume case
            volume_weight = 0.15  # Increase from 5% to 15% for exceptional volume
            spread_weight = 0.55  # Reduce spread weight slightly
            oi_weight = 0.30      # Reduce OI weight slightly
        else:
            volume_weight = 0.05  # Normal 5% for regular volume
            spread_weight = 0.60  # Normal 60% for spreads
            oi_weight = 0.35      # Normal 35% for OI
        
        liquidity_score = (
            (spread_factor * abs_spread_penalty * spread_weight) +
            (volume_factor * volume_weight) +
            (oi_factor * oi_weight)
        ) * low_price_penalty * zero_bid_penalty
        
        # Scale to 0-10
        final_score = 10.0 * liquidity_score
        
        # DIAGNOSTIC LOGGING for high-volume stocks like MU
        if smoothed_volume > 5000000:  # Log details for stocks with >5M volume
            logger.info(f"HIGH VOLUME DIAGNOSTIC - Volume: {smoothed_volume:,.0f}")
            logger.info(f"  Volume factor: {volume_factor:.3f} (weight: {volume_weight:.1%})")
            logger.info(f"  Spread factor: {spread_factor:.3f} (weight: {spread_weight:.1%})")
            logger.info(f"  OI factor: {oi_factor:.3f} (weight: {oi_weight:.1%})")
            logger.info(f"  Spread %: {spread_pct:.1%}, Spread $: ${spread_dollars:.2f}")
            logger.info(f"  Mid price: ${mid_price:.2f}, IV: {iv:.1%}")
            logger.info(f"  Vol-adj spread: {vol_adjusted_spread:.3f}")
            logger.info(f"  Penalties - Low price: {low_price_penalty:.2f}, Zero bid: {zero_bid_penalty:.2f}, Abs spread: {abs_spread_penalty:.3f}")
            logger.info(f"  Raw score: {liquidity_score:.3f}, Final score: {final_score:.1f}")
        
        # Calculate confidence interval
        confidence_low = max(0.0, final_score * 0.8)
        confidence_high = min(10.0, final_score * 1.2)
        
        # Determine execution difficulty rating
        if final_score < 3:
            execution_difficulty = 'High'
        elif final_score < 7:
            execution_difficulty = 'Medium'
        else:
            execution_difficulty = 'Low'
        
        return {
            'score': min(10.0, max(0.0, final_score)),
            'spread_pct': float(spread_pct) if not np.isnan(spread_pct) else 1.0,
            'volume': int(volume) if not np.isnan(volume) else 0,
            'open_interest': int(open_interest) if not np.isnan(open_interest) else 0,
            'has_zero_bid': has_zero_bid,
            'spread_dollars': float(spread_dollars) if not np.isnan(spread_dollars) else 0.0,
            'iv': float(iv) if not np.isnan(iv) else 0.0,
            'vol_adjusted_spread': float(vol_adjusted_spread) if not np.isnan(vol_adjusted_spread) else 1.0,
            'confidence_interval': {
                'low': float(confidence_low) if not np.isnan(confidence_low) else 0.0,
                'high': float(confidence_high) if not np.isnan(confidence_high) else 0.0
            },
            'execution_difficulty': execution_difficulty
        }
    except Exception as e:
        # Fallback to worst liquidity score on error, but don't assume zero bids
        logger.error(f"Error in get_improved_liquidity_score: {str(e)}")
        return {
            'score': 0.0,
            'spread_pct': 1.0,
            'volume': 0,
            'open_interest': 0,
            'has_zero_bid': False,  # Don't assume zero bids on error
            'spread_dollars': 0.0,
            'iv': 0.0,
            'confidence_interval': {'low': 0.0, 'high': 0.0},
            'execution_difficulty': 'Extreme'
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
    
    if spread_cost <= 0:
        # Check if either option actually has a zero bid before setting has_zero_bids
        actual_zero_bids = front_month_liquidity.get('has_zero_bid', False) or back_month_liquidity.get('has_zero_bid', False)
        return {
            'score': 0.0,
            'spread_pct': 1.0,
            'has_zero_bids': actual_zero_bids,  # Only set to true if either option actually has a zero bid
            'execution_difficulty': 'Extreme'
        }
    
    # Calculate how much of the spread cost is consumed by the bid-ask spread
    # This is a key metric for calendar spreads - if too high, the trade isn't viable
    spread_impact = total_spread_dollars / spread_cost
    
    # Much more lenient spread impact penalty for high-volume stocks
    # 60% spread impact is normal for many viable calendar spreads
    if spread_impact < 0.7:  # Raised threshold from 50% to 70%
        viability_factor = 1.0
    else:
        # Much gentler penalty curve
        viability_factor = 1.0 / (1.0 + (spread_impact - 0.7) * 1.5)  # Reduced multiplier from 3 to 1.5
    
    # Less severe penalty for zero bids in calendar spreads
    zero_bid_penalty = 0.6 if (  # Increased from 0.3 to 0.6
        front_month_liquidity['has_zero_bid'] or
        back_month_liquidity['has_zero_bid']
    ) else 1.0
    
    # Calculate volatility-adjusted bid-ask spreads for more accurate comparison
    # Higher IV options naturally have wider spreads, so we adjust for this
    front_vol_adjusted_spread = front_month_liquidity['spread_pct'] / (front_month_liquidity.get('iv', 0.3) * 2) if 'iv' in front_month_liquidity else front_month_liquidity['spread_pct']
    back_vol_adjusted_spread = back_month_liquidity['spread_pct'] / (back_month_liquidity.get('iv', 0.3) * 2) if 'iv' in back_month_liquidity else back_month_liquidity['spread_pct']
    
    # Weight OI more heavily than volume (since volume is daily)
    front_oi = front_month_liquidity['open_interest']
    back_oi = back_month_liquidity['open_interest']
    front_vol = front_month_liquidity['volume']
    back_vol = back_month_liquidity['volume']
    
    # Calculate OI/volume weighted factor with enhanced baseline (same as individual options)
    def get_enhanced_baseline(volume, oi):
        oi_baseline = max(50, oi * 0.1)
        if oi > 1000:
            stock_volume_estimate = oi * 2
            enhanced_baseline = max(oi_baseline, stock_volume_estimate)
        else:
            enhanced_baseline = oi_baseline
        return max(volume, enhanced_baseline)
    
    front_vol_smoothed = get_enhanced_baseline(front_vol, front_oi)
    back_vol_smoothed = get_enhanced_baseline(back_vol, back_oi)
    
    # Enhanced volume scaling for calendar spreads - same multi-tier system
    def get_enhanced_volume_factor(smoothed_vol):
        base_factor = min(1.0, np.sqrt(smoothed_vol / 200))
        if smoothed_vol > 100000:  # 100K+ volume gets exceptional bonus
            exceptional_bonus = min(0.6, np.log10(smoothed_vol / 100000) * 0.15)
            return min(1.6, base_factor + exceptional_bonus)
        elif smoothed_vol > 10000:  # 10K+ volume gets moderate bonus
            moderate_bonus = min(0.3, np.log10(smoothed_vol / 10000) * 0.1)
            return min(1.3, base_factor + moderate_bonus)
        else:
            return base_factor
    
    front_vol_factor = get_enhanced_volume_factor(front_vol_smoothed)
    back_vol_factor = get_enhanced_volume_factor(back_vol_smoothed)
    
    # Dynamic weighting based on exceptional volume
    avg_vol_factor = (front_vol_factor + back_vol_factor) / 2
    if avg_vol_factor > 1.0:  # Exceptional volume case
        oi_weight = 0.6   # Reduce OI weight
        vol_weight = 0.4  # Increase volume weight
    else:
        oi_weight = 0.7   # Normal OI weight
        vol_weight = 0.3  # Normal volume weight
    
    # More realistic thresholds: OI 300 (was 1000), Volume with enhanced scaling
    oi_vol_factor = (
        (oi_weight * (min(1.0, np.sqrt(front_oi / 300)) + min(1.0, np.sqrt(back_oi / 300))) / 2) +
        (vol_weight * avg_vol_factor)
    )
    
    # Apply additional factors to the combined score
    adjusted_score = combined_score * viability_factor * zero_bid_penalty * oi_vol_factor
    
    # Calculate confidence interval for liquidity score
    confidence_low = max(0.0, adjusted_score * 0.8)
    confidence_high = min(10.0, adjusted_score * 1.2)
    
    return {
        'score': min(10.0, max(0.0, adjusted_score)),
        'front_liquidity': front_month_liquidity,
        'back_liquidity': back_month_liquidity,
        'spread_impact': float(spread_impact),
        'has_zero_bids': front_month_liquidity.get('has_zero_bid', False) or back_month_liquidity.get('has_zero_bid', False),
        'vol_adjusted_spread': {
            'front': float(front_vol_adjusted_spread),
            'back': float(back_vol_adjusted_spread)
        },
        'confidence_interval': {
            'low': float(confidence_low),
            'high': float(confidence_high)
        },
        'execution_difficulty': 'High' if adjusted_score < 4 else 'Medium' if adjusted_score < 7 else 'Low'
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
            logger.debug(f"Empty options chain for {option_type} at {expiration}")
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': False,  # Don't assume zero bids if chain is empty
                'spread_dollars': 0.0
            }
        
        # Find the option with the given strike
        options = options_chain[options_chain['strike'] == strike]
        
        if options.empty:
            logger.debug(f"No options at strike {strike} for {option_type} at {expiration}")
            return {
                'score': 0.0,
                'spread_pct': 1.0,
                'volume': 0,
                'open_interest': 0,
                'has_zero_bid': False,  # Don't assume zero bids if no options at strike
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
            'has_zero_bid': False,  # Don't assume zero bids on error
            'spread_dollars': 0.0
        }

def calculate_spread_score(iv_differential, spread_cost, front_liquidity, back_liquidity,
                          strike_distance_from_atm, days_between_expirations=30,
                          days_to_front_expiration=14, monte_carlo_results=None, spread_impact=None,
                          current_price=None):
    """
    Calculate a composite score with heavy emphasis on Monte Carlo simulation results.
    """
    # Minimum thresholds for earnings calendar spreads
    GOOD_IV_DIFFERENTIAL = 0.10     # 10% - decent setup  
    IDEAL_IV_DIFFERENTIAL = 0.15    # 15%+ - excellent setup

    # STEP 1: Early Rejection Filters
    if spread_cost <= 0.05:
        return {'score': 0.0, 'iv_quality': 'Below threshold'}
    
    # Extract liquidity scores
    front_liquidity_score = front_liquidity["score"] if isinstance(front_liquidity, dict) else front_liquidity
    back_liquidity_score = back_liquidity["score"] if isinstance(back_liquidity, dict) else back_liquidity
    
    # Reject strikes far from the money (>20% from current price)
    if current_price and abs(strike_distance_from_atm) / current_price > 0.20:
        distance_pct = abs(strike_distance_from_atm) / current_price
        # Apply exponential penalty for distance
        distance_penalty = math.exp(-(distance_pct - 0.20) * 10)
    else:
        distance_penalty = 1.0
    
    # STEP 2: Monte Carlo Results as PRIMARY Decision Factor
    if monte_carlo_results:
        # For earnings calendar spreads, be more lenient with expected profit requirements
        # Calendar spreads are conservative strategies with lower profit expectations
        expected_profit = monte_carlo_results.get('expected_profit', 0)
        
        # Only reject if expected profit is extremely negative (worse than -80% of spread cost)
        # This allows for typical calendar spread scenarios where small losses are expected
        # but we're betting on IV crush and time decay working in our favor
        max_acceptable_loss = -0.80 * spread_cost if spread_cost > 0 else -5.0
        if expected_profit < max_acceptable_loss:
            return {'score': 0.0, 'iv_quality': 'Below threshold'}
        
        # If median outcome (50th percentile) is negative, apply penalty but don't auto-reject
        # For earnings calendar spreads, negative median outcomes are more common due to conservative nature
        percentiles = monte_carlo_results.get('percentiles', {})
        median_penalty = 1.0
        if percentiles and percentiles.get('50', 0) <= 0:
            # Apply a penalty factor instead of auto-rejection
            median_outcome = percentiles.get('50', 0)
            # Penalty ranges from 0.1 (very negative) to 0.8 (slightly negative)
            median_penalty = max(0.1, 0.8 + (median_outcome / spread_cost) * 0.1)
            
        # Use Monte Carlo probability as primary component (0-50 points)
        probability = monte_carlo_results.get('probability_of_profit', 0)
        probability_component = probability * 50  # 0-50 points
        
        # Use expected return as second major component (0-30 points)
        return_on_risk = expected_profit / spread_cost
        return_component = min(30, return_on_risk * 30)  # Cap at 30 points
        
        # Liquidity as third major component (0-15 points)
        min_liquidity = min(front_liquidity_score, back_liquidity_score)
        liquidity_component = min_liquidity * 1.5  # 0-15 points
        
        # Enhanced IV differential scoring (0-10 points) with bonuses for meeting thresholds
        # Base score is still proportional to IV differential
        base_iv_score = min(5, iv_differential * 10)
        
        # Add bonuses when IV differential meets or exceeds the defined thresholds
        if iv_differential >= IDEAL_IV_DIFFERENTIAL:
            # Excellent setup - add 5 points (total up to 10)
            iv_bonus = 5.0
            iv_quality = "Excellent"
        elif iv_differential >= GOOD_IV_DIFFERENTIAL:
            # Good setup - add 2.5 points (total up to 7.5)
            iv_bonus = 2.5
            iv_quality = "Good"
        else:
            iv_bonus = 0.0
            iv_quality = "Below threshold"
            
        iv_component = base_iv_score + iv_bonus
        
        # Add IV quality to monte_carlo_results if it exists
        if monte_carlo_results is not None and isinstance(monte_carlo_results, dict):
            monte_carlo_results['iv_quality'] = iv_quality
        
        # Calculate base score
        base_score = (
            probability_component +
            return_component +
            liquidity_component +
            iv_component
        )
        
        # Apply distance and spread impact penalties
        if spread_impact and spread_impact > 0.2:
            spread_penalty = max(0.3, 1.0 - (spread_impact - 0.2) * 2)
        else:
            spread_penalty = 1.0
            
        final_score = base_score * distance_penalty * spread_penalty * median_penalty
        
        # Return both the score and the IV quality
        return {
            'score': min(100, final_score),
            'iv_quality': iv_quality
        }
    
    # STEP 3: If No Monte Carlo Results, Use Traditional Scoring but with Better Balance
    else:
        # Create more balanced scoring with heavier weight on ATM proximity
        # Enhanced IV differential scoring with bonuses for meeting thresholds
        base_iv_score = iv_differential * 100 * 0.15  # Reduced base weight
        
        # Add significant bonuses when IV differential meets or exceeds the defined thresholds
        if iv_differential >= IDEAL_IV_DIFFERENTIAL:
            # Excellent setup - add 15 percentage points
            iv_bonus = 15.0
            iv_quality = "Excellent"
        elif iv_differential >= GOOD_IV_DIFFERENTIAL:
            # Good setup - add 7.5 percentage points
            iv_bonus = 7.5
            iv_quality = "Good"
        else:
            iv_bonus = 0.0
            iv_quality = "Below threshold"
            
        iv_component = base_iv_score + iv_bonus
        
        # Limit cost efficiency influence
        cost_efficiency = min(2.0, iv_differential / spread_cost)  # Cap at 2.0
        cost_component = cost_efficiency * 10 * 0.15  # Reduced scale factor from 25/50
        
        delta_neutrality = 1.0 - (abs(strike_distance_from_atm) / current_price) if current_price else 1.0


        # Increase weight of ATM proximity
        delta_component = delta_neutrality * 0.35  # Increased from 0.2
        
        # Keep liquidity weight
        liquidity_component = (front_liquidity_score + back_liquidity_score) / 2.0 * 0.25
        
        days_between_factor = 1.0
        if days_between_expirations <= 30:
            days_between_factor = 1.2 # 20% bonus for 30 DTE
        elif days_between_expirations >= 60:
            days_between_factor = 0.8 # 20% penalty for 60 DTE

        days_to_front_factor = 1.0
        if 7 <= days_to_front_expiration <= 21:
            days_to_front_factor = 1.1 # 10% bonus for 7-21 DTE
        elif days_to_front_expiration < 7:
            days_to_front_factor = 1.0 # Currently no penalty for 0-7 DTE

        # Other timing factors
        days_between_component = days_between_factor * 0.05  # Reduced from 0.1
        days_to_front_component = days_to_front_factor * 0.05  # Unchanged
        
        # Final score with penalties
        base_score = (
            iv_component +
            cost_component +
            liquidity_component +
            delta_component +
            days_between_component +
            days_to_front_component
        )
        
        # Apply distance penalty
        score = base_score * distance_penalty
        
        # Scale to 0-100
        final_score = min(100, score * 2)
        
        # Return both the score and the IV quality
        return {
            'score': final_score,
            'iv_quality': iv_quality
        }

def find_optimal_calendar_spread(ticker, back_month_exp_options=[30, 45, 60], all_metrics_pass=False, run_full_analysis=False, earnings_date=None):
    """
    Find the optimal calendar spread for a given ticker, optimized for earnings trades.
    
    Args:
        ticker (str): Stock ticker symbol
        back_month_exp_options (list): List of days out to consider for back month expiration
        all_metrics_pass (bool): Whether all metrics pass thresholds
        run_full_analysis (bool): Whether to run full analysis with more simulations (5,000 vs 500)
        earnings_date (str, optional): Earnings date in YYYY-MM-DD format. If not provided, will attempt to fetch it.
        
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
        
        # Get dynamic liquidity threshold based on market cap
        liquidity_info = get_dynamic_liquidity_threshold(ticker)
        liquidity_threshold = liquidity_info['threshold']
        logger.info(f"{ticker} liquidity threshold: {liquidity_threshold} ({liquidity_info['tier']}, Market Cap: ${liquidity_info['market_cap']:,.0f})")
        
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
        
        # Get earnings date if not provided
        if earnings_date is None:
            earnings_date = get_next_earnings_date(ticker)
            if earnings_date:
                logger.info(f"{ticker} next earnings date: {earnings_date}")
            else:
                logger.info(f"{ticker} no earnings date found, proceeding with standard analysis")
        
        # Check if we need to evaluate additional front month expirations for earnings trades
        front_month_expirations = [front_month]
        
        if earnings_date:
            try:
                earnings_date_obj = datetime.strptime(earnings_date, "%Y-%m-%d").date()
                days_to_earnings = (earnings_date_obj - today).days
                
                # If front month expiration is within 3 days of earnings, also evaluate N+1 expiration
                if abs(days_to_front_expiration - days_to_earnings) <= 3:
                    logger.info(f"{ticker} front month expiration ({front_month}) is within 3 days of earnings ({earnings_date})")
                    
                    # Find the next expiration (N+1)
                    if len(future_dates) > 1:
                        next_front_month_date = future_dates[1]
                        next_front_month = next_front_month_date.strftime("%Y-%m-%d")
                        front_month_expirations.append(next_front_month)
                        logger.info(f"{ticker} also evaluating N+1 expiration: {next_front_month}")
                    
            except Exception as e:
                logger.warning(f"Error processing earnings date for {ticker}: {str(e)}")
        
        logger.info(f"{ticker} evaluating front month expirations: {front_month_expirations}")
        
        # Define a function to evaluate a single spread combination
        def evaluate_spread(params, liquidity_threshold=2.5, liquidity_info=None):
            if len(params) == 4:
                days_out, strike, option_type, front_exp = params
            else:
                # Backward compatibility
                days_out, strike, option_type = params
                front_exp = front_month
            
            # Reject strikes far from current price
            if abs(strike - current_price) / current_price > 0.30:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Rejected - too far from current price (>30%)")
                return None
            
            target_date = today + timedelta(days=days_out)
            
            # Find closest expiration to target date
            back_month = find_closest_expiration(exp_dates, target_date)
            back_month_date = datetime.strptime(back_month, "%Y-%m-%d").date()
            
            # Calculate days between expirations using the specific front expiration
            front_exp_date = datetime.strptime(front_exp, "%Y-%m-%d").date()
            days_between_expirations = (back_month_date - front_exp_date).days
            days_to_front_expiration_specific = (front_exp_date - today).days
            
            # Calculate key metrics for this potential spread
            try:
                logger.debug(f"DIAGNOSTIC: Retrieving front month IV for {ticker} {option_type} strike ${strike}, expiration {front_exp}")
                front_iv = get_atm_iv(stock, front_exp, strike)
                
                logger.debug(f"DIAGNOSTIC: Retrieving back month IV for {ticker} {option_type} strike ${strike}, expiration {back_month}")
                back_iv = get_atm_iv(stock, back_month, strike)
            except DataValidationError as e:
                logger.warning(f"{ticker} {option_type} strike ${strike}: Data validation error - {str(e)}")
                return None
            
            # Skip if we couldn't get IV data
            if front_iv == 0 or back_iv == 0:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Skipping due to missing IV data - front_iv: {front_iv}, back_iv: {back_iv}")
                
                # Add detailed diagnostics for missing IV data
                try:
                    # Check front month data
                    front_chain = stock.option_chain(front_exp)
                    front_options = front_chain.calls if option_type.lower() == 'call' else front_chain.puts
                    front_at_strike = front_options[front_options['strike'] == strike]
                    
                    if front_at_strike.empty:
                        logger.debug(f"DIAGNOSTIC: No front month options found at strike {strike} for {ticker} {option_type}")
                    else:
                        front_option = front_at_strike.iloc[0]
                        logger.debug(f"DIAGNOSTIC: Front month option data for {ticker} {option_type} strike {strike}: "
                                    f"bid={front_option['bid']}, ask={front_option['ask']}, "
                                    f"volume={front_option.get('volume', 'N/A')}, OI={front_option.get('openInterest', 'N/A')}, "
                                    f"IV={front_option.get('impliedVolatility', 'N/A')}")
                    
                    # Check back month data
                    back_chain = stock.option_chain(back_month)
                    back_options = back_chain.calls if option_type.lower() == 'call' else back_chain.puts
                    back_at_strike = back_options[back_options['strike'] == strike]
                    
                    if back_at_strike.empty:
                        logger.debug(f"DIAGNOSTIC: No back month options found at strike {strike} for {ticker} {option_type}")
                    else:
                        back_option = back_at_strike.iloc[0]
                        logger.debug(f"DIAGNOSTIC: Back month option data for {ticker} {option_type} strike {strike}: "
                                    f"bid={back_option['bid']}, ask={back_option['ask']}, "
                                    f"volume={back_option.get('volume', 'N/A')}, OI={back_option.get('openInterest', 'N/A')}, "
                                    f"IV={back_option.get('impliedVolatility', 'N/A')}")
                except Exception as e:
                    logger.debug(f"DIAGNOSTIC: Error during detailed IV diagnostics for {ticker} {option_type} strike {strike}: {str(e)}")
                
                return None
            
            # IV differential (front month should be higher)
            iv_differential = front_iv - back_iv

            # Minimum thresholds for earnings calendar spreads
            MIN_IV_DIFFERENTIAL = -0.20     # Allow negative IV differential for testing liquidity improvements
            
            if iv_differential < MIN_IV_DIFFERENTIAL:
                # If the IV differential is negative, we want to skip this spread
                logger.debug(f"{ticker} {option_type} strike ${strike}: Skipping due to low IV differential: {iv_differential}")
                return None
            
            # Get pricing information
            spread_cost = calculate_spread_cost(stock, front_exp, back_month, strike, option_type)
            
            # Skip if spread cost is invalid
            if spread_cost <= 0:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Skipping due to invalid spread cost: {spread_cost}")
                return None
            
            # Get option details for more accurate calculations
            try:
                front_chain = stock.option_chain(front_exp)
                back_chain = stock.option_chain(back_month)
                
                front_options = front_chain.calls if option_type.lower() == 'call' else front_chain.puts
                back_options = back_chain.calls if option_type.lower() == 'call' else back_chain.puts
                
                # Find the options with the given strike
                front_option = front_options[front_options['strike'] == strike].iloc[0].to_dict()
                back_option = back_options[back_options['strike'] == strike].iloc[0].to_dict()
                
                # Calculate more realistic return on risk using the new function
                return_on_risk = calculate_realistic_calendar_return(
                    front_option,
                    back_option,
                    current_price,
                    days_between_expirations
                )
                
                # Calculate more accurate probability of profit
                probability = calculate_calendar_probability(
                    front_option,
                    back_option,
                    current_price,
                    days_to_front_expiration_specific,
                    days_between_expirations
                )
                
                # Calculate spread impact (execution cost)
                spread_impact = calculate_realistic_spread_impact(
                    front_option,
                    back_option,
                    spread_cost
                )
                
                # Model IV crush for earnings
                iv_crush_model = model_iv_crush_earnings(
                    front_iv,
                    back_iv,
                    days_to_front_expiration_specific,
                    ticker
                )
                
                # Calculate liquidity metrics BEFORE Monte Carlo to pass correct values
                # This ensures our SPECIAL EARNINGS-TAILORED MONTE CARLO uses accurate liquidity data
                front_liquidity = get_liquidity_score(stock, front_exp, strike, option_type)
                back_liquidity = get_liquidity_score(stock, back_month, strike, option_type)
                
                # Attach liquidity scores to option data for Monte Carlo consumption
                # PRESERVE SPECIAL EARNINGS STRATEGY: This ensures our custom Monte Carlo
                # uses the improved liquidity calculations while maintaining all earnings-specific logic
                front_option_with_liquidity = front_option.copy()
                back_option_with_liquidity = back_option.copy()
                front_option_with_liquidity['liquidity'] = front_liquidity
                back_option_with_liquidity['liquidity'] = back_liquidity
                
                # Run Monte Carlo simulation for more accurate projections
                # Use 5,000 simulations for direct search, 500 otherwise
                # SPECIAL EARNINGS MONTE CARLO: This is our custom simulation tailored for earnings trades
                num_simulations = 5000 if run_full_analysis else 500
                monte_carlo_results = monte_carlo_calendar_spread(
                    front_option_with_liquidity,  # Now includes correct liquidity scores
                    back_option_with_liquidity,   # Now includes correct liquidity scores
                    current_price,
                    days_to_front_expiration_specific,
                    days_between_expirations,
                    num_simulations=num_simulations
                )
                
                # Add debug logging to see if numSimulations is being correctly passed
                logger.warning(f"MONTE CARLO DEBUG: num_simulations={num_simulations}, returned numSimulations={monte_carlo_results.get('numSimulations')}")
                
                # Ensure numSimulations is explicitly set in the monte_carlo_results
                if 'numSimulations' not in monte_carlo_results and num_simulations is not None:
                    monte_carlo_results['numSimulations'] = num_simulations
                    logger.warning(f"MONTE CARLO DEBUG: Added missing numSimulations={num_simulations} to monte_carlo_results")
                
            except Exception as e:
                logger.debug(f"{ticker} {option_type} strike ${strike}: Error calculating advanced metrics: {str(e)}")
                # Fall back to basic calculations if advanced ones fail
                # Still calculate liquidity even if Monte Carlo fails
                front_liquidity = get_liquidity_score(stock, front_exp, strike, option_type)
                back_liquidity = get_liquidity_score(stock, back_month, strike, option_type)
                return_on_risk = 0.0
                probability = 0.0
                spread_impact = 100.0
                iv_crush_model = None
                monte_carlo_results = None
            
            # Liquidity metrics already calculated above before Monte Carlo
            # (No need to recalculate - using the same values that were passed to Monte Carlo)
            
            # Calculate combined liquidity score for the calendar spread
            combined_liquidity = calculate_calendar_spread_liquidity(
                front_liquidity,
                back_liquidity,
                spread_cost
            )
            
            # Skip if spread cost is too small in absolute terms
            min_viable_cost = max(0.15, current_price * 0.005)  # $0.15 or 0.5% of underlying
            if spread_cost < min_viable_cost:
                logger.debug(f"Skipping {ticker} {option_type} strike ${strike}: insufficient spread cost (${spread_cost:.2f} < ${min_viable_cost:.2f})")
                return None
                
            # Check liquidity against dynamic threshold and add warning information
            back_liquidity_warning = get_liquidity_warning_level(back_liquidity['score'], liquidity_threshold)
            front_liquidity_warning = get_liquidity_warning_level(front_liquidity['score'], liquidity_threshold)
            
            # Log liquidity status but don't filter out - let user decide
            if back_liquidity['score'] < liquidity_threshold:
                logger.debug(f"{ticker} {option_type} strike ${strike}: back month liquidity below threshold ({back_liquidity['score']:.1f} < {liquidity_threshold})")
            if front_liquidity['score'] < liquidity_threshold:
                logger.debug(f"{ticker} {option_type} strike ${strike}: front month liquidity below threshold ({front_liquidity['score']:.1f} < {liquidity_threshold})")
            
            # Calculate a composite score with our improved formula
            score_result = calculate_spread_score(
                iv_differential,
                spread_cost,
                front_liquidity['score'],  # Pass individual liquidity scores
                back_liquidity['score'],
                strike_distance_from_atm=abs(strike - current_price),
                days_between_expirations=days_between_expirations,
                days_to_front_expiration=days_to_front_expiration_specific,
                monte_carlo_results=monte_carlo_results,  # Pass Monte Carlo results
                spread_impact=combined_liquidity['spread_impact']  # Pass spread impact
            )

            # Extract score and IV quality from the result
            if isinstance(score_result, dict):
                score = score_result['score']
                iv_quality = score_result['iv_quality']
            else:
                score = score_result
                iv_quality = 'Unknown'
            
            logger.debug(f"{ticker} {option_type} strike ${strike}, back month {back_month}: Calculated score: {score}, IV Quality: {iv_quality}")
            
            # Calculate estimated max profit
            est_max_profit = 0.0
            if monte_carlo_results:
                est_max_profit = monte_carlo_results['max_profit']
            else:
                # Fallback calculation if Monte Carlo is not available
                est_max_profit = spread_cost * 2.8  # Traditional estimate

            result = {
                'score': float(score),
                'spread': {
                    'strike': float(strike),
                    'frontMonth': front_exp,
                    'backMonth': back_month,
                    'spreadCost': float(spread_cost),
                    'ivDifferential': float(iv_differential),
                    'ivQuality': iv_quality,  # Add IV quality to the result
                    'frontIv': float(front_iv),
                    'backIv': float(back_iv),
                    'frontLiquidity': front_liquidity,
                    'backLiquidity': back_liquidity,
                    'combinedLiquidity': combined_liquidity,
                    'daysBetweenExpirations': days_between_expirations,
                    'daysToFrontExpiration': days_to_front_expiration_specific,
                    'score': float(score),
                    'optionType': option_type,
                    'realisticReturnOnRisk': float(return_on_risk),
                    'probabilityOfProfit': float(probability),
                    'spreadImpact': float(spread_impact),
                    # Add these new fields for the frontend:
                    'estimatedMaxProfit': float(est_max_profit),
                    'returnOnRisk': float(return_on_risk),
                    'enhancedProbability': float(monte_carlo_results['probability_of_profit'] if monte_carlo_results else probability),
                    # Add earnings-specific information
                    'earningsDate': earnings_date,
                    'isEarningsTrade': earnings_date is not None,
                    # Add liquidity warning information
                    'liquidityWarnings': {
                        'frontMonth': front_liquidity_warning,
                        'backMonth': back_liquidity_warning,
                        'threshold': liquidity_threshold,
                        'thresholdInfo': liquidity_info if liquidity_info else {
                            'tier': 'Unknown',
                            'description': 'Market cap unknown'
                        }
                    }
                }
            }
            
            # Add Monte Carlo results if available
            if monte_carlo_results:
                result['spread']['monteCarloResults'] = {
                    'probabilityOfProfit': float(monte_carlo_results['probability_of_profit']),
                    'raw_probability': float(monte_carlo_results['raw_probability']),
                    'expectedProfit': float(monte_carlo_results['expected_profit']),
                    'maxProfit': float(monte_carlo_results['max_profit']),
                    'returnOnRisk': float(monte_carlo_results['return_on_risk']),
                    'maxReturn': float(monte_carlo_results['max_return']),
                    'numSimulations': int(monte_carlo_results['numSimulations']),
                    'percentiles': monte_carlo_results['percentiles']
                }
                
                # Add debug logging
                logger.warning(f"MONTE CARLO DEBUG: Added monteCarloResults to result with numSimulations={monte_carlo_results['numSimulations']}")
            
            # Add IV crush model if available
            if iv_crush_model:
                result['spread']['ivCrushModel'] = {
                    'preEarningsFrontIv': float(iv_crush_model['pre_earnings_front_iv']),
                    'preEarningsBackIv': float(iv_crush_model['pre_earnings_back_iv']),
                    'postEarningsFrontIv': float(iv_crush_model['post_earnings_front_iv']),
                    'postEarningsBackIv': float(iv_crush_model['post_earnings_back_iv']),
                    'ivCrushAmount': {
                        'front': float(iv_crush_model['iv_crush_amount']['front']),
                        'back': float(iv_crush_model['iv_crush_amount']['back'])
                    }
                }
            
            return result
        
        # Create a list of all combinations to evaluate
        combinations = []
        
        # For each front month expiration, find common strikes with each back month
        for front_exp in front_month_expirations:
            # Create combinations for each back month option
            for days_out in back_month_exp_options:
                # Find the back month expiration for this days_out
                target_date = today + timedelta(days=days_out)
                back_month = find_closest_expiration(exp_dates, target_date)
                
                # Get common ATM strikes between this specific front/back month pair
                common_strikes = get_common_atm_strikes(stock, front_exp, back_month, current_price)
                
                if not common_strikes:
                    logger.debug(f"{ticker}: No common strikes found between {front_exp} and {back_month}")
                    continue
                
                if earnings_date:
                    logger.info(f"{ticker} common ATM strikes for earnings trade {front_exp}/{back_month}: {common_strikes}")
                else:
                    logger.info(f"{ticker} common ATM strikes for calendar spread {front_exp}/{back_month}: {common_strikes}")
                
                # Create combinations for each common strike
                for strike in common_strikes:
                    # Determine option type based on strike price relative to current price
                    if strike < current_price:
                        option_type = 'put'
                        logger.info(f"{ticker} strike ${strike} < current price ${current_price}: Using PUT calendar spread")
                        combinations.append((days_out, strike, option_type, front_exp))
                    else:
                        option_type = 'call'
                        logger.info(f"{ticker} strike ${strike} >= current price ${current_price}: Using CALL calendar spread")
                        combinations.append((days_out, strike, option_type, front_exp))
        
        # Process combinations sequentially to avoid race conditions
        best_spread = None
        best_score = float('-inf')  # Allow negative scores for earnings calendar spreads
        
        logger.debug(f"DIAGNOSTIC: Processing {len(combinations)} combinations sequentially for {ticker}")
        
        # Process each combination sequentially
        for combo in combinations:
            if len(combo) == 4:
                days_out, strike, option_type, front_exp = combo
            else:
                days_out, strike, option_type = combo
                front_exp = front_month
            try:
                logger.debug(f"DIAGNOSTIC: Evaluating {ticker} {option_type} strike ${strike}, days out {days_out}, front exp {front_exp}")
                result = evaluate_spread(combo, liquidity_threshold, liquidity_info)
                if result and result['score'] > best_score:
                    best_score = result['score']
                    best_spread = result['spread']
                    logger.info(f"{ticker} {option_type} strike ${strike}, days out {days_out}, front exp {front_exp}: New best score: {best_score}")
            except Exception as e:
                logger.warning(f"Error evaluating spread for {ticker} {option_type} strike ${strike}, days out {days_out}: {str(e)}")
        
        # Set a minimum threshold score for earnings calendar spreads
        # For earnings plays, we allow negative scores since they represent conservative strategies
        # with expected small losses but potential for IV crush profits
        MINIMUM_VIABLE_SCORE = -10.0  # Allow moderately negative scores for earnings calendar spreads
        logger.info(f"{ticker} best score found: {best_score}, minimum threshold: {MINIMUM_VIABLE_SCORE}")
        
        if best_score < MINIMUM_VIABLE_SCORE:
            logger.warning(f"{ticker}: No worthwhile spread found - best score {best_score} below threshold {MINIMUM_VIABLE_SCORE}")
            return None  # No worthwhile play
        
        logger.info(f"{ticker}: Found optimal spread with score {best_score}: {best_spread}")
        
        # Add the metrics pass status to the result as a string
        if best_spread:
            best_spread["metricsPass"] = str(all_metrics_pass).lower()
            
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
    from app.utils import convert_numpy_types
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
        
        # Convert any NumPy types to Python native types before returning
        return convert_numpy_types(result)
    
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

def calculate_future_option_value(S, K, T, sigma, r=0.05, option_type='call'):
    """
    Calculate the theoretical future value of an option using Black-Scholes.
    
    Args:
        S (float): Current stock price
        K (float): Strike price
        T (float): Time to expiration in years
        sigma (float): Volatility
        r (float): Risk-free interest rate (default: 0.05)
        option_type (str): 'call' or 'put'
        
    Returns:
        float: Theoretical option price
    """
    if sigma <= 0 or T <= 0:
        return max(0, S - K) if option_type.lower() == 'call' else max(0, K - S)
    
    d1 = black_scholes_d1(S, K, T, r, sigma)
    d2 = black_scholes_d2(d1, sigma, T)
    
    if option_type.lower() == 'call':
        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:  # put
        return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

def simulate_price_path(current_price, volatility, time_period, num_steps=100, risk_free_rate=0.05):
    """
    Simulate a price path using geometric Brownian motion with fat tails and occasional jumps.
    
    Args:
        current_price (float): Current stock price
        volatility (float): Annualized volatility
        time_period (float): Time period in years
        num_steps (int): Number of steps in the simulation
        risk_free_rate (float): Risk-free interest rate
        
    Returns:
        float: Final price at the end of the simulation
    """
    dt = time_period / num_steps
    drift = risk_free_rate - 0.5 * volatility**2
    
    # Generate random returns with fat tails using Student's t-distribution
    # Lower degrees of freedom (df) = fatter tails (df=3 is quite fat-tailed)
    df = 5  # degrees of freedom
    t_random = np.random.standard_t(df, num_steps)
    # Scale t-distribution to match normal distribution volatility
    scaling_factor = np.sqrt((df - 2) / df)
    random_returns = t_random / scaling_factor
    
    # Add occasional jumps to simulate market shocks
    jump_probability = 0.05  # 5% chance of a jump at each step
    jump_size_mean = 0.0
    jump_size_std = 0.03  # 3% standard deviation for jumps
    
    jumps = np.random.binomial(1, jump_probability, num_steps) * \
            np.random.normal(jump_size_mean, jump_size_std, num_steps)
    
    # Calculate price path with both diffusion and jumps
    price_path = current_price * np.exp(
        np.cumsum(drift * dt + volatility * np.sqrt(dt) * random_returns + jumps)
    )
    
    return price_path[-1]  # Return final price

def simulate_iv_crush(back_iv, front_iv, days_to_back_exp=None, crush_factor=None):
    """
    Simulate IV crush after earnings or other events with variable crush factor.
    
    Args:
        back_iv (float): Back month implied volatility
        front_iv (float): Front month implied volatility
        days_to_back_exp (int, optional): Days to back month expiration
        crush_factor (float, optional): Custom crush factor. If None, calculated based on IVs.
        
    Returns:
        tuple: Front and back month post-crush implied volatilities
    """
    if crush_factor is None:
        # Calculate base crush factor based on IV differential
        iv_diff = front_iv - back_iv
        if iv_diff > 0.2:  # High IV differential
            base_crush_factor = 0.6  # 60% crush
        elif iv_diff > 0.1:  # Medium IV differential
            base_crush_factor = 0.5  # 50% crush
        else:  # Low IV differential
            base_crush_factor = 0.4  # 40% crush
        
        # Add randomness to crush factor
        crush_variation = np.random.uniform(-0.15, 0.15)  # ±15% variation
        crush_factor = np.clip(base_crush_factor + crush_variation, 0.2, 0.8)
    
    # Front month IV crushes by the full factor
    front_post_crush_iv = front_iv * (1 - crush_factor)

    # Back month IV crushes by a reduced factor
    if days_to_back_exp:
        if days_to_back_exp <= 30:
            back_crush_factor = crush_factor * 0.5
        elif days_to_back_exp <= 45:
            back_crush_factor = crush_factor * 0.4
        else:
            back_crush_factor = crush_factor * 0.3
    else:
        back_crush_factor = crush_factor * 0.3

    # Calculate post-crush IV
    back_post_crush_iv = back_iv * (1 - back_crush_factor)

    return front_post_crush_iv, back_post_crush_iv

def calculate_option_value(S, K, T, sigma, option_type='call', r=0.05):
    """
    Calculate option value using Black-Scholes.
    
    Args:
        S (float): Current stock price
        K (float): Strike price
        T (float): Time to expiration in years
        sigma (float): Volatility
        option_type (str): 'call' or 'put'
        r (float): Risk-free interest rate
        
    Returns:
        float: Option price
    """
    return calculate_future_option_value(S, K, T, sigma, r, option_type)

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

def find_optimal_iron_condor(ticker, max_options=8, max_combinations=50, earnings_date=None):
    """
    Find the optimal iron condor for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        max_options (int): Maximum number of options to consider
        max_combinations (int): Maximum number of combinations to evaluate
        earnings_date (str, optional): Earnings date in YYYY-MM-DD format
        
    Returns:
        dict or None: Details of the optimal iron condor, or None if no worthwhile iron condor is found
    """
    from app.utils import convert_numpy_types
    logger.info(f"IRON CONDOR DEBUG: Starting search for {ticker} with max_options={max_options}, max_combinations={max_combinations}")
    analysis_start_time = datetime.now()
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
                
                put_short = otm_puts.iloc[put_short_idx]  # Higher strike (closer to money) - THIS IS THE SHORT PUT
                put_long = otm_puts.iloc[put_long_idx]  # Lower strike (furhter OTM) - THIS IS THE LONG PUT
                
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
                ts_slope = get_term_structure_slope(ticker, earnings_date)
                
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
                    "hasZeroBids": str(bool(has_zero_bids)).lower()  # Convert to string "true" or "false"
                }
                
                return convert_numpy_types(result)
            except Exception as e:
                logger.warning(f"IRON CONDOR DEBUG: Error evaluating iron condor: {str(e)}")
                logger.info(f"IRON CONDOR DEBUG: Error evaluating iron condor: {str(e)}")
                return None
        
        # Find all possible iron condors
        iron_condors = []
        
        # Limit the number of options to evaluate to prevent timeouts
        # Use a smaller number for direct searches
        otm_calls_subset = otm_calls.head(min(len(otm_calls), max_options))
        otm_puts_subset = otm_puts.head(min(len(otm_puts), max_options))
        
        logger.info(f"IRON CONDOR PERFORMANCE: {ticker} Using {len(otm_calls_subset)} call options and {len(otm_puts_subset)} put options")
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} Evaluating {len(otm_calls_subset)} call options and {len(otm_puts_subset)} put options")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Evaluating {len(otm_calls_subset)} call options and {len(otm_puts_subset)} put options")
        
        # Use a more efficient approach to evaluate combinations
        # Limit the total number of combinations to evaluate
        combinations = []
        combination_count = 0
        
        # Only evaluate a subset of combinations to prevent timeouts
        for call_short_idx in range(min(4, len(otm_calls_subset) - 1)):
            for call_long_idx in range(call_short_idx + 1, min(call_short_idx + 3, len(otm_calls_subset))):
                for put_short_idx in range(min(4, len(otm_puts_subset) - 1)):
                    for put_long_idx in range(put_short_idx + 1, min(put_short_idx + 3, len(otm_puts_subset))):
                        combinations.append((call_short_idx, call_long_idx, put_short_idx, put_long_idx))
                        combination_count += 1
                        if combination_count >= max_combinations:
                            break
                    if combination_count >= max_combinations:
                        break
                if combination_count >= max_combinations:
                    break
            if combination_count >= max_combinations:
                break
        
        logger.info(f"IRON CONDOR PERFORMANCE: {ticker} Evaluating {len(combinations)} combinations (reduced from potential {len(otm_calls_subset) * (len(otm_calls_subset) - 1) * len(otm_puts_subset) * (len(otm_puts_subset) - 1) / 4})")
        
        # Process combinations in batches to avoid overwhelming the system
        batch_size = 10
        for i in range(0, len(combinations), batch_size):
            batch = combinations[i:i+batch_size]
            
            # Process batch
            for combo in batch:
                call_short_idx, call_long_idx, put_short_idx, put_long_idx = combo
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
        # Use the utility function to convert NumPy types to Python native types
        
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
        
        # Log performance metrics
        analysis_duration = (datetime.now() - analysis_start_time).total_seconds()
        logger.info(f"IRON CONDOR PERFORMANCE: {ticker} Analysis completed in {analysis_duration:.2f} seconds")
        logger.info(f"IRON CONDOR DEBUG: {ticker} Found {len(top_iron_condors)} optimal iron condors")
        
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

def get_term_structure_slope(ticker, earnings_date=None):
    """
    Calculate the term structure slope for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        earnings_date (str, optional): Earnings date in YYYY-MM-DD format to filter pre-earnings expirations
        
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
        
        # Parse earnings date if provided
        earnings_date_obj = None
        if earnings_date:
            try:
                earnings_date_obj = datetime.strptime(earnings_date, "%Y-%m-%d").date()
                logger.info(f"get_term_structure_slope: Filtering expirations for earnings date: {earnings_date}")
            except ValueError:
                logger.warning(f"get_term_structure_slope: Invalid earnings date format: {earnings_date}")
        
        for exp_date in expirations[:min(4, len(expirations))]:
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_exp = (exp_date_obj - today).days
            
            if days_to_exp <= 0:
                continue
            
            # Skip expirations that occur before earnings date
            if earnings_date_obj and exp_date_obj < earnings_date_obj:
                logger.info(f"get_term_structure_slope: Skipping pre-earnings expiration: {exp_date}")
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
        
        # Ensure we have at least 2 data points
        if len(ivs) < 2:
            logger.warning(f"get_term_structure_slope: Insufficient post-earnings expirations ({len(ivs)}) for {ticker}")
            # Fall back to using all available expirations if we don't have enough post-earnings data
            ivs = []
            dtes = []
            for exp_date in expirations[:min(4, len(expirations))]:
                exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
                days_to_exp = (exp_date_obj - today).days
                
                if days_to_exp <= 0:
                    continue
                    
                try:
                    options = stock.option_chain(exp_date)
                    current_price = stock.history(period='1d')['Close'].iloc[-1]
                    calls = options.calls
                    puts = options.puts
                    calls['strike_diff'] = abs(calls['strike'] - current_price)
                    puts['strike_diff'] = abs(puts['strike'] - current_price)
                    atm_call = calls.loc[calls['strike_diff'].idxmin()]
                    atm_put = puts.loc[puts['strike_diff'].idxmin()]
                    atm_iv = (atm_call['impliedVolatility'] + atm_put['impliedVolatility']) / 2
                    
                    if atm_iv > 0:
                        ivs.append(atm_iv)
                        dtes.append(days_to_exp)
                except Exception:
                    continue
                
        # If we have at least 2 points, calculate slope
        if len(ivs) >= 2:
            # Calculate slope using shortest available expiration to 45 days
            from scipy.interpolate import CubicSpline
            term_spline = CubicSpline(dtes, ivs)
            
            # Use shortest available expiration as baseline
            shortest_dte = min(dtes)
            
            # Calculate slope as (IV45 - IV_shortest) / (45 - shortest)
            iv_shortest = term_spline(shortest_dte)
            iv45 = term_spline(45)
            
            slope = (iv45 - iv_shortest) / (45 - shortest_dte)
            
            logger.info(f"get_term_structure_slope: {ticker} shortest_dte={shortest_dte}, "
                       f"IV@{shortest_dte}={iv_shortest:.4f}, IV@45={iv45:.4f}, slope={slope:.6f}")
            
            return slope
                
        # Default value if calculation fails
        return -0.005
        
    except Exception as e:
        logger.warning(f"Error calculating term structure slope for {ticker}: {str(e)}")
        return -0.005  # Default value

def calculate_simplified_enhanced_probability(standard_probability, iv30_rv30, ts_slope):
    """
    Calculate enhanced probability using only iv30/rv30 and ts_slope.
    Uses Monte Carlo simulation for more accurate probabilities.
    
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
            iv_rv_boost = min(0.4, (iv30_rv30 - 1.25) * 0.3)
        
        # ts_slope effect - more negative slope suggests more term structure decay
        # Typical screening threshold is ts_slope <= -0.00406
        slope_boost = 0.0
        if ts_slope <= -0.00406:
            # Scale from 0-25% boost as slope decreases from -0.00406 to -0.02+
            slope_boost = min(0.35, (-ts_slope - 0.00406) * 15)
        
        # Combine the boosts (multiplicatively to avoid excessive boost)
        # This ensures both factors contribute but individual boosts are capped
        combined_boost = (1 + iv_rv_boost) * (1 + slope_boost) - 1
        
        # Cap the maximum boost at 60% (increased from 50%)
        combined_boost = min(0.6, combined_boost)
        
        # Apply boost to standard probability - no artificial cap
        enhanced_probability = standard_probability * (1 + combined_boost)
        
        # Calculate confidence interval - wider for more realistic assessment
        confidence_low = max(0.0, enhanced_probability * 0.85)  # 15% lower bound
        confidence_high = min(1.0, enhanced_probability * 1.15)  # 15% upper bound
        
        # Calculate Monte Carlo adjustment factor
        # This simulates the effect of multiple paths and outcomes
        monte_carlo_factor = 1.0
        if iv30_rv30 > 2.0:  # Very high IV/RV ratio suggests more uncertainty
            monte_carlo_factor = 0.95  # Slightly reduce probability
        elif ts_slope < -0.01:  # Very steep term structure suggests higher confidence
            monte_carlo_factor = 1.05  # Slightly increase probability
            
        # Apply Monte Carlo adjustment
        monte_carlo_probability = enhanced_probability * monte_carlo_factor
        
        # Return in the same format as before for compatibility, but with additional data
        return {
            'ensemble_probability': float(monte_carlo_probability),
            'confidence_interval': {
                'low': float(confidence_low),
                'high': float(confidence_high)
            },
            'component_probabilities': {
                'iv_based': float(standard_probability),
                'iv_rv_boost': float(iv_rv_boost),
                'slope_boost': float(slope_boost),
                'combined_boost': float(combined_boost),
                'monte_carlo_factor': float(monte_carlo_factor)
            }
        }
    except Exception as e:
        logger.warning(f"Error calculating simplified enhanced probability: {str(e)}")
        # Fallback to standard probability
        return {
            'ensemble_probability': float(standard_probability),
            'confidence_interval': {
                'low': float(max(0.0, standard_probability * 0.85)),
                'high': float(min(1.0, standard_probability * 1.15))
            },
            'component_probabilities': {
                'iv_based': float(standard_probability),
                'iv_rv_boost': 0.0,
                'slope_boost': 0.0,
                'combined_boost': 0.0,
                'monte_carlo_factor': 1.0
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
        
    Raises:
        DataValidationError: If option data fails validation checks
    """
    try:
        # Get option chain for the expiration date
        options = stock.option_chain(expiration_date)
        
        # Get calls and puts
        calls = options.calls
        puts = options.puts
        
        if calls.empty or puts.empty:
            logger.debug(f"DIAGNOSTIC: Empty options chain in get_atm_iv - calls_empty: {calls.empty}, puts_empty: {puts.empty}")
            return 0.0
        
        # Find the closest strike to current price for calls
        calls['strike_diff'] = abs(calls['strike'] - current_price)
        atm_call = calls.loc[calls['strike_diff'].idxmin()]
        
        # Find the closest strike to current price for puts
        puts['strike_diff'] = abs(puts['strike'] - current_price)
        atm_put = puts.loc[puts['strike_diff'].idxmin()]
        
        # Validate bid/ask prices for call option
        call_bid = atm_call['bid']
        call_ask = atm_call['ask']
        
        if call_bid < 0 or call_ask < 0:
            error_msg = f"Negative bid/ask prices in ATM call option: bid={call_bid}, ask={call_ask}"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
            
        if call_bid > call_ask:
            error_msg = f"ATM call option bid ({call_bid}) is greater than ask ({call_ask})"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
        
        # Validate bid/ask prices for put option
        put_bid = atm_put['bid']
        put_ask = atm_put['ask']
        
        if put_bid < 0 or put_ask < 0:
            error_msg = f"Negative bid/ask prices in ATM put option: bid={put_bid}, ask={put_ask}"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
            
        if put_bid > put_ask:
            error_msg = f"ATM put option bid ({put_bid}) is greater than ask ({put_ask})"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
        
        # Extract implied volatility values
        call_iv = atm_call['impliedVolatility']
        put_iv = atm_put['impliedVolatility']
        
        # Validate implied volatility values
        if call_iv < 0.01 or call_iv > 5.0:
            error_msg = f"ATM call option implied volatility ({call_iv}) is outside valid range [0.01, 5.0]"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
            
        if put_iv < 0.01 or put_iv > 5.0:
            error_msg = f"ATM put option implied volatility ({put_iv}) is outside valid range [0.01, 5.0]"
            logger.error(f"VALIDATION ERROR: {error_msg}")
            raise DataValidationError(error_msg)
        
        # Average the IVs
        atm_iv = (call_iv + put_iv) / 2
        
        return atm_iv
    except DataValidationError:
        # Re-raise DataValidationError to be handled by caller
        raise
    except Exception as e:
        logger.debug(f"DIAGNOSTIC: Exception in get_atm_iv for expiration {expiration_date}: {str(e)}")
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


def calculate_realistic_calendar_return(front_option, back_option, current_price, days_between):
    """Calculate a more realistic return on risk for calendar spreads"""
    # Get mid prices
    front_mid = (front_option['bid'] + front_option['ask']) / 2
    back_mid = (back_option['bid'] + back_option['ask']) / 2
    
    # Spread cost (net debit)
    spread_cost = back_mid - front_mid
    
    # Proper max risk calculation (always the debit paid)
    max_risk = spread_cost
    
    # Calculate realistic max profit potential
    # Base on expected IV crush of front month and statistical outcomes
    front_iv = front_option['impliedVolatility']
    back_iv = back_option['impliedVolatility']
    
    # Calculate expected IV crush for front month (more severe near earnings)
    expected_iv_crush_factor = 0.5  # Front month IV typically drops 40-60% after earnings
    
    # Calculate expected profit at optimal point (when front month expires worthless)
    # but with realistic IV crush in back month
    expected_back_iv_after_front_expires = back_iv * 0.8  # Back month IV also drops but less
    
    # Estimate the back month option value after front month expiration
    back_option_future_value = calculate_future_option_value(
        current_price,
        back_option['strike'],
        days_between/365,
        expected_back_iv_after_front_expires
    )
    
    # Realistic max profit estimate
    est_max_profit = back_option_future_value - spread_cost
    
    # Realistic return on risk
    if max_risk > 0:
        return_on_risk = est_max_profit / max_risk
        # Cap at a reasonable maximum based on empirical studies
        return min(3.0, return_on_risk)  # 300% is a more realistic cap
    else:
        return 0.0


def calculate_calendar_probability(front_option, back_option, current_price, days_to_front_exp, days_between_expirations):
    """
    Calculate a more data-driven probability of profit for calendar spreads
    
    Uses Black-Scholes model for accurate delta calculation and conditional probability
    based on front month expiration for calendar spreads.
    """
    # Extract key data
    strike = front_option['strike']
    front_iv = front_option['impliedVolatility']
    back_iv = back_option['impliedVolatility']
    days_to_back_exp = days_to_front_exp
    if 'daysToExpiration' in back_option:
        days_to_back_exp = back_option['daysToExpiration']
    elif 'days_to_expiration' in back_option:
        days_to_back_exp = back_option['days_to_expiration']
    
    logger.warning(f"PROBABILITY CALCULATION: Strike ${strike}")
    logger.warning(f"  Current Price: ${current_price:.2f}")
    logger.warning(f"  Front IV: {front_iv:.4f}, Back IV: {back_iv:.4f}")
    logger.warning(f"  Days to Front Expiration: {days_to_front_exp}")
    
    # Calculate option greeks using Black-Scholes model
    # Convert days to years for the model
    front_time_to_exp = days_to_front_exp / 365.0
    
    # Use risk-free rate of 5% as a default if not available
    risk_free_rate = 0.05
    
    try:
        # Calculate greeks for front month option
        front_greeks = calculate_option_greeks(
            current_price,
            strike,
            front_time_to_exp,
            risk_free_rate,
            front_iv,
            front_option.get('optionType', 'call').lower()
        )
        
        # Get accurate delta from Black-Scholes model
        front_delta = front_greeks['delta']
        logger.warning(f"  Front Delta (Black-Scholes): {front_delta:.4f}")
        
        # Calculate true delta-based probability
        if front_option.get('optionType', 'call').lower() == 'call':
            base_prob = 1.0 - front_delta  # For calls: 1 - delta
        else:
            base_prob = front_delta  # For puts: delta (already absolute value)
            
        logger.warning(f"  Base Probability (Black-Scholes): {base_prob:.4f} ({base_prob*100:.1f}%)")
    except Exception as e:
        logger.error(f"CRITICAL ERROR: Failed to calculate Black-Scholes greeks: {str(e)}")
        # Instead of falling back to arbitrary values, raise a clear error message
        # but still provide a reasonable estimate for the UI to function
        base_prob = 0.5
        logger.error(f"CRITICAL ERROR: Using fallback probability of 50% - DATA ISSUE NEEDS FIXING")
    
    # Adjust for IV differential (major driver of calendar spread success)
    iv_differential = front_iv - back_iv
    iv_differential_factor = min(0.3, max(-0.3, iv_differential * 0.5))
    logger.warning(f"  IV Differential: {iv_differential:.4f}")
    logger.warning(f"  IV Differential Factor: {iv_differential_factor:.4f} ({iv_differential_factor*100:.1f}%)")
    
    # Adjust for days to expiration (sweet spot is 7-21 days)
    dte_factor = 0
    if 5 <= days_to_front_exp <= 21:
        dte_factor = 0.1
        logger.warning(f"  DTE Factor: +0.1 (optimal 7-21 day range)")
    elif days_to_front_exp < 5:
        dte_factor = -0.2  # Penalize very short DTEs
        logger.warning(f"  DTE Factor: -0.2 (too close to expiration)")
    else:
        logger.warning(f"  DTE Factor: 0.0 (neutral)")
    
    # Adjust for strike selection vs ATM
    strike_factor = 0
    moneyness = abs(strike - current_price) / current_price
    logger.warning(f"  Moneyness: {moneyness:.4f} ({moneyness*100:.1f}%)")
    
    if moneyness < 0.02:  # Within 2% of ATM
        strike_factor = 0.05
        logger.warning(f"  Strike Factor: +0.05 (near ATM)")
    elif moneyness > 0.1:  # Far from ATM
        strike_factor = -0.1
        logger.warning(f"  Strike Factor: -0.1 (far from ATM)")
    else:
        logger.warning(f"  Strike Factor: 0.0 (neutral)")
    
    # Calculate final probability with factors
    adjusted_prob = base_prob + iv_differential_factor + dte_factor + strike_factor
    logger.warning(f"  Adjusted Probability: {adjusted_prob:.4f} ({adjusted_prob*100:.1f}%)")
    
    # For calendar spreads: use conditional probability based on front month expiration
    # This accounts for the fact that calendar spreads profit when front month expires worthless
    # and back month retains value
    
    # Calculate conditional probability factor
    conditional_factor = 0.0
    if 'daysToExpiration' in back_option:
        days_to_back_exp = back_option['daysToExpiration']
    else:
        days_to_back_exp = days_to_front_exp + days_between_expirations

    if days_to_back_exp > days_to_front_exp:
        # The larger the gap between expirations, the more this factor helps
        time_gap_ratio = min(1.0, (days_to_back_exp - days_to_front_exp) / 30.0)
        conditional_factor = 0.1 * time_gap_ratio
        logger.warning(f"  Conditional Probability Factor: +{conditional_factor:.4f} ({conditional_factor*100:.1f}%)")
    
    # Apply conditional probability factor
    final_prob = adjusted_prob + conditional_factor
    
    # Cap at 90% maximum but don't silently fall back to cap
    if final_prob > 0.9:
        logger.warning(f"  Probability {final_prob:.4f} exceeds 90% cap, limiting to 90%")
        final_prob = 0.9
    elif final_prob < 0.4:
        logger.warning(f"  Probability {final_prob:.4f} below 40% floor, limiting to 40%")
        final_prob = 0.4
    
    logger.warning(f"  Final Probability: {final_prob:.4f} ({final_prob*100:.1f}%)")
    
    return final_prob


def monte_carlo_calendar_spread(front_option, back_option, current_price,
                               days_to_front_exp, days_between_exp,
                               num_simulations=1000, exit_days_before_expiry=0):
    """
    Run a Monte Carlo simulation to estimate calendar spread outcomes
    
    Uses 75th percentile for max profit calculations to avoid overly optimistic estimates
    Includes transaction costs, volatility uncertainty, and variable IV crush for realism
    Implements variable slippage based on liquidity and more conservative probability calculations

    Args:
        front_option (dict): Front month option data
        back_option (dict): Back month option data
        current_price (float): Current stock price
        days_to_front_exp (int): Days to front expiration
        days_between_exp (int): Days between front and back expiration
        num_simulations (int): Number of simulations to run
        exit_days_before_expiry (int): Days before expiration to exit the position
    """
    strike = front_option['strike']
    front_iv = front_option['impliedVolatility']
    back_iv = back_option['impliedVolatility']
    option_type = front_option.get('optionType', 'call').lower()
    
    # Entry: Pay the spread using actual bid/ask prices for more realistic entry costs
    front_bid = front_option['bid']  # We receive bid when selling
    front_ask = front_option['ask']  # We pay ask when buying
    back_bid = back_option['bid']    # We receive bid when selling
    back_ask = back_option['ask']    # We pay ask when buying
    
    # Use actual bid/ask prices instead of mid prices for more realistic entry costs
    front_entry_price = front_bid  # We sell the front month at the bid
    back_entry_price = back_ask    # We buy the back month at the ask
    spread_cost = back_entry_price - front_entry_price  # This is higher (worse) than using mid prices
    
    # Calculate liquidity-based slippage
    # Extract liquidity information if available
    front_liquidity = front_option.get('liquidity', {}).get('score', 5.0)
    back_liquidity = back_option.get('liquidity', {}).get('score', 5.0)
    
    # Higher slippage for less liquid options (scale from 2% to 5%)
    base_slippage = 0.02  # 2% base slippage
    front_slippage_factor = max(1.0, (10 - front_liquidity) / 5)  # 1.0 to 2.0
    back_slippage_factor = max(1.0, (10 - back_liquidity) / 5)    # 1.0 to 2.0
    
    # Commission and exchange fees per spread (increased from previous $0.02)
    commission_cost = 0.05  # $0.05 per spread including exchange fees
    
    # Add regulatory fees and other costs
    regulatory_fees = 0.01  # $0.01 per spread
    total_fixed_costs = commission_cost + regulatory_fees
    
    logger.warning(f"MONTE CARLO: Starting simulation for strike ${strike}")
    logger.warning(f"  Front IV: {front_iv:.4f}, Back IV: {back_iv:.4f}")
    logger.warning(f"  Spread Cost: ${spread_cost:.2f} (including bid/ask spread)")
    logger.warning(f"  Commission & Fees: ${total_fixed_costs:.2f}")
    logger.warning(f"  Front Month Liquidity: {front_liquidity:.1f}/10, Back Month: {back_liquidity:.1f}/10")
    logger.warning(f"  Days to front exp: {days_to_front_exp}, Days between exp: {days_between_exp}")
    logger.warning(f"  Running {num_simulations} simulations")
    
    # Setup for simulations
    profit_outcomes = []
    
    for _ in range(num_simulations):
        # Add volatility uncertainty - realized volatility varies from implied
        # Increased range from ±20% to ±25% for more extreme scenarios
        volatility_adjustment = np.random.uniform(0.75, 1.25)  # ±25% variation
        adjusted_front_iv = front_iv * volatility_adjustment
        adjusted_back_iv = back_iv * volatility_adjustment
        
        #model early exit scenario
        if exit_days_before_expiry > 0:
            days_to_exit = days_to_front_exp - exit_days_before_expiry
            price_at_exit = simulate_price_path(current_price, adjusted_front_iv, days_to_exit/365)

            # Get BOTH IVs after crush with variable crush factor
            post_earning_front_iv, post_earnings_back_iv = simulate_iv_crush(
                adjusted_front_iv, adjusted_back_iv, days_between_exp
            )

            #calculate front option value with remaining time value
            remaining_time = exit_days_before_expiry / 365.0
            front_value_at_exit = calculate_option_value(
                price_at_exit,
                strike,
                remaining_time,
                post_earning_front_iv,
                option_type
            )

            # Calculate back option value
            back_remaining_time = (days_between_exp - exit_days_before_expiry) / 365.0
            back_value_at_exit = calculate_option_value(
                price_at_exit,
                strike,
                back_remaining_time,
                post_earnings_back_iv,
                option_type
            )

            # Add variable exit slippage based on liquidity
            # Randomize slippage within a range for each simulation
            front_slippage = base_slippage * front_slippage_factor * np.random.uniform(0.8, 1.2)
            back_slippage = base_slippage * back_slippage_factor * np.random.uniform(0.8, 1.2)
            
            # Apply slippage to both legs
            front_value_at_exit *= (1 + front_slippage)  # We pay more when buying back
            back_value_at_exit *= (1 - back_slippage)    # We receive less when selling

            # P/L calculation with transaction costs
            profit = back_value_at_exit - front_value_at_exit - spread_cost - total_fixed_costs

        else:

            # Simulate price path to front expiration with adjusted volatility
            price_at_front_exp = simulate_price_path(
                current_price,
                adjusted_front_iv,
                days_to_front_exp/365
            )
        
            # Calculate INTRINSIC value at front expiration
            if option_type == 'call':
                # Call value at expiration
                front_value_at_exp = max(0, price_at_front_exp - strike)
            else:
                # Put value at expiration
                front_value_at_exp = max(0, strike - price_at_front_exp)

            # Simulate IV crush after earnings with variable crush factor
            _, post_earnings_back_iv = simulate_iv_crush(
                adjusted_front_iv, adjusted_back_iv, days_between_exp
                )
        
            # Calculate back option value at front expiration
            back_value_at_front_exp = calculate_option_value(
                price_at_front_exp,
                strike,
                days_between_exp/365,
                post_earnings_back_iv,
                option_type
            )
            
            # Add variable exit slippage based on liquidity
            back_slippage = base_slippage * back_slippage_factor * np.random.uniform(0.8, 1.2)
            back_value_at_front_exp *= (1 - back_slippage)
        
            # Calculate P/L with transaction costs
            profit = back_value_at_front_exp - front_value_at_exp - spread_cost - total_fixed_costs
        
        profit_outcomes.append(profit)
    
    # Analyze results
    profit_outcomes = np.array(profit_outcomes)
    
    # Calculate raw probability without any cap
    raw_probability = sum(profit_outcomes > 0) / num_simulations
    
    # Apply a conservative adjustment factor
    # This reduces the probability more as it gets higher (addressing optimism bias)
    # For example: 90% becomes ~76%, 80% becomes ~70%, 70% becomes ~63%
    adjusted_probability = raw_probability * (0.85 + 0.15 * (1 - raw_probability))
    
    # Use adjusted probability without any cap
    probability_of_profit = adjusted_probability
    average_profit = np.mean(profit_outcomes)
    
    # Use 75th percentile instead of 90th for more realistic max profit
    max_profit = np.percentile(profit_outcomes, 75)  # Changed from 90th to 75th percentile
    
    # Calculate return metrics
    return_on_risk = average_profit / spread_cost if spread_cost > 0 else 0
    max_return = max_profit / spread_cost if spread_cost > 0 else 0
    
    # Log detailed results with both raw and adjusted probabilities
    logger.warning(f"MONTE CARLO RESULTS:")
    logger.warning(f"  Raw Probability of Profit: {raw_probability:.4f} ({raw_probability*100:.1f}%)")
    logger.warning(f"  Adjusted Probability of Profit: {probability_of_profit:.4f} ({probability_of_profit*100:.1f}%)")
    logger.warning(f"  Expected Profit: ${average_profit:.2f}")
    logger.warning(f"  Max Profit (75th percentile): ${max_profit:.2f}")
    logger.warning(f"  Return on Risk: {return_on_risk:.4f} ({return_on_risk*100:.1f}%)")
    logger.warning(f"  Max Return: {max_return:.4f} ({max_return*100:.1f}%)")
    
    # Calculate percentiles for more detailed analysis
    percentiles = [25, 50, 75, 90]
    percentile_values = {p: np.percentile(profit_outcomes, p) for p in percentiles}
    
    logger.warning(f"  Profit Percentiles:")
    for p, value in percentile_values.items():
        logger.warning(f"    {p}th percentile: ${value:.2f}")
    
    return {
        'probability_of_profit': probability_of_profit,
        'raw_probability': raw_probability,
        'expected_profit': average_profit,
        'max_profit': max_profit,
        'return_on_risk': return_on_risk,
        'max_return': max_return,
        'percentiles': {str(p): float(v) for p, v in percentile_values.items()},
        'numSimulations': num_simulations  # Include the number of simulations
    }


def calculate_realistic_spread_impact(front_option, back_option, spread_cost):
    """Calculate a more realistic assessment of spread impact"""
    # Calculate bid-ask spread in dollars for each leg
    front_spread = front_option['ask'] - front_option['bid']
    back_spread = back_option['ask'] - back_option['bid']
    
    # Calculate effective spread cost (what you'd actually pay vs mid price)
    # Factor in market dynamics - you'll likely pay more than mid price
    effective_front_cost = front_option['ask'] * 0.8 + front_option['bid'] * 0.2  # 80/20 weighted
    effective_back_cost = back_option['ask'] * 0.7 + back_option['bid'] * 0.3  # 70/30 weighted
    
    # Actual spread cost in practice
    actual_spread_cost = effective_back_cost - effective_front_cost
    
    # Calculate spread impact
    # This is what percentage of theoretical edge is lost to execution costs
    theoretical_edge = spread_cost
    execution_cost = actual_spread_cost - spread_cost
    
    # Impact as percentage of theoretical edge
    if theoretical_edge > 0:
        spread_impact = min(1.0, max(0, execution_cost / theoretical_edge))
        return spread_impact * 100  # Convert to percentage
    else:
        return 100  # 100% impact if no theoretical edge


def model_iv_crush_earnings(front_iv, back_iv, days_to_front_exp, ticker=None):
    """Model IV crush around earnings more accurately"""
    # Historical IV crush patterns if available (but use defaults if not)
    historical_crush = {
        'high_iv_stocks': 0.6,       # High IV stocks crush by 60%
        'medium_iv_stocks': 0.5,     # Medium IV stocks crush by 50%
        'low_iv_stocks': 0.4,        # Low IV stocks crush by 40%
        'default': 0.5               # Default 50% crush
    }
    
    # Determine IV category based on the front month IV
    if front_iv > 0.8:
        category = 'high_iv_stocks'
    elif front_iv > 0.4:
        category = 'medium_iv_stocks'
    else:
        category = 'low_iv_stocks'
    
    # Get the appropriate crush factor
    crush_factor = historical_crush[category]
    
    # Adjust for days to expiration - crush is more severe closer to event
    if days_to_front_exp < 3:
        crush_factor *= 1.2  # 20% more severe if very close to earnings
    elif days_to_front_exp > 14:
        crush_factor *= 0.8  # 20% less severe if far from earnings
    
    # Calculate expected post-earnings IVs
    expected_front_iv = front_iv * (1 - crush_factor)
    
    # Back month also crushes but less severely (roughly half the effect)
    back_crush_factor = crush_factor * 0.5
    expected_back_iv = back_iv * (1 - back_crush_factor)
    
    return {
        'pre_earnings_front_iv': front_iv,
        'pre_earnings_back_iv': back_iv,
        'post_earnings_front_iv': expected_front_iv,
        'post_earnings_back_iv': expected_back_iv,
        'iv_crush_amount': {
            'front': front_iv - expected_front_iv,
            'back': back_iv - expected_back_iv
        }
    }


def analyze_options(ticker, run_full_analysis=False, strategy_type=None, earnings_date=None):
    """
    Analyze options data for a given ticker and provide a recommendation.
    
    Args:
        ticker (str): Stock ticker symbol
        run_full_analysis (bool): Whether to run full strategy analysis
        strategy_type (str, optional): Type of strategy to analyze ('calendar', 'naked', 'ironCondor')
        earnings_date (str, optional): Earnings date in YYYY-MM-DD format for earnings-optimized analysis
        
    Returns:
        dict: Analysis results including metrics and recommendation
        
    Raises:
        ValueError: If there's an issue with the data or analysis
    """
    from app.utils import convert_numpy_types
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
        
        # Filter out pre-earnings expirations if earnings_date is provided
        earnings_date_obj = None
        if earnings_date:
            try:
                earnings_date_obj = datetime.strptime(earnings_date, "%Y-%m-%d").date()
                logger.info(f"Filtering expirations for earnings date: {earnings_date}")
            except ValueError:
                logger.warning(f"Invalid earnings date format: {earnings_date}, using all expirations")
        
        for exp_date, iv in atm_iv.items():
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_expiry = (exp_date_obj - today).days
            
            # Skip expirations that occur before earnings date
            if earnings_date_obj and exp_date_obj < earnings_date_obj:
                logger.info(f"Skipping pre-earnings expiration: {exp_date} (earnings: {earnings_date})")
                continue
                
            dtes.append(days_to_expiry)
            ivs.append(iv)
        
        # Ensure we have at least 2 data points for term structure
        if len(dtes) < 2:
            logger.warning(f"Insufficient post-earnings expirations ({len(dtes)}) for term structure calculation")
            # Fall back to using all available expirations if we don't have enough post-earnings data
            dtes = []
            ivs = []
            for exp_date, iv in atm_iv.items():
                exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
                days_to_expiry = (exp_date_obj - today).days
                dtes.append(days_to_expiry)
                ivs.append(iv)
        
        term_spline = build_term_structure(dtes, ivs)
        
        # Calculate metrics - use earnings-adjusted calculation
        if len(dtes) >= 2:
            # Sort dtes to ensure we use the shortest post-earnings expiration
            sorted_indices = sorted(range(len(dtes)), key=lambda i: dtes[i])
            shortest_dte = dtes[sorted_indices[0]]
            
            # Calculate slope from shortest post-earnings expiration to 45 days
            ts_slope_0_45 = (term_spline(45) - term_spline(shortest_dte)) / (45 - shortest_dte)
            
            logger.info(f"TS Slope calculation: shortest_dte={shortest_dte}, "
                       f"IV@{shortest_dte}={term_spline(shortest_dte):.4f}, "
                       f"IV@45={term_spline(45):.4f}, slope={ts_slope_0_45:.6f}")
        else:
            ts_slope_0_45 = -0.005  # Default fallback
        
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
                "avgVolumePass": str(avg_volume_pass).lower(),  # Convert to string "true" or "false"
                "iv30Rv30": float(iv30_rv30),
                "iv30Rv30Pass": str(iv30_rv30_pass).lower(),  # Convert to string "true" or "false"
                "tsSlope": float(ts_slope_0_45),
                "tsSlopePass": str(ts_slope_pass).lower()  # Convert to string "true" or "false"
            },
            "expectedMove": expected_move_str,
            "recommendation": recommendation,
            "timestamp": datetime.now().timestamp()
        }
        
        # Calculate basic liquidity score for screener display (using improved calculation)
        try:
            # Get the first available expiration for liquidity calculation
            if options_chains:
                first_exp = list(options_chains.keys())[0]
                chain = options_chains[first_exp]
                
                # Find ATM strike for liquidity calculation
                calls = chain.calls
                if not calls.empty:
                    call_diffs = (calls['strike'] - underlying_price).abs()
                    atm_idx = call_diffs.idxmin()
                    atm_option = calls.loc[atm_idx].to_dict()
                    
                    # Use the improved liquidity calculation
                    liquidity_result = get_improved_liquidity_score(
                        atm_option,
                        underlying_price
                    )
                    result["liquidity"] = liquidity_result["score"]
                else:
                    result["liquidity"] = 5.0  # Default fallback
            else:
                result["liquidity"] = 5.0  # Default fallback
        except Exception as e:
            logger.warning(f"Error calculating liquidity score for {ticker}: {str(e)}")
            result["liquidity"] = 5.0  # Default fallback
        
        # For scan optimization, we'll only run full analysis when requested
        if run_full_analysis:
            # Run full analysis for the requested strategy type
            if strategy_type == 'calendar' or strategy_type is None:
                logger.info(f"Running full calendar spread analysis for {ticker}")
                logger.warning(f"ANALYZE OPTIONS DEBUG: run_full_analysis={run_full_analysis}")
                all_metrics_pass = avg_volume_pass and iv30_rv30_pass and ts_slope_pass
                
                # Use provided earnings date or try to fetch it
                analysis_earnings_date = earnings_date
                if analysis_earnings_date:
                    logger.info(f"Using provided earnings date for {ticker}: {analysis_earnings_date} - using earnings-optimized calendar spread analysis")
                else:
                    # Fallback: try to get earnings date if not provided
                    analysis_earnings_date = get_next_earnings_date(ticker)
                    if analysis_earnings_date:
                        logger.info(f"Found earnings date for {ticker}: {analysis_earnings_date} - using earnings-optimized calendar spread analysis")
                    else:
                        logger.info(f"No earnings date found for {ticker} - using standard calendar spread analysis")
                
                optimal_spread = find_optimal_calendar_spread(ticker, all_metrics_pass=all_metrics_pass, run_full_analysis=run_full_analysis, earnings_date=analysis_earnings_date)
                if optimal_spread:
                    # Add debug logging to see if monteCarloResults.numSimulations is present
                    if "monteCarloResults" in optimal_spread:
                        logger.warning(f"MONTE CARLO DEBUG: optimal_spread has monteCarloResults with numSimulations={optimal_spread['monteCarloResults'].get('numSimulations')}")
                    else:
                        logger.warning("MONTE CARLO DEBUG: optimal_spread does not have monteCarloResults")
                    
                    result["optimalCalendarSpread"] = optimal_spread
            
            if strategy_type == 'naked' or strategy_type is None:
                logger.info(f"Running full naked options analysis for {ticker}")
                optimal_naked = find_optimal_naked_options(ticker)
                if optimal_naked:
                    logger.info(f"Found optimal naked options with {len(optimal_naked.get('topOptions', []))} options")
                    result["optimalNakedOptions"] = optimal_naked
            
            if strategy_type == 'ironCondor' or strategy_type is None:
                logger.info(f"ANALYSIS STEP: Running full iron condor analysis for {ticker}")
                iron_condor_start_time = datetime.now()
                
                try:
                    # Try to use the optimized implementation first
                    try:
                        from app.optimized_iron_condor import find_optimal_iron_condor as optimized_find_iron_condor
                        logger.info(f"IRON CONDOR: Using optimized implementation for {ticker}")
                        optimal_iron_condors = optimized_find_iron_condor(ticker, earnings_date)
                    except ImportError:
                        # Fall back to the original implementation
                        logger.info(f"IRON CONDOR: Using original implementation for {ticker}")
                        # Use more conservative parameters for direct searches to prevent timeouts
                        optimal_iron_condors = find_optimal_iron_condor(ticker, max_options=6, max_combinations=25, earnings_date=earnings_date)
                    
                    if optimal_iron_condors:
                        iron_condor_count = len(optimal_iron_condors.get('topIronCondors', []))
                        logger.info(f"IRON CONDOR SUCCESS: Found {iron_condor_count} optimal iron condors for {ticker}")
                        result["optimalIronCondors"] = optimal_iron_condors
                    else:
                        logger.info(f"IRON CONDOR: No suitable iron condors found for {ticker}")
                except Exception as e:
                    logger.error(f"IRON CONDOR ERROR: Error in find_optimal_iron_condor for {ticker}: {str(e)}")
                    import traceback
                    logger.error(f"IRON CONDOR ERROR: Traceback: {traceback.format_exc()}")
                
                # Log completion time
                iron_condor_duration = (datetime.now() - iron_condor_start_time).total_seconds()
                logger.info(f"IRON CONDOR TIMING: Analysis for {ticker} completed in {iron_condor_duration:.2f} seconds")
        
        # Convert any NumPy types to Python native types before returning
        return convert_numpy_types(result)
    
    except Exception as e:
        raise ValueError(f"Error analyzing options: {str(e)}")