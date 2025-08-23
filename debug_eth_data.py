#!/usr/bin/env python3
"""
Debug script to check ETH data in the database
"""
import sqlite3
import os
from datetime import datetime

def check_eth_data():
    db_path = os.path.join('backend', 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f'Database not found at: {db_path}')
        return
    
    print(f'Checking database at: {db_path}')
    
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Check latest market data
            print('\n=== LATEST MARKET DATA ===')
            cursor.execute('''
                SELECT timestamp, btc_price, eth_price, data_source, created_at 
                FROM macro_market_data 
                ORDER BY timestamp DESC 
                LIMIT 5
            ''')
            rows = cursor.fetchall()
            
            if not rows:
                print('No market data found in database!')
                return
                
            for row in rows:
                dt = datetime.fromtimestamp(row['timestamp'])
                created_dt = datetime.fromtimestamp(row['created_at'])
                print(f'{dt}: BTC=${row["btc_price"]:.2f}, ETH=${row["eth_price"]:.2f}, Source={row["data_source"]}, Created={created_dt}')
            
            # Check total count
            cursor.execute('SELECT COUNT(*) as count FROM macro_market_data')
            count = cursor.fetchone()['count']
            print(f'\nTotal market data records: {count}')
            
            # Check ETH price distribution
            print('\n=== ETH PRICE ANALYSIS ===')
            cursor.execute('SELECT COUNT(*) as zero_count FROM macro_market_data WHERE eth_price = 0 OR eth_price IS NULL')
            zero_count = cursor.fetchone()['zero_count']
            print(f'Records with ETH price = 0 or NULL: {zero_count}')
            
            cursor.execute('SELECT COUNT(*) as valid_count FROM macro_market_data WHERE eth_price > 0')
            valid_count = cursor.fetchone()['valid_count']
            print(f'Records with valid ETH price: {valid_count}')
            
            if valid_count > 0:
                cursor.execute('''
                    SELECT MIN(eth_price) as min_eth, MAX(eth_price) as max_eth, AVG(eth_price) as avg_eth 
                    FROM macro_market_data 
                    WHERE eth_price > 0
                ''')
                stats = cursor.fetchone()
                print(f'ETH price range: ${stats["min_eth"]:.2f} - ${stats["max_eth"]:.2f}, Avg: ${stats["avg_eth"]:.2f}')
            
            # Check system state
            print('\n=== SYSTEM STATE ===')
            cursor.execute('SELECT * FROM macro_system_state WHERE id = 1')
            state = cursor.fetchone()
            if state:
                print(f'Bootstrap completed: {state["bootstrap_completed"]}')
                print(f'Last successful scan: {datetime.fromtimestamp(state["last_successful_scan"]) if state["last_successful_scan"] else "Never"}')
                print(f'Total scans completed: {state["total_scans_completed"]}')
                print(f'System status: {state["system_status"]}')
                print(f'Scanner running: {state.get("scanner_running", "Unknown")}')
            
            # Check latest sentiment analysis
            print('\n=== LATEST SENTIMENT ANALYSIS ===')
            cursor.execute('''
                SELECT analysis_timestamp, overall_confidence, eth_trend_direction, eth_trend_strength,
                       btc_chart_image IS NOT NULL as has_btc_chart,
                       eth_chart_image IS NOT NULL as has_eth_chart,
                       dominance_chart_image IS NOT NULL as has_dominance_chart,
                       alt_strength_chart_image IS NOT NULL as has_alt_chart
                FROM macro_sentiment_analysis 
                ORDER BY analysis_timestamp DESC 
                LIMIT 1
            ''')
            analysis = cursor.fetchone()
            if analysis:
                dt = datetime.fromtimestamp(analysis['analysis_timestamp'])
                print(f'Latest analysis: {dt}')
                print(f'Overall confidence: {analysis["overall_confidence"]}%')
                print(f'ETH trend: {analysis["eth_trend_direction"]} (strength: {analysis["eth_trend_strength"]}%)')
                print(f'Charts available: BTC={analysis["has_btc_chart"]}, ETH={analysis["has_eth_chart"]}, Dominance={analysis["has_dominance_chart"]}, Alt={analysis["has_alt_chart"]}')
            else:
                print('No sentiment analysis found!')
                
    except Exception as e:
        print(f'Error checking database: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_eth_data()