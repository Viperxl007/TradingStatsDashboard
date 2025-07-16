#!/usr/bin/env python3
"""
Test script to verify that the restored AAVE trade shows as active in the system.
This script simulates how the frontend would query for active trades.
"""

import sqlite3
import json
from datetime import datetime

def test_active_trade():
    """Test that the AAVE trade appears correctly as an active trade."""
    
    db_path = "backend/instance/chart_analysis.db"
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Testing Active Trade Query...")
        print("=" * 60)
        
        # Query for active trades (this simulates frontend behavior)
        cursor.execute("""
            SELECT id, ticker, action, entry_price, target_price, stop_loss, 
                   status, current_price, unrealized_pnl, created_at, updated_at
            FROM active_trades 
            WHERE status = 'active'
            ORDER BY created_at DESC
        """)
        
        active_trades = cursor.fetchall()
        
        print(f"📊 Found {len(active_trades)} active trade(s)")
        print()
        
        # Look specifically for the AAVE trade
        aave_trade = None
        for trade in active_trades:
            if trade[1] == 'AAVEUSD':  # ticker is at index 1
                aave_trade = trade
                break
        
        if aave_trade:
            print("✅ AAVE Trade Found and Active!")
            print("-" * 40)
            print(f"Trade ID: {aave_trade[0]}")
            print(f"Ticker: {aave_trade[1]}")
            print(f"Action: {aave_trade[2]}")
            print(f"Entry Price: ${aave_trade[3]}")
            print(f"Target Price: ${aave_trade[4]}")
            print(f"Stop Loss: ${aave_trade[5]}")
            print(f"Status: {aave_trade[6]}")
            print(f"Current Price: ${aave_trade[7]}")
            print(f"Unrealized P&L: ${aave_trade[8]}")
            print(f"Created: {aave_trade[9]}")
            print(f"Updated: {aave_trade[10]}")
            print()
            
            # Verify key fields
            if aave_trade[6] == 'active':
                print("✅ Status: ACTIVE (correct)")
            else:
                print(f"❌ Status: {aave_trade[6]} (should be 'active')")
                
            if aave_trade[3] == 300.0:
                print("✅ Entry Price: $300.0 (correct)")
            else:
                print(f"❌ Entry Price: ${aave_trade[3]} (should be $300.0)")
                
            if aave_trade[4] == 340.0:
                print("✅ Target Price: $340.0 (correct)")
            else:
                print(f"❌ Target Price: ${aave_trade[4]} (should be $340.0)")
                
            if aave_trade[5] == 290.0:
                print("✅ Stop Loss: $290.0 (correct)")
            else:
                print(f"❌ Stop Loss: ${aave_trade[5]} (should be $290.0)")
                
        else:
            print("❌ AAVE trade not found in active trades!")
            print("This indicates the restoration may not have worked correctly.")
            
        print()
        print("📋 All Active Trades Summary:")
        print("-" * 40)
        for i, trade in enumerate(active_trades, 1):
            print(f"{i}. {trade[1]} - {trade[2]} - Status: {trade[6]} - Entry: ${trade[3]}")
            
        # Test specific query that frontend might use
        print()
        print("🔍 Testing Frontend-Style Query...")
        print("-" * 40)
        
        cursor.execute("""
            SELECT COUNT(*) as active_count
            FROM active_trades 
            WHERE status = 'active' AND ticker = 'AAVEUSD'
        """)
        
        aave_count = cursor.fetchone()[0]
        print(f"Active AAVE trades count: {aave_count}")
        
        if aave_count == 1:
            print("✅ Frontend query would find exactly 1 active AAVE trade (correct)")
        elif aave_count == 0:
            print("❌ Frontend query would find 0 active AAVE trades (problem!)")
        else:
            print(f"⚠️  Frontend query would find {aave_count} active AAVE trades (unexpected)")
            
        conn.close()
        
        print()
        print("=" * 60)
        if aave_trade and aave_trade[6] == 'active':
            print("🎉 SUCCESS: AAVE trade is properly restored and shows as ACTIVE!")
            print("The system will now continue monitoring this trade.")
        else:
            print("❌ FAILURE: AAVE trade restoration verification failed!")
            
        return aave_trade is not None and aave_trade[6] == 'active'
        
    except Exception as e:
        print(f"❌ Error testing active trade: {e}")
        return False

if __name__ == "__main__":
    success = test_active_trade()
    exit(0 if success else 1)