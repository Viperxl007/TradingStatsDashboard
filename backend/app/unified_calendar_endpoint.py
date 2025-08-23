"""
Unified Calendar Spread Analysis Endpoint

This module provides a single, unified endpoint for calendar spread analysis
that combines spread cost calculation and liquidity scoring using consistent
strike selection logic.
"""

import logging
from flask import Blueprint, jsonify, request
from datetime import datetime
import yfinance as yf
import pandas as pd
import numpy as np
import json
from typing import Dict, Any

from app.strike_selector import create_strike_selector, StrikeSelectionError
from app.options_analyzer import get_improved_liquidity_score

logger = logging.getLogger(__name__)

def convert_for_json(obj):
    """
    Simple conversion for JSON serialization - don't overcomplicate it.
    """
    if hasattr(obj, 'item'):  # Handle numpy scalars
        return obj.item()
    elif isinstance(obj, dict):
        return {k: convert_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_for_json(v) for v in obj]
    return obj

# Create blueprint for unified calendar endpoints
unified_calendar_bp = Blueprint('unified_calendar', __name__)

def _perform_unified_calendar_analysis(ticker, current_price, earnings_date):
    """
    Core unified calendar analysis logic extracted from the route handler.
    This function performs the actual analysis without Flask request context.
    
    Args:
        ticker: Stock ticker symbol
        current_price: Current stock price
        earnings_date: Earnings date string (YYYY-MM-DD)
        
    Returns:
        Dict containing analysis results
        
    Raises:
        Exception: If analysis fails
    """
    logger.info(f"🎯 Starting unified calendar analysis for {ticker} at ${current_price} with earnings {earnings_date}")
    
    # Create unified strike selector
    try:
        strike_selector = create_strike_selector(ticker, current_price)
    except Exception as e:
        logger.error(f"Failed to create strike selector for {ticker}: {str(e)}")
        raise Exception(f'Failed to initialize options data for {ticker}: {str(e)}')
    
    # Find optimal calendar spread strikes using unified logic
    try:
        strike_info = strike_selector.find_calendar_spread_strikes(earnings_date)
    except StrikeSelectionError as e:
        logger.error(f"Strike selection failed for {ticker}: {str(e)}")
        raise Exception(f'Strike selection failed: {str(e)}')
    
    front_exp = strike_info['front_expiration']
    back_exp = strike_info['back_expiration']
    strike = strike_info['strike']
    option_type = strike_info['option_type']
    validation_info = strike_info['validation_info']
    
    logger.info(f"✅ Strike selection successful for {ticker}: ${strike} {option_type}, {front_exp} -> {back_exp}")
    
    # Calculate spread cost using the selected strikes
    try:
        spread_cost_result = calculate_spread_cost_unified(
            strike_selector, front_exp, back_exp, strike, option_type
        )
    except Exception as e:
        logger.error(f"Spread cost calculation failed for {ticker}: {str(e)}")
        raise Exception(f'Spread cost calculation failed: {str(e)}')
    
    # Calculate liquidity score using the same strikes
    try:
        liquidity_result = calculate_liquidity_score_unified(
            strike_selector, front_exp, back_exp, strike, option_type, current_price
        )
    except Exception as e:
        logger.error(f"Liquidity calculation failed for {ticker}: {str(e)}")
        # For CCEP and other problematic tickers, provide a fallback liquidity score
        logger.warning(f"Using fallback liquidity calculation for {ticker}")
        liquidity_result = {
            'liquidity_score': 5.0,  # Reasonable fallback score
            'liquidity_details': {
                'front_liquidity': {'score': 5.0, 'has_zero_bid': False, 'spread_dollars': 0.1},
                'back_liquidity': {'score': 5.0, 'has_zero_bid': False, 'spread_dollars': 0.1},
                'combined_calculation': 'Fallback calculation due to data issues',
                'has_zero_bids': False,
                'spread_impact': 0.1,
                'zero_bid_penalty_applied': False,
                'fallback_used': True
            }
        }
    
    # Combine results - include liquidity_details for backward compatibility
    result = {
        'success': True,
        'ticker': ticker,
        'current_price': float(current_price),
        'earnings_date': earnings_date,
        
        # Strike selection info
        'front_expiration': front_exp,
        'back_expiration': back_exp,
        'strike': float(strike),
        'option_type': option_type,
        
        # Spread cost results
        'spread_cost': float(spread_cost_result['spread_cost']),
        
        # Liquidity results
        'liquidity_score': float(liquidity_result['liquidity_score']),
        'liquidity_details': liquidity_result['liquidity_details'],
        
        # Combined analysis
        'analysis_timestamp': datetime.now().isoformat(),
        'data_quality': {
            'strike_distance_pct': float(validation_info['distance_from_atm_pct']),
            'common_strikes_available': int(validation_info['common_strikes_count']),
            'both_legs_validated': bool(validation_info['front_validated']) and bool(validation_info['back_validated'])
        }
    }
    
    logger.info(f"🎉 Unified calendar analysis completed for {ticker}:")
    logger.info(f"   Spread Cost: ${spread_cost_result['spread_cost']:.2f}")
    logger.info(f"   Liquidity Score: {liquidity_result['liquidity_score']:.2f}")
    logger.info(f"   Strike: ${strike} {option_type}")
    
    return result


