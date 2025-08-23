#!/usr/bin/env python3
"""
Start and monitor the macro sentiment scanner service.
"""

import sys
import os
import time
import json
from datetime import datetime, timezone

# Add backend to path
sys.path.append('backend')

from services.macro_scanner_service import get_scanner, start_scanner, get_scanner_status
from models.macro_sentiment_models import get_macro_db

def get_latest_market_data():
    """Get the most recent market data entry"""
    try:
        db = get_macro_db()
        
        # Use the market data range method to get the latest entry
        current_time = int(datetime.now(timezone.utc).timestamp())
        # Get data from last 24 hours
        start_time = current_time - (24 * 60 * 60)
        
        data = db.get_market_data_range(start_time, current_time)
        
        if data:
            # Return the most recent entry
            return data[-1]
        else:
            return None
            
    except Exception as e:
        print(f"Error getting latest market data: {e}")
        return None

def main():
    """Main function to start and monitor the scanner"""
    print("🚀 Starting Macro Sentiment Scanner...")
    
    # Check current status
    status = get_scanner_status()
    print(f"Current scanner status: {status['is_running']}")
    
    # Start scanner if not running
    if not status['is_running']:
        print("Starting scanner...")
        result = start_scanner()
        print(f"Scanner start result: {result}")
        
        if result:
            print("✅ Scanner started successfully!")
            
            # Wait a moment for initial scan
            print("Waiting for initial scan to complete...")
            time.sleep(15)
            
            # Check status again
            status = get_scanner_status()
            print("\nUpdated Scanner Status:")
            print(json.dumps(status, indent=2))
            
            # Check for latest data
            print("\nChecking for latest market data...")
            latest_data = get_latest_market_data()
            
            if latest_data:
                timestamp = latest_data['timestamp']
                dt = datetime.fromtimestamp(timestamp, timezone.utc)
                print(f"✅ Latest data found:")
                print(f"   Timestamp: {timestamp} ({dt.strftime('%Y-%m-%d %H:%M:%S UTC')})")
                print(f"   BTC Price: ${latest_data['btc_price']:,.2f}")
                print(f"   BTC Dominance: {latest_data['btc_dominance']:.2f}%")
                print(f"   Alt Strength: {latest_data['alt_strength_ratio']:,.0f}")
            else:
                print("❌ No recent market data found")
                
        else:
            print("❌ Failed to start scanner")
    else:
        print("✅ Scanner is already running")
    
    print("\n🎉 Macro scanner setup complete!")
    print("The scanner will now collect data every 4 hours automatically.")

if __name__ == "__main__":
    main()