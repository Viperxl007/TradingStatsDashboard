#!/usr/bin/env python3
"""
Check and restart the macro sentiment scanner if needed.
This script can be run to verify the scanner is working properly.
"""

import sys
import os
import json
from datetime import datetime, timezone

# Add backend to path
sys.path.append('backend')

def main():
    """Check scanner status and restart if needed"""
    try:
        from services.macro_scanner_service import get_scanner_status, start_scanner
        
        print("🔍 Checking Macro Sentiment Scanner Status...")
        
        # Get current status
        status = get_scanner_status()
        
        print("\n📊 Current Scanner Status:")
        print(f"   Running: {status['is_running']}")
        print(f"   Interval: {status['scan_interval_hours']} hours")
        print(f"   System Status: {status.get('system_status', 'UNKNOWN')}")
        print(f"   Bootstrap Complete: {status.get('bootstrap_completed', False)}")
        print(f"   Consecutive Failures: {status.get('consecutive_failures', 0)}")
        print(f"   Total Scans: {status.get('total_scans_completed', 0)}")
        
        # Show last scan times
        if status.get('last_successful_scan'):
            last_success = datetime.fromtimestamp(status['last_successful_scan'], timezone.utc)
            print(f"   Last Successful Scan: {last_success.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        else:
            print("   Last Successful Scan: Never")
            
        if status.get('last_failed_scan'):
            last_failure = datetime.fromtimestamp(status['last_failed_scan'], timezone.utc)
            print(f"   Last Failed Scan: {last_failure.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        # Show next scan time
        if status.get('next_scan_timestamp'):
            next_scan = datetime.fromtimestamp(status['next_scan_timestamp'], timezone.utc)
            print(f"   Next Scan: {next_scan.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            
            # Calculate time until next scan
            seconds_to_next = status.get('seconds_to_next_scan', 0)
            if seconds_to_next > 0:
                hours = seconds_to_next // 3600
                minutes = (seconds_to_next % 3600) // 60
                print(f"   Time to Next Scan: {hours}h {minutes}m")
            else:
                print("   Next Scan: Overdue")
        
        # Check if scanner should be running but isn't
        if not status['is_running'] and status.get('bootstrap_completed', False):
            print("\n⚠️  Scanner should be running but isn't. Attempting to start...")
            
            result = start_scanner()
            if result:
                print("✅ Scanner started successfully!")
                
                # Get updated status
                updated_status = get_scanner_status()
                print(f"   Updated Status: Running = {updated_status['is_running']}")
            else:
                print("❌ Failed to start scanner")
        elif status['is_running']:
            print("\n✅ Scanner is running properly!")
        elif not status.get('bootstrap_completed', False):
            print("\n⚠️  Bootstrap not completed. Scanner cannot start until bootstrap is finished.")
            print("   Run the bootstrap process first.")
        
        print(f"\n📋 Full Status JSON:")
        print(json.dumps(status, indent=2))
        
    except Exception as e:
        print(f"❌ Error checking scanner status: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()