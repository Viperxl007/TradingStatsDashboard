"""
Market Data Module

This module provides an abstraction layer for fetching market data from different sources.
Currently supported sources:
- yfinance (default)
- AlphaVantage

The module uses the MARKET_DATA_SOURCE configuration to determine which source to use.
"""

import logging
import pandas as pd
import requests
from datetime import datetime, timedelta
import time
from typing import Dict, List, Any, Optional, Tuple, Union
from app.rate_limiter import RateLimiter
import os
import importlib

# Import config dynamically to avoid import-time evaluation
def get_config():
    """Get configuration values dynamically."""
    try:
        import config
        return {
            'MARKET_DATA_SOURCE': config.MARKET_DATA_SOURCE,
            'ALPHAVANTAGE_API_KEY': config.ALPHAVANTAGE_API_KEY,
            'AV_RATE_LIMIT': config.AV_RATE_LIMIT
        }
    except ImportError:
        # Fallback to environment variables if config module is not available
        return {
            'MARKET_DATA_SOURCE': os.environ.get('MARKET_DATA_SOURCE', 'yfinance'),
            'ALPHAVANTAGE_API_KEY': os.environ.get('ALPHAVANTAGE_API_KEY', 'ZB4OJAXNSXX8PAV6'),
            'AV_RATE_LIMIT': {'rate': 1.25, 'per': 1.0, 'burst': 5}
        }

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Create a rate limiter for AlphaVantage
config = get_config()
av_rate_limiter = RateLimiter(
    rate=config['AV_RATE_LIMIT'].get("rate", 1.25),
    per=config['AV_RATE_LIMIT'].get("per", 1.0),
    burst=config['AV_RATE_LIMIT'].get("burst", 5)
)

class MarketDataProvider:
    """
    Factory class for creating market data providers based on configuration.
    """
    @staticmethod
    def get_provider():
        """
        Get the configured market data provider.
        
        Returns:
            BaseMarketDataProvider: An instance of the configured market data provider
        """
        # Get the latest configuration
        config = get_config()
        market_data_source = config['MARKET_DATA_SOURCE'].lower()
        
        if market_data_source == 'alphavantage':
            logger.warning("===== USING ALPHAVANTAGE AS MARKET DATA SOURCE =====")
            return AlphaVantageProvider(config['ALPHAVANTAGE_API_KEY'])
        else:
            logger.warning("===== USING YFINANCE AS MARKET DATA SOURCE =====")
            return YFinanceProvider()


