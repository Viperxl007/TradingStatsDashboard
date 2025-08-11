#!/usr/bin/env python3
"""
Comprehensive system status summary for macro sentiment analysis.

This script provides a complete overview of:
1. Data collection status (CoinMarketCap vs CoinGecko)
2. Bootstrap service status
3. System readiness for analysis
4. Available endpoints and how to use them
"""

import sys
import os
from datetime import datetime, timezone

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f"{title:^60}")
    print("=" * 60)

def print_section(title):
    """Print a formatted section header."""
    print(f"\n📋 {title}")
    print("-" * 40)

def check_data_migration_status():
    """Check the status of data migration from CoinGecko to CoinMarketCap."""
    print_section("DATA MIGRATION STATUS")
    
    try:
        from models.macro_sentiment_models import MacroSentimentDatabase
        
        db = MacroSentimentDatabase()
        market_data = db.get_market_data_summary()
        
        total_points = market_data.get('total_points', 0)
        quality_score = market_data.get('avg_quality', 0.0)
        date_range = market_data.get('date_range', 'N/A')
        
        print(f"✅ Total market data points: {total_points}")
        print(f"✅ Average quality score: {quality_score:.3f}")
        print(f"✅ Date range: {date_range}")
        
        # Check if we have real CoinMarketCap data (quality score should be 1.0)
        if quality_score >= 0.99:
            print("🎉 SUCCESS: Using real CoinMarketCap data (quality score ≥ 0.99)")
            data_status = "REAL_CMC_DATA"
        elif quality_score >= 0.5:
            print("⚠️  WARNING: Mixed data quality - some synthetic data present")
            data_status = "MIXED_DATA"
        else:
            print("❌ ERROR: Low quality data - likely synthetic CoinGecko data")
            data_status = "SYNTHETIC_DATA"
            
        # Check if we have sufficient data for analysis
        sufficient_data = total_points >= 80
        print(f"📊 Sufficient data for analysis: {'YES' if sufficient_data else 'NO'} ({total_points}/80 required)")
        
        return {
            'status': data_status,
            'sufficient': sufficient_data,
            'total_points': total_points,
            'quality': quality_score
        }
        
    except Exception as e:
        print(f"❌ ERROR: Could not check data status: {e}")
        return {'status': 'ERROR', 'sufficient': False}

def check_bootstrap_status():
    """Check bootstrap service status."""
    print_section("BOOTSTRAP SERVICE STATUS")
    
    try:
        from services.macro_bootstrap_service import check_bootstrap_status
        import asyncio
        
        status = asyncio.run(check_bootstrap_status())
        
        completed = status.get('completed', False)
        data_points = status.get('data_points', 0)
        message = status.get('reason', status.get('message', 'N/A'))
        
        print(f"✅ Bootstrap completed: {'YES' if completed else 'NO'}")
        print(f"✅ Data points available: {data_points}")
        print(f"✅ Status message: {message}")
        
        if completed:
            print("🎉 SUCCESS: Bootstrap service is working correctly")
        else:
            print("⚠️  WARNING: Bootstrap not completed - may affect analysis")
            
        return completed
        
    except Exception as e:
        print(f"❌ ERROR: Bootstrap check failed: {e}")
        print("🔧 FIX: Bootstrap service may have CoinGecko references causing JSON errors")
        return False

def check_scanner_status():
    """Check macro scanner service status."""
    print_section("SCANNER SERVICE STATUS")
    
    try:
        from services.macro_scanner_service import get_scanner_status
        
        status = get_scanner_status()
        
        scanner_status = status.get('status', 'unknown')
        last_scan = status.get('last_scan', 'never')
        next_scan = status.get('next_scan', 'unknown')
        
        print(f"✅ Scanner status: {scanner_status}")
        print(f"✅ Last scan: {last_scan}")
        print(f"✅ Next scan: {next_scan}")
        
        if scanner_status == 'healthy':
            print("🎉 SUCCESS: Scanner service is healthy")
            return True
        else:
            print(f"⚠️  WARNING: Scanner status is {scanner_status}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: Scanner check failed: {e}")
        return False

