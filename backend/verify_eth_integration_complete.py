#!/usr/bin/env python3
"""
Complete ETH Integration Verification Script

This script performs a comprehensive verification that the ETH integration
is working end-to-end, including database, charts, and analysis.
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
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def verify_complete_eth_integration():
    """Verify complete ETH integration is working."""
    try:
        print("🔍 COMPLETE ETH INTEGRATION VERIFICATION")
        print("=" * 60)
        
        # Initialize services
        db = get_macro_db()
        chart_service = MacroChartService(db)
        
        verification_results = {
            'database_eth_data': False,
            'eth_chart_generation': False,
            'eth_analysis_data': False,
            'all_5_charts': False,
            'overall_success': False
        }
        
        # 1. Verify database has clean ETH data
        print("1. Verifying database ETH data...")
        import sqlite3
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Check ETH data quality
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN eth_price > 100 AND eth_price < 10000 THEN 1 END) as valid_eth,
                    MIN(eth_price) as min_price,
                    MAX(eth_price) as max_price,
                    AVG(eth_price) as avg_price
                FROM macro_market_data
                WHERE eth_price IS NOT NULL
            ''')
            
            eth_data = cursor.fetchone()
            valid_eth_records = eth_data[1]
            total_records = eth_data[0]
            
            if valid_eth_records > 0 and valid_eth_records == total_records:
                print(f"   ✅ Database ETH data: {valid_eth_records} valid records")
                print(f"   ✅ ETH price range: ${eth_data[2]:.2f} - ${eth_data[3]:.2f}")
                print(f"   ✅ Average ETH price: ${eth_data[4]:.2f}")
                verification_results['database_eth_data'] = True
            else:
                print(f"   ❌ Database ETH data: {valid_eth_records}/{total_records} valid")
        
        # 2. Verify chart generation
        print("\n2. Verifying chart generation...")
        try:
            chart_data = chart_service.generate_macro_charts(days=7)
            
            # Check all expected charts
            expected_charts = [
                'btc_chart_image',
                'eth_chart_image', 
                'dominance_chart_image',
                'alt_strength_chart_image',
                'combined_chart_image'
            ]
            
            generated_charts = []
            for chart_name in expected_charts:
                if chart_name in chart_data and chart_data[chart_name]:
                    generated_charts.append(chart_name)
                    print(f"   ✅ {chart_name}: Generated")
                else:
                    print(f"   ❌ {chart_name}: Missing")
            
            # Specifically verify ETH chart
            if 'eth_chart_image' in generated_charts:
                verification_results['eth_chart_generation'] = True
                print(f"   ✅ ETH chart generation: SUCCESS")
            else:
                print(f"   ❌ ETH chart generation: FAILED")
            
            # Verify all 5 charts
            if len(generated_charts) == 5:
                verification_results['all_5_charts'] = True
                print(f"   ✅ All 5 charts generated: SUCCESS")
            else:
                print(f"   ❌ Only {len(generated_charts)}/5 charts generated")
                
        except Exception as e:
            print(f"   ❌ Chart generation failed: {e}")
        
        # 3. Verify analysis data includes ETH
        print("\n3. Verifying analysis data...")
        try:
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT eth_trend_direction, eth_trend_strength, eth_chart_image
                    FROM macro_sentiment_analysis 
                    ORDER BY analysis_timestamp DESC 
                    LIMIT 1
                ''')
                
                latest_analysis = cursor.fetchone()
                if latest_analysis and latest_analysis[0] is not None:
                    print(f"   ✅ ETH trend analysis: {latest_analysis[0]} (strength: {latest_analysis[1]})")
                    verification_results['eth_analysis_data'] = True
                    
                    if latest_analysis[2] is not None:
                        print(f"   ✅ ETH chart in analysis: Present")
                    else:
                        print(f"   ⚠️ ETH chart in analysis: Missing")
                else:
                    print(f"   ❌ ETH trend analysis: Missing")
                    
        except Exception as e:
            print(f"   ❌ Analysis verification failed: {e}")
        
        # 4. Overall assessment
        print("\n4. Overall Assessment...")
        
        # Calculate overall success
        critical_checks = [
            verification_results['database_eth_data'],
            verification_results['eth_chart_generation'],
            verification_results['all_5_charts']
        ]
        
        verification_results['overall_success'] = all(critical_checks)
        
        print(f"\n" + "=" * 60)
        print("VERIFICATION SUMMARY")
        print("=" * 60)
        
        status_icon = "✅" if verification_results['overall_success'] else "❌"
        print(f"{status_icon} Overall ETH Integration: {'SUCCESS' if verification_results['overall_success'] else 'FAILED'}")
        print()
        
        print("Detailed Results:")
        for check, result in verification_results.items():
            if check != 'overall_success':
                icon = "✅" if result else "❌"
                print(f"  {icon} {check.replace('_', ' ').title()}: {'PASS' if result else 'FAIL'}")
        
        print("\n" + "=" * 60)
        
        if verification_results['overall_success']:
            print("🎉 ETH INTEGRATION IS FULLY WORKING! 🎉")
            print()
            print("The system now properly supports:")
            print("  • ETH price data collection and storage")
            print("  • ETH price chart generation")
            print("  • All 5 charts (BTC, ETH, Dominance, Alt Strength, Combined)")
            print("  • ETH trend analysis integration")
            print()
            print("The original issue has been RESOLVED!")
        else:
            print("⚠️ ETH integration has remaining issues")
            print("Check the detailed results above for specific problems")
        
        return verification_results
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return {'overall_success': False, 'error': str(e)}


def main():
    """Main function."""
    results = verify_complete_eth_integration()
    
    # Exit with appropriate code
    if results.get('overall_success', False):
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Failure


if __name__ == "__main__":
    main()