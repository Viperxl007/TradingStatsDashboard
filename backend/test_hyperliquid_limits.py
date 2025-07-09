import sys
import os
sys.path.append('.')

from dotenv import load_dotenv
import requests
import json
from eth_account import Account

load_dotenv()

def make_request(endpoint, data):
    """Make a request to Hyperliquid API"""
    url = f"https://api.hyperliquid.xyz/{endpoint}"
    
    # Get credentials
    private_key = os.getenv('HYPERLIQUID_API_PRIVATE_KEY')
    if not private_key:
        raise ValueError("HYPERLIQUID_API_PRIVATE_KEY not found in environment")
    
    if private_key.startswith('0x'):
        private_key = private_key[2:]
    
    account = Account.from_key(private_key)
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, json=data, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()

def test_api_limits():
    main_wallet = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    print(f'Testing Hyperliquid API limits for {main_wallet}')
    
    # Test 1: Check if there are other fill-related endpoints
    print("\n=== Test 1: Standard userFills ===")
    try:
        data = {'type': 'userFills', 'user': main_wallet}
        response = make_request('info', data)
        print(f'userFills: {len(response)} trades')
        if response:
            times = [fill.get('time', 0) for fill in response]
            print(f'Time range: {min(times)} to {max(times)}')
    except Exception as e:
        print(f'Error: {e}')
    
    # Test 2: Try with a limit parameter
    print("\n=== Test 2: userFills with limit ===")
    try:
        data = {'type': 'userFills', 'user': main_wallet, 'limit': 5000}
        response = make_request('info', data)
        print(f'userFills with limit 5000: {len(response)} trades')
    except Exception as e:
        print(f'Error: {e}')
    
    # Test 3: Try historical fills
    print("\n=== Test 3: Try userFillsByTime ===")
    try:
        data = {'type': 'userFillsByTime', 'user': main_wallet}
        response = make_request('info', data)
        print(f'userFillsByTime: {len(response)} trades')
    except Exception as e:
        print(f'Error: {e}')
    
    # Test 4: Try with aggregateOrderByTime
    print("\n=== Test 4: Try aggregateOrderByTime ===")
    try:
        data = {'type': 'aggregateOrderByTime', 'user': main_wallet}
        response = make_request('info', data)
        print(f'aggregateOrderByTime: {type(response)} - {response}')
    except Exception as e:
        print(f'Error: {e}')
    
    # Test 5: Check what other types are available
    print("\n=== Test 5: Try to get API info ===")
    try:
        data = {'type': 'meta'}
        response = make_request('info', data)
        print(f'meta: {response}')
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    test_api_limits()