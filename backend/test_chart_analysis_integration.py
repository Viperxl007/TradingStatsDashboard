#!/usr/bin/env python3
"""
Integration test for chart analysis feature.
Tests the full workflow from image upload to analysis storage.
"""

import sys
import os
import requests
import json
from PIL import Image, ImageDraw
import io
import base64

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '.'))

def create_test_chart_image():
    """Create a simple test chart image."""
    # Create a simple chart-like image
    width, height = 800, 600
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    
    # Draw axes
    draw.line([(50, height-50), (width-50, height-50)], fill='black', width=2)  # X-axis
    draw.line([(50, 50), (50, height-50)], fill='black', width=2)  # Y-axis
    
    # Draw a simple price line
    points = []
    for i in range(10):
        x = 50 + (i * (width-100) // 9)
        y = height - 100 - (i * 20) + ((-1)**i * 30)  # Zigzag pattern
        points.append((x, y))
    
    for i in range(len(points)-1):
        draw.line([points[i], points[i+1]], fill='blue', width=3)
    
    # Add some labels
    draw.text((width//2-50, height-30), "Time", fill='black')
    draw.text((10, height//2), "Price", fill='black')
    draw.text((width//2-50, 20), "AAPL Test Chart", fill='black')
    
    # Convert to bytes
    img_buffer = io.BytesIO()
    image.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    
    return img_buffer.getvalue()

def test_chart_analysis_endpoint():
    """Test the chart analysis endpoint."""
    print("Testing Chart Analysis Integration...")
    
    # Create test image
    print("1. Creating test chart image...")
    image_data = create_test_chart_image()
    print(f"   Created test image ({len(image_data)} bytes)")
    
    # Test the analyze endpoint
    print("2. Testing /api/chart-analysis/analyze endpoint...")
    
    url = "http://localhost:5000/api/chart-analysis/analyze"
    files = {
        'image': ('test_chart.png', image_data, 'image/png')
    }
    data = {
        'ticker': 'AAPL',
        'context': json.dumps({
            'timeframe': '1D',
            'test_mode': True
        })
    }
    
    try:
        response = requests.post(url, files=files, data=data, timeout=30)
        print(f"   Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("   ✓ Analysis successful!")
            print(f"   - Ticker: {result.get('ticker', 'N/A')}")
            print(f"   - Analysis ID: {result.get('analysis_id', 'N/A')}")
            print(f"   - Confidence: {result.get('confidence_score', 'N/A')}")
            print(f"   - Summary: {result.get('summary', 'N/A')[:100]}...")
            return True
        else:
            print(f"   ✗ Analysis failed: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Request failed: {str(e)}")
        return False

def test_history_endpoint():
    """Test the history endpoint."""
    print("3. Testing /api/chart-analysis/history endpoint...")
    
    url = "http://localhost:5000/api/chart-analysis/history/AAPL"
    
    try:
        response = requests.get(url, timeout=10)
        print(f"   Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("   ✓ History retrieval successful!")
            print(f"   - Count: {result.get('count', 0)}")
            print(f"   - Analyses: {len(result.get('analyses', []))}")
            return True
        else:
            print(f"   ✗ History retrieval failed: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Request failed: {str(e)}")
        return False

def test_levels_endpoint():
    """Test the levels endpoint."""
    print("4. Testing /api/chart-analysis/levels endpoint...")
    
    url = "http://localhost:5000/api/chart-analysis/levels/AAPL?near_price=150.00"
    
    try:
        response = requests.get(url, timeout=10)
        print(f"   Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("   ✓ Levels retrieval successful!")
            print(f"   - Technical levels: {len(result.get('technical_levels', {}).get('support', []))} support, {len(result.get('technical_levels', {}).get('resistance', []))} resistance")
            print(f"   - AI levels: {len(result.get('ai_levels', []))}")
            return True
        else:
            print(f"   ✗ Levels retrieval failed: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Request failed: {str(e)}")
        return False

def main():
    """Run all integration tests."""
    print("=" * 60)
    print("CHART ANALYSIS INTEGRATION TESTS")
    print("=" * 60)
    
    # Check if server is running
    try:
        response = requests.get("http://localhost:5000/api/health", timeout=5)
        if response.status_code != 200:
            print("✗ Backend server is not running or not healthy")
            return False
    except requests.exceptions.RequestException:
        print("✗ Backend server is not accessible at http://localhost:5000")
        return False
    
    print("✓ Backend server is running")
    print()
    
    # Run tests
    tests = [
        test_chart_analysis_endpoint,
        test_history_endpoint,
        test_levels_endpoint
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
            print()
        except Exception as e:
            print(f"   ✗ Test failed with exception: {str(e)}")
            results.append(False)
            print()
    
    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All integration tests passed!")
        return True
    else:
        print("✗ Some integration tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)