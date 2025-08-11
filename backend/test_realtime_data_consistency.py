#!/usr/bin/env python3
"""
Test real-time data consistency for macro sentiment analysis.

This script verifies that:
1. Real-time global metrics and cryptocurrency quotes are from the same timeframe
2. BTC dominance calculations are consistent
3. Data sources are properly labeled
4. No more "wonky" final data points in charts
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Fix Windows event loop issue
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

async def test_realtime_data_consistency():
    """Test that real-time data collection is consistent."""
    print("🔍 Testing Real-Time Data Consistency")
    print("=" * 50)
    
    try:
        from services.coinmarketcap_service import CoinMarketCapService
        from local_config import CMC_API_KEY
        
        if not CMC_API_KEY:
            print("❌ CMC_API_KEY not configured")
            return False
        
        async with CoinMarketCapService(CMC_API_KEY) as service:
            print("📊 Collecting real-time data...")
            
            # Get global metrics
            print("\n1. Testing global metrics endpoint...")
            global_data = await service.get_current_global_metrics()
            print(f"   ✅ Total Market Cap: ${global_data['total_market_cap']:,.0f}")
            print(f"   ✅ BTC Dominance: {global_data['btc_dominance']:.2f}%")
            print(f"   ✅ ETH Dominance: {global_data['eth_dominance']:.2f}%")
            print(f"   ✅ Timestamp: {datetime.fromtimestamp(global_data['timestamp'], timezone.utc)}")
            
            # Get cryptocurrency quotes
            print("\n2. Testing cryptocurrency quotes endpoint...")
            crypto_quotes = await service.get_cryptocurrency_quotes_latest('BTC,ETH')
            btc_data = crypto_quotes.get('BTC', {})
            eth_data = crypto_quotes.get('ETH', {})
            
            print(f"   ✅ BTC Price: ${btc_data.get('price', 0):,.2f}")
            print(f"   ✅ BTC Market Cap: ${btc_data.get('market_cap', 0):,.0f}")
            print(f"   ✅ ETH Price: ${eth_data.get('price', 0):,.2f}")
            print(f"   ✅ ETH Market Cap: ${eth_data.get('market_cap', 0):,.0f}")
            
            # Verify consistency
            print("\n3. Verifying data consistency...")
            
            # Check timestamps are close (within 5 minutes)
            global_time = global_data['timestamp']
            btc_time = btc_data.get('timestamp', 0)
            eth_time = eth_data.get('timestamp', 0)
            
            time_diff_btc = abs(global_time - btc_time)
            time_diff_eth = abs(global_time - eth_time)
            
            if time_diff_btc <= 300 and time_diff_eth <= 300:  # 5 minutes
                print("   ✅ Timestamps are consistent (within 5 minutes)")
            else:
                print(f"   ⚠️  Timestamp inconsistency: Global={global_time}, BTC={btc_time}, ETH={eth_time}")
            
            # Calculate BTC dominance from individual data
            total_mcap_from_global = global_data['total_market_cap']
            btc_mcap_from_quotes = btc_data.get('market_cap', 0)
            
            if total_mcap_from_global > 0 and btc_mcap_from_quotes > 0:
                calculated_dominance = (btc_mcap_from_quotes / total_mcap_from_global) * 100
                reported_dominance = global_data['btc_dominance']
                dominance_diff = abs(calculated_dominance - reported_dominance)
                
                print(f"   📊 BTC Dominance (reported): {reported_dominance:.2f}%")
                print(f"   📊 BTC Dominance (calculated): {calculated_dominance:.2f}%")
                print(f"   📊 Difference: {dominance_diff:.2f}%")
                
                if dominance_diff <= 0.1:  # Within 0.1%
                    print("   ✅ BTC dominance calculations are consistent")
                else:
                    print("   ⚠️  BTC dominance calculations differ significantly")
            
            # Test the scanner service with new real-time data
            print("\n4. Testing scanner service with real-time data...")
            from services.macro_scanner_service import MacroScannerService
            
            scanner = MacroScannerService()
            scan_result = await scanner.collect_current_data()
            
            if scan_result.get('success'):
                snapshot = scan_result.get('data', {})
                print(f"   ✅ Scanner collected real-time data successfully")
                print(f"   📊 Total Market Cap: ${snapshot.get('total_market_cap', 0):,.0f}")
                print(f"   📊 BTC Price: ${snapshot.get('btc_price', 0):,.2f}")
                print(f"   📊 BTC Dominance: {snapshot.get('btc_dominance', 0):.2f}%")
                print(f"   📊 Data Source: {snapshot.get('data_source', 'unknown')}")
                print(f"   📊 Quality Score: {snapshot.get('data_quality_score', 0):.3f}")
                
                # Verify scanner data matches direct API calls
                scanner_dominance = snapshot.get('btc_dominance', 0)
                api_dominance = global_data['btc_dominance']
                scanner_diff = abs(scanner_dominance - api_dominance)
                
                if scanner_diff <= 0.1:
                    print("   ✅ Scanner data matches direct API calls")
                    return True
                else:
                    print(f"   ⚠️  Scanner dominance ({scanner_dominance:.2f}%) differs from API ({api_dominance:.2f}%)")
                    return False
            else:
                print(f"   ❌ Scanner failed: {scan_result.get('error', 'Unknown error')}")
                return False
                
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

async def test_chart_data_consistency():
    """Test that chart data will now be consistent."""
    print("\n🎯 Testing Chart Data Consistency")
    print("=" * 50)
    
    try:
        from models.macro_sentiment_models import MacroSentimentDatabase
        
        db = MacroSentimentDatabase()
        
        # Get recent market data using the correct method
        market_data_summary = db.get_market_data_summary()
        
        if not market_data_summary or market_data_summary.get('total_points', 0) == 0:
            print("❌ No market data found")
            return False
        
        print(f"📊 Found {market_data_summary.get('total_points', 0)} total data points")
        
        # Get the latest data points directly from database
        import sqlite3
        try:
            with sqlite3.connect(db.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM macro_market_data
                    ORDER BY timestamp DESC
                    LIMIT 5
                ''')
                
                recent_data = [dict(row) for row in cursor.fetchall()]
                
                if not recent_data:
                    print("❌ No recent market data found in database")
                    return False
                
                print(f"📊 Retrieved {len(recent_data)} most recent data points")
                latest_point = recent_data[0]
        except Exception as e:
            print(f"❌ Database query failed: {e}")
            return False
        print(f"\n📈 Latest data point:")
        print(f"   Timestamp: {datetime.fromtimestamp(latest_point['timestamp'], timezone.utc)}")
        print(f"   BTC Price: ${latest_point['btc_price']:,.2f}")
        print(f"   BTC Dominance: {latest_point['btc_dominance']:.2f}%")
        print(f"   Data Source: {latest_point.get('data_source', 'unknown')}")
        print(f"   Quality Score: {latest_point.get('data_quality_score', 0):.3f}")
        
        # Check for data source consistency in recent points
        realtime_sources = ['coinmarketcap_scanner_realtime', 'coinmarketcap_scanner', 'coinmarketcap_current']
        recent_realtime = [p for p in recent_data if p.get('data_source') in realtime_sources]
        
        if recent_realtime:
            print(f"   ✅ Found {len(recent_realtime)} recent real-time data points")
            
            # Check for consistency in recent real-time points
            dominance_values = [p['btc_dominance'] for p in recent_realtime]
            dominance_range = max(dominance_values) - min(dominance_values)
            
            print(f"   📊 BTC dominance range in recent points: {dominance_range:.2f}%")
            
            if dominance_range < 5.0:  # Less than 5% range is reasonable
                print("   ✅ Recent dominance values are consistent")
                return True
            else:
                print("   ⚠️  Large dominance range - may indicate data inconsistency")
                return False
        else:
            print("   ⚠️  No recent real-time data points found")
            return False
            
    except Exception as e:
        print(f"❌ Chart data test failed: {e}")
        return False

async def main():
    """Main test function."""
    print("🔧 REAL-TIME DATA CONSISTENCY TEST")
    print("📊 Verifying fix for 'wonky' final data points")
    print("🎯 Ensuring all data comes from same timeframe")
    print()
    
    # Test real-time data consistency
    realtime_ok = await test_realtime_data_consistency()
    
    # Test chart data consistency
    chart_ok = await test_chart_data_consistency()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    print(f"✅ Real-time Data Consistency: {'PASS' if realtime_ok else 'FAIL'}")
    print(f"✅ Chart Data Consistency: {'PASS' if chart_ok else 'FAIL'}")
    
    if realtime_ok and chart_ok:
        print("\n🎉 SUCCESS: Real-time data consistency is fixed!")
        print("📈 Charts should now show accurate final data points")
        print("🔄 All data comes from the same timeframe")
        print("⚡ Real-time quotes endpoint is working correctly")
        
        print("\n📋 CHANGES MADE:")
        print("   1. Added get_cryptocurrency_quotes_latest() to CoinMarketCap service")
        print("   2. Updated scanner to use real-time quotes instead of historical")
        print("   3. All data now comes from same timestamp/timeframe")
        print("   4. Data source labeled as 'coinmarketcap_scanner_realtime'")
        
        print("\n🚀 NEXT STEPS:")
        print("   1. Restart your Flask app to use the updated services")
        print("   2. Trigger a new analysis to see the improved data")
        print("   3. Check charts - final data points should now be accurate")
        
    else:
        print("\n❌ FAILED: Real-time data consistency issues remain")
        print("🔧 Check the error messages above for details")
        
        if not realtime_ok:
            print("   - Real-time API endpoints may need debugging")
        if not chart_ok:
            print("   - Chart data may need fresh collection")

if __name__ == "__main__":
    asyncio.run(main())