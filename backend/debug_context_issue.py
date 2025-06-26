"""
Debug script to investigate the context retrieval issue.
"""

import sqlite3
import sys
import os
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

def debug_database_timestamps():
    """Debug the database timestamp issue"""
    
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    print("🔍 Debugging Context Retrieval Issue")
    print("=" * 50)
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check recent HYPEUSD analyses
            print("📊 Recent HYPEUSD analyses:")
            cursor.execute('''
                SELECT id, ticker, analysis_timestamp, datetime(analysis_timestamp) as readable_time 
                FROM chart_analyses 
                WHERE ticker = 'HYPEUSD' 
                ORDER BY analysis_timestamp DESC 
                LIMIT 5
            ''')
            
            results = cursor.fetchall()
            for row in results:
                print(f"  ID: {row[0]}, Ticker: {row[1]}, Timestamp: {row[2]}, Readable: {row[3]}")
            
            print("\n🕐 Current time comparison:")
            cursor.execute("SELECT datetime('now') as current_utc, datetime('now', 'localtime') as current_local")
            time_result = cursor.fetchone()
            print(f"  Database UTC: {time_result[0]}")
            print(f"  Database Local: {time_result[1]}")
            print(f"  Python UTC: {datetime.utcnow()}")
            print(f"  Python Local: {datetime.now()}")
            
            # Test the context service logic
            print("\n🧪 Testing Context Service Logic:")
            
            # Calculate 12 hours ago like the service does
            lookback_hours = 12
            cutoff_time = datetime.utcnow() - timedelta(hours=lookback_hours)
            print(f"  Lookback hours: {lookback_hours}")
            print(f"  Cutoff time (Python UTC): {cutoff_time}")
            
            # Test the exact query from the service
            cursor.execute('''
                SELECT id, analysis_timestamp, analysis_data, confidence_score
                FROM chart_analyses 
                WHERE ticker = ? AND analysis_timestamp >= ?
                ORDER BY analysis_timestamp DESC 
                LIMIT 1
            ''', ('HYPEUSD', cutoff_time))
            
            context_result = cursor.fetchone()
            if context_result:
                print(f"  ✅ Context query found: ID {context_result[0]}, Timestamp: {context_result[1]}")
            else:
                print(f"  ❌ Context query found nothing")
                
                # Let's see what happens if we query with different timestamp formats
                print("\n🔍 Testing different timestamp formats:")
                
                # Try with string format
                cutoff_str = cutoff_time.strftime('%Y-%m-%d %H:%M:%S')
                print(f"  Testing with string format: {cutoff_str}")
                cursor.execute('''
                    SELECT id, analysis_timestamp
                    FROM chart_analyses 
                    WHERE ticker = ? AND analysis_timestamp >= ?
                    ORDER BY analysis_timestamp DESC 
                    LIMIT 1
                ''', ('HYPEUSD', cutoff_str))
                
                str_result = cursor.fetchone()
                if str_result:
                    print(f"    ✅ String format found: ID {str_result[0]}")
                else:
                    print(f"    ❌ String format found nothing")
                
                # Check what the actual timestamps look like
                print("\n📅 Analyzing timestamp formats in database:")
                cursor.execute('''
                    SELECT id, analysis_timestamp, typeof(analysis_timestamp)
                    FROM chart_analyses 
                    WHERE ticker = 'HYPEUSD' 
                    ORDER BY analysis_timestamp DESC 
                    LIMIT 3
                ''')
                
                type_results = cursor.fetchall()
                for row in type_results:
                    print(f"    ID: {row[0]}, Value: {row[1]}, Type: {row[2]}")
                    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_database_timestamps()