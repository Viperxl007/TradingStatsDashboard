#!/usr/bin/env python3
"""
Generic Trade Restoration Utility

This script restores a closed trade back to active status by clearing all closure-related
fields and updating the trade status. This is useful for cases where trades were
prematurely closed due to bugs or false positives.

Usage:
    python backend/scripts/restore_trade.py --trade_id 47 --ticker XRPUSD
    python backend/scripts/restore_trade.py --trade_id 47 --ticker XRPUSD --reason "False positive closure detection"
"""

import sys
import os
import argparse
import sqlite3
import json
from datetime import datetime
import logging

# Add backend to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def restore_trade(trade_id: int, ticker: str):
    """
    Restore a closed trade back to active status
    
    Args:
        trade_id: The ID of the trade to restore
        ticker: The ticker symbol (for verification)
        
    Returns:
        bool: True if successful, False otherwise
    """
    
    db_path = os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
    
    print(f"🔄 Restoring Trade ID {trade_id} ({ticker}) to Active Status")
    print("=" * 60)
    
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Step 1: Verify trade exists and get current status
            print("1. Verifying trade exists and checking current status...")
            cursor.execute('''
                SELECT id, ticker, status, action, entry_price, target_price, stop_loss,
                       created_at, close_time, close_reason, realized_pnl, close_details,
                       trigger_hit_time, current_price, updated_at
                FROM active_trades
                WHERE id = ?
            ''', (trade_id,))
            
            trade = cursor.fetchone()
            if not trade:
                print(f"❌ Trade ID {trade_id} not found in database")
                return False
            
            print(f"   Trade ID: {trade['id']}")
            print(f"   Ticker: {trade['ticker']}")
            print(f"   Current Status: {trade['status']}")
            print(f"   Action: {trade['action']}")
            print(f"   Entry Price: ${trade['entry_price']}")
            print(f"   Target Price: ${trade['target_price']}")
            print(f"   Stop Loss: ${trade['stop_loss']}")
            print(f"   Created: {trade['created_at']}")
            print(f"   Closed: {trade['close_time']}")
            print(f"   Close Reason: {trade['close_reason']}")
            print(f"   Realized P&L: ${trade['realized_pnl'] or 0}")
            
            # Step 2: Verify ticker matches
            if trade['ticker'] != ticker:
                print(f"❌ Ticker mismatch: Trade ID {trade_id} is for {trade['ticker']}, not {ticker}")
                return False
            
            # Step 3: Check if already active
            if trade['status'] == 'active':
                print("✅ Trade is already active - no restoration needed")
                return True
            
            # Step 4: Restore trade to active status by clearing all closure fields
            print(f"\n2. Restoring trade to active status...")
            print("   Clearing all closure-related fields:")
            print("   - status: 'active'")
            print("   - close_time: NULL")
            print("   - close_reason: NULL")
            print("   - realized_pnl: NULL")
            print("   - close_details: NULL")
            print("   - updated_at: current timestamp")
            
            cursor.execute('''
                UPDATE active_trades
                SET status = 'active',
                    close_time = NULL,
                    close_reason = NULL,
                    realized_pnl = NULL,
                    close_details = NULL,
                    updated_at = ?
                WHERE id = ?
            ''', (datetime.now(), trade_id))
            
            conn.commit()
            
            # Step 5: Verify restoration was successful
            print(f"\n3. Verifying restoration...")
            cursor.execute('''
                SELECT id, ticker, status, action, entry_price, target_price, stop_loss,
                       close_time, close_reason, realized_pnl, close_details
                FROM active_trades
                WHERE id = ?
            ''', (trade_id,))
            
            restored_trade = cursor.fetchone()
            if not restored_trade:
                print("❌ Failed to verify restoration - trade not found")
                return False
            
            # Verify all closure fields are properly cleared
            success = (
                restored_trade['status'] == 'active' and
                restored_trade['close_time'] is None and
                restored_trade['close_reason'] is None and
                restored_trade['realized_pnl'] is None and
                restored_trade['close_details'] is None
            )
            
            if success:
                print("✅ Trade successfully restored to active status")
                print(f"   Trade ID: {restored_trade['id']}")
                print(f"   Ticker: {restored_trade['ticker']}")
                print(f"   Status: {restored_trade['status']}")
                print(f"   Action: {restored_trade['action']}")
                print(f"   Entry Price: ${restored_trade['entry_price']}")
                print(f"   Target Price: ${restored_trade['target_price']}")
                print(f"   Stop Loss: ${restored_trade['stop_loss']}")
                print(f"   Close Time: {restored_trade['close_time']}")
                print(f"   Close Reason: {restored_trade['close_reason']}")
                print(f"   Realized P&L: {restored_trade['realized_pnl']}")
                print(f"   Close Details: {restored_trade['close_details']}")
                
                print(f"\n🎉 Trade {trade_id} ({ticker}) has been successfully restored!")
                print(f"   ✅ All closure fields have been cleared")
                print(f"   ✅ Trade is now in true 'active' status")
                print(f"   ✅ Trade will be properly handled by the AI system")
                
                return True
            else:
                print("❌ Restoration verification failed - some fields were not properly cleared")
                print(f"   Status: {restored_trade['status']}")
                print(f"   Close Time: {restored_trade['close_time']}")
                print(f"   Close Reason: {restored_trade['close_reason']}")
                print(f"   Realized P&L: {restored_trade['realized_pnl']}")
                print(f"   Close Details: {restored_trade['close_details']}")
                return False
                
    except Exception as e:
        print(f"❌ Error restoring trade: {str(e)}")
        logger.error(f"Error restoring trade {trade_id} ({ticker}): {str(e)}")
        return False

def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(
        description='Restore a closed trade back to active status',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python backend/scripts/restore_trade.py --trade_id 47 --ticker XRPUSD
        """
    )
    
    parser.add_argument('--trade_id', type=int, required=True,
                       help='The ID of the trade to restore')
    parser.add_argument('--ticker', type=str, required=True,
                       help='The ticker symbol (for verification)')
    args = parser.parse_args()
    
    # Validate inputs
    if args.trade_id <= 0:
        print("❌ Trade ID must be a positive integer")
        sys.exit(1)
    
    if not args.ticker or len(args.ticker.strip()) == 0:
        print("❌ Ticker cannot be empty")
        sys.exit(1)
    
    # Execute restoration
    success = restore_trade(args.trade_id, args.ticker.upper())
    
    if success:
        print(f"\n✅ Restoration completed successfully!")
        sys.exit(0)
    else:
        print(f"\n❌ Restoration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()