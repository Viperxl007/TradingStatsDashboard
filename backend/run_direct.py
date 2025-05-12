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

# Import earnings history functionality
try:
    from run_direct_earnings_history import register_earnings_history_endpoint
    logger.info("Loaded earnings history module")
except ImportError:
    logger.warning("run_direct_earnings_history.py not found, earnings history endpoint will not be available")
    register_earnings_history_endpoint = None

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

# Import core functions from app modules
from app.options_analyzer import (
    filter_dates, find_closest_expiration, get_strikes_near_price,
    get_atm_iv, calculate_spread_cost, get_liquidity_score,
    calculate_spread_score, find_optimal_calendar_spread,
    yang_zhang, analyze_options, find_optimal_naked_options,
    find_optimal_iron_condor, monte_carlo_calendar_spread,
    calculate_calendar_probability, calculate_realistic_calendar_return
)

# Import rate limiting functionality
from app.rate_limiter import (
    RateLimiter, update_rate_limiter_config, 
    get_current_price, yf_rate_limiter
)

# Import earnings calendar functionality
from app.earnings_calendar import (
    get_earnings_calendar, handle_pandas_dataframe,
    generate_sample_earnings
)

# Create Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})

# Configure Flask to properly handle JSON serialization
# Import custom JSON encoder from utils
from app.utils import CustomJSONEncoder

app.json_encoder = CustomJSONEncoder

# Initialize rate limiter
update_rate_limiter_config()

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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "timestamp": datetime.now().timestamp()})

@app.route('/api/analyze/<ticker>', methods=['GET'])
def analyze_ticker(ticker):
    """Analyze options data for a given ticker."""
    try:
        # Check if a specific strategy analysis is requested
        strategy_type = request.args.get('strategy')
        run_full_analysis = request.args.get('full_analysis', 'false').lower() == 'true'
        
        # Run the analysis
        result = analyze_options(ticker, run_full_analysis=run_full_analysis, strategy_type=strategy_type)
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
        
        # Run basic analysis to get metrics and recommendation
        analysis = analyze_options(ticker)
        
        # Check strategy availability instead of running full analysis
        strategy_availability = check_strategies_availability(ticker)
        
        # Add strategy availability to the analysis result
        analysis['strategyAvailability'] = strategy_availability
        
        # Add company name and report time from earnings data
        analysis['companyName'] = earning.get('companyName', '')
        analysis['reportTime'] = earning.get('reportTime', '')
        
        return analysis
    except Exception as e:
        logger.error(f"Error processing {earning.get('ticker', 'unknown')}: {str(e)}")
        return {
            "ticker": earning.get('ticker', 'unknown'),
            "companyName": earning.get('companyName', ''),
            "reportTime": earning.get('reportTime', ''),
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }

@app.route('/api/scan/earnings', methods=['GET'])
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
            
            # If we can't get real earnings data, generate sample data
            if date_str:
                earnings = generate_sample_earnings(date_str)
            else:
                date_str = datetime.now().strftime('%Y-%m-%d')
                earnings = generate_sample_earnings(date_str)
                
            logger.info(f"Using sample earnings data: {len(earnings)} companies")
        
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

@app.route('/api/calendar/today', methods=['GET'])
def get_today_calendar():
    """Get today's earnings calendar."""
    try:
        # Try to get real earnings data
        try:
            earnings = get_earnings_calendar()
            date_str = datetime.now().strftime('%Y-%m-%d')
        except Exception as e:
            logger.error(f"Error getting today's earnings calendar: {str(e)}")
            
            # If we can't get real earnings data, generate sample data
            date_str = datetime.now().strftime('%Y-%m-%d')
            earnings = generate_sample_earnings(date_str)
            
            logger.info(f"Using sample earnings data: {len(earnings)} companies")
        
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

@app.route('/api/calendar/<date>', methods=['GET'])
def get_calendar_by_date(date):
    """Get earnings calendar for a specific date."""
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
            
            # If we can't get real earnings data, generate sample data
            earnings = generate_sample_earnings(date)
            
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

@app.route('/api/analyze-strategy/<ticker>', methods=['GET'])
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

# Run the app if executed directly
if __name__ == '__main__':
    # Update rate limiter configuration
    update_rate_limiter_config()
    
    # Register earnings history endpoint if available
    if register_earnings_history_endpoint:
        try:
            register_earnings_history_endpoint(app)
            logger.info("Registered earnings history endpoint")
        except Exception as e:
            logger.error(f"Failed to register earnings history endpoint: {str(e)}")
    
    # Run the app with more stable socket handling
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False, threaded=True)