"""
Configuration file for the backend service.

This file contains configuration settings for the backend service,
including rate limiting parameters for API calls and market data source preferences.

Settings in this file can be overridden by:
1. Environment variables
2. A local_config.py file (not tracked by version control)
"""
import os
import importlib.util

# Market data source configuration
# Options: 'yfinance' or 'alphavantage'
MARKET_DATA_SOURCE = os.environ.get('MARKET_DATA_SOURCE', 'yfinance')

# AlphaVantage API key (only used if MARKET_DATA_SOURCE is 'alphavantage')
# Must be set via environment variable or local_config.py
ALPHAVANTAGE_API_KEY = os.environ.get('ALPHAVANTAGE_API_KEY')

# Rate limiting configuration for Yahoo Finance API calls
YF_RATE_LIMIT = {
    # Number of requests allowed per time period
    "rate": 8,
    
    # Time period in seconds
    "per": 1.0,
    
    # Maximum burst size (token bucket capacity)
    "burst": 10
}

# Rate limiting configuration for AlphaVantage API calls
# Premium account allows 75 requests per minute (1.25 per second)
AV_RATE_LIMIT = {
    # Number of requests allowed per time period
    "rate": 1.25,
    
    # Time period in seconds
    "per": 1.0,
    
    # Maximum burst size (token bucket capacity)
    "burst": 5
}

# Import local configuration if it exists
# This allows for local overrides of the above settings
try:
    # Check if local_config.py exists
    local_config_path = os.path.join(os.path.dirname(__file__), 'local_config.py')
    if os.path.exists(local_config_path):
        # Import local_config.py
        spec = importlib.util.spec_from_file_location("local_config", local_config_path)
        local_config = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(local_config)
        
        # Override settings from local_config.py
        for key in dir(local_config):
            if key.isupper() and not key.startswith('_'):
                globals()[key] = getattr(local_config, key)
        
        print(f"Loaded local configuration from {local_config_path}")
        print(f"Using market data source: {MARKET_DATA_SOURCE}")
except Exception as e:
    print(f"Error loading local configuration: {str(e)}")

# Validate configuration after loading local config
if MARKET_DATA_SOURCE == 'alphavantage' and not ALPHAVANTAGE_API_KEY:
    print("WARNING: ALPHAVANTAGE_API_KEY is not set but AlphaVantage is selected as market data source.")
    print("Please set ALPHAVANTAGE_API_KEY environment variable or configure it in local_config.py")
    print("Falling back to yfinance as market data source.")
    MARKET_DATA_SOURCE = 'yfinance'

# Sequential processing configuration
SEQUENTIAL_PROCESSING = {
    # Estimated API calls per ticker analysis
    "api_calls_per_ticker": 8,
    
    # Requests per minute limit
    "requests_per_minute": 70,
    
    # Maximum consecutive requests before pause
    "max_consecutive_requests": 10,
    
    # Pause duration in seconds after max consecutive requests
    "pause_duration": 1.0
}

# Quick filter thresholds
QUICK_FILTER = {
    # Minimum price threshold
    "min_price": 2.50,
    
    # Minimum average volume threshold
    "min_volume": 1500000
}