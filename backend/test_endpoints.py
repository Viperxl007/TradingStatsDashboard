#!/usr/bin/env python3
"""
Test script to verify the chart analysis endpoints work with the fixes
"""

import requests
import json
import base64
from PIL import Image
import io

def create_test_chart_image():
    """Create a simple test chart image"""
    # Create a simple test image (simulating a chart)
    img = Image.new('RGB', (800, 600), color='white')
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    img_base64 = base64.b64encode(img_data).decode('utf-8')
    
    return img_base64

def test_chart_analysis_endpoint():
    """Test the chart analysis endpoint"""
    print("Testing chart analysis endpoint...")
    
    base_url = "http://localhost:5000"
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{base_url}/api/health", timeout=5)
        if response.status_code == 200:
            print("✓ Backend server is running")
        else:
            print("✗ Backend server health check failed")
            return
    except requests.exceptions.RequestException as e:
        print(f"✗ Cannot connect to backend server: {e}")
        return
    
    # Test 2: Test price fetching (this was one of the bugs)
    try:
        response = requests.get(f"{base_url}/api/analyze/AAPL", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Price fetching works: AAPL = ${data.get('currentPrice', 'N/A')}")
        else:
            print(f"✗ Price fetching failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"✗ Price fetching error: {e}")
    
    # Test 3: Test chart analysis endpoint (this was the other bug)
    try:
        # Create test image file
        img = Image.new('RGB', (800, 600), color='white')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        # Prepare multipart form data
        files = {
            'image': ('test_chart.png', buffer, 'image/png')
        }
        data = {
            'ticker': 'AAPL',
            'context': json.dumps({
                "current_price": 200.0,
                "timeframe": "1D"
            })
        }
        
        response = requests.post(
            f"{base_url}/api/chart-analysis/analyze",
            files=files,
            data=data,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✓ Chart analysis endpoint works")
            print(f"  - Analysis ID: {data.get('analysis_id', 'N/A')}")
            print(f"  - Ticker: {data.get('ticker', 'N/A')}")
            print(f"  - Has summary: {'summary' in data}")
            print(f"  - Confidence: {data.get('confidence_score', 'N/A')}")
        elif response.status_code == 500:
            print("✗ Chart analysis returned 500 error (this was the original bug)")
            try:
                error_data = response.json()
                print(f"  Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"  Raw error: {response.text}")
        else:
            print(f"✗ Chart analysis failed: {response.status_code}")
            print(f"  Response: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"✗ Chart analysis request error: {e}")

if __name__ == "__main__":
    test_chart_analysis_endpoint()