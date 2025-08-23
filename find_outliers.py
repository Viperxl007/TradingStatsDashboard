#!/usr/bin/env python3
"""
Find outlier data points causing chart spikes
"""

import sys
import os
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

def main():
    try:
        db = get_macro_db()
        
        print('=== SEARCHING FOR OUTLIER DATA POINTS ===')
        
        # Get recent data to find the outliers
        current_time = int(datetime.now(timezone.utc).timestamp())
        recent_data = db.get_market_data_range(current_time - (7 * 24 * 60 * 60), current_time)
        
        print(f'Analyzing {len(recent_data)} recent data points')
        
        outliers = []
        normal_range = []
        
        for i, data in enumerate(recent_data):
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            timestamp = data.get('timestamp', 0)
            dt = datetime.fromtimestamp(timestamp, timezone.utc) if timestamp else 'Invalid'
            
            # Calculate BTC dominance
            btc_dominance = (btc_mcap / total_mcap * 100) if total_mcap > 0 else 0
            
            # Calculate alt strength (simplified)
            alt_mcap = total_mcap - btc_mcap if total_mcap > btc_mcap else 0
            btc_price = data.get('btc_price', 0)
            alt_strength_ratio = (alt_mcap / btc_price) if btc_price > 0 else 0
            
            # Look for outliers
            is_outlier = False
            reasons = []
            
            # BTC dominance should be around 54-58% normally
            if btc_dominance > 58:
                is_outlier = True
                reasons.append(f'BTC dominance too high: {btc_dominance:.2f}%')
            elif btc_dominance < 45:
                is_outlier = True
                reasons.append(f'BTC dominance too low: {btc_dominance:.2f}%')
            
            # Alt strength ratio outliers
            if alt_strength_ratio > 15000000 or alt_strength_ratio < 8000000:
                is_outlier = True
                reasons.append(f'Alt strength ratio outlier: {alt_strength_ratio:,.0f}')
            
            if is_outlier:
                outliers.append({
                    'index': i,
                    'data': data,
                    'btc_dominance': btc_dominance,
                    'alt_strength_ratio': alt_strength_ratio,
                    'timestamp': dt,
                    'reasons': reasons
                })
            else:
                normal_range.append(btc_dominance)
        
        print(f'Found {len(outliers)} outlier data points')
        if normal_range:
            print(f'Normal BTC dominance range: {min(normal_range):.2f}% - {max(normal_range):.2f}%')
        
        if outliers:
            print('\n=== OUTLIER DATA POINTS ===')
            for outlier in outliers:
                data = outlier['data']
                print(f'Outlier {outlier["index"]}:')
                print(f'  Timestamp: {outlier["timestamp"]}')
                print(f'  BTC Price: ${data.get("btc_price", 0):,.2f}')
                print(f'  BTC Market Cap: ${data.get("btc_market_cap", 0):,.0f}')
                print(f'  ETH Market Cap: ${data.get("eth_market_cap", 0):,.0f}')
                print(f'  Total Market Cap: ${data.get("total_market_cap", 0):,.0f}')
                print(f'  BTC Dominance: {outlier["btc_dominance"]:.2f}%')
                print(f'  Alt Strength Ratio: {outlier["alt_strength_ratio"]:,.0f}')
                print(f'  Data Source: {data.get("data_source", "unknown")}')
                print(f'  Reasons: {outlier["reasons"]}')
                print()
                
            return outliers
        else:
            print('✅ No outliers found in recent data')
            return []
            
    except Exception as e:
        print(f'❌ Error finding outliers: {e}')
        import traceback
        traceback.print_exc()
        return []

if __name__ == '__main__':
    main()