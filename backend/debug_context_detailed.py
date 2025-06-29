"""
Detailed debug script to find the exact issue in context retrieval.
"""

import sqlite3
import sys
import os
import json
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

def debug_context_service_step_by_step():
    """Debug each step of the context service"""
    
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    print("🔍 Step-by-Step Context Service Debug")
    print("=" * 50)
    
    try:
        # Step 1: Calculate lookback
        ticker = "HYPEUSD"
        current_timeframe = "1h"
        lookback_hours = 12  # From the service
        cutoff_time = datetime.utcnow() - timedelta(hours=lookback_hours)
        
        print(f"📊 Step 1 - Parameters:")
        print(f"  Ticker: {ticker}")
        print(f"  Timeframe: {current_timeframe}")
        print(f"  Lookback hours: {lookback_hours}")
        print(f"  Cutoff time: {cutoff_time}")
        
        # Step 2: Execute the exact query
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, analysis_timestamp, analysis_data, confidence_score
                FROM chart_analyses 
                WHERE ticker = ? AND analysis_timestamp >= ?
                ORDER BY analysis_timestamp DESC 
                LIMIT 1
            ''', (ticker.upper(), cutoff_time))
            
            result = cursor.fetchone()
            
        print(f"\n📊 Step 2 - Database Query:")
        if result:
            analysis_id, analysis_timestamp, analysis_data_json, confidence_score = result
            print(f"  ✅ Found result: ID {analysis_id}")
            print(f"  Timestamp: {analysis_timestamp}")
            print(f"  Confidence: {confidence_score}")
            print(f"  Analysis data length: {len(analysis_data_json) if analysis_data_json else 0}")
            print(f"  Analysis data type: {type(analysis_data_json)}")
            print(f"  Analysis data is None: {analysis_data_json is None}")
            print(f"  Analysis data is empty string: {analysis_data_json == ''}")
            
            # Step 3: Try to parse JSON
            print(f"\n📊 Step 3 - JSON Parsing:")
            if analysis_data_json:
                try:
                    analysis_data = json.loads(analysis_data_json)
                    print(f"  ✅ JSON parsed successfully")
                    print(f"  Keys in analysis_data: {list(analysis_data.keys()) if analysis_data else 'Empty dict'}")
                    print(f"  Analysis data bool: {bool(analysis_data)}")
                    
                    # Check for recommendations
                    if 'recommendations' in analysis_data:
                        recommendations = analysis_data['recommendations']
                        print(f"  Recommendations found: {recommendations}")
                    else:
                        print(f"  ❌ No 'recommendations' key found")
                        print(f"  Available keys: {list(analysis_data.keys())}")
                        
                except json.JSONDecodeError as e:
                    print(f"  ❌ JSON decode error: {str(e)}")
                    print(f"  First 200 chars: {analysis_data_json[:200]}")
            else:
                print(f"  ❌ analysis_data_json is None or empty")
                
        else:
            print(f"  ❌ No result found")
            
        # Step 4: Check what's actually in the most recent analysis
        print(f"\n📊 Step 4 - Most Recent Analysis Details:")
        cursor.execute('''
            SELECT id, analysis_timestamp, 
                   CASE WHEN analysis_data IS NULL THEN 'NULL'
                        WHEN analysis_data = '' THEN 'EMPTY_STRING'
                        ELSE 'HAS_DATA'
                   END as data_status,
                   length(analysis_data) as data_length
            FROM chart_analyses 
            WHERE ticker = ?
            ORDER BY analysis_timestamp DESC 
            LIMIT 3
        ''', (ticker.upper(),))
        
        recent_analyses = cursor.fetchall()
        for row in recent_analyses:
            print(f"  ID {row[0]}: {row[1]} - Status: {row[2]}, Length: {row[3]}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_context_service_step_by_step()