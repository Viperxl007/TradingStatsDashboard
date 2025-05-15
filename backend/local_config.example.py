"""
Local Configuration Example

This is an example file for local_config.py. Copy this file to local_config.py and modify it as needed.
local_config.py is not tracked by version control, so you can make changes without affecting the main codebase.
"""

# Market data source configuration
# Options: 'yfinance' or 'alphavantage'
MARKET_DATA_SOURCE = 'yfinance'  # Change to 'alphavantage' if you want to use Alpha Vantage

# AlphaVantage API key (only used if MARKET_DATA_SOURCE is 'alphavantage')
ALPHAVANTAGE_API_KEY = 'your-api-key-here'  # Replace with your own API key