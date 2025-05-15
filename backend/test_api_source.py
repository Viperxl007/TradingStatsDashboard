"""
Test script to verify which API source is being used.

This script will print out which API source (yfinance or AlphaVantage) is being used
based on the current configuration.
"""

import os
import sys
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_api_source():
    """Test which API source is being used."""
    try:
        # Import the market data module
        from app.market_data import market_data, get_config
        
        # Get the current configuration
        config = get_config()
        market_data_source = config['MARKET_DATA_SOURCE'].lower()
        
        # Print the configuration
        print("\n" + "="*80)
        print(f"MARKET DATA SOURCE CONFIGURATION: {market_data_source.upper()}")
        print("="*80)
        
        # Print the provider class
        print(f"Provider class: {market_data.__class__.__name__}")
        
        # Test getting current price for a ticker
        ticker = 'AAPL'
        print(f"\nGetting current price for {ticker}...")
        price = market_data.get_current_price(ticker)
        print(f"Current price for {ticker}: {price}")
        
        # Test getting historical prices
        print(f"\nGetting historical prices for {ticker} (last 30 days)...")
        end_date = datetime.now()
        start_date = datetime(end_date.year, end_date.month - 1 if end_date.month > 1 else 12, end_date.day)
        historical_prices = market_data.get_historical_prices(ticker, start_date, end_date)
        if historical_prices is not None:
            print(f"Historical prices for {ticker}: {len(historical_prices)} days")
            print(f"First day: {historical_prices.index[-1]}, Last day: {historical_prices.index[0]}")
        else:
            print(f"Failed to get historical prices for {ticker}")
        
        print("\n" + "="*80)
        print(f"API SOURCE TEST COMPLETED SUCCESSFULLY: {market_data_source.upper()}")
        print("="*80 + "\n")
        
    except Exception as e:
        logger.error(f"Error testing API source: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    test_api_source()