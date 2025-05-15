import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Any, Optional, Tuple
from app.utils import convert_numpy_types
from app.market_data import market_data

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see detailed logs

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
        
        # Get earnings dates
        earnings_dates = market_data.get_historical_earnings_dates(ticker, start_date)
        if not earnings_dates:
            return {"error": f"No earnings data found for {ticker}"}
        
        # Get historical prices
        historical_prices = get_historical_prices(ticker, start_date, end_date)
        if historical_prices is None:
            return {"error": f"Failed to retrieve historical price data for {ticker}"}
        
        # Calculate post-earnings performance
        performance_data = calculate_post_earnings_performance(earnings_dates, historical_prices)
        
        result = {
            "ticker": ticker,
            "earnings_dates": earnings_dates,
            "performance_data": performance_data
        }
        
        # Convert any NumPy types to Python native types
        return convert_numpy_types(result)
        
    except Exception as e:
        logger.error(f"Error fetching earnings history for {ticker}: {str(e)}")
        return {"error": str(e)}

# This function is now handled by the market_data module

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
    return market_data.get_historical_prices(ticker, start_date, end_date)

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
    
    result = {
        "count": len(percent_changes),
        "avg_percent_change": round(avg_change, 2),
        "median_percent_change": round(median_change, 2),
        "min_percent_change": round(min_change, 2),
        "max_percent_change": round(max_change, 2),
        "positive_count": positive_count,
        "negative_count": negative_count,
        "positive_percentage": round((positive_count / len(percent_changes)) * 100, 2)
    }
    
    # Convert any NumPy types to Python native types
    return convert_numpy_types(result)