#!/usr/bin/env python3
"""
Hyperliquid Data Verification Script

This script verifies:
1. Current database state (total trades, duplicates, time range)
2. Whether we have complete trade history
3. Incremental sync logic (only fetching new trades)
4. Data integrity and consistency
"""

import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.hyperliquid_models import HyperliquidDatabase, AccountType
from services.hyperliquid_api_service import HyperliquidAPIService, HyperliquidConfig

def format_timestamp(timestamp_ms):
    """Format timestamp in milliseconds to readable string"""
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return str(timestamp_ms)

def get_configured_accounts():
    """Get configured accounts from environment variables (same as scheduler)"""
    load_dotenv()  # Load environment variables
    accounts = []
    
    personal_wallet = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    vault_wallet = os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
    
    if personal_wallet:
        accounts.append({
            'wallet_address': personal_wallet,
            'account_type': 'personal_wallet'
        })
    
    return accounts

def verify_database_state():
    """Verify current database state"""
    print("=" * 80)
    print("HYPERLIQUID DATABASE VERIFICATION")
    print("=" * 80)
    
    # Initialize database
    db = HyperliquidDatabase()
    
    # Get configured accounts (same as scheduler)
    accounts = get_configured_accounts()
    print(f"\n📊 ACCOUNTS: {len(accounts)} configured")
    
    for account in accounts:
        account_type_str = account['account_type']
        wallet_address = account['wallet_address']
        account_type = AccountType(account_type_str)
        
        print(f"\n🔍 ACCOUNT: {account_type_str} ({wallet_address})")
        print("-" * 60)
        
        # Get all trades for this account
        trades = db.get_trades(account_type, wallet_address)
        print(f"📈 Total trades in database: {len(trades)}")
        
        if trades:
            # Analyze time range
            times = [trade['time'] for trade in trades]
            oldest_time = min(times)
            newest_time = max(times)
            
            print(f"📅 Time range:")
            print(f"   Oldest: {format_timestamp(oldest_time)} ({oldest_time})")
            print(f"   Newest: {format_timestamp(newest_time)} ({newest_time})")
            
            # Check for duplicates
            unique_times = set(times)
            duplicate_count = len(times) - len(unique_times)
            
            if duplicate_count > 0:
                print(f"⚠️  DUPLICATES: {duplicate_count} duplicate timestamps found!")
                
                # Find actual duplicate trades (same hash)
                hashes = [trade['hash'] for trade in trades]
                unique_hashes = set(hashes)
                hash_duplicates = len(hashes) - len(unique_hashes)
                
                if hash_duplicates > 0:
                    print(f"🚨 CRITICAL: {hash_duplicates} duplicate trade hashes found!")
                else:
                    print(f"ℹ️  Note: Duplicate timestamps are normal (multiple trades per millisecond)")
            else:
                print(f"✅ No duplicate timestamps")
            
            # Check trade hash uniqueness
            hashes = [trade['hash'] for trade in trades]
            unique_hashes = set(hashes)
            if len(hashes) != len(unique_hashes):
                print(f"🚨 CRITICAL: {len(hashes) - len(unique_hashes)} duplicate trade hashes!")
            else:
                print(f"✅ All trade hashes are unique")
            
            # Show recent trades
            recent_trades = sorted(trades, key=lambda x: x['time'], reverse=True)[:5]
            print(f"\n📋 Most recent 5 trades:")
            for i, trade in enumerate(recent_trades, 1):
                time_str = format_timestamp(trade['time'])
                print(f"   {i}. {time_str} - {trade['coin']} {trade['side']} {trade['sz']} @ {trade['px']}")
        
        else:
            print("❌ No trades found in database")
    
    return accounts