def check_latest_analysis():
    """Check latest sentiment analysis."""
    print_section("LATEST ANALYSIS STATUS")
    
    try:
        from models.macro_sentiment_models import MacroSentimentDatabase
        
        db = MacroSentimentDatabase()
        latest = db.get_latest_sentiment()
        
        if latest:
            analysis_time = datetime.fromtimestamp(latest['analysis_timestamp'], timezone.utc)
            hours_ago = (datetime.now(timezone.utc) - analysis_time).total_seconds() / 3600
            
            print(f"✅ Latest analysis: {analysis_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            print(f"✅ Hours ago: {hours_ago:.1f}")
            print(f"✅ Confidence: {latest['overall_confidence']}%")
            print(f"✅ Market regime: {latest['market_regime']}")
            print(f"✅ Trade permission: {latest['trade_permission']}")
            
            if hours_ago < 4:
                print("🎉 SUCCESS: Recent analysis available")
                return True
            else:
                print("⚠️  WARNING: Analysis is getting old (>4 hours)")
                return False
        else:
            print("❌ No sentiment analysis found")
            print("🔧 FIX: Run analysis endpoint to generate first analysis")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: Analysis check failed: {e}")
        return False

def show_available_endpoints():
    """Show available endpoints and how to use them."""
    print_section("AVAILABLE ENDPOINTS")
    
    print("🌐 Macro Sentiment API Endpoints:")
    print()
    print("1. GET /api/macro-sentiment/status")
    print("   - Get current sentiment and system status")
    print("   - curl http://localhost:5000/api/macro-sentiment/status")
    print()
    print("2. POST /api/macro-sentiment/analyze")
    print("   - Trigger immediate AI analysis")
    print("   - curl -X POST http://localhost:5000/api/macro-sentiment/analyze \\")
    print("          -H 'Content-Type: application/json' \\")
    print("          -d '{\"days\": 30}'")
    print()
    print("3. GET /api/macro-sentiment/history")
    print("   - Get historical sentiment data")
    print("   - curl http://localhost:5000/api/macro-sentiment/history")
    print()
    print("4. POST /api/macro-sentiment/scan")
    print("   - Trigger manual data collection scan")
    print("   - curl -X POST http://localhost:5000/api/macro-sentiment/scan")

def show_troubleshooting_guide():
    """Show troubleshooting guide."""
    print_section("TROUBLESHOOTING GUIDE")
    
    print("🔧 Common Issues and Solutions:")
    print()
    print("1. Bootstrap JSON errors:")
    print("   - Fixed: Bootstrap service now checks actual data instead of CoinGecko")
    print("   - Run: python test_analyze_endpoint.py")
    print()
    print("2. No market data:")
    print("   - Run: python collect_historical_data_cmc.py")
    print("   - Ensure CMC_API_KEY is set in local_config.py")
    print()
    print("3. Scanner not working:")
    print("   - Run: python reset_scanner_status.py")
    print("   - Check scanner service uses CoinMarketCap, not CoinGecko")
    print()
    print("4. Analysis endpoint fails:")
    print("   - Ensure Flask app is running: python app.py")
    print("   - Check CLAUDE_API_KEY is set in local_config.py")
    print("   - Verify sufficient market data (80+ points)")
    print()
    print("5. Old poisoned data:")
    print("   - Run: python force_fresh_analysis.py")
    print("   - This clears old CoinGecko synthetic data")

def show_next_steps(data_status, bootstrap_ready, scanner_ready, analysis_ready):
    """Show recommended next steps based on current status."""
    print_section("RECOMMENDED NEXT STEPS")
    
    if data_status['status'] == 'REAL_CMC_DATA' and data_status['sufficient']:
        print("🎉 Data Status: EXCELLENT - Real CoinMarketCap data available")
    elif data_status['sufficient']:
        print("⚠️  Data Status: GOOD - Sufficient data but quality could be better")
    else:
        print("❌ Data Status: POOR - Insufficient data for analysis")
        print("   → Run: python collect_historical_data_cmc.py")
        return
    
    if not bootstrap_ready:
        print("🔧 Bootstrap: NOT READY")
        print("   → Bootstrap should now work with fixed service")
        print("   → Run: python test_analyze_endpoint.py")
    else:
        print("✅ Bootstrap: READY")
    
    if not scanner_ready:
        print("🔧 Scanner: NOT READY")
        print("   → Run: python reset_scanner_status.py")
    else:
        print("✅ Scanner: READY")
    
    if not analysis_ready:
        print("🔧 Analysis: NOT READY")
        print("   → Start Flask app: python app.py")
        print("   → Test endpoint: python test_analyze_endpoint.py")
        print("   → Or trigger manually:")
        print("     curl -X POST http://localhost:5000/api/macro-sentiment/analyze \\")
        print("          -H 'Content-Type: application/json' \\")
        print("          -d '{\"days\": 30}'")
    else:
        print("✅ Analysis: READY")
    
    print()
    if all([data_status['sufficient'], bootstrap_ready, scanner_ready]):
        print("🚀 SYSTEM STATUS: READY FOR ANALYSIS!")
        print("   Your system is now using real CoinMarketCap data")
        print("   The analyze endpoint should work correctly")
        print("   Scanner will run every 4 hours automatically")
    else:
        print("⚠️  SYSTEM STATUS: NEEDS ATTENTION")
        print("   Follow the steps above to complete setup")

def main():
    """Main status check function."""
    print_header("MACRO SENTIMENT SYSTEM STATUS")
    print("🔍 Comprehensive system health check")
    print("📊 Data migration from CoinGecko → CoinMarketCap")
    print("🤖 AI analysis readiness verification")
    
    # Check all components
    data_status = check_data_migration_status()
    bootstrap_ready = check_bootstrap_status()
    scanner_ready = check_scanner_status()
    analysis_ready = check_latest_analysis()
    
    # Show available endpoints
    show_available_endpoints()
    
    # Show troubleshooting guide
    show_troubleshooting_guide()
    
    # Show next steps
    show_next_steps(data_status, bootstrap_ready, scanner_ready, analysis_ready)
    
    print_header("STATUS SUMMARY")
    print(f"📊 Data Quality: {data_status['status']} ({data_status['total_points']} points, {data_status['quality']:.3f} quality)")
    print(f"🔧 Bootstrap: {'READY' if bootstrap_ready else 'NEEDS ATTENTION'}")
    print(f"📡 Scanner: {'READY' if scanner_ready else 'NEEDS ATTENTION'}")
    print(f"🤖 Analysis: {'READY' if analysis_ready else 'NEEDS ATTENTION'}")
    
    overall_ready = all([
        data_status['sufficient'],
        bootstrap_ready,
        scanner_ready
    ])
    
    print(f"\n🚀 OVERALL STATUS: {'READY FOR ANALYSIS' if overall_ready else 'NEEDS SETUP'}")
    
    if overall_ready:
        print("\n✨ Your macro sentiment analysis system is ready!")
        print("🎯 Use the analyze endpoint to trigger immediate analysis")
        print("⏰ Scanner will automatically collect data every 4 hours")
        print("📈 All analysis now uses real CoinMarketCap data")
    else:
        print("\n🔧 Complete the recommended next steps above")
        print("📝 Then run this script again to verify readiness")

if __name__ == "__main__":
    main()