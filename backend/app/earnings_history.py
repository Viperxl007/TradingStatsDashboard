import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Any, Optional, Tuple

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_earnings_history(ticker: str, years: int = 7) -> Dict[str, Any]:
    """
    Get historical earnings dates and the stock's performance the day after earnings
    for the specified ticker over the past N years.
    
    Args:
        ticker (str): The stock ticker symbol
        years (int): Number of years of history to retrieve (default: 7)
        
    Returns:
        Dict with earnings dates and post-earnings performance data
    """
    try:
        logger.info(f"Fetching earnings history for {ticker} over the past {years} years")
        
        # Calculate the start date (N years ago from today)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=years * 365)
        
        # Get the stock data using yfinance
        stock = yf.Ticker(ticker)
        
        # Get earnings dates
        earnings_dates = get_historical_earnings_dates(stock, start_date)
        if not earnings_dates:
            return {"error": f"No earnings data found for {ticker}"}
        
        # Get historical prices
        historical_prices = get_historical_prices(ticker, start_date, end_date)
        if historical_prices is None:
            return {"error": f"Failed to retrieve historical price data for {ticker}"}
        
        # Calculate post-earnings performance
        performance_data = calculate_post_earnings_performance(earnings_dates, historical_prices)
        
        return {
            "ticker": ticker,
            "earnings_dates": earnings_dates,
            "performance_data": performance_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching earnings history for {ticker}: {str(e)}")
        return {"error": str(e)}

def get_historical_earnings_dates(stock: yf.Ticker, start_date: datetime) -> List[str]:
    """
    Get historical earnings announcement dates for a stock.
    
    Args:
        stock (yf.Ticker): yfinance Ticker object
        start_date (datetime): Start date for historical data
        
    Returns:
        List of earnings dates in YYYY-MM-DD format
    """
    try:
        # Get earnings calendar from yfinance
        earnings_calendar = stock.calendar
        
        # If no calendar data, try to get earnings history
        if earnings_calendar is None or len(earnings_calendar) == 0:
            earnings_history = stock.earnings_history
            
            if earnings_history is not None and not earnings_history.empty:
                # Extract earnings dates
                earnings_dates = earnings_history.index.strftime('%Y-%m-%d').tolist()
                
                # Filter dates after start_date
                start_date_str = start_date.strftime('%Y-%m-%d')
                earnings_dates = [date for date in earnings_dates if date >= start_date_str]
                
                return earnings_dates
        
        # If we have calendar data
        if earnings_calendar is not None and 'Earnings Date' in earnings_calendar:
            # Get the next earnings date
            next_earnings_date = earnings_calendar['Earnings Date']
            if isinstance(next_earnings_date, pd.Timestamp):
                next_earnings_date = next_earnings_date.strftime('%Y-%m-%d')
            
            # Try to get historical earnings from quarterly financials
            quarterly_financials = stock.quarterly_financials
            if quarterly_financials is not None and not quarterly_financials.empty:
                historical_dates = quarterly_financials.columns.strftime('%Y-%m-%d').tolist()
                
                # Filter dates after start_date
                start_date_str = start_date.strftime('%Y-%m-%d')
                historical_dates = [date for date in historical_dates if date >= start_date_str]
                
                # Add next earnings date if it exists
                if next_earnings_date and next_earnings_date not in historical_dates:
                    historical_dates.append(next_earnings_date)
                
                return sorted(historical_dates)
        
        # If we couldn't get earnings dates from yfinance, try a different approach
        # Use quarterly earnings data as a fallback
        quarterly_earnings = stock.quarterly_earnings
        if quarterly_earnings is not None and not quarterly_earnings.empty:
            earnings_dates = quarterly_earnings.index.strftime('%Y-%m-%d').tolist()
            
            # Filter dates after start_date
            start_date_str = start_date.strftime('%Y-%m-%d')
            earnings_dates = [date for date in earnings_dates if date >= start_date_str]
            
            return earnings_dates
        
        logger.warning(f"Could not retrieve earnings dates for {stock.ticker}")
        return []
        
    except Exception as e:
        logger.error(f"Error getting historical earnings dates: {str(e)}")
        return []

def get_historical_prices(ticker: str, start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
    """
    Get historical daily price data for a stock.
    
    Args:
        ticker (str): Stock ticker symbol
        start_date (datetime): Start date for historical data
        end_date (datetime): End date for historical data
        
    Returns:
        DataFrame with historical price data or None if retrieval fails
    """
    try:
        # Format dates for yfinance
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = end_date.strftime('%Y-%m-%d')
        
        # Get historical data
        historical_data = yf.download(
            ticker,
            start=start_str,
            end=end_str,
            progress=False
        )
        
        if historical_data.empty:
            logger.warning(f"No historical price data found for {ticker}")
            return None
            
        return historical_data
        
    except Exception as e:
        logger.error(f"Error getting historical prices: {str(e)}")
        return None

def calculate_post_earnings_performance(earnings_dates: List[str], 
                                       historical_prices: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Calculate the stock's performance the day after each earnings announcement.
    
    Args:
        earnings_dates (List[str]): List of earnings dates in YYYY-MM-DD format
        historical_prices (pd.DataFrame): DataFrame with historical price data
        
    Returns:
        List of dictionaries with date and performance data
    """
    performance_data = []
    
    for earnings_date in earnings_dates:
        try:
            # Convert string date to datetime
            earnings_datetime = pd.to_datetime(earnings_date)
            
            # Find the next trading day
            next_day = earnings_datetime + pd.Timedelta(days=1)
            while next_day not in historical_prices.index:
                next_day += pd.Timedelta(days=1)
                # If we've looked 7 days ahead and still no trading day, skip this earnings date
                if (next_day - earnings_datetime).days > 7:
                    logger.warning(f"Could not find trading day after earnings on {earnings_date}")
                    break
            
            # Find the previous trading day
            prev_day = earnings_datetime
            while prev_day not in historical_prices.index:
                prev_day -= pd.Timedelta(days=1)
                # If we've looked 7 days back and still no trading day, skip this earnings date
                if (earnings_datetime - prev_day).days > 7:
                    logger.warning(f"Could not find trading day before earnings on {earnings_date}")
                    break
            
            # If we found both days in the price data
            if next_day in historical_prices.index and prev_day in historical_prices.index:
                # Calculate percentage change
                prev_close = historical_prices.loc[prev_day, 'Close']
                next_close = historical_prices.loc[next_day, 'Close']
                percent_change = ((next_close - prev_close) / prev_close) * 100
                
                # Add to performance data
                performance_data.append({
                    "earnings_date": earnings_date,
                    "next_trading_day": next_day.strftime('%Y-%m-%d'),
                    "percent_change": round(percent_change, 2)
                })
                
        except Exception as e:
            logger.error(f"Error calculating performance for earnings date {earnings_date}: {str(e)}")
    
    # Sort by earnings date
    performance_data.sort(key=lambda x: x["earnings_date"])
    
    return performance_data

def get_earnings_performance_stats(performance_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate statistics about the stock's post-earnings performance.
    
    Args:
        performance_data (List[Dict]): List of dictionaries with performance data
        
    Returns:
        Dictionary with performance statistics
    """
    if not performance_data:
        return {
            "count": 0,
            "avg_percent_change": 0,
            "median_percent_change": 0,
            "min_percent_change": 0,
            "max_percent_change": 0,
            "positive_count": 0,
            "negative_count": 0
        }
    
    # Extract percent changes
    percent_changes = [item["percent_change"] for item in performance_data]
    
    # Calculate statistics
    avg_change = sum(percent_changes) / len(percent_changes)
    median_change = sorted(percent_changes)[len(percent_changes) // 2]
    min_change = min(percent_changes)
    max_change = max(percent_changes)
    positive_count = sum(1 for change in percent_changes if change > 0)
    negative_count = sum(1 for change in percent_changes if change < 0)
    
    return {
        "count": len(percent_changes),
        "avg_percent_change": round(avg_change, 2),
        "median_percent_change": round(median_change, 2),
        "min_percent_change": round(min_change, 2),
        "max_percent_change": round(max_change, 2),
        "positive_count": positive_count,
        "negative_count": negative_count,
        "positive_percentage": round((positive_count / len(percent_changes)) * 100, 2)
    }