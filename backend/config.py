"""
Configuration file for the backend service.

This file contains configuration settings for the backend service,
including rate limiting parameters for API calls.
"""

# Rate limiting configuration for Yahoo Finance API calls
YF_RATE_LIMIT = {
    # Number of requests allowed per time period
    "rate": 5,
    
    # Time period in seconds
    "per": 1.0,
    
    # Maximum burst size (token bucket capacity)
    "burst": 10
}

# Parallel processing configuration
PARALLEL_PROCESSING = {
    # Minimum number of worker threads
    "min_workers": 2,
    
    # Maximum number of worker threads
    "max_workers": 16,
    
    # Estimated API calls per ticker analysis
    "api_calls_per_ticker": 8,
    
    # Target completion time range in seconds (min, max)
    "target_completion_time": (30, 60)
}

# Quick filter thresholds
QUICK_FILTER = {
    # Minimum price threshold
    "min_price": 2.50,
    
    # Minimum average volume threshold
    "min_volume": 1500000
}