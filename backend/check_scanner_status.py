#!/usr/bin/env python3
"""
Check Scanner Status Script

This script checks the current status of the macro scanner.
"""

import sys
import os
from datetime import datetime, timezone

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from models.macro_sentiment_models import MacroSentimentDatabase

def check_scanner_status():
    """Check the current scanner status."""
    print("[CHECK] Checking Macro Sentiment Scanner Status...")
    
    db = MacroSentimentDatabase()
    system_state = db.get_system_state()
    
    if not system_state:
        print("[ERROR] No system state found")
        return False
    
    print("\n[STATUS] Current Scanner Status:")
    print(f"   Running: {system_state.get('scanner_running', 0)}")
    print(f"   Interval: {system_state.get('scan_interval_hours', 4)} hours")
    print(f"   System Status: {system_state.get('system_status', 'UNKNOWN')}")
    print(f"   Bootstrap Complete: {system_state.get('bootstrap_completed', 0)}")
    print(f"   Bootstrap Data Points: {system_state.get('bootstrap_data_points', 0)}")
    print(f"   Consecutive Failures: {system_state.get('consecutive_failures', 0)}")
    print(f"   Total Scans: {system_state.get('total_scans_completed', 0)}")
    
    # Format timestamps
    last_success = system_state.get('last_successful_scan')
    last_failure = system_state.get('last_failed_scan')
    
    if last_success:
        last_success_str = datetime.fromtimestamp(last_success, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    else:
        last_success_str = "Never"
    
    if last_failure:
        last_failure_str = datetime.fromtimestamp(last_failure, timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    else:
        last_failure_str = "Never"
    
    print(f"   Last Successful Scan: {last_success_str}")
    print(f"   Last Failed Scan: {last_failure_str}")
    
    # Determine overall status
    is_healthy = (
        system_state.get('scanner_running', 0) == 1 and
        system_state.get('system_status') == 'ACTIVE' and
        system_state.get('bootstrap_completed', 0) == 1 and
        system_state.get('consecutive_failures', 0) == 0
    )
    
    if is_healthy:
        print("\n[SUCCESS] Scanner is healthy and ready!")
    else:
        print("\n[WARNING] Scanner has issues that need attention")
    
    return is_healthy

if __name__ == "__main__":
    success = check_scanner_status()
    sys.exit(0 if success else 1)