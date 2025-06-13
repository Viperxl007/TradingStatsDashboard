#!/usr/bin/env python3
"""
Test script to verify the price fetching fix
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from data_fetcher import get_current_price
import yfinance as yf

def test_price_fetching():
    """Test both string and Ticker object parameters"""
    print("Testing price fetching fixes...")
    
    # Test 1: String parameter (this was failing before)
    print("\n1. Testing with string ticker symbol:")
    try:
        price_str = get_current_price("AAPL")
        print(f"   ✓ get_current_price('AAPL') = ${price_str}")
    except Exception as e:
        print(f"   ✗ Error with string parameter: {e}")
    
    # Test 2: Ticker object parameter (should still work)
    print("\n2. Testing with Ticker object:")
    try:
        ticker_obj = yf.Ticker("AAPL")
        price_obj = get_current_price(ticker_obj)
        print(f"   ✓ get_current_price(yf.Ticker('AAPL')) = ${price_obj}")
    except Exception as e:
        print(f"   ✗ Error with Ticker object: {e}")
    
    # Test 3: Invalid ticker
    print("\n3. Testing with invalid ticker:")
    try:
        price_invalid = get_current_price("INVALID_TICKER_XYZ")
        print(f"   ✓ get_current_price('INVALID_TICKER_XYZ') = {price_invalid} (expected None)")
    except Exception as e:
        print(f"   ✗ Error with invalid ticker: {e}")

if __name__ == "__main__":
    test_price_fetching()