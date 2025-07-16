#!/usr/bin/env python3
"""
Debug API Response
Check the actual format of the API response to understand the structure.
"""

import requests
import json

def debug_api_response():
    """Debug the API response format"""
    try:
        response = requests.get("http://localhost:5000/api/active-trades/all")
        if response.status_code == 200:
            data = response.json()
            print("🔍 API Response Structure:")
            print(json.dumps(data, indent=2))
            
            active_trades = data.get('active_trades', [])
            if active_trades:
                print(f"\n📊 First trade structure:")
                print(json.dumps(active_trades[0], indent=2))
        else:
            print(f"❌ API Error: HTTP {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_api_response()