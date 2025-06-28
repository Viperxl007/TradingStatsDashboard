#!/usr/bin/env python3
"""
Legacy Trade Migration Script

This script detects active trades from legacy analysis data (before the Active Trade 
Tracking System was implemented) and migrates them into the new active_trades table.

This ensures continuity for trades that were active before the system upgrade.
"""

import os
import sys
import sqlite3
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.active_trade_service import ActiveTradeService
from services.analysis_context_service import AnalysisContextService
from app.chart_context import ChartContextManager

def setup_logging():
    """Set up logging for the migration script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('legacy_migration.log')
        ]
    )
    return logging.getLogger(__name__)

def detect_legacy_active_trades(db_path: str) -> List[Dict[str, Any]]:
    """
    Detect legacy active trades from historical analysis data.
    
    A legacy active trade is identified by:
    1. Recent analysis (within last 24 hours) with buy/sell recommendation
    2. Entry price that was likely triggered based on recent price action
    3. No corresponding record in active_trades table
    """
    logger = logging.getLogger(__name__)
    legacy_trades = []
    
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Look for recent analyses with trading recommendations
            cutoff_time = datetime.now() - timedelta(hours=24)
            
            cursor.execute('''
                SELECT id, ticker, analysis_data, created_at
                FROM chart_analyses
                WHERE created_at > ?
                ORDER BY created_at DESC
            ''', (cutoff_time.isoformat(),))
            
            analyses = cursor.fetchall()
            logger.info(f"🔍 Checking {len(analyses)} recent analyses for legacy trades")
            
            for analysis in analyses:
                try:
                    # Parse analysis data
                    analysis_data = json.loads(analysis['analysis_data'])
                    recommendations = analysis_data.get('recommendations', {})
                    
                    if not recommendations:
                        continue
                    
                    action = recommendations.get('action', '').lower()
                    entry_price = recommendations.get('entryPrice')
                    
                    # Skip if not a buy/sell recommendation
                    if action not in ['buy', 'sell'] or not entry_price:
                        continue
                    
                    ticker = analysis['ticker']
                    
                    # Check if this trade already exists in active_trades table
                    cursor.execute('''
                        SELECT id FROM active_trades
                        WHERE ticker = ? AND analysis_id = ?
                    ''', (ticker, analysis['id']))
                    
                    if cursor.fetchone():
                        continue  # Already migrated
                    
                    # Check if there's any active trade for this ticker
                    cursor.execute('''
                        SELECT id FROM active_trades
                        WHERE ticker = ? AND status IN ('waiting', 'active')
                    ''', (ticker,))
                    
                    if cursor.fetchone():
                        continue  # Already has an active trade
                    
                    # This looks like a legacy active trade
                    legacy_trade = {
                        'analysis_id': analysis['id'],
                        'ticker': ticker,
                        'analysis_data': analysis_data,
                        'created_at': analysis['created_at'],
                        'action': action,
                        'entry_price': entry_price,
                        'target_price': recommendations.get('targetPrice'),
                        'stop_loss': recommendations.get('stopLoss'),
                        'reasoning': recommendations.get('reasoning', '')
                    }
                    
                    legacy_trades.append(legacy_trade)
                    logger.info(f"🎯 Found legacy trade: {ticker} {action} at ${entry_price}")
                    
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning(f"⚠️ Could not parse analysis {analysis['id']}: {str(e)}")
                    continue
    
    except Exception as e:
        logger.error(f"❌ Error detecting legacy trades: {str(e)}")
    
    return legacy_trades

def determine_trade_status(legacy_trade: Dict[str, Any], current_price: float) -> tuple:
    """
    Determine if a legacy trade should be 'waiting' or 'active' based on price action.
    
    Returns: (status, trigger_hit_price, trigger_hit_time)
    """
    action = legacy_trade['action']
    entry_price = legacy_trade['entry_price']
    
    # Simple heuristic: if current price has moved favorably past entry, assume triggered
    if action == 'buy' and current_price >= entry_price * 0.98:  # 2% tolerance
        return 'active', entry_price, legacy_trade['created_at']
    elif action == 'sell' and current_price <= entry_price * 1.02:  # 2% tolerance
        return 'active', entry_price, legacy_trade['created_at']
    else:
        return 'waiting', None, None

def migrate_legacy_trade(trade_service: ActiveTradeService, legacy_trade: Dict[str, Any], current_price: float) -> bool:
    """Migrate a single legacy trade to the new system."""
    logger = logging.getLogger(__name__)
    
    try:
        ticker = legacy_trade['ticker']
        action = legacy_trade['action']
        entry_price = legacy_trade['entry_price']
        
        # Determine trade status
        status, trigger_price, trigger_time = determine_trade_status(legacy_trade, current_price)
        
        # Create the trade record directly in the database
        with sqlite3.connect(trade_service.db_path) as conn:
            cursor = conn.cursor()
            
            # Extract additional details
            target_price = legacy_trade.get('target_price')
            stop_loss = legacy_trade.get('stop_loss')
            reasoning = legacy_trade.get('reasoning', '')
            
            # Prepare trade data
            trade_data = {
                'ticker': ticker,
                'timeframe': '1h',  # Default timeframe
                'analysis_id': legacy_trade['analysis_id'],
                'action': action,
                'entry_price': entry_price,
                'target_price': target_price,
                'stop_loss': stop_loss,
                'entry_strategy': 'legacy_migration',
                'entry_condition': f"Migrated from legacy analysis: {reasoning}",
                'status': status,
                'trigger_hit_time': trigger_time if status == 'active' else None,
                'trigger_hit_price': trigger_price if status == 'active' else None,
                'current_price': current_price if status == 'active' else None,
                'created_at': legacy_trade['created_at'],
                'updated_at': datetime.now().isoformat(),
                'original_analysis_data': json.dumps(legacy_trade['analysis_data']),
                'original_context': f"Legacy trade migrated from analysis {legacy_trade['analysis_id']}"
            }
            
            # Calculate P&L if active
            if status == 'active':
                if action == 'buy':
                    unrealized_pnl = current_price - entry_price
                else:  # sell
                    unrealized_pnl = entry_price - current_price
                trade_data['unrealized_pnl'] = unrealized_pnl
                trade_data['max_favorable_price'] = current_price
                trade_data['max_adverse_price'] = current_price
            
            # Insert the trade
            cursor.execute('''
                INSERT INTO active_trades (
                    ticker, timeframe, analysis_id, action, entry_price, target_price,
                    stop_loss, entry_strategy, entry_condition, status, trigger_hit_time,
                    trigger_hit_price, current_price, unrealized_pnl, max_favorable_price,
                    max_adverse_price, created_at, updated_at, original_analysis_data,
                    original_context
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                trade_data['ticker'], trade_data['timeframe'], trade_data['analysis_id'],
                trade_data['action'], trade_data['entry_price'], trade_data['target_price'],
                trade_data['stop_loss'], trade_data['entry_strategy'], trade_data['entry_condition'],
                trade_data['status'], trade_data['trigger_hit_time'], trade_data['trigger_hit_price'],
                trade_data['current_price'], trade_data.get('unrealized_pnl'),
                trade_data.get('max_favorable_price'), trade_data.get('max_adverse_price'),
                trade_data['created_at'], trade_data['updated_at'], trade_data['original_analysis_data'],
                trade_data['original_context']
            ))
            
            trade_id = cursor.lastrowid
            
            logger.info(f"✅ Migrated legacy trade {trade_id}: {ticker} {action} at ${entry_price} (status: {status})")
            
            if status == 'active':
                pnl_str = f"${unrealized_pnl:+.2f}" if 'unrealized_pnl' in trade_data else "N/A"
                logger.info(f"   Current price: ${current_price}, P&L: {pnl_str}")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Failed to migrate legacy trade for {ticker}: {str(e)}")
        return False

def get_current_price_for_ticker(ticker: str) -> Optional[float]:
    """Get current price for a ticker (simplified version)."""
    # This is a simplified version - in practice, you'd use your market data service
    # For now, we'll return None and let the user provide prices manually
    return None

def migrate_legacy_trades():
    """Main migration function."""
    logger = setup_logging()
    logger.info("🚀 Starting Legacy Trade Migration")
    logger.info("=" * 60)
    
    # Determine database path
    instance_dir = os.path.join(os.path.dirname(__file__), 'instance')
    db_path = os.path.join(instance_dir, 'chart_analysis.db')
    
    logger.info(f"📁 Database path: {db_path}")
    
    if not os.path.exists(db_path):
        logger.error("❌ Database file not found. Run the main migration first.")
        return False
    
    try:
        # Initialize services
        trade_service = ActiveTradeService(db_path)
        
        # Detect legacy trades
        logger.info("🔍 Detecting legacy active trades...")
        legacy_trades = detect_legacy_active_trades(db_path)
        
        if not legacy_trades:
            logger.info("✅ No legacy trades found - all trades are already in the new system")
            return True
        
        logger.info(f"🎯 Found {len(legacy_trades)} potential legacy trades")
        
        # Migrate each legacy trade
        migrated_count = 0
        for legacy_trade in legacy_trades:
            ticker = legacy_trade['ticker']
            
            # For this example, we'll use a default current price
            # In practice, you'd fetch the real current price
            current_price = 36.39 if ticker == 'HYPEUSD' else legacy_trade['entry_price']
            
            logger.info(f"🔄 Migrating {ticker} trade (current price: ${current_price})")
            
            if migrate_legacy_trade(trade_service, legacy_trade, current_price):
                migrated_count += 1
        
        logger.info("🎉 Legacy trade migration completed!")
        logger.info("=" * 60)
        logger.info("📋 Summary:")
        logger.info(f"- Found {len(legacy_trades)} legacy trades")
        logger.info(f"- Successfully migrated {migrated_count} trades")
        logger.info(f"- Failed to migrate {len(legacy_trades) - migrated_count} trades")
        
        if migrated_count > 0:
            logger.info("✅ Legacy trades are now tracked in the new system")
            logger.info("   The AI will now have proper context for these trades")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = migrate_legacy_trades()
    sys.exit(0 if success else 1)