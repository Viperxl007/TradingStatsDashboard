#!/usr/bin/env python3
"""
Test script to verify ETH chart generation
"""
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append('backend')

def test_chart_generation():
    """Test the chart generation including ETH charts"""
    try:
        print("Testing chart generation including ETH charts...")
        
        # Import after path setup
        from services.macro_chart_service import MacroChartService
        
        # Initialize chart service
        chart_service = MacroChartService()
        
        print("\n=== GENERATING CHARTS ===")
        
        # Generate charts
        result = chart_service.generate_macro_charts(days=30)
        
        print(f"✅ Chart generation successful!")
        print(f"   Data period: {datetime.fromtimestamp(result['data_period_start'])} to {datetime.fromtimestamp(result['data_period_end'])}")
        print(f"   Data points: {result['data_points']}")
        print(f"   Processing time: {result['processing_time_ms']}ms")
        
        # Check which charts were generated
        charts_generated = []
        if result.get('btc_chart_image'):
            charts_generated.append('BTC Price Chart')
        if result.get('eth_chart_image'):
            charts_generated.append('ETH Price Chart')
        if result.get('dominance_chart_image'):
            charts_generated.append('BTC Dominance Chart')
        if result.get('alt_strength_chart_image'):
            charts_generated.append('Alt Strength Chart')
        if result.get('combined_chart_image'):
            charts_generated.append('Combined Chart')
        
        print(f"   Charts generated: {len(charts_generated)}/5")
        for chart in charts_generated:
            print(f"     ✅ {chart}")
        
        # Check for missing charts
        expected_charts = ['BTC Price Chart', 'ETH Price Chart', 'BTC Dominance Chart', 'Alt Strength Chart', 'Combined Chart']
        missing_charts = [chart for chart in expected_charts if chart not in charts_generated]
        
        if missing_charts:
            print(f"   Missing charts:")
            for chart in missing_charts:
                print(f"     ❌ {chart}")
        
        # Get chart summary
        print("\n=== CHART SUMMARY ===")
        summary = chart_service.get_chart_summary(days=30)
        
        if 'error' not in summary:
            print(f"   Data points: {summary['data_points']}")
            print(f"   BTC Price: ${summary['btc_price']['current']:,.2f} (change: {summary['btc_price']['change_percent']:+.1f}%)")
            print(f"   BTC Dominance: {summary['btc_dominance']['current']:.1f}% (change: {summary['btc_dominance']['change_percent']:+.1f}%)")
            print(f"   Alt Strength: {summary['alt_strength_ratio']['current']:,.0f} (change: {summary['alt_strength_ratio']['change_percent']:+.1f}%)")
        else:
            print(f"   Error getting summary: {summary['error']}")
        
        return len(charts_generated) == 5
        
    except Exception as e:
        print(f"❌ Error testing chart generation: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Chart Generation Test")
    print("=" * 50)
    
    success = test_chart_generation()
    
    if success:
        print("\n🎉 SUCCESS: All charts including ETH are being generated!")
    else:
        print("\n💥 FAILED: Chart generation has issues")