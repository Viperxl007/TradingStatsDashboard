#!/usr/bin/env python3
"""
Check Database ETH Records

This script will examine the actual database records to see what ETH data
is stored and identify any records with $0.00 ETH prices.
"""

import sqlite3
import sys
import os
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def check_database_eth_records():
    """Check the database for ETH records and identify issues"""
    
    print("🔍 CHECKING DATABASE ETH RECORDS")
    print("=" * 50)
    
    # Database path
    db_path = os.path.join('backend', 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return
    
    print(f"✅ Database found at: {db_path}")
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check if macro_market_data table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='macro_market_data'
            """)
            
            if not cursor.fetchone():
                print("❌ macro_market_data table not found!")
                return
            
            print("✅ macro_market_data table found")
            
            # Get table schema
            cursor.execute("PRAGMA table_info(macro_market_data)")
            columns = cursor.fetchall()
            print(f"\n📋 Table Schema:")
            for col in columns:
                print(f"   - {col[1]} ({col[2]})")
            
            # Count total records
            cursor.execute("SELECT COUNT(*) FROM macro_market_data")
            total_count = cursor.fetchone()[0]
            print(f"\n📊 Total records: {total_count}")
            
            if total_count == 0:
                print("❌ No records found in database!")
                return
            
            # Check for ETH price issues
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price = 0 OR eth_price IS NULL
            """)
            bad_eth_count = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price > 0
            """)
            good_eth_count = cursor.fetchone()[0]
            
            print(f"\n🔍 ETH Price Analysis:")
            print(f"   - Records with ETH price = 0 or NULL: {bad_eth_count}")
            print(f"   - Records with ETH price > 0: {good_eth_count}")
            
            # Show recent records
            cursor.execute("""
                SELECT timestamp, data_source, btc_price, eth_price, btc_market_cap, eth_market_cap
                FROM macro_market_data 
                ORDER BY timestamp DESC 
                LIMIT 10
            """)
            
            recent_records = cursor.fetchall()
            print(f"\n📋 Recent 10 Records:")
            print("   Timestamp           | Source                    | BTC Price    | ETH Price    | BTC Market Cap | ETH Market Cap")
            print("   " + "-" * 120)
            
            for record in recent_records:
                timestamp, source, btc_price, eth_price, btc_cap, eth_cap = record
                dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                
                # Handle NULL values safely
                btc_price_str = f"${btc_price:>10,.2f}" if btc_price is not None else "NULL"
                eth_price_str = f"${eth_price:>10,.2f}" if eth_price is not None else "NULL"
                btc_cap_str = f"${btc_cap:>13,.0f}" if btc_cap is not None else "NULL"
                eth_cap_str = f"${eth_cap:>13,.0f}" if eth_cap is not None else "NULL"
                
                print(f"   {dt.strftime('%Y-%m-%d %H:%M:%S')} | {source:<25} | {btc_price_str} | {eth_price_str} | {btc_cap_str} | {eth_cap_str}")
            
            # Check for records from manual scans specifically
            cursor.execute("""
                SELECT timestamp, data_source, btc_price, eth_price
                FROM macro_market_data 
                WHERE data_source LIKE '%manual%'
                ORDER BY timestamp DESC 
                LIMIT 5
            """)
            
            manual_records = cursor.fetchall()
            if manual_records:
                print(f"\n🔍 Manual Scan Records:")
                print("   Timestamp           | Source                    | BTC Price    | ETH Price")
                print("   " + "-" * 80)
                
                for record in manual_records:
                    timestamp, source, btc_price, eth_price = record
                    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                    status = "❌ BAD" if eth_price == 0 else "✅ GOOD"
                    print(f"   {dt.strftime('%Y-%m-%d %H:%M:%S')} | {source:<25} | ${btc_price:>10,.2f} | ${eth_price:>10,.2f} {status}")
            else:
                print(f"\n🔍 No manual scan records found")
            
            # Check for records from scanner specifically
            cursor.execute("""
                SELECT timestamp, data_source, btc_price, eth_price
                FROM macro_market_data 
                WHERE data_source LIKE '%scanner%'
                ORDER BY timestamp DESC 
                LIMIT 5
            """)
            
            scanner_records = cursor.fetchall()
            if scanner_records:
                print(f"\n🔍 Scanner Records:")
                print("   Timestamp           | Source                    | BTC Price    | ETH Price")
                print("   " + "-" * 80)
                
                for record in scanner_records:
                    timestamp, source, btc_price, eth_price = record
                    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                    status = "❌ BAD" if eth_price == 0 else "✅ GOOD"
                    print(f"   {dt.strftime('%Y-%m-%d %H:%M:%S')} | {source:<25} | ${btc_price:>10,.2f} | ${eth_price:>10,.2f} {status}")
            else:
                print(f"\n🔍 No scanner records found")
            
            # Summary and recommendations
            print(f"\n📊 SUMMARY:")
            print("=" * 30)
            
            if bad_eth_count > 0:
                print(f"❌ ISSUE CONFIRMED: {bad_eth_count} records have ETH price = $0.00")
                print(f"✅ GOOD RECORDS: {good_eth_count} records have valid ETH prices")
                
                if bad_eth_count == total_count:
                    print("🚨 CRITICAL: ALL records have bad ETH data!")
                elif bad_eth_count > good_eth_count:
                    print("⚠️  WARNING: More bad records than good records")
                else:
                    print("ℹ️  INFO: Minority of records have bad ETH data")
                
                print(f"\n🔧 RECOMMENDED ACTIONS:")
                print(f"   1. Delete {bad_eth_count} bad ETH records")
                print(f"   2. Fix the data collection issue")
                print(f"   3. Re-run manual scan to verify fix")
                
            else:
                print("✅ NO ISSUES: All records have valid ETH prices")
                print("   The issue might be in the display/analysis logic")
    
    except Exception as e:
        print(f"❌ Database Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_database_eth_records()