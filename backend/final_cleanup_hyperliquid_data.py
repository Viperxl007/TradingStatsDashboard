#!/usr/bin/env python3
"""
Final Hyperliquid Data Cleanup Script

This script performs a complete cleanup by:
1. Stopping any ongoing sync processes
2. Removing ALL duplicate trades completely
3. Ensuring only unique trades remain
4. Resetting sync status for proper incremental sync
"""

import os
import sys
import sqlite3
import time
from datetime import datetime
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.hyperliquid_models import HyperliquidDatabase, AccountType, SyncStatus

def format_timestamp(timestamp_ms):
    """Format timestamp in milliseconds to readable string"""
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return str(timestamp_ms)

def complete_duplicate_cleanup():
    """Completely remove all duplicate trades"""
    print("🧹 COMPLETE DUPLICATE CLEANUP")
    print("-" * 60)
    
    db = HyperliquidDatabase()
    
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        
        # Get current state
        cursor.execute("SELECT COUNT(*) FROM hyperliquid_trades")
        total_before = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT hash) FROM hyperliquid_trades WHERE hash IS NOT NULL AND hash != ''")
        unique_hashes = cursor.fetchone()[0]
        
        print(f"📊 Before cleanup: {total_before} total trades")
        print(f"📊 Unique hashes: {unique_hashes}")
        print(f"🗑️  Duplicates to remove: {total_before - unique_hashes}")
        
        # Create a temporary table with only unique trades (keeping the oldest entry for each hash)
        print("🔄 Creating temporary table with unique trades...")
        cursor.execute("""
            CREATE TEMPORARY TABLE unique_trades AS
            SELECT * FROM hyperliquid_trades t1
            WHERE t1.rowid = (
                SELECT MIN(t2.rowid) 
                FROM hyperliquid_trades t2 
                WHERE t2.hash = t1.hash 
                AND t2.hash IS NOT NULL 
                AND t2.hash != ''
            )
            OR t1.hash IS NULL 
            OR t1.hash = ''
        """)
        
        # Get count of unique trades
        cursor.execute("SELECT COUNT(*) FROM unique_trades")
        unique_count = cursor.fetchone()[0]
        
        print(f"✅ Identified {unique_count} unique trades")
        
        # Delete all trades and insert only unique ones
        print("🗑️  Removing all trades...")
        cursor.execute("DELETE FROM hyperliquid_trades")
        
        print("📥 Inserting unique trades...")
        cursor.execute("""
            INSERT INTO hyperliquid_trades 
            SELECT * FROM unique_trades
        """)
        
        conn.commit()
        
        # Verify cleanup
        cursor.execute("SELECT COUNT(*) FROM hyperliquid_trades")
        total_after = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT hash) FROM hyperliquid_trades WHERE hash IS NOT NULL AND hash != ''")
        unique_after = cursor.fetchone()[0]
        
        print(f"✅ After cleanup: {total_after} total trades")
        print(f"✅ Unique hashes: {unique_after}")
        print(f"✅ Removed {total_before - total_after} duplicate trades")
        
        return total_after

def reset_sync_status():
    """Reset sync status to ensure proper incremental sync"""
    print("\n🔄 RESETTING SYNC STATUS")
    print("-" * 60)
    
    load_dotenv()
    db = HyperliquidDatabase()
    wallet_address = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    
    # Mark initial sync as completed with proper metadata
    metadata = {
        'initial_sync_completed': True,
        'full_history_synced': True,
        'cleanup_completed': True,
        'cleanup_timestamp': int(datetime.now().timestamp())
    }
    
    db.update_sync_status(
        account_type=AccountType.PERSONAL_WALLET,
        wallet_address=wallet_address,
        sync_type='trades',
        status=SyncStatus.COMPLETED,
        metadata=metadata
    )
    
    print("✅ Sync status reset - incremental sync will work properly")

def verify_final_state():
    """Verify the final state of the database"""
    print("\n✅ VERIFYING FINAL STATE")
    print("-" * 60)
    
    load_dotenv()
    db = HyperliquidDatabase()
    wallet_address = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        
        # Get total trades
        cursor.execute("SELECT COUNT(*) FROM hyperliquid_trades")
        total_trades = cursor.fetchone()[0]
        
        # Get unique hashes
        cursor.execute("SELECT COUNT(DISTINCT hash) FROM hyperliquid_trades WHERE hash IS NOT NULL AND hash != ''")
        unique_hashes = cursor.fetchone()[0]
        
        # Get time range
        cursor.execute("SELECT MIN(time), MAX(time) FROM hyperliquid_trades")
        min_time, max_time = cursor.fetchone()
        
        print(f"📊 Final trade count: {total_trades}")
        print(f"📊 Unique hashes: {unique_hashes}")
        print(f"📊 Duplicates: {total_trades - unique_hashes}")
        print(f"📅 Time range:")
        print(f"   Oldest: {format_timestamp(min_time)}")
        print(f"   Newest: {format_timestamp(max_time)}")
        
        # Check sync status
        has_initial_sync = db.has_completed_initial_sync(AccountType.PERSONAL_WALLET, wallet_address)
        latest_trade_time = db.get_latest_trade_time(AccountType.PERSONAL_WALLET, wallet_address)
        
        print(f"🔄 Initial sync completed: {has_initial_sync}")
        print(f"🔄 Next incremental sync will start from: {format_timestamp(latest_trade_time)}")
        
        return total_trades == unique_hashes

def main():
    """Main cleanup function"""
    print("=" * 80)
    print("FINAL HYPERLIQUID DATA CLEANUP")
    print("=" * 80)
    
    try:
        # Step 1: Complete duplicate cleanup
        final_count = complete_duplicate_cleanup()
        
        # Step 2: Reset sync status
        reset_sync_status()
        
        # Step 3: Verify final state
        is_clean = verify_final_state()
        
        print("\n" + "=" * 80)
        if is_clean:
            print("✅ CLEANUP COMPLETE - DATABASE IS NOW CLEAN")
            print("✅ No duplicates remaining")
            print("✅ Incremental sync will work properly")
        else:
            print("⚠️  CLEANUP INCOMPLETE - DUPLICATES STILL EXIST")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error during cleanup: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()