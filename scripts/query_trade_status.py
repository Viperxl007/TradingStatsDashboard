#!/usr/bin/env python3
"""
Query Trade Status Script
Investigates the current status of BTC and XRP trades that were erroneously closed.
"""

import requests
import json
import sys
from datetime import datetime

def query_trade_status():
    """Query the current status of trades from the backend API"""
    
    print("🔍 Querying current trade status from backend...")
    
    try:
        # Query all trades history to find BTC and XRP trades
        response = requests.get('http://localhost:5000/api/active-trades/history-all')
        
        if response.status_code == 200:
            data = response.json()
            all_trades = data.get('all_trades', [])
            
            print(f"✅ Found {len(all_trades)} total trades in history")
            
            # Look for BTC and XRP trades (check multiple ticker variations)
            btc_trades = [t for t in all_trades if t['ticker'].upper() in ['BTC', 'BTCUSD', 'BTCUSDT']]
            xrp_trades = [t for t in all_trades if t['ticker'].upper() in ['XRP', 'XRPUSD', 'XRPUSDT']]
            
            print(f"\n📊 BTC Trades Found: {len(btc_trades)}")
            for trade in btc_trades:
                print(f"  ID: {trade['id']}, Status: {trade['status']}, Entry: ${trade['entry_price']}, Created: {trade['created_at']}")
                if trade['status'] == 'user_closed':
                    print(f"    ⚠️  ERRONEOUSLY CLOSED TRADE FOUND!")
                    print(f"    Close Time: {trade.get('close_time', 'N/A')}")
                    print(f"    Close Price: {trade.get('close_price', 'N/A')}")
                    print(f"    Close Reason: {trade.get('close_reason', 'N/A')}")
            
            print(f"\n📊 XRP Trades Found: {len(xrp_trades)}")
            for trade in xrp_trades:
                print(f"  ID: {trade['id']}, Status: {trade['status']}, Entry: ${trade['entry_price']}, Created: {trade['created_at']}")
                if trade['status'] == 'user_closed':
                    print(f"    ⚠️  ERRONEOUSLY CLOSED TRADE FOUND!")
                    print(f"    Close Time: {trade.get('close_time', 'N/A')}")
                    print(f"    Close Price: {trade.get('close_price', 'N/A')}")
                    print(f"    Close Reason: {trade.get('close_reason', 'N/A')}")
            
            # Look specifically for trade ID 26 (BTC)
            trade_26 = next((t for t in all_trades if t['id'] == 26), None)
            if trade_26:
                print(f"\n🎯 SPECIFIC BTC TRADE (ID: 26) STATUS:")
                print(f"  Ticker: {trade_26['ticker']}")
                print(f"  Status: {trade_26['status']}")
                print(f"  Entry Price: ${trade_26['entry_price']}")
                print(f"  Target Price: ${trade_26.get('target_price', 'N/A')}")
                print(f"  Stop Loss: ${trade_26.get('stop_loss', 'N/A')}")
                print(f"  Created: {trade_26['created_at']}")
                print(f"  Updated: {trade_26['updated_at']}")
                if trade_26['status'] == 'user_closed':
                    print(f"  ❌ CONFIRMED: This trade was erroneously closed!")
                    print(f"  Should be: 'waiting' (waiting for entry at $106,500)")
            else:
                print(f"\n❌ Trade ID 26 not found!")
            
            # Find the most recent XRP trade that should be active
            recent_xrp = None
            if xrp_trades:
                # Sort by creation date, get most recent
                xrp_trades.sort(key=lambda x: x['created_at'], reverse=True)
                recent_xrp = xrp_trades[0]
                
                print(f"\n🎯 MOST RECENT XRP TRADE STATUS:")
                print(f"  ID: {recent_xrp['id']}")
                print(f"  Ticker: {recent_xrp['ticker']}")
                print(f"  Status: {recent_xrp['status']}")
                print(f"  Entry Price: ${recent_xrp['entry_price']}")
                print(f"  Created: {recent_xrp['created_at']}")
                print(f"  Updated: {recent_xrp['updated_at']}")
                if recent_xrp['status'] == 'user_closed':
                    print(f"  ❌ CONFIRMED: This trade was erroneously closed!")
                    print(f"  Should be: 'active' (currently open and taken)")
            
            # Summary of what needs to be fixed
            print(f"\n🔧 TRADES REQUIRING STATUS CORRECTION:")
            fixes_needed = []
            
            if trade_26 and trade_26['status'] == 'user_closed':
                fixes_needed.append({
                    'id': trade_26['id'],
                    'ticker': trade_26['ticker'],
                    'current_status': trade_26['status'],
                    'correct_status': 'waiting',
                    'reason': 'Waiting for entry at $106,500'
                })
            
            if recent_xrp and recent_xrp['status'] == 'user_closed':
                fixes_needed.append({
                    'id': recent_xrp['id'],
                    'ticker': recent_xrp['ticker'],
                    'current_status': recent_xrp['status'],
                    'correct_status': 'active',
                    'reason': 'Currently open and taken'
                })
            
            if fixes_needed:
                for fix in fixes_needed:
                    print(f"  • Trade ID {fix['id']} ({fix['ticker']}): {fix['current_status']} → {fix['correct_status']}")
                    print(f"    Reason: {fix['reason']}")
                
                return fixes_needed
            else:
                print("  ✅ No trades found that need status correction")
                return []
                
        else:
            print(f"❌ Failed to fetch trades: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return []
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error: Backend server may not be running")
        print("Please ensure the backend is running on http://localhost:5000")
        return []
    except Exception as e:
        print(f"❌ Error querying trades: {e}")
        return []

if __name__ == "__main__":
    fixes_needed = query_trade_status()
    
    if fixes_needed:
        print(f"\n📋 SUMMARY: {len(fixes_needed)} trades need status correction")
        sys.exit(1)  # Exit with error code to indicate fixes needed
    else:
        print(f"\n✅ SUMMARY: No trades need status correction")
        sys.exit(0)  # Exit successfully