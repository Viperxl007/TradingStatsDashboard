#!/usr/bin/env python3
"""
Test script for trigger detection functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.analysis_context_service import AnalysisContextService
from datetime import datetime, timedelta
import json

def test_trigger_detection():
    """Test the trigger detection functionality"""
    
    print("🧪 Testing Trigger Detection System")
    print("=" * 50)
    
    # Initialize the service
    service = AnalysisContextService()
    
    # Test parameters
    ticker = "HYPEUSD"
    timeframe = "1h"
    current_price = 36.68
    
    print(f"📊 Testing for {ticker} at ${current_price}")
    print(f"⏰ Timeframe: {timeframe}")
    
    # Get context (this will trigger the new functionality)
    context = service.get_recent_analysis_context(ticker, timeframe, current_price)
    
    if context:
        print("\n✅ Context Retrieved:")
        print(f"   Action: {context.get('action', 'N/A')}")
        print(f"   Entry Price: ${context.get('entry_price', 'N/A')}")
        print(f"   Hours Ago: {context.get('hours_ago', 'N/A'):.1f}")
        print(f"   Trigger Hit: {context.get('trigger_hit', False)}")
        
        if context.get('trigger_hit'):
            print(f"   🎯 Trigger Message: {context.get('trigger_message', 'N/A')}")
            trigger_details = context.get('trigger_details', {})
            if trigger_details:
                print(f"   🎯 Trigger Time: {trigger_details.get('trigger_time', 'N/A')}")
                print(f"   🎯 Trigger Price: ${trigger_details.get('trigger_price', 'N/A')}")
        else:
            print("   ⏳ No trigger detected")
    else:
        print("❌ No context found")
    
    print("\n🧪 Test completed!")

if __name__ == "__main__":
    test_trigger_detection()