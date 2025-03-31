"""
Earnings Calendar Module

This module handles fetching earnings calendar data using the finance_calendars package
or yfinance as a fallback.
"""

import logging
from datetime import datetime, timedelta
import importlib.util

# Set up logging
logger = logging.getLogger(__name__)

# Check if finance_calendars is available
fc_available = importlib.util.find_spec("finance_calendars") is not None

if fc_available:
    try:
        from finance_calendars import finance_calendars as fc
        logger.info("Using finance_calendars package for earnings data")
    except ImportError:
        fc_available = False
        logger.warning("Failed to import finance_calendars, will use yfinance as fallback")

# Always import yfinance as a fallback
import yfinance as yf

def get_earnings_today():
    """
    Get all US earnings reports due on today's date.
    
    Returns:
        list: List of dictionaries containing earnings data
    """
    try:
        if fc_available:
            try:
                earnings = fc.get_earnings_today()
                return format_earnings_data(earnings)
            except Exception as e:
                logger.warning(f"Error using finance_calendars: {str(e)}. Falling back to yfinance.")
        
        # Fallback to yfinance
        return get_earnings_from_yfinance()
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
            
        if fc_available:
            try:
                earnings = fc.get_earnings_by_date(date)
                return format_earnings_data(earnings)
            except Exception as e:
                logger.warning(f"Error using finance_calendars: {str(e)}. Falling back to yfinance.")
        
        # Fallback to yfinance
        return get_earnings_from_yfinance(date)
    except Exception as e:
        logger.error(f"Error fetching earnings for {date.strftime('%Y-%m-%d')}: {str(e)}")
        return []

def get_earnings_from_yfinance(date=None):
    """
    Get earnings data using yfinance as a fallback.
    
    Args:
        date (datetime, optional): Date to get earnings for. Defaults to None (today).
        
    Returns:
        list: List of dictionaries containing earnings data
    """
    try:
        # Get earnings calendar from yfinance
        calendar = yf.get_earnings_calendar()
        
        # Filter by date if specified
        if date is not None:
            date_str = date.strftime('%Y-%m-%d')
            calendar = calendar[calendar['Earnings Date'].dt.strftime('%Y-%m-%d') == date_str]
        else:
            today_str = datetime.now().strftime('%Y-%m-%d')
            calendar = calendar[calendar['Earnings Date'].dt.strftime('%Y-%m-%d') == today_str]
        
        # Convert to our format
        formatted_data = []
        for _, row in calendar.iterrows():
            formatted_data.append({
                "symbol": row['Symbol'],
                "name": row['Company'],
                "when": "before market open" if "BMO" in str(row['Call Time']) else "after market close",
                "date": row['Earnings Date'].strftime('%Y-%m-%d'),
                "estimate": row['EPS Estimate'] if 'EPS Estimate' in row else None,
                "actual": row['Reported EPS'] if 'Reported EPS' in row else None
            })
        
        return formatted_data
    except Exception as e:
        logger.error(f"Error fetching earnings from yfinance: {str(e)}")
        return []

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