class BaseMarketDataProvider:
    """
    Base class for market data providers.
    All market data providers should inherit from this class and implement its methods.
    """
    
    def get_current_price(self, ticker: str) -> Optional[float]:
        """
        Get the current price for a ticker.
        
        Args:
            ticker (str): Stock ticker symbol
            
        Returns:
            float: Current stock price or None if an error occurs
        """
        raise NotImplementedError("Subclasses must implement get_current_price")
    
    def get_historical_prices(self, ticker: str, start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
        """
        Get historical daily price data for a stock.
        
        Args:
            ticker (str): Stock ticker symbol
            start_date (datetime): Start date for historical data
            end_date (datetime): End date for historical data
            
        Returns:
            DataFrame with historical price data or None if retrieval fails
        """
        raise NotImplementedError("Subclasses must implement get_historical_prices")
    
    def get_historical_earnings_dates(self, ticker: str, start_date: datetime) -> List[str]:
        """
        Get historical earnings announcement dates for a stock.
        
        Args:
            ticker (str): Stock ticker symbol
            start_date (datetime): Start date for historical data
            
        Returns:
            List of earnings dates in YYYY-MM-DD format
        """
        raise NotImplementedError("Subclasses must implement get_historical_earnings_dates")
    
    def get_earnings_calendar(self, date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get earnings calendar for a specific date.
        
        Args:
            date (datetime, optional): Date to get earnings for. Defaults to None (today).
            
        Returns:
            List of dictionaries containing earnings data
        """
        raise NotImplementedError("Subclasses must implement get_earnings_calendar")


class YFinanceProvider(BaseMarketDataProvider):
    """
    Market data provider using yfinance.
    """
    
    def get_current_price(self, ticker: str) -> Optional[float]:
        """
        Get the current price for a ticker with rate limiting.
        
        Args:
            ticker (str): Stock ticker symbol
            
        Returns:
            float: Current stock price or None if an error occurs
        """
        from app.rate_limiter import yf_rate_limiter, _yf_api_lock
        import yfinance as yf
        
        try:
            logger.debug(f"[YFINANCE API] Getting current price for {ticker}")
            # Acquire rate limiter token with timeout
            if not yf_rate_limiter.acquire(block=True, timeout=10):
                logger.warning(f"Rate limit exceeded for {ticker}, skipping")
                return None
                
            # Use thread lock for thread safety
            with _yf_api_lock:
                stock = yf.Ticker(ticker)
                todays_data = stock.history(period='1d')
                
                if todays_data.empty:
                    logger.warning(f"No data available for {ticker}")
                    return None
                    
                price = todays_data['Close'].iloc[0]
                logger.debug(f"[YFINANCE API] Got price for {ticker}: {price}")
                return price
        except Exception as e:
            logger.error(f"Error getting current price for {ticker}: {str(e)}")
            return None
    
    def get_historical_prices(self, ticker: str, start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
        """
        Get historical daily price data for a stock.
        
        Args:
            ticker (str): Stock ticker symbol
            start_date (datetime): Start date for historical data
            end_date (datetime): End date for historical data
            
        Returns:
            DataFrame with historical price data or None if retrieval fails
        """
        import yfinance as yf
        
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
                
            logger.debug(f"[YFINANCE API] Got historical prices for {ticker}: {len(historical_data)} days")
            return historical_data
            
        except Exception as e:
            logger.error(f"Error getting historical prices: {str(e)}")
            return None
    
    def get_historical_earnings_dates(self, ticker: str, start_date: datetime) -> List[str]:
        """
        Get historical earnings announcement dates for a stock.
        
        Args:
            ticker (str): Stock ticker symbol
            start_date (datetime): Start date for historical data
            
        Returns:
            List of earnings dates in YYYY-MM-DD format
        """
        import yfinance as yf
        
        try:
            # Get the stock data using yfinance
            stock = yf.Ticker(ticker)
            
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
            
            logger.warning(f"Could not retrieve earnings dates for {ticker}")
            return []
            
        except Exception as e:
            logger.error(f"Error getting historical earnings dates: {str(e)}")
            return []
    
    def get_earnings_calendar(self, date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get earnings calendar for a specific date using yfinance.
        
        Args:
            date (datetime, optional): Date to get earnings for. Defaults to None (today).
            
        Returns:
            List of dictionaries containing earnings data
        """
        import yfinance as yf
        
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
                    "ticker": row['Symbol'],
                    "companyName": row['Company'],
                    "reportTime": "before market open" if "BMO" in str(row['Call Time']) else "after market close",
                    "date": row['Earnings Date'].strftime('%Y-%m-%d'),
                    "estimatedEPS": row['EPS Estimate'] if 'EPS Estimate' in row else None,
                    "actualEPS": row['Reported EPS'] if 'Reported EPS' in row else None
                })
            
            return formatted_data
        except Exception as e:
            logger.error(f"Error fetching earnings from yfinance: {str(e)}")
            return []


