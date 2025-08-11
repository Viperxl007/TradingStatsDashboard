#!/usr/bin/env python3
"""
Clean Corrupted Macro Market Data

This script identifies and removes corrupted data entries that are causing
chart visualization issues in the macro sentiment system.
"""

import sqlite3
import sys
from datetime import datetime

def clean_corrupted_data():
    """Remove corrupted data entries from the macro market data table."""
    
    db_path = 'backend/instance/chart_analysis.db'
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("=== Macro Market Data Corruption Cleanup ===\n")
        
        # Check current data count
        cursor.execute('SELECT COUNT(*) FROM macro_market_data')
        initial_count = cursor.fetchone()[0]
        print(f"Initial data points: {initial_count}")
        
        # 1. Remove entries with suspicious timestamp pattern (20:03:43)
        print("\n1. Removing entries with suspicious timestamp pattern (20:03:43)...")
        cursor.execute('''
            SELECT COUNT(*) FROM macro_market_data 
            WHERE datetime(timestamp, 'unixepoch') LIKE '%20:03:43'
        ''')
        suspicious_time_count = cursor.fetchone()[0]
        print(f"   Found {suspicious_time_count} entries with suspicious timestamp")
        
        cursor.execute('''
            DELETE FROM macro_market_data 
            WHERE datetime(timestamp, 'unixepoch') LIKE '%20:03:43'
        ''')
        print(f"   Removed {cursor.rowcount} entries")
        
        # 2. Remove entries with identical repeated values (clear data corruption)
        print("\n2. Removing entries with identical repeated values...")
        cursor.execute('''
            SELECT COUNT(*) FROM macro_market_data 
            WHERE btc_dominance = 59.731054460344744 
            AND alt_strength_ratio = 9567140.018474089
        ''')
        identical_count = cursor.fetchone()[0]
        print(f"   Found {identical_count} entries with identical values")
        
        cursor.execute('''
            DELETE FROM macro_market_data 
            WHERE btc_dominance = 59.731054460344744 
            AND alt_strength_ratio = 9567140.018474089
        ''')
        print(f"   Removed {cursor.rowcount} entries")
        
        # 3. Remove any remaining entries with suspiciously repeated alt_strength_ratio
        print("\n3. Checking for other repeated values...")
        cursor.execute('''
            SELECT alt_strength_ratio, COUNT(*) as count
            FROM macro_market_data 
            GROUP BY alt_strength_ratio
            HAVING COUNT(*) > 3
            ORDER BY count DESC
        ''')
        
        repeated_values = cursor.fetchall()
        total_removed_repeated = 0
        
        for value, count in repeated_values:
            if count > 3:  # Keep max 3 of any identical value
                print(f"   Found {count} entries with alt_strength_ratio = {value:,.0f}")
                
                # Keep only the 3 most recent entries with this value
                cursor.execute('''
                    DELETE FROM macro_market_data 
                    WHERE alt_strength_ratio = ? 
                    AND id NOT IN (
                        SELECT id FROM macro_market_data 
                        WHERE alt_strength_ratio = ? 
                        ORDER BY timestamp DESC 
                        LIMIT 3
                    )
                ''', (value, value))
                
                removed = cursor.rowcount
                total_removed_repeated += removed
                print(f"   Removed {removed} duplicate entries, kept 3 most recent")
        
        # Check final count
        cursor.execute('SELECT COUNT(*) FROM macro_market_data')
        final_count = cursor.fetchone()[0]
        total_removed = initial_count - final_count
        
        print(f"\n=== Cleanup Summary ===")
        print(f"Initial data points: {initial_count}")
        print(f"Final data points: {final_count}")
        print(f"Total removed: {total_removed}")
        print(f"Data quality improvement: {((total_removed / initial_count) * 100):.1f}% corruption removed")
        
        # Show recent clean data sample
        print(f"\n=== Recent Clean Data Sample ===")
        cursor.execute('''
            SELECT 
                datetime(timestamp, 'unixepoch') as readable_time,
                btc_price,
                btc_dominance,
                alt_strength_ratio
            FROM macro_market_data 
            ORDER BY timestamp DESC 
            LIMIT 10
        ''')
        
        recent = cursor.fetchall()
        for entry in recent:
            readable, btc_price, dominance, alt_ratio = entry
            print(f"  {readable}: BTC=${btc_price:,.0f}, Dom={dominance:.2f}%, Alt={alt_ratio:,.0f}")
        
        # Commit changes
        conn.commit()
        print(f"\n✅ Database cleanup completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        if 'conn' in locals():
            conn.rollback()
        sys.exit(1)
    
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    clean_corrupted_data()