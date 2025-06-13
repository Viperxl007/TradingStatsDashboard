#!/usr/bin/env python3
"""
Test script to verify the chart analysis response parsing fix
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from chart_analyzer import ChartAnalyzer

def test_parsing_fixes():
    """Test both structured JSON and unstructured text parsing"""
    print("Testing chart analysis response parsing fixes...")
    
    analyzer = ChartAnalyzer()
    
    # Test 1: Structured JSON response (should work as before)
    print("\n1. Testing structured JSON response:")
    json_response = '''
    {
        "ticker": "AAPL",
        "summary": "Strong bullish trend with support at $200",
        "confidence_score": 0.85,
        "trend": "bullish",
        "key_levels": [200, 210, 220]
    }
    '''
    try:
        result = analyzer._parse_analysis_response(json_response, "AAPL")
        print(f"   ✓ JSON parsing successful")
        print(f"   ✓ Ticker: {result.get('ticker')}")
        print(f"   ✓ Summary: {result.get('summary')}")
        print(f"   ✓ Confidence: {result.get('confidence_score')}")
    except Exception as e:
        print(f"   ✗ Error parsing JSON: {e}")
    
    # Test 2: Unstructured text response (this was failing before)
    print("\n2. Testing unstructured text response:")
    text_response = '''
    Looking at the AAPL chart, I can see a strong bullish trend forming. The stock has been making higher highs and higher lows, indicating positive momentum.
    
    Key observations:
    - Support level around $200
    - Resistance at $220
    - Volume is increasing on up moves
    - RSI shows momentum but not overbought
    
    Overall, this looks like a continuation pattern with upside potential to $230.
    '''
    try:
        result = analyzer._parse_analysis_response(text_response, "AAPL")
        print(f"   ✓ Unstructured text parsing successful")
        print(f"   ✓ Ticker: {result.get('ticker')}")
        print(f"   ✓ Summary: {result.get('summary')[:100]}...")
        print(f"   ✓ Confidence: {result.get('confidence_score')}")
        print(f"   ✓ Trend: {result.get('trend')}")
        print(f"   ✓ Key levels: {result.get('key_levels')}")
        print(f"   ✓ Analysis type: {result.get('analysis_type')}")
    except Exception as e:
        print(f"   ✗ Error parsing unstructured text: {e}")
    
    # Test 3: Malformed JSON (should fallback to unstructured parsing)
    print("\n3. Testing malformed JSON response:")
    malformed_response = '''
    { "ticker": "AAPL", "summary": "Bullish trend but the JSON is incomplete...
    
    The chart shows strong momentum with support at $200 and resistance at $220.
    '''
    try:
        result = analyzer._parse_analysis_response(malformed_response, "AAPL")
        print(f"   ✓ Malformed JSON handled gracefully")
        print(f"   ✓ Ticker: {result.get('ticker')}")
        print(f"   ✓ Summary: {result.get('summary')[:100]}...")
        print(f"   ✓ Confidence: {result.get('confidence_score')}")
        print(f"   ✓ Analysis type: {result.get('analysis_type')}")
    except Exception as e:
        print(f"   ✗ Error handling malformed JSON: {e}")
    
    # Test 4: Empty or minimal response
    print("\n4. Testing minimal response:")
    minimal_response = "Bullish."
    try:
        result = analyzer._parse_analysis_response(minimal_response, "AAPL")
        print(f"   ✓ Minimal response handled")
        print(f"   ✓ Ticker: {result.get('ticker')}")
        print(f"   ✓ Summary: {result.get('summary')}")
        print(f"   ✓ Confidence: {result.get('confidence_score')}")
    except Exception as e:
        print(f"   ✗ Error handling minimal response: {e}")

if __name__ == "__main__":
    test_parsing_fixes()