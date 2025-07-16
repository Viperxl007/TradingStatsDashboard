#!/usr/bin/env python3
"""
Script to examine the AAVE trade (ID: 40) in the database
"""
import sqlite3
import os
from datetime import datetime

def examine_database():
    """Examine the database structure and current AAVE trade data"""
    db_path = os.path.join('backend', 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return
    
    print(f"Examining database: {db_path}")
    print("=" * 60)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Available tables:")
        for table in tables:
            print(f"  - {table[0]}")
        print()
        
        # Check if active_trades table exists
        if ('active_trades',) in tables:
            print("ACTIVE_TRADES TABLE STRUCTURE:")
            cursor.execute("PRAGMA table_info(active_trades);")
            columns = cursor.fetchall()
            for col in columns:
                print(f"  {col[1]} ({col[2]}) - {'NOT NULL' if col[3] else 'NULL'}")
            print()
            
            # Look for AAVE trade (ID: 40)
            print("SEARCHING FOR AAVE TRADE (ID: 40):")
            cursor.execute("SELECT * FROM active_trades WHERE id = 40;")
            trade = cursor.fetchone()
            
            if trade:
                print("Found AAVE trade:")
                col_names = [description[0] for description in cursor.description]
                for i, value in enumerate(trade):
                    print(f"  {col_names[i]}: {value}")
            else:
                print("Trade ID 40 not found in active_trades table")
                
                # Search for AAVE trades by ticker
                print("\nSearching for AAVE trades by ticker:")
                cursor.execute("SELECT * FROM active_trades WHERE ticker LIKE '%AAVE%';")
                aave_trades = cursor.fetchall()
                
                if aave_trades:
                    col_names = [description[0] for description in cursor.description]
                    for trade in aave_trades:
                        print(f"\nFound AAVE trade:")
                        for i, value in enumerate(trade):
                            print(f"  {col_names[i]}: {value}")
                else:
                    print("No AAVE trades found by ticker")
            print()
        
        # Check other relevant tables
        for table_name in ['trades', 'trade_history', 'closed_trades']:
            if (table_name,) in tables:
                print(f"\nCHECKING {table_name.upper()} TABLE:")
                cursor.execute(f"SELECT * FROM {table_name} WHERE id = 40 OR ticker LIKE '%AAVE%';")
                results = cursor.fetchall()
                
                if results:
                    cursor.execute(f"PRAGMA table_info({table_name});")
                    columns = cursor.fetchall()
                    col_names = [col[1] for col in columns]
                    
                    for result in results:
                        print(f"Found record in {table_name}:")
                        for i, value in enumerate(result):
                            print(f"  {col_names[i]}: {value}")
                        print()
                else:
                    print(f"No AAVE trades found in {table_name}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error examining database: {e}")

if __name__ == "__main__":
    examine_database()