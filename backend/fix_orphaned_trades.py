#!/usr/bin/env python3
"""
Fix Orphaned Active Trades

This script identifies and handles orphaned active trade records that reference
deleted chart analyses. It provides options to either clean up the orphaned
records or restore missing analysis references.
"""

import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_orphaned_trades(db_path: str) -> List[Dict[str, Any]]:
    """Find active trades that reference non-existent chart analyses."""
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Find active trades with missing analysis references
            cursor.execute('''
                SELECT at.* 
                FROM active_trades at
                LEFT JOIN chart_analyses ca ON at.analysis_id = ca.id
                WHERE ca.id IS NULL AND at.status IN ('waiting', 'active')
            ''')
            
            orphaned_trades = []
            for row in cursor.fetchall():
                columns = [description[0] for description in cursor.description]
                trade_data = dict(zip(columns, row))
                
                # Parse JSON fields
                json_fields = ['trigger_hit_candle_data', 'original_analysis_data', 'original_context', 'close_details']
                for field in json_fields:
                    if trade_data.get(field):
                        try:
                            trade_data[field] = json.loads(trade_data[field])
                        except (json.JSONDecodeError, TypeError):
                            trade_data[field] = None
                
                orphaned_trades.append(trade_data)
            
            return orphaned_trades
            
    except Exception as e:
        logger.error(f"Error finding orphaned trades: {str(e)}")
        return []

def recreate_missing_analysis(conn, trade_data: Dict[str, Any]) -> bool:
    """Recreate a missing chart analysis from trade data."""
    try:
        cursor = conn.cursor()
        
        # Extract analysis data from the trade
        original_analysis = trade_data.get('original_analysis_data', {})
        original_context = trade_data.get('original_context', {})
        
        if not original_analysis:
            logger.warning(f"No original analysis data for trade {trade_data['id']}")
            return False
        
        # Create new analysis record
        cursor.execute('''
            INSERT INTO chart_analyses (
                ticker, timeframe, analysis_data, context_data, 
                created_at, ai_model, prompt_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            trade_data['ticker'],
            trade_data['timeframe'],
            json.dumps(original_analysis),
            json.dumps(original_context) if original_context else None,
            trade_data['created_at'],
            'claude-3-5-sonnet-20241022',  # Default model
            '1.0'  # Default version
        ))
        
        new_analysis_id = cursor.lastrowid
        
        # Update the trade to reference the new analysis
        cursor.execute('''
            UPDATE active_trades 
            SET analysis_id = ? 
            WHERE id = ?
        ''', (new_analysis_id, trade_data['id']))
        
        logger.info(f"Recreated analysis {new_analysis_id} for trade {trade_data['id']}")
        return True
        
    except Exception as e:
        logger.error(f"Error recreating analysis for trade {trade_data['id']}: {str(e)}")
        return False

def close_orphaned_trade(conn, trade_data: Dict[str, Any]) -> bool:
    """Close an orphaned trade with appropriate reason."""
    try:
        cursor = conn.cursor()
        
        close_details = {
            'reason': 'orphaned_record_cleanup',
            'message': 'Trade closed due to missing analysis reference',
            'cleanup_timestamp': datetime.now().isoformat(),
            'original_analysis_id': trade_data['analysis_id']
        }
        
        cursor.execute('''
            UPDATE active_trades 
            SET status = 'ai_closed',
                close_reason = 'orphaned_cleanup',
                close_details = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (json.dumps(close_details), trade_data['id']))
        
        logger.info(f"Closed orphaned trade {trade_data['id']} for {trade_data['ticker']}")
        return True
        
    except Exception as e:
        logger.error(f"Error closing orphaned trade {trade_data['id']}: {str(e)}")
        return False

def fix_orphaned_trades(db_path: str, action: str = 'close') -> Dict[str, int]:
    """
    Fix orphaned trades using the specified action.
    
    Args:
        db_path: Path to the database
        action: 'close' to close orphaned trades, 'recreate' to recreate missing analyses
        
    Returns:
        Dict with counts of processed trades
    """
    results = {'found': 0, 'fixed': 0, 'failed': 0}
    
    try:
        orphaned_trades = find_orphaned_trades(db_path)
        results['found'] = len(orphaned_trades)
        
        if not orphaned_trades:
            logger.info("No orphaned trades found")
            return results
        
        logger.info(f"Found {len(orphaned_trades)} orphaned trades")
        
        with sqlite3.connect(db_path) as conn:
            for trade in orphaned_trades:
                logger.info(f"Processing orphaned trade: {trade['ticker']} (ID: {trade['id']}, Analysis ID: {trade['analysis_id']})")
                
                if action == 'recreate':
                    success = recreate_missing_analysis(conn, trade)
                elif action == 'close':
                    success = close_orphaned_trade(conn, trade)
                else:
                    logger.error(f"Unknown action: {action}")
                    continue
                
                if success:
                    results['fixed'] += 1
                else:
                    results['failed'] += 1
            
            conn.commit()
        
        logger.info(f"Processed {results['found']} orphaned trades: {results['fixed']} fixed, {results['failed']} failed")
        return results
        
    except Exception as e:
        logger.error(f"Error fixing orphaned trades: {str(e)}")
        return results

def main():
    """Main function to run the orphaned trade fix."""
    import sys
    import os
    
    # Default database path
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    # Check command line arguments
    action = 'close'  # Default action
    if len(sys.argv) > 1:
        if sys.argv[1] in ['close', 'recreate']:
            action = sys.argv[1]
        else:
            print("Usage: python fix_orphaned_trades.py [close|recreate]")
            print("  close    - Close orphaned trades (default)")
            print("  recreate - Recreate missing chart analyses")
            sys.exit(1)
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found: {db_path}")
        sys.exit(1)
    
    logger.info(f"Starting orphaned trade cleanup with action: {action}")
    logger.info(f"Database: {db_path}")
    
    # First, show what we found
    orphaned_trades = find_orphaned_trades(db_path)
    if orphaned_trades:
        print(f"\nFound {len(orphaned_trades)} orphaned trades:")
        for trade in orphaned_trades:
            print(f"  - {trade['ticker']} (Trade ID: {trade['id']}, Missing Analysis ID: {trade['analysis_id']})")
            print(f"    Status: {trade['status']}, Entry: ${trade['entry_price']}")
        
        # Ask for confirmation
        response = input(f"\nProceed to {action} these orphaned trades? (y/N): ")
        if response.lower() != 'y':
            print("Operation cancelled")
            sys.exit(0)
    
    # Fix the orphaned trades
    results = fix_orphaned_trades(db_path, action)
    
    print(f"\nResults:")
    print(f"  Found: {results['found']}")
    print(f"  Fixed: {results['fixed']}")
    print(f"  Failed: {results['failed']}")

if __name__ == '__main__':
    main()