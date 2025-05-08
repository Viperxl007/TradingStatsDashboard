"""
Test script for sequential scan implementation.

This script tests the sequential scan implementation by scanning earnings for a specific date
and measuring the performance.
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
from run_direct import app, get_earnings_calendar, yf_rate_limiter, update_rate_limiter_config, SEQUENTIAL_PROCESSING

# Create a test Flask context
app_context = app.test_request_context()
app_context.push()

def test_sequential_scan(requests_per_minute=None, max_consecutive=None, pause_duration=None):
    """
    Test the sequential scan implementation.
    
    Args:
        requests_per_minute (int, optional): Override requests per minute setting
        max_consecutive (int, optional): Override max consecutive requests setting
        pause_duration (float, optional): Override pause duration setting
    """
    # Update rate limiter configuration if parameters are provided
    if any(param is not None for param in [requests_per_minute, max_consecutive, pause_duration]):
        # Update SEQUENTIAL_PROCESSING configuration
        if requests_per_minute is not None:
            SEQUENTIAL_PROCESSING["requests_per_minute"] = requests_per_minute
        if max_consecutive is not None:
            SEQUENTIAL_PROCESSING["max_consecutive_requests"] = max_consecutive
        if pause_duration is not None:
            SEQUENTIAL_PROCESSING["pause_duration"] = pause_duration
            
        # Apply the updated configuration
        update_rate_limiter_config()
        
        logger.info(f"Updated rate limiter configuration:")
        logger.info(f"  - Requests per minute: {SEQUENTIAL_PROCESSING['requests_per_minute']}")
        logger.info(f"  - Max consecutive requests: {SEQUENTIAL_PROCESSING['max_consecutive_requests']}")
        logger.info(f"  - Pause duration: {SEQUENTIAL_PROCESSING['pause_duration']}s")
    
    # Get a date with a reasonable number of earnings
    date_str = "2023-05-01"  # Example date, adjust as needed
    
    logger.info(f"Testing sequential scan for date: {date_str}")
    
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
        
        # Test the sequential scan
        from flask import request
        
        # Set up the request context with the date parameter
        with app.test_request_context(f'/api/scan/earnings?date={date_str}'):
            logger.info("Starting sequential scan...")
            start_time = time.time()
            
            # Import the scan_earnings function
            from run_direct import scan_earnings
            
            # For testing purposes, we'll modify the approach to not use the streaming response
            # Instead, we'll directly use the internal functions
            
            # Get access to the internal functions that process tickers
            from run_direct import get_earnings_calendar, process_ticker
            
            # Process tickers sequentially
            results = []
            filtered_out = 0
            no_data = 0
            
            # Process each ticker
            for earning in earnings:
                ticker = earning.get('ticker')
                if not ticker:
                    continue
                    
                try:
                    result = process_ticker(earning)
                    if result is not None:
                        results.append(result)
                        
                        # Update counters based on result
                        if result.get("recommendation") == "Filtered Out":
                            filtered_out += 1
                        elif result.get("recommendation") == "No Data":
                            no_data += 1
                except Exception as e:
                    logger.error(f"Error processing ticker {ticker}: {str(e)}")
            
            # Filter out results with no data or filtered out
            filtered_results = [result for result in results if result.get("recommendation") not in ["No Data", "Filtered Out"]]
            
            end_time = time.time()
            elapsed_time = end_time - start_time
            
            # Create result data
            result_data = {
                "date": date_str or datetime.now().strftime('%Y-%m-%d'),
                "count": len(filtered_results),
                "results": filtered_results,
                "filtered_out": filtered_out,
                "no_data": no_data,
                "timestamp": datetime.now().timestamp()
            }
            
            logger.info(f"Scan completed in {elapsed_time:.2f} seconds")
            logger.info(f"Found {result_data.get('count', 0)} valid results")
            logger.info(f"Filtered out {result_data.get('filtered_out', 0)} tickers")
            logger.info(f"No data for {result_data.get('no_data', 0)} tickers")
            
            # Calculate performance metrics
            total_tickers = len(earnings)
            tickers_per_second = total_tickers / elapsed_time if elapsed_time > 0 else 0
            
            logger.info(f"Performance: {tickers_per_second:.2f} tickers/second")
            logger.info(f"API rate limiting: {SEQUENTIAL_PROCESSING['requests_per_minute']} requests per minute")
            logger.info(f"Max consecutive requests: {SEQUENTIAL_PROCESSING['max_consecutive_requests']}")
            logger.info(f"Pause duration: {SEQUENTIAL_PROCESSING['pause_duration']}s")
            logger.info(f"Burst capacity: {yf_rate_limiter.capacity}")
            
            return result_data, elapsed_time, {
                "tickers_per_second": tickers_per_second,
                "requests_per_minute": SEQUENTIAL_PROCESSING['requests_per_minute'],
                "max_consecutive": SEQUENTIAL_PROCESSING['max_consecutive_requests'],
                "pause_duration": SEQUENTIAL_PROCESSING['pause_duration'],
                "burst_capacity": yf_rate_limiter.capacity
            }
            
    except Exception as e:
        logger.error(f"Error testing sequential scan: {str(e)}")
        return None, 0, {}

if __name__ == "__main__":
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Test sequential scan implementation')
    parser.add_argument('--rpm', type=int, help='Requests per minute')
    parser.add_argument('--max-consecutive', type=int, help='Maximum consecutive requests')
    parser.add_argument('--pause', type=float, help='Pause duration in seconds')
    args = parser.parse_args()
    
    logger.info("Starting test...")
    result, elapsed_time, perf_metrics = test_sequential_scan(
        requests_per_minute=args.rpm,
        max_consecutive=args.max_consecutive,
        pause_duration=args.pause
    )
    
    if result:
        logger.info(f"Test completed successfully in {elapsed_time:.2f} seconds")
        logger.info(f"Performance metrics:")
        logger.info(f"  - Tickers processed per second: {perf_metrics['tickers_per_second']:.2f}")
        logger.info(f"  - Requests per minute: {perf_metrics['requests_per_minute']}")
        logger.info(f"  - Max consecutive requests: {perf_metrics['max_consecutive']}")
        logger.info(f"  - Pause duration: {perf_metrics['pause_duration']}s")
        logger.info(f"  - Burst capacity: {perf_metrics['burst_capacity']}")
    else:
        logger.error("Test failed")
    
    logger.info("Test finished")