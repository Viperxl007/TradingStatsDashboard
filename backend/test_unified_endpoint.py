#!/usr/bin/env python3
"""
Test script for the unified calendar endpoint to verify the fix works correctly.
This script tests the problematic tickers (ACN, KR, CCEP) that were showing nuclear conditions.
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
API_BASE_URL = "http://localhost:5000"
TEST_CASES = [
    {
        "ticker": "ACN",
        "current_price": 313.60,
        "earnings_date": "2025-06-20",
        "description": "Accenture - was showing nuclear conditions with liquidity score 0"
    },
    {
        "ticker": "KR", 
        "current_price": 65.82,
        "earnings_date": "2025-06-20",
        "description": "Kroger - was showing nuclear conditions with liquidity score 0"
    },
    {
        "ticker": "CCEP",
        "current_price": 92.13,
        "earnings_date": "2025-06-20", 
        "description": "Coca-Cola Europacific - was showing nuclear conditions with low liquidity score"
    }
]

def test_unified_endpoint(ticker, current_price, earnings_date, description):
    """Test the unified calendar analysis endpoint."""
    print(f"\n{'='*80}")
    print(f"Testing {ticker}: {description}")
    print(f"Price: ${current_price}, Earnings: {earnings_date}")
    print(f"{'='*80}")
    
    try:
        # Test unified endpoint
        url = f"{API_BASE_URL}/calendar-analysis/{ticker}"
        payload = {
            "current_price": current_price,
            "earnings_date": earnings_date
        }
        
        print(f"🌐 Calling unified endpoint: {url}")
        print(f"📊 Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"📈 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✅ SUCCESS - Unified analysis completed!")
            print(f"   Spread Cost: ${data.get('spread_cost', 'N/A')}")
            print(f"   Liquidity Score: {data.get('liquidity_score', 'N/A')}")
            print(f"   Strike: ${data.get('strike', 'N/A')} {data.get('option_type', 'N/A')}")
            print(f"   Front Exp: {data.get('front_expiration', 'N/A')}")
            print(f"   Back Exp: {data.get('back_expiration', 'N/A')}")
            
            # Check validation info
            validation = data.get('validation_info', {})
            if validation:
                print(f"   Strike Distance: {validation.get('distance_from_atm_pct', 0):.2%}")
                print(f"   Common Strikes: {validation.get('common_strikes_count', 0)}")
                print(f"   Both Legs Valid: {validation.get('front_validated', False) and validation.get('back_validated', False)}")
            
            # Check data quality
            quality = data.get('data_quality', {})
            if quality:
                print(f"   Data Quality: {quality}")
            
            return True
            
        else:
            print(f"❌ FAILED - HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ NETWORK ERROR: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {str(e)}")
        return False

def test_backward_compatibility(ticker, current_price, earnings_date):
    """Test that the old endpoints still work for backward compatibility."""
    print(f"\n📋 Testing backward compatibility for {ticker}...")
    
    # Test spread cost endpoint
    try:
        url = f"{API_BASE_URL}/spread-cost/calendar/{ticker}"
        payload = {
            "current_price": current_price,
            "earnings_date": earnings_date
        }
        
        response = requests.post(url, json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Spread cost endpoint: ${data.get('spread_cost', 'N/A')}")
        else:
            print(f"   ❌ Spread cost endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Spread cost endpoint error: {str(e)}")
    
    # Test liquidity endpoint
    try:
        url = f"{API_BASE_URL}/liquidity/calendar/{ticker}"
        payload = {
            "current_price": current_price,
            "earnings_date": earnings_date
        }
        
        response = requests.post(url, json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Liquidity endpoint: {data.get('liquidity_score', 'N/A')}")
        else:
            print(f"   ❌ Liquidity endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Liquidity endpoint error: {str(e)}")

def main():
    """Run all tests."""
    print("🚀 Starting Unified Calendar Endpoint Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    success_count = 0
    total_count = len(TEST_CASES)
    
    for test_case in TEST_CASES:
        success = test_unified_endpoint(
            test_case["ticker"],
            test_case["current_price"], 
            test_case["earnings_date"],
            test_case["description"]
        )
        
        if success:
            success_count += 1
            # Test backward compatibility for successful cases
            test_backward_compatibility(
                test_case["ticker"],
                test_case["current_price"],
                test_case["earnings_date"]
            )
    
    print(f"\n{'='*80}")
    print(f"🏁 TEST SUMMARY")
    print(f"{'='*80}")
    print(f"✅ Successful: {success_count}/{total_count}")
    print(f"❌ Failed: {total_count - success_count}/{total_count}")
    
    if success_count == total_count:
        print(f"🎉 ALL TESTS PASSED! The nuclear liquidity issue should be resolved.")
        sys.exit(0)
    else:
        print(f"⚠️  Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()