#!/usr/bin/env python3
"""
Test script to verify the trade closure fix is working correctly.
This script tests that trades are not immediately closed after creation.
"""

import sys
import os
import time
import requests
import json
from datetime import datetime

# Add the backend directory to the Python path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

from services.active_trade_service import ActiveTradeService

def test_trade_creation_and_status():
    """Test that trades are created properly and not immediately closed"""
    
    print("🧪 Testing Trade Closure Fix")
    print("=" * 50)
    
    # Initialize the active trade service
    service = ActiveTradeService()
    
    # Test data for ETHUSD (similar to the failing case)
    ticker = "ETHUSD"
    timeframe = "1h"
    analysis_id = 999  # Test analysis ID
    
    # Mock analysis data similar to what caused the issue
    analysis_data = {
        "currentPrice": 2738.6,
        "recommendations": {
            "action": "buy",
            "entryPrice": 2750.0,
            "targetPrice": 2820.0,
            "stopLoss": 2620.0,
            "reasoning": "Test trade for closure fix verification"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [
                    {
                        "strategy_type": "breakout",
                        "entry_price": 2750.0,
                        "entry_condition": "Wait for breakout above $2750.0",
                        "probability": "high"
                    }
                ]
            }
        }
    }
    
    print(f"📊 Creating test trade for {ticker}")
    print(f"   Entry: ${analysis_data['recommendations']['entryPrice']}")
    print(f"   Target: ${analysis_data['recommendations']['targetPrice']}")
    print(f"   Stop: ${analysis_data['recommendations']['stopLoss']}")
    
    # Step 1: Create the trade
    trade_id = service.create_trade_from_analysis(ticker, timeframe, analysis_id, analysis_data)
    
    if not trade_id:
        print("❌ Failed to create trade")
        return False
    
    print(f"✅ Trade created successfully with ID: {trade_id}")
    
    # Step 2: Immediately check trade status (this is where the bug occurred)
    print("\n🔍 Checking trade status immediately after creation...")
    
    trade = service.get_active_trade(ticker)
    if not trade:
        print("❌ Trade not found immediately after creation - this indicates the bug is still present!")
        return False
    
    print(f"✅ Trade found: Status = {trade['status']}, ID = {trade['id']}")
    
    if trade['status'] != 'waiting':
        print(f"❌ Trade status is '{trade['status']}' instead of 'waiting' - bug may still be present!")
        return False
    
    # Step 3: Test the get_trade_context_for_ai method (this triggered the bug)
    print("\n🎯 Testing get_trade_context_for_ai method (this previously caused immediate closure)...")
    
    context = service.get_trade_context_for_ai(ticker, analysis_data['currentPrice'])
    
    if not context:
        print("❌ Trade context is None - trade was closed during context retrieval!")
        return False
    
    print(f"✅ Trade context retrieved successfully")
    print(f"   Status: {context.get('status')}")
    print(f"   Trade ID: {context.get('trade_id')}")
    print(f"   Message: {context.get('trade_message', 'No message')}")
    
    # Step 4: Verify trade is still active
    print("\n🔍 Final verification - checking if trade still exists...")
    
    final_trade = service.get_active_trade(ticker)
    if not final_trade:
        print("❌ Trade was closed during testing - bug is still present!")
        return False
    
    if final_trade['status'] not in ['waiting', 'active']:
        print(f"❌ Trade status changed to '{final_trade['status']}' - unexpected closure!")
        return False
    
    print(f"✅ Trade still exists with status: {final_trade['status']}")
    
    # Step 5: Clean up test trade
    print(f"\n🧹 Cleaning up test trade {trade_id}...")
    success = service.close_trade_by_user(ticker, analysis_data['currentPrice'], "Test cleanup", "user_closed")
    
    if success:
        print("✅ Test trade cleaned up successfully")
    else:
        print("⚠️ Failed to clean up test trade - manual cleanup may be needed")
    
    print("\n🎉 ALL TESTS PASSED - Trade closure fix is working correctly!")
    return True

def test_historical_exit_protection():
    """Test that historical exit conditions don't affect new trades"""
    
    print("\n🧪 Testing Historical Exit Protection")
    print("=" * 50)
    
    service = ActiveTradeService()
    
    # Create a trade and immediately test historical exit conditions
    ticker = "BTCUSD"
    analysis_data = {
        "currentPrice": 45000.0,
        "recommendations": {
            "action": "buy",
            "entryPrice": 45100.0,
            "targetPrice": 46000.0,
            "stopLoss": 44000.0,
            "reasoning": "Test trade for historical exit protection"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [
                    {
                        "strategy_type": "momentum",
                        "entry_price": 45100.0,
                        "entry_condition": "Wait for momentum confirmation",
                        "probability": "medium"
                    }
                ]
            }
        }
    }
    
    trade_id = service.create_trade_from_analysis(ticker, "1h", 998, analysis_data)
    
    if not trade_id:
        print("❌ Failed to create test trade")
        return False
    
    print(f"✅ Created test trade {trade_id}")
    
    # Get the trade and test historical exit conditions directly
    trade = service.get_active_trade(ticker)
    
    print("🔍 Testing historical exit conditions on newly created trade...")
    
    # This should return None due to the grace period protection
    historical_exit = service._check_historical_exit_conditions(ticker, trade)
    
    if historical_exit:
        print("❌ Historical exit conditions triggered on new trade - protection failed!")
        return False
    
    print("✅ Historical exit protection working - no premature exit detected")
    
    # Clean up
    service.close_trade_by_user(ticker, analysis_data['currentPrice'], "Test cleanup", "user_closed")
    
    return True

if __name__ == "__main__":
    print("🚀 Starting Trade Closure Fix Tests")
    print("=" * 60)
    
    try:
        # Test 1: Basic trade creation and context retrieval
        test1_passed = test_trade_creation_and_status()
        
        # Test 2: Historical exit protection
        test2_passed = test_historical_exit_protection()
        
        if test1_passed and test2_passed:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ Trade closure fix is working correctly")
            print("✅ Trades should now remain in WAITING status until properly triggered")
            print("✅ Trade status icons should appear correctly on charts")
        else:
            print("\n❌ SOME TESTS FAILED!")
            print("⚠️ The trade closure bug may still be present")
            
    except Exception as e:
        print(f"\n💥 Test execution failed with error: {str(e)}")
        import traceback
        traceback.print_exc()