"""
Test script for the optimized iron condor implementation.

This script compares the performance of the original and optimized iron condor implementations.
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

def test_iron_condor_implementations(ticker="AAPL"):
    """
    Test both iron condor implementations and compare their performance.
    
    Args:
        ticker (str): Stock ticker symbol to test
    """
    logger.info(f"Testing iron condor implementations for {ticker}")
    
    # Import both implementations
    try:
        from app.options_analyzer import find_optimal_iron_condor as original_find_optimal_iron_condor
        from app.optimized_iron_condor import find_optimal_iron_condor as optimized_find_optimal_iron_condor
    except ImportError as e:
        logger.error(f"Error importing iron condor implementations: {str(e)}")
        return
    
    # Test original implementation
    logger.info(f"Testing original implementation for {ticker}")
    start_time = time.time()
    try:
        original_result = original_find_optimal_iron_condor(ticker)
        original_time = time.time() - start_time
        logger.info(f"Original implementation completed in {original_time:.2f} seconds")
        if original_result:
            logger.info(f"Original implementation found {len(original_result.get('topIronCondors', []))} iron condors")
        else:
            logger.info("Original implementation found no iron condors")
    except Exception as e:
        logger.error(f"Error in original implementation: {str(e)}")
        original_time = time.time() - start_time
        original_result = None
    
    # Add a delay to avoid rate limiting
    time.sleep(5)
    
    # Test optimized implementation
    logger.info(f"Testing optimized implementation for {ticker}")
    start_time = time.time()
    try:
        optimized_result = optimized_find_optimal_iron_condor(ticker)
        optimized_time = time.time() - start_time
        logger.info(f"Optimized implementation completed in {optimized_time:.2f} seconds")
        if optimized_result:
            logger.info(f"Optimized implementation found {len(optimized_result.get('topIronCondors', []))} iron condors")
        else:
            logger.info("Optimized implementation found no iron condors")
    except Exception as e:
        logger.error(f"Error in optimized implementation: {str(e)}")
        optimized_time = time.time() - start_time
        optimized_result = None
    
    # Compare results
    if original_result and optimized_result:
        original_count = len(original_result.get('topIronCondors', []))
        optimized_count = len(optimized_result.get('topIronCondors', []))
        
        logger.info(f"Performance comparison:")
        logger.info(f"  Original: {original_time:.2f} seconds, {original_count} iron condors")
        logger.info(f"  Optimized: {optimized_time:.2f} seconds, {optimized_count} iron condors")
        logger.info(f"  Speed improvement: {(original_time / optimized_time if optimized_time > 0 else 0):.2f}x")
        
        # Check if the optimized implementation found similar results
        if original_count > 0 and optimized_count > 0:
            original_best_score = original_result['topIronCondors'][0]['score']
            optimized_best_score = optimized_result['topIronCondors'][0]['score']
            
            logger.info(f"  Original best score: {original_best_score:.2f}")
            logger.info(f"  Optimized best score: {optimized_best_score:.2f}")
            logger.info(f"  Score difference: {abs(original_best_score - optimized_best_score):.2f}")
    
    return {
        "original": {
            "time": original_time,
            "result": original_result
        },
        "optimized": {
            "time": optimized_time,
            "result": optimized_result
        }
    }

def test_multiple_tickers():
    """Test both implementations on multiple tickers."""
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
    results = {}
    
    for ticker in tickers:
        logger.info(f"Testing {ticker}")
        results[ticker] = test_iron_condor_implementations(ticker)
        # Add a delay between tickers to avoid rate limiting
        time.sleep(10)
    
    # Summarize results
    logger.info("Summary of results:")
    total_original_time = 0
    total_optimized_time = 0
    
    for ticker, result in results.items():
        if result:
            original_time = result["original"]["time"]
            optimized_time = result["optimized"]["time"]
            
            total_original_time += original_time
            total_optimized_time += optimized_time
            
            logger.info(f"{ticker}: Original: {original_time:.2f}s, Optimized: {optimized_time:.2f}s, Improvement: {(original_time / optimized_time if optimized_time > 0 else 0):.2f}x")
    
    if total_optimized_time > 0:
        logger.info(f"Overall improvement: {(total_original_time / total_optimized_time):.2f}x faster")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Test a specific ticker
        ticker = sys.argv[1]
        test_iron_condor_implementations(ticker)
    else:
        # Test a single default ticker
        test_iron_condor_implementations()
        
        # Uncomment to test multiple tickers
        # test_multiple_tickers()