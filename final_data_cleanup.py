#!/usr/bin/env python3
"""
Final data cleanup script to remove remaining outliers and improve chart quality
"""

import sqlite3
import sys
import os

def main():
    # Connect to the database
    db_path = 'backend/instance/chart_analysis.db'
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=== FINAL DATA CLEANUP ===")
    
    # 1. Remove extreme alt strength outliers (< 10M)
    print("\n1. Removing extreme alt strength outliers...")
    cursor.execute('''
        SELECT COUNT(*) FROM macro_market_data 
        WHERE alt_strength_ratio < 10000000
    ''')
    outlier_count = cursor.fetchone()[0]
    print(f"Found {outlier_count} extreme outliers (alt strength < 10M)")
    
    if outlier_count > 0:
        cursor.execute('''
            DELETE FROM macro_market_data 
            WHERE alt_strength_ratio < 10000000
        ''')
        print(f"Removed {outlier_count} extreme outliers")
    
    # 2. Check for any null/zero BTC prices and remove them
    print("\n2. Checking for invalid BTC prices...")
    cursor.execute('''
        SELECT COUNT(*) FROM macro_market_data 
        WHERE btc_price IS NULL OR btc_price = 0 OR btc_price < 1000
    ''')
    invalid_price_count = cursor.fetchone()[0]
    print(f"Found {invalid_price_count} entries with invalid BTC prices")
    
    if invalid_price_count > 0:
        cursor.execute('''
            DELETE FROM macro_market_data 
            WHERE btc_price IS NULL OR btc_price = 0 OR btc_price < 1000
        ''')
        print(f"Removed {invalid_price_count} entries with invalid BTC prices")
    
    # 3. Final data quality check
    print("\n3. Final data quality check...")
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            MIN(btc_dominance) as min_dom,
            MAX(btc_dominance) as max_dom,
            MIN(alt_strength_ratio) as min_alt,
            MAX(alt_strength_ratio) as max_alt,
            MIN(btc_price) as min_btc,
            MAX(btc_price) as max_btc
        FROM macro_market_data
    ''')
    
    stats = cursor.fetchone()
    print(f"Final dataset:")
    print(f"  Total records: {stats[0]}")
    print(f"  BTC Dominance: {stats[1]:.2f}% - {stats[2]:.2f}%")
    print(f"  Alt Strength: {stats[3]:,.0f} - {stats[4]:,.0f}")
    print(f"  BTC Price: ${stats[5]:,.0f} - ${stats[6]:,.0f}")
    
    # 4. Check recent data quality
    print("\n4. Recent data sample:")
    cursor.execute('''
        SELECT 
            timestamp,
            btc_price,
            btc_dominance,
            alt_strength_ratio
        FROM macro_market_data 
        ORDER BY timestamp DESC
        LIMIT 5
    ''')
    
    recent = cursor.fetchall()
    for row in recent:
        print(f"  {row[0]}: BTC=${row[1]:,.0f}, Dom={row[2]:.2f}%, Alt={row[3]:,.0f}")
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print(f"\n✅ Final cleanup completed!")
    print("Charts should now display with proper scaling and no extreme outliers.")

if __name__ == "__main__":
    main()