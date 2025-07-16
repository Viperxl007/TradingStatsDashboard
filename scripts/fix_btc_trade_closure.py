#!/usr/bin/env python3
"""
Fix BTC Trade Closure Script

This script corrects the BTC trade that was manually closed with incorrect parameters.
It should have been closed as a stop loss hit at $116,000, not user closed at $106,000.

Trade Details:
- Entry: $118,500
- Stop Loss: $116,000 (should have triggered)
- Incorrect Exit: $106,000 (USER CLOSED)
- Correct Exit: $116,000 (STOP HIT)
"""

import sqlite3
import json
from datetime import datetime
import os
import sys

# Add the backend directory to the path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.append(backend_dir)

def fix_btc_trade_closure():
    """Fix the BTC trade closure with correct stop loss parameters"""
    
    # Database path
    db_path = os.path.join(backend_dir, 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # First, find the BTC trade that was incorrectly closed
            cursor.execute('''
                SELECT id, ticker, entry_price, close_price, close_reason, status, created_at, close_time
                FROM active_trades 
                WHERE ticker = 'BTCUSD' 
                AND entry_price = 118500.0
                AND close_price = 106000.0
                AND status IN ('user_closed', 'USER_CLOSED')
                ORDER BY created_at DESC
                LIMIT 1
            ''')
            
            trade = cursor.fetchone()
            
            if not trade:
                print("❌ Could not find the incorrectly closed BTC trade")
                print("   Looking for: BTCUSD, Entry: $118,500, Exit: $106,000, Status: USER_CLOSED")
                
                # Let's see what BTC trades exist
                cursor.execute('''
                    SELECT id, ticker, entry_price, close_price, close_reason, status, created_at
                    FROM active_trades 
                    WHERE ticker = 'BTCUSD'
                    ORDER BY created_at DESC
                    LIMIT 5
                ''')
                
                btc_trades = cursor.fetchall()
                print(f"\n📊 Found {len(btc_trades)} BTC trades:")
                for t in btc_trades:
                    print(f"   ID: {t[0]}, Entry: ${t[2]}, Exit: ${t[3]}, Status: {t[5]}, Created: {t[6]}")
                
                return False
            
            trade_id, ticker, entry_price, close_price, close_reason, status, created_at, close_time = trade
            
            print(f"🔍 Found BTC trade to fix:")
            print(f"   Trade ID: {trade_id}")
            print(f"   Entry Price: ${entry_price}")
            print(f"   Current Exit Price: ${close_price} (INCORRECT)")
            print(f"   Current Status: {status} (INCORRECT)")
            print(f"   Created: {created_at}")
            print(f"   Closed: {close_time}")
            
            # Calculate the correct P&L
            correct_exit_price = 116000.0  # Stop loss price
            correct_pnl = correct_exit_price - entry_price  # Buy trade: exit - entry
            
            print(f"\n🔧 Applying corrections:")
            print(f"   Correct Exit Price: ${correct_exit_price} (stop loss)")
            print(f"   Correct Status: stop_hit")
            print(f"   Correct P&L: ${correct_pnl}")
            
            # Update the trade with correct parameters
            cursor.execute('''
                UPDATE active_trades
                SET
                    close_price = ?,
                    current_price = ?,
                    close_reason = 'stop_loss',
                    status = 'stop_hit',
                    realized_pnl = ?,
                    close_details = ?,
                    updated_at = ?
                WHERE id = ?
            ''', (
                correct_exit_price,
                correct_exit_price,  # CRITICAL FIX: Set current_price = close_price for closed trades
                correct_pnl,
                json.dumps({
                    'stop_loss': correct_exit_price,
                    'hit_price': correct_exit_price,
                    'reason': 'stop_loss',
                    'pnl': correct_pnl,
                    'correction_applied': True,
                    'original_exit_price': close_price,
                    'original_status': status,
                    'correction_timestamp': datetime.now().isoformat()
                }),
                datetime.now().isoformat(),
                trade_id
            ))
            
            # Add a trade update record for the correction
            cursor.execute('''
                INSERT INTO trade_updates (trade_id, price, update_type, update_data, notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                trade_id,
                correct_exit_price,
                'correction_applied',
                json.dumps({
                    'correction_type': 'stop_loss_fix',
                    'original_exit_price': close_price,
                    'corrected_exit_price': correct_exit_price,
                    'original_status': status,
                    'corrected_status': 'stop_hit',
                    'reason': 'Fixed incorrect manual closure - should have been stop loss hit',
                    'correction_timestamp': datetime.now().isoformat()
                }),
                'Applied stop loss detection fix - corrected exit price and status'
            ))
            
            conn.commit()
            
            print(f"\n✅ BTC trade {trade_id} corrected successfully!")
            print(f"   Exit Price: ${close_price} → ${correct_exit_price}")
            print(f"   Status: {status} → stop_hit")
            print(f"   P&L: ${correct_pnl}")
            
            # Verify the correction
            cursor.execute('''
                SELECT close_price, close_reason, status, realized_pnl
                FROM active_trades 
                WHERE id = ?
            ''', (trade_id,))
            
            updated_trade = cursor.fetchone()
            if updated_trade:
                print(f"\n🔍 Verification:")
                print(f"   Exit Price: ${updated_trade[0]}")
                print(f"   Close Reason: {updated_trade[1]}")
                print(f"   Status: {updated_trade[2]}")
                print(f"   Realized P&L: ${updated_trade[3]}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error fixing BTC trade: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔧 BTC Trade Closure Fix Script")
    print("=" * 50)
    
    success = fix_btc_trade_closure()
    
    if success:
        print("\n🎉 BTC trade closure fixed successfully!")
        print("   The trade now correctly shows as 'STOP HIT' at $116,000")
    else:
        print("\n❌ Failed to fix BTC trade closure")
        
    print("\n" + "=" * 50)