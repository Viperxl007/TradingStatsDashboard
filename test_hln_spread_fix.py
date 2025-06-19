#!/usr/bin/env python3
"""
Test script to verify the HLN spread cost calculation fix.

This script tests the enhanced data validation for calendar spread cost calculation
to ensure it properly handles bad bid/ask data that was causing 400 errors.
"""

import requests
import json
import sys

def test_calendar_spread_cost(ticker, current_price, earnings_date):
    """Test the calendar spread cost endpoint with enhanced validation."""
    
    url = "http://localhost:5000/api/spread-cost/calendar/" + ticker
    payload = {
        "current_price": current_price,
        "earnings_date": earnings_date
    }
    
    print(f"\n🧪 Testing calendar spread cost for {ticker}")
    print(f"   Current Price: ${current_price}")
    print(f"   Earnings Date: {earnings_date}")
    print(f"   URL: {url}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"   Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ SUCCESS: Spread cost: ${data.get('spread_cost', 'N/A')}")
            print(f"   📊 Details: {data.get('option_type', 'N/A')} at ${data.get('strike', 'N/A')}")
            print(f"   📅 Expirations: {data.get('front_expiration', 'N/A')} → {data.get('back_expiration', 'N/A')}")
            return True
        else:
            try:
                error_data = response.json()
                error_msg = error_data.get('error', 'Unknown error')
                print(f"   ❌ ERROR ({response.status_code}): {error_msg}")
            except:
                print(f"   ❌ ERROR ({response.status_code}): {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   🚨 REQUEST FAILED: {str(e)}")
        return False

def main():
    """Run tests for problematic tickers."""
    
    print("🔍 Testing Enhanced Calendar Spread Cost Validation")
    print("=" * 60)
    
    # Test cases - including HLN and other potentially problematic tickers
    test_cases = [
        ("HLN", 25.50, "2025-06-25"),  # The problematic ticker mentioned
        ("AAPL", 150.00, "2025-07-25"),  # Should work fine
        ("TSLA", 200.00, "2025-07-15"),  # High volatility stock
        ("SPY", 450.00, "2025-06-20"),   # ETF with good liquidity
    ]
    
    results = []
    
    for ticker, price, earnings_date in test_cases:
        success = test_calendar_spread_cost(ticker, price, earnings_date)
        results.append((ticker, success))
    
    print("\n" + "=" * 60)
    print("📋 SUMMARY:")
    
    for ticker, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {ticker}: {status}")
    
    # Check if HLN specifically passed
    hln_result = next((success for ticker, success in results if ticker == "HLN"), None)
    
    if hln_result is True:
        print(f"\n🎉 SUCCESS: HLN spread cost calculation is now working!")
    elif hln_result is False:
        print(f"\n⚠️  HLN still has issues, but now with better error reporting.")
    else:
        print(f"\n❓ HLN was not tested.")
    
    print(f"\nℹ️  Note: If you see data quality warnings in the backend logs,")
    print(f"   that's expected - the system is now properly detecting and handling bad data.")

if __name__ == "__main__":
    main()