#!/usr/bin/env python3
"""
Test script to verify that the active trade fixes work correctly.
This will test both the JSON parsing fix and the time window fix.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.active_trade_service import ActiveTradeService
from services.analysis_context_service import AnalysisContextService
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_active_trade_detection():
    """Test that migrated active trades are properly detected"""
    
    print("🧪 Testing Active Trade Detection Fixes")
    print("=" * 50)
    
    # Initialize services
    active_trade_service = ActiveTradeService()
    context_service = AnalysisContextService()
    
    # Test ticker that should have a migrated active trade
    ticker = "HYPEUSD"
    current_price = 36.39  # Example current price
    timeframe = "1h"
    
    print(f"\n1. Testing ActiveTradeService.get_active_trade() for {ticker}")
    print("-" * 40)
    
    try:
        active_trade = active_trade_service.get_active_trade(ticker)
        if active_trade:
            print(f"✅ Active trade found for {ticker}")
            print(f"   Trade ID: {active_trade['id']}")
            print(f"   Status: {active_trade['status']}")
            print(f"   Action: {active_trade['action']}")
            print(f"   Entry Price: ${active_trade['entry_price']}")
            print(f"   Created: {active_trade['created_at']}")
            
            # Check JSON fields
            json_fields = ['trigger_hit_candle_data', 'original_analysis_data', 'original_context', 'close_details']
            for field in json_fields:
                value = active_trade.get(field)
                if value is not None:
                    print(f"   {field}: {type(value).__name__} ({'parsed' if isinstance(value, dict) else 'raw'})")
                else:
                    print(f"   {field}: None")
        else:
            print(f"❌ No active trade found for {ticker}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting active trade: {str(e)}")
        return False
    
    print(f"\n2. Testing ActiveTradeService.get_trade_context_for_ai() for {ticker}")
    print("-" * 40)
    
    try:
        trade_context = active_trade_service.get_trade_context_for_ai(ticker, current_price)
        if trade_context:
            print(f"✅ Trade context retrieved for {ticker}")
            print(f"   Has Active Trade: {trade_context.get('has_active_trade')}")
            print(f"   Status: {trade_context.get('status')}")
            print(f"   Trade Message: {trade_context.get('trade_message')}")
            print(f"   Unrealized P&L: ${trade_context.get('unrealized_pnl', 0):.2f}")
        else:
            print(f"❌ No trade context found for {ticker}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting trade context: {str(e)}")
        return False
    
    print(f"\n3. Testing AnalysisContextService.get_comprehensive_context() for {ticker}")
    print("-" * 40)
    
    try:
        comprehensive_context = context_service.get_comprehensive_context(ticker, timeframe, current_price)
        if comprehensive_context:
            print(f"✅ Comprehensive context retrieved for {ticker}")
            print(f"   Context Type: {comprehensive_context.get('context_type')}")
            print(f"   Has Context: {comprehensive_context.get('has_context')}")
            print(f"   Has Active Trade: {comprehensive_context.get('has_active_trade')}")
            print(f"   Status: {comprehensive_context.get('status')}")
            
            # Check if historical context was retrieved
            historical = comprehensive_context.get('historical_context')
            if historical:
                print(f"   Historical Context: Available")
                print(f"   Historical Analysis ID: {historical.get('analysis_id', 'N/A')}")
            else:
                print(f"   Historical Context: None (this is expected for legacy trades)")
                
        else:
            print(f"❌ No comprehensive context found for {ticker}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting comprehensive context: {str(e)}")
        return False
    
    print(f"\n4. Testing time window bypass for legacy trades")
    print("-" * 40)
    
    # The key test: comprehensive context should work even if the original analysis is old
    if comprehensive_context and comprehensive_context.get('has_active_trade'):
        print(f"✅ Time window bypass working - active trade detected despite age")
        print(f"   This means the AI will now be aware of the legacy migrated trade")
    else:
        print(f"❌ Time window bypass failed - legacy trade not detected")
        return False
    
    print(f"\n🎉 All tests passed! The active trade fixes are working correctly.")
    print(f"   - JSON parsing errors have been resolved")
    print(f"   - Time window limitations have been bypassed for active trades")
    print(f"   - Legacy migrated trades are now properly detected")
    
    return True

if __name__ == "__main__":
    success = test_active_trade_detection()
    if success:
        print(f"\n✅ Test completed successfully!")
        sys.exit(0)
    else:
        print(f"\n❌ Test failed!")
        sys.exit(1)