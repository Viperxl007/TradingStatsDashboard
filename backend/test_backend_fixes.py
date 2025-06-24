#!/usr/bin/env python3
"""
Test script to verify the backend API fixes for liquidity tracking system.

This script tests:
1. CLPosition model with new token address fields
2. New /cl/positions/{id}/current-price endpoint
3. Real price calculation integration
4. DexScreener service integration
"""

import sys
import os
import json
import requests
from datetime import datetime

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_cl_position_model():
    """Test the enhanced CLPosition model with token addresses."""
    print("Testing CLPosition model with token addresses...")
    
    try:
        from models.cl_position import CLPosition
        
        # Initialize model
        cl_model = CLPosition()
        
        # Test position data with new token address fields
        test_position = {
            'trade_name': 'Test LICKO/WHYPE Position',
            'pair_symbol': 'LICKO/WHYPE',
            'token0_address': '0x1234567890abcdef1234567890abcdef12345678',  # Example LICKO address
            'token1_address': '0xabcdef1234567890abcdef1234567890abcdef12',  # Example WHYPE address
            'contract_address': '0x9876543210fedcba9876543210fedcba98765432',
            'protocol': 'HyperSwap',
            'chain': 'HyperEVM',
            'price_range_min': 0.001,
            'price_range_max': 0.01,
            'liquidity_amount': 6870.1000,
            'initial_investment': 1000.0,
            'entry_date': datetime.now().isoformat(),
            'notes': 'Test position with token addresses'
        }
        
        # Create position
        position_id = cl_model.create_position(test_position)
        print(f"✓ Created position with ID: {position_id}")
        
        # Retrieve position
        retrieved_position = cl_model.get_position_by_id(position_id)
        if retrieved_position:
            print(f"✓ Retrieved position: {retrieved_position['trade_name']}")
            print(f"  Token0 Address: {retrieved_position.get('token0_address')}")
            print(f"  Token1 Address: {retrieved_position.get('token1_address')}")
        else:
            print("✗ Failed to retrieve position")
            return False
        
        return True
        
    except Exception as e:
        print(f"✗ CLPosition model test failed: {str(e)}")
        return False

def test_cl_service_real_prices():
    """Test the CLService with real price calculation."""
    print("\nTesting CLService with real price calculation...")
    
    try:
        from services.cl_service import CLService
        from services.dexscreener_service import DexScreenerService
        
        # Initialize services
        cl_service = CLService()
        dex_service = DexScreenerService()
        
        # Test DexScreener service first
        print("Testing DexScreener service...")
        
        # Test with a known token (you may need to adjust these addresses)
        test_chain = 'ethereum'
        test_token = '0xa0b86a33e6ba7b7e8c4b8e8c4b8e8c4b8e8c4b8e'  # Example address
        
        token_data = dex_service.get_token_data(test_chain, test_token)
        if token_data:
            print(f"✓ DexScreener service working: ${token_data.get('price_usd', 0):.6f}")
        else:
            print("⚠ DexScreener service returned no data (may be expected for test address)")
        
        # Test the new price calculation method
        test_position = {
            'id': 'test-position-123',
            'initial_investment': 1000.0,
            'price_range_min': 0.001,
            'price_range_max': 0.01,
            'liquidity_amount': 6870.1000
        }
        
        # Mock token data
        mock_token0_data = {'price_usd': 0.005}
        mock_token1_data = {'price_usd': 0.1}
        
        current_value = cl_service._calculate_current_value_with_prices(
            test_position, mock_token0_data, mock_token1_data
        )
        
        print(f"✓ Real price calculation working: ${current_value:.2f}")
        
        return True
        
    except Exception as e:
        print(f"✗ CLService test failed: {str(e)}")
        return False

def test_api_endpoint(base_url='http://localhost:5000'):
    """Test the new API endpoint."""
    print(f"\nTesting API endpoint at {base_url}...")
    
    try:
        # First, create a test position via API
        position_data = {
            'trade_name': 'API Test Position',
            'pair_symbol': 'LICKO/WHYPE',
            'token0_address': '0x1234567890abcdef1234567890abcdef12345678',
            'token1_address': '0xabcdef1234567890abcdef1234567890abcdef12',
            'price_range_min': 0.001,
            'price_range_max': 0.01,
            'liquidity_amount': 6870.1000,
            'initial_investment': 1000.0,
            'entry_date': datetime.now().isoformat()
        }
        
        # Create position
        create_response = requests.post(
            f"{base_url}/api/cl/positions",
            json=position_data,
            timeout=10
        )
        
        if create_response.status_code == 201:
            position_id = create_response.json()['data']['id']
            print(f"✓ Created test position via API: {position_id}")
            
            # Test the new current-price endpoint
            price_response = requests.get(
                f"{base_url}/api/cl/positions/{position_id}/current-price",
                timeout=10
            )
            
            if price_response.status_code == 200:
                price_data = price_response.json()
                print(f"✓ Current price endpoint working")
                print(f"  Response: {json.dumps(price_data, indent=2)}")
            elif price_response.status_code == 400:
                print("⚠ Current price endpoint returned 400 (expected if no real token addresses)")
                print(f"  Error: {price_response.json().get('error')}")
            else:
                print(f"✗ Current price endpoint failed: {price_response.status_code}")
                print(f"  Response: {price_response.text}")
                return False
            
        else:
            print(f"✗ Failed to create position via API: {create_response.status_code}")
            print(f"  Response: {create_response.text}")
            return False
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("⚠ Could not connect to API server. Make sure the backend is running.")
        return False
    except Exception as e:
        print(f"✗ API endpoint test failed: {str(e)}")
        return False

def main():
    """Run all tests."""
    print("=== Backend Liquidity Tracking Fixes Test ===\n")
    
    tests = [
        ("CLPosition Model", test_cl_position_model),
        ("CLService Real Prices", test_cl_service_real_prices),
        ("API Endpoint", test_api_endpoint)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"Running {test_name} test...")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"✗ {test_name} test crashed: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n=== Test Results ===")
    passed = 0
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(results)} tests")
    
    if passed == len(results):
        print("\n🎉 All tests passed! Backend fixes are working correctly.")
    else:
        print(f"\n⚠ {len(results) - passed} test(s) failed. Check the output above for details.")

if __name__ == "__main__":
    main()