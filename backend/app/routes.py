"""
API Routes Module

This module defines the API routes for the options earnings screener.
Merged from run_direct.py to provide unified Flask app flow.
"""

from flask import Blueprint, jsonify, request, Response
import logging
import concurrent.futures
import json
import sys
import os
import time
import threading
import queue
from functools import wraps
from datetime import datetime, timedelta
import yfinance as yf
import numpy as np
import pandas as pd

from app.options_analyzer import (
    analyze_options, filter_dates, find_closest_expiration,
    get_strikes_near_price, get_atm_iv, calculate_spread_cost,
    get_liquidity_score, calculate_spread_score, find_optimal_calendar_spread,
    yang_zhang, find_optimal_naked_options,
    find_optimal_iron_condor, monte_carlo_calendar_spread,
    calculate_calendar_probability, calculate_realistic_calendar_return
)
from app.earnings_calendar import (
    get_earnings_today, get_earnings_by_date, get_earnings_calendar,
    handle_pandas_dataframe
)
from app.data_fetcher import get_stock_info, get_current_price
from app.rate_limiter import update_rate_limiter_config, yf_rate_limiter, get_current_price
from .earnings_history import get_earnings_history, get_earnings_performance_stats
from .option_price_fetcher import fetch_specific_option_prices, validate_option_contracts

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

# Import earnings history functionality
try:
    from run_direct_earnings_history import register_earnings_history_endpoint
    logger.info("Loaded earnings history module")
except ImportError:
    logger.warning("run_direct_earnings_history.py not found, earnings history endpoint will not be available")
    register_earnings_history_endpoint = None

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see detailed logs

# Custom filter for naked options debug messages
class NakedOptionsFilter(logging.Filter):
    def filter(self, record):
        # Allow only start and end messages for naked options
        if "NAKED OPTIONS DEBUG:" in record.getMessage():
            msg = record.getMessage()
            return "Starting search for" in msg or "Returning naked options result" in msg
        return True

# Custom filter for earnings history warnings
class EarningsHistoryFilter(logging.Filter):
    def filter(self, record):
        # Filter out specific warnings about prev_close and next_close being Series
        if record.levelname == "WARNING" and "is a Series for" in record.getMessage():
            return False
        return True

# Apply filters to specific loggers
options_analyzer_logger = logging.getLogger('app.options_analyzer')
options_analyzer_logger.addFilter(NakedOptionsFilter())

earnings_history_logger = logging.getLogger('run_direct_earnings_history')
earnings_history_logger.addFilter(EarningsHistoryFilter())

# Create blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

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

def quick_filter_ticker(ticker_symbol):
    """
    Quickly filter a ticker based on price and volume to avoid processing low-quality candidates.
    
    Args:
        ticker_symbol (str): Stock ticker symbol
        
    Returns:
        bool: True if the ticker passes the filter, False otherwise
    """
    try:
        logger.info(f"Quick filtering ticker: {ticker_symbol}")
        
        # Get stock data
        stock = yf.Ticker(ticker_symbol)
        
        # Get current price and volume
        history = stock.history(period="1d")
        
        if history.empty:
            logger.warning(f"No price data for {ticker_symbol}")
            return False
            
        current_price = history['Close'].iloc[-1]
        avg_volume = history['Volume'].iloc[-1]
        
        # Check if price and volume meet minimum requirements
        price_pass = current_price >= QUICK_FILTER.get("min_price", 2.50)
        volume_pass = avg_volume >= QUICK_FILTER.get("min_volume", 1500000)
        
        logger.info(f"{ticker_symbol}: Price ${current_price:.2f} ({'PASS' if price_pass else 'FAIL'}), "
                   f"Volume {avg_volume:.0f} ({'PASS' if volume_pass else 'FAIL'})")
        
        return price_pass and volume_pass
    except Exception as e:
        logger.warning(f"Error in quick filter for {ticker_symbol}: {str(e)}")
        return False

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "timestamp": datetime.now().timestamp()})

