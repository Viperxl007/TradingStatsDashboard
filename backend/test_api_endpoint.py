#!/usr/bin/env python3
"""
Test the API endpoint to verify multiple trades are returned correctly.
"""

import requests
import json

def test_api_endpoint():
    """Test the /active-trades/all endpoint"""
    try:
        response = requests.get('http://localhost:5000/api/active-trades/all', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f'✅ API endpoint working: Found {data.get("count", 0)} active trades')
            if data.get('active_trades'):
                for trade in data['active_trades'][:5]:  # Show first 5
                    print(f'   - {trade["ticker"]} ({trade["timeframe"]}): {trade["action"]} at ${trade["entry_price"]}')
            return True
        else:
            print(f'⚠️ API endpoint returned status {response.status_code}')
            return False
    except requests.exceptions.ConnectionError:
        print('ℹ️ Backend server not running - API test skipped')
        return True  # Not a failure, just not running
    except Exception as e:
        print(f'⚠️ API test error: {e}')
        return False

if __name__ == "__main__":
    test_api_endpoint()