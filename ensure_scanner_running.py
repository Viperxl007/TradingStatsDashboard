#!/usr/bin/env python3
"""
Ensure the macro sentiment scanner is running.
Run this after starting the Flask app to guarantee the scanner is active.
"""

import sys
import os
import time

# Add backend to path
sys.path.append('backend')

def ensure_scanner_running():
    """Ensure the scanner is running, start it if not"""
    try:
        from services.macro_scanner_service import get_scanner_status, start_scanner
        
        print("🔍 Checking if macro sentiment scanner is running...")
        
        # Get current status
        status = get_scanner_status()
        
        if status['is_running']:
            print("✅ Scanner is already running!")
            print(f"   Interval: {status['scan_interval_hours']} hours")
            print(f"   Total scans completed: {status.get('total_scans_completed', 0)}")
            return True
        
        # Check if bootstrap is completed
        if not status.get('bootstrap_completed', False):
            print("❌ Bootstrap not completed. Please run bootstrap first.")
            return False
        
        print("⚠️  Scanner not running. Starting now...")
        
        # Start the scanner
        result = start_scanner()
        
        if result:
            print("✅ Scanner started successfully!")
            
            # Verify it's running
            time.sleep(2)
            updated_status = get_scanner_status()
            
            if updated_status['is_running']:
                print("🎉 Scanner confirmed running!")
                print(f"   Next scan in: {updated_status['scan_interval_hours']} hours")
                return True
            else:
                print("❌ Scanner start failed - status shows not running")
                return False
        else:
            print("❌ Failed to start scanner")
            return False
            
    except Exception as e:
        print(f"❌ Error ensuring scanner is running: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Ensuring Macro Sentiment Scanner is Running...")
    print("=" * 50)
    
    success = ensure_scanner_running()
    
    print("=" * 50)
    if success:
        print("✅ Scanner is now running and will collect data every 4 hours!")
    else:
        print("❌ Scanner could not be started. Check logs for details.")
    
    print("\nTo check scanner status anytime, run: python check_scanner_status.py")