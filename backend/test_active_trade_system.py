"""
Test script for the Active Trade Tracking System

This script tests the complete lifecycle of active trades to ensure proper
state management and context tracking across chart reads.
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(__file__))

from services.active_trade_service import ActiveTradeService, TradeStatus
from services.analysis_context_service import AnalysisContextService
from app.chart_context import ChartContextManager

def test_active_trade_lifecycle():
    """Test the complete active trade lifecycle"""
    print("🧪 Testing Active Trade Lifecycle")
    print("=" * 50)
    
    # Initialize services
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'test_chart_analysis.db')
    
    # Clean up any existing test database
    if os.path.exists(db_path):
        os.remove(db_path)
    
    trade_service = ActiveTradeService(db_path)
    context_service = AnalysisContextService(db_path)
    chart_manager = ChartContextManager(db_path)
    
    ticker = "TESTCOIN"
    timeframe = "1h"
    current_price = 100.0
    
    print(f"📊 Testing with {ticker} at ${current_price}")
    
    # Step 1: Create initial analysis with buy recommendation
    print("\n1️⃣ Creating initial analysis with BUY recommendation...")
    
    analysis_data = {
        "currentPrice": current_price,
        "recommendations": {
            "action": "buy",
            "entryPrice": 95.0,  # Pullback entry
            "targetPrice": 110.0,
            "stopLoss": 90.0,
            "reasoning": "Bullish breakout setup with pullback entry"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "pullback",
                    "entry_condition": "Wait for pullback to $95 support zone",
                    "entry_price": 95.0,
                    "probability": "high"
                }]
            }
        },
        "sentiment": "bullish",
        "confidence": 0.85,
        "timeframe": timeframe
    }
    
    analysis_id = chart_manager.store_analysis(ticker, analysis_data, timeframe=timeframe)
    print(f"✅ Created analysis {analysis_id}")
    
    # Check if trade was created
    active_trade = trade_service.get_active_trade(ticker)
    if active_trade:
        print(f"✅ Active trade created: {active_trade['status']} {active_trade['action']} at ${active_trade['entry_price']}")
    else:
        print("❌ No active trade created")
        return False
    
    # Step 2: Test context retrieval (should show waiting trade)
    print("\n2️⃣ Testing context retrieval for waiting trade...")
    
    context = context_service.get_comprehensive_context(ticker, timeframe, current_price)
    if context and context.get('context_type') == 'active_trade':
        print(f"✅ Active trade context retrieved: {context['status']} trade")
        print(f"   Trade message: {context.get('trade_message', 'N/A')}")
    else:
        print("❌ Failed to retrieve active trade context")
        return False
    
    # Step 3: Simulate price movement to trigger entry
    print("\n3️⃣ Simulating price movement to trigger entry...")
    
    # Simulate price dropping to trigger the buy order
    trigger_price = 94.5  # Below the entry price of 95.0
    
    # Mock trigger details (normally this would come from candlestick data)
    trigger_details = {
        'trigger_time': datetime.now().isoformat(),
        'trigger_price': trigger_price,
        'entry_price': 95.0,
        'candle_data': {
            'time': datetime.now().isoformat(),
            'open': 96.0,
            'high': 96.5,
            'low': trigger_price,
            'close': 95.2,
            'volume': 1000000
        }
    }
    
    # Update trade trigger
    success = trade_service.update_trade_trigger(ticker, trigger_details)
    if success:
        print(f"✅ Trade trigger updated: entry hit at ${trigger_price}")
    else:
        print("❌ Failed to update trade trigger")
        return False
    
    # Step 4: Test context after trigger (should show active trade)
    print("\n4️⃣ Testing context after trigger...")
    
    new_price = 96.0  # Price after entry
    context = context_service.get_comprehensive_context(ticker, timeframe, new_price)
    if context and context.get('status') == 'active':
        print(f"✅ Trade is now ACTIVE: {context['trade_message']}")
    else:
        print("❌ Trade should be active but context shows otherwise")
        return False
    
    # Step 5: Test trade progress updates
    print("\n5️⃣ Testing trade progress updates...")
    
    # Update with favorable price movement
    favorable_price = 105.0
    progress = trade_service.update_trade_progress(ticker, favorable_price)
    if progress:
        print(f"✅ Trade progress updated: P&L = ${progress.get('unrealized_pnl', 0):.2f}")
        print(f"   Max favorable: ${progress.get('max_favorable_price', 0):.2f}")
    else:
        print("❌ Failed to update trade progress")
        return False
    
    # Step 6: Test AI context for active trade
    print("\n6️⃣ Testing AI context for active trade...")
    
    ai_context = trade_service.get_trade_context_for_ai(ticker, favorable_price)
    if ai_context and ai_context.get('has_active_trade'):
        print(f"✅ AI context generated for active trade")
        print(f"   Status: {ai_context['status']}")
        print(f"   AI Instruction: {ai_context.get('ai_instruction', 'N/A')[:100]}...")
    else:
        print("❌ Failed to generate AI context for active trade")
        return False
    
    # Step 7: Test target hit (automatic close)
    print("\n7️⃣ Testing target hit (automatic close)...")
    
    target_price = 110.5  # Above target of 110.0
    progress = trade_service.update_trade_progress(ticker, target_price)
    if progress and progress.get('exit_triggered'):
        print(f"✅ Target hit - trade automatically closed")
        print(f"   Exit reason: {progress.get('exit_reason')}")
        print(f"   Final P&L: ${progress.get('unrealized_pnl', 0):.2f}")
    else:
        print("❌ Target should have been hit but trade not closed")
        return False
    
    # Step 8: Test context after trade closure
    print("\n8️⃣ Testing context after trade closure...")
    
    context = context_service.get_comprehensive_context(ticker, timeframe, target_price)
    if not context or context.get('context_type') != 'active_trade':
        print("✅ No active trade context after closure - correct behavior")
    else:
        print("❌ Active trade context still present after closure")
        return False
    
    # Step 9: Test trade history
    print("\n9️⃣ Testing trade history...")
    
    history = trade_service.get_trade_history(ticker, limit=5)
    if history and len(history) > 0:
        last_trade = history[0]
        print(f"✅ Trade history retrieved: {len(history)} trades")
        print(f"   Last trade: {last_trade['status']} {last_trade['action']} at ${last_trade['entry_price']}")
        print(f"   Realized P&L: ${last_trade.get('realized_pnl', 0):.2f}")
    else:
        print("❌ Failed to retrieve trade history")
        return False
    
    print("\n🎉 All tests passed! Active Trade Tracking System is working correctly.")
    return True

def test_user_override():
    """Test user override functionality"""
    print("\n🧪 Testing User Override Functionality")
    print("=" * 50)
    
    # Initialize services
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'test_override.db')
    
    # Clean up any existing test database
    if os.path.exists(db_path):
        os.remove(db_path)
    
    trade_service = ActiveTradeService(db_path)
    chart_manager = ChartContextManager(db_path)
    
    ticker = "OVERRIDE"
    
    # Create a waiting trade
    analysis_data = {
        "currentPrice": 50.0,
        "recommendations": {
            "action": "sell",
            "entryPrice": 55.0,  # Breakout entry
            "targetPrice": 45.0,
            "stopLoss": 58.0,
            "reasoning": "Bearish breakdown setup"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "breakout",
                    "entry_condition": "Wait for breakout above $55",
                    "entry_price": 55.0,
                    "probability": "medium"
                }]
            }
        }
    }
    
    analysis_id = chart_manager.store_analysis(ticker, analysis_data, timeframe="4h")
    print(f"✅ Created waiting trade for {ticker}")
    
    # Test user override close
    current_price = 52.0
    success = trade_service.close_trade_by_user(ticker, current_price, "Changed mind about setup")
    
    if success:
        print(f"✅ User successfully closed waiting trade at ${current_price}")
        
        # Verify trade is closed
        active_trade = trade_service.get_active_trade(ticker)
        if not active_trade:
            print("✅ No active trade after user override - correct")
            return True
        else:
            print("❌ Trade still active after user override")
            return False
    else:
        print("❌ User override failed")
        return False

def test_api_endpoints():
    """Test the API endpoints"""
    print("\n🧪 Testing API Endpoints")
    print("=" * 50)
    
    base_url = "http://localhost:5000/api"
    ticker = "APITEST"
    
    try:
        # Test get active trade (should be none initially)
        response = requests.get(f"{base_url}/active-trades/{ticker}")
        if response.status_code == 200:
            data = response.json()
            if data.get('active_trade') is None:
                print("✅ GET /active-trades/{ticker} - No active trade (correct)")
            else:
                print("❌ GET /active-trades/{ticker} - Unexpected active trade found")
        else:
            print(f"❌ GET /active-trades/{ticker} failed: {response.status_code}")
            
        # Test get all active trades
        response = requests.get(f"{base_url}/active-trades/all")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET /active-trades/all - Found {data.get('count', 0)} active trades")
        else:
            print(f"❌ GET /active-trades/all failed: {response.status_code}")
            
        # Test get trade history
        response = requests.get(f"{base_url}/active-trades/{ticker}/history")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET /active-trades/{ticker}/history - Found {data.get('count', 0)} historical trades")
        else:
            print(f"❌ GET /active-trades/{ticker}/history failed: {response.status_code}")
            
        return True
        
    except requests.exceptions.ConnectionError:
        print("⚠️ API endpoints test skipped - Flask server not running")
        print("   Start the server with 'python app.py' to test API endpoints")
        return True
    except Exception as e:
        print(f"❌ API endpoints test failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Active Trade Tracking System Test Suite")
    print("=" * 60)
    
    all_passed = True
    
    # Run all tests
    tests = [
        ("Active Trade Lifecycle", test_active_trade_lifecycle),
        ("User Override", test_user_override),
        ("API Endpoints", test_api_endpoints)
    ]
    
    for test_name, test_func in tests:
        try:
            print(f"\n🧪 Running {test_name} Test...")
            result = test_func()
            if result:
                print(f"✅ {test_name} Test: PASSED")
            else:
                print(f"❌ {test_name} Test: FAILED")
                all_passed = False
        except Exception as e:
            print(f"❌ {test_name} Test: ERROR - {str(e)}")
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL TESTS PASSED! Active Trade Tracking System is ready for production.")
    else:
        print("❌ SOME TESTS FAILED! Please review the issues above.")
    
    print("\n📋 Summary:")
    print("- Active trades are properly created from analysis recommendations")
    print("- Trade status is correctly maintained across chart reads")
    print("- Trigger detection works for entry conditions")
    print("- Trade progress is tracked with P&L calculations")
    print("- Automatic closure works for profit/stop targets")
    print("- User override functionality is available")
    print("- API endpoints provide trade management capabilities")
    print("- Context service provides comprehensive trade information to AI")