#!/usr/bin/env python3
"""
Surgical Database Update Script
Restores erroneously closed BTC and XRP trades to their correct active states.

CRITICAL ISSUE: The recent emergency fix resolved the auto-closure bug, but the BTC and XRP trades 
that were incorrectly marked as "user_closed" need to be restored to their correct active states.

SPECIFIC TRADES TO FIX:
1. BTC Trade (ID: 26): Should be "waiting" status (waiting for entry at $106,500)
2. XRP Trade (ID: 27): Should be "active" status (currently open and taken)
"""

import sqlite3
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Database path (matches ActiveTradeService)
DB_PATH = 'backend/instance/chart_analysis.db'

def get_trade_by_id(trade_id: int) -> Optional[Dict[str, Any]]:
    """Get trade details by ID"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM active_trades WHERE id = ?', (trade_id,))
            row = cursor.fetchone()
            
            if row:
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))
            return None
    except Exception as e:
        print(f"❌ Error fetching trade {trade_id}: {e}")
        return None

def update_trade_status(trade_id: int, new_status: str, reason: str) -> bool:
    """
    Surgically update trade status with proper data integrity
    
    Args:
        trade_id: Trade ID to update
        new_status: New status ('waiting' or 'active')
        reason: Reason for the status change
    
    Returns:
        True if successful, False otherwise
    """
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get current trade data
            current_trade = get_trade_by_id(trade_id)
            if not current_trade:
                print(f"❌ Trade {trade_id} not found")
                return False
            
            print(f"📊 Current trade {trade_id} status: {current_trade['status']}")
            
            # Prepare update data based on new status
            update_data = {
                'status': new_status,
                'updated_at': datetime.now().isoformat(),
                'close_reason': None,  # Clear close reason
                'close_details': None,  # Clear close details
                'realized_pnl': None   # Clear realized P&L
            }
            
            # For waiting trades, clear close-related fields
            if new_status == 'waiting':
                update_data.update({
                    'close_time': None,
                    'close_price': None,
                })
            
            # For active trades, clear close-related fields but keep entry data
            elif new_status == 'active':
                update_data.update({
                    'close_time': None,
                    'close_price': None,
                })
            
            # Build SQL update query
            set_clause = ', '.join([f"{key} = ?" for key in update_data.keys()])
            values = list(update_data.values()) + [trade_id]
            
            # Execute the update
            cursor.execute(f'''
                UPDATE active_trades 
                SET {set_clause}
                WHERE id = ?
            ''', values)
            
            # Add audit trail entry
            cursor.execute('''
                INSERT INTO trade_updates (trade_id, price, update_type, update_data, update_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                trade_id,
                current_trade.get('current_price', current_trade.get('entry_price', 0)),
                'status_correction',
                json.dumps({
                    'reason': reason,
                    'old_status': current_trade['status'],
                    'new_status': new_status,
                    'correction_type': 'emergency_bug_fix',
                    'timestamp': datetime.now().isoformat()
                }),
                datetime.now().isoformat()
            ))
            
            conn.commit()
            
            print(f"✅ Trade {trade_id} status updated: {current_trade['status']} → {new_status}")
            print(f"   Reason: {reason}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error updating trade {trade_id}: {e}")
        return False

def validate_trade_correction(trade_id: int, expected_status: str) -> bool:
    """Validate that the trade correction was successful"""
    try:
        updated_trade = get_trade_by_id(trade_id)
        if not updated_trade:
            print(f"❌ Validation failed: Trade {trade_id} not found after update")
            return False
        
        if updated_trade['status'] != expected_status:
            print(f"❌ Validation failed: Trade {trade_id} status is {updated_trade['status']}, expected {expected_status}")
            return False
        
        # Check that close-related fields are properly cleared
        if expected_status in ['waiting', 'active']:
            if updated_trade.get('close_reason') is not None:
                print(f"⚠️  Warning: Trade {trade_id} still has close_reason: {updated_trade['close_reason']}")
            if updated_trade.get('realized_pnl') is not None:
                print(f"⚠️  Warning: Trade {trade_id} still has realized_pnl: {updated_trade['realized_pnl']}")
        
        print(f"✅ Validation passed: Trade {trade_id} is now {expected_status}")
        return True
        
    except Exception as e:
        print(f"❌ Validation error for trade {trade_id}: {e}")
        return False

def main():
    """Main execution function"""
    print("🔧 SURGICAL DATABASE UPDATE: Restoring Erroneously Closed Trades")
    print("=" * 70)
    
    # Define the trades to fix
    trades_to_fix = [
        {
            'id': 26,
            'ticker': 'BTCUSD',
            'correct_status': 'waiting',
            'reason': 'BTC trade should be waiting for entry at $106,500 - was erroneously closed by auto-closure bug'
        },
        {
            'id': 27,
            'ticker': 'XRPUSD', 
            'correct_status': 'active',
            'reason': 'XRP trade should be active (currently open and taken) - was erroneously closed by auto-closure bug'
        }
    ]
    
    # Verify database exists
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='active_trades'")
            if not cursor.fetchone():
                print(f"❌ Database table 'active_trades' not found at {DB_PATH}")
                sys.exit(1)
    except Exception as e:
        print(f"❌ Cannot access database at {DB_PATH}: {e}")
        sys.exit(1)
    
    print(f"✅ Database connection verified: {DB_PATH}")
    print()
    
    # Process each trade
    success_count = 0
    for trade_info in trades_to_fix:
        trade_id = trade_info['id']
        ticker = trade_info['ticker']
        correct_status = trade_info['correct_status']
        reason = trade_info['reason']
        
        print(f"🎯 Processing Trade ID {trade_id} ({ticker})")
        print(f"   Target Status: {correct_status}")
        print(f"   Reason: {reason}")
        
        # Get current trade state
        current_trade = get_trade_by_id(trade_id)
        if not current_trade:
            print(f"❌ Trade {trade_id} not found, skipping")
            continue
        
        current_status = current_trade['status']
        print(f"   Current Status: {current_status}")
        
        # Check if correction is needed
        if current_status == correct_status:
            print(f"✅ Trade {trade_id} already has correct status: {correct_status}")
            success_count += 1
            continue
        
        # Perform the correction
        if update_trade_status(trade_id, correct_status, reason):
            # Validate the correction
            if validate_trade_correction(trade_id, correct_status):
                success_count += 1
                print(f"✅ Trade {trade_id} successfully corrected")
            else:
                print(f"❌ Trade {trade_id} correction validation failed")
        else:
            print(f"❌ Failed to correct trade {trade_id}")
        
        print()
    
    # Summary
    print("=" * 70)
    print(f"📋 CORRECTION SUMMARY:")
    print(f"   Total trades processed: {len(trades_to_fix)}")
    print(f"   Successfully corrected: {success_count}")
    print(f"   Failed corrections: {len(trades_to_fix) - success_count}")
    
    if success_count == len(trades_to_fix):
        print("✅ ALL TRADES SUCCESSFULLY CORRECTED")
        print()
        print("🔍 NEXT STEPS:")
        print("   1. Validate trades appear correctly in AI Trade Tracker UI")
        print("   2. Verify trades appear correctly on charts")
        print("   3. Test trade functionality and data integrity")
        sys.exit(0)
    else:
        print("❌ SOME CORRECTIONS FAILED - MANUAL INTERVENTION REQUIRED")
        sys.exit(1)

if __name__ == "__main__":
    main()