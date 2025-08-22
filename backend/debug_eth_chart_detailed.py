#!/usr/bin/env python3
"""
Detailed ETH Chart Generation Debug Script

This script performs deep debugging of the ETH chart generation process
to identify exactly where and why it's failing.
"""

import sys
import os
import logging
import traceback
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from models.macro_sentiment_models import get_macro_db
    from services.macro_chart_service import MacroChartService
    import pandas as pd
    import matplotlib.pyplot as plt
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def debug_eth_chart_generation():
    """Debug ETH chart generation step by step."""
    try:
        print("🔍 DETAILED ETH CHART GENERATION DEBUG")
        print("=" * 60)
        
        # Initialize services
        db = get_macro_db()
        chart_service = MacroChartService(db)
        
        # Step 1: Get raw market data
        print("Step 1: Getting raw market data...")
        end_timestamp = int(datetime.now(timezone.utc).timestamp())
        start_timestamp = end_timestamp - (7 * 24 * 60 * 60)  # 7 days
        
        market_data = db.get_market_data_range(start_timestamp, end_timestamp)
        print(f"   Raw market data records: {len(market_data)}")
        
        if not market_data:
            print("   ❌ No market data available")
            return False
        
        # Step 2: Convert to DataFrame
        print("Step 2: Converting to DataFrame...")
        df = pd.DataFrame(market_data)
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
        df = df.sort_values('datetime')
        print(f"   DataFrame shape: {df.shape}")
        print(f"   Columns: {list(df.columns)}")
        
        # Step 3: Check ETH price data specifically
        print("Step 3: Analyzing ETH price data...")
        if 'eth_price' not in df.columns:
            print("   ❌ eth_price column missing from DataFrame!")
            return False
        
        eth_price_stats = {
            'count': len(df),
            'null_count': df['eth_price'].isnull().sum(),
            'zero_count': (df['eth_price'] == 0).sum(),
            'min_price': df['eth_price'].min(),
            'max_price': df['eth_price'].max(),
            'mean_price': df['eth_price'].mean()
        }
        
        print(f"   ETH price statistics:")
        for key, value in eth_price_stats.items():
            print(f"     {key}: {value}")
        
        # Step 4: Data validation and cleaning
        print("Step 4: Data validation and cleaning...")
        try:
            df_cleaned = chart_service._validate_and_clean_data(df)
            print(f"   Cleaned DataFrame shape: {df_cleaned.shape}")
            print(f"   Records removed: {len(df) - len(df_cleaned)}")
            
            if len(df_cleaned) == 0:
                print("   ❌ All data was filtered out during cleaning!")
                return False
                
        except Exception as e:
            print(f"   ❌ Data cleaning failed: {e}")
            traceback.print_exc()
            return False
        
        # Step 5: Test ETH chart generation specifically
        print("Step 5: Testing ETH chart generation...")
        try:
            # Call the ETH chart generation method directly
            eth_chart_image = chart_service._generate_eth_price_chart(df_cleaned)
            
            if eth_chart_image:
                print(f"   ✅ ETH chart generated successfully!")
                print(f"   Chart image size: {len(eth_chart_image)} characters")
                return True
            else:
                print("   ❌ ETH chart generation returned None/empty")
                return False
                
        except Exception as e:
            print(f"   ❌ ETH chart generation failed with error: {e}")
            traceback.print_exc()
            return False
    
    except Exception as e:
        print(f"❌ Debug failed: {e}")
        traceback.print_exc()
        return False


def test_individual_chart_methods():
    """Test each chart generation method individually."""
    try:
        print("\n🧪 TESTING INDIVIDUAL CHART METHODS")
        print("=" * 60)
        
        # Initialize services
        db = get_macro_db()
        chart_service = MacroChartService(db)
        
        # Get sample data
        end_timestamp = int(datetime.now(timezone.utc).timestamp())
        start_timestamp = end_timestamp - (7 * 24 * 60 * 60)
        market_data = db.get_market_data_range(start_timestamp, end_timestamp)
        
        if not market_data:
            print("No data available for testing")
            return
        
        df = pd.DataFrame(market_data)
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
        df = df.sort_values('datetime')
        df_cleaned = chart_service._validate_and_clean_data(df)
        
        # Test each chart method
        chart_methods = [
            ('BTC Price Chart', '_generate_btc_price_chart'),
            ('ETH Price Chart', '_generate_eth_price_chart'),
            ('Dominance Chart', '_generate_dominance_chart'),
            ('Alt Strength Chart', '_generate_alt_strength_chart'),
            ('Combined Chart', '_generate_combined_chart')
        ]
        
        results = {}
        
        for chart_name, method_name in chart_methods:
            print(f"\nTesting {chart_name}...")
            try:
                method = getattr(chart_service, method_name)
                result = method(df_cleaned)
                
                if result:
                    print(f"   ✅ {chart_name}: SUCCESS ({len(result)} chars)")
                    results[chart_name] = True
                else:
                    print(f"   ❌ {chart_name}: FAILED (returned None/empty)")
                    results[chart_name] = False
                    
            except Exception as e:
                print(f"   ❌ {chart_name}: ERROR - {e}")
                results[chart_name] = False
                traceback.print_exc()
        
        # Summary
        print(f"\n📊 CHART GENERATION SUMMARY:")
        for chart_name, success in results.items():
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"   {chart_name}: {status}")
        
        return results
        
    except Exception as e:
        print(f"❌ Individual chart testing failed: {e}")
        traceback.print_exc()
        return {}


def main():
    """Main function."""
    print("ETH Chart Generation Detailed Debug")
    print("=" * 60)
    
    # Run detailed debug
    success = debug_eth_chart_generation()
    
    # Test individual methods
    chart_results = test_individual_chart_methods()
    
    # Final summary
    print("\n" + "=" * 60)
    print("FINAL DEBUG SUMMARY")
    print("=" * 60)
    
    if success:
        print("✅ ETH chart generation is working when called directly")
    else:
        print("❌ ETH chart generation is failing")
    
    eth_chart_success = chart_results.get('ETH Price Chart', False)
    if eth_chart_success:
        print("✅ ETH chart method works in isolation")
    else:
        print("❌ ETH chart method fails in isolation")
    
    if success and eth_chart_success:
        print("\n🤔 ETH chart generation works individually but fails in full flow")
        print("   This suggests an issue in the main generate_macro_charts() method")
    elif not success and not eth_chart_success:
        print("\n💥 ETH chart generation is fundamentally broken")
        print("   Check the _generate_eth_price_chart() method implementation")
    
    print("=" * 60)


if __name__ == "__main__":
    main()