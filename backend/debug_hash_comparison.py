#!/usr/bin/env python3
"""
Debug Hash Comparison Script

This script investigates why the hash comparison is failing to detect missing trades.
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

def debug_hash_comparison():
    """Debug the hash comparison between API and database trades"""
    print("🔍 DEBUGGING HASH COMPARISON")
    print("=" * 60)
    
    load_dotenv()
    
    # Initialize API service
    config = HyperliquidConfig(
        api_url="https://api.hyperliquid.xyz",
        wallet_address=os.getenv('HYPERLIQUID_WALLET_ADDRESS'),
        api_private_key=os.getenv('HYPERLIQUID_PRIVATE_KEY'),
        api_wallet_address=os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
    )
    api_service = HyperliquidAPIService(config)
    
    # Get API trades
    wallet_address = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
    current_time = int(time.time() * 1000)
    start_time_1year = current_time - (365 * 24 * 60 * 60 * 1000)
    api_trades = api_service.get_user_fills(wallet_address, start_time_1year)
    
    # Get database trades
    db = HyperliquidDatabase()
    db_trades = db.get_trades(AccountType.PERSONAL_WALLET, wallet_address)
    
    print(f"📊 API trades: {len(api_trades)}")
    print(f"📊 Database trades: {len(db_trades)}")
    
    # Examine first few trades from each source
    print("\n🔍 EXAMINING API TRADE STRUCTURE:")
    if api_trades:
        for i, trade in enumerate(api_trades[:3]):
            print(f"  Trade {i+1}:")
            print(f"    Keys: {list(trade.keys())}")
            print(f"    Hash: {trade.get('hash', 'MISSING')}")
            print(f"    TID: {trade.get('tid', 'MISSING')}")
            print(f"    Time: {trade.get('time', 'MISSING')}")
            print()
    
    print("🔍 EXAMINING DATABASE TRADE STRUCTURE:")
    if db_trades:
        for i, trade in enumerate(db_trades[:3]):
            print(f"  Trade {i+1}:")
            print(f"    Keys: {list(trade.keys())}")
            print(f"    Hash: {trade.get('hash', 'MISSING')}")
            print(f"    TID: {trade.get('tid', 'MISSING')}")
            print(f"    Time: {trade.get('time', 'MISSING')}")
            print()
    
    # Check hash sets
    api_hashes = set()
    db_hashes = set()
    
    for trade in api_trades:
        hash_val = trade.get('hash')
        if hash_val:
            api_hashes.add(hash_val)
        else:
            print(f"⚠️  API trade missing hash: {trade.get('tid', 'unknown')}")
    
    for trade in db_trades:
        hash_val = trade.get('hash')
        if hash_val:
            db_hashes.add(hash_val)
        else:
            print(f"⚠️  DB trade missing hash: {trade.get('tid', 'unknown')}")
    
    print(f"\n📊 API unique hashes: {len(api_hashes)}")
    print(f"📊 Database unique hashes: {len(db_hashes)}")
    
    # Find differences
    missing_in_db = api_hashes - db_hashes
    extra_in_db = db_hashes - api_hashes
    
    print(f"📊 Missing in database: {len(missing_in_db)}")
    print(f"📊 Extra in database: {len(extra_in_db)}")
    
    # Show some examples
    if missing_in_db:
        print(f"\n🔍 FIRST 5 MISSING HASHES:")
        for i, hash_val in enumerate(list(missing_in_db)[:5]):
            print(f"  {i+1}. {hash_val}")
            # Find the corresponding trade
            for trade in api_trades:
                if trade.get('hash') == hash_val:
                    print(f"     TID: {trade.get('tid')}, Time: {trade.get('time')}")
                    break
    
    if extra_in_db:
        print(f"\n🔍 FIRST 5 EXTRA HASHES:")
        for i, hash_val in enumerate(list(extra_in_db)[:5]):
            print(f"  {i+1}. {hash_val}")

if __name__ == "__main__":
    debug_hash_comparison()