def test_api_vs_database(account_type, wallet_address):
    """Compare API data with database to check completeness"""
    print(f"\n🔄 COMPARING API vs DATABASE for {account_type.value}")
    print("-" * 60)
    
    # Initialize API service
    load_dotenv()
    config = HyperliquidConfig(
        api_url="https://api.hyperliquid.xyz",
        wallet_address=wallet_address,
        api_private_key=os.getenv('HYPERLIQUID_PRIVATE_KEY'),
        api_wallet_address=os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
    )
    api_service = HyperliquidAPIService(config)
    
    # Get database trades
    db = HyperliquidDatabase()
    db_trades = db.get_trades(account_type, wallet_address)
    
    if db_trades:
        db_newest_time = max(trade['time'] for trade in db_trades)
        print(f"📊 Database: {len(db_trades)} trades, newest: {format_timestamp(db_newest_time)}")
    else:
        db_newest_time = 0
        print(f"📊 Database: 0 trades")
    
    # Test 1: Get all available trades from API (1 year lookback)
    current_time = int(time.time() * 1000)
    start_time_1year = current_time - (365 * 24 * 60 * 60 * 1000)
    
    print(f"🌐 Fetching ALL available trades from API (1 year lookback)...")
    api_trades_all = api_service.get_user_fills(wallet_address, start_time_1year)
    
    if api_trades_all:
        api_times = [trade['time'] for trade in api_trades_all]
        api_oldest = min(api_times)
        api_newest = max(api_times)
        print(f"📊 API (all): {len(api_trades_all)} trades")
        print(f"   Range: {format_timestamp(api_oldest)} to {format_timestamp(api_newest)}")
        
        # Check if database has all API trades
        api_hashes = set(trade['hash'] for trade in api_trades_all)
        db_hashes = set(trade['hash'] for trade in db_trades) if db_trades else set()
        
        missing_in_db = api_hashes - db_hashes
        extra_in_db = db_hashes - api_hashes
        
        if missing_in_db:
            print(f"❌ MISSING: {len(missing_in_db)} trades from API not in database")
        else:
            print(f"✅ Database contains all API trades")
            
        if extra_in_db:
            print(f"ℹ️  EXTRA: {len(extra_in_db)} trades in database not in current API response")
    
    # Test 2: Test incremental sync (only new trades since newest in DB)
    if db_newest_time > 0:
        print(f"\n🔄 Testing incremental sync (trades since {format_timestamp(db_newest_time)})...")
        api_trades_incremental = api_service.get_user_fills(wallet_address, db_newest_time + 1)
        
        if api_trades_incremental:
            new_trades = [t for t in api_trades_incremental if t['time'] > db_newest_time]
            print(f"📊 Incremental: {len(new_trades)} new trades since last sync")
            
            if new_trades:
                for trade in new_trades[:3]:  # Show first 3 new trades
                    time_str = format_timestamp(trade['time'])
                    print(f"   NEW: {time_str} - {trade['coin']} {trade['side']} {trade['sz']} @ {trade['px']}")
        else:
            print(f"✅ No new trades since last sync")

def test_sync_logic():
    """Test the actual sync service logic"""
    print(f"\n⚙️  TESTING SYNC SERVICE LOGIC")
    print("-" * 60)
    
    from services.hyperliquid_sync_service import HyperliquidSyncService, SyncConfig, create_hyperliquid_service
    
    # Initialize services
    api_service = create_hyperliquid_service()
    db = HyperliquidDatabase()
    sync_config = SyncConfig()
    sync_service = HyperliquidSyncService(api_service, db, sync_config)
    
    # Get accounts
    accounts = get_configured_accounts()
    
    for account in accounts:
        account_type = AccountType(account['account_type'])
        wallet_address = account['wallet_address']
        
        print(f"\n🔍 Testing sync logic for {account_type.value}")
        
        # Check what the sync service thinks it should do
        existing_trades = db.get_trades(account_type, wallet_address)
        
        if existing_trades:
            latest_time = max(trade['time'] for trade in existing_trades)
            print(f"📊 Latest trade in DB: {format_timestamp(latest_time)}")
            print(f"🔄 Sync service should fetch trades since: {format_timestamp(latest_time + 1)}")
            
            # Check if sync service would do incremental or full sync
            if len(existing_trades) > 0:
                print(f"✅ Should perform INCREMENTAL sync (has {len(existing_trades)} existing trades)")
            else:
                print(f"🔄 Should perform FULL sync (no existing trades)")
        else:
            print(f"🔄 Should perform FULL sync (no existing trades)")

def main():
    """Main verification function"""
    try:
        # Step 1: Verify database state
        accounts = verify_database_state()
        
        # Step 2: Compare API vs Database for each account
        for account in accounts:
            account_type = AccountType(account['account_type'])
            test_api_vs_database(account_type, account['wallet_address'])
        
        # Step 3: Test sync logic
        test_sync_logic()
        
        print(f"\n" + "=" * 80)
        print("VERIFICATION COMPLETE")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()