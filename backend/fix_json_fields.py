#!/usr/bin/env python3
"""
Fix invalid JSON fields in active_trades table
"""

import sqlite3
import json
import os
from pathlib import Path

def fix_json_fields():
    """Fix invalid JSON in active_trades table"""
    
    # Database path
    db_path = Path(__file__).parent / 'instance' / 'chart_analysis.db'
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return
    
    print(f"🔧 Fixing JSON fields in {db_path}")
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Get all active trades with their JSON fields
        cursor.execute("""
            SELECT id, original_context, original_analysis_data 
            FROM active_trades 
            WHERE original_context IS NOT NULL OR original_analysis_data IS NOT NULL
        """)
        
        trades = cursor.fetchall()
        fixed_count = 0
        
        for trade_id, original_context, original_analysis_data in trades:
            updates = {}
            
            # Check and fix original_context
            if original_context:
                try:
                    json.loads(original_context)
                    print(f"✅ Trade {trade_id}: original_context JSON is valid")
                except json.JSONDecodeError as e:
                    print(f"🔧 Trade {trade_id}: Fixing invalid original_context JSON")
                    print(f"   Error: {e}")
                    # Set to empty JSON object if invalid
                    updates['original_context'] = '{}'
            
            # Check and fix original_analysis_data  
            if original_analysis_data:
                try:
                    json.loads(original_analysis_data)
                    print(f"✅ Trade {trade_id}: original_analysis_data JSON is valid")
                except json.JSONDecodeError as e:
                    print(f"🔧 Trade {trade_id}: Fixing invalid original_analysis_data JSON")
                    print(f"   Error: {e}")
                    # Set to empty JSON object if invalid
                    updates['original_analysis_data'] = '{}'
            
            # Apply updates if needed
            if updates:
                update_parts = []
                params = []
                
                if 'original_context' in updates:
                    update_parts.append("original_context = ?")
                    params.append(updates['original_context'])
                
                if 'original_analysis_data' in updates:
                    update_parts.append("original_analysis_data = ?")
                    params.append(updates['original_analysis_data'])
                
                params.append(trade_id)
                
                update_sql = f"UPDATE active_trades SET {', '.join(update_parts)} WHERE id = ?"
                cursor.execute(update_sql, params)
                fixed_count += 1
                print(f"   ✅ Fixed trade {trade_id}")
        
        conn.commit()
        print(f"\n🎉 Successfully fixed {fixed_count} trades with invalid JSON")
        
        # Verify the fixes
        print("\n🔍 Verifying fixes...")
        cursor.execute("SELECT id, original_context, original_analysis_data FROM active_trades")
        all_trades = cursor.fetchall()
        
        for trade_id, original_context, original_analysis_data in all_trades:
            if original_context:
                try:
                    json.loads(original_context)
                except json.JSONDecodeError:
                    print(f"❌ Trade {trade_id} still has invalid original_context")
                    
            if original_analysis_data:
                try:
                    json.loads(original_analysis_data)
                except json.JSONDecodeError:
                    print(f"❌ Trade {trade_id} still has invalid original_analysis_data")
        
        print("✅ All JSON fields are now valid!")
        
    except Exception as e:
        print(f"❌ Error fixing JSON fields: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    fix_json_fields()