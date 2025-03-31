"""
Simple test script to check if the API is working correctly.
"""

import requests

def test_health_endpoint():
    """Test the health endpoint."""
    try:
        response = requests.get('http://localhost:5000/api/health')
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def test_analyze_endpoint():
    """Test the analyze endpoint with a known ticker."""
    try:
        response = requests.get('http://localhost:5000/api/analyze/AAPL')
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success! API is working correctly.")
        else:
            print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

if __name__ == '__main__':
    print("Testing API endpoints...")
    print("\nTesting health endpoint:")
    health_ok = test_health_endpoint()
    
    print("\nTesting analyze endpoint:")
    analyze_ok = test_analyze_endpoint()
    
    if health_ok and analyze_ok:
        print("\nAll tests passed! The API is working correctly.")
    else:
        print("\nSome tests failed. Please check the API server.")