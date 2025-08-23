#!/usr/bin/env python3
"""
Force Fresh Analysis Script

This script clears out any old poisoned data and forces a fresh analysis
with the new real CoinMarketCap data.
"""

import sys
import os
from datetime import datetime, timezone

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from models.macro_sentiment_models import MacroSentimentDatabase

def force_fresh_analysis():
    """Clear old data and force fresh analysis with new real data."""
    print("[CLEAN] Starting fresh analysis with real CoinMarketCap data...")
    
    db = MacroSentimentDatabase()
    
    # Step 1: Clear any old sentiment analysis results (keep market data)
    print("[CLEAN] Clearing old sentiment analysis results...")
    try:
        with db.db_lock:
            import sqlite3
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                
                # Delete all old sentiment analysis results
                cursor.execute('DELETE FROM macro_sentiment_analysis')
                
                # Reset analysis counters in system state
                cursor.execute('''
                    UPDATE macro_system_state 
                    SET last_analysis_id = NULL,
                        last_analysis_timestamp = NULL,
                        consecutive_analysis_failures = 0,
                        total_analyses_completed = 0,
                        updated_at = ?
                    WHERE id = 1
                ''', (int(datetime.now(timezone.utc).timestamp()),))
                
                conn.commit()
                
        print("[SUCCESS] Old sentiment analysis results cleared")
        
    except Exception as e:
        print(f"[ERROR] Failed to clear old analysis results: {e}")
        return False
    
    # Step 2: Verify we have real CoinMarketCap data
    print("[VERIFY] Checking for real CoinMarketCap data...")
    
    end_timestamp = int(datetime.now(timezone.utc).timestamp())
    start_timestamp = end_timestamp - (90 * 24 * 60 * 60)  # 90 days ago
    
    market_data = db.get_market_data_range(start_timestamp, end_timestamp)
    
    if not market_data:
        print("[ERROR] No market data found in database")
        return False
    
    # Check data quality
    cmc_data_points = [point for point in market_data if 'coinmarketcap' in point.get('data_source', '')]
    cmc_percentage = (len(cmc_data_points) / len(market_data)) * 100 if market_data else 0
    
    print(f"[INFO] Found {len(market_data)} market data points")
    print(f"[INFO] CoinMarketCap data: {cmc_percentage:.1f}%")
    print(f"[INFO] Date range: {datetime.fromtimestamp(market_data[0]['timestamp']).strftime('%Y-%m-%d')} to {datetime.fromtimestamp(market_data[-1]['timestamp']).strftime('%Y-%m-%d')}")
    
    if cmc_percentage < 50:
        print("[WARNING] Less than 50% CoinMarketCap data - may still have poisoned data")
        print("[RECOMMEND] Consider running collect_historical_data_cmc.py again")
    else:
        print("[SUCCESS] Good quality real data available")
    
    # Step 3: Force scanner to trigger fresh analysis
    print("[TRIGGER] Forcing fresh analysis...")
    
    # Update system state to trigger immediate analysis
    current_timestamp = int(datetime.now(timezone.utc).timestamp())
    updates = {
        'system_status': 'ACTIVE',
        'consecutive_failures': 0,
        'consecutive_analysis_failures': 0,
        'last_successful_scan': current_timestamp,  # Mark as if we just scanned
        'updated_at': current_timestamp
    }
    
    success = db.update_system_state(updates)
    
    if success:
        print("[SUCCESS] System state updated to trigger fresh analysis")
        print("[READY] Fresh analysis will use real CoinMarketCap data")
        print("[INFO] The next scanner run will generate new sentiment analysis")
        print("[INFO] All old poisoned analysis results have been cleared")
        return True
    else:
        print("[ERROR] Failed to update system state")
        return False

def show_data_summary():
    """Show a summary of the current data."""
    print("\n[SUMMARY] Current Data Summary:")
    
    db = MacroSentimentDatabase()
    
    # Get market data summary
    end_timestamp = int(datetime.now(timezone.utc).timestamp())
    start_timestamp = end_timestamp - (90 * 24 * 60 * 60)  # 90 days ago
    
    market_data = db.get_market_data_range(start_timestamp, end_timestamp)
    
    if market_data:
        latest = market_data[-1]
        print(f"[DATA] Market Data Points: {len(market_data)}")
        print(f"[DATA] Latest BTC Price: ${latest.get('btc_price', 0):,.2f}")
        print(f"[DATA] Latest Total Market Cap: ${latest.get('total_market_cap', 0):,.0f}")
        print(f"[DATA] Latest BTC Dominance: {latest.get('btc_dominance', 0):.2f}%")
        print(f"[DATA] Data Source: {latest.get('data_source', 'unknown')}")
        print(f"[DATA] Quality Score: {latest.get('data_quality_score', 0):.3f}")
    else:
        print("[DATA] No market data found")
    
    # Get sentiment analysis summary
    latest_sentiment = db.get_latest_sentiment()
    if latest_sentiment:
        analysis_time = datetime.fromtimestamp(latest_sentiment['analysis_timestamp'], timezone.utc)
        print(f"[ANALYSIS] Latest Analysis: {analysis_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"[ANALYSIS] Confidence: {latest_sentiment['overall_confidence']}%")
        print(f"[ANALYSIS] Market Regime: {latest_sentiment['market_regime']}")
        print(f"[ANALYSIS] Trade Permission: {latest_sentiment['trade_permission']}")
    else:
        print("[ANALYSIS] No sentiment analysis found (fresh start)")

if __name__ == "__main__":
    print("[START] Force Fresh Analysis with Real CoinMarketCap Data")
    print("=" * 60)
    
    success = force_fresh_analysis()
    
    if success:
        show_data_summary()
        print("\n[COMPLETE] Fresh analysis setup complete!")
        print("[NEXT] The scanner will now use real CoinMarketCap data for all future analysis")
        print("[NEXT] Start your Flask app to begin fresh sentiment analysis")
    else:
        print("\n[FAILED] Fresh analysis setup failed")
    
    sys.exit(0 if success else 1)