@unified_calendar_bp.route('/api/calendar-analysis/<ticker>', methods=['POST'])
def unified_calendar_analysis(ticker):
    """
    Unified calendar spread analysis endpoint that provides both spread cost
    and liquidity analysis using consistent strike selection.
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        current_price = data.get('current_price')
        earnings_date = data.get('earnings_date')
        
        if not current_price or not earnings_date:
            return jsonify({'error': 'current_price and earnings_date are required'}), 400
        
        # Perform the core analysis using the extracted function
        try:
            result = _perform_unified_calendar_analysis(ticker, current_price, earnings_date)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        
        # Try to serialize the result and handle any remaining JSON issues
        try:
            return jsonify(result), 200
        except TypeError as json_error:
            logger.error(f"JSON serialization error for {ticker}: {str(json_error)}")
            logger.error(f"Problematic result keys: {list(result.keys())}")
            
            # Create a safe fallback response
            safe_result = {
                'success': True,
                'ticker': ticker,
                'current_price': float(current_price),
                'earnings_date': earnings_date,
                'front_expiration': result.get('front_expiration', ''),
                'back_expiration': result.get('back_expiration', ''),
                'strike': float(result.get('strike', 0)),
                'option_type': result.get('option_type', ''),
                'spread_cost': float(result.get('spread_cost', 0)),
                'liquidity_score': float(result.get('liquidity_score', 0)),
                'analysis_timestamp': datetime.now().isoformat(),
                'data_quality': result.get('data_quality', {}),
                'warning': 'Some detailed data omitted due to serialization issues'
            }
            
            return jsonify(safe_result), 200
        
    except Exception as e:
        logger.error(f"Unified calendar analysis failed for {ticker}: {str(e)}")
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500


def calculate_spread_cost_unified(strike_selector, front_exp, back_exp, strike, option_type):
    """
    Calculate spread cost using unified strike selection results.
    
    Args:
        strike_selector: UnifiedStrikeSelector instance
        front_exp: Front month expiration
        back_exp: Back month expiration
        strike: Selected strike price
        option_type: 'call' or 'put'
        
    Returns:
        Dict with spread_cost and pricing_details
    """
    try:
        # Get option chains for both months
        front_calls, front_puts = strike_selector.get_options_chain(front_exp)
        back_calls, back_puts = strike_selector.get_options_chain(back_exp)
        
        # Select the appropriate option type
        if option_type == 'call':
            front_options = front_calls[front_calls['strike'] == strike]
            back_options = back_calls[back_calls['strike'] == strike]
        else:
            front_options = front_puts[front_puts['strike'] == strike]
            back_options = back_puts[back_puts['strike'] == strike]
        
        if front_options.empty or back_options.empty:
            raise ValueError(f"No {option_type} options found at strike ${strike}")
        
        # Get pricing data
        front_option = front_options.iloc[0]
        back_option = back_options.iloc[0]
        
        # Calculate mid prices with enhanced validation
        front_bid = front_option['bid']
        front_ask = front_option['ask']
        back_bid = back_option['bid']
        back_ask = back_option['ask']
        
        # Validate bid/ask data quality
        def is_valid_price(price):
            return price is not None and price > 0 and not pd.isna(price)
        
        front_bid_valid = is_valid_price(front_bid)
        front_ask_valid = is_valid_price(front_ask)
        back_bid_valid = is_valid_price(back_bid)
        back_ask_valid = is_valid_price(back_ask)
        
        # Log pricing data quality
        logger.info(f"📊 Pricing quality - Front: bid={front_bid}({front_bid_valid}), ask={front_ask}({front_ask_valid})")
        logger.info(f"📊 Pricing quality - Back: bid={back_bid}({back_bid_valid}), ask={back_ask}({back_ask_valid})")
        
        # Calculate mid prices with fallbacks
        if front_bid_valid and front_ask_valid and front_ask >= front_bid:
            front_mid = (front_bid + front_ask) / 2.0
        elif front_ask_valid:
            front_mid = front_ask
            logger.warning(f"Using front ask price only: ${front_ask}")
        elif front_bid_valid:
            front_mid = front_bid
            logger.warning(f"Using front bid price only: ${front_bid}")
        else:
            raise ValueError(f"No valid front month prices at strike ${strike}")
        
        if back_bid_valid and back_ask_valid and back_ask >= back_bid:
            back_mid = (back_bid + back_ask) / 2.0
        elif back_ask_valid:
            back_mid = back_ask
            logger.warning(f"Using back ask price only: ${back_ask}")
        elif back_bid_valid:
            back_mid = back_bid
            logger.warning(f"Using back bid price only: ${back_bid}")
        else:
            raise ValueError(f"No valid back month prices at strike ${strike}")
        
        # Calendar spread cost = back month price - front month price
        spread_cost = back_mid - front_mid
        
        # Validate spread cost
        if spread_cost <= 0:
            raise ValueError(f"Invalid spread cost: ${spread_cost:.2f} (back=${back_mid:.2f}, front=${front_mid:.2f})")
        
        # Check for unreasonably high spread cost
        if spread_cost > strike_selector.current_price * 0.5:
            raise ValueError(f"Unreasonably high spread cost: ${spread_cost:.2f} (stock price: ${strike_selector.current_price})")
        
        pricing_details = {
            'front_bid': front_bid,
            'front_ask': front_ask,
            'front_mid': front_mid,
            'back_bid': back_bid,
            'back_ask': back_ask,
            'back_mid': back_mid,
            'front_bid_valid': front_bid_valid,
            'front_ask_valid': front_ask_valid,
            'back_bid_valid': back_bid_valid,
            'back_ask_valid': back_ask_valid,
            'spread_calculation': f"${back_mid:.2f} - ${front_mid:.2f} = ${spread_cost:.2f}"
        }
        
        return {
            'spread_cost': round(spread_cost, 2),
            'pricing_details': pricing_details
        }
        
    except Exception as e:
        logger.error(f"Spread cost calculation error: {str(e)}")
        raise


def calculate_liquidity_score_unified(strike_selector, front_exp, back_exp, strike, option_type, current_price):
    """
    Calculate liquidity score using unified strike selection results.
    
    Args:
        strike_selector: UnifiedStrikeSelector instance
        front_exp: Front month expiration
        back_exp: Back month expiration
        strike: Selected strike price
        option_type: 'call' or 'put'
        current_price: Current stock price
        
    Returns:
        Dict with liquidity_score and liquidity_details
    """
    try:
        # Get option chains for both months
        front_calls, front_puts = strike_selector.get_options_chain(front_exp)
        back_calls, back_puts = strike_selector.get_options_chain(back_exp)
        
        # Select the appropriate option type
        if option_type == 'call':
            front_options = front_calls[front_calls['strike'] == strike]
            back_options = back_calls[back_calls['strike'] == strike]
        else:
            front_options = front_puts[front_puts['strike'] == strike]
            back_options = back_puts[back_puts['strike'] == strike]
        
        if front_options.empty or back_options.empty:
            raise ValueError(f"No {option_type} options found at strike ${strike} for liquidity calculation")
        
        # Convert to dict for improved liquidity calculation
        front_option = front_options.iloc[0].to_dict()
        back_option = back_options.iloc[0].to_dict()
        
        # Calculate liquidity scores for both legs
        front_liquidity = get_improved_liquidity_score(front_option, current_price)
        back_liquidity = get_improved_liquidity_score(back_option, current_price)
        
        # Calculate spread cost for liquidity impact calculation
        try:
            front_mid = (front_option['bid'] + front_option['ask']) / 2.0
            back_mid = (back_option['bid'] + back_option['ask']) / 2.0
            spread_cost = back_mid - front_mid
            
            if spread_cost <= 0:
                spread_cost = 1.0  # Fallback for invalid spreads
        except:
            spread_cost = 1.0  # Fallback if calculation fails
        
        # Calculate combined liquidity score
        # Front month is more important (60%) since it's harder to exit
        combined_score = front_liquidity['score'] * 0.6 + back_liquidity['score'] * 0.4
        
        # Apply penalty for zero bids (real liquidity issue)
        has_zero_bids = front_liquidity.get('has_zero_bid', False) or back_liquidity.get('has_zero_bid', False)
        if has_zero_bids:
            combined_score *= 0.7  # 30% penalty for zero bids
        
        liquidity_details = {
            'front_liquidity': front_liquidity,
            'back_liquidity': back_liquidity,
            'combined_calculation': f"({front_liquidity['score']:.2f} * 0.6) + ({back_liquidity['score']:.2f} * 0.4) = {combined_score:.2f}",
            'has_zero_bids': has_zero_bids,
            'spread_impact': (front_liquidity['spread_dollars'] + back_liquidity['spread_dollars']) / spread_cost,
            'zero_bid_penalty_applied': has_zero_bids
        }
        
        return {
            'liquidity_score': combined_score,
            'liquidity_details': liquidity_details
        }
        
    except Exception as e:
        logger.error(f"Liquidity calculation error: {str(e)}")
        raise


# Backward compatibility endpoints that use the core analysis function
@unified_calendar_bp.route('/api/spread-cost/calendar/<ticker>', methods=['POST'])
def spread_cost_compatibility(ticker):
    """
    Backward compatibility endpoint for spread cost calculation.
    Uses the core unified analysis function and returns only spread cost data.
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        current_price = data.get('current_price')
        earnings_date = data.get('earnings_date')
        
        if not current_price or not earnings_date:
            return jsonify({'error': 'current_price and earnings_date are required'}), 400
        
        # Use the core analysis function directly (no recursion)
        try:
            result = _perform_unified_calendar_analysis(ticker, current_price, earnings_date)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        
        # Return only spread cost related data for backward compatibility
        return jsonify({
            'spread_cost': result['spread_cost'],
            'front_expiration': result['front_expiration'],
            'back_expiration': result['back_expiration'],
            'strike': result['strike'],
            'option_type': result['option_type'],
            'ticker': result['ticker']
        }), 200
        
    except Exception as e:
        logger.error(f"Spread cost compatibility endpoint failed for {ticker}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@unified_calendar_bp.route('/api/liquidity/calendar/<ticker>', methods=['POST'])
def liquidity_compatibility(ticker):
    """
    Backward compatibility endpoint for liquidity calculation.
    Uses the core unified analysis function and returns only liquidity data.
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        current_price = data.get('current_price')
        earnings_date = data.get('earnings_date')
        
        if not current_price or not earnings_date:
            return jsonify({'error': 'current_price and earnings_date are required'}), 400
        
        # Use the core analysis function directly (no recursion)
        try:
            result = _perform_unified_calendar_analysis(ticker, current_price, earnings_date)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        
        # Check if liquidity_details exists
        if 'liquidity_details' not in result:
            logger.error(f"liquidity_details missing from unified response for {ticker}. Available keys: {list(result.keys())}")
            return jsonify({'error': 'liquidity_details missing from response'}), 500
        
        liquidity_details = result['liquidity_details']
        
        # Return only liquidity related data for backward compatibility
        return jsonify({
            'liquidity_score': result['liquidity_score'],
            'front_expiration': result['front_expiration'],
            'back_expiration': result['back_expiration'],
            'strike': result['strike'],
            'option_type': result['option_type'],
            'front_liquidity': liquidity_details.get('front_liquidity', {}),
            'back_liquidity': liquidity_details.get('back_liquidity', {}),
            'spread_impact': liquidity_details.get('spread_impact', 0),
            'has_zero_bids': liquidity_details.get('has_zero_bids', False)
        }), 200
        
    except Exception as e:
        logger.error(f"Liquidity compatibility endpoint failed for {ticker}: {str(e)}")
        return jsonify({'error': str(e)}), 500