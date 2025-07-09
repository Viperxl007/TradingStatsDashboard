#!/usr/bin/env python3
"""
Check Database Schema
Inspects the actual database schema to understand table structures.
"""

import sqlite3
import sys

DB_PATH = 'backend/instance/chart_analysis.db'

def check_table_schema(table_name: str):
    """Check the schema of a specific table"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get table info
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            if columns:
                print(f"📊 Table: {table_name}")
                print("   Columns:")
                for col in columns:
                    col_id, name, data_type, not_null, default_val, pk = col
                    print(f"     {name} ({data_type}){' NOT NULL' if not_null else ''}{' PRIMARY KEY' if pk else ''}")
                print()
            else:
                print(f"❌ Table {table_name} not found")
                
    except Exception as e:
        print(f"❌ Error checking {table_name}: {e}")

def main():
    """Check database schema"""
    print("🔍 DATABASE SCHEMA INSPECTION")
    print("=" * 50)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # List all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            print("📋 Available Tables:")
            for table in tables:
                print(f"   - {table[0]}")
            print()
            
            # Check specific tables we need
            check_table_schema('active_trades')
            check_table_schema('trade_updates')
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()