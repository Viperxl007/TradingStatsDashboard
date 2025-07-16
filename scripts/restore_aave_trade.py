#!/usr/bin/env python3
"""
URGENT DATABASE FIX: Restore AAVE Trade to Active Status

This script restores trade ID 40 (AAVEUSD) from "user_closed" back to "active" status.
The trade was incorrectly closed due to a recursive function call bug.

Trade Details:
- Trade ID: 40
- Ticker: AAVEUSD
- Entry Price: $300.0
- Target Price: $340.0
- Stop Loss: $290.0
- Action: buy
- Trigger Hit Price: $293.88
- Current Price: $301.36
- Should be: "active" (currently "user_closed")
"""

import sqlite3
import os
from datetime import datetime
import json

def restore_aave_trade():
    """Restore AAVE trade ID 40 to active status"""
    db_path = os.path.join('backend', 'instance', 'chart_analysis.db')
    backup_path = os.path.join('backend', 'instance', 'chart_analysis_backup_20250712.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    if not os.path.exists(backup_path):
        print(f"❌ Backup not found at: {backup_path}")
        return False
    
    print(f"🔧 Starting AAVE trade restoration...")
    print(f"📁 Database: {db_path}")
    print(f"💾 Backup: {backup_path}")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Start transaction
        cursor.execute("BEGIN TRANSACTION;")
        
        # First, verify the trade exists and get current data
        print("🔍 Verifying trade ID 40 exists...")
        cursor.execute("SELECT * FROM active_trades WHERE id = 40;")
        trade = cursor.fetchone()
        
        if not trade:
            print("❌ Trade ID 40 not found!")
            conn.rollback()
            conn.close()
            return False
        
        # Get column names for display
        cursor.execute("PRAGMA table_info(active_trades);")
        columns = cursor.fetchall()
        col_names = [col[1] for col in columns]
        
        print("📊 Current trade data:")
        for i, value in enumerate(trade):
            if col_names[i] in ['status', 'close_time', 'close_price', 'close_reason', 'close_details', 'current_price']:
                print(f"  {col_names[i]}: {value}")
        print()
        
        # Verify this is the correct trade
        if trade[col_names.index('ticker')] != 'AAVEUSD':
            print(f"❌ Trade ID 40 is not AAVEUSD! Found: {trade[col_names.index('ticker')]}")
            conn.rollback()
            conn.close()
            return False
        
        if trade[col_names.index('status')] != 'user_closed':
            print(f"❌ Trade is not in 'user_closed' status! Current: {trade[col_names.index('status')]}")
            conn.rollback()
            conn.close()
            return False
        
        print("✅ Trade verification passed. Proceeding with restoration...")
        
        # Update the trade to restore it to active status
        update_query = """
        UPDATE active_trades 
        SET 
            status = 'active',
            close_time = NULL,
            close_price = NULL,
            close_reason = NULL,
            close_details = NULL,
            current_price = 301.36,
            updated_at = ?
        WHERE id = 40;
        """
        
        current_time = datetime.now().isoformat()
        cursor.execute(update_query, (current_time,))
        
        # Verify the update
        cursor.execute("SELECT * FROM active_trades WHERE id = 40;")
        updated_trade = cursor.fetchone()
        
        print("📊 Updated trade data:")
        for i, value in enumerate(updated_trade):
            if col_names[i] in ['status', 'close_time', 'close_price', 'close_reason', 'close_details', 'current_price', 'updated_at']:
                print(f"  {col_names[i]}: {value}")
        print()
        
        # Verify critical fields
        status_idx = col_names.index('status')
        current_price_idx = col_names.index('current_price')
        close_time_idx = col_names.index('close_time')
        close_price_idx = col_names.index('close_price')
        close_reason_idx = col_names.index('close_reason')
        close_details_idx = col_names.index('close_details')
        
        if (updated_trade[status_idx] == 'active' and
            updated_trade[current_price_idx] == 301.36 and
            updated_trade[close_time_idx] is None and
            updated_trade[close_price_idx] is None and
            updated_trade[close_reason_idx] is None and
            updated_trade[close_details_idx] is None):
            
            # Commit the transaction
            conn.commit()
            print("✅ AAVE trade successfully restored to active status!")
            
            # Log the change for audit trail
            log_entry = {
                "timestamp": current_time,
                "action": "restore_trade_to_active",
                "trade_id": 40,
                "ticker": "AAVEUSD",
                "previous_status": "user_closed",
                "new_status": "active",
                "reason": "Correcting recursive function call bug - AI correctly recommended maintain position",
                "script": "restore_aave_trade.py"
            }
            
            print("📝 Audit log entry:")
            print(json.dumps(log_entry, indent=2))
            
            # Verify trade data integrity
            print("\n🔍 Verifying trade data integrity:")
            entry_price_idx = col_names.index('entry_price')
            target_price_idx = col_names.index('target_price')
            stop_loss_idx = col_names.index('stop_loss')
            action_idx = col_names.index('action')
            trigger_hit_price_idx = col_names.index('trigger_hit_price')
            
            integrity_checks = [
                ("entry_price", updated_trade[entry_price_idx], 300.0),
                ("target_price", updated_trade[target_price_idx], 340.0),
                ("stop_loss", updated_trade[stop_loss_idx], 290.0),
                ("action", updated_trade[action_idx], "buy"),
                ("trigger_hit_price", updated_trade[trigger_hit_price_idx], 293.88)
            ]
            
            all_checks_passed = True
            for field, actual, expected in integrity_checks:
                if actual == expected:
                    print(f"  ✅ {field}: {actual} (correct)")
                else:
                    print(f"  ❌ {field}: {actual} (expected {expected})")
                    all_checks_passed = False
            
            if all_checks_passed:
                print("\n🎉 All integrity checks passed! Trade restoration complete.")
                return True
            else:
                print("\n⚠️  Some integrity checks failed, but trade status was restored.")
                return True
                
        else:
            conn.rollback()
            print("❌ Trade restoration failed - verification check failed")
            return False
            
    except Exception as e:
        print(f"❌ Error during trade restoration: {e}")
        try:
            conn.rollback()
        except:
            pass
        return False
    finally:
        try:
            conn.close()
        except:
            pass

if __name__ == "__main__":
    print("🚨 URGENT DATABASE FIX: Restoring AAVE Trade to Active Status")
    print("=" * 60)
    
    success = restore_aave_trade()
    
    if success:
        print("\n✅ SUCCESS: AAVE trade has been restored to active status!")
        print("The trade will now continue to be monitored by the system.")
    else:
        print("\n❌ FAILED: Could not restore AAVE trade. Check the logs above.")
        print("The backup database is available for manual recovery if needed.")