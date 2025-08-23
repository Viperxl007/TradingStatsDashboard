#!/usr/bin/env python3
"""
Clean Bad ETH Records

This script will identify and remove the specific records with ETH price = 0 or NULL
that are causing the analysis to show $0.00 ETH price.
"""

import sqlite3
import sys
import os
from datetime import datetime, timezone

def clean_bad_eth_records():
    """Clean up bad ETH records from the database"""
    
    print("🧹 CLEANING BAD ETH RECORDS")
    print("=" * 40)
    
    # Database path
    db_path = os.path.join('backend', 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # First, identify the bad records
            cursor.execute("""
                SELECT id, timestamp, data_source, btc_price, eth_price, btc_market_cap, eth_market_cap
                FROM macro_market_data 
                WHERE eth_price = 0 OR eth_price IS NULL
                ORDER BY timestamp DESC
            """)
            
            bad_records = cursor.fetchall()
            
            if not bad_records:
                print("✅ No bad ETH records found!")
                return
            
            print(f"🔍 Found {len(bad_records)} bad ETH records:")
            print("   ID | Timestamp           | Source                    | BTC Price    | ETH Price | BTC Market Cap | ETH Market Cap")
            print("   " + "-" * 120)
            
            for record in bad_records:
                record_id, timestamp, source, btc_price, eth_price, btc_cap, eth_cap = record
                dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                
                eth_price_str = f"${eth_price:,.2f}" if eth_price is not None and eth_price > 0 else "NULL/0"
                btc_price_str = f"${btc_price:,.2f}" if btc_price is not None else "NULL"
                btc_cap_str = f"${btc_cap:,.0f}" if btc_cap is not None else "NULL"
                eth_cap_str = f"${eth_cap:,.0f}" if eth_cap is not None else "NULL"
                
                print(f"   {record_id:>2} | {dt.strftime('%Y-%m-%d %H:%M:%S')} | {source:<25} | {btc_price_str:>11} | {eth_price_str:>9} | {btc_cap_str:>14} | {eth_cap_str:>14}")
            
            # Ask for confirmation (auto-confirm for script)
            print(f"\n🗑️  DELETING {len(bad_records)} bad ETH records...")
            
            # Delete the bad records
            cursor.execute("""
                DELETE FROM macro_market_data 
                WHERE eth_price = 0 OR eth_price IS NULL
            """)
            
            deleted_count = cursor.rowcount
            conn.commit()
            
            print(f"✅ Successfully deleted {deleted_count} bad ETH records")
            
            # Verify the cleanup
            cursor.execute("SELECT COUNT(*) FROM macro_market_data")
            total_count = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price = 0 OR eth_price IS NULL
            """)
            remaining_bad = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price > 0
            """)
            good_count = cursor.fetchone()[0]
            
            print(f"\n📊 CLEANUP RESULTS:")
            print(f"   - Total records remaining: {total_count}")
            print(f"   - Bad ETH records remaining: {remaining_bad}")
            print(f"   - Good ETH records: {good_count}")
            
            if remaining_bad == 0:
                print("✅ SUCCESS: All bad ETH records have been cleaned up!")
            else:
                print(f"⚠️  WARNING: {remaining_bad} bad ETH records still remain")
            
            # Show recent records after cleanup
            cursor.execute("""
                SELECT timestamp, data_source, btc_price, eth_price
                FROM macro_market_data 
                ORDER BY timestamp DESC 
                LIMIT 5
            """)
            
            recent_records = cursor.fetchall()
            print(f"\n📋 Recent Records After Cleanup:")
            print("   Timestamp           | Source                    | BTC Price    | ETH Price")
            print("   " + "-" * 80)
            
            for record in recent_records:
                timestamp, source, btc_price, eth_price = record
                dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                
                btc_price_str = f"${btc_price:,.2f}" if btc_price is not None else "NULL"
                eth_price_str = f"${eth_price:,.2f}" if eth_price is not None else "NULL"
                status = "✅" if eth_price and eth_price > 0 else "❌"
                
                print(f"   {dt.strftime('%Y-%m-%d %H:%M:%S')} | {source:<25} | {btc_price_str:>11} | {eth_price_str:>11} {status}")
    
    except Exception as e:
        print(f"❌ Database Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    clean_bad_eth_records()