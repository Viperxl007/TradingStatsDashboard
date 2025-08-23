#!/usr/bin/env python3
"""
Test the improved CoinGecko service with free tier historical data
"""

import sys
import os
import asyncio
sys.path.append('./backend')

from services.coingecko_service import CoinGeckoService
from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

async def test_coingecko_historical():
    """Test the improved CoinGecko service"""
    try:
        print('🧪 TESTING IMPROVED COINGECKO SERVICE')
        print('=' * 50)
        
        async with CoinGeckoService() as service:
            print('\n1. Testing current data collection...')
            current_data = await service.get_current_macro_snapshot()
            print(f'   ✅ Current BTC Price: ${current_data.get("btc_price", 0):,.2f}')
            print(f'   ✅ Current Total Market Cap: ${current_data.get("total_market_cap", 0):,.0f}')
            
            print('\n2. Testing historical data collection (30 days)...')
            try:
                historical_data = await service.get_historical_market_data(days=30)
                
                if historical_data and len(historical_data) > 0:
                    print(f'   🎉 SUCCESS! Collected {len(historical_data)} historical data points')
                    
                    # Check first few points for data quality
                    print('\n   📊 Sample historical data:')
                    for i, point in enumerate(historical_data[:3]):
                        timestamp = point.get('timestamp', 0)
                        dt = datetime.fromtimestamp(timestamp, timezone.utc) if timestamp else 'Invalid'
                        btc_price = point.get('btc_price', 0)
                        total_mcap = point.get('total_market_cap', 0)
                        btc_mcap = point.get('btc_market_cap', 0)
                        eth_mcap = point.get('eth_market_cap', 0)
                        
                        print(f'     Point {i+1}: {dt}')
                        print(f'       BTC Price: ${btc_price:,.2f}')
                        print(f'       Total Market Cap: ${total_mcap:,.0f}')
                        
                        # Check for fake data patterns
                        if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                            combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                            if abs(combined_ratio - 0.65) < 0.001:
                                print(f'       🚨 FAKE DATA DETECTED! Ratio: {combined_ratio:.6f}')
                            else:
                                print(f'       ✅ REAL DATA - Ratio: {combined_ratio:.3f}')
                        print()
                    
                    # Test database insertion
                    print('\n3. Testing database insertion...')
                    db = get_macro_db()
                    
                    # Insert a few sample points
                    inserted_count = 0
                    for point in historical_data[:5]:
                        try:
                            result = db.insert_market_data(point)
                            if result:
                                inserted_count += 1
                        except Exception as e:
                            print(f'     ⚠️  Insert error: {e}')
                    
                    print(f'   ✅ Successfully inserted {inserted_count} data points')
                    
                    # Verify inserted data
                    current_time = int(datetime.now(timezone.utc).timestamp())
                    recent_data = db.get_market_data_range(current_time - (24 * 60 * 60), current_time)
                    
                    fake_count = 0
                    for data in recent_data:
                        btc_mcap = data.get('btc_market_cap', 0)
                        eth_mcap = data.get('eth_market_cap', 0)
                        total_mcap = data.get('total_market_cap', 0)
                        
                        if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                            combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                            if abs(combined_ratio - 0.65) < 0.001:
                                fake_count += 1
                    
                    print(f'\n4. Database verification:')
                    print(f'   📊 Total recent records: {len(recent_data)}')
                    print(f'   🚨 Fake data records: {fake_count}')
                    print(f'   ✅ Real data records: {len(recent_data) - fake_count}')
                    
                    if fake_count == 0:
                        print('\n🎉 SUCCESS! No fake data detected in database!')
                    else:
                        print(f'\n⚠️  WARNING: {fake_count} fake data records still detected')
                
                else:
                    print('   ❌ No historical data collected')
                    
            except Exception as e:
                print(f'   ❌ Historical data collection failed: {e}')
                print('   This might be due to API limits or endpoint restrictions')
                
        print('\n' + '=' * 50)
        print('🧪 COINGECKO SERVICE TEST COMPLETED')
        
    except Exception as e:
        print(f'❌ Test failed: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_coingecko_historical())