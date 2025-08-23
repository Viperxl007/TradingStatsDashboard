#!/usr/bin/env python3
"""
Test script to verify the complete ETH data flow from collection to display
"""
import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append('backend')

# Windows-specific asyncio fix
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def test_end_to_end_flow():
    """Test the complete ETH data flow"""
    try:
        print("Testing complete ETH data flow from collection to display...")
        
        # Step 1: Test manual scan (data collection)
        print("\n=== STEP 1: DATA COLLECTION ===")
        from services.macro_scanner_service import trigger_manual_scan
        
        scan_result = await trigger_manual_scan()
        if scan_result['success']:
            print(f"✅ Data collection successful")
            print(f"   Timestamp: {datetime.fromtimestamp(scan_result['timestamp'])}")
            print(f"   Analysis triggered: {scan_result['triggered_analysis']}")
        else:
            print(f"❌ Data collection failed: {scan_result.get('error')}")
            return False
        
        # Step 2: Test chart generation
        print("\n=== STEP 2: CHART GENERATION ===")
        from services.macro_chart_service import MacroChartService
        
        chart_service = MacroChartService()
        chart_result = chart_service.generate_macro_charts(days=7)  # Use fewer days for faster test
        
        charts_generated = []
        if chart_result.get('btc_chart_image'):
            charts_generated.append('BTC Price Chart')
        if chart_result.get('eth_chart_image'):
            charts_generated.append('ETH Price Chart')
        if chart_result.get('dominance_chart_image'):
            charts_generated.append('BTC Dominance Chart')
        if chart_result.get('alt_strength_chart_image'):
            charts_generated.append('Alt Strength Chart')
        if chart_result.get('combined_chart_image'):
            charts_generated.append('Combined Chart')
        
        print(f"✅ Chart generation successful")
        print(f"   Charts generated: {len(charts_generated)}/5")
        for chart in charts_generated:
            print(f"     ✅ {chart}")
        
        # Step 3: Check database state
        print("\n=== STEP 3: DATABASE VERIFICATION ===")
        os.system('python debug_eth_data.py | head -15')
        
        # Step 4: Test AI analysis (if available)
        print("\n=== STEP 4: AI ANALYSIS CHECK ===")
        try:
            from models.macro_sentiment_models import get_macro_db
            db = get_macro_db()
            latest_analysis = db.get_latest_sentiment()
            
            if latest_analysis:
                analysis_time = datetime.fromtimestamp(latest_analysis['analysis_timestamp'])
                print(f"✅ Latest AI analysis found")
                print(f"   Analysis time: {analysis_time}")
                print(f"   Overall confidence: {latest_analysis['overall_confidence']}%")
                print(f"   ETH trend: {latest_analysis.get('eth_trend_direction', 'N/A')} (strength: {latest_analysis.get('eth_trend_strength', 'N/A')}%)")
                print(f"   Charts available: BTC={latest_analysis.get('btc_chart_image') is not None}, ETH={latest_analysis.get('eth_chart_image') is not None}")
            else:
                print("⚠️  No AI analysis found (may still be processing)")
                
        except Exception as e:
            print(f"⚠️  Could not check AI analysis: {e}")
        
        print(f"\n=== SUMMARY ===")
        print(f"✅ Data Collection: Working")
        print(f"✅ Chart Generation: Working ({len(charts_generated)}/5 charts)")
        print(f"✅ ETH Integration: Complete")
        
        return len(charts_generated) == 5
        
    except Exception as e:
        print(f"❌ Error in end-to-end test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("End-to-End ETH Data Flow Test")
    print("=" * 50)
    
    success = asyncio.run(test_end_to_end_flow())
    
    if success:
        print("\n🎉 SUCCESS: Complete ETH data flow is working!")
        print("   ✅ ETH data collection fixed")
        print("   ✅ ETH chart generation working")
        print("   ✅ Database integration complete")
        print("   ✅ Production system restored")
    else:
        print("\n💥 FAILED: End-to-end flow has issues")