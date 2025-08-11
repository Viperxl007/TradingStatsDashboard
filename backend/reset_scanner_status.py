#!/usr/bin/env python3
"""
Reset Scanner Status Script

This script resets the macro scanner status to mark bootstrap as complete
since we've already collected historical data using CoinMarketCap.
"""

import sys
import os
from datetime import datetime, timezone

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from models.macro_sentiment_models import MacroSentimentDatabase

def reset_scanner_status():
    """Reset the scanner status to mark bootstrap as complete."""
    print("[RESET] Resetting macro scanner status...")
    
    db = MacroSentimentDatabase()
    
    # Get current timestamp
    current_timestamp = int(datetime.now(timezone.utc).timestamp())
    
    # Reset system state to mark bootstrap as complete and clear errors
    updates = {
        'bootstrap_completed': True,
        'bootstrap_completed_at': current_timestamp,
        'bootstrap_data_points': 91,  # We collected 91 data points
        'bootstrap_errors': None,
        'system_status': 'ACTIVE',
        'consecutive_failures': 0,
        'last_failed_scan': None,
        'scanner_running': True,
        'updated_at': current_timestamp
    }
    
    success = db.update_system_state(updates)
    
    if success:
        print("[SUCCESS] Scanner status reset successfully!")
        print("[INFO] Bootstrap marked as complete with 91 data points")
        print("[INFO] System status set to ACTIVE")
        print("[INFO] Consecutive failures reset to 0")
        print("[READY] Scanner is ready to collect ongoing data with CoinMarketCap")
    else:
        print("[ERROR] Failed to reset scanner status")
        return False
    
    return True

if __name__ == "__main__":
    success = reset_scanner_status()
    sys.exit(0 if success else 1)