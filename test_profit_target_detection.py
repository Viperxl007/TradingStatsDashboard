#!/usr/bin/env python3
"""
Test script to verify profit target and stop loss detection functionality.
This tests the enhanced ActiveTradeService with historical candle checking.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.services.active_trade_service import ActiveTradeService
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_profit_target_detection():
    """Test the profit target detection system"""
    
    print("🧪 Testing Profit Target Detection System")
    print("=" * 50)
    
    # Initialize the service
    service = ActiveTradeService()
    
    # Test case: SOLUSD scenario
    ticker = "SOLUSD"
    current_price = 150.98  # Close to target but not quite there
    
    print(f"📊 Testing {ticker} at current price: ${current_price}")
    
    # Get trade context (this will trigger all our new logic)
    context = service.get_trade_context_for_ai(ticker, current_price)
    
    if context:
        print(f"✅ Active trade found:")
        print(f"   Trade ID: {context.get('trade_id')}")
        print(f"   Status: {context.get('status')}")
        print(f"   Action: {context.get('action')}")
        print(f"   Entry Price: ${context.get('entry_price')}")
        print(f"   Target Price: ${context.get('target_price')}")
        print(f"   Stop Loss: ${context.get('stop_loss')}")
        print(f"   Current Price: ${context.get('current_price')}")
        print(f"   Unrealized P&L: ${context.get('unrealized_pnl')}")
        print(f"   Trade Message: {context.get('trade_message')}")
    else:
        print("❌ No active trade found or trade was closed")
    
    print("\n🔍 Testing with price at exact target...")
    target_price = 152.00
    context_at_target = service.get_trade_context_for_ai(ticker, target_price)
    
    if context_at_target:
        print(f"⚠️  Trade still active at target price ${target_price}")
    else:
        print(f"✅ Trade was closed when price hit target ${target_price}")
    
    print("\n🔍 Testing with price above target...")
    above_target_price = 153.00
    context_above_target = service.get_trade_context_for_ai(ticker, above_target_price)
    
    if context_above_target:
        print(f"⚠️  Trade still active above target price ${above_target_price}")
    else:
        print(f"✅ Trade was closed when price exceeded target ${above_target_price}")

def test_historical_analysis_time():
    """Test the historical chart analysis time retrieval"""
    
    print("\n🧪 Testing Historical Chart Analysis Time Retrieval")
    print("=" * 50)
    
    service = ActiveTradeService()
    
    # Test getting last chart analysis time
    ticker = "SOLUSD"
    last_time = service._get_last_chart_analysis_time(ticker)
    
    if last_time:
        print(f"✅ Last chart analysis time for {ticker}: {last_time}")
    else:
        print(f"❌ No chart analysis records found for {ticker}")

if __name__ == "__main__":
    print("🚀 Starting Profit Target Detection Tests")
    print("=" * 60)
    
    try:
        test_profit_target_detection()
        test_historical_analysis_time()
        
        print("\n✅ All tests completed!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()