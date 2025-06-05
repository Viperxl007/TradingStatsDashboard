"""
API Routes Module

This module defines the API routes for the options earnings screener.
"""

from flask import Blueprint, jsonify, request, Response
import logging
import concurrent.futures
import json
from datetime import datetime
from app.options_analyzer import (
    analyze_options, filter_dates, find_closest_expiration,
    get_strikes_near_price, get_atm_iv, calculate_spread_cost,
    get_liquidity_score, calculate_spread_score, find_optimal_calendar_spread
)
from app.earnings_calendar import (
    get_earnings_today, get_earnings_by_date, get_earnings_calendar,
    handle_pandas_dataframe
)
from app.data_fetcher import get_stock_info, get_current_price
from app.rate_limiter import update_rate_limiter_config, yf_rate_limiter
from .earnings_history import get_earnings_history, get_earnings_performance_stats

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see detailed logs

# Create blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().timestamp()
    })

@api_bp.route('/analyze/<ticker>', methods=['GET'])
def analyze_ticker(ticker):
    """
    Analyze options data for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Query Parameters:
        full_analysis (bool, optional): Whether to run full strategy analysis
        strategy (str, optional): Type of strategy to analyze ('calendar', 'naked', 'ironCondor')
        
    Returns:
        JSON: Analysis results
    """
    try:
        # Get query parameters
        run_full_analysis = request.args.get('full_analysis', 'false').lower() == 'true'
        strategy_type = request.args.get('strategy')
        
        # Add detailed logging
        logger.info(f"API REQUEST: Analyzing {ticker} with full_analysis={run_full_analysis}, strategy={strategy_type}")
        start_time = datetime.now()
        
        # Run the analysis
        result = analyze_options(ticker, run_full_analysis, strategy_type)
        
        # Log completion time
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"API RESPONSE: Analysis of {ticker} completed in {duration:.2f} seconds")
        
        return jsonify(result)
    except ValueError as e:
        logger.error(f"API ERROR: Error analyzing {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 400
    except Exception as e:
        logger.error(f"API ERROR: Unexpected error analyzing {ticker}: {str(e)}")
        import traceback
        logger.error(f"API ERROR: Traceback: {traceback.format_exc()}")
        return jsonify({
            "error": "An unexpected error occurred",
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

@api_bp.route('/scan/earnings', methods=['GET'])
def scan_earnings():
    """
    Scan stocks with earnings announcements for options analysis.
    
    Query Parameters:
        date (str, optional): Date in YYYY-MM-DD format. Defaults to today.
        
    Returns:
        JSON: List of analysis results
    """
    try:
        # Get date parameter or use today
        date_str = request.args.get('date')
        
        # Get earnings calendar
        try:
            if date_str:
                try:
                    date = datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    return jsonify({
                        "error": "Invalid date format. Use YYYY-MM-DD.",
                        "timestamp": datetime.now().timestamp()
                    }), 400
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
        else:
            earnings = get_earnings_today()
        
        # Define a function to analyze a single ticker
        def analyze_ticker(earning):
            ticker = earning.get('ticker')
            if not ticker:
                return None
                
            try:
                # Get earnings date from the earnings data
                earnings_date = earning.get('date', '')
                
                # Don't run full analysis for scans to avoid timeouts, but pass earnings date
                analysis = analyze_options(ticker, False, earnings_date=earnings_date)
                # Add company name from earnings data
                analysis['companyName'] = earning.get('companyName', '')
                analysis['reportTime'] = earning.get('reportTime', '')
                analysis['earningsDate'] = earnings_date
                return analysis
            except Exception as e:
                logger.warning(f"Error analyzing {ticker}: {str(e)}")
                # Include failed analysis with error message
                return {
                    "ticker": ticker,
                    "companyName": earning.get('companyName', ''),
                    "reportTime": earning.get('reportTime', ''),
                    "error": str(e),
                    "timestamp": datetime.now().timestamp()
                }
        
        # Use ThreadPoolExecutor to parallelize the analysis
        import concurrent.futures
        
        # Filter out earnings with no ticker
        valid_earnings = [earning for earning in earnings if earning.get('ticker')]
        
        # Determine the number of workers based on the number of tickers
        # Use a reasonable maximum to avoid overwhelming the system
        max_workers = min(20, len(valid_earnings))
        
        # Process tickers in parallel
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks and collect futures
            future_to_earning = {executor.submit(analyze_ticker, earning): earning for earning in valid_earnings}
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_earning):
                result = future.result()
                if result:
                    results.append(result)
        
        return jsonify({
            "date": date_str or datetime.now().strftime('%Y-%m-%d'),
            "count": len(results),
            "results": results,
            "timestamp": datetime.now().timestamp()
        })
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