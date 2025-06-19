#!/usr/bin/env python3
"""
Debug script specifically for CCEP JSON serialization issue.
"""

import requests
import json

def test_ccep_debug():
    """Test CCEP specifically with detailed error handling."""
    
    url = "http://localhost:5000/calendar-analysis/CCEP"
    payload = {
        "current_price": 92.13,
        "earnings_date": "2025-06-20"
    }
    
    print("🔍 Testing CCEP with detailed debugging...")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ SUCCESS!")
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print("❌ FAILED!")
            print(f"Response Text: {response.text}")
            
            try:
                error_data = response.json()
                print(f"Error JSON: {json.dumps(error_data, indent=2)}")
            except:
                print("Could not parse error as JSON")
                
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    test_ccep_debug()