#!/usr/bin/env python3
"""
Check database status after cleanup
"""

import sys
import os
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

def main():
    try:
        db = get_macro_db()
        current_time = int(datetime.now(timezone.utc).timestamp())
        new_data = db.get_market_data_range(0, current_time)
        
        print('=== POST-CLEANUP DATABASE STATUS ===')
        print(f'Total records: {len(new_data)}')
        
        if new_data:
            print('\nCurrent data:')
            for i, data in enumerate(new_data):
                timestamp = data.get('timestamp', 0)
                dt = datetime.fromtimestamp(timestamp, timezone.utc) if timestamp else 'Invalid'
                print(f'  Record {i+1}: {dt}')
                print(f'    BTC Price: ${data.get("btc_price", 0):,.2f}')
                print(f'    Total Market Cap: ${data.get("total_market_cap", 0):,.0f}')
                print(f'    Data Source: {data.get("data_source", "unknown")}')
                
                # Check if this is real data
                btc_mcap = data.get('btc_market_cap', 0)
                eth_mcap = data.get('eth_market_cap', 0)
                total_mcap = data.get('total_market_cap', 0)
                
                if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                    combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                    if abs(combined_ratio - 0.65) < 0.001:
                        print(f'    🚨 FAKE DATA DETECTED!')
                    else:
                        print(f'    ✅ REAL DATA - Ratio: {combined_ratio:.3f}')
                print()
        else:
            print('✅ Database is completely clean (no data)')
            
    except Exception as e:
        print(f'❌ Error checking database: {e}')

if __name__ == '__main__':
    main()