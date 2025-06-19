"""
Optimized Iron Condor Calculator

This module provides an optimized implementation of the iron condor calculation
to prevent API rate limit issues while maintaining the same functionality.
"""

import logging
import time
import numpy as np
from datetime import datetime, timedelta
from functools import lru_cache
import concurrent.futures
from typing import Dict, List, Any, Optional, Tuple

# Import from existing modules
from app.options_analyzer import (
    get_stock_data, get_current_price, calculate_option_greeks,
    get_iv30_rv30_ratio, get_term_structure_slope,
    calculate_simplified_enhanced_probability
)

# Set up logging
logger = logging.getLogger(__name__)

# Create a cache for liquidity scores to avoid redundant API calls
# Temporarily disable cache to ensure latest liquidity improvements are used
# @lru_cache(maxsize=1000)  # Commented out to force fresh calculations
def cached_get_liquidity_score(ticker: str, expiration: str, strike: float, option_type: str) -> Dict[str, Any]:
    """
    Cached version of get_liquidity_score to avoid redundant API calls.
    
    Args:
        ticker (str): Stock ticker symbol
        expiration (str): Option expiration date in YYYY-MM-DD format
        strike (float): Strike price
        option_type (str): 'call' or 'put'
        
    Returns:
        dict: Liquidity details
    """
    # Import here to avoid circular imports
    from app.options_analyzer import get_liquidity_score
    
    # Get stock data
    stock = get_stock_data(ticker)
    if not stock:
        return {
            'score': 0.0,
            'spread_pct': 1.0,
            'volume': 0,
            'open_interest': 0,
            'has_zero_bid': True
        }
    
    # Add retry logic with exponential backoff
    max_retries = 5  # Increased from 3 to 5
    retry_delay = 2  # Increased from 1 to 2 seconds
    
    for attempt in range(max_retries):
        try:
            result = get_liquidity_score(stock, expiration, strike, option_type)
            return result
        except Exception as e:
            if "Too Many Requests" in str(e) and attempt < max_retries - 1:
                # Exponential backoff
                # More aggressive exponential backoff with jitter
                import random
                sleep_time = retry_delay * (2 ** attempt) + random.uniform(0.1, 1.0)
                logger.warning(f"Rate limited when getting liquidity score for {ticker} {expiration} {strike} {option_type}. Retrying in {sleep_time}s...")
                time.sleep(sleep_time)
            else:
                logger.error(f"Error getting liquidity score: {str(e)}")
                return {
                    'score': 0.0,
                    'spread_pct': 1.0,
                    'volume': 0,
                    'open_interest': 0,
                    'has_zero_bid': True
                }

def prefilter_options(calls, puts, current_price, min_short_delta=0.10, max_short_delta=0.45, max_options=6):
    """
    Prefilter options to reduce the number of combinations to evaluate.
    
    Args:
        calls (DataFrame): Call options data
        puts (DataFrame): Put options data
        current_price (float): Current stock price
        min_short_delta (float): Minimum delta for short options
        max_short_delta (float): Maximum delta for short options
        max_options (int): Maximum number of options to consider
        
    Returns:
        tuple: (filtered_calls, filtered_puts)
    """
    # Filter for OTM options
    otm_calls = calls[calls['strike'] > current_price]
    otm_puts = puts[puts['strike'] < current_price]
    
    if otm_calls.empty or otm_puts.empty:
        return otm_calls, otm_puts
    
    # Sort by distance from current price
    otm_calls = otm_calls.sort_values('strike')
    otm_puts = otm_puts.sort_values('strike', ascending=False)
    
    # Limit the number of options to evaluate
    otm_calls = otm_calls.head(min(len(otm_calls), max_options))
    otm_puts = otm_puts.head(min(len(otm_puts), max_options))
    
    return otm_calls, otm_puts

def batch_fetch_liquidity_scores(ticker, expiration, options, option_type):
    """
    Fetch liquidity scores for multiple options in batches to avoid rate limits.
    
    Args:
        ticker (str): Stock ticker symbol
        expiration (str): Option expiration date
        options (DataFrame): Options data
        option_type (str): 'call' or 'put'
        
    Returns:
        dict: Dictionary mapping strike prices to liquidity scores
    """
    liquidity_scores = {}
    
    # Process in smaller batches with longer delays between batches
    batch_size = 2  # Reduced from 3 to 2
    delay_between_batches = 2  # Increased from 1 to 2 seconds
    
    strikes = options['strike'].unique()
    
    for i in range(0, len(strikes), batch_size):
        batch = strikes[i:i+batch_size]
        
        # Process batch
        for strike in batch:
            liquidity_scores[strike] = cached_get_liquidity_score(ticker, expiration, strike, option_type)
        
        # Add delay between batches to avoid rate limits
        # Always add a delay between batches, even for the last batch
        time.sleep(delay_between_batches)
    
    return liquidity_scores

