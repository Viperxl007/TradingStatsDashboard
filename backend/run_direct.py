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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import numpy as np
import pandas as pd
from scipy.interpolate import interp1d

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configure Flask to properly handle JSON serialization
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, bool):
            return str(obj).lower()  # Convert True/False to "true"/"false"
        return super().default(obj)

app.json_encoder = CustomJSONEncoder

# Core functions from calculator.py
def filter_dates(dates):
    """Filter option expiration dates to include only those within 45 days."""
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

def yang_zhang(price_data, window=30, trading_periods=252, return_last_only=True):
    """Calculate Yang-Zhang volatility estimator."""
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
    """Build a term structure spline from days to expiry and implied volatilities."""
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

def get_current_price(ticker):
    """Get the current price for a stock."""
    todays_data = ticker.history(period='1d')
    return todays_data['Close'].iloc[0]

def analyze_options(ticker_symbol):
    """Analyze options data for a given ticker and provide a recommendation."""
    try:
        ticker_symbol = ticker_symbol.strip().upper()
        if not ticker_symbol:
            return {"error": "No stock symbol provided."}
        
        # Get stock and options data
        stock = yf.Ticker(ticker_symbol)
        if len(stock.options) == 0:
            return {"error": f"No options found for stock symbol '{ticker_symbol}'."}
        
        # Filter expiration dates
        exp_dates = list(stock.options)
        try:
            exp_dates = filter_dates(exp_dates)
        except Exception:
            return {"error": "Not enough option data."}
        
        # Get options chains for each expiration date
        options_chains = {}
        for exp_date in exp_dates:
            options_chains[exp_date] = stock.option_chain(exp_date)
        
        # Get current price
        underlying_price = get_current_price(stock)
        if underlying_price is None:
            return {"error": "No market price found."}
        
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
            return {"error": "Could not determine ATM IV for any expiration dates."}
        
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
        
        price_history = stock.history(period='3mo')
        iv30_rv30 = term_spline(30) / yang_zhang(price_history)
        
        avg_volume = price_history['Volume'].rolling(30).mean().dropna().iloc[-1]
        
        expected_move = round(straddle / underlying_price * 100, 2) if straddle else None
        expected_move_str = f"{expected_move}%" if expected_move is not None else "N/A"
        
        # Determine recommendation
        # The original calculator.py thresholds
        avg_volume_pass = avg_volume >= 1500000
        iv30_rv30_pass = iv30_rv30 >= 1.25
        ts_slope_pass = ts_slope_0_45 <= -0.00406
        
        # Debug log
        logger.info(f"{ticker_symbol} Analysis - Volume: {avg_volume} (Pass: {avg_volume_pass}), IV30/RV30: {iv30_rv30} (Pass: {iv30_rv30_pass}), TS Slope: {ts_slope_0_45} (Pass: {ts_slope_pass})")
        
        if avg_volume_pass and iv30_rv30_pass and ts_slope_pass:
            recommendation = "Recommended"
        elif ts_slope_pass and ((avg_volume_pass and not iv30_rv30_pass) or (iv30_rv30_pass and not avg_volume_pass)):
            recommendation = "Consider"
        else:
            recommendation = "Avoid"
        
        # Double-check the pass/fail conditions
        # The original calculator.py thresholds
        avg_volume_pass = avg_volume >= 1500000
        iv30_rv30_pass = iv30_rv30 >= 1.25
        ts_slope_pass = ts_slope_0_45 <= -0.00406
        
        # Log the actual values and thresholds
        logger.info(f"{ticker_symbol} Analysis - Final Check:")
        logger.info(f"  Volume: {avg_volume} >= 1500000? {avg_volume_pass}")
        logger.info(f"  IV30/RV30: {iv30_rv30} >= 1.25? {iv30_rv30_pass}")
        logger.info(f"  TS Slope: {ts_slope_0_45} <= -0.00406? {ts_slope_pass}")
        
        # Handle NaN values for JSON serialization
        if np.isnan(avg_volume):
            avg_volume = None
        if np.isnan(iv30_rv30):
            iv30_rv30 = None
        if np.isnan(ts_slope_0_45):
            ts_slope_0_45 = None
            
        # Prepare result - convert all values to JSON-serializable types
        result = {
            "ticker": ticker_symbol,
            "currentPrice": float(underlying_price) if not np.isnan(underlying_price) else None,
            "metrics": {
                "avgVolume": float(avg_volume) if avg_volume is not None else None,
                "avgVolumePass": "true" if avg_volume_pass else "false",  # Convert to string
                "iv30Rv30": float(iv30_rv30) if iv30_rv30 is not None else None,
                "iv30Rv30Pass": "true" if iv30_rv30_pass else "false",    # Convert to string
                "tsSlope": float(ts_slope_0_45) if ts_slope_0_45 is not None else None,
                "tsSlopePass": "true" if ts_slope_pass else "false"       # Convert to string
            },
            "expectedMove": expected_move_str,
            "recommendation": recommendation,
            "timestamp": datetime.now().timestamp()
        }
        
        return result
    
    except Exception as e:
        return {"error": f"Error analyzing options: {str(e)}"}