class AlphaVantageProvider(BaseMarketDataProvider):
    """
    Market data provider using AlphaVantage.
    """
    
    def __init__(self, api_key):
        """
        Initialize the AlphaVantage provider.
        
        Args:
            api_key (str): AlphaVantage API key
        """
        self.api_key = api_key
        self.base_url = "https://www.alphavantage.co/query"
    
    def _make_request(self, params: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """
        Make a request to the AlphaVantage API with rate limiting.
        
        Args:
            params (Dict[str, str]): Request parameters
            
        Returns:
            Dict or None: JSON response or None if an error occurs
        """
        try:
            # Add API key to parameters
            params['apikey'] = self.api_key
            
            # Acquire rate limiter token with timeout
            if not av_rate_limiter.acquire(block=True, timeout=10):
                logger.warning(f"AlphaVantage rate limit exceeded, skipping request")
                return None
            
            # Make the request
            response = requests.get(self.base_url, params=params)
            
            # Check for errors
            if response.status_code != 200:
                logger.error(f"AlphaVantage API error: {response.status_code} - {response.text}")
                return None
            
            # Parse JSON response
            data = response.json()
            
            # Check for API error messages
            if 'Error Message' in data:
                logger.error(f"AlphaVantage API error: {data['Error Message']}")
                return None
            
            if 'Information' in data and 'Note' in data:
                logger.warning(f"AlphaVantage API note: {data['Note']}")
            
            return data
        except Exception as e:
            logger.error(f"Error making AlphaVantage request: {str(e)}")
            return None
    
    def get_current_price(self, ticker: str) -> Optional[float]:
        """
        Get the current price for a ticker using AlphaVantage.
        
        Args:
            ticker (str): Stock ticker symbol
            
        Returns:
            float: Current stock price or None if an error occurs
        """
        try:
            logger.debug(f"[ALPHAVANTAGE API] Getting current price for {ticker}")
            # Use the GLOBAL_QUOTE endpoint to get the current price
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': ticker
            }
            
            data = self._make_request(params)
            
            if data is None or 'Global Quote' not in data:
                logger.warning(f"No quote data available for {ticker}")
                return None
            
            quote_data = data['Global Quote']
            
            if '05. price' not in quote_data:
                logger.warning(f"No price data in quote for {ticker}")
                return None
            
            price = float(quote_data['05. price'])
            logger.debug(f"[ALPHAVANTAGE API] Got price for {ticker}: {price}")
            return price
        except Exception as e:
            logger.error(f"Error getting current price for {ticker}: {str(e)}")
            return None
    
    def get_historical_prices(self, ticker: str, start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
        """
        Get historical daily price data for a stock using AlphaVantage.
        
        Args:
            ticker (str): Stock ticker symbol
            start_date (datetime): Start date for historical data
            end_date (datetime): End date for historical data
            
        Returns:
            DataFrame with historical price data or None if retrieval fails
        """
        try:
            # Use the TIME_SERIES_DAILY endpoint to get historical prices
            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': ticker,
                'outputsize': 'full'  # Get full data to ensure we have the date range
            }
            
            data = self._make_request(params)
            
            if data is None or 'Time Series (Daily)' not in data:
                logger.warning(f"No historical price data available for {ticker}")
                return None
            
            # Convert the nested dictionary to a DataFrame
            time_series = data['Time Series (Daily)']
            df = pd.DataFrame.from_dict(time_series, orient='index')
            
            # Rename columns to match yfinance format
            df.rename(columns={
                '1. open': 'Open',
                '2. high': 'High',
                '3. low': 'Low',
                '4. close': 'Close',
                '5. volume': 'Volume'
            }, inplace=True)
            
            # Convert string values to float
            for col in ['Open', 'High', 'Low', 'Close']:
                df[col] = df[col].astype(float)
            
            # Convert volume to integer
            df['Volume'] = df['Volume'].astype(int)
            
            # Convert index to datetime
            df.index = pd.to_datetime(df.index)
            
            # Sort by date (newest first to match yfinance)
            df.sort_index(ascending=False, inplace=True)
            
            # Filter by date range
            start_str = start_date.strftime('%Y-%m-%d')
            end_str = end_date.strftime('%Y-%m-%d')
            df = df[(df.index >= start_str) & (df.index <= end_str)]
            
            if df.empty:
                logger.warning(f"No historical price data found for {ticker} in the specified date range")
                return None
            
            logger.debug(f"[ALPHAVANTAGE API] Got historical prices for {ticker}: {len(df)} days")
            return df
        except Exception as e:
            logger.error(f"Error getting historical prices: {str(e)}")
            return None
    
    def get_historical_earnings_dates(self, ticker: str, start_date: datetime) -> List[str]:
        """
        Get historical earnings announcement dates for a stock using AlphaVantage.
        
        Args:
            ticker (str): Stock ticker symbol
            start_date (datetime): Start date for historical data
            
        Returns:
            List of earnings dates in YYYY-MM-DD format
        """
        try:
            # AlphaVantage doesn't have a direct API for historical earnings dates
            # We'll use the quarterly earnings data as a proxy
            params = {
                'function': 'EARNINGS',
                'symbol': ticker
            }
            
            data = self._make_request(params)
            
            if data is None or 'quarterlyEarnings' not in data:
                logger.warning(f"No earnings data available for {ticker}")
                return []
            
            # Extract earnings dates from quarterly earnings
            quarterly_earnings = data['quarterlyEarnings']
            earnings_dates = []
            
            for quarter in quarterly_earnings:
                if 'reportedDate' in quarter:
                    earnings_dates.append(quarter['reportedDate'])
            
            # Filter dates after start_date
            start_date_str = start_date.strftime('%Y-%m-%d')
            earnings_dates = [date for date in earnings_dates if date >= start_date_str]
            
            return sorted(earnings_dates)
        except Exception as e:
            logger.error(f"Error getting historical earnings dates: {str(e)}")
            return []
    
    def get_earnings_calendar(self, date: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get earnings calendar for a specific date.
        
        Note: AlphaVantage doesn't have a direct API for earnings calendar.
        This is a limitation of the API, so we return an empty list.
        
        Args:
            date (datetime, optional): Date to get earnings for. Defaults to None (today).
            
        Returns:
            List of dictionaries containing earnings data (empty list for AlphaVantage)
        """
        logger.warning("AlphaVantage does not provide an earnings calendar API. Returning empty list.")
        return []


# Create a singleton instance of the market data provider
market_data = MarketDataProvider.get_provider()