def find_optimal_iron_condor(ticker, earnings_date=None):
    """
    Find the optimal iron condor for a given ticker with optimized API usage.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict or None: Details of the optimal iron condor, or None if no worthwhile iron condor is found
    """
    logger.info(f"IRON CONDOR DEBUG: Starting optimized search for {ticker}")
    
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) == 0:
            logger.warning(f"IRON CONDOR DEBUG: No options data found for {ticker}")
            return None
        
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            logger.warning(f"IRON CONDOR DEBUG: Could not get current price for {ticker}")
            return None
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} current price: ${current_price}")
        
        # Get expiration dates
        exp_dates = stock.options
        if not exp_dates:
            logger.warning(f"IRON CONDOR DEBUG: No expiration dates found for {ticker}")
            return None
        
        # Convert to datetime objects for sorting
        date_objs = [datetime.strptime(date, "%Y-%m-%d").date() for date in exp_dates]
        sorted_dates = sorted(date_objs)
        
        # Filter for dates in the future
        today = datetime.today().date()
        future_dates = [d for d in sorted_dates if d > today]
        
        if not future_dates:
            logger.warning(f"IRON CONDOR DEBUG: No future expiration dates found for {ticker}")
            return None
        
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
            
            if calls.empty or puts.empty:
                logger.warning(f"IRON CONDOR DEBUG: No options data found for {ticker} on {target_exp_str}")
                return None
        except Exception as e:
            logger.error(f"IRON CONDOR DEBUG: Error getting options chain for {ticker} on {target_exp_str}: {str(e)}")
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
        
        # Define target delta range for short options
        min_short_delta = 0.10
        max_short_delta = 0.45
        
        # Prefilter options to reduce the number of combinations
        # Use a smaller max_options value to reduce API calls
        otm_calls, otm_puts = prefilter_options(
            calls, puts, current_price, 
            min_short_delta, max_short_delta, 
            max_options=6  # Reduced from 8 to 6 for direct searches
        )
        
        if otm_calls.empty or otm_puts.empty:
            logger.warning(f"IRON CONDOR DEBUG: Not enough OTM options for {ticker}")
            return None
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} Evaluating {len(otm_calls)} call options and {len(otm_puts)} put options")
        
        # Pre-fetch liquidity scores for all options to avoid redundant API calls
        logger.info(f"IRON CONDOR DEBUG: {ticker} Pre-fetching liquidity scores for all options (reduced set)")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Using aggressive filtering: only {len(otm_calls)} calls and {len(otm_puts)} puts")
        
        call_liquidity_scores = batch_fetch_liquidity_scores(ticker, target_exp_str, otm_calls, 'call')
        put_liquidity_scores = batch_fetch_liquidity_scores(ticker, target_exp_str, otm_puts, 'put')
        
        # Calculate time to expiration in years
        time_to_expiry = days_to_expiration / 365.0
        
        # Use a standard risk-free rate
        risk_free_rate = 0.05
        
        # Define function to evaluate a single iron condor
        def evaluate_iron_condor(call_short_idx, call_long_idx, put_short_idx, put_long_idx):
            try:
                # Get option details
                call_short = otm_calls.iloc[call_short_idx]
                call_long = otm_calls.iloc[call_long_idx]
                put_short = otm_puts.iloc[put_long_idx]  # Lower strike (further OTM)
                put_long = otm_puts.iloc[put_short_idx]  # Higher strike (closer to money)
                
                # Get strikes
                call_short_strike = call_short['strike']
                call_long_strike = call_long['strike']
                put_short_strike = put_short['strike']
                put_long_strike = put_long['strike']
                
                # Check if strikes are in correct order
                if not (put_long_strike < put_short_strike < current_price < call_short_strike < call_long_strike):
                    return None
                
                # Get liquidity scores from pre-fetched data
                call_short_liquidity = call_liquidity_scores.get(call_short_strike, {'score': 0.0})
                call_long_liquidity = call_liquidity_scores.get(call_long_strike, {'score': 0.0})
                put_short_liquidity = put_liquidity_scores.get(put_short_strike, {'score': 0.0})
                put_long_liquidity = put_liquidity_scores.get(put_long_strike, {'score': 0.0})
                
                # Calculate overall liquidity score
                overall_liquidity_score = (
                    call_short_liquidity.get('score', 0.0) * 0.35 +
                    put_short_liquidity.get('score', 0.0) * 0.35 +
                    call_long_liquidity.get('score', 0.0) * 0.15 +
                    put_long_liquidity.get('score', 0.0) * 0.15
                )
                
                # Flag for zero bids
                has_zero_bids = (
                    call_short_liquidity.get('has_zero_bid', True) or
                    call_long_liquidity.get('has_zero_bid', True) or
                    put_short_liquidity.get('has_zero_bid', True) or
                    put_long_liquidity.get('has_zero_bid', True)
                )
                
                # Calculate greeks for each option
                try:
                    # Get implied volatilities from options data
                    call_short_iv = call_short['impliedVolatility']
                    call_long_iv = call_long['impliedVolatility']
                    put_short_iv = put_short['impliedVolatility']
                    put_long_iv = put_long['impliedVolatility']
                    
                    # Calculate greeks for each option
                    call_short_greeks = calculate_option_greeks(
                        S=current_price,
                        K=call_short_strike,
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=call_short_iv,
                        option_type='call'
                    )
                    
                    call_long_greeks = calculate_option_greeks(
                        S=current_price,
                        K=call_long_strike,
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=call_long_iv,
                        option_type='call'
                    )
                    
                    put_short_greeks = calculate_option_greeks(
                        S=current_price,
                        K=put_short_strike,
                        T=time_to_expiry,
                        r=risk_free_rate,
                        sigma=put_short_iv,
                        option_type='put'
                    )
                    
                    put_long_greeks = calculate_option_greeks(
                        S=current_price,
                        K=put_long_strike,
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
                    
                except Exception as e:
                    # Fall back to API delta values if available
                    if 'delta' in call_short and 'delta' in call_long and 'delta' in put_short and 'delta' in put_long:
                        call_short_delta = abs(call_short['delta'])
                        call_long_delta = abs(call_long['delta'])
                        put_short_delta = abs(put_short['delta'])
                        put_long_delta = abs(put_long['delta'])
                    else:
                        return None
                
                # Check if deltas are within target range for short options
                if not (min_short_delta <= call_short_delta <= max_short_delta and 
                        min_short_delta <= put_short_delta <= max_short_delta):
                    return None
                
                # Check if options have appropriate delta relationship
                if not (call_long_delta <= call_short_delta * 1.1 and put_long_delta <= put_short_delta * 0.9):
                    return None
                
                # Calculate premiums
                call_short_premium = (call_short['bid'] + call_short['ask']) / 2 if call_short['bid'] > 0 and call_short['ask'] > 0 else call_short['ask'] * 0.8
                call_long_premium = (call_long['bid'] + call_long['ask']) / 2 if call_long['bid'] > 0 and call_long['ask'] > 0 else call_long['ask'] * 0.8
                put_short_premium = (put_short['bid'] + put_short['ask']) / 2 if put_short['bid'] > 0 and put_short['ask'] > 0 else put_short['ask'] * 0.8
                put_long_premium = (put_long['bid'] + put_long['ask']) / 2 if put_long['bid'] > 0 and put_long['ask'] > 0 else put_long['ask'] * 0.8
                
                # Check if we have valid premiums
                if call_short_premium <= 0 or call_long_premium <= 0 or put_short_premium <= 0 or put_long_premium <= 0:
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
                
                # Calculate standard probability of profit
                prob_profit = 1 - (call_short_delta + put_short_delta)
                
                # Get IV30/RV30 ratio and term structure slope for volatility crush calculation
                iv30_rv30 = get_iv30_rv30_ratio(ticker)
                ts_slope = get_term_structure_slope(ticker, earnings_date)
                
                # Calculate enhanced probability of profit
                enhanced_prob_profit = calculate_simplified_enhanced_probability(
                    prob_profit,
                    iv30_rv30,
                    ts_slope
                )
                
                # Calculate return on risk
                return_on_risk = net_credit / max_loss
                
                # Calculate score components
                premium_score = net_credit / current_price * 100
                width_score = 10 - (max_width / current_price * 100)
                delta_score = prob_profit * 10
                
                # Check if short strikes are outside expected move
                expected_move_upper = current_price + expected_move_dollars
                expected_move_lower = current_price - expected_move_dollars
                
                outside_expected_move = (call_short_strike > expected_move_upper and put_short_strike < expected_move_lower)
                expected_move_score = 10 if outside_expected_move else 5
                
                # Calculate composite score
                score = (
                    premium_score * 0.3 +
                    delta_score * 0.3 +
                    width_score * 0.2 +
                    expected_move_score * 0.1 +
                    (return_on_risk * 10) * 0.1
                )
                
                logger.info(f"IRON CONDOR DEBUG: {ticker} Evaluated iron condor - Score: {score:.2f}, Net Credit: ${net_credit:.2f}, Prob Profit: {prob_profit:.2%}")
                
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
                
                return result
            except Exception as e:
                logger.warning(f"IRON CONDOR DEBUG: Error evaluating iron condor: {str(e)}")
                return None
        
        # Find all possible iron condors
        iron_condors = []
        
        # Use a more efficient search strategy
        # Instead of evaluating all combinations, use a greedy approach
        # Start with the most promising combinations based on delta
        
        # Sort options by delta to prioritize the most promising combinations
        if 'delta' in otm_calls.columns and 'delta' in otm_puts.columns:
            otm_calls['abs_delta'] = otm_calls['delta'].abs()
            otm_puts['abs_delta'] = otm_puts['delta'].abs()
            
            # Sort calls by delta (ascending)
            otm_calls = otm_calls.sort_values('abs_delta')
            
            # Sort puts by delta (ascending)
            otm_puts = otm_puts.sort_values('abs_delta')
        
        # Evaluate combinations with a more efficient approach
        # Use a smaller number of combinations to reduce API calls
        # For direct searches (when full_analysis=true), we need to be even more conservative
        # to avoid timeouts and rate limits
        max_combinations = 25  # Reduced from 50 to prevent timeouts on direct searches
        
        combinations = []
        # Further reduce the search space for direct searches
        for call_short_idx in range(min(3, len(otm_calls) - 1)):
            for call_long_idx in range(call_short_idx + 1, min(call_short_idx + 2, len(otm_calls))):
                for put_short_idx in range(min(3, len(otm_puts) - 1)):
                    for put_long_idx in range(put_short_idx + 1, min(put_short_idx + 2, len(otm_puts))):
                        combinations.append((call_short_idx, call_long_idx, put_short_idx, put_long_idx))
                        if len(combinations) >= max_combinations:
                            break
                    if len(combinations) >= max_combinations:
                        break
                if len(combinations) >= max_combinations:
                    break
            if len(combinations) >= max_combinations:
                break
        
        logger.info(f"IRON CONDOR DEBUG: {ticker} Evaluating {len(combinations)} combinations (reduced from potential {len(otm_calls) * (len(otm_calls) - 1) * len(otm_puts) * (len(otm_puts) - 1) / 4})")
        logger.warning(f"IRON CONDOR DEBUG: {ticker} Using more aggressive optimization: evaluating only {len(combinations)} combinations")
        
        # Process combinations in batches to avoid rate limits
        batch_size = 5  # Reduced from 10 to prevent rate limits
        for i in range(0, len(combinations), batch_size):
            batch = combinations[i:i+batch_size]
            
            # Process batch
            for combo in batch:
                call_short_idx, call_long_idx, put_short_idx, put_long_idx = combo
                result = evaluate_iron_condor(call_short_idx, call_long_idx, put_short_idx, put_long_idx)
                if result:
                    iron_condors.append(result)
            
            # Add delay between batches to avoid rate limits
            if i + batch_size < len(combinations):
                time.sleep(1.5)  # Increased delay between batches
        
        if not iron_condors:
            logger.warning(f"IRON CONDOR DEBUG: No suitable iron condors found for {ticker}")
            return None
        
        # Sort iron condors by score (descending)
        iron_condors.sort(key=lambda x: x['score'], reverse=True)
        
        # Get the top iron condors
        top_iron_condors = iron_condors[:min(2, len(iron_condors))]  # Reduced from 3 to 2
        
        # Return the results
        return {
            "expectedMove": {
                "percent": float(expected_move_pct),
                "dollars": float(expected_move_dollars)
            },
            "daysToExpiration": days_to_expiration,
            "topIronCondors": top_iron_condors,
            "nextBestPlay": None  # Placeholder for future implementation
        }
    
    except Exception as e:
        logger.error(f"IRON CONDOR DEBUG: Error finding optimal iron condor: {str(e)}")
        return None