def handle_pandas_dataframe(df, date_str):
    """
    Handle pandas DataFrame returned by finance_calendars.
    
    Args:
        df (pandas.DataFrame): DataFrame with earnings data
        date_str (str): Date string in YYYY-MM-DD format
        
    Returns:
        list: List of earnings calendar items in our format
    """
    import pandas as pd
    
    logger.info(f"Processing pandas DataFrame with {len(df)} rows")
    
    # Log column names for debugging
    if not df.empty:
        logger.info(f"DataFrame columns: {list(df.columns)}")
    
    formatted_data = []
    
    # Check if we have the expected column format from finance_calendars
    has_finance_calendars_format = all(col in df.columns for col in ['time', 'name'])
    
    # Get the index column if it exists (might contain ticker symbols)
    index_is_ticker = False
    if hasattr(df, 'index') and hasattr(df.index, 'name'):
        logger.info(f"DataFrame index name: {df.index.name}")
        if df.index.name == 'symbol' or df.index.name == 'Symbol' or df.index.name == 'ticker' or df.index.name == 'Ticker':
            index_is_ticker = True
            logger.info("Using DataFrame index as ticker symbols")
    
    # Convert DataFrame to list of dictionaries
    for idx, row in df.iterrows():
        try:
            # Extract data from row
            ticker = ''
            company = ''
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format:
                # In finance_calendars format, the index is the ticker symbol
                if index_is_ticker:
                    ticker = str(idx)
                else:
                    # Try to extract ticker from the name (e.g., "AAPL Apple Inc.")
                    name_parts = str(row['name']).split()
                    if name_parts and len(name_parts[0]) <= 5 and name_parts[0].isupper():
                        ticker = name_parts[0]
                    else:
                        # Generate a placeholder ticker
                        ticker = f"UNKNOWN_{idx}"
                
                company = str(row['name'])
                
                # Log the extraction for debugging
                logger.info(f"Extracted ticker: {ticker}, company: {company} from row: {row['name']}")
            else:
                # Try different column names for ticker symbol
                if 'Symbol' in row:
                    ticker = str(row['Symbol'])
                elif 'symbol' in row:
                    ticker = str(row['symbol'])
                elif 'Ticker' in row:
                    ticker = str(row['Ticker'])
                elif 'ticker' in row:
                    ticker = str(row['ticker'])
                elif index_is_ticker:
                    ticker = str(idx)
                    
                # Try different column names for company name
                if 'Company' in row:
                    company = str(row['Company'])
                elif 'company' in row:
                    company = str(row['company'])
                elif 'Name' in row:
                    company = str(row['Name'])
                elif 'name' in row:
                    company = str(row['name'])
                else:
                    company = ticker  # Use ticker as company name
            
            # Determine report time
            report_time = 'AMC'  # Default to After Market Close
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format and 'time' in row:
                time_val = str(row['time']).lower()
                if 'bmo' in time_val or 'before' in time_val or 'morning' in time_val:
                    report_time = 'BMO'
                elif 'amc' in time_val or 'after' in time_val or 'evening' in time_val:
                    report_time = 'AMC'
                # Log the time value for debugging
                logger.info(f"Time value: {time_val}, interpreted as: {report_time}")
            else:
                # Try standard column names
                if 'Call Time' in row:
                    call_time = str(row['Call Time'])
                    if 'bmo' in call_time.lower() or 'before' in call_time.lower():
                        report_time = 'BMO'
                elif 'Time' in row:
                    call_time = str(row['Time'])
                    if 'bmo' in call_time.lower() or 'before' in call_time.lower():
                        report_time = 'BMO'
            
            # Get EPS estimates if available
            eps_estimate = None
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format and 'epsForecast' in row:
                try:
                    val = row['epsForecast']
                    if val is not None and not pd.isna(val):
                        eps_estimate = float(val)
                        # Log the EPS forecast for debugging
                        logger.info(f"EPS forecast: {eps_estimate}")
                except:
                    pass
            else:
                # Try standard column names
                for col in ['EPS Estimate', 'eps_estimate', 'Estimate', 'estimate']:
                    if col in row:
                        try:
                            val = row[col]
                            if val is not None and not pd.isna(val):
                                eps_estimate = float(val)
                                break
                        except:
                            pass
            
            # Get actual EPS if available
            actual_eps = None
            
            # Handle finance_calendars specific format
            if has_finance_calendars_format and 'lastYearEPS' in row:
                try:
                    val = row['lastYearEPS']
                    if val is not None and not pd.isna(val):
                        actual_eps = float(val)
                        # Log the last year EPS for debugging
                        logger.info(f"Last year EPS: {actual_eps}")
                except:
                    pass
            else:
                # Try standard column names
                for col in ['Reported EPS', 'reported_eps', 'Actual EPS', 'actual_eps', 'Actual', 'actual']:
                    if col in row:
                        try:
                            val = row[col]
                            if val is not None and not pd.isna(val):
                                actual_eps = float(val)
                                break
                        except:
                            pass
            
            formatted_data.append({
                "ticker": ticker,
                "companyName": company,
                "reportTime": report_time,
                "date": date_str,
                "estimatedEPS": eps_estimate,
                "actualEPS": actual_eps
            })
        except Exception as e:
            logger.warning(f"Error processing row: {e}")
            continue
    
    return formatted_data

