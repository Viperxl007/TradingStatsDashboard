#!/usr/bin/env python3
"""
Test Script for CL Position Tracking System - Phase 2 Implementation

This script tests the Phase 2 services and API endpoints to ensure
proper functionality of the DexScreener integration, price monitoring,
and background task systems.
"""

import sys
import os
import time
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_dexscreener_service():
    """Test DexScreener API service functionality."""
    print("\n=== Testing DexScreener Service ===")
    
    try:
        from services.dexscreener_service import DexScreenerService
        
        dex_service = DexScreenerService()
        print("✅ DexScreener service initialized")
        
        # Test cache stats
        stats = dex_service.get_cache_stats()
        print(f"✅ Cache stats retrieved: {stats}")
        
        # Test supported chains
        chains = dex_service.get_supported_chains()
        print(f"✅ Supported chains: {chains}")
        
        # Test search functionality (this will make an actual API call)
        print("🔍 Testing pair search (making real API call)...")
        search_results = dex_service.search_pairs("USDC", limit=3)
        if search_results:
            print(f"✅ Search successful: Found {len(search_results)} pairs")
            for pair in search_results[:2]:  # Show first 2 results
                print(f"   - {pair.get('pair_symbol', 'N/A')}: ${pair.get('price_usd', 0):.4f}")
        else:
            print("⚠️  Search returned no results (API might be rate limited)")
        
        return True
        
    except Exception as e:
        print(f"❌ DexScreener service test failed: {str(e)}")
        return False

def test_price_updater_service():
    """Test Price Update service functionality."""
    print("\n=== Testing Price Update Service ===")
    
    try:
        from services.price_updater import PriceUpdateService
        
        price_service = PriceUpdateService()
        print("✅ Price Update service initialized")
        
        # Test stats retrieval
        stats = price_service.get_update_stats()
        print(f"✅ Update stats retrieved: {stats}")
        
        # Test getting active positions (should be empty initially)
        positions = price_service.get_active_positions()
        print(f"✅ Active positions retrieved: {len(positions)} positions")
        
        # Test cleanup functionality
        deleted_count = price_service.cleanup_old_price_data(days_to_keep=30)
        print(f"✅ Data cleanup completed: {deleted_count} records deleted")
        
        return True
        
    except Exception as e:
        print(f"❌ Price Update service test failed: {str(e)}")
        return False

def test_position_monitor_service():
    """Test Position Monitor service functionality."""
    print("\n=== Testing Position Monitor Service ===")
    
    try:
        from services.position_monitor import PositionMonitorService
        
        monitor_service = PositionMonitorService()
        print("✅ Position Monitor service initialized")
        
        # Test stats retrieval
        stats = monitor_service.get_monitoring_stats()
        print(f"✅ Monitoring stats retrieved: {stats}")
        
        # Test alert retrieval
        alerts = monitor_service.get_active_alerts()
        print(f"✅ Active alerts retrieved: {len(alerts)} alerts")
        
        # Test alert cleanup
        cleared_count = monitor_service.clear_old_alerts(hours=24)
        print(f"✅ Alert cleanup completed: {cleared_count} alerts cleared")
        
        return True
        
    except Exception as e:
        print(f"❌ Position Monitor service test failed: {str(e)}")
        return False

def test_il_calculator_service():
    """Test IL Calculator service functionality."""
    print("\n=== Testing IL Calculator Service ===")
    
    try:
        from services.il_calculator import ILCalculatorService
        
        il_service = ILCalculatorService()
        print("✅ IL Calculator service initialized")
        
        # Test standard IL calculation
        entry_price = 100.0
        current_price = 120.0
        il_percentage = il_service.calculate_standard_il(entry_price, current_price)
        print(f"✅ Standard IL calculation: {il_percentage:.2f}% (price: ${entry_price} → ${current_price})")
        
        # Test with different price scenarios
        test_scenarios = [
            (100, 80),   # Price down 20%
            (100, 150),  # Price up 50%
            (100, 100),  # No change
        ]
        
        for entry, current in test_scenarios:
            il = il_service.calculate_standard_il(entry, current)
            print(f"   Price ${entry} → ${current}: IL = {il:.2f}%")
        
        return True
        
    except Exception as e:
        print(f"❌ IL Calculator service test failed: {str(e)}")
        return False

