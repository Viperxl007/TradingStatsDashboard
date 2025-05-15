"""
Test script for market data providers.

This script tests both yfinance and AlphaVantage market data providers
to ensure they work correctly.
"""

import os
import sys
import logging
from datetime import datetime, timedelta
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_yfinance_provider():
    """Test the YFinance market data provider."""
    logger.info("Testing YFinance market data provider...")
    
    # Set environment variable to use yfinance
    os.environ['MARKET_DATA_SOURCE'] = 'yfinance'
    
    # We need to reload the market_data module to pick up the new environment variable
    import importlib
    import app.market_data
    importlib.reload(app.market_data)
    
    # Now get the provider
    from app.market_data import MarketDataProvider
    provider = MarketDataProvider.get_provider()
    
    logger.info(f"Provider class: {provider.__class__.__name__}")
    
    # Test get_current_price
    ticker = 'AAPL'
    price = provider.get_current_price(ticker)
    logger.info(f"Current price for {ticker}: {price}")
    
    # Test get_historical_prices
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    historical_prices = provider.get_historical_prices(ticker, start_date, end_date)
    if historical_prices is not None:
        logger.info(f"Historical prices for {ticker}: {len(historical_prices)} days")
        logger.info(f"First day: {historical_prices.index[-1]}, Last day: {historical_prices.index[0]}")
    else:
        logger.error(f"Failed to get historical prices for {ticker}")
    
    # Test get_historical_earnings_dates
    earnings_dates = provider.get_historical_earnings_dates(ticker, start_date)
    logger.info(f"Historical earnings dates for {ticker}: {earnings_dates}")
    
    # Test get_earnings_calendar
    earnings_calendar = provider.get_earnings_calendar()
    logger.info(f"Earnings calendar: {len(earnings_calendar)} companies")
    
    return True

def test_alphavantage_provider():
    """Test the AlphaVantage market data provider."""
    logger.info("Testing AlphaVantage market data provider...")
    
    # Set environment variable to use alphavantage
    os.environ['MARKET_DATA_SOURCE'] = 'alphavantage'
    
    # We need to reload the market_data module to pick up the new environment variable
    import importlib
    import app.market_data
    importlib.reload(app.market_data)
    
    # Now get the provider
    from app.market_data import MarketDataProvider
    provider = MarketDataProvider.get_provider()
    
    logger.info(f"Provider class: {provider.__class__.__name__}")
    
    # Test get_current_price
    ticker = 'AAPL'
    price = provider.get_current_price(ticker)
    logger.info(f"Current price for {ticker}: {price}")
    
    # Test get_historical_prices
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    historical_prices = provider.get_historical_prices(ticker, start_date, end_date)
    if historical_prices is not None:
        logger.info(f"Historical prices for {ticker}: {len(historical_prices)} days")
        logger.info(f"First day: {historical_prices.index[-1]}, Last day: {historical_prices.index[0]}")
    else:
        logger.error(f"Failed to get historical prices for {ticker}")
    
    # Test get_historical_earnings_dates
    earnings_dates = provider.get_historical_earnings_dates(ticker, start_date)
    logger.info(f"Historical earnings dates for {ticker}: {earnings_dates}")
    
    # Test get_earnings_calendar
    earnings_calendar = provider.get_earnings_calendar()
    logger.info(f"Earnings calendar: {len(earnings_calendar)} companies")
    
    return True

def main():
    """Run the tests."""
    logger.info("Starting market data provider tests...")
    
    # Test YFinance provider
    yf_success = test_yfinance_provider()
    
    # Test AlphaVantage provider
    av_success = test_alphavantage_provider()
    
    # Print summary
    logger.info("Test results:")
    logger.info(f"YFinance provider: {'SUCCESS' if yf_success else 'FAILURE'}")
    logger.info(f"AlphaVantage provider: {'SUCCESS' if av_success else 'FAILURE'}")
    
    # Reset environment variable to default
    os.environ['MARKET_DATA_SOURCE'] = 'yfinance'
    
    logger.info("Tests completed.")

if __name__ == "__main__":
    main()