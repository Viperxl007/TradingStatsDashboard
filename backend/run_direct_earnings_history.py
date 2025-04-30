"""
Earnings History API Extension

This script extends the run_direct.py file with an endpoint for fetching historical earnings data.
It should be imported and used in the main run_direct.py file.
"""

from flask import jsonify, request
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import traceback

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed from INFO to DEBUG to capture all debug logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def register_earnings_history_endpoint(app):
    """Register the earnings history endpoint with the Flask app."""
    
    @app.route('/api/earnings-history/<ticker>', methods=['GET'])
    def get_ticker_earnings_history(ticker):
        """Get historical earnings dates and post-earnings performance for a ticker."""
        try:
            # Get years parameter or use default
            years = request.args.get('years', default=7, type=int)
            
            # Validate years parameter
            if years <= 0 or years > 20:
                return jsonify({
                    "error": "Years parameter must be between 1 and 20",
                    "timestamp": datetime.now().timestamp()
                }), 400
                
            # Calculate the start date (N years ago from today)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=years * 365)
            
            # Get the stock data using yfinance
            stock = yf.Ticker(ticker)
            
            # Get earnings dates
            earnings_dates = []
            estimated_data = False
            
            # Try to get earnings dates using simple methods
            try:
                logger.info(f"Attempting to get earnings dates for {ticker}")
                
                # Method 1: Get earnings calendar from yfinance
                try:
                    earnings_calendar = stock.calendar
                    if earnings_calendar is not None and isinstance(earnings_calendar, dict) and 'Earnings Date' in earnings_calendar:
                        logger.info(f"Found earnings calendar for {ticker}")
                        # Get the next earnings date
                        next_earnings_date = earnings_calendar['Earnings Date']
                        if isinstance(next_earnings_date, pd.Timestamp):
                            next_earnings_date = next_earnings_date.strftime('%Y-%m-%d')
                            earnings_dates.append(next_earnings_date)
                except Exception as e:
                    logger.warning(f"Error getting earnings calendar: {str(e)}")
                
                # Method 2: Get earnings history
                try:
                    earnings_history = stock.earnings_history
                    if earnings_history is not None and not earnings_history.empty:
                        logger.info(f"Found earnings history for {ticker}")
                        # Extract earnings dates
                        history_dates = earnings_history.index.strftime('%Y-%m-%d').tolist()
                        earnings_dates.extend(history_dates)
                except Exception as e:
                    logger.warning(f"Error getting earnings history: {str(e)}")
                
                # Method 3: Try to get historical earnings from quarterly financials
                try:
                    quarterly_financials = stock.quarterly_financials
                    if quarterly_financials is not None and not quarterly_financials.empty:
                        logger.info(f"Found quarterly financials for {ticker}")
                        financials_dates = quarterly_financials.columns.strftime('%Y-%m-%d').tolist()
                        earnings_dates.extend(financials_dates)
                except Exception as e:
                    logger.warning(f"Error getting quarterly financials: {str(e)}")
                
                # Method 4: Use quarterly earnings data
                try:
                    quarterly_earnings = stock.quarterly_earnings
                    if quarterly_earnings is not None and not quarterly_earnings.empty:
                        logger.info(f"Found quarterly earnings for {ticker}")
                        quarterly_dates = quarterly_earnings.index.strftime('%Y-%m-%d').tolist()
                        earnings_dates.extend(quarterly_dates)
                except Exception as e:
                    logger.warning(f"Error getting quarterly earnings: {str(e)}")
                
                # Method 5: Try to infer earnings dates from historical price volatility
                try:
                    # Get historical data
                    hist_data = stock.history(period="7y")
                    if not hist_data.empty:
                        logger.info(f"Analyzing historical price data for {ticker} to find potential earnings dates")
                        
                        # Calculate daily returns and volume changes
                        hist_data['Return'] = hist_data['Close'].pct_change() * 100
                        hist_data['Volume_Change'] = hist_data['Volume'].pct_change() * 100
                        
                        # Remove NaN values
                        hist_data = hist_data.dropna()
                        
                        # Find days with abnormal volatility and volume (potential earnings dates)
                        # We'll look for days with both high price movement and high volume
                        return_mean = hist_data['Return'].mean()
                        return_std = hist_data['Return'].std()
                        volume_mean = hist_data['Volume_Change'].mean()
                        volume_std = hist_data['Volume_Change'].std()
                        
                        # Create a combined score
                        hist_data['Volatility_Score'] = (
                            abs(hist_data['Return'] - return_mean) / return_std +
                            abs(hist_data['Volume_Change'] - volume_mean) / volume_std
                        )
                        
                        # Get the top 28 days by volatility score (approximately 4 per year for 7 years)
                        top_volatile_days = hist_data.nlargest(28, 'Volatility_Score')
                        
                        # Convert to dates
                        potential_dates = top_volatile_days.index.strftime('%Y-%m-%d').tolist()
                        
                        # Group by quarter to avoid having multiple dates in the same quarter
                        quarters = {}
                        for date in potential_dates:
                            date_obj = datetime.strptime(date, '%Y-%m-%d')
                            quarter_key = f"{date_obj.year}-Q{(date_obj.month-1)//3+1}"
                            
                            if quarter_key not in quarters:
                                quarters[quarter_key] = date
                        
                        # Get one date per quarter
                        inferred_dates = list(quarters.values())
                        
                        logger.info(f"Inferred {len(inferred_dates)} potential earnings dates from price volatility")
                        earnings_dates.extend(inferred_dates)
                except Exception as e:
                    logger.warning(f"Error inferring earnings dates from price volatility: {str(e)}")
                
                # Remove duplicates and sort
                earnings_dates = list(set(earnings_dates))
                earnings_dates.sort()
                
                # Filter dates after start_date
                start_date_str = start_date.strftime('%Y-%m-%d')
                earnings_dates = [date for date in earnings_dates if date >= start_date_str]
                
                logger.info(f"Found {len(earnings_dates)} earnings dates for {ticker}")
                
            except Exception as e:
                logger.error(f"Error getting earnings dates: {str(e)}")
                logger.error(traceback.format_exc())
            
            if not earnings_dates:
                # Try to infer earnings dates from historical price data
                logger.warning(f"No earnings data found for {ticker}, inferring dates from price data")
                
                try:
                    # Get historical data for the past years
                    hist_data = yf.download(ticker, period=f"{years}y", progress=False)
                    
                    if not hist_data.empty:
                        # Calculate daily returns and volume changes
                        hist_data['Return'] = hist_data['Close'].pct_change() * 100
                        hist_data['Volume_Change'] = hist_data['Volume'].pct_change() * 100
                        
                        # Remove NaN values
                        hist_data = hist_data.dropna()
                        
                        # Find days with abnormal volatility and volume
                        return_mean = hist_data['Return'].mean()
                        return_std = hist_data['Return'].std()
                        volume_mean = hist_data['Volume_Change'].mean()
                        volume_std = hist_data['Volume_Change'].std()
                        
                        # Create a combined score
                        hist_data['Volatility_Score'] = (
                            abs(hist_data['Return'] - return_mean) / return_std +
                            abs(hist_data['Volume_Change'] - volume_mean) / volume_std
                        )
                        
                        # Get the top days by volatility score (approximately 4 per year)
                        top_count = min(years * 4, 28)  # Cap at 28 dates
                        top_volatile_days = hist_data.nlargest(top_count, 'Volatility_Score')
                        
                        # Convert to dates
                        inferred_dates = top_volatile_days.index.strftime('%Y-%m-%d').tolist()
                        
                        # Group by quarter to avoid having multiple dates in the same quarter
                        quarters = {}
                        for date in inferred_dates:
                            date_obj = datetime.strptime(date, '%Y-%m-%d')
                            quarter_key = f"{date_obj.year}-Q{(date_obj.month-1)//3+1}"
                            
                            if quarter_key not in quarters or quarters[quarter_key]['score'] < hist_data.loc[date, 'Volatility_Score']:
                                quarters[quarter_key] = {
                                    'date': date,
                                    'score': hist_data.loc[date, 'Volatility_Score']
                                }
                        
                        # Get one date per quarter
                        earnings_dates = [item['date'] for item in quarters.values()]
                        logger.info(f"Inferred {len(earnings_dates)} earnings dates from price data")
                    else:
                        # Fallback to simple quarterly estimates if no price data
                        logger.warning(f"No price data found for {ticker}, using simple quarterly estimates")
                        earnings_dates = []
                        current_date = datetime.now()
                        
                        for year in range(current_date.year - years, current_date.year + 1):
                            for month in [3, 6, 9, 12]:
                                estimated_date = datetime(year, month, 15)
                                if estimated_date < current_date:
                                    earnings_dates.append(estimated_date.strftime('%Y-%m-%d'))
                except Exception as e:
                    # Fallback to simple quarterly estimates if inference fails
                    logger.error(f"Error inferring earnings dates: {str(e)}")
                    logger.error(traceback.format_exc())
                    
                    earnings_dates = []
                    current_date = datetime.now()
                    
                    for year in range(current_date.year - years, current_date.year + 1):
                        for month in [3, 6, 9, 12]:
                            estimated_date = datetime(year, month, 15)
                            if estimated_date < current_date:
                                earnings_dates.append(estimated_date.strftime('%Y-%m-%d'))
                
                estimated_data = True
            
            # Get historical prices
            logger.info(f"Downloading historical prices for {ticker}")
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            
            historical_prices = yf.download(
                ticker,
                start=start_str,
                end=end_str,
                progress=False
            )
            
            if historical_prices.empty:
                return jsonify({
                    "error": f"No historical price data found for {ticker}",
                    "ticker": ticker,
                    "timestamp": datetime.now().timestamp()
                }), 404
            
            # Calculate post-earnings performance
            logger.info(f"Calculating post-earnings performance for {ticker}")
            performance_data = []
            
            for earnings_date in earnings_dates:
                try:
                    logger.debug(f"Processing earnings date: {earnings_date}")
                    
                    # Convert string date to datetime
                    earnings_datetime = pd.to_datetime(earnings_date)
                    
                    # Find the next trading day
                    next_day = earnings_datetime + pd.Timedelta(days=1)
                    days_ahead = 0
                    
                    # Check if next_day is in the index
                    while days_ahead < 7:
                        if next_day in historical_prices.index:
                            break
                        next_day += pd.Timedelta(days=1)
                        days_ahead += 1
                    
                    # If we couldn't find a trading day within 7 days, skip this earnings date
                    if days_ahead >= 7:
                        logger.warning(f"Could not find trading day after earnings on {earnings_date}")
                        continue
                    
                    # Find the previous trading day
                    prev_day = earnings_datetime
                    days_back = 0
                    
                    # Check if prev_day is in the index
                    while days_back < 7:
                        if prev_day in historical_prices.index:
                            break
                        prev_day -= pd.Timedelta(days=1)
                        days_back += 1
                    
                    # If we couldn't find a trading day within 7 days back, skip this earnings date
                    if days_back >= 7:
                        logger.warning(f"Could not find trading day before earnings on {earnings_date}")
                        continue
                    
                    # Get the closing prices
                    prev_close = historical_prices.loc[prev_day, 'Close']
                    next_close = historical_prices.loc[next_day, 'Close']
                    
                    # Handle the case where prev_close or next_close might be a Series
                    if isinstance(prev_close, pd.Series):
                        logger.warning(f"prev_close is a Series for {earnings_date}, using first value")
                        prev_close = prev_close.iloc[0]
                    
                    if isinstance(next_close, pd.Series):
                        logger.warning(f"next_close is a Series for {earnings_date}, using first value")
                        next_close = next_close.iloc[0]
                    
                    # Calculate percentage change
                    percent_change = ((next_close - prev_close) / prev_close) * 100
                    
                    # Add to performance data
                    performance_data.append({
                        "earnings_date": earnings_date,
                        "next_trading_day": next_day.strftime('%Y-%m-%d'),
                        "percent_change": round(float(percent_change), 2),  # Ensure it's a float
                        "is_inferred": earnings_date in inferred_dates if 'inferred_dates' in locals() else estimated_data
                    })
                    
                except Exception as e:
                    logger.error(f"Error calculating performance for earnings date {earnings_date}: {str(e)}")
                    logger.error(traceback.format_exc())
            
            # Sort by earnings date
            logger.info(f"Sorting performance data for {ticker}")
            performance_data.sort(key=lambda x: x["earnings_date"])
            
            # Calculate statistics
            logger.info(f"Calculating statistics for {ticker}")
            if performance_data:
                try:
                    # Extract percent changes
                    percent_changes = [float(item["percent_change"]) for item in performance_data]
                    
                    # Calculate statistics
                    avg_change = sum(percent_changes) / len(percent_changes)
                    median_change = sorted(percent_changes)[len(percent_changes) // 2]
                    min_change = min(percent_changes)
                    max_change = max(percent_changes)
                    positive_count = sum(1 for change in percent_changes if change > 0)
                    negative_count = sum(1 for change in percent_changes if change < 0)
                    
                    stats = {
                        "count": len(percent_changes),
                        "avg_percent_change": round(float(avg_change), 2),
                        "median_percent_change": round(float(median_change), 2),
                        "min_percent_change": round(float(min_change), 2),
                        "max_percent_change": round(float(max_change), 2),
                        "positive_count": int(positive_count),
                        "negative_count": int(negative_count),
                        "positive_percentage": round(float((positive_count / len(percent_changes)) * 100), 2)
                    }
                except Exception as e:
                    logger.error(f"Error calculating statistics: {str(e)}")
                    logger.error(traceback.format_exc())
                    stats = {
                        "count": 0,
                        "avg_percent_change": 0,
                        "median_percent_change": 0,
                        "min_percent_change": 0,
                        "max_percent_change": 0,
                        "positive_count": 0,
                        "negative_count": 0,
                        "positive_percentage": 0
                    }
            else:
                stats = {
                    "count": 0,
                    "avg_percent_change": 0,
                    "median_percent_change": 0,
                    "min_percent_change": 0,
                    "max_percent_change": 0,
                    "positive_count": 0,
                    "negative_count": 0,
                    "positive_percentage": 0
                }
            
            # Return the data
            logger.info(f"Preparing response for {ticker}")
            response_data = {
                "ticker": ticker,
                "years": years,
                "data": {
                    "ticker": ticker,
                    "earnings_dates": earnings_dates,
                    "performance_data": performance_data,
                    "stats": stats
                },
                "timestamp": datetime.now().timestamp()
            }
            
            # Add a note if we're using estimated data
            if estimated_data:
                response_data["data"]["note"] = "Using earnings dates inferred from historical price and volume data"
            
            logger.info(f"Successfully processed earnings history for {ticker}")
            return jsonify(response_data)
            
        except Exception as e:
            logger.error(f"Error getting earnings history for {ticker}: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({
                "error": str(e),
                "ticker": ticker,
                "timestamp": datetime.now().timestamp()
            }), 500