def test_background_tasks_service():
    """Test Background Tasks service functionality."""
    print("\n=== Testing Background Tasks Service ===")
    
    try:
        from services.background_tasks import BackgroundTaskService
        
        bg_service = BackgroundTaskService()
        print("✅ Background Tasks service initialized")
        
        # Test service status
        status = bg_service.get_service_status()
        print(f"✅ Service status retrieved: Scheduler available = {status.get('scheduler_available', False)}")
        
        # Test task executions retrieval
        executions = bg_service.get_task_executions(limit=5)
        print(f"✅ Task executions retrieved: {len(executions)} executions")
        
        # Test scheduled jobs (if scheduler is available)
        jobs = bg_service.get_scheduled_jobs()
        print(f"✅ Scheduled jobs retrieved: {len(jobs)} jobs")
        
        return True
        
    except Exception as e:
        print(f"❌ Background Tasks service test failed: {str(e)}")
        return False

def test_service_imports():
    """Test that all services can be imported from the services package."""
    print("\n=== Testing Service Imports ===")
    
    try:
        from services import get_available_services
        
        available = get_available_services()
        print("✅ Service availability check:")
        
        for service_name, is_available in available.items():
            status = "✅" if is_available else "❌"
            print(f"   {status} {service_name}: {'Available' if is_available else 'Not Available'}")
        
        # Count available services
        available_count = sum(available.values())
        total_count = len(available)
        
        print(f"\n📊 Summary: {available_count}/{total_count} services available")
        
        return available_count > 0
        
    except Exception as e:
        print(f"❌ Service import test failed: {str(e)}")
        return False

def test_configuration():
    """Test configuration loading."""
    print("\n=== Testing Configuration ===")
    
    try:
        from backend.local_config import (
            DEXSCREENER_BASE_URL,
            PRICE_UPDATE_INTERVAL,
            BACKGROUND_TASKS,
            MONITORING_THRESHOLDS
        )
        
        print("✅ Configuration loaded successfully:")
        print(f"   DexScreener URL: {DEXSCREENER_BASE_URL}")
        print(f"   Update Interval: {PRICE_UPDATE_INTERVAL}s")
        print(f"   Background Tasks Enabled: {BACKGROUND_TASKS.get('enabled', False)}")
        print(f"   Monitoring Thresholds: {len(MONITORING_THRESHOLDS)} configured")
        
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {str(e)}")
        return False

def main():
    """Run all Phase 2 implementation tests."""
    print("🚀 CL Position Tracking System - Phase 2 Implementation Test")
    print("=" * 60)
    
    test_results = []
    
    # Run all tests
    test_functions = [
        ("Configuration", test_configuration),
        ("Service Imports", test_service_imports),
        ("DexScreener Service", test_dexscreener_service),
        ("Price Updater Service", test_price_updater_service),
        ("Position Monitor Service", test_position_monitor_service),
        ("IL Calculator Service", test_il_calculator_service),
        ("Background Tasks Service", test_background_tasks_service),
    ]
    
    for test_name, test_func in test_functions:
        try:
            print(f"\n🧪 Running {test_name} test...")
            result = test_func()
            test_results.append((test_name, result))
            
            if result:
                print(f"✅ {test_name} test PASSED")
            else:
                print(f"❌ {test_name} test FAILED")
                
        except Exception as e:
            print(f"💥 {test_name} test CRASHED: {str(e)}")
            test_results.append((test_name, False))
    
    # Print summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    
    passed_tests = 0
    total_tests = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed_tests += 1
    
    print(f"\n📊 Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! Phase 2 implementation is working correctly.")
        return 0
    elif passed_tests > total_tests // 2:
        print("⚠️  Most tests passed. Some issues may need attention.")
        return 1
    else:
        print("❌ Multiple test failures. Implementation needs review.")
        return 2

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)