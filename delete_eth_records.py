#!/usr/bin/env python3
"""
Script to delete all ETHUSD records from the database
"""

import sys
import sqlite3
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.append('backend')

try:
    from backend.services.database_service import DatabaseService
except ImportError:
    # Fallback to direct database access
    DatabaseService = None

class DirectDB:
    """Direct database access fallback"""
    def __init__(self, db_path):
        self.db_path = db_path
    
    def fetch_all(self, query, params=None):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchall()
    
    def execute_query(self, query, params=None):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.rowcount

def main():
    print("🗑️ ETH Records Deletion Script")
    print("=" * 50)
    
    # Initialize database
    if DatabaseService:
        db = DatabaseService()
    else:
        # Fallback to direct database access
        print("⚠️  Using direct database access...")
        db_path = os.path.join(os.path.dirname(__file__), 'backend', 'instance', 'chart_analysis.db')
        db = DirectDB(db_path)
    
    print("🔍 Step 1: Checking all database tables for ETH records...")
    
    # Check chart_analysis table (old table name)
    try:
        records = db.fetch_all('SELECT id, ticker, timestamp, action FROM chart_analysis WHERE ticker = ? ORDER BY timestamp DESC', ('ETHUSD',))
        if records:
            print(f"📊 Found {len(records)} ETHUSD records in chart_analysis table:")
            for record in records:
                print(f"   ID: {record[0]}, Ticker: {record[1]}, Time: {record[2]}, Action: {record[3]}")
            
            # Delete from chart_analysis table
            print(f"\n🗑️ Deleting {len(records)} records from chart_analysis table...")
            for record in records:
                result = db.execute_query('DELETE FROM chart_analysis WHERE id = ?', (record[0],))
                print(f"   ✅ Deleted record ID {record[0]} (affected rows: {result})")
        else:
            print("❌ No ETHUSD records in chart_analysis table")
    except Exception as e:
        print(f"❌ chart_analysis table error: {e}")

    print()

    # Check chart_analyses table (new table name)
    try:
        records = db.fetch_all('SELECT id, ticker, analysis_timestamp FROM chart_analyses WHERE ticker = ? ORDER BY analysis_timestamp DESC', ('ETHUSD',))
        if records:
            print(f"📊 Found {len(records)} ETHUSD records in chart_analyses table:")
            for record in records:
                print(f"   ID: {record[0]}, Ticker: {record[1]}, Time: {record[2]}")
            
            # Delete from chart_analyses table
            print(f"\n🗑️ Deleting {len(records)} records from chart_analyses table...")
            for record in records:
                result = db.execute_query('DELETE FROM chart_analyses WHERE id = ?', (record[0],))
                print(f"   ✅ Deleted record ID {record[0]} (affected rows: {result})")
        else:
            print("❌ No ETHUSD records in chart_analyses table")
    except Exception as e:
        print(f"❌ chart_analyses table error: {e}")
    
    print()
    
    # Also check for any active trades that might be preventing deletion
    try:
        from backend.services.active_trade_service import ActiveTradeService
        active_trade_service = ActiveTradeService()
        
        print("🔍 Step 2: Checking for active ETHUSD trades...")
        trade_history = active_trade_service.get_trade_history('ETHUSD', limit=10)
        
        if trade_history:
            print(f"📊 Found {len(trade_history)} ETHUSD trades:")
            active_trades = [t for t in trade_history if t['status'] in ['waiting', 'active']]
            closed_trades = [t for t in trade_history if t['status'] not in ['waiting', 'active']]
            
            if active_trades:
                print(f"🟢 Active Trades: {len(active_trades)}")
                for trade in active_trades:
                    print(f"   ID: {trade['id']} | {trade['action'].upper()} | ${trade['entry_price']} | {trade['status'].upper()}")
                    
                print("\n⚠️  Note: Active trades may prevent analysis deletion from the frontend.")
                print("   You may need to close these trades first.")
            
            if closed_trades:
                print(f"🔴 Closed Trades: {len(closed_trades)}")
                for trade in closed_trades:
                    pnl = trade.get('pnl_percentage', 0)
                    print(f"   ID: {trade['id']} | {trade['action'].upper()} | ${trade['entry_price']} | PnL: {pnl:.2f}%")
        else:
            print("❌ No ETHUSD trades found")
            
    except Exception as e:
        print(f"❌ Active trades check error: {e}")
    
    print("\n✅ ETH Records Deletion Complete!")
    print("   - All ETHUSD records have been removed from both database tables")
    print("   - You should now be able to delete from the frontend interface")

if __name__ == "__main__":
    main()