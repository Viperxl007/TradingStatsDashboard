#!/usr/bin/env python3
"""
Complete Historical Sync Script

This script performs a complete historical sync using the proper API method
to get ALL available trades (up to 10,000) and ensures the database is complete.
"""

import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.hyperliquid_models import HyperliquidDatabase, AccountType, SyncStatus
from services.hyperliquid_api_service import HyperliquidAPIService, HyperliquidConfig

def format_timestamp(timestamp_ms):
    """Format timestamp in milliseconds to readable string"""
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return str(timestamp_ms)

def get_all_available_trades():
    """Get ALL available trades using the proper API method"""
    print("🌐 FETCHING ALL AVAILABLE TRADES FROM API")
    print("-" * 60)
    
    load_dotenv()
    
    # Initialize API service
    config = HyperliquidConfig(
        api_url="https://api.hyperliquid.xyz",
        wallet_address=os.getenv('HYPERLIQUID_WALLET_ADDRESS'),
        api_private_key=os.getenv('HYPERLIQUID_PRIVATE_KEY'),
        api_wallet_address=os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
    )
    api_service = HyperliquidAPIService(config)
    
    # Use the proper method that can get up to 10,000 trades
    wallet_address = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    print(f"📡 Fetching all trades for {wallet_address}")
    
    # Get all available trades using time-based pagination
    # Use a very old start time to get maximum history (1 year ago)
    current_time = int(time.time() * 1000)
    start_time_1year = current_time - (365 * 24 * 60 * 60 * 1000)
    all_trades = api_service.get_user_fills(wallet_address, start_time_1year)
    
    print(f"📊 API returned {len(all_trades)} total trades")
    
    if all_trades:
        times = [trade['time'] for trade in all_trades]
        oldest = min(times)
        newest = max(times)
        print(f"📅 Time range: {format_timestamp(oldest)} to {format_timestamp(newest)}")
    
    return all_trades

def sync_all_trades_to_database(api_trades):
    """Sync all API trades to database"""
    print("\n💾 SYNCING ALL TRADES TO DATABASE")
    print("-" * 60)
    
    load_dotenv()
    db = HyperliquidDatabase()
    wallet_address = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    
    # Get existing trades from database
    existing_trades = db.get_trades(AccountType.PERSONAL_WALLET, wallet_address)
    existing_hashes = set(trade['hash'] for trade in existing_trades)
    
    print(f"📊 Database currently has {len(existing_trades)} trades")
    print(f"📊 API has {len(api_trades)} trades")
    
    # Find missing trades
    missing_trades = []
    for trade in api_trades:
        if trade['hash'] not in existing_hashes:
            missing_trades.append(trade)
    
    print(f"📈 Found {len(missing_trades)} missing trades to add")
    
    # Add missing trades
    added_count = 0
    for trade in missing_trades:
        try:
            db.insert_trade(trade, AccountType.PERSONAL_WALLET, wallet_address)
            added_count += 1
            if added_count % 100 == 0:
                print(f"   📈 Added {added_count}/{len(missing_trades)} trades...")
        except Exception as e:
            print(f"   ❌ Error adding trade {trade.get('tid', 'unknown')}: {str(e)}")
    
    print(f"✅ Added {added_count} new trades to database")
    
    # Verify final count
    final_trades = db.get_trades(AccountType.PERSONAL_WALLET, wallet_address)
    print(f"📊 Database now has {len(final_trades)} trades")
    
    return len(final_trades)

def verify_completeness():
    """Verify that database now contains all available trades"""
    print("\n✅ VERIFYING COMPLETENESS")
    print("-" * 60)
    
    # Get API trades
    api_trades = get_all_available_trades()
    
    # Get database trades
    load_dotenv()
    db = HyperliquidDatabase()
    wallet_address = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    db_trades = db.get_trades(AccountType.PERSONAL_WALLET, wallet_address)
    
    # Compare by hash
    api_hashes = set(trade['hash'] for trade in api_trades)
    db_hashes = set(trade['hash'] for trade in db_trades)
    
    missing_in_db = api_hashes - db_hashes
    extra_in_db = db_hashes - api_hashes
    
    print(f"📊 API trades: {len(api_trades)}")
    print(f"📊 Database trades: {len(db_trades)}")
    print(f"📊 Missing in database: {len(missing_in_db)}")
    print(f"📊 Extra in database: {len(extra_in_db)}")
    
    if missing_in_db:
        print("❌ Database is incomplete!")
        return False
    else:
        print("✅ Database contains all available API trades!")
        return True

def main():
    """Main sync function"""
    print("=" * 80)
    print("COMPLETE HISTORICAL SYNC")
    print("=" * 80)
    
    try:
        # Step 1: Get all available trades from API
        api_trades = get_all_available_trades()
        
        if not api_trades:
            print("❌ No trades returned from API")
            return
        
        # Step 2: Sync all trades to database
        final_count = sync_all_trades_to_database(api_trades)
        
        # Step 3: Verify completeness
        is_complete = verify_completeness()
        
        print("\n" + "=" * 80)
        if is_complete:
            print("✅ SYNC COMPLETE - DATABASE IS NOW COMPLETE")
            print(f"✅ Database contains all {final_count} available trades")
            print("✅ Incremental sync will work properly going forward")
        else:
            print("⚠️  SYNC INCOMPLETE - DATABASE STILL MISSING TRADES")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error during sync: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()