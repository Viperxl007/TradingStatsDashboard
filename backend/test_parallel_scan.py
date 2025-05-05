"""
Test script for parallel scan implementation.

This script tests the parallel scan implementation by scanning earnings for a specific date
and comparing the performance with the original implementation.
"""

import sys
import os
import time
import logging
from datetime import datetime

# Add app directory to path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import the scan_earnings function from run_direct.py
from run_direct import app, get_earnings_calendar, yf_rate_limiter

# Create a test Flask context
app_context = app.test_request_context()
app_context.push()

def test_parallel_scan():
    """Test the parallel scan implementation."""
    # Get a date with a reasonable number of earnings
    date_str = "2023-05-01"  # Example date, adjust as needed
    
    logger.info(f"Testing parallel scan for date: {date_str}")
    
    # Get earnings calendar
    try:
        earnings = get_earnings_calendar(date_str)
        logger.info(f"Found {len(earnings)} earnings announcements for {date_str}")
        
        if len(earnings) == 0:
            logger.error("No earnings found for the specified date. Please choose a different date.")
            return
            
        # Log the first few earnings
        for i, earning in enumerate(earnings[:5]):
            logger.info(f"Earning {i+1}: {earning}")
        
        # Test the parallel scan
        from flask import request
        
        # Set up the request context with the date parameter
        with app.test_request_context(f'/api/scan/earnings?date={date_str}'):
            logger.info("Starting parallel scan...")
            start_time = time.time()
            
            # Import the scan_earnings function
            from run_direct import scan_earnings
            
            # Call the scan_earnings function
            result = scan_earnings()
            
            end_time = time.time()
            elapsed_time = end_time - start_time
            
            # Log the results
            import json
            result_data = json.loads(result.get_data(as_text=True))
            
            logger.info(f"Scan completed in {elapsed_time:.2f} seconds")
            logger.info(f"Found {result_data.get('count', 0)} valid results")
            logger.info(f"Filtered out {result_data.get('filtered_out', 0)} tickers")
            logger.info(f"No data for {result_data.get('no_data', 0)} tickers")
            
            # Calculate performance metrics
            total_tickers = len(earnings)
            tickers_per_second = total_tickers / elapsed_time if elapsed_time > 0 else 0
            
            logger.info(f"Performance: {tickers_per_second:.2f} tickers/second")
            logger.info(f"API rate limiting: {yf_rate_limiter.rate:.1f} requests per {yf_rate_limiter.per:.1f} seconds")
            logger.info(f"Burst capacity: {yf_rate_limiter.capacity}")
            
            return result_data, elapsed_time, {
                "tickers_per_second": tickers_per_second,
                "rate_limit": f"{yf_rate_limiter.rate:.1f} req/{yf_rate_limiter.per:.1f}s",
                "burst_capacity": yf_rate_limiter.capacity
            }
            
    except Exception as e:
        logger.error(f"Error testing parallel scan: {str(e)}")
        return None, 0

if __name__ == "__main__":
    logger.info("Starting test...")
    result, elapsed_time, perf_metrics = test_parallel_scan()
    
    if result:
        logger.info(f"Test completed successfully in {elapsed_time:.2f} seconds")
        logger.info(f"Results: {result}")
        logger.info(f"Performance metrics:")
        logger.info(f"  - Tickers processed per second: {perf_metrics['tickers_per_second']:.2f}")
        logger.info(f"  - API rate limit: {perf_metrics['rate_limit']}")
        logger.info(f"  - Burst capacity: {perf_metrics['burst_capacity']}")
    else:
        logger.error("Test failed")
    
    logger.info("Test finished")