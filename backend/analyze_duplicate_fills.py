#!/usr/bin/env python3
"""
Analyze Duplicate Fills Script

This script analyzes the relationship between transactions (hashes) and fills (TIDs)
to understand why the API returns more fills than unique transactions.
"""

import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv
from collections import defaultdict

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.hyperliquid_models import HyperliquidDatabase, AccountType
from services.hyperliquid_api_service import HyperliquidAPIService, HyperliquidConfig

def analyze_duplicate_fills():
    """Analyze the relationship between transactions and fills"""
    print("🔍 ANALYZING DUPLICATE FILLS")
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
    
    print(f"📊 Total API fills: {len(api_trades)}")
    
    # Group by hash to see how many fills per transaction
    hash_to_fills = defaultdict(list)
    for trade in api_trades:
        hash_val = trade.get('hash')
        if hash_val:
            hash_to_fills[hash_val].append(trade)
    
    print(f"📊 Unique transactions (hashes): {len(hash_to_fills)}")
    
    # Analyze fill distribution
    fill_counts = [len(fills) for fills in hash_to_fills.values()]
    single_fill_txns = sum(1 for count in fill_counts if count == 1)
    multi_fill_txns = sum(1 for count in fill_counts if count > 1)
    max_fills = max(fill_counts) if fill_counts else 0
    
    print(f"📊 Transactions with 1 fill: {single_fill_txns}")
    print(f"📊 Transactions with multiple fills: {multi_fill_txns}")
    print(f"📊 Maximum fills in one transaction: {max_fills}")
    
    # Show examples of multi-fill transactions
    print(f"\n🔍 EXAMPLES OF MULTI-FILL TRANSACTIONS:")
    multi_fill_examples = [(hash_val, fills) for hash_val, fills in hash_to_fills.items() if len(fills) > 1]
    multi_fill_examples.sort(key=lambda x: len(x[1]), reverse=True)  # Sort by fill count
    
    for i, (hash_val, fills) in enumerate(multi_fill_examples[:5]):
        print(f"\n  Transaction {i+1}: {hash_val}")
        print(f"    Fills: {len(fills)}")
        print(f"    Time: {datetime.fromtimestamp(fills[0]['time']/1000).strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"    Coin: {fills[0].get('coin', 'unknown')}")
        for j, fill in enumerate(fills[:3]):  # Show first 3 fills
            print(f"      Fill {j+1}: TID={fill.get('tid')}, Size={fill.get('sz')}, Price={fill.get('px')}")
        if len(fills) > 3:
            print(f"      ... and {len(fills) - 3} more fills")
    
    # Check database
    db = HyperliquidDatabase()
    db_trades = db.get_trades(AccountType.PERSONAL_WALLET, wallet_address)
    
    print(f"\n📊 Database trades: {len(db_trades)}")
    
    # Check if database stores individual fills or consolidated transactions
    db_hashes = set(trade.get('hash') for trade in db_trades if trade.get('hash'))
    print(f"📊 Database unique hashes: {len(db_hashes)}")
    
    # Verify hash overlap
    api_hashes = set(hash_to_fills.keys())
    missing_hashes = api_hashes - db_hashes
    extra_hashes = db_hashes - api_hashes
    
    print(f"📊 Hashes missing from database: {len(missing_hashes)}")
    print(f"📊 Extra hashes in database: {len(extra_hashes)}")
    
    if missing_hashes:
        print(f"\n⚠️  MISSING TRANSACTIONS:")
        for i, hash_val in enumerate(list(missing_hashes)[:5]):
            fills = hash_to_fills[hash_val]
            print(f"  {i+1}. {hash_val} ({len(fills)} fills)")
            print(f"     Time: {datetime.fromtimestamp(fills[0]['time']/1000).strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"     Coin: {fills[0].get('coin', 'unknown')}")

if __name__ == "__main__":
    analyze_duplicate_fills()