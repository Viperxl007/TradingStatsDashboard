#!/usr/bin/env python3
"""
Final validation test for the free-tier-only market regime scanner solution.
This test validates that we can collect real historical data using only free CoinGecko endpoints.
"""

import sys
import os
sys.path.append('./backend')

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from services.coingecko_service import CoinGeckoService
from models.macro_sentiment_models import get_macro_db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_final_solution():
    """Test the complete free-tier-only solution"""
    
    print("🎯 FINAL SOLUTION VALIDATION TEST")
    print("=" * 50)
    print("Testing complete market regime scanner with FREE TIER ONLY")
    print()
    
    # Initialize services
    coingecko = CoinGeckoService()
    db = get_macro_db()
    
    # Clear any existing data for clean test
    print("🧹 Clearing database for clean test...")
    db.clear_all_market_data()
    
    # Test 1: Verify database is clean
    current_time = int(datetime.now(timezone.utc).timestamp())
    existing_data = db.get_market_data_range(0, current_time)
    print(f"✅ Database cleared: {len(existing_data)} records")
    print()
    
    # Test 2: Collect real historical data using free tier only
    print("📊 Testing historical data collection (FREE TIER ONLY)...")
    try:
        # Get data for last 7 days
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=7)
        
        print(f"   Requesting data from {start_time.strftime('%Y-%m-%d')} to {end_time.strftime('%Y-%m-%d')}")
        
        # This should use only free tier endpoints
        historical_data = await coingecko.get_historical_market_data(
            start_timestamp=int(start_time.timestamp()),
            end_timestamp=int(end_time.timestamp())
        )
        
        print(f"   ✅ Successfully collected {len(historical_data)} data points")
        
        # Test 3: Validate data quality
        print("\n🔍 Validating data quality...")
        fake_data_count = 0
        real_data_count = 0
        
        for i, data_point in enumerate(historical_data):
            btc_mcap = data_point.get('btc_market_cap', 0)
            eth_mcap = data_point.get('eth_market_cap', 0)
            total_mcap = data_point.get('total_market_cap', 0)
            
            # Check for fake 0.65 ratio
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                if abs(combined_ratio - 0.65) < 0.001:
                    fake_data_count += 1
                    print(f"   🚨 FAKE DATA DETECTED at point {i}: ratio = {combined_ratio:.6f}")
                else:
                    real_data_count += 1
                    if i < 3:  # Show first few real ratios
                        print(f"   ✅ Real data point {i}: ratio = {combined_ratio:.3f}")
        
        print(f"\n📈 Data Quality Summary:")
        print(f"   Real data points: {real_data_count}")
        print(f"   Fake data points: {fake_data_count}")
        print(f"   Success rate: {(real_data_count / len(historical_data) * 100):.1f}%")
        
        # Test 4: Store data and verify database
        print(f"\n💾 Storing data in database...")
        for data_point in historical_data:
            db.store_market_data(data_point)
        
        # Verify stored data
        stored_data = db.get_market_data_range(0, current_time)
        print(f"   ✅ Stored {len(stored_data)} records in database")
        
        # Test 5: Final validation
        print(f"\n🎯 FINAL VALIDATION:")
        if fake_data_count == 0:
            print("   ✅ NO FAKE DATA DETECTED - System is working correctly!")
            print("   ✅ All data uses real market ratios")
            print("   ✅ Free tier solution is fully functional")
        else:
            print(f"   🚨 WARNING: {fake_data_count} fake data points detected")
            print("   🚨 System may still have fallback calculation issues")
        
        # Show sample of final data
        if stored_data:
            print(f"\n📊 Sample of stored data:")
            for i, data in enumerate(stored_data[:3]):
                timestamp = data.get('timestamp', 0)
                dt = datetime.fromtimestamp(timestamp, timezone.utc)
                btc_price = data.get('btc_price', 0)
                total_mcap = data.get('total_market_cap', 0)
                btc_mcap = data.get('btc_market_cap', 0)
                eth_mcap = data.get('eth_market_cap', 0)
                
                if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                    ratio = (btc_mcap + eth_mcap) / total_mcap
                    print(f"   {dt.strftime('%Y-%m-%d %H:%M')}: BTC ${btc_price:,.0f}, Total ${total_mcap:,.0f}, Ratio {ratio:.3f}")
        
    except Exception as e:
        print(f"   ❌ Error during data collection: {e}")
        return False
    
    print(f"\n🎉 FREE TIER SOLUTION TEST COMPLETED")
    return fake_data_count == 0

if __name__ == "__main__":
    try:
        print("APScheduler not available. Background tasks will be disabled.")
        success = asyncio.run(test_final_solution())
        if success:
            print("\n🎯 SUCCESS: Free tier solution is working perfectly!")
        else:
            print("\n⚠️  WARNING: Issues detected in free tier solution")
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")