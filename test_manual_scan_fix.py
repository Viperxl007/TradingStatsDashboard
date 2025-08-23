#!/usr/bin/env python3
"""
Test Manual Scan Fix

This script will trigger a manual scan to verify that ETH data is now
being collected and stored correctly after the cleanup.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from services.macro_scanner_service import trigger_manual_scan
    from models.macro_sentiment_models import get_macro_db
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

async def test_manual_scan_fix():
    """Test that the manual scan now correctly collects ETH data"""
    
    print("🧪 TESTING MANUAL SCAN ETH DATA FIX")
    print("=" * 50)
    
    # Get database connection
    db = get_macro_db()
    
    # Get count before scan
    try:
        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM macro_market_data")
            count_before = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price > 0
            """)
            good_eth_before = cursor.fetchone()[0]
            
            print(f"📊 Before scan:")
            print(f"   - Total records: {count_before}")
            print(f"   - Records with valid ETH price: {good_eth_before}")
    except Exception as e:
        print(f"❌ Error checking database before scan: {e}")
        return
    
    # Trigger manual scan
    print(f"\n🚀 Triggering manual scan...")
    try:
        result = await trigger_manual_scan()
        
        if result.get('success'):
            print(f"✅ Manual scan completed successfully!")
            print(f"   - Scan duration: {result.get('scan_duration_ms', 'unknown')}ms")
            print(f"   - Data quality: {result.get('data_quality', 'unknown')}")
            print(f"   - Analysis triggered: {result.get('triggered_analysis', False)}")
        else:
            print(f"❌ Manual scan failed: {result.get('error', 'Unknown error')}")
            return
            
    except Exception as e:
        print(f"❌ Error triggering manual scan: {e}")
        return
    
    # Check database after scan
    try:
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM macro_market_data")
            count_after = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price > 0
            """)
            good_eth_after = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM macro_market_data 
                WHERE eth_price = 0 OR eth_price IS NULL
            """)
            bad_eth_after = cursor.fetchone()[0]
            
            print(f"\n📊 After scan:")
            print(f"   - Total records: {count_after}")
            print(f"   - Records with valid ETH price: {good_eth_after}")
            print(f"   - Records with bad ETH price: {bad_eth_after}")
            print(f"   - New records added: {count_after - count_before}")
            
            # Get the latest record to verify ETH data
            cursor.execute("""
                SELECT timestamp, data_source, btc_price, eth_price, btc_market_cap, eth_market_cap
                FROM macro_market_data 
                ORDER BY timestamp DESC 
                LIMIT 1
            """)
            
            latest_record = cursor.fetchone()
            if latest_record:
                timestamp, source, btc_price, eth_price, btc_cap, eth_cap = latest_record
                dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                
                print(f"\n📋 Latest Record:")
                print(f"   - Timestamp: {dt.strftime('%Y-%m-%d %H:%M:%S')} UTC")
                print(f"   - Source: {source}")
                print(f"   - BTC Price: ${btc_price:,.2f}")
                print(f"   - ETH Price: ${eth_price:,.2f}")
                print(f"   - BTC Market Cap: ${btc_cap:,.0f}")
                print(f"   - ETH Market Cap: ${eth_cap:,.0f}")
                
                # Verify the fix
                if eth_price > 0:
                    print(f"\n✅ SUCCESS: ETH price is correctly recorded as ${eth_price:,.2f}")
                    print(f"✅ FIX CONFIRMED: Manual scan is now collecting ETH data properly")
                else:
                    print(f"\n❌ FAILURE: ETH price is still ${eth_price}")
                    print(f"❌ ISSUE PERSISTS: Manual scan is still not collecting ETH data")
            else:
                print(f"\n❌ No records found in database")
                
    except Exception as e:
        print(f"❌ Error checking database after scan: {e}")
    
    print(f"\n🏁 Test completed")

if __name__ == "__main__":
    asyncio.run(test_manual_scan_fix())