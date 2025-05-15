"""
Direct test script for market data providers.

This script directly tests both yfinance and AlphaVantage market data providers
without relying on environment variables.
"""

import logging
from datetime import datetime, timedelta
import sys
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_providers():
    """Test both market data providers directly."""
    # Import the provider classes directly
    from app.market_data import YFinanceProvider, AlphaVantageProvider
    
    # Test YFinance provider
    logger.info("Testing YFinance provider directly...")
    yf_provider = YFinanceProvider()
    logger.info(f"Provider class: {yf_provider.__class__.__name__}")
    
    # Test AlphaVantage provider
    logger.info("Testing AlphaVantage provider directly...")
    # Get API key from config
    try:
        from config import ALPHAVANTAGE_API_KEY
        api_key = ALPHAVANTAGE_API_KEY
    except ImportError:
        api_key = "ZB4OJAXNSXX8PAV6"  # Default key
    
    av_provider = AlphaVantageProvider(api_key)
    logger.info(f"Provider class: {av_provider.__class__.__name__}")
    
    # Test basic functionality with both providers
    ticker = 'AAPL'
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    # Test YFinance get_current_price
    logger.info("Testing YFinance get_current_price...")
    yf_price = yf_provider.get_current_price(ticker)
    logger.info(f"YFinance current price for {ticker}: {yf_price}")
    
    # Test AlphaVantage get_current_price
    logger.info("Testing AlphaVantage get_current_price...")
    av_price = av_provider.get_current_price(ticker)
    logger.info(f"AlphaVantage current price for {ticker}: {av_price}")
    
    # Test YFinance get_historical_prices
    logger.info("Testing YFinance get_historical_prices...")
    yf_hist = yf_provider.get_historical_prices(ticker, start_date, end_date)
    if yf_hist is not None:
        logger.info(f"YFinance historical prices for {ticker}: {len(yf_hist)} days")
    else:
        logger.error(f"YFinance failed to get historical prices for {ticker}")
    
    # Test AlphaVantage get_historical_prices
    logger.info("Testing AlphaVantage get_historical_prices...")
    av_hist = av_provider.get_historical_prices(ticker, start_date, end_date)
    if av_hist is not None:
        logger.info(f"AlphaVantage historical prices for {ticker}: {len(av_hist)} days")
    else:
        logger.error(f"AlphaVantage failed to get historical prices for {ticker}")
    
    # Print summary
    logger.info("Test results:")
    logger.info(f"YFinance provider: {'SUCCESS' if yf_price is not None else 'FAILURE'}")
    logger.info(f"AlphaVantage provider: {'SUCCESS' if av_price is not None else 'FAILURE'}")

if __name__ == "__main__":
    test_providers()