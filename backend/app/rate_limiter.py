"""
Rate Limiter Module

This module provides rate limiting functionality for API calls to prevent exceeding
rate limits of external services like Yahoo Finance.
"""

import time
import logging
import threading
from functools import wraps

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG to see detailed logs

class RateLimiter:
    """
    Rate limiter for API calls.
    
    This class implements a token bucket algorithm for rate limiting.
    It allows for bursts of requests up to a specified limit, while
    maintaining a long-term rate limit.
    
    Attributes:
        rate (float): Rate at which tokens are added to the bucket (tokens per second)
        per (float): Time period for token replenishment
        burst (int): Maximum number of tokens the bucket can hold
        max_consecutive (int): Maximum number of consecutive requests before enforcing a pause
        pause_duration (float): Duration of pause after max_consecutive requests
    """
    
    def __init__(self, rate=5, per=1.0, burst=10, max_consecutive=10, pause_duration=2.0):
        """
        Initialize the rate limiter.
        
        Args:
            rate (float): Rate at which tokens are added to the bucket (tokens per second)
            per (float): Time period for token replenishment
            burst (int): Maximum number of tokens the bucket can hold
            max_consecutive (int): Maximum number of consecutive requests before enforcing a pause
            pause_duration (float): Duration of pause after max_consecutive requests
        """
        self.rate = rate
        self.per = per
        self.burst = burst
        self.tokens = burst
        self.updated_at = time.monotonic()
        self.lock = threading.RLock()
        self.max_consecutive = max_consecutive
        self.pause_duration = pause_duration
        self.consecutive_requests = 0
        
    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self.updated_at
        new_tokens = elapsed * (self.rate / self.per)
        self.tokens = min(self.burst, self.tokens + new_tokens)
        self.updated_at = now
        
    def update_config(self, rate=None, per=None, burst=None, max_consecutive=None, pause_duration=None):
        """
        Update rate limiter configuration.
        
        Args:
            rate (float, optional): New rate value
            per (float, optional): New per value
            burst (int, optional): New burst value
            max_consecutive (int, optional): New max_consecutive value
            pause_duration (float, optional): New pause_duration value
        """
        with self.lock:
            if rate is not None:
                self.rate = rate
            if per is not None:
                self.per = per
            if burst is not None:
                self.burst = burst
                self.tokens = min(self.tokens, self.burst)
            if max_consecutive is not None:
                self.max_consecutive = max_consecutive
            if pause_duration is not None:
                self.pause_duration = pause_duration
            
    def acquire(self, block=True, timeout=None):
        """
        Acquire a token from the bucket.
        
        Args:
            block (bool): Whether to block until a token is available
            timeout (float): Maximum time to wait for a token
            
        Returns:
            bool: True if a token was acquired, False otherwise
        """
        start_time = time.monotonic()
        
        with self.lock:
            self._refill()
            
            # Check if we need to pause due to consecutive requests
            if self.consecutive_requests >= self.max_consecutive:
                logger.debug(f"Pausing for {self.pause_duration}s after {self.consecutive_requests} consecutive requests")
                time.sleep(self.pause_duration)
                self.consecutive_requests = 0
            
            # If we have tokens available, consume one and return
            if self.tokens >= 1:
                self.tokens -= 1
                self.consecutive_requests += 1
                return True
                
            # If not blocking, return False immediately
            if not block:
                return False
                
            # Calculate how long we need to wait for one token
            wait_time = (1 - self.tokens) * self.per / self.rate
            
            # If timeout is specified and wait_time exceeds it, return False
            if timeout is not None and wait_time > timeout:
                return False
                
        # Wait for the required time
        time.sleep(wait_time)
        
        # Try again after waiting
        with self.lock:
            self._refill()
            if self.tokens >= 1:
                self.tokens -= 1
                self.consecutive_requests += 1
                return True
            else:
                # This should rarely happen, but handle it just in case
                if timeout is not None and time.monotonic() - start_time >= timeout:
                    return False
                return False
                
    def __call__(self, func):
        """
        Decorator for rate-limited functions.
        
        Args:
            func (callable): Function to decorate
            
        Returns:
            callable: Decorated function
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            self.acquire()
            return func(*args, **kwargs)
        return wrapper

# Create a global rate limiter instance for Yahoo Finance
yf_rate_limiter = RateLimiter()

def update_rate_limiter_config():
    """
    Update the Yahoo Finance rate limiter configuration from the app config.
    
    This function should be called at application startup to configure
    the rate limiter based on the application configuration.
    """
    try:
        from config import YF_RATE_LIMIT, SEQUENTIAL_PROCESSING
        
        # Update YF rate limiter with config values
        yf_rate_limiter.update_config(
            rate=YF_RATE_LIMIT.get("rate", 5),
            per=YF_RATE_LIMIT.get("per", 1.0),
            burst=YF_RATE_LIMIT.get("burst", 10),
            max_consecutive=SEQUENTIAL_PROCESSING.get("max_consecutive_requests", 10),
            pause_duration=SEQUENTIAL_PROCESSING.get("pause_duration", 2.0)
        )
        
        logger.info(f"Updated YF rate limiter: rate={yf_rate_limiter.rate}, "
                   f"per={yf_rate_limiter.per}, burst={yf_rate_limiter.burst}, "
                   f"max_consecutive={yf_rate_limiter.max_consecutive}, "
                   f"pause_duration={yf_rate_limiter.pause_duration}")
    except ImportError:
        logger.warning("Could not import config, using default rate limiter settings")
    except Exception as e:
        logger.error(f"Error updating rate limiter config: {str(e)}")

# Thread lock for Yahoo Finance API calls
_yf_api_lock = threading.RLock()

def get_current_price(ticker):
    """
    Get the current price for a ticker with rate limiting.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        float: Current stock price or None if an error occurs
    """
    import yfinance as yf
    
    try:
        # Acquire rate limiter token with timeout
        if not yf_rate_limiter.acquire(block=True, timeout=10):
            logger.warning(f"Rate limit exceeded for {ticker}, skipping")
            return None
            
        # Use thread lock for thread safety
        with _yf_api_lock:
            stock = yf.Ticker(ticker)
            todays_data = stock.history(period='1d')
            
            if todays_data.empty:
                logger.warning(f"No data available for {ticker}")
                return None
                
            return todays_data['Close'].iloc[0]
    except Exception as e:
        logger.error(f"Error getting current price for {ticker}: {str(e)}")
        return None