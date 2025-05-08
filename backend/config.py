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