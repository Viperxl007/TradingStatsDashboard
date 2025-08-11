#!/usr/bin/env python3
"""
Debug script to analyze market data for fake/calculated values
"""

import sys
import os
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

def analyze_market_data():
    """Analyze recent market data for suspicious patterns"""
    
    try:
        db = get_macro_db()
        
        # Get recent market data
        current_time = int(datetime.now(timezone.utc).timestamp())
        recent_data = db.get_market_data_range(current_time - (7 * 24 * 60 * 60), current_time)
        
        print('=== RECENT MARKET DATA ANALYSIS ===')
        print(f'Found {len(recent_data)} recent data points')
        
        if not recent_data:
            print('No recent data found!')
            return
        
        print('\n=== LAST 10 DATA POINTS ===')
        suspicious_count = 0
        
        for i, data in enumerate(recent_data[-10:]):
            print(f'\nPoint {i+1}:')
            timestamp = data.get('timestamp', 0)
            dt = datetime.fromtimestamp(timestamp, timezone.utc) if timestamp else 'Invalid'
            print(f'  Timestamp: {timestamp} ({dt})')
            print(f'  BTC Price: ${data.get("btc_price", 0):,.2f}')
            print(f'  BTC Market Cap: ${data.get("btc_market_cap", 0):,.0f}')
            print(f'  ETH Market Cap: ${data.get("eth_market_cap", 0):,.0f}')
            print(f'  Total Market Cap: ${data.get("total_market_cap", 0):,.0f}')
            print(f'  Data Source: {data.get("data_source", "unknown")}')
            
            # Check for suspicious ratios that match the calculated values
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            
            is_suspicious = False
            
            if btc_mcap > 0:
                eth_btc_ratio = eth_mcap / btc_mcap
                print(f'  ETH/BTC Ratio: {eth_btc_ratio:.6f}')
                
                # Check if it's exactly 0.35 (the calculated ratio)
                if abs(eth_btc_ratio - 0.35) < 0.001:
                    print('  🚨 SUSPICIOUS: ETH/BTC ratio is exactly 0.35 (calculated value!)')
                    is_suspicious = True
                    
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                print(f'  (BTC+ETH)/Total Ratio: {combined_ratio:.6f}')
                
                # Check if it's exactly 0.65 (the calculated ratio)
                if abs(combined_ratio - 0.65) < 0.001:
                    print('  🚨 SUSPICIOUS: (BTC+ETH)/Total ratio is exactly 0.65 (calculated value!)')
                    is_suspicious = True
            
            # Check for other suspicious patterns
            if data.get('btc_price') == 50000:
                print('  🚨 SUSPICIOUS: BTC price is exactly $50,000 (test data value!)')
                is_suspicious = True
                
            if data.get('total_market_cap') == 2500000000000:
                print('  🚨 SUSPICIOUS: Total market cap is exactly $2.5T (test data value!)')
                is_suspicious = True
                
            if is_suspicious:
                suspicious_count += 1
                print('  ⚠️  THIS DATA POINT APPEARS TO BE FAKE/CALCULATED!')
        
        print(f'\n=== SUMMARY ===')
        print(f'Total data points analyzed: {min(10, len(recent_data))}')
        print(f'Suspicious data points found: {suspicious_count}')
        
        if suspicious_count > 0:
            print('🚨 FAKE DATA DETECTED IN PRODUCTION DATABASE!')
            print('This confirms the user\'s suspicion about wildly incorrect values.')
        else:
            print('✅ No obvious fake data patterns detected in recent data.')
            
    except Exception as e:
        print(f'❌ Error analyzing market data: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    analyze_market_data()