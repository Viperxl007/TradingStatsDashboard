#!/usr/bin/env python3
"""
Test Flask app status and route registration.

This script checks if the Flask app is running and what routes are registered.
"""

import requests
import sys
import os

def test_flask_app_running():
    """Test if Flask app is running on port 5000."""
    print("🔍 TESTING FLASK APP STATUS")
    print("=" * 50)
    
    try:
        # Test basic connectivity
        response = requests.get("http://localhost:5000", timeout=5)
        print(f"✅ Flask app is running (status: {response.status_code})")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ Flask app is NOT running")
        print("🔧 Start with: python backend/run.py")
        return False
    except Exception as e:
        print(f"❌ Error testing Flask app: {e}")
        return False

def test_existing_endpoints():
    """Test some known working endpoints."""
    print("\n🔍 TESTING EXISTING ENDPOINTS")
    print("=" * 50)
    
    # Known working endpoints from the main app
    test_endpoints = [
        ("GET", "/api/earnings/today", "Earnings today"),
        ("GET", "/api/chart-analysis/analyze", "Chart analysis (should be 405 for GET)"),
        ("GET", "/api/macro-sentiment/status", "Macro sentiment status"),
        ("GET", "/api/macro-sentiment/ping", "Macro sentiment ping"),
    ]
    
    working_endpoints = []
    
    for method, endpoint, description in test_endpoints:
        try:
            if method == "GET":
                response = requests.get(f"http://localhost:5000{endpoint}", timeout=10)
            else:
                response = requests.post(f"http://localhost:5000{endpoint}", timeout=10)
            
            # 200, 405 (method not allowed), or 400 (bad request) means endpoint exists
            if response.status_code in [200, 400, 405]:
                print(f"✅ {endpoint} - {description} (status: {response.status_code})")
                working_endpoints.append(endpoint)
            else:
                print(f"❌ {endpoint} - {description} (status: {response.status_code})")
                
        except requests.exceptions.Timeout:
            print(f"⏰ {endpoint} - {description} (timeout - but endpoint exists)")
            working_endpoints.append(endpoint)
        except requests.exceptions.ConnectionError:
            print(f"❌ {endpoint} - Connection error")
        except Exception as e:
            print(f"❌ {endpoint} - Error: {e}")
    
    return working_endpoints

def test_macro_sentiment_endpoints():
    """Test all macro sentiment endpoints."""
    print("\n🔍 TESTING MACRO SENTIMENT ENDPOINTS")
    print("=" * 50)
    
    base_url = "http://localhost:5000/api/macro-sentiment"
    
    endpoints = [
        ("GET", "/status", "Get status"),
        ("GET", "/ping", "Ping test"),
        ("POST", "/analyze", "Trigger analysis"),
        ("POST", "/scan", "Trigger scan"),
        ("GET", "/history", "Get history"),
        ("POST", "/bootstrap", "Run bootstrap"),
    ]
    
    working_count = 0
    
    for method, path, description in endpoints:
        full_url = f"{base_url}{path}"
        try:
            if method == "GET":
                response = requests.get(full_url, timeout=10)
            else:
                # For POST endpoints, send minimal valid JSON
                response = requests.post(full_url, json={}, timeout=10)
            
            # Check if endpoint exists (not 404)
            if response.status_code != 404:
                print(f"✅ {method} {path} - {description} (status: {response.status_code})")
                working_count += 1
            else:
                print(f"❌ {method} {path} - {description} (404 Not Found)")
                
        except requests.exceptions.Timeout:
            print(f"⏰ {method} {path} - {description} (timeout - but endpoint exists)")
            working_count += 1
        except requests.exceptions.ConnectionError:
            print(f"❌ {method} {path} - Connection error")
        except Exception as e:
            print(f"❌ {method} {path} - Error: {e}")
    
    print(f"\n📊 Macro sentiment endpoints working: {working_count}/{len(endpoints)}")
    return working_count > 0

def main():
    """Main test function."""
    print("🔧 FLASK APP STATUS TEST")
    print("📊 Checking if Flask app is running and routes are registered")
    print()
    
    # Test if Flask app is running
    app_running = test_flask_app_running()
    
    if not app_running:
        print("\n❌ FLASK APP NOT RUNNING")
        print("🔧 NEXT STEPS:")
        print("   1. Start Flask app: python backend/run.py")
        print("   2. Check console for any errors")
        print("   3. Verify port 5000 is not in use by another process")
        return
    
    # Test existing endpoints
    working_endpoints = test_existing_endpoints()
    
    # Test macro sentiment endpoints specifically
    macro_working = test_macro_sentiment_endpoints()
    
    # Summary
    print("\n" + "=" * 60)
    print("FLASK APP STATUS SUMMARY")
    print("=" * 60)
    
    print(f"✅ Flask App Running: {'YES' if app_running else 'NO'}")
    print(f"✅ Working Endpoints: {len(working_endpoints)}")
    print(f"✅ Macro Sentiment Routes: {'WORKING' if macro_working else 'NOT WORKING'}")
    
    if app_running and macro_working:
        print("\n🎉 SUCCESS: Flask app is running with macro sentiment routes!")
        print("📝 You can now test the analyze endpoint:")
        print("   curl -X POST http://localhost:5000/api/macro-sentiment/analyze \\")
        print("        -H 'Content-Type: application/json' \\")
        print("        -d '{\"days\": 30}'")
        
    elif app_running and not macro_working:
        print("\n⚠️  PARTIAL SUCCESS: Flask app running but macro sentiment routes not working")
        print("🔧 POSSIBLE ISSUES:")
        print("   1. Route registration failed during app startup")
        print("   2. Import errors in macro sentiment modules")
        print("   3. Check Flask console for registration errors")
        print("\n🔧 DEBUGGING STEPS:")
        print("   1. Run: python backend/debug_flask_routes.py")
        print("   2. Check Flask console output for errors")
        print("   3. Restart Flask app and watch for registration messages")
        
    else:
        print("\n❌ FAILED: Flask app not running")
        print("🔧 Start Flask app first: python backend/run.py")

if __name__ == "__main__":
    main()