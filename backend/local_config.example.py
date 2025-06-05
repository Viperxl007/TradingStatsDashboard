"""
Local Configuration Example

This is an example file for local_config.py. Copy this file to local_config.py and modify it as needed.
local_config.py is not tracked by version control, so you can make changes without affecting the main codebase.

SECURITY NOTE: Never commit local_config.py to version control as it may contain sensitive information.
"""

# Market data source configuration
# Options: 'yfinance' (free, no API key required) or 'alphavantage' (requires API key)
MARKET_DATA_SOURCE = 'yfinance'  # Change to 'alphavantage' if you want to use Alpha Vantage

# AlphaVantage API key (only used if MARKET_DATA_SOURCE is 'alphavantage')
# Get your free API key from: https://www.alphavantage.co/support/#api-key
# ALPHAVANTAGE_API_KEY = 'your-actual-api-key-here'  # Uncomment and replace with your API key

# Rate limiting overrides (optional)
# Uncomment and modify these if you need different rate limits
# YF_RATE_LIMIT = {
#     "rate": 8,
#     "per": 1.0,
#     "burst": 10
# }
#
# AV_RATE_LIMIT = {
#     "rate": 1.25,
#     "per": 1.0,
#     "burst": 5
# }