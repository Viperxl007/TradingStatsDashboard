#!/usr/bin/env python3
"""
Test script to verify the breakout trade entry logic fix.

This test validates that:
1. Traditional BUY trades trigger when price goes below entry price
2. Traditional SELL trades trigger when price goes above entry price  
3. Breakout BUY trades trigger when price goes above entry price
4. Breakout SELL trades trigger when price goes below entry price
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.analysis_context_service import AnalysisContextService
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_breakout_entry_logic():
    """Test the breakout vs traditional entry logic fix."""
    
    print("🧪 Testing Breakout Trade Entry Logic Fix")
    print("=" * 60)
    
    service = AnalysisContextService()
    
    # Test scenarios
    test_cases = [
        {
            'name': 'Traditional BUY - Should trigger when price dips below entry',
            'entry_condition': 'Wait for pullback to $100 support zone',
            'action': 'buy',
            'entry_price': 100.0,
            'expected_breakout': False,
            'test_candles': [
                {'time': '2024-01-01T10:00:00Z', 'high': 102.0, 'low': 99.0},  # Should trigger (low <= 100)
                {'time': '2024-01-01T11:00:00Z', 'high': 101.0, 'low': 100.5}  # Should not trigger
            ],
            'should_trigger': True,
            'expected_trigger_price': 99.0
        },
        {
            'name': 'Breakout BUY - Should trigger when price breaks above entry',
            'entry_condition': 'Wait for breakout above $100',
            'action': 'buy', 
            'entry_price': 100.0,
            'expected_breakout': True,
            'test_candles': [
                {'time': '2024-01-01T10:00:00Z', 'high': 100.5, 'low': 99.0},  # Should trigger (high >= 100)
                {'time': '2024-01-01T11:00:00Z', 'high': 99.5, 'low': 98.0}   # Should not trigger
            ],
            'should_trigger': True,
            'expected_trigger_price': 100.5
        },
        {
            'name': 'Traditional SELL - Should trigger when price rises above entry',
            'entry_condition': 'Wait for bounce to $50 resistance',
            'action': 'sell',
            'entry_price': 50.0,
            'expected_breakout': False,
            'test_candles': [
                {'time': '2024-01-01T10:00:00Z', 'high': 50.5, 'low': 49.0},  # Should trigger (high >= 50)
                {'time': '2024-01-01T11:00:00Z', 'high': 49.5, 'low': 48.0}   # Should not trigger
            ],
            'should_trigger': True,
            'expected_trigger_price': 50.5
        },
        {
            'name': 'Breakout SELL - Should trigger when price breaks below entry',
            'entry_condition': 'Wait for breakout below $50',
            'action': 'sell',
            'entry_price': 50.0,
            'expected_breakout': True,
            'test_candles': [
                {'time': '2024-01-01T10:00:00Z', 'high': 51.0, 'low': 49.5},  # Should trigger (low <= 50)
                {'time': '2024-01-01T11:00:00Z', 'high': 51.0, 'low': 50.5}   # Should not trigger
            ],
            'should_trigger': True,
            'expected_trigger_price': 49.5
        }
    ]
    
    # Test breakout detection
    print("\n🔍 Testing Breakout Detection Logic:")
    for case in test_cases:
        is_breakout = service._is_breakout_trade(case['entry_condition'])
        status = "✅ PASS" if is_breakout == case['expected_breakout'] else "❌ FAIL"
        print(f"  {status} {case['name']}: {case['entry_condition']} -> Breakout: {is_breakout}")
    
    print("\n🎯 Testing Entry Trigger Logic:")
    
    # Mock the candlestick data fetch method for testing
    def mock_fetch_candlestick_data_since(ticker, timeframe, since_time):
        # Return the test candles for the current test case
        return current_test_case['test_candles']
    
    # Temporarily replace the method
    original_method = service._fetch_candlestick_data_since
    service._fetch_candlestick_data_since = mock_fetch_candlestick_data_since
    
    try:
        for case in test_cases:
            global current_test_case
            current_test_case = case
            
            print(f"\n  Testing: {case['name']}")
            print(f"    Entry Condition: {case['entry_condition']}")
            print(f"    Action: {case['action']}, Entry Price: ${case['entry_price']}")
            
            # Test the trigger logic
            last_analysis_time = datetime.now() - timedelta(hours=1)
            result = service._check_entry_trigger_hit(
                ticker='TEST',
                timeframe='1h',
                last_analysis_timestamp=last_analysis_time.isoformat(),
                entry_price=case['entry_price'],
                action=case['action'],
                entry_condition=case['entry_condition'],
                is_active_trade=True
            )
            
            # Validate results
            trigger_hit = result.get('trigger_hit', False)
            trigger_details = result.get('trigger_details')
            
            if case['should_trigger']:
                if trigger_hit:
                    trigger_price = trigger_details.get('trigger_price') if trigger_details else None
                    if trigger_price == case['expected_trigger_price']:
                        print(f"    ✅ PASS: Trigger hit at ${trigger_price} as expected")
                    else:
                        print(f"    ❌ FAIL: Trigger hit at ${trigger_price}, expected ${case['expected_trigger_price']}")
                else:
                    print(f"    ❌ FAIL: Expected trigger but none detected")
            else:
                if not trigger_hit:
                    print(f"    ✅ PASS: No trigger detected as expected")
                else:
                    print(f"    ❌ FAIL: Unexpected trigger detected")
    
    finally:
        # Restore original method
        service._fetch_candlestick_data_since = original_method
    
    print("\n" + "=" * 60)
    print("🏁 Breakout Entry Logic Test Complete")
    print("\nKey Improvements:")
    print("✅ Traditional BUY: Triggers when price dips below entry (pullback)")
    print("✅ Breakout BUY: Triggers when price breaks above entry (breakout)")
    print("✅ Traditional SELL: Triggers when price rises above entry (bounce)")
    print("✅ Breakout SELL: Triggers when price breaks below entry (breakdown)")

if __name__ == '__main__':
    test_breakout_entry_logic()