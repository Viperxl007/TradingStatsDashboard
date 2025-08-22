#!/usr/bin/env python3
"""
Test script to verify ETH price fix in chart summary generation.

This script tests that:
1. Chart summary includes ETH price data
2. AI prompt generation includes ETH price correctly
3. ETH price is no longer showing as $0.00
"""

import sys
import os
import logging
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from services.macro_chart_service import MacroChartService
from services.macro_ai_service import MacroAIService
from models.macro_sentiment_models import get_macro_db

def test_chart_summary_eth_price():
    """Test that chart summary includes ETH price data."""
    print("🔍 Testing chart summary ETH price inclusion...")
    
    try:
        # Create chart service
        chart_service = MacroChartService()
        
        # Get chart summary
        summary = chart_service.get_chart_summary(days=7)
        
        if 'error' in summary:
            print(f"❌ Chart summary error: {summary['error']}")
            return False
        
        # Check if ETH price is included
        if 'eth_price' not in summary:
            print("❌ ETH price data missing from chart summary")
            return False
        
        eth_price_data = summary['eth_price']
        current_eth_price = eth_price_data.get('current', 0)
        
        print(f"✅ ETH price data found in summary:")
        print(f"   Current: ${current_eth_price:,.2f}")
        print(f"   Min: ${eth_price_data.get('min', 0):,.2f}")
        print(f"   Max: ${eth_price_data.get('max', 0):,.2f}")
        print(f"   Change: {eth_price_data.get('change_percent', 0):+.1f}%")
        
        if current_eth_price == 0:
            print("⚠️ ETH price is still $0.00 - data may be missing")
            return False
        
        print("✅ Chart summary ETH price test PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Chart summary test failed: {e}")
        return False

def test_ai_prompt_eth_price():
    """Test that AI prompt includes ETH price correctly."""
    print("\n🔍 Testing AI prompt ETH price inclusion...")
    
    try:
        # Create AI service
        ai_service = MacroAIService()
        
        # Get chart summary
        chart_summary = ai_service.chart_service.get_chart_summary(days=7)
        
        if 'error' in chart_summary:
            print(f"❌ Chart summary error: {chart_summary['error']}")
            return False
        
        # Build analysis prompt (this is where the bug was)
        prompt = ai_service._build_analysis_prompt(chart_summary)
        
        # Check if ETH price appears in prompt
        if "ETH Price: $0.00" in prompt:
            print("❌ ETH price still showing as $0.00 in AI prompt")
            print("Prompt excerpt:")
            lines = prompt.split('\n')
            for line in lines:
                if 'ETH Price:' in line:
                    print(f"   {line}")
            return False
        
        # Extract ETH price line from prompt
        eth_price_line = None
        lines = prompt.split('\n')
        for line in lines:
            if 'ETH Price:' in line:
                eth_price_line = line.strip()
                break
        
        if eth_price_line:
            print(f"✅ ETH price in AI prompt: {eth_price_line}")
        else:
            print("⚠️ ETH price line not found in AI prompt")
            return False
        
        print("✅ AI prompt ETH price test PASSED")
        return True
        
    except Exception as e:
        print(f"❌ AI prompt test failed: {e}")
        return False

def test_database_eth_data():
    """Test that database has ETH data available."""
    print("\n🔍 Testing database ETH data availability...")
    
    try:
        # Get database
        db = get_macro_db()
        
        # Get recent data
        end_timestamp = int(datetime.now(timezone.utc).timestamp())
        start_timestamp = end_timestamp - (7 * 24 * 60 * 60)  # 7 days
        
        market_data = db.get_market_data_range(start_timestamp, end_timestamp)
        
        if not market_data:
            print("❌ No market data found in database")
            return False
        
        # Check if ETH data exists
        eth_data_count = 0
        sample_eth_prices = []
        
        for record in market_data[-10:]:  # Check last 10 records
            if 'eth_price' in record and record['eth_price'] > 0:
                eth_data_count += 1
                sample_eth_prices.append(record['eth_price'])
        
        print(f"✅ Database contains {len(market_data)} market data records")
        print(f"✅ {eth_data_count} of last 10 records have valid ETH price data")
        
        if sample_eth_prices:
            print(f"✅ Sample ETH prices: ${min(sample_eth_prices):,.2f} - ${max(sample_eth_prices):,.2f}")
        
        if eth_data_count == 0:
            print("❌ No valid ETH price data found in recent records")
            return False
        
        print("✅ Database ETH data test PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

def main():
    """Run all ETH price fix tests."""
    print("🚀 Starting ETH Price Fix Verification Tests")
    print("=" * 50)
    
    # Configure logging
    logging.basicConfig(level=logging.WARNING)  # Reduce noise
    
    # Run tests
    tests = [
        test_database_eth_data,
        test_chart_summary_eth_price,
        test_ai_prompt_eth_price
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"🎯 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - ETH price fix is working correctly!")
        print("\nThe chart summary generation bug has been resolved:")
        print("✅ Chart summary includes ETH price data")
        print("✅ AI prompt shows correct ETH price (not $0.00)")
        print("✅ Database has valid ETH data")
    else:
        print("❌ Some tests failed - ETH price fix needs more work")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())