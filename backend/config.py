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

# Claude API key for AI chart analysis
# Must be set via environment variable or local_config.py
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')

# Available Claude models for chart analysis
CLAUDE_MODELS = [
    # Claude 4 Models (Latest)
    {
        "id": "claude-sonnet-4-20250514",
        "name": "Claude Sonnet 4",
        "description": "Latest Sonnet model with improved reasoning and intelligence",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.003
    },
    {
        "id": "claude-opus-4-20250514",
        "name": "Claude Opus 4",
        "description": "Most capable model with superior reasoning for complex analysis",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.015
    },
    # Claude 3.7 Models
    {
        "id": "claude-3-7-sonnet-20250219",
        "name": "Claude 3.7 Sonnet",
        "description": "Advanced Sonnet model with extended capabilities",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.003
    },
    # Claude 3.5 Models
    {
        "id": "claude-3-5-sonnet-20241022",
        "name": "Claude 3.5 Sonnet",
        "description": "Proven capable model, good for complex analysis",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.003
    },
    {
        "id": "claude-3-5-haiku-20241022",
        "name": "Claude 3.5 Haiku",
        "description": "Fastest model, good for quick analysis",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.0008
    },
    # Claude 3 Models (Legacy)
    {
        "id": "claude-3-opus-20240229",
        "name": "Claude 3 Opus",
        "description": "Legacy powerful model, best for detailed analysis",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.015
    },
    {
        "id": "claude-3-sonnet-20240229",
        "name": "Claude 3 Sonnet",
        "description": "Legacy balanced model, good for general analysis",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.003
    },
    {
        "id": "claude-3-haiku-20240307",
        "name": "Claude 3 Haiku",
        "description": "Legacy fast model, good for basic analysis",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.00025
    }
]

# Default Claude model for chart analysis (using latest Claude 4 Sonnet)
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"

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

# Validate Claude API key for chart analysis
if not CLAUDE_API_KEY:
    print("WARNING: CLAUDE_API_KEY is not set. AI chart analysis features will be disabled.")
    print("Please set CLAUDE_API_KEY environment variable or configure it in local_config.py")
    print("To enable chart analysis, obtain an API key from https://console.anthropic.com/")

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