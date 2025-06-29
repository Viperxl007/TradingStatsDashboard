"""
Active Trade Service

This service manages the complete lifecycle of active trades, ensuring proper state tracking
from trigger hit through trade completion. It maintains trade context across chart reads
and provides comprehensive trade status information to the AI.
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
import sqlite3
import os
from threading import Lock
from enum import Enum

logger = logging.getLogger(__name__)

class TradeStatus(Enum):
    """Trade status enumeration"""
    WAITING = "waiting"           # Waiting for entry trigger
    ACTIVE = "active"            # Trade is active/open
    PROFIT_HIT = "profit_hit"    # Closed via profit target
    STOP_HIT = "stop_hit"        # Closed via stop loss
    AI_CLOSED = "ai_closed"      # Closed by AI recommendation
    USER_CLOSED = "user_closed"  # Closed by user override
    EXPIRED = "expired"          # Expired without trigger

class TradeCloseReason(Enum):
    """Reasons for trade closure"""
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    AI_EARLY_CLOSE = "ai_early_close"
    USER_OVERRIDE = "user_override"
    MARKET_STRUCTURE_CHANGE = "market_structure_change"
    TREND_INVALIDATION = "trend_invalidation"
    EXPIRATION = "expiration"

class ActiveTradeService:
    """Service for managing active trade lifecycle and state"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize with database path"""
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
        self.db_lock = Lock()
        self._ensure_active_trades_table()
    
    def _ensure_active_trades_table(self):
        """Ensure the active_trades table exists with proper schema"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create active_trades table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS active_trades (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker TEXT NOT NULL,
                        timeframe TEXT NOT NULL,
                        analysis_id INTEGER NOT NULL,
                        
                        -- Trade Setup
                        action TEXT NOT NULL,  -- buy/sell
                        entry_price REAL NOT NULL,
                        target_price REAL,
                        stop_loss REAL,
                        entry_strategy TEXT,
                        entry_condition TEXT,
                        
                        -- Trade Status
                        status TEXT NOT NULL DEFAULT 'waiting',  -- waiting/active/closed
                        
                        -- Trigger Information
                        trigger_hit_time DATETIME,
                        trigger_hit_price REAL,
                        trigger_hit_candle_data TEXT,
                        
                        -- Trade Progress
                        current_price REAL,
                        unrealized_pnl REAL,
                        max_favorable_price REAL,
                        max_adverse_price REAL,
                        
                        -- Close Information
                        close_time DATETIME,
                        close_price REAL,
                        close_reason TEXT,
                        close_details TEXT,
                        realized_pnl REAL,
                        
                        -- Metadata
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        
                        -- Original Analysis Context
                        original_analysis_data TEXT,
                        original_context TEXT,
                        
                        FOREIGN KEY (analysis_id) REFERENCES chart_analyses (id)
                    )
                ''')
                
                # Create indexes
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_active_trades_ticker_status
                    ON active_trades(ticker, status)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_active_trades_status
                    ON active_trades(status)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_active_trades_created
                    ON active_trades(created_at)
                ''')
                
                # Create trade_updates table for tracking trade progress
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS trade_updates (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        trade_id INTEGER NOT NULL,
                        update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                        price REAL NOT NULL,
                        update_type TEXT NOT NULL,  -- price_update/trigger_check/ai_assessment
                        update_data TEXT,
                        notes TEXT,
                        
                        FOREIGN KEY (trade_id) REFERENCES active_trades (id)
                    )
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_trade_updates_trade_id
                    ON trade_updates(trade_id, update_time)
                ''')
                
                conn.commit()
                logger.info("Active trades database schema ensured")
                
        except Exception as e:
            logger.error(f"Error ensuring active trades table: {str(e)}")
            raise
    
    def create_trade_from_analysis(self, ticker: str, timeframe: str, analysis_id: int,
                                 analysis_data: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Optional[int]:
        """
        Create a new active trade from analysis data.
        
        Args:
            ticker: Stock ticker symbol
            timeframe: Chart timeframe
            analysis_id: ID of the analysis that created this trade
            analysis_data: Full analysis data
            context: Context data from previous analysis
            
        Returns:
            Trade ID if created, None if no valid trade recommendation found
        """
        try:
            # Extract trade recommendation from analysis
            recommendations = analysis_data.get('recommendations', {})
            action = recommendations.get('action', '').lower()
            
            # Only create trades for buy/sell actions
            if action not in ['buy', 'sell']:
                logger.info(f"No trade created for {ticker}: action is '{action}' (not buy/sell)")
                return None
            
            entry_price = recommendations.get('entryPrice')
            target_price = recommendations.get('targetPrice')
            stop_loss = recommendations.get('stopLoss')
            
            if not entry_price:
                logger.warning(f"No entry price found in recommendations for {ticker}")
                return None
            
            # Extract entry strategy details
            detailed_analysis = analysis_data.get('detailedAnalysis', {})
            trading_analysis = detailed_analysis.get('tradingAnalysis', {})
            entry_strategies = trading_analysis.get('entry_strategies', [])
            
            # Find primary entry strategy
            primary_strategy = None
            if entry_strategies:
                for strategy in entry_strategies:
                    if strategy.get('entry_price') == entry_price:
                        primary_strategy = strategy
                        break
                if not primary_strategy:
                    primary_strategy = entry_strategies[0]
            
            entry_strategy = primary_strategy.get('strategy_type', 'unknown') if primary_strategy else 'unknown'
            entry_condition = primary_strategy.get('entry_condition', 'No condition specified') if primary_strategy else 'No condition specified'
            
            # Determine initial status based on trigger status from context
            initial_status = TradeStatus.WAITING.value
            trigger_hit_time = None
            trigger_hit_price = None
            trigger_hit_candle_data = None
            
            # Check if trigger was already hit (from context service)
            if context and context.get('trigger_hit'):
                initial_status = TradeStatus.ACTIVE.value
                trigger_details = context.get('trigger_details', {})
                trigger_hit_time = trigger_details.get('trigger_time')
                trigger_hit_price = trigger_details.get('trigger_price')
                trigger_hit_candle_data = json.dumps(trigger_details.get('candle_data', {}))
                logger.info(f"🎯 Creating ACTIVE trade for {ticker}: trigger was hit at ${trigger_hit_price}")
            else:
                logger.info(f"⏳ Creating WAITING trade for {ticker}: waiting for trigger at ${entry_price}")
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Check if there's already an active trade for this ticker
                    cursor.execute('''
                        SELECT id, status FROM active_trades
                        WHERE ticker = ? AND status IN ('waiting', 'active')
                        ORDER BY created_at DESC LIMIT 1
                    ''', (ticker.upper(),))
                    
                    existing_trade = cursor.fetchone()
                    if existing_trade:
                        existing_id, existing_status = existing_trade
                        logger.info(f"🔄 Existing {existing_status} trade found for {ticker} (ID: {existing_id}). Returning existing trade instead of creating duplicate.")
                        return existing_id
                    
                    # Insert new trade (only if no existing active trade)
                    cursor.execute('''
                        INSERT INTO active_trades (
                            ticker, timeframe, analysis_id, action, entry_price, target_price, stop_loss,
                            entry_strategy, entry_condition, status, trigger_hit_time, trigger_hit_price,
                            trigger_hit_candle_data, current_price, original_analysis_data, original_context
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        ticker.upper(),
                        timeframe,
                        analysis_id,
                        action,
                        entry_price,
                        target_price,
                        stop_loss,
                        entry_strategy,
                        entry_condition,
                        initial_status,
                        trigger_hit_time,
                        trigger_hit_price,
                        trigger_hit_candle_data,
                        analysis_data.get('currentPrice', 0.0),
                        json.dumps(analysis_data),
                        json.dumps(context) if context else None
                    ))
                    
                    trade_id = cursor.lastrowid
                    conn.commit()
                    
                    # Add initial trade update
                    self._add_trade_update(cursor, trade_id, analysis_data.get('currentPrice', 0.0), 
                                         'trade_created', {'initial_status': initial_status})
                    conn.commit()
                    
                    logger.info(f"✅ Created {initial_status} trade for {ticker} (ID: {trade_id})")
                    return trade_id
                    
        except Exception as e:
            logger.error(f"Error creating trade for {ticker}: {str(e)}")
            return None
    
    def get_active_trade(self, ticker: str, timeframe: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the current active trade for a ticker.
        
        Args:
            ticker: Stock ticker symbol
            timeframe: Optional timeframe filter
            
        Returns:
            Active trade data or None if no active trade
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                query = '''
                    SELECT * FROM active_trades
                    WHERE ticker = ? AND status IN ('waiting', 'active')
                '''
                params = [ticker.upper()]
                
                if timeframe:
                    query += ' AND timeframe = ?'
                    params.append(timeframe)
                
                query += ' ORDER BY created_at DESC LIMIT 1'
                
                cursor.execute(query, params)
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                # Convert row to dict
                columns = [description[0] for description in cursor.description]
                trade_data = dict(zip(columns, row))
                
                # Parse JSON fields with enhanced error handling for legacy data
                json_fields = ['trigger_hit_candle_data', 'original_analysis_data', 'original_context', 'close_details']
                
                for field in json_fields:
                    if trade_data.get(field):
                        # Check if field is empty string or None
                        if trade_data[field] in ('', None):
                            trade_data[field] = None
                            continue
                            
                        try:
                            trade_data[field] = json.loads(trade_data[field])
                        except (json.JSONDecodeError, TypeError) as e:
                            logger.warning(f"⚠️ Could not parse JSON field '{field}' for trade {trade_data.get('id', 'unknown')}: {str(e)}")
                            # For legacy data compatibility, set to None instead of keeping as string
                            trade_data[field] = None
                
                return trade_data
                
        except Exception as e:
            logger.error(f"Error getting active trade for {ticker}: {str(e)}")
            return None
    
    def update_trade_trigger(self, ticker: str, trigger_details: Dict[str, Any]) -> bool:
        """
        Update trade when trigger is hit.
        
        Args:
            ticker: Stock ticker symbol
            trigger_details: Details about the trigger hit
            
        Returns:
            True if trade was updated, False otherwise
        """
        try:
            trade = self.get_active_trade(ticker)
            if not trade:
                logger.warning(f"No active trade found for {ticker} to update trigger")
                return False
            
            if trade['status'] != TradeStatus.WAITING.value:
                logger.warning(f"Trade for {ticker} is not in waiting status (current: {trade['status']})")
                return False
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Update trade to active status
                    cursor.execute('''
                        UPDATE active_trades
                        SET status = ?, trigger_hit_time = ?, trigger_hit_price = ?,
                            trigger_hit_candle_data = ?, updated_at = ?
                        WHERE id = ?
                    ''', (
                        TradeStatus.ACTIVE.value,
                        trigger_details.get('trigger_time'),
                        trigger_details.get('trigger_price'),
                        json.dumps(trigger_details.get('candle_data', {})),
                        datetime.now(),
                        trade['id']
                    ))
                    
                    # Add trade update
                    self._add_trade_update(cursor, trade['id'], trigger_details.get('trigger_price', 0.0),
                                         'trigger_hit', trigger_details)
                    
                    conn.commit()
                    
                    logger.info(f"🎯 Updated trade {trade['id']} for {ticker}: trigger hit at ${trigger_details.get('trigger_price')}")
                    return True
                    
        except Exception as e:
            logger.error(f"Error updating trade trigger for {ticker}: {str(e)}")
            return False
    
    def update_trade_progress(self, ticker: str, current_price: float, 
                            additional_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Update trade progress with current price and check for exit conditions.
        
        Args:
            ticker: Stock ticker symbol
            current_price: Current market price
            additional_data: Additional data to store with update
            
        Returns:
            Trade status update information or None if no active trade
        """
        try:
            trade = self.get_active_trade(ticker)
            if not trade:
                return None
            
            # Calculate progress metrics
            entry_price = trade['entry_price']
            target_price = trade.get('target_price')
            stop_loss = trade.get('stop_loss')
            action = trade['action']
            
            # Calculate unrealized P&L
            if action == 'buy':
                unrealized_pnl = current_price - entry_price if trade['status'] == TradeStatus.ACTIVE.value else 0
            else:  # sell
                unrealized_pnl = entry_price - current_price if trade['status'] == TradeStatus.ACTIVE.value else 0
            
            # Update max favorable/adverse prices
            max_favorable = trade.get('max_favorable_price') or entry_price
            max_adverse = trade.get('max_adverse_price') or entry_price
            
            if action == 'buy':
                max_favorable = max(max_favorable or entry_price, current_price)
                max_adverse = min(max_adverse or entry_price, current_price)
            else:  # sell
                max_favorable = min(max_favorable or entry_price, current_price)
                max_adverse = max(max_adverse or entry_price, current_price)
            
            # Check for exit conditions
            exit_triggered = False
            exit_reason = None
            exit_details = {}
            
            if trade['status'] == TradeStatus.ACTIVE.value:
                if target_price and ((action == 'buy' and current_price >= target_price) or 
                                   (action == 'sell' and current_price <= target_price)):
                    exit_triggered = True
                    exit_reason = TradeCloseReason.PROFIT_TARGET.value
                    exit_details = {'target_price': target_price, 'achieved_price': current_price}
                    
                elif stop_loss and ((action == 'buy' and current_price <= stop_loss) or 
                                  (action == 'sell' and current_price >= stop_loss)):
                    exit_triggered = True
                    exit_reason = TradeCloseReason.STOP_LOSS.value
                    exit_details = {'stop_loss': stop_loss, 'hit_price': current_price}
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Update trade progress
                    if exit_triggered:
                        # Close the trade
                        cursor.execute('''
                            UPDATE active_trades
                            SET current_price = ?, unrealized_pnl = ?, max_favorable_price = ?,
                                max_adverse_price = ?, status = ?, close_time = ?, close_price = ?,
                                close_reason = ?, close_details = ?, realized_pnl = ?, updated_at = ?
                            WHERE id = ?
                        ''', (
                            current_price, 0, max_favorable, max_adverse,
                            TradeStatus.PROFIT_HIT.value if exit_reason == TradeCloseReason.PROFIT_TARGET.value else TradeStatus.STOP_HIT.value,
                            datetime.now(), current_price, exit_reason, json.dumps(exit_details),
                            unrealized_pnl, datetime.now(), trade['id']
                        ))
                        
                        # Add trade update
                        self._add_trade_update(cursor, trade['id'], current_price, 'trade_closed', 
                                             {**exit_details, 'reason': exit_reason, 'pnl': unrealized_pnl})
                        
                        logger.info(f"🎯 Trade {trade['id']} for {ticker} closed: {exit_reason} at ${current_price}")
                        
                    else:
                        # Update progress
                        cursor.execute('''
                            UPDATE active_trades
                            SET current_price = ?, unrealized_pnl = ?, max_favorable_price = ?,
                                max_adverse_price = ?, updated_at = ?
                            WHERE id = ?
                        ''', (
                            current_price, unrealized_pnl, max_favorable, max_adverse,
                            datetime.now(), trade['id']
                        ))
                        
                        # Add trade update
                        update_data = {'unrealized_pnl': unrealized_pnl, 'max_favorable': max_favorable, 'max_adverse': max_adverse}
                        if additional_data:
                            update_data.update(additional_data)
                        
                        self._add_trade_update(cursor, trade['id'], current_price, 'price_update', update_data)
                    
                    conn.commit()
                    
                    return {
                        'trade_id': trade['id'],
                        'status': trade['status'],
                        'exit_triggered': exit_triggered,
                        'exit_reason': exit_reason,
                        'current_price': current_price,
                        'unrealized_pnl': unrealized_pnl,
                        'max_favorable_price': max_favorable,
                        'max_adverse_price': max_adverse
                    }
                    
        except Exception as e:
            logger.error(f"Error updating trade progress for {ticker}: {str(e)}")
            return None
    
    def close_trade_by_ai(self, ticker: str, reason: str, details: Dict[str, Any], 
                         current_price: float) -> bool:
        """
        Close trade based on AI recommendation.
        
        Args:
            ticker: Stock ticker symbol
            reason: Reason for closure
            details: Additional details about the closure
            current_price: Current market price
            
        Returns:
            True if trade was closed, False otherwise
        """
        try:
            trade = self.get_active_trade(ticker)
            if not trade or trade['status'] not in [TradeStatus.WAITING.value, TradeStatus.ACTIVE.value]:
                logger.warning(f"No active trade found for {ticker} to close")
                return False
            
            # Calculate final P&L
            entry_price = trade['entry_price']
            action = trade['action']
            
            if trade['status'] == TradeStatus.ACTIVE.value:
                if action == 'buy':
                    realized_pnl = current_price - entry_price
                else:  # sell
                    realized_pnl = entry_price - current_price
            else:
                realized_pnl = 0  # No P&L if trade was never triggered
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        UPDATE active_trades
                        SET status = ?, close_time = ?, close_price = ?, close_reason = ?,
                            close_details = ?, realized_pnl = ?, current_price = ?, updated_at = ?
                        WHERE id = ?
                    ''', (
                        TradeStatus.AI_CLOSED.value,
                        datetime.now(),
                        current_price,
                        TradeCloseReason.AI_EARLY_CLOSE.value,
                        json.dumps({'reason': reason, **details}),
                        realized_pnl,
                        current_price,
                        datetime.now(),
                        trade['id']
                    ))
                    
                    # Add trade update
                    self._add_trade_update(cursor, trade['id'], current_price, 'ai_closed',
                                         {'reason': reason, 'details': details, 'pnl': realized_pnl})
                    
                    conn.commit()
                    
                    logger.info(f"🤖 AI closed trade {trade['id']} for {ticker}: {reason}")
                    return True
                    
        except Exception as e:
            logger.error(f"Error closing trade by AI for {ticker}: {str(e)}")
            return False
    
    def close_trade_by_user(self, ticker: str, current_price: float, notes: str = "") -> bool:
        """
        Close trade based on user override.
        
        Args:
            ticker: Stock ticker symbol
            current_price: Current market price
            notes: User notes about the closure
            
        Returns:
            True if trade was closed, False otherwise
        """
        try:
            trade = self.get_active_trade(ticker)
            if not trade or trade['status'] not in [TradeStatus.WAITING.value, TradeStatus.ACTIVE.value]:
                logger.warning(f"No active trade found for {ticker} to close")
                return False
            
            # Calculate final P&L
            entry_price = trade['entry_price']
            action = trade['action']
            
            if trade['status'] == TradeStatus.ACTIVE.value:
                if action == 'buy':
                    realized_pnl = current_price - entry_price
                else:  # sell
                    realized_pnl = entry_price - current_price
            else:
                realized_pnl = 0  # No P&L if trade was never triggered
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        UPDATE active_trades
                        SET status = ?, close_time = ?, close_price = ?, close_reason = ?,
                            close_details = ?, realized_pnl = ?, current_price = ?, updated_at = ?
                        WHERE id = ?
                    ''', (
                        TradeStatus.USER_CLOSED.value,
                        datetime.now(),
                        current_price,
                        TradeCloseReason.USER_OVERRIDE.value,
                        json.dumps({'notes': notes}),
                        realized_pnl,
                        current_price,
                        datetime.now(),
                        trade['id']
                    ))
                    
                    # Add trade update
                    self._add_trade_update(cursor, trade['id'], current_price, 'user_closed',
                                         {'notes': notes, 'pnl': realized_pnl})
                    
                    conn.commit()
                    
                    logger.info(f"👤 User closed trade {trade['id']} for {ticker}")
                    return True
                    
        except Exception as e:
            logger.error(f"Error closing trade by user for {ticker}: {str(e)}")
            return False
    
    def get_trade_context_for_ai(self, ticker: str, current_price: float) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive trade context for AI analysis.
        
        Args:
            ticker: Stock ticker symbol
            current_price: Current market price
            
        Returns:
            Trade context data for AI or None if no active trade
        """
        try:
            trade = self.get_active_trade(ticker)
            if not trade:
                return None
            
            # Update trade progress with current price
            progress = self.update_trade_progress(ticker, current_price)
            
            # Refresh trade data after update
            trade = self.get_active_trade(ticker)
            if not trade:
                return None
            
            # Calculate time since trade creation and trigger
            created_time = datetime.fromisoformat(trade['created_at'])
            time_since_creation = (datetime.now() - created_time).total_seconds() / 3600
            
            trigger_time = None
            time_since_trigger = None
            if trade.get('trigger_hit_time'):
                trigger_time = datetime.fromisoformat(trade['trigger_hit_time'])
                time_since_trigger = (datetime.now() - trigger_time).total_seconds() / 3600
            
            # Build comprehensive context
            context = {
                'has_active_trade': True,
                'trade_id': trade['id'],
                'status': trade['status'],
                'action': trade['action'],
                'entry_price': trade['entry_price'],
                'target_price': trade.get('target_price'),
                'stop_loss': trade.get('stop_loss'),
                'entry_strategy': trade.get('entry_strategy'),
                'entry_condition': trade.get('entry_condition'),
                'current_price': current_price,
                'time_since_creation_hours': time_since_creation,
                'time_since_trigger_hours': time_since_trigger,
                'trigger_hit_time': trade.get('trigger_hit_time'),
                'trigger_hit_price': trade.get('trigger_hit_price'),
                'unrealized_pnl': trade.get('unrealized_pnl', 0),
                'max_favorable_price': trade.get('max_favorable_price'),
                'max_adverse_price': trade.get('max_adverse_price'),
                'original_analysis_id': trade['analysis_id']
            }
            
            # Add status-specific information
            if trade['status'] == TradeStatus.WAITING.value:
                context['trade_message'] = f"WAITING FOR ENTRY: {trade['action'].upper()} at ${trade['entry_price']} (created {time_since_creation:.1f}h ago)"
                context['ai_instruction'] = "ACKNOWLEDGE WAITING TRADE: You must acknowledge this waiting trade and assess if the entry condition should still be maintained or modified."
                
            elif trade['status'] == TradeStatus.ACTIVE.value:
                pnl_text = f"${trade.get('unrealized_pnl', 0):.2f}" if trade.get('unrealized_pnl') else "N/A"
                context['trade_message'] = f"ACTIVE TRADE: {trade['action'].upper()} at ${trade['entry_price']} (triggered {time_since_trigger:.1f}h ago, P&L: {pnl_text})"
                context['ai_instruction'] = "ACKNOWLEDGE ACTIVE TRADE: You must acknowledge this active trade and assess its current status. You may suggest early closure ONLY for overwhelming technical reasons."
            
            return context
            
        except Exception as e:
            logger.error(f"Error getting trade context for {ticker}: {str(e)}")
            return None
    
    def _add_trade_update(self, cursor, trade_id: int, price: float, update_type: str, 
                         update_data: Optional[Dict[str, Any]] = None, notes: str = ""):
        """Add a trade update record"""
        cursor.execute('''
            INSERT INTO trade_updates (trade_id, price, update_type, update_data, notes)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            trade_id,
            price,
            update_type,
            json.dumps(update_data) if update_data else None,
            notes
        ))
    
    def get_trade_history(self, ticker: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get trade history for a ticker"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM active_trades
                    WHERE ticker = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                ''', (ticker.upper(), limit))
                
                trades = []
                for row in cursor.fetchall():
                    columns = [description[0] for description in cursor.description]
                    trade_data = dict(zip(columns, row))
                    
                    # Parse JSON fields with enhanced error handling for legacy data
                    json_fields = ['trigger_hit_candle_data', 'original_analysis_data', 'original_context', 'close_details']
                    
                    for field in json_fields:
                        if trade_data.get(field):
                            # Check if field is empty string or None
                            if trade_data[field] in ('', None):
                                trade_data[field] = None
                                continue
                                
                            try:
                                trade_data[field] = json.loads(trade_data[field])
                            except (json.JSONDecodeError, TypeError) as e:
                                logger.warning(f"⚠️ Could not parse JSON field '{field}' in trade history: {str(e)}")
                                trade_data[field] = None
                    
                    trades.append(trade_data)
                
                return trades
                
        except Exception as e:
            logger.error(f"Error getting trade history for {ticker}: {str(e)}")
            return []
    
    def cleanup_old_trades(self, days_to_keep: int = 90) -> int:
        """Clean up old closed trades"""
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cutoff_date = datetime.now() - timedelta(days=days_to_keep)
                    
                    # Delete old closed trades
                    cursor.execute('''
                        DELETE FROM active_trades
                        WHERE status NOT IN ('waiting', 'active') AND created_at < ?
                    ''', (cutoff_date,))
                    
                    deleted_count = cursor.rowcount
                    
                    # Delete associated trade updates
                    cursor.execute('''
                        DELETE FROM trade_updates
                        WHERE trade_id NOT IN (SELECT id FROM active_trades)
                    ''')
                    
                    conn.commit()
                    
                    logger.info(f"Cleaned up {deleted_count} old trades older than {days_to_keep} days")
                    return deleted_count
                    
        except Exception as e:
            logger.error(f"Error cleaning up old trades: {str(e)}")
    
    def has_active_trades_for_analysis(self, analysis_id: int) -> bool:
        """
        Check if there are any active trades referencing a specific analysis ID.
        
        Args:
            analysis_id (int): The analysis ID to check
            
        Returns:
            bool: True if there are active trades referencing this analysis
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT COUNT(*) FROM active_trades 
                    WHERE analysis_id = ? AND status IN ('waiting', 'active')
                ''', (analysis_id,))
                
                count = cursor.fetchone()[0]
                return count > 0
                
        except Exception as e:
            logger.error(f"Error checking active trades for analysis {analysis_id}: {str(e)}")
            return False
    
    def has_active_trades_for_analyses(self, analysis_ids: List[int]) -> Dict[int, bool]:
        """
        Check if there are any active trades referencing multiple analysis IDs.
        
        Args:
            analysis_ids (List[int]): List of analysis IDs to check
            
        Returns:
            Dict[int, bool]: Mapping of analysis_id to whether it has active trades
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create placeholders for the IN clause
                placeholders = ','.join('?' * len(analysis_ids))
                
                cursor.execute(f'''
                    SELECT analysis_id, COUNT(*) FROM active_trades 
                    WHERE analysis_id IN ({placeholders}) AND status IN ('waiting', 'active')
                    GROUP BY analysis_id
                ''', analysis_ids)
                
                # Create result dict with all IDs defaulting to False
                result = {aid: False for aid in analysis_ids}
                
                # Update with actual counts
                for analysis_id, count in cursor.fetchall():
                    result[analysis_id] = count > 0
                
                return result
                
        except Exception as e:
            logger.error(f"Error checking active trades for analyses {analysis_ids}: {str(e)}")
            return {aid: False for aid in analysis_ids}
    
    def get_analyses_safe_to_delete(self, analysis_ids: List[int]) -> List[int]:
        """
        Get list of analysis IDs that are safe to delete (no active trades).
        
        Args:
            analysis_ids (List[int]): List of analysis IDs to check
            
        Returns:
            List[int]: Analysis IDs that can be safely deleted
        """
        active_trades_map = self.has_active_trades_for_analyses(analysis_ids)
        return [aid for aid, has_active in active_trades_map.items() if not has_active]