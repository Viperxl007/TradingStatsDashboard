"""
Data Fetcher Module

This module handles fetching stock and options data from external sources.
"""

import yfinance as yf
import logging
from datetime import datetime, timedelta

# Set up logging
logger = logging.getLogger(__name__)

def get_stock_data(ticker):
    """
    Get stock data for a given ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        Ticker: yfinance Ticker object
    """
    try:
        return yf.Ticker(ticker)
    except Exception as e:
        logger.error(f"Error fetching stock data for {ticker}: {str(e)}")
        return None

def get_options_data(stock, expiration_date):
    """
    Get options data for a given stock and expiration date.
    
    Args:
        stock (Ticker): yfinance Ticker object
        expiration_date (str): Option expiration date in YYYY-MM-DD format
        
    Returns:
        tuple: (calls DataFrame, puts DataFrame)
    """
    try:
        options_chain = stock.option_chain(expiration_date)
        return options_chain.calls, options_chain.puts
    except Exception as e:
        logger.error(f"Error fetching options data for {stock.ticker} expiring {expiration_date}: {str(e)}")
        return None, None

def get_current_price(stock):
    """
    Get the current price for a stock.
    
    Args:
        stock (Ticker or str): yfinance Ticker object or ticker symbol string
        
    Returns:
        float: Current stock price
    """
    try:
        # Handle both Ticker objects and string ticker symbols
        if isinstance(stock, str):
            ticker_obj = yf.Ticker(stock)
            ticker_symbol = stock
        else:
            ticker_obj = stock
            ticker_symbol = getattr(stock, 'ticker', str(stock))
            
        todays_data = ticker_obj.history(period='1d')
        if todays_data.empty:
            return None
        return todays_data['Close'].iloc[0]
    except Exception as e:
        logger.error(f"Error fetching current price for {ticker_symbol}: {str(e)}")
        return None

def get_price_history(stock, period='3mo'):
    """
    Get price history for a stock.
    
    Args:
        stock (Ticker): yfinance Ticker object
        period (str): Time period for history (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        
    Returns:
        DataFrame: Historical price data
    """
    try:
        return stock.history(period=period)
    except Exception as e:
        logger.error(f"Error fetching price history for {stock.ticker}: {str(e)}")
        return None

def get_stock_info(ticker):
    """
    Get basic information about a stock.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict: Stock information
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        # Extract relevant information
        return {
            "ticker": ticker,
            "name": info.get("shortName", ""),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "marketCap": info.get("marketCap", 0),
            "previousClose": info.get("previousClose", 0),
            "open": info.get("open", 0),
            "dayHigh": info.get("dayHigh", 0),
            "dayLow": info.get("dayLow", 0),
            "volume": info.get("volume", 0),
            "averageVolume": info.get("averageVolume", 0),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh", 0),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow", 0),
            "beta": info.get("beta", 0),
            "trailingPE": info.get("trailingPE", 0),
            "forwardPE": info.get("forwardPE", 0),
            "dividendYield": info.get("dividendYield", 0) if info.get("dividendYield") else 0,
            "timestamp": datetime.now().timestamp()
        }
    except Exception as e:
        logger.error(f"Error fetching stock info for {ticker}: {str(e)}")
        return {
            "ticker": ticker,
            "error": str(e)
        }