#!/usr/bin/env python3
"""
Analyze database for suspicious/fake data patterns
"""

import sys
import os
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

def main():
    try:
        db = get_macro_db()
        
        print('=== SEARCHING ALL MARKET DATA FOR SUSPICIOUS PATTERNS ===')
        
        # Get all data
        all_data = db.get_market_data_range(0, int(datetime.now(timezone.utc).timestamp()))
        print(f'Total data points in database: {len(all_data)}')
        
        suspicious_points = []
        test_data_points = []
        
        for i, data in enumerate(all_data):
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            btc_price = data.get('btc_price', 0)
            
            is_suspicious = False
            reasons = []
            
            # Check for exact test data values
            if btc_price == 50000:
                reasons.append('BTC price exactly $50,000 (test data)')
                is_suspicious = True
                test_data_points.append(data)
                
            if total_mcap == 2500000000000:
                reasons.append('Total market cap exactly $2.5T (test data)')
                is_suspicious = True
                test_data_points.append(data)
                
            if btc_mcap == 1000000000000:
                reasons.append('BTC market cap exactly $1T (test data)')
                is_suspicious = True
                test_data_points.append(data)
                
            # Check for calculated ratios
            if btc_mcap > 0:
                eth_btc_ratio = eth_mcap / btc_mcap
                if abs(eth_btc_ratio - 0.35) < 0.001:
                    reasons.append('ETH/BTC ratio exactly 0.35 (calculated)')
                    is_suspicious = True
                    
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                if abs(combined_ratio - 0.65) < 0.001:
                    reasons.append('(BTC+ETH)/Total ratio exactly 0.65 (calculated)')
                    is_suspicious = True
            
            if is_suspicious:
                suspicious_points.append({
                    'index': i,
                    'data': data,
                    'reasons': reasons
                })
        
        print(f'Found {len(suspicious_points)} suspicious data points')
        print(f'Found {len(test_data_points)} test data points')
        
        if suspicious_points:
            print('\n=== SUSPICIOUS DATA POINTS ===')
            for point in suspicious_points[:10]:  # Show first 10
                data = point['data']
                timestamp = data.get('timestamp', 0)
                dt = datetime.fromtimestamp(timestamp, timezone.utc) if timestamp else 'Invalid'
                print(f'Point {point["index"]}:')
                print(f'  Timestamp: {timestamp} ({dt})')
                print(f'  BTC Price: ${data.get("btc_price", 0):,.2f}')
                print(f'  BTC Market Cap: ${data.get("btc_market_cap", 0):,.0f}')
                print(f'  ETH Market Cap: ${data.get("eth_market_cap", 0):,.0f}')
                print(f'  Total Market Cap: ${data.get("total_market_cap", 0):,.0f}')
                print(f'  Data Source: {data.get("data_source", "unknown")}')
                print(f'  Reasons: {point["reasons"]}')
                print()
                
        if len(suspicious_points) > 0:
            print('🚨 FAKE DATA DETECTED IN PRODUCTION DATABASE!')
            return True
        else:
            print('✅ No suspicious patterns found in database.')
            return False
            
    except Exception as e:
        print(f'❌ Error analyzing data: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    main()