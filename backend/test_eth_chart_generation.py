#!/usr/bin/env python3
"""
ETH Chart Generation Test Script

This script tests the ETH chart generation process to identify why
ETH charts are not being generated properly.
"""

import sys
import os
import logging
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from models.macro_sentiment_models import get_macro_db
    from services.macro_chart_service import MacroChartService
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def test_eth_chart_generation():
    """Test ETH chart generation process."""
    try:
        print("🔍 Testing ETH Chart Generation Process")
        print("=" * 50)
        
        # Initialize services
        db = get_macro_db()
        chart_service = MacroChartService(db)
        
        # Check database for ETH data
        print("1. Checking database for ETH data...")
        import sqlite3
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Check total records
            cursor.execute('SELECT COUNT(*) FROM macro_market_data')
            total_records = cursor.fetchone()[0]
            print(f"   Total market data records: {total_records}")
            
            # Check ETH price data
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN eth_price IS NULL THEN 1 END) as null_eth,
                    COUNT(CASE WHEN eth_price = 0 THEN 1 END) as zero_eth,
                    COUNT(CASE WHEN eth_price > 0 THEN 1 END) as valid_eth,
                    MIN(eth_price) as min_eth,
                    MAX(eth_price) as max_eth,
                    AVG(eth_price) as avg_eth
                FROM macro_market_data
            ''')
            
            eth_stats = cursor.fetchone()
            print(f"   ETH price statistics:")
            print(f"     - Total records: {eth_stats[0]}")
            print(f"     - NULL ETH prices: {eth_stats[1]}")
            print(f"     - Zero ETH prices: {eth_stats[2]}")
            print(f"     - Valid ETH prices: {eth_stats[3]}")
            if eth_stats[4] is not None:
                print(f"     - ETH price range: ${eth_stats[4]:.2f} - ${eth_stats[5]:.2f}")
                print(f"     - Average ETH price: ${eth_stats[6]:.2f}")
            
            # Check recent data
            cursor.execute('''
                SELECT timestamp, btc_price, eth_price, btc_dominance
                FROM macro_market_data
                ORDER BY timestamp DESC
                LIMIT 5
            ''')
            
            recent_data = cursor.fetchall()
            print(f"\n   Recent data (last 5 records):")
            for record in recent_data:
                timestamp, btc_price, eth_price, btc_dominance = record
                date_str = datetime.fromtimestamp(timestamp, timezone.utc).strftime('%Y-%m-%d %H:%M')
                print(f"     {date_str}: BTC=${btc_price:.0f}, ETH=${eth_price or 0:.0f}, Dom={btc_dominance:.1f}%")
        
        # Test chart generation
        print("\n2. Testing chart generation...")
        
        if total_records == 0:
            print("   ❌ No data available for chart generation")
            return False
        
        try:
            # Generate charts
            chart_data = chart_service.generate_macro_charts(days=7)
            
            print(f"   Chart generation results:")
            for chart_name, chart_value in chart_data.items():
                if chart_name.endswith('_chart') or chart_name.endswith('_chart_image'):
                    status = "✅ Generated" if chart_value else "❌ Failed"
                    print(f"     - {chart_name}: {status}")
            
            # Specifically check ETH chart
            eth_chart_generated = 'eth_chart_image' in chart_data and chart_data['eth_chart_image'] is not None
            
            if eth_chart_generated:
                print("\n   ✅ ETH chart generation: SUCCESS")
                return True
            else:
                print("\n   ❌ ETH chart generation: FAILED")
                print("   This indicates corrupted ETH data in the database")
                return False
                
        except Exception as e:
            print(f"   ❌ Chart generation failed with error: {e}")
            logger.exception("Chart generation error details:")
            return False
    
    except Exception as e:
        print(f"❌ Test failed: {e}")
        logger.exception("Test error details:")
        return False


def main():
    """Main function."""
    success = test_eth_chart_generation()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ ETH chart generation is working properly")
    else:
        print("❌ ETH chart generation is BROKEN")
        print("\nRecommendation: Run the emergency cleanup script:")
        print("python backend/emergency_eth_cleanup_and_refresh.py")
    print("=" * 50)


if __name__ == "__main__":
    main()