def get_earnings_calendar(date_str=None):
    """
    Get earnings calendar for a specific date or today using finance_calendars API.
    
    Args:
        date_str (str, optional): Date in YYYY-MM-DD format. Defaults to today.
        
    Returns:
        list: List of earnings calendar items
    """
    try:
        # Check if finance_calendars is available
        if importlib.util.find_spec("finance_calendars") is None:
            logger.error("finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7")
            raise ImportError("finance_calendars package is not installed")
        
        # Import finance_calendars
        from finance_calendars import finance_calendars as fc
        
        # Use provided date or default to today
        if date_str is None:
            logger.info("No date provided, using today's date")
            # Get today's earnings
            earnings_data = fc.get_earnings_today()
            date_str = datetime.now().strftime('%Y-%m-%d')
        else:
            # Convert string date to datetime object
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                logger.info(f"Getting earnings for date: {date_str}")
                earnings_data = fc.get_earnings_by_date(date_obj)
            except ValueError:
                logger.error(f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD")
                raise ValueError(f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD")
        
        # Log the number of earnings found
        logger.info(f"Found {len(earnings_data)} earnings announcements for {date_str}")
        
        # Log the raw data for debugging
        logger.info(f"Raw earnings data type: {type(earnings_data)}")
        
        # Check if it's a pandas DataFrame
        if str(type(earnings_data)).startswith("<class 'pandas.core.frame.DataFrame"):
            # Handle pandas DataFrame
            formatted_data = handle_pandas_dataframe(earnings_data, date_str)
        else:
            # For list-like data
            if len(earnings_data) > 0:
                logger.info(f"First item type: {type(earnings_data[0])}")
                logger.info(f"First item: {earnings_data[0]}")
            
            # Convert to our format
            formatted_data = []
            for item in earnings_data:
                # Handle different possible formats
                if isinstance(item, dict):
                    # If item is already a dictionary
                    formatted_data.append({
                        "ticker": item.get('symbol', ''),
                        "companyName": item.get('name', ''),
                        "reportTime": item.get('when', 'AMC'),  # Default to AMC if not specified
                        "date": date_str,
                        "estimatedEPS": item.get('estimate'),
                        "actualEPS": item.get('actual')
                    })
                elif isinstance(item, str):
                    # If item is a string (likely a ticker symbol)
                    formatted_data.append({
                        "ticker": item,
                        "companyName": item,  # Use ticker as company name
                        "reportTime": "AMC",  # Default to AMC
                        "date": date_str,
                        "estimatedEPS": None,
                        "actualEPS": None
                    })
                elif hasattr(item, '__getitem__') and len(item) >= 2:
                    # If item is a list-like object with at least 2 elements
                    # Assuming format is [symbol, name, ...]
                    formatted_data.append({
                        "ticker": item[0] if isinstance(item[0], str) else str(item[0]),
                        "companyName": item[1] if isinstance(item[1], str) else str(item[1]),
                        "reportTime": "AMC",  # Default to AMC
                        "date": date_str,
                        "estimatedEPS": None,
                        "actualEPS": None
                    })
                else:
                    # For any other format, try to convert to string
                    try:
                        ticker = str(item)
                        formatted_data.append({
                            "ticker": ticker,
                            "companyName": ticker,  # Use ticker as company name
                            "reportTime": "AMC",  # Default to AMC
                            "date": date_str,
                            "estimatedEPS": None,
                            "actualEPS": None
                        })
                    except:
                        logger.warning(f"Skipping item due to unknown format: {item}")
        
        return formatted_data
    except ImportError as e:
        logger.error(f"ImportError: {str(e)}")
        raise ImportError(f"finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7")
    except Exception as e:
        logger.error(f"Error fetching earnings calendar: {str(e)}")
        raise Exception(f"Error fetching earnings calendar: {str(e)}")

# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().timestamp()
    })

@app.route('/api/analyze/<ticker>', methods=['GET'])
def analyze_ticker(ticker):
    """Analyze options data for a given ticker."""
    try:
        result = analyze_options(ticker)
        if "error" in result:
            return jsonify({
                "error": result["error"],
                "ticker": ticker,
                "timestamp": datetime.now().timestamp()
            }), 400
        return jsonify(result)
    except Exception as e:
        logger.error(f"Unexpected error analyzing {ticker}: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred",
            "ticker": ticker,
            "timestamp": datetime.now().timestamp()
        }), 500

@app.route('/api/scan/earnings', methods=['GET'])
def scan_earnings():
    """Scan stocks with earnings announcements for options analysis."""
    try:
        # Get date parameter if provided
        date_str = request.args.get('date')
        logger.info(f"Scanning earnings with date parameter: {date_str}")
        
        # Check if finance_calendars is installed
        if importlib.util.find_spec("finance_calendars") is None:
            return jsonify({
                "error": "finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        try:
            # Get earnings calendar
            earnings = get_earnings_calendar(date_str)
            
            # Verify earnings data format
            if not isinstance(earnings, list):
                logger.error(f"Unexpected earnings data format: {type(earnings)}")
                return jsonify({
                    "error": f"Unexpected earnings data format: {type(earnings)}",
                    "timestamp": datetime.now().timestamp()
                }), 500
                
            if len(earnings) == 0:
                logger.warning(f"No earnings found for date: {date_str or datetime.now().strftime('%Y-%m-%d')}")
                return jsonify({
                    "date": date_str or datetime.now().strftime('%Y-%m-%d'),
                    "count": 0,
                    "results": [],
                    "message": "No earnings announcements found for this date",
                    "timestamp": datetime.now().timestamp()
                })
        except ImportError as e:
            return jsonify({
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Error fetching earnings calendar: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        # Log the earnings data for debugging
        logger.info(f"Processing {len(earnings)} earnings announcements")
        for i, earning in enumerate(earnings[:5]):  # Log first 5 for debugging
            logger.info(f"Earning {i+1}: {earning}")
        
        # Analyze each ticker
        results = []
        for earning in earnings:
            ticker = earning.get('ticker')
            if not ticker:
                logger.warning(f"Skipping earning without ticker: {earning}")
                continue
                
            logger.info(f"Analyzing ticker: {ticker}, company: {earning.get('companyName', '')}")
            try:
                analysis = analyze_options(ticker)
                if "error" not in analysis:
                    # Add company name from earnings data
                    analysis['companyName'] = earning.get('companyName', '')
                    analysis['reportTime'] = earning.get('reportTime', '')
                    results.append(analysis)
                    logger.info(f"Successfully analyzed {ticker}")
                else:
                    # Include failed analysis with error message but with valid structure
                    error_msg = analysis["error"]
                    logger.warning(f"Analysis error for {ticker}: {error_msg}")
                    
                    # Create a placeholder result with the error but valid structure
                    results.append({
                        "ticker": ticker,
                        "companyName": earning.get('companyName', ''),
                        "reportTime": earning.get('reportTime', ''),
                        "currentPrice": None,
                        "metrics": {
                            "avgVolume": None,
                            "avgVolumePass": "false",
                            "iv30Rv30": None,
                            "iv30Rv30Pass": "false",
                            "tsSlope": None,
                            "tsSlopePass": "false"
                        },
                        "expectedMove": "N/A",
                        "recommendation": "No Data",
                        "error": error_msg,
                        "timestamp": datetime.now().timestamp()
                    })
            except Exception as e:
                logger.warning(f"Error analyzing {ticker}: {str(e)}")
                # Include failed analysis with error message but with valid structure
                results.append({
                    "ticker": ticker,
                    "companyName": earning.get('companyName', ''),
                    "reportTime": earning.get('reportTime', ''),
                    "currentPrice": None,
                    "metrics": {
                        "avgVolume": None,
                        "avgVolumePass": "false",
                        "iv30Rv30": None,
                        "iv30Rv30Pass": "false",
                        "tsSlope": None,
                        "tsSlopePass": "false"
                    },
                    "expectedMove": "N/A",
                    "recommendation": "No Data",
                    "error": str(e),
                    "timestamp": datetime.now().timestamp()
                })
        
        # Filter out results with no data
        filtered_results = [result for result in results if result.get("recommendation") != "No Data"]
        
        # Log the results
        logger.info(f"Scan complete. Found {len(filtered_results)} valid results out of {len(earnings)} earnings announcements")
        logger.info(f"Filtered out {len(results) - len(filtered_results)} results with no data")
        
        return jsonify({
            "date": date_str or datetime.now().strftime('%Y-%m-%d'),
            "count": len(filtered_results),
            "results": filtered_results,
            "timestamp": datetime.now().timestamp()
        })
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
        # Check if finance_calendars is installed
        if importlib.util.find_spec("finance_calendars") is None:
            return jsonify({
                "error": "finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        try:
            earnings = get_earnings_calendar()
            
            # Verify earnings data format
            if not isinstance(earnings, list):
                logger.error(f"Unexpected earnings data format: {type(earnings)}")
                return jsonify({
                    "error": f"Unexpected earnings data format: {type(earnings)}",
                    "timestamp": datetime.now().timestamp()
                }), 500
                
            if len(earnings) == 0:
                logger.warning("No earnings found for today")
                return jsonify({
                    "date": datetime.now().strftime('%Y-%m-%d'),
                    "count": 0,
                    "earnings": [],
                    "message": "No earnings announcements found for today",
                    "timestamp": datetime.now().timestamp()
                })
                
            return jsonify({
                "date": datetime.now().strftime('%Y-%m-%d'),
                "count": len(earnings),
                "earnings": earnings,
                "timestamp": datetime.now().timestamp()
            })
        except ImportError as e:
            return jsonify({
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Error fetching earnings calendar: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }), 500
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
        # Check if finance_calendars is installed
        if importlib.util.find_spec("finance_calendars") is None:
            return jsonify({
                "error": "finance_calendars package is not installed. Please install it using: pip install finance-calendars==0.0.7",
                "timestamp": datetime.now().timestamp()
            }), 500
        
        # Validate date format
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                "error": f"Invalid date format: {date}. Expected format: YYYY-MM-DD",
                "timestamp": datetime.now().timestamp()
            }), 400
            
        logger.info(f"Getting earnings calendar for date: {date}")
        
        try:
            earnings = get_earnings_calendar(date)
            
            # Verify earnings data format
            if not isinstance(earnings, list):
                logger.error(f"Unexpected earnings data format: {type(earnings)}")
                return jsonify({
                    "error": f"Unexpected earnings data format: {type(earnings)}",
                    "timestamp": datetime.now().timestamp()
                }), 500
                
            if len(earnings) == 0:
                logger.warning(f"No earnings found for date: {date}")
                return jsonify({
                    "date": date,
                    "count": 0,
                    "earnings": [],
                    "message": f"No earnings announcements found for {date}",
                    "timestamp": datetime.now().timestamp()
                })
            
            return jsonify({
                "date": date,
                "count": len(earnings),
                "earnings": earnings,
                "timestamp": datetime.now().timestamp()
            })
        except ImportError as e:
            return jsonify({
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }), 500
        except Exception as e:
            return jsonify({
                "error": f"Error fetching earnings calendar: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }), 500
    except Exception as e:
        logger.error(f"Error getting earnings calendar for {date}: {str(e)}")
        return jsonify({
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500

def generate_sample_earnings(date_str):
    """
    Generate sample earnings data for a specific date.
    
    Args:
        date_str (str): Date in YYYY-MM-DD format
        
    Returns:
        list: List of sample earnings calendar items
    """
    # Generate different sample data based on the date to make it more realistic
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    day_of_week = date_obj.weekday()  # 0 = Monday, 6 = Sunday
    month = date_obj.month
    day = date_obj.day
    
    # Use a combination of day of week, month, and day to generate varied data
    # This ensures different dates show different companies
    seed = day_of_week + month * 10 + day
    
    # List of actual companies with their real sectors
    all_companies = [
        {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "eps": 1.52},
        {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "eps": 2.35},
        {"ticker": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "eps": 0.83},
        {"ticker": "GOOGL", "name": "Alphabet Inc.", "sector": "Communication Services", "eps": 1.89},
        {"ticker": "META", "name": "Meta Platforms, Inc.", "sector": "Communication Services", "eps": 4.71},
        {"ticker": "TSLA", "name": "Tesla, Inc.", "sector": "Consumer Cyclical", "eps": 0.73},
        {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "eps": 5.16},
        {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financial Services", "eps": 3.41},
        {"ticker": "V", "name": "Visa Inc.", "sector": "Financial Services", "eps": 2.37},
        {"ticker": "WMT", "name": "Walmart Inc.", "sector": "Consumer Defensive", "eps": 0.62},
        {"ticker": "PG", "name": "Procter & Gamble Company", "sector": "Consumer Defensive", "eps": 1.83},
        {"ticker": "DIS", "name": "The Walt Disney Company", "sector": "Communication Services", "eps": 1.21},
        {"ticker": "NFLX", "name": "Netflix, Inc.", "sector": "Communication Services", "eps": 4.52},
        {"ticker": "INTC", "name": "Intel Corporation", "sector": "Technology", "eps": 0.13},
        {"ticker": "AMD", "name": "Advanced Micro Devices, Inc.", "sector": "Technology", "eps": 0.68},
        {"ticker": "CSCO", "name": "Cisco Systems, Inc.", "sector": "Technology", "eps": 0.87},
        {"ticker": "ADBE", "name": "Adobe Inc.", "sector": "Technology", "eps": 4.13},
        {"ticker": "CRM", "name": "Salesforce, Inc.", "sector": "Technology", "eps": 2.26},
        {"ticker": "PYPL", "name": "PayPal Holdings, Inc.", "sector": "Financial Services", "eps": 1.18},
        {"ticker": "COST", "name": "Costco Wholesale Corporation", "sector": "Consumer Defensive", "eps": 3.92},
        {"ticker": "MCD", "name": "McDonald's Corporation", "sector": "Consumer Cyclical", "eps": 2.82},
        {"ticker": "NKE", "name": "NIKE, Inc.", "sector": "Consumer Cyclical", "eps": 0.98},
        {"ticker": "BA", "name": "The Boeing Company", "sector": "Industrials", "eps": -1.15},
        {"ticker": "GS", "name": "The Goldman Sachs Group, Inc.", "sector": "Financial Services", "eps": 8.79},
        {"ticker": "IBM", "name": "International Business Machines", "sector": "Technology", "eps": 1.63},
        {"ticker": "T", "name": "AT&T Inc.", "sector": "Communication Services", "eps": 0.57},
        {"ticker": "VZ", "name": "Verizon Communications Inc.", "sector": "Communication Services", "eps": 1.15},
        {"ticker": "CAT", "name": "Caterpillar Inc.", "sector": "Industrials", "eps": 5.12},
        {"ticker": "CVX", "name": "Chevron Corporation", "sector": "Energy", "eps": 3.45},
        {"ticker": "XOM", "name": "Exxon Mobil Corporation", "sector": "Energy", "eps": 2.14},
        {"ticker": "PFE", "name": "Pfizer Inc.", "sector": "Healthcare", "eps": 0.47},
        {"ticker": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare", "eps": 2.31},
        {"ticker": "UNH", "name": "UnitedHealth Group Incorporated", "sector": "Healthcare", "eps": 6.57},
        {"ticker": "HD", "name": "The Home Depot, Inc.", "sector": "Consumer Cyclical", "eps": 3.81},
        {"ticker": "BAC", "name": "Bank of America Corporation", "sector": "Financial Services", "eps": 0.78},
        {"ticker": "MA", "name": "Mastercard Incorporated", "sector": "Financial Services", "eps": 3.07},
        {"ticker": "KO", "name": "The Coca-Cola Company", "sector": "Consumer Defensive", "eps": 0.49},
        {"ticker": "PEP", "name": "PepsiCo, Inc.", "sector": "Consumer Defensive", "eps": 2.15},
        {"ticker": "ABBV", "name": "AbbVie Inc.", "sector": "Healthcare", "eps": 2.91},
        {"ticker": "MRK", "name": "Merck & Co., Inc.", "sector": "Healthcare", "eps": 1.83}
    ]
    
    # Select companies based on the seed
    # This ensures different dates show different companies
    import random
    random.seed(seed)
    
    # Shuffle the companies list
    shuffled_companies = all_companies.copy()
    random.shuffle(shuffled_companies)
    
    # Select 5-8 companies based on the seed
    num_companies = (seed % 4) + 5  # 5 to 8 companies
    selected_companies = shuffled_companies[:num_companies]
    
    # Create the earnings data
    result = []
    for company in selected_companies:
        # Alternate between BMO and AMC
        report_time = "BMO" if len(result) % 2 == 0 else "AMC"
        
        result.append({
            "ticker": company["ticker"],
            "companyName": company["name"],
            "reportTime": report_time,
            "date": date_str,
            "estimatedEPS": company["eps"],
            "actualEPS": None
        })
    
    return result

# Import and register the earnings history endpoint
try:
    from run_direct_earnings_history import register_earnings_history_endpoint
    register_earnings_history_endpoint(app)
    print("Earnings history endpoint registered successfully")
except ImportError as e:
    print(f"Warning: Could not import earnings history module: {e}")
    print("The earnings history endpoint will not be available")
except Exception as e:
    print(f"Warning: Error registering earnings history endpoint: {e}")
    print("The earnings history endpoint will not be available")

if __name__ == "__main__":
    print("Options Earnings Screener Backend - Direct Run")
    print("=============================================")
    print("This script runs a minimal Flask server with the core functionality.")
    print("No virtual environment or additional dependencies are needed.")
    print()
    
    # Check if any packages are missing
    if missing_packages:
        print(f"Missing required packages: {', '.join(missing_packages)}")
        print("Please install them using:")
        print(f"python -m pip install --user {' '.join(missing_packages)}")
        sys.exit(1)
    
    # Run the server
    print("Starting server on http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    print()
    app.run(host='0.0.0.0', port=5000, debug=True)