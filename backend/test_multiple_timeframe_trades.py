#!/usr/bin/env python3
"""
Test script to verify that multiple active trades can be created for the same ticker
across different timeframes after the timeframe filtering fix.
"""

import sys
import os
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(__file__))

from services.active_trade_service import ActiveTradeService

def create_mock_analysis_data(ticker, action="buy", entry_price=100.0):
    """Create mock analysis data for testing"""
    return {
        "ticker": ticker,
        "currentPrice": entry_price - 1.0,
        "recommendations": {
            "action": action,
            "entryPrice": entry_price,
            "targetPrice": entry_price * 1.05,
            "stopLoss": entry_price * 0.95
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [
                    {
                        "strategy_type": "breakout",
                        "entry_price": entry_price,
                        "entry_condition": f"Break above ${entry_price}",
                        "probability": "high"
                    }
                ]
            }
        }
    }

def test_multiple_timeframe_trades():
    """Test creating multiple trades for the same ticker on different timeframes"""
    print("🧪 Testing Multiple Timeframe Trades Fix")
    print("=" * 50)
    
    # Initialize the service
    trade_service = ActiveTradeService()
    
    # Test ticker
    ticker = "TESTBTC"
    timeframes = ["15m", "1h", "4h"]
    
    # Clean up any existing trades for this ticker
    print(f"🧹 Cleaning up existing trades for {ticker}...")
    try:
        import sqlite3
        with sqlite3.connect(trade_service.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM active_trades WHERE ticker = ?", (ticker.upper(),))
            conn.commit()
            print(f"✅ Cleaned up existing trades for {ticker}")
    except Exception as e:
        print(f"⚠️ Warning during cleanup: {e}")
    
    created_trades = []
    
    # Test creating trades for each timeframe
    for i, timeframe in enumerate(timeframes):
        print(f"\n{i+1}️⃣ Creating trade for {ticker} on {timeframe} timeframe...")
        
        # Create mock analysis data with slightly different entry prices
        entry_price = 50000.0 + (i * 100)  # 50000, 50100, 50200
        analysis_data = create_mock_analysis_data(ticker, "buy", entry_price)
        
        try:
            # Create trade from analysis
            trade_id = trade_service.create_trade_from_analysis(
                ticker=ticker,
                timeframe=timeframe,
                analysis_id=1000 + i,  # Mock analysis IDs
                analysis_data=analysis_data,
                context=None
            )
            
            if trade_id:
                created_trades.append({
                    'trade_id': trade_id,
                    'timeframe': timeframe,
                    'entry_price': entry_price
                })
                print(f"✅ Created trade {trade_id} for {ticker} on {timeframe} (entry: ${entry_price})")
            else:
                print(f"❌ Failed to create trade for {ticker} on {timeframe}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating trade for {ticker} on {timeframe}: {e}")
            return False
    
    # Verify all trades were created
    print(f"\n🔍 Verifying all trades were created...")
    
    for timeframe in timeframes:
        active_trade = trade_service.get_active_trade(ticker, timeframe)
        if active_trade:
            print(f"✅ Found active trade for {ticker} on {timeframe}: ID {active_trade['id']}, Entry ${active_trade['entry_price']}")
        else:
            print(f"❌ No active trade found for {ticker} on {timeframe}")
            return False
    
    # Test the /active-trades/all endpoint behavior
    print(f"\n🌐 Testing active trades retrieval...")
    try:
        import sqlite3
        with sqlite3.connect(trade_service.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT ticker, timeframe, entry_price, status FROM active_trades
                WHERE ticker = ? AND status IN ('waiting', 'active')
                ORDER BY timeframe
            ''', (ticker.upper(),))
            
            all_trades = cursor.fetchall()
            print(f"✅ Found {len(all_trades)} active trades for {ticker}:")
            for trade in all_trades:
                ticker_db, timeframe_db, entry_price_db, status_db = trade
                print(f"   - {timeframe_db}: ${entry_price_db} ({status_db})")
            
            if len(all_trades) == len(timeframes):
                print(f"✅ All {len(timeframes)} trades are properly stored and retrievable")
            else:
                print(f"❌ Expected {len(timeframes)} trades, found {len(all_trades)}")
                return False
                
    except Exception as e:
        print(f"❌ Error retrieving trades: {e}")
        return False
    
    # Clean up test trades
    print(f"\n🧹 Cleaning up test trades...")
    try:
        with sqlite3.connect(trade_service.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM active_trades WHERE ticker = ?", (ticker.upper(),))
            conn.commit()
            print(f"✅ Cleaned up test trades for {ticker}")
    except Exception as e:
        print(f"⚠️ Warning during cleanup: {e}")
    
    print(f"\n🎉 SUCCESS: Multiple timeframe trades fix is working correctly!")
    print(f"   - Created {len(created_trades)} separate trades for {ticker}")
    print(f"   - Each timeframe has its own independent trade")
    print(f"   - All trades are properly stored and retrievable")
    
    return True

if __name__ == "__main__":
    try:
        success = test_multiple_timeframe_trades()
        if success:
            print(f"\n✅ All tests passed! The timeframe filtering fix is working correctly.")
        else:
            print(f"\n❌ Tests failed! There may be issues with the fix.")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test script error: {e}")
        sys.exit(1)