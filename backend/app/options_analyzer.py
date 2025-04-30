"""
Options Analyzer Module

This module contains the core analysis functions for options data.
Extracted and refactored from the original calculator.py file.
"""

import numpy as np
import logging
import concurrent.futures
from datetime import datetime, timedelta
from scipy.interpolate import interp1d
from app.data_fetcher import get_stock_data, get_options_data, get_current_price

# Set up logging
logger = logging.getLogger(__name__)

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
            return 0.0
        
        # Find the options with the given strike
        front_options = front_calls[front_calls['strike'] == strike]
        back_options = back_calls[back_calls['strike'] == strike]
        
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


def get_liquidity_score(stock, expiration, strike):
    """
    Calculate a liquidity score for an option.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration (str): Option expiration date in YYYY-MM-DD format
        strike (float): Strike price
        
    Returns:
        float: Liquidity score (higher is better)
    """
    try:
        chain = stock.option_chain(expiration)
        calls = chain.calls
        
        if calls.empty:
            return 0.0
        
        # Find the option with the given strike
        options = calls[calls['strike'] == strike]
        
        if options.empty:
            return 0.0
        
        option = options.iloc[0]
        
        # Calculate bid-ask spread as a percentage of the mid price
        bid = option['bid']
        ask = option['ask']
        
        if bid == 0 or ask == 0:
            return 0.0
        
        mid = (bid + ask) / 2.0
        spread_pct = (ask - bid) / mid
        
        # Volume and open interest factors
        volume = option['volume'] if 'volume' in option and option['volume'] > 0 else 1
        open_interest = option['openInterest'] if 'openInterest' in option and option['openInterest'] > 0 else 1
        
        # Liquidity score: inverse of spread percentage, weighted by volume and open interest
        # Normalize to a 0-10 scale where 10 is most liquid
        # Less punitive liquidity scoring - using square root instead of log10 for volume and open interest
        liquidity_score = (1 / spread_pct) * np.sqrt(volume) * np.sqrt(open_interest)
        
        # Cap and normalize
        return min(10.0, max(0.0, liquidity_score / 100.0))
    except Exception as e:
        return 0.0


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
            days_out, strike = params
            
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
                logger.debug(f"{ticker} strike ${strike}: Skipping due to missing IV data - front_iv: {front_iv}, back_iv: {back_iv}")
                return None
            
            # IV differential (front month should be higher)
            iv_differential = front_iv - back_iv
            
            # Allow small negative IV differentials (front month can be slightly lower)
            # Skip only if the differential is significantly negative
            if iv_differential < -0.1:
                logger.debug(f"{ticker} strike ${strike}: Skipping due to low IV differential: {iv_differential}")
                return None
            
            # Get pricing information
            spread_cost = calculate_spread_cost(stock, front_month, back_month, strike)
            
            # Skip if spread cost is invalid
            if spread_cost <= 0:
                logger.debug(f"{ticker} strike ${strike}: Skipping due to invalid spread cost: {spread_cost}")
                return None
            
            # Calculate liquidity metrics
            front_liquidity = get_liquidity_score(stock, front_month, strike)
            back_liquidity = get_liquidity_score(stock, back_month, strike)
            
            # Calculate a composite score
            score = calculate_spread_score(
                iv_differential,
                spread_cost,
                front_liquidity,
                back_liquidity,
                strike_distance_from_atm=abs(strike - current_price),
                days_between_expirations=days_between_expirations,
                days_to_front_expiration=days_to_front_expiration
            )
            
            logger.debug(f"{ticker} strike ${strike}, back month {back_month}: Calculated score: {score}")
            
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
                    'frontLiquidity': float(front_liquidity),
                    'backLiquidity': float(back_liquidity),
                    'daysBetweenExpirations': days_between_expirations,
                    'daysToFrontExpiration': days_to_front_expiration,
                    'score': float(score)
                }
            }
        
        # Get strikes near current price (using wider range)
        strikes = get_strikes_near_price(stock, front_month, current_price, range_percent=15)
        logger.info(f"{ticker} considering {len(strikes)} strikes near price: {strikes}")
        
        # Create a list of all combinations to evaluate
        combinations = [(days_out, strike) for days_out in back_month_exp_options for strike in strikes]
        
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
                        days_out, strike = future_to_combo[future]
                        logger.info(f"{ticker} strike ${strike}, days out {days_out}: New best score: {best_score}")
                except Exception as e:
                    days_out, strike = future_to_combo[future]
                    logger.warning(f"Error evaluating spread for {ticker} strike ${strike}, days out {days_out}: {str(e)}")
        
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
        
        return result
    
    except Exception as e:
        raise ValueError(f"Error analyzing options: {str(e)}")