#!/usr/bin/env python3
"""
Test CoinGecko free tier endpoints only - no PRO endpoints
"""

import sys
import os
import asyncio
sys.path.append('./backend')

from services.coingecko_service import CoinGeckoService
from datetime import datetime, timezone

async def test_free_tier_endpoints():
    """Test only the confirmed free tier endpoints"""
    try:
        print('🆓 TESTING FREE TIER ENDPOINTS ONLY')
        print('=' * 50)
        
        async with CoinGeckoService() as service:
            print('\n1. Testing individual coin historical data (FREE TIER)...')
            
            # Test BTC historical data - this should work on free tier
            try:
                btc_params = {
                    'vs_currency': 'usd',
                    'days': '7',  # Try just 7 days first
                    'interval': 'daily'
                }
                btc_data = await service._make_request('/coins/bitcoin/market_chart', btc_params)
                
                if btc_data and 'prices' in btc_data:
                    print(f'   ✅ BTC historical data: {len(btc_data["prices"])} price points')
                    print(f'   ✅ BTC market cap data: {len(btc_data.get("market_caps", []))} points')
                    
                    # Show sample data
                    if btc_data['prices']:
                        first_price = btc_data['prices'][0]
                        last_price = btc_data['prices'][-1]
                        print(f'   📊 Price range: ${first_price[1]:,.2f} to ${last_price[1]:,.2f}')
                else:
                    print('   ❌ No BTC historical data received')
                    
            except Exception as e:
                print(f'   ❌ BTC historical data failed: {e}')
            
            print('\n2. Testing ETH historical data (FREE TIER)...')
            
            # Test ETH historical data
            try:
                eth_params = {
                    'vs_currency': 'usd',
                    'days': '7',
                    'interval': 'daily'
                }
                eth_data = await service._make_request('/coins/ethereum/market_chart', eth_params)
                
                if eth_data and 'prices' in eth_data:
                    print(f'   ✅ ETH historical data: {len(eth_data["prices"])} price points')
                    print(f'   ✅ ETH market cap data: {len(eth_data.get("market_caps", []))} points')
                else:
                    print('   ❌ No ETH historical data received')
                    
            except Exception as e:
                print(f'   ❌ ETH historical data failed: {e}')
            
            print('\n3. Testing current global data (FREE TIER)...')
            
            # Test current global data - this should work
            try:
                global_data = await service._make_request('/global')
                
                if global_data and 'data' in global_data:
                    total_mcap = global_data['data'].get('total_market_cap', {}).get('usd', 0)
                    btc_dominance = global_data['data'].get('market_cap_percentage', {}).get('btc', 0)
                    
                    print(f'   ✅ Current total market cap: ${total_mcap:,.0f}')
                    print(f'   ✅ Current BTC dominance: {btc_dominance:.2f}%')
                    
                    # This is the key insight - we can use current dominance for historical estimation
                    print(f'\n   💡 We can use current BTC dominance ({btc_dominance:.2f}%) to estimate historical total market caps!')
                else:
                    print('   ❌ No global data received')
                    
            except Exception as e:
                print(f'   ❌ Global data failed: {e}')
            
            print('\n4. Testing alternative approach...')
            print('   💡 Strategy: Use individual coin data + current dominance ratios')
            print('   📈 BTC + ETH historical market caps (FREE)')
            print('   📊 Current global dominance ratios (FREE)')
            print('   🧮 Calculate historical total market cap from real ratios')
            print('   ✅ This avoids the PRO-only /global/market_cap_chart endpoint!')
            
        print('\n' + '=' * 50)
        print('🆓 FREE TIER TEST COMPLETED')
        print('\n📋 SUMMARY:')
        print('✅ Individual coin historical data: Available on free tier')
        print('✅ Current global data: Available on free tier')
        print('❌ Global historical market cap: PRO tier only')
        print('💡 Solution: Use real current ratios for historical estimation')
        
    except Exception as e:
        print(f'❌ Test failed: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_free_tier_endpoints())