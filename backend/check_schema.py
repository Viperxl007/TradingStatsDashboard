#!/usr/bin/env python3
"""
Check the schema of the active_trades table
"""

import sqlite3
import os

def check_schema():
    """Check the schema of active_trades table"""
    
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print("❌ Database not found")
        return
    
    print(f"🔍 Checking schema in {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get table schema
        cursor.execute("PRAGMA table_info(active_trades)")
        columns = cursor.fetchall()
        
        if not columns:
            print("❌ active_trades table does not exist")
            return
        
        print("📋 active_trades table columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Get sample data
        cursor.execute("SELECT * FROM active_trades LIMIT 3")
        trades = cursor.fetchall()
        
        print(f"\n📊 Sample data ({len(trades)} trades):")
        for i, trade in enumerate(trades):
            print(f"  Trade {i+1}: {trade}")
        
    except Exception as e:
        print(f"❌ Error checking schema: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_schema()