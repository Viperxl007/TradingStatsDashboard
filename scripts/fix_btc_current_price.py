#!/usr/bin/env python3
"""
Fix BTC Current Price Script

This script fixes the current_price field for the BTC trade to match the close_price,
which will fix the frontend percentage calculation.
"""

import sqlite3
import json
from datetime import datetime
import os
import sys

# Add the backend directory to the path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.append(backend_dir)

def fix_btc_current_price():
    """Fix the BTC trade current_price field"""
    
    # Database path
    db_path = os.path.join(backend_dir, 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return False
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Find the BTC trade that needs current_price fixed
            cursor.execute('''
                SELECT id, ticker, entry_price, close_price, current_price, status, close_reason
                FROM active_trades 
                WHERE ticker = 'BTCUSD' 
                AND entry_price = 118500.0
                AND close_price = 116000.0
                AND status = 'stop_hit'
                ORDER BY created_at DESC
                LIMIT 1
            ''')
            
            trade = cursor.fetchone()
            
            if not trade:
                print("❌ Could not find the BTC trade to fix")
                return False
            
            trade_id, ticker, entry_price, close_price, current_price, status, close_reason = trade
            
            print(f"🔍 Found BTC trade to fix:")
            print(f"   Trade ID: {trade_id}")
            print(f"   Entry Price: ${entry_price}")
            print(f"   Close Price: ${close_price}")
            print(f"   Current Price: ${current_price} (INCORRECT)")
            print(f"   Status: {status}")
            print(f"   Close Reason: {close_reason}")
            
            # Check if current_price needs fixing
            if current_price == close_price:
                print(f"\n✅ Current price already matches close price: ${current_price}")
                return True
            
            print(f"\n🔧 Fixing current_price:")
            print(f"   Current Price: ${current_price} → ${close_price}")
            
            # Update current_price to match close_price
            cursor.execute('''
                UPDATE active_trades
                SET 
                    current_price = ?,
                    updated_at = ?
                WHERE id = ?
            ''', (
                close_price,
                datetime.now().isoformat(),
                trade_id
            ))
            
            # Add a trade update record for the correction
            cursor.execute('''
                INSERT INTO trade_updates (trade_id, price, update_type, update_data, notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                trade_id,
                close_price,
                'current_price_fix',
                json.dumps({
                    'correction_type': 'current_price_alignment',
                    'original_current_price': current_price,
                    'corrected_current_price': close_price,
                    'reason': 'Fixed current_price to match close_price for accurate frontend percentage calculation',
                    'correction_timestamp': datetime.now().isoformat()
                }),
                'Fixed current_price field to match close_price for accurate percentage calculation'
            ))
            
            conn.commit()
            
            print(f"\n✅ BTC trade {trade_id} current_price fixed!")
            print(f"   Current Price: ${current_price} → ${close_price}")
            
            # Verify the correction
            cursor.execute('''
                SELECT current_price, close_price
                FROM active_trades 
                WHERE id = ?
            ''', (trade_id,))
            
            updated_trade = cursor.fetchone()
            if updated_trade:
                new_current_price, close_price_check = updated_trade
                print(f"\n🔍 Verification:")
                print(f"   Current Price: ${new_current_price}")
                print(f"   Close Price: ${close_price_check}")
                print(f"   Match: {'✅' if new_current_price == close_price_check else '❌'}")
                
                # Calculate expected percentage
                expected_percentage = ((close_price_check - entry_price) / entry_price) * 100
                print(f"   Expected Frontend Percentage: {expected_percentage:.2f}%")
            
            return True
            
    except Exception as e:
        print(f"❌ Error fixing BTC current_price: {str(e)}")
        return False

if __name__ == "__main__":
    print("🔧 BTC Current Price Fix Script")
    print("=" * 50)
    
    success = fix_btc_current_price()
    
    if success:
        print("\n🎉 BTC current_price fixed successfully!")
        print("   The frontend should now calculate -2.11% correctly")
        print("   Refresh the frontend to see the updated percentage")
    else:
        print("\n❌ Failed to fix BTC current_price")
        
    print("\n" + "=" * 50)