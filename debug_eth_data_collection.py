#!/usr/bin/env python3
"""
Debug ETH Data Collection Issue

This script will test the exact data flow that's causing ETH price to be $0.00
in the manual scan, while BTC price is correctly showing as $118,914.39.
"""

import asyncio
import sys
import os
import json
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
    from models.macro_sentiment_models import get_macro_db
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Import local config for CMC API key
try:
    from local_config import CMC_API_KEY
except ImportError:
    CMC_API_KEY = os.environ.get('CMC_API_KEY')

async def debug_eth_data_collection():
    """Debug the exact ETH data collection issue"""
    
    print("🔍 DEBUGGING ETH DATA COLLECTION ISSUE")
    print("=" * 60)
    
    if not CMC_API_KEY:
        print("❌ ERROR: CMC_API_KEY not configured")
        return
    
    print(f"✅ CMC API Key configured: {CMC_API_KEY[:8]}...")
    
    try:
        async with CoinMarketCapService(CMC_API_KEY) as service:
            print("\n📊 Testing CoinMarketCap API calls...")
            
            # Step 1: Test global metrics
            print("\n1. Testing global metrics...")
            global_data = await service.get_current_global_metrics()
            print(f"   ✅ Global data retrieved:")
            print(f"   - Total Market Cap: ${global_data['total_market_cap']:,.0f}")
            print(f"   - BTC Dominance: {global_data['btc_dominance']:.2f}%")
            
            # Step 2: Test cryptocurrency quotes (the critical part)
            print("\n2. Testing cryptocurrency quotes for BTC,ETH...")
            crypto_quotes = await service.get_cryptocurrency_quotes_latest('BTC,ETH')
            
            print(f"   📋 Raw API Response Structure:")
            print(f"   - Keys in response: {list(crypto_quotes.keys())}")
            
            # Check BTC data
            if 'BTC' in crypto_quotes:
                btc_data = crypto_quotes['BTC']
                print(f"\n   ₿ BTC Data:")
                print(f"   - Price: ${btc_data.get('price', 'MISSING'):,.2f}")
                print(f"   - Market Cap: ${btc_data.get('market_cap', 'MISSING'):,.0f}")
                print(f"   - Full BTC data: {json.dumps(btc_data, indent=2)}")
            else:
                print("   ❌ BTC data MISSING from response!")
            
            # Check ETH data (the problem area)
            if 'ETH' in crypto_quotes:
                eth_data = crypto_quotes['ETH']
                print(f"\n   Ξ ETH Data:")
                print(f"   - Price: ${eth_data.get('price', 'MISSING'):,.2f}")
                print(f"   - Market Cap: ${eth_data.get('market_cap', 'MISSING'):,.0f}")
                print(f"   - Full ETH data: {json.dumps(eth_data, indent=2)}")
            else:
                print("   ❌ ETH data MISSING from response!")
            
            # Step 3: Simulate the exact scanner logic
            print("\n3. Simulating scanner data extraction logic...")
            btc_data = crypto_quotes.get('BTC', {})
            eth_data = crypto_quotes.get('ETH', {})
            
            # This is the exact logic from macro_scanner_service.py lines 204-220
            snapshot = {
                'timestamp': int(datetime.now(timezone.utc).timestamp()),
                'total_market_cap': global_data['total_market_cap'],
                'btc_market_cap': btc_data.get('market_cap', 0),
                'eth_market_cap': eth_data.get('market_cap', 0),
                'btc_price': btc_data.get('price', 0),
                'eth_price': eth_data.get('price', 0),  # This is where the bug might be
                'btc_dominance': global_data['btc_dominance'],
                'data_source': 'coinmarketcap_scanner_debug',
                'data_quality_score': 1.0,
            }
            
            print(f"\n   📊 Extracted Snapshot Data:")
            print(f"   - BTC Price: ${snapshot['btc_price']:,.2f}")
            print(f"   - ETH Price: ${snapshot['eth_price']:,.2f}")
            print(f"   - BTC Market Cap: ${snapshot['btc_market_cap']:,.0f}")
            print(f"   - ETH Market Cap: ${snapshot['eth_market_cap']:,.0f}")
            
            # Step 4: Check database insertion
            print("\n4. Testing database insertion...")
            db = get_macro_db()
            
            # Insert the test data
            db.insert_market_data(snapshot)
            print("   ✅ Data inserted into database")
            
            # Retrieve the latest data to verify
            latest_data = db.get_latest_market_data()
            if latest_data:
                print(f"\n   📋 Latest data from database:")
                print(f"   - BTC Price: ${latest_data.get('btc_price', 0):,.2f}")
                print(f"   - ETH Price: ${latest_data.get('eth_price', 0):,.2f}")
                print(f"   - Timestamp: {latest_data.get('timestamp')}")
                print(f"   - Data Source: {latest_data.get('data_source')}")
            else:
                print("   ❌ No data retrieved from database!")
            
            # Step 5: Identify the issue
            print("\n🔍 ISSUE ANALYSIS:")
            print("=" * 40)
            
            if snapshot['btc_price'] > 0 and snapshot['eth_price'] == 0:
                print("❌ ISSUE FOUND: ETH price is 0 while BTC price is valid")
                print("   This suggests the CoinMarketCap API response structure")
                print("   for ETH is different than expected, or ETH data is missing.")
                
                if 'ETH' not in crypto_quotes:
                    print("   🔍 ROOT CAUSE: ETH key missing from API response")
                elif not eth_data.get('price'):
                    print("   🔍 ROOT CAUSE: ETH price field missing or null in API response")
                    print(f"   ETH data structure: {eth_data}")
                
            elif snapshot['btc_price'] == 0 and snapshot['eth_price'] == 0:
                print("❌ ISSUE FOUND: Both BTC and ETH prices are 0")
                print("   This suggests a broader API response parsing issue")
                
            elif snapshot['btc_price'] > 0 and snapshot['eth_price'] > 0:
                print("✅ NO ISSUE: Both BTC and ETH prices are valid")
                print("   The issue might be in a different part of the system")
                
            else:
                print("❓ UNCLEAR: Unexpected price combination")
                print(f"   BTC: ${snapshot['btc_price']}, ETH: ${snapshot['eth_price']}")
            
    except CoinMarketCapAPIError as e:
        print(f"❌ CoinMarketCap API Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_eth_data_collection())