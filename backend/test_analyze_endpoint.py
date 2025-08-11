#!/usr/bin/env python3
"""
Test the analyze endpoint and fix bootstrap service issues.

This script:
1. Tests the /api/macro-sentiment/analyze endpoint
2. Checks bootstrap status after fixing the service
3. Verifies the system is ready for fresh analysis
"""

import requests
import json
import sys
import os
from datetime import datetime, timezone

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

def test_analyze_endpoint():
    """Test the analyze endpoint to trigger immediate analysis."""
    print("[TEST] Testing /api/macro-sentiment/analyze endpoint...")
    
    try:
        # Test endpoint URL
        url = "http://localhost:5000/api/macro-sentiment/analyze"
        
        # Request payload
        payload = {
            "model": "claude-3-5-sonnet-20241022",  # Use the latest model
            "days": 30  # Analyze 30 days of data
        }
        
        print(f"[REQUEST] POST {url}")
        print(f"[PAYLOAD] {json.dumps(payload, indent=2)}")
        
        # Make the request
        response = requests.post(url, json=payload, timeout=120)  # 2 minute timeout
        
        print(f"[RESPONSE] Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("[SUCCESS] Analysis endpoint working!")
            
            if result.get('success'):
                data = result.get('data', {})
                print(f"[ANALYSIS] Confidence: {data.get('overall_confidence', 'N/A')}%")
                print(f"[ANALYSIS] Market Regime: {data.get('market_regime', 'N/A')}")
                print(f"[ANALYSIS] Trade Permission: {data.get('trade_permission', 'N/A')}")
                print(f"[ANALYSIS] Processing Time: {data.get('processing_time_ms', 'N/A')}ms")
                return True
            else:
                print(f"[ERROR] Analysis failed: {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"[ERROR] HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("[ERROR] Could not connect to Flask server")
        print("[INFO] Make sure your Flask app is running on http://localhost:5000")
        return False
    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out (analysis takes time)")
        print("[INFO] This is normal for the first analysis - it needs to generate charts")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False

def check_bootstrap_status():
    """Check bootstrap status using the fixed service."""
    print("\n[BOOTSTRAP] Checking bootstrap status...")
    
    try:
        from services.macro_bootstrap_service import check_bootstrap_status
        import asyncio
        
        # Check status
        status = asyncio.run(check_bootstrap_status())
        
        print(f"[BOOTSTRAP] Completed: {status.get('completed', False)}")
        print(f"[BOOTSTRAP] Data Points: {status.get('data_points', 0)}")
        print(f"[BOOTSTRAP] Earliest Date: {status.get('earliest_date', 'N/A')}")
        print(f"[BOOTSTRAP] Latest Date: {status.get('latest_date', 'N/A')}")
        print(f"[BOOTSTRAP] Message: {status.get('reason', status.get('message', 'N/A'))}")
        
        return status.get('completed', False)
        
    except Exception as e:
        print(f"[ERROR] Bootstrap status check failed: {e}")
        return False

def check_system_readiness():
    """Check if the system is ready for analysis."""
    print("\n[SYSTEM] Checking system readiness...")
    
    try:
        from models.macro_sentiment_models import MacroSentimentDatabase
        
        db = MacroSentimentDatabase()
        
        # Check market data
        market_data = db.get_market_data_summary()
        print(f"[DATA] Market data points: {market_data.get('total_points', 0)}")
        print(f"[DATA] Date range: {market_data.get('date_range', 'N/A')}")
        print(f"[DATA] Quality score: {market_data.get('avg_quality', 0.0):.3f}")
        
        # Check system state
        system_state = db.get_system_state()
        if system_state:
            print(f"[STATE] Scanner status: {system_state.get('scanner_status', 'unknown')}")
            print(f"[STATE] Last scan: {system_state.get('last_successful_scan', 'never')}")
            print(f"[STATE] Bootstrap completed: {system_state.get('bootstrap_completed', False)}")
        
        # Check if we have sufficient data for analysis
        sufficient_data = market_data.get('total_points', 0) >= 80
        print(f"[READY] Sufficient data for analysis: {sufficient_data}")
        
        return sufficient_data
        
    except Exception as e:
        print(f"[ERROR] System readiness check failed: {e}")
        return False

def main():
    """Main test function."""
    print("=" * 60)
    print("MACRO SENTIMENT ANALYSIS ENDPOINT TEST")
    print("=" * 60)
    
    # Check bootstrap status first
    bootstrap_ready = check_bootstrap_status()
    
    # Check system readiness
    system_ready = check_system_readiness()
    
    if not bootstrap_ready:
        print("\n[WARNING] Bootstrap not completed - this may affect analysis")
    
    if not system_ready:
        print("\n[WARNING] System may not be ready for analysis")
        print("[INFO] Run collect_historical_data_cmc.py first if needed")
    
    # Test the analyze endpoint
    print("\n" + "=" * 60)
    print("TESTING ANALYZE ENDPOINT")
    print("=" * 60)
    
    endpoint_success = test_analyze_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    print(f"✅ Bootstrap Status: {'READY' if bootstrap_ready else 'NOT READY'}")
    print(f"✅ System Readiness: {'READY' if system_ready else 'NOT READY'}")
    print(f"✅ Analyze Endpoint: {'WORKING' if endpoint_success else 'FAILED'}")
    
    if endpoint_success:
        print("\n🎉 SUCCESS: The analyze endpoint is working!")
        print("📝 You can trigger analysis with:")
        print("   curl -X POST http://localhost:5000/api/macro-sentiment/analyze \\")
        print("        -H 'Content-Type: application/json' \\")
        print("        -d '{\"days\": 30}'")
    else:
        print("\n❌ FAILED: The analyze endpoint is not working")
        print("🔧 Troubleshooting:")
        print("   1. Make sure Flask app is running: python app.py")
        print("   2. Check that CoinMarketCap API key is set in local_config.py")
        print("   3. Verify bootstrap service is working")
        
    if not bootstrap_ready or not system_ready:
        print("\n🔧 NEXT STEPS:")
        if not system_ready:
            print("   1. Run: python collect_historical_data_cmc.py")
        print("   2. Run: python reset_scanner_status.py")
        print("   3. Start Flask app: python app.py")
        print("   4. Test endpoint again")

if __name__ == "__main__":
    main()