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

def test_pagination():
    main_wallet = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    print(f'Testing pagination debug for {main_wallet}')
    
    # Test different pagination approaches
    print("=== Test 1: No startTime (default) ===")
    data1 = {'type': 'userFills', 'user': main_wallet}
    response1 = make_request('info', data1)
    print(f'Response length: {len(response1) if isinstance(response1, list) else "Not a list"}')
    
    print("\n=== Test 2: With startTime (far in past) ===")
    data2 = {'type': 'userFills', 'user': main_wallet, 'startTime': 1000000000000}  # Very old timestamp
    response2 = make_request('info', data2)
    print(f'Response length: {len(response2) if isinstance(response2, list) else "Not a list"}')
    
    print("\n=== Test 3: With endTime ===")
    data3 = {'type': 'userFills', 'user': main_wallet, 'endTime': 1741728092387}  # End at oldest from first page
    response3 = make_request('info', data3)
    print(f'Response length: {len(response3) if isinstance(response3, list) else "Not a list"}')
    
    print("\n=== Test 4: With both startTime and endTime ===")
    data4 = {'type': 'userFills', 'user': main_wallet, 'startTime': 1000000000000, 'endTime': 1741728092387}
    response4 = make_request('info', data4)
    print(f'Response length: {len(response4) if isinstance(response4, list) else "Not a list"}')
    
    # Check if responses are different
    if isinstance(response1, list) and isinstance(response2, list):
        print(f"\nResponse 1 vs 2 same? {response1 == response2}")
    if isinstance(response1, list) and isinstance(response3, list):
        print(f"Response 1 vs 3 same? {response1 == response3}")
    if isinstance(response1, list) and isinstance(response4, list):
        print(f"Response 1 vs 4 same? {response1 == response4}")

if __name__ == '__main__':
    test_pagination()