@api_bp.route('/analyze/<ticker>', methods=['GET'])
def analyze_ticker(ticker):
    """Analyze options data for a given ticker."""
    try:
        # Check if a specific strategy analysis is requested
        strategy_type = request.args.get('strategy')
        run_full_analysis = request.args.get('full_analysis', 'false').lower() == 'true'
        earnings_date = request.args.get('earnings_date')
        
        # Add debug logging
        logger.warning(f"API DEBUG: /api/analyze/{ticker} called with full_analysis={request.args.get('full_analysis')}, parsed as run_full_analysis={run_full_analysis}, earnings_date={earnings_date}")
        
        # Run the analysis
        result = analyze_options(ticker, run_full_analysis=run_full_analysis, strategy_type=strategy_type, earnings_date=earnings_date)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error analyzing {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

def process_ticker(earning):
    """
    Process a single ticker from earnings data.
    
    Args:
        earning (dict): Earnings data for a ticker
        
    Returns:
        dict: Analysis results or error information, or None if ticker should be discarded
    """
    try:
        ticker = earning.get('ticker')
        if not ticker:
            return None
            
        # Apply quick filter to avoid processing low-quality candidates
        # Do this before any API calls to save resources
        if not quick_filter_ticker(ticker):
            logger.info(f"{ticker}: Failed quick filter, skipping")
            return {
                "ticker": ticker,
                "companyName": earning.get('companyName', ''),
                "reportTime": earning.get('reportTime', ''),
                "recommendation": "FILTERED OUT",
                "error": "Failed quick filter (price or volume too low)",
                "timestamp": datetime.now().timestamp()
            }
        
        # Check if we can get stock data - if not, immediately discard
        try:
            stock = yf.Ticker(ticker)
            history = stock.history(period="1d")
            if history.empty:
                logger.info(f"{ticker}: No price data available, skipping")
                return {
                    "ticker": ticker,
                    "companyName": earning.get('companyName', ''),
                    "reportTime": earning.get('reportTime', ''),
                    "recommendation": "FILTERED OUT",
                    "error": "No price data available",
                    "timestamp": datetime.now().timestamp()
                }
                
            # Check if options data is available
            if len(stock.options) == 0:
                logger.info(f"{ticker}: No options data available, skipping")
                return {
                    "ticker": ticker,
                    "companyName": earning.get('companyName', ''),
                    "reportTime": earning.get('reportTime', ''),
                    "recommendation": "FILTERED OUT",
                    "error": "No options data available",
                    "timestamp": datetime.now().timestamp()
                }
        except Exception as e:
            logger.info(f"{ticker}: Error fetching data, skipping: {str(e)}")
            return {
                "ticker": ticker,
                "companyName": earning.get('companyName', ''),
                "reportTime": earning.get('reportTime', ''),
                "recommendation": "FILTERED OUT",
                "error": f"Error fetching data: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }
            
        # Import strategy checker
        from app.strategy_checker import check_strategies_availability
        
        # Get earnings date from the earnings data
        earnings_date = earning.get('date', '')
        
        # Run basic analysis to get metrics and recommendation, passing earnings date
        analysis = analyze_options(ticker, earnings_date=earnings_date)
        
        # Check strategy availability instead of running full analysis
        strategy_availability = check_strategies_availability(ticker)
        
        # Add strategy availability to the analysis result
        analysis['strategyAvailability'] = strategy_availability
        
        # Add company name, report time, and earnings date from earnings data
        analysis['companyName'] = earning.get('companyName', '')
        analysis['reportTime'] = earning.get('reportTime', '')
        analysis['earningsDate'] = earnings_date
        
        return analysis
    except Exception as e:
        logger.error(f"Error processing {earning.get('ticker', 'unknown')}: {str(e)}")
        return {
            "ticker": earning.get('ticker', 'unknown'),
            "companyName": earning.get('companyName', ''),
            "reportTime": earning.get('reportTime', ''),
            "earningsDate": earning.get('date', ''),
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }

@api_bp.route('/scan/earnings', methods=['GET'])
def scan_earnings():
    """Scan stocks with earnings announcements for options analysis using sequential processing."""
    try:
        date_str = request.args.get('date')
        
        # Get earnings calendar
        try:
            if date_str:
                earnings = get_earnings_calendar(date_str)
            else:
                earnings = get_earnings_calendar()
                date_str = datetime.now().strftime('%Y-%m-%d')
        except Exception as e:
            logger.error(f"Error getting earnings calendar: {str(e)}")
            
            return jsonify({
                "error": "Earnings calendar data is not available. Please check your data source configuration.",
                "timestamp": datetime.now().timestamp()
            }), 503
        
        # Filter out earnings with no ticker
        valid_earnings = [earning for earning in earnings if earning.get('ticker')]
        
        # Use streaming response for better UX
        def generate():
            # Send initial event
            yield f"data: {json.dumps({'status': 'in_progress', 'progress': {'completed': 0, 'total': len(valid_earnings), 'percent': 0, 'filtered_out': 0, 'no_data': 0}})}\n\n"
            
            results = []
            filtered_out = 0
            no_data = 0
            
            # Process tickers sequentially
            for i, earning in enumerate(valid_earnings):
                ticker = earning.get('ticker')
                if not ticker:
                    continue
                    
                try:
                    # Process the ticker
                    result = process_ticker(earning)
                    
                    if result:
                        # Check if filtered out or no data
                        if result.get('recommendation') == 'FILTERED OUT':
                            filtered_out += 1
                        elif result.get('error') and 'No data' in result.get('error'):
                            no_data += 1
                        else:
                            # Add to results
                            results.append(result)
                        
                        # Calculate progress
                        completed = i + 1
                        percent = int((completed / len(valid_earnings)) * 100)
                        
                        # Yield progress event
                        progress_data = {
                            'status': 'in_progress',
                            'progress': {
                                'completed': completed,
                                'total': len(valid_earnings),
                                'percent': percent,
                                'filtered_out': filtered_out,
                                'no_data': no_data
                            }
                        }
                        
                        # Add partial results if available
                        if results:
                            progress_data['results'] = results
                            
                        yield f"data: {json.dumps(progress_data)}\n\n"
                except Exception as e:
                    logger.error(f"Error processing {ticker}: {str(e)}")
                    
                    # Yield error event
                    yield f"data: {json.dumps({'status': 'error', 'ticker': ticker, 'error': str(e)})}\n\n"
            
            # Yield complete event
            yield f"data: {json.dumps({'status': 'complete', 'results': results, 'count': len(results)})}\n\n"
        
        response = Response(generate(), mimetype='text/event-stream')
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Cache-Control', 'no-cache')
        response.headers.add('Connection', 'keep-alive')
        response.headers.add('X-Accel-Buffering', 'no')  # Disable buffering for Nginx
        return response
    except Exception as e:
        logger.error(f"Error scanning earnings: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/calendar/today', methods=['GET'])
def get_today_calendar():
    """
    Get today's earnings calendar.
    
    Returns:
        JSON: List of companies reporting earnings today
    """
    try:
        # Try to get real earnings data
        try:
            earnings = get_earnings_calendar()
            date_str = datetime.now().strftime('%Y-%m-%d')
        except Exception as e:
            logger.error(f"Error getting today's earnings calendar: {str(e)}")
            return jsonify({
                "error": "Earnings calendar data is not available. Please check your data source configuration.",
                "timestamp": datetime.now().timestamp()
            }), 503
        
        return jsonify({
            "date": date_str,
            "count": len(earnings),
            "earnings": earnings,
            "timestamp": datetime.now().timestamp()
        })
    except Exception as e:
        logger.error(f"Error getting today's earnings calendar: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/calendar/<date>', methods=['GET'])
def get_date_calendar(date):
    """
    Get earnings calendar for a specific date.
    
    Args:
        date (str): Date in YYYY-MM-DD format
        
    Returns:
        JSON: List of companies reporting earnings on the specified date
    """
    try:
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                "error": "Invalid date format. Use YYYY-MM-DD.",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        # Try to get real earnings data
        try:
            earnings = get_earnings_calendar(date)
        except Exception as e:
            logger.error(f"Error getting earnings calendar for {date}: {str(e)}")
            
            return jsonify({
                "error": "Earnings calendar data is not available. Please check your data source configuration.",
                "timestamp": datetime.now().timestamp()
            }), 503
            
            logger.info(f"Using sample earnings data: {len(earnings)} companies")
        
        return jsonify({
            "date": date,
            "count": len(earnings),
            "earnings": earnings,
            "timestamp": datetime.now().timestamp()
        })
    except Exception as e:
        logger.error(f"Error getting earnings calendar for {date}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/analyze-strategy/<ticker>', methods=['GET'])
def analyze_strategy(ticker):
    """Analyze a specific strategy for a ticker."""
    try:
        # Get the strategy type from query parameters
        strategy_type = request.args.get('strategy', 'calendar')
        
        # Validate strategy type
        if strategy_type not in ['calendar', 'naked', 'ironCondor']:
            return jsonify({
                "error": f"Invalid strategy type: {strategy_type}. Must be one of: calendar, naked, ironCondor",
                "ticker": ticker,
                "timestamp": datetime.now().timestamp()
            }), 400
        
        # Run full analysis for the specified strategy
        result = analyze_options(ticker, run_full_analysis=True, strategy_type=strategy_type)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error analyzing strategy for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/stock/<ticker>', methods=['GET'])
def get_stock_details(ticker):
    """
    Get detailed information about a stock.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        JSON: Stock information
    """
    try:
        info = get_stock_info(ticker)
        return jsonify(info)
    except Exception as e:
        logger.error(f"Error getting stock details for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/earnings-history/<ticker>', methods=['GET'])
def get_ticker_earnings_history(ticker):
    """
    Get historical earnings dates and post-earnings performance for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Query Parameters:
        years (int, optional): Number of years of history to retrieve. Defaults to 7.
        
    Returns:
        JSON: Earnings history and performance data
    """
    try:
        # Get years parameter or use default
        years = request.args.get('years', default=7, type=int)
        
        # Validate years parameter
        if years <= 0 or years > 20:
            return jsonify({
                "error": "Years parameter must be between 1 and 20",
                "timestamp": datetime.now().timestamp()
            }), 400
            
        # Get earnings history
        history_data = get_earnings_history(ticker, years)
        
        # Check for errors
        if "error" in history_data:
            return jsonify({
                "error": history_data["error"],
                "ticker": ticker,
                "timestamp": datetime.now().timestamp()
            }), 400
            
        # Calculate performance statistics
        stats = get_earnings_performance_stats(history_data.get("performance_data", []))
        
        # Add stats to response
        history_data["stats"] = stats
        
        return jsonify({
            "ticker": ticker,
            "years": years,
            "data": history_data,
            "timestamp": datetime.now().timestamp()
        })
        
    except Exception as e:
        logger.error(f"Error getting earnings history for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/fetch-option-prices/<ticker>', methods=['POST'])
def fetch_option_prices(ticker):
    """
    Fetch real-time prices for specific option contracts.
    
    This endpoint is EXCLUSIVELY for the Active Trades panel to get current prices
    for exact option contracts in a spread using yfinance.
    
    Expected POST body:
    {
        "contracts": [
            {
                "optionType": "call",
                "strike": 150.0,
                "expiration": "2025-07-18",
                "quantity": 1,
                "isLong": true
            },
            ...
        ]
    }
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                "success": False,
                "error": "Request must be JSON",
                "timestamp": datetime.now().isoformat()
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'contracts' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'contracts' field in request body",
                "timestamp": datetime.now().isoformat()
            }), 400
        
        contracts = data['contracts']
        
        # Validate contract specifications
        validation_errors = validate_option_contracts(contracts)
        if validation_errors:
            return jsonify({
                "success": False,
                "error": "Invalid contract specifications",
                "validation_errors": validation_errors,
                "timestamp": datetime.now().isoformat()
            }), 400
        
        # Fetch prices using yfinance
        logger.info(f"Fetching option prices for {ticker} with {len(contracts)} contracts")
        result = fetch_specific_option_prices(ticker.upper(), contracts)
        
        # Return the result
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in fetch_option_prices for {ticker}: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }), 500

# Error handlers
@api_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Not found",
        "timestamp": datetime.now().timestamp()
    }), 404

@api_bp.errorhandler(500)
def server_error(error):
    return jsonify({
        "error": "Internal server error",
        "timestamp": datetime.now().timestamp()
    }), 500