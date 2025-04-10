"""
API Routes Module

This module defines the API routes for the options earnings screener.
"""

from flask import Blueprint, jsonify, request
import logging
from datetime import datetime
from app.options_analyzer import analyze_options
from app.earnings_calendar import get_earnings_today, get_earnings_by_date
from app.data_fetcher import get_stock_info
from .earnings_history import get_earnings_history, get_earnings_performance_stats

# Set up logging
logger = logging.getLogger(__name__)

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
        
    Returns:
        JSON: Analysis results
    """
    try:
        result = analyze_options(ticker)
        return jsonify(result)
    except ValueError as e:
        logger.error(f"Error analyzing {ticker}: {str(e)}")
        return jsonify({
            "error": str(e),
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error analyzing {ticker}: {str(e)}")
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
        if date_str:
            try:
                date = datetime.strptime(date_str, '%Y-%m-%d')
            except ValueError:
                return jsonify({
                    "error": "Invalid date format. Use YYYY-MM-DD.",
                    "timestamp": datetime.now().timestamp()
                }), 400
            earnings = get_earnings_by_date(date)
        else:
            earnings = get_earnings_today()
        
        # Analyze each ticker
        results = []
        for earning in earnings:
            ticker = earning.get('ticker')
            if not ticker:
                continue
                
            try:
                analysis = analyze_options(ticker)
                # Add company name from earnings data
                analysis['companyName'] = earning.get('companyName', '')
                analysis['reportTime'] = earning.get('reportTime', '')
                results.append(analysis)
            except Exception as e:
                logger.warning(f"Error analyzing {ticker}: {str(e)}")
                # Include failed analysis with error message
                results.append({
                    "ticker": ticker,
                    "companyName": earning.get('companyName', ''),
                    "reportTime": earning.get('reportTime', ''),
                    "error": str(e),
                    "timestamp": datetime.now().timestamp()
                })
        
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
        earnings = get_earnings_today()
        return jsonify({
            "date": datetime.now().strftime('%Y-%m-%d'),
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
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                "error": "Invalid date format. Use YYYY-MM-DD.",
                "timestamp": datetime.now().timestamp()
            }), 400
            
        earnings = get_earnings_by_date(date_obj)
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