#!/usr/bin/env python3
"""
Verify BTC Trade Fix Script

This script verifies that the BTC trade was correctly updated in the database
and calculates the expected percentage to confirm the fix.
"""

import sqlite3
import json
import os
import sys

# Add the backend directory to the path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.append(backend_dir)

def verify_btc_trade_fix():
    """Verify the BTC trade was correctly fixed"""
    
    # Database path
    db_path = os.path.join(backend_dir, 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Get the BTC trade details
            cursor.execute('''
                SELECT id, ticker, entry_price, close_price, close_reason, status, 
                       realized_pnl, close_details, created_at, close_time
                FROM active_trades 
                WHERE ticker = 'BTCUSD' 
                AND entry_price = 118500.0
                ORDER BY created_at DESC
                LIMIT 1
            ''')
            
            trade = cursor.fetchone()
            
            if not trade:
                print("❌ BTC trade not found")
                return False
            
            trade_id, ticker, entry_price, close_price, close_reason, status, realized_pnl, close_details, created_at, close_time = trade
            
            print(f"🔍 BTC Trade Verification:")
            print(f"   Trade ID: {trade_id}")
            print(f"   Ticker: {ticker}")
            print(f"   Entry Price: ${entry_price}")
            print(f"   Close Price: ${close_price}")
            print(f"   Close Reason: {close_reason}")
            print(f"   Status: {status}")
            print(f"   Realized P&L: ${realized_pnl}")
            print(f"   Created: {created_at}")
            print(f"   Closed: {close_time}")
            
            # Calculate expected percentage
            if entry_price and close_price:
                expected_percentage = ((close_price - entry_price) / entry_price) * 100
                print(f"\n📊 Performance Calculation:")
                print(f"   Formula: ((close_price - entry_price) / entry_price) * 100")
                print(f"   Calculation: (({close_price} - {entry_price}) / {entry_price}) * 100")
                print(f"   Expected Percentage: {expected_percentage:.2f}%")
                
                # Check if this matches what we expect
                if abs(expected_percentage - (-2.11)) < 0.1:
                    print(f"   ✅ Percentage calculation is CORRECT")
                else:
                    print(f"   ❌ Percentage calculation is INCORRECT")
                    print(f"   Expected: -2.11%, Calculated: {expected_percentage:.2f}%")
            
            # Check close details
            if close_details:
                try:
                    details = json.loads(close_details)
                    print(f"\n📋 Close Details:")
                    for key, value in details.items():
                        print(f"   {key}: {value}")
                except:
                    print(f"\n📋 Close Details (raw): {close_details}")
            
            # Verify the correction was applied
            expected_values = {
                'close_price': 116000.0,
                'close_reason': 'stop_loss',
                'status': 'stop_hit',
                'realized_pnl': -2500.0
            }
            
            actual_values = {
                'close_price': close_price,
                'close_reason': close_reason,
                'status': status,
                'realized_pnl': realized_pnl
            }
            
            print(f"\n✅ Verification Results:")
            all_correct = True
            for key, expected in expected_values.items():
                actual = actual_values[key]
                is_correct = actual == expected
                all_correct = all_correct and is_correct
                status_icon = "✅" if is_correct else "❌"
                print(f"   {status_icon} {key}: {actual} {'✓' if is_correct else f'(expected: {expected})'}")
            
            if all_correct:
                print(f"\n🎉 BTC trade fix verification PASSED!")
                print(f"   The trade should now show -2.11% performance")
                print(f"   If frontend still shows -10.55%, it's a caching/refresh issue")
            else:
                print(f"\n❌ BTC trade fix verification FAILED!")
                print(f"   Some values don't match expected corrections")
            
            return all_correct
            
    except Exception as e:
        print(f"❌ Error verifying BTC trade: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔍 BTC Trade Fix Verification")
    print("=" * 50)
    
    success = verify_btc_trade_fix()
    
    if success:
        print("\n💡 If frontend still shows incorrect percentage:")
        print("   1. Hard refresh the browser (Ctrl+F5)")
        print("   2. Clear browser cache")
        print("   3. Restart the frontend development server")
    
    print("\n" + "=" * 50)