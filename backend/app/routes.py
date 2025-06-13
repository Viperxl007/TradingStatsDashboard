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
        
        # Get current price and 30-day average volume (matching main analysis)
        history = stock.history(period="3mo")  # Get 3 months of data for 30-day rolling average
        
        if history.empty:
            logger.warning(f"No price data for {ticker_symbol}")
            return False
            
        current_price = history['Close'].iloc[-1]
        # Calculate 30-day rolling average volume to match main analysis logic
        # This ensures consistency between quick filter and full analysis
        avg_volume = history['Volume'].rolling(30).mean().dropna().iloc[-1]
        
        # Check if price and volume meet minimum requirements
        price_pass = current_price >= QUICK_FILTER.get("min_price", 2.50)
        volume_pass = avg_volume >= QUICK_FILTER.get("min_volume", 1500000)
        
        logger.info(f"{ticker_symbol}: Price ${current_price:.2f} ({'PASS' if price_pass else 'FAIL'}), "
                   f"30-day Avg Volume {avg_volume:.0f} ({'PASS' if volume_pass else 'FAIL'})")
        
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

@api_bp.route('/refresh-metrics/<ticker>', methods=['GET'])
def refresh_metrics(ticker):
    """
    Refresh the core metrics for a trade idea: volume, IV/RV ratio, and term structure slope.
    
    This endpoint uses the SAME calculation logic as the main analysis function to ensure
    consistency between scan results and refresh results.
    
    Returns:
    {
        "ticker": "AAPL",
        "metrics": {
            "avgVolume": 50000000,
            "iv30Rv30": 1.35,
            "tsSlope": -0.00512
        },
        "timestamp": 1234567890.123,
        "success": true
    }
    """
    try:
        ticker = ticker.upper().strip()
        logger.info(f"Refreshing metrics for {ticker} using main analysis logic")
        
        # Import required functions from options_analyzer
        from app.options_analyzer import get_current_price, filter_dates, build_term_structure, yang_zhang
        from app.data_fetcher import get_stock_data
        import concurrent.futures
        
        # Get stock data - same as main analysis
        stock_data = get_stock_data(ticker)
        if not stock_data or len(stock_data.options) == 0:
            return jsonify({
                "error": f"No options found for stock symbol '{ticker}'",
                "ticker": ticker,
                "success": False,
                "timestamp": datetime.now().timestamp()
            }), 404
        
        # Filter expiration dates - same as main analysis
        exp_dates = list(stock_data.options)
        try:
            exp_dates = filter_dates(exp_dates)
        except Exception:
            return jsonify({
                "error": "Not enough option data",
                "ticker": ticker,
                "success": False,
                "timestamp": datetime.now().timestamp()
            }), 404
        
        # Get options chains in parallel - same as main analysis
        def fetch_option_chain(exp_date):
            return exp_date, stock_data.option_chain(exp_date)
        
        options_chains = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(exp_dates))) as executor:
            future_to_date = {executor.submit(fetch_option_chain, exp_date): exp_date for exp_date in exp_dates}
            
            for future in concurrent.futures.as_completed(future_to_date):
                try:
                    exp_date, chain = future.result()
                    options_chains[exp_date] = chain
                except Exception as e:
                    logger.warning(f"Error fetching option chain for {ticker} on {future_to_date[future]}: {str(e)}")
        
        # Get current price - same as main analysis
        underlying_price = get_current_price(stock_data)
        if underlying_price is None:
            return jsonify({
                "error": "No market price found",
                "ticker": ticker,
                "success": False,
                "timestamp": datetime.now().timestamp()
            }), 404
        
        # Calculate ATM IV for each expiration - same as main analysis
        atm_iv = {}
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
        
        if not atm_iv:
            return jsonify({
                "error": "Could not determine ATM IV for any expiration dates",
                "ticker": ticker,
                "success": False,
                "timestamp": datetime.now().timestamp()
            }), 404
        
        # Calculate days to expiry and build term structure - same as main analysis
        today = datetime.today().date()
        dtes = []
        ivs = []
        for exp_date, iv in atm_iv.items():
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_expiry = (exp_date_obj - today).days
            dtes.append(days_to_expiry)
            ivs.append(iv)
        
        term_spline = build_term_structure(dtes, ivs)
        
        # Calculate metrics using EXACT same logic as main analysis
        ts_slope_0_45 = (term_spline(45) - term_spline(dtes[0])) / (45-dtes[0])  # Same as main analysis
        
        price_history = stock_data.history(period='3mo')  # Same as main analysis
        iv30_rv30 = term_spline(30) / yang_zhang(price_history)  # Same as main analysis
        
        avg_volume = price_history['Volume'].rolling(30).mean().dropna().iloc[-1]  # Same as main analysis
        
        # Return updated metrics
        return jsonify({
            "ticker": ticker,
            "metrics": {
                "avgVolume": float(avg_volume),
                "iv30Rv30": float(iv30_rv30),
                "tsSlope": float(ts_slope_0_45)
            },
            "timestamp": datetime.now().timestamp(),
            "success": True
        })
        
    except Exception as e:
        logger.error(f"Error refreshing metrics for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "success": False,
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
# Chart Analysis Endpoints
@api_bp.route('/chart-analysis/analyze', methods=['POST'])
def analyze_chart():
    """
    Analyze a chart image using AI.
    
    Expects multipart/form-data with:
    - image: Chart image file
    - ticker: Stock ticker symbol
    - context: Optional JSON context data
    
    Returns:
        JSON: AI analysis results
    """
    import json  # Add json import at the top
    try:
        logger.info("Enhanced chart analysis endpoint called")
        from app.enhanced_chart_analyzer import enhanced_chart_analyzer
        from app.chart_context import chart_context_manager
        from app.level_detector import level_detector
        from app.snapshot_processor import snapshot_processor
        from app.data_fetcher import get_current_price
        import base64
        
        # Validate request
        if 'image' not in request.files:
            return jsonify({
                "error": "No image file provided",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        if 'ticker' not in request.form:
            return jsonify({
                "error": "No ticker symbol provided",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        image_file = request.files['image']
        ticker = request.form['ticker'].upper().strip()
        
        # Get timeframe (optional, defaults to '1D')
        timeframe = request.form.get('timeframe', '1D')
        
        # Get selected model (optional, defaults to configured default)
        selected_model = request.form.get('model', None)
        
        if image_file.filename == '':
            return jsonify({
                "error": "No image file selected",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        # Read image data
        image_data = image_file.read()
        
        # Process and validate image
        processing_result = snapshot_processor.process_image(image_data, optimize_for_ai=True)
        if not processing_result['success']:
            return jsonify({
                "error": f"Image processing failed: {processing_result.get('error', 'Unknown error')}",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        # Get context data
        context_data = {}
        if 'context' in request.form:
            try:
                context_data = json.loads(request.form['context'])
            except json.JSONDecodeError:
                logger.warning(f"Invalid context JSON for {ticker}")
        
        # Add current market data to context
        try:
            current_price = get_current_price(ticker)
            if current_price:
                context_data['current_price'] = current_price
        except Exception as e:
            logger.warning(f"Could not get current price for {ticker}: {str(e)}")
        
        # Get additional context from storage
        stored_context = chart_context_manager.get_context(ticker)
        context_data.update(stored_context)
        
        # Perform enhanced AI analysis
        analysis_result = enhanced_chart_analyzer.analyze_chart_comprehensive(
            processing_result['processed_data'],
            ticker,
            context_data,
            timeframe=timeframe,
            selected_model=selected_model
        )
        
        if 'error' in analysis_result:
            return jsonify(analysis_result), 500
        
        # Add chart image as base64 for frontend display
        chart_image_base64 = base64.b64encode(processing_result['processed_data']).decode('utf-8')
        analysis_result['chartImageBase64'] = chart_image_base64
        
        # Store analysis results
        try:
            analysis_id = chart_context_manager.store_analysis(
                ticker,
                analysis_result,
                processing_result['image_hash'],
                context_data
            )
            analysis_result['analysis_id'] = analysis_id
        except Exception as e:
            logger.warning(f"Could not store analysis for {ticker}: {str(e)}")
        
        # Add processing metadata
        analysis_result['processing_info'] = {
            'image_hash': processing_result['image_hash'],
            'original_size': processing_result['original_size'],
            'processed_size': processing_result['processed_size'],
            'optimizations_applied': processing_result['optimizations_applied']
        }
        
        logger.info(f"Successfully completed enhanced analysis for {ticker}")
        
        # The enhanced analyzer already returns properly formatted data
        return jsonify(analysis_result)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in chart analysis endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        return jsonify({
            "error": str(e),
            "details": error_details,
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/chart-analysis/history/<ticker>', methods=['GET'])
def get_analysis_history(ticker):
    """
    Get historical chart analyses for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Query parameters:
        limit (int): Maximum number of analyses to return (default: 10)
        days_back (int): Number of days to look back (default: 30)
        
    Returns:
        JSON: List of historical analyses
    """
    try:
        from app.chart_context import chart_context_manager
        
        ticker = ticker.upper().strip()
        limit = int(request.args.get('limit', 10))
        days_back = int(request.args.get('days_back', 30))
        
        # Validate parameters
        if limit > 100:
            limit = 100
        if days_back > 365:
            days_back = 365
        
        # Get historical analyses
        history = chart_context_manager.get_analysis_history(ticker, limit, days_back)
        
        return jsonify({
            "ticker": ticker,
            "count": len(history),
            "limit": limit,
            "days_back": days_back,
            "analyses": history,
            "timestamp": datetime.now().timestamp()
        })
        
    except ValueError as e:
        return jsonify({
            "error": f"Invalid parameter: {str(e)}",
            "timestamp": datetime.now().timestamp()
        }), 400
    except Exception as e:
        logger.error(f"Error getting analysis history for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/chart-analysis/details/<int:analysis_id>', methods=['GET'])
def get_analysis_details(analysis_id):
    """
    Get detailed analysis data for a specific analysis ID.
    
    Args:
        analysis_id (int): Analysis ID
        
    Returns:
        JSON: Complete analysis data including chart image and all details
    """
    try:
        from app.chart_context import chart_context_manager
        
        # Get the full analysis from database
        with chart_context_manager.db_lock:
            import sqlite3
            with sqlite3.connect(chart_context_manager.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT ticker, analysis_timestamp, analysis_data, confidence_score,
                           image_hash, context_data, created_at
                    FROM chart_analyses
                    WHERE id = ?
                ''', (analysis_id,))
                
                row = cursor.fetchone()
                if not row:
                    return jsonify({
                        "error": f"Analysis {analysis_id} not found",
                        "timestamp": datetime.now().timestamp()
                    }), 404
                
                ticker, timestamp, analysis_data, confidence, image_hash, context_data, created_at = row
                
                try:
                    parsed_analysis = json.loads(analysis_data)
                    parsed_context = json.loads(context_data) if context_data else {}
                    
                    return jsonify({
                        "id": analysis_id,
                        "ticker": ticker,
                        "timestamp": timestamp,
                        "analysis": parsed_analysis,
                        "confidence_score": confidence,
                        "image_hash": image_hash,
                        "context_data": parsed_context,
                        "created_at": created_at
                    })
                    
                except json.JSONDecodeError as e:
                    return jsonify({
                        "error": f"Failed to parse analysis data: {str(e)}",
                        "timestamp": datetime.now().timestamp()
                    }), 500
                    
    except Exception as e:
        logger.error(f"Error getting analysis details for {analysis_id}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/chart-analysis/context/<ticker>', methods=['POST'])
def store_analysis_context(ticker):
    """
    Store analysis context for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Request body:
        JSON object with context data
        
    Returns:
        JSON: Success status
    """
    try:
        from app.chart_context import chart_context_manager
        
        ticker = ticker.upper().strip()
        
        if not request.is_json:
            return jsonify({
                "error": "Request must be JSON",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        context_data = request.get_json()
        context_type = context_data.get('type', 'general')
        valid_hours = context_data.get('valid_hours', 24)
        
        # Remove metadata from context data
        clean_context = {k: v for k, v in context_data.items()
                        if k not in ['type', 'valid_hours']}
        
        # Store context
        success = chart_context_manager.store_context(
            ticker, context_type, clean_context, valid_hours
        )
        
        if success:
            return jsonify({
                "success": True,
                "ticker": ticker,
                "context_type": context_type,
                "timestamp": datetime.now().timestamp()
            })
        else:
            return jsonify({
                "error": "Failed to store context",
                "timestamp": datetime.now().timestamp()
            }), 500
        
    except Exception as e:
        logger.error(f"Error storing context for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/chart-analysis/levels/<ticker>', methods=['GET'])
def get_key_levels(ticker):
    """
    Get key support/resistance levels for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Query parameters:
        level_type (str): Filter by level type (support, resistance, entry, exit)
        near_price (float): Get levels near this price
        distance_pct (float): Distance percentage for near_price filter (default: 0.05)
        include_technical (bool): Include technical analysis levels (default: true)
        
    Returns:
        JSON: Key levels data
    """
    try:
        from app.level_detector import level_detector
        from app.chart_context import chart_context_manager
        from app.data_fetcher import get_current_price
        
        ticker = ticker.upper().strip()
        level_type = request.args.get('level_type')
        near_price = request.args.get('near_price', type=float)
        distance_pct = request.args.get('distance_pct', 0.05, type=float)
        include_technical = request.args.get('include_technical', 'true').lower() == 'true'
        
        result = {
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }
        
        # Get current price if not provided
        if near_price is None:
            try:
                near_price = get_current_price(ticker)
                result['current_price'] = near_price
            except Exception as e:
                logger.warning(f"Could not get current price for {ticker}: {str(e)}")
        
        # Get stored levels from AI analyses
        if near_price:
            price_range = (
                near_price * (1 - distance_pct),
                near_price * (1 + distance_pct)
            )
            stored_levels = chart_context_manager.get_key_levels(
                ticker, level_type, price_range
            )
        else:
            stored_levels = chart_context_manager.get_key_levels(ticker, level_type)
        
        result['ai_levels'] = stored_levels
        
        # Get technical levels if requested
        if include_technical:
            try:
                technical_levels = level_detector.detect_technical_levels(ticker)
                
                # Filter technical levels if near_price is specified
                if near_price and distance_pct:
                    filtered_technical = {}
                    for lt, levels in technical_levels.items():
                        if level_type is None or lt == level_type:
                            filtered_levels = [
                                level for level in levels
                                if abs(level - near_price) / near_price <= distance_pct
                            ]
                            filtered_technical[lt] = filtered_levels
                    technical_levels = filtered_technical
                
                result['technical_levels'] = technical_levels
            except Exception as e:
                logger.warning(f"Could not get technical levels for {ticker}: {str(e)}")
                result['technical_levels'] = {}
        
        # Get nearby levels if current price is available
        if near_price:
            try:
                nearby_levels = level_detector.get_levels_near_price(
                    ticker, near_price, distance_pct
                )
                result['nearby_levels'] = nearby_levels
            except Exception as e:
                logger.warning(f"Could not get nearby levels for {ticker}: {str(e)}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting key levels for {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/chart-analysis/delete/<int:analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    """
    Delete a specific chart analysis.
    
    Args:
        analysis_id (int): Analysis ID to delete
        
    Returns:
        JSON: Success confirmation
    """
    try:
        from app.chart_context import chart_context_manager
        
        success = chart_context_manager.delete_analysis(analysis_id)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Analysis {analysis_id} deleted successfully",
                "timestamp": datetime.now().timestamp()
            })
        else:
            return jsonify({
                "error": f"Analysis {analysis_id} not found",
                "timestamp": datetime.now().timestamp()
            }), 404
            
    except Exception as e:
        logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/chart-analysis/delete-bulk', methods=['DELETE'])
def delete_analyses_bulk():
    """
    Delete multiple chart analyses.
    
    Request body:
        {
            "analysis_ids": [1, 2, 3, ...]
        }
        
    Returns:
        JSON: Success confirmation with details
    """
    try:
        from app.chart_context import chart_context_manager
        
        data = request.get_json()
        if not data or 'analysis_ids' not in data:
            return jsonify({
                "error": "Missing analysis_ids in request body",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        analysis_ids = data['analysis_ids']
        if not isinstance(analysis_ids, list) or not analysis_ids:
            return jsonify({
                "error": "analysis_ids must be a non-empty list",
                "timestamp": datetime.now().timestamp()
            }), 400
        
        deleted_count = chart_context_manager.delete_analyses_bulk(analysis_ids)
        
        return jsonify({
            "success": True,
            "deleted_count": deleted_count,
            "requested_count": len(analysis_ids),
            "message": f"Successfully deleted {deleted_count} of {len(analysis_ids)} analyses",
            "timestamp": datetime.now().timestamp()
        })
        
    except Exception as e:
        logger.error(f"Error bulk deleting analyses: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500
@api_bp.route('/chart-analysis/update-markup/<int:analysis_id>', methods=['POST'])
def update_analysis_markup(analysis_id):
    """
    Update an existing analysis with marked-up chart image.
    
    Args:
        analysis_id (int): ID of the analysis to update
        
    Request JSON:
        {
            "markedUpChartImageBase64": "base64_encoded_image_data"
        }
    
    Returns:
        JSON response with success status
    """
    try:
        logger.info(f"Updating analysis {analysis_id} with marked-up chart")
        
        # Import required modules
        from app.chart_context import chart_context_manager
        import traceback
        
        # Get request data
        data = request.get_json()
        if not data or 'markedUpChartImageBase64' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing markedUpChartImageBase64 in request data'
            }), 400
        
        marked_up_chart = data['markedUpChartImageBase64']
        
        # Update the analysis with the marked-up chart
        success = chart_context_manager.update_analysis_markup(analysis_id, marked_up_chart)
        
        if success:
            logger.info(f"Successfully updated analysis {analysis_id} with marked-up chart")
            return jsonify({
                'success': True,
                'message': 'Analysis updated with marked-up chart'
            })
        else:
            logger.warning(f"Failed to update analysis {analysis_id} - analysis not found")
            return jsonify({
                'success': False,
                'error': 'Analysis not found'
            }), 404
            
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error updating analysis markup: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@api_bp.route('/chart-analysis/models', methods=['GET'])
def get_claude_models():
    """
    Get available Claude models for chart analysis.

    
    Returns:
        JSON: List of available Claude models with their details
    """
    try:
        from config import CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL
        
        return jsonify({
            "success": True,
            "models": CLAUDE_MODELS,
            "default_model": DEFAULT_CLAUDE_MODEL,
            "timestamp": datetime.now().timestamp()
        })
        
    except Exception as e:
        logger.error(f"Error getting Claude models: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

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