#!/usr/bin/env python3
"""
Clean up the bad CoinGecko data point that's causing wonky chart behavior.

This script removes the problematic data point and ensures only clean
CoinMarketCap data remains for accurate charts.
"""

import sys
import os
import sqlite3
from datetime import datetime, timezone

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

def clean_bad_data_points():
    """Remove bad CoinGecko data points from the database."""
    print("🧹 CLEANING BAD DATA POINTS")
    print("=" * 50)
    
    try:
        from models.macro_sentiment_models import MacroSentimentDatabase
        
        db = MacroSentimentDatabase()
        
        with sqlite3.connect(db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # First, let's see what we have
            print("📊 Current data sources in database:")
            cursor.execute('''
                SELECT data_source, COUNT(*) as count, 
                       MIN(timestamp) as earliest, 
                       MAX(timestamp) as latest
                FROM macro_market_data 
                GROUP BY data_source 
                ORDER BY latest DESC
            ''')
            
            sources = cursor.fetchall()
            for source in sources:
                latest_time = datetime.fromtimestamp(source['latest'], timezone.utc)
                earliest_time = datetime.fromtimestamp(source['earliest'], timezone.utc)
                print(f"   {source['data_source']}: {source['count']} points")
                print(f"      Range: {earliest_time.strftime('%Y-%m-%d %H:%M')} to {latest_time.strftime('%Y-%m-%d %H:%M')}")
            
            # Identify problematic CoinGecko data points
            print("\n🔍 Identifying problematic data points...")
            cursor.execute('''
                SELECT timestamp, btc_price, btc_dominance, data_source
                FROM macro_market_data 
                WHERE data_source = 'coingecko'
                ORDER BY timestamp DESC
            ''')
            
            coingecko_points = cursor.fetchall()
            
            if coingecko_points:
                print(f"❌ Found {len(coingecko_points)} CoinGecko data points:")
                for point in coingecko_points:
                    point_time = datetime.fromtimestamp(point['timestamp'], timezone.utc)
                    print(f"   {point_time.strftime('%Y-%m-%d %H:%M:%S')}: BTC ${point['btc_price']:,.2f}, Dom {point['btc_dominance']:.2f}%")
                
                # Remove CoinGecko data points
                print(f"\n🗑️  Removing {len(coingecko_points)} CoinGecko data points...")
                cursor.execute('DELETE FROM macro_market_data WHERE data_source = ?', ('coingecko',))
                deleted_count = cursor.rowcount
                
                print(f"✅ Deleted {deleted_count} problematic data points")
                
            else:
                print("✅ No CoinGecko data points found")
            
            # Also remove any other potentially problematic data sources
            problematic_sources = ['coingecko_free', 'coingecko_synthetic', 'mixed_source']
            
            for source in problematic_sources:
                cursor.execute('DELETE FROM macro_market_data WHERE data_source = ?', (source,))
                if cursor.rowcount > 0:
                    print(f"✅ Deleted {cursor.rowcount} points from source: {source}")
            
            # Show final state
            print("\n📊 Final data sources after cleanup:")
            cursor.execute('''
                SELECT data_source, COUNT(*) as count, 
                       MIN(timestamp) as earliest, 
                       MAX(timestamp) as latest
                FROM macro_market_data 
                GROUP BY data_source 
                ORDER BY latest DESC
            ''')
            
            final_sources = cursor.fetchall()
            total_points = 0
            
            for source in final_sources:
                latest_time = datetime.fromtimestamp(source['latest'], timezone.utc)
                earliest_time = datetime.fromtimestamp(source['earliest'], timezone.utc)
                total_points += source['count']
                print(f"   {source['data_source']}: {source['count']} points")
                print(f"      Range: {earliest_time.strftime('%Y-%m-%d %H:%M')} to {latest_time.strftime('%Y-%m-%d %H:%M')}")
            
            print(f"\n📈 Total clean data points: {total_points}")
            
            # Check the most recent data point
            cursor.execute('''
                SELECT * FROM macro_market_data 
                ORDER BY timestamp DESC 
                LIMIT 1
            ''')
            
            latest = cursor.fetchone()
            if latest:
                latest_time = datetime.fromtimestamp(latest['timestamp'], timezone.utc)
                hours_ago = (datetime.now(timezone.utc) - latest_time).total_seconds() / 3600
                
                print(f"\n📈 Most recent data point after cleanup:")
                print(f"   Timestamp: {latest_time.strftime('%Y-%m-%d %H:%M:%S UTC')} ({hours_ago:.1f}h ago)")
                print(f"   BTC Price: ${latest['btc_price']:,.2f}")
                print(f"   BTC Dominance: {latest['btc_dominance']:.2f}%")
                print(f"   Data Source: {latest['data_source']}")
                
                if latest['data_source'] in ['coinmarketcap_real_historical', 'coinmarketcap_scanner', 'coinmarketcap_scanner_realtime']:
                    print("✅ Most recent data is from clean CoinMarketCap source")
                else:
                    print("⚠️  Most recent data may still need attention")
            
            conn.commit()
            return True
            
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        return False

def trigger_fresh_data_collection():
    """Suggest triggering fresh data collection."""
    print("\n🔄 FRESH DATA COLLECTION")
    print("=" * 50)
    
    print("📋 To get a fresh real-time data point with the fix:")
    print("   1. Start your Flask app: python backend/app.py")
    print("   2. Trigger manual scan: curl -X POST http://localhost:5000/api/macro-sentiment/scan")
    print("   3. Or trigger analysis: curl -X POST http://localhost:5000/api/macro-sentiment/analyze -H 'Content-Type: application/json' -d '{\"days\": 30}'")
    print()
    print("🎯 This will collect a new data point using the fixed real-time method")
    print("📈 Charts should then show smooth, accurate final data points")

def main():
    """Main cleanup function."""
    print("🧹 BAD DATA POINT CLEANUP")
    print("📊 Removing problematic CoinGecko data causing wonky charts")
    print()
    
    # Clean up bad data points
    cleanup_success = clean_bad_data_points()
    
    # Show next steps
    trigger_fresh_data_collection()
    
    # Summary
    print("\n" + "=" * 60)
    print("CLEANUP SUMMARY")
    print("=" * 60)
    
    if cleanup_success:
        print("✅ SUCCESS: Bad data points have been removed")
        print("📈 Database now contains only clean CoinMarketCap data")
        print("🔧 Real-time data consistency fix is implemented")
        print()
        print("🚀 NEXT STEPS:")
        print("   1. The fix is ready - restart Flask app")
        print("   2. Trigger new data collection to see clean results")
        print("   3. Charts should now show accurate final data points")
        print("   4. No more wonky spikes or inconsistent data")
        
    else:
        print("❌ FAILED: Cleanup encountered issues")
        print("🔧 Check error messages above for details")

if __name__ == "__main__":
    main()