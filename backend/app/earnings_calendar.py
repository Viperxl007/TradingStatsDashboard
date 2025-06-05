"""
Earnings Calendar Module

This module handles fetching earnings calendar data using the finance_calendars package
or market data provider as a fallback.
"""

import logging
from datetime import datetime, timedelta
import importlib.util
import pandas as pd
import random
from app.market_data import market_data

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see detailed logs

# Check if finance_calendars is available
fc_available = importlib.util.find_spec("finance_calendars") is not None

if fc_available:
    try:
        from finance_calendars import finance_calendars as fc
        logger.info("Using finance_calendars package for earnings data")
    except ImportError:
        fc_available = False
        logger.warning("Failed to import finance_calendars, will use market data provider as fallback")

def get_earnings_today():
    """
    Get all US earnings reports due on today's date.
    
    Returns:
        list: List of dictionaries containing earnings data
    """
    try:
        # Always try finance_calendars first for accurate BMO/AMC timing
        if fc_available:
            try:
                earnings = fc.get_earnings_today()
                # Handle pandas DataFrame from finance_calendars
                if hasattr(earnings, 'columns'):
                    logger.info(f"Using finance_calendars for earnings data: {len(earnings)} companies")
                    return handle_pandas_dataframe(earnings, datetime.now().strftime('%Y-%m-%d'))
                else:
                    return format_earnings_data(earnings)
            except Exception as e:
                logger.warning(f"Error using finance_calendars: {str(e)}. No fallback available for earnings calendar.")
                return []
        else:
            logger.warning("finance_calendars not available. No earnings calendar data available.")
            return []
    except Exception as e:
        logger.error(f"Error fetching today's earnings: {str(e)}")
        return []

def get_earnings_by_date(date=None):
    """
    Get all US earnings reports due on the specified date.
    
    Args:
        date (datetime, optional): Date to get earnings for. Defaults to None (today).
        
    Returns:
        list: List of dictionaries containing earnings data
    """
    try:
        if date is None:
            date = datetime.now()
            
        # Always try finance_calendars first for accurate BMO/AMC timing
        if fc_available:
            try:
                earnings = fc.get_earnings_by_date(date)
                # Handle pandas DataFrame from finance_calendars
                if hasattr(earnings, 'columns'):
                    logger.info(f"Using finance_calendars for earnings data on {date.strftime('%Y-%m-%d')}: {len(earnings)} companies")
                    return handle_pandas_dataframe(earnings, date.strftime('%Y-%m-%d'))
                else:
                    return format_earnings_data(earnings)
            except Exception as e:
                logger.warning(f"Error using finance_calendars: {str(e)}. No fallback available for earnings calendar.")
                return []
        else:
            logger.warning("finance_calendars not available. No earnings calendar data available.")
            return []
    except Exception as e:
        logger.error(f"Error fetching earnings for {date.strftime('%Y-%m-%d')}: {str(e)}")
        return []

# This function is now handled by the market_data module

def get_earnings_this_week():
    """
    Get all US earnings reports due this week.
    
    Returns:
        dict: Dictionary with dates as keys and lists of earnings data as values
    """
    try:
        today = datetime.now()
        # Find the start of the week (Monday)
        start_of_week = today - timedelta(days=today.weekday())
        
        # Get earnings for each day of the week
        earnings_by_day = {}
        for i in range(5):  # Monday to Friday
            date = start_of_week + timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            earnings = fc.get_earnings_by_date(date)
            if earnings:
                earnings_by_day[date_str] = format_earnings_data(earnings)
        
        return earnings_by_day
    except Exception as e:
        logger.error(f"Error fetching this week's earnings: {str(e)}")
        return {}

def format_earnings_data(earnings_data):
    """
    Format earnings data into a standardized structure.
    
    Args:
        earnings_data (list): Raw earnings data from finance_calendars
        
    Returns:
        list: Formatted earnings data
    """
    formatted_data = []
    
    for item in earnings_data:
        try:
            # Extract relevant information
            formatted_item = {
                "ticker": item.get("symbol", ""),
                "companyName": item.get("name", ""),
                "reportTime": determine_report_time(item.get("when", "")),
                "date": item.get("date", ""),
                "estimatedEPS": item.get("estimate", None),
                "actualEPS": item.get("actual", None)
            }
            formatted_data.append(formatted_item)
        except Exception as e:
            logger.error(f"Error formatting earnings data: {str(e)}")
            continue
    
    return formatted_data

def determine_report_time(time_str):
    """
    Determine the report time category from the time string.
    
    Args:
        time_str (str): Time string from earnings data
        
    Returns:
        str: Report time category (BMO, AMC, or DMH)
    """
    time_str = time_str.lower() if time_str else ""
    
    if "before" in time_str or "bmo" in time_str or "morning" in time_str:
        return "BMO"  # Before Market Open
    elif "after" in time_str or "amc" in time_str or "afternoon" in time_str or "evening" in time_str:
        return "AMC"  # After Market Close
    else:
        return "DMH"  # During Market Hours

def handle_pandas_dataframe(df, date_str):
    """
    Handle pandas DataFrame returned by finance_calendars.
    
    Args:
        df (pandas.DataFrame): DataFrame with earnings data
        date_str (str): Date string in YYYY-MM-DD format
        
    Returns:
        list: List of earnings calendar items in our format
    """
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
                if 'pre-market' in time_val or 'bmo' in time_val or 'before' in time_val or 'morning' in time_val:
                    report_time = 'BMO'
                elif 'after-hours' in time_val or 'amc' in time_val or 'after' in time_val or 'evening' in time_val:
                    report_time = 'AMC'
                elif 'not-supplied' in time_val:
                    report_time = 'AMC'  # Default when time not specified
                # Log the time value for debugging
                logger.info(f"Ticker: {ticker}, Time value: '{time_val}', interpreted as: {report_time}")
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

# REMOVED: generate_sample_earnings function - we should never use fake data in production