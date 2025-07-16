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
    
    def _safe_parse_datetime(self, datetime_str):
        """Safely parse datetime string with validation"""
        if not datetime_str or not isinstance(datetime_str, str):
            return None
        try:
            return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid datetime format: {datetime_str}, error: {e}")
            return None

    def _check_historical_exit_conditions(self, ticker: str, trade: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Check historical candles for profit target or stop loss hits since last analysis.
        Implements 'first hit wins' logic for precise exit timing.
        
        Args:
            ticker: Stock ticker symbol
            trade: Active trade data
            
        Returns:
            Exit result dict if exit condition found, None otherwise
        """
        try:
            # CRITICAL FIX: Protect newly created trades from premature closure
            # Only check historical exit conditions for trades that have been active for a reasonable time
            created_time = self._safe_parse_datetime(trade.get('created_at'))
            if not created_time:
                logger.debug(f"Invalid created_at timestamp for trade {trade.get('id')}, skipping historical check")
                return None
            
            # Grace period: Don't check historical exits for trades created within the last 5 minutes
            # This prevents immediate closure due to stale price data or timing issues
            time_since_creation = (datetime.now() - created_time).total_seconds() / 60  # minutes
            if time_since_creation < 5:
                logger.debug(f"🛡️ Trade {trade['id']} created {time_since_creation:.1f} minutes ago - skipping historical check (grace period)")
                return None
            
            # CRITICAL: For ACTIVE trades, use trigger hit time as the baseline, not last analysis time
            # For WAITING trades, this method should not be called, but if it is, use creation time
            if trade['status'] == TradeStatus.ACTIVE.value and trade.get('trigger_hit_time'):
                baseline_time = self._safe_parse_datetime(trade['trigger_hit_time'])
                baseline_description = "trigger hit time"
            else:
                # Fallback to creation time for safety
                baseline_time = created_time
                baseline_description = "trade creation time"
            
            if not baseline_time:
                logger.debug(f"No valid baseline time found for trade {trade['id']}, skipping historical check")
                return None
            
            logger.info(f"🔍 Checking historical data since {baseline_description}: {baseline_time}")
            
            # Use the existing market data infrastructure to get historical candles
            historical_candles = self._fetch_historical_candles_since_analysis(ticker, baseline_time)
            
            if not historical_candles:
                logger.debug(f"No historical candles found for {ticker} since {baseline_time}")
                return None
            
            # Extract trade parameters
            entry_price = float(trade['entry_price'])
            target_price = trade.get('target_price')
            stop_loss = trade.get('stop_loss')
            action = trade['action'].upper()
            
            if not target_price and not stop_loss:
                logger.debug(f"Trade {trade['id']} has no target_price or stop_loss to check")
                return None
            
            target_price = float(target_price) if target_price else None
            stop_loss = float(stop_loss) if stop_loss else None
            
            logger.info(f"🔍 Checking {len(historical_candles)} historical candles for {ticker} trade {trade['id']}")
            logger.info(f"🔍 Entry: ${entry_price}, Target: ${target_price}, Stop: ${stop_loss}, Action: {action}")
            
            # CRITICAL FIX: Only check candles that occurred AFTER the trade became active
            # Filter out any candles that occurred before the baseline time to prevent false exits
            valid_candles = []
            baseline_timestamp = baseline_time.timestamp()
            
            for candle in historical_candles:
                candle_time = candle.get('timestamp')
                if isinstance(candle_time, str):
                    parsed_time = self._safe_parse_datetime(candle_time)
                    if parsed_time:
                        candle_timestamp = parsed_time.timestamp()
                    else:
                        continue
                else:
                    candle_timestamp = float(candle_time)
                
                # Only include candles AFTER the baseline time
                if candle_timestamp > baseline_timestamp:
                    valid_candles.append(candle)
            
            if not valid_candles:
                logger.debug(f"No valid candles found after {baseline_description} for trade {trade['id']}")
                return None
            
            logger.info(f"🔍 Checking {len(valid_candles)} valid candles (filtered from {len(historical_candles)} total) for trade {trade['id']}")
            
            # Check each candle chronologically for first hit (FIRST HIT WINS)
            for candle in sorted(valid_candles, key=lambda x: x['timestamp']):
                candle_time = candle['timestamp']
                high_price = float(candle['high'])
                low_price = float(candle['low'])
                
                # Check for exit conditions based on trade direction
                if action == 'BUY':
                    # For BUY trades: profit target hit when price goes UP, stop loss when price goes DOWN
                    target_hit = target_price and high_price >= target_price
                    stop_hit = stop_loss and low_price <= stop_loss
                    
                    if target_hit and stop_hit:
                        # Both hit in same candle - stop loss takes precedence for risk management
                        logger.warning(f"🚨 Both target and stop hit in same candle for {ticker} at {candle_time}")
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    elif target_hit:
                        exit_price = target_price
                        exit_reason = "PROFIT_TARGET_HIT"
                        exit_type = "WIN"
                    elif stop_hit:
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    else:
                        continue  # No exit condition in this candle
                        
                elif action == 'SELL':
                    # For SELL trades: profit target hit when price goes DOWN, stop loss when price goes UP
                    target_hit = target_price and low_price <= target_price
                    stop_hit = stop_loss and high_price >= stop_loss
                    
                    if target_hit and stop_hit:
                        # Both hit in same candle - stop loss takes precedence
                        logger.warning(f"🚨 Both target and stop hit in same candle for {ticker} at {candle_time}")
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    elif target_hit:
                        exit_price = target_price
                        exit_reason = "PROFIT_TARGET_HIT"
                        exit_type = "WIN"
                    elif stop_hit:
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    else:
                        continue  # No exit condition in this candle
                
                # Exit condition found - close the trade
                logger.info(f"🎯 Historical exit detected for {ticker} trade {trade['id']}")
                logger.info(f"🎯 Exit: {exit_reason} at ${exit_price} on {candle_time}")
                
                # Close the trade with historical timing
                self._close_trade_with_exit(
                    trade_id=trade['id'],
                    exit_price=exit_price,
                    exit_reason=exit_reason,
                    exit_type=exit_type,
                    exit_time=candle_time.isoformat()
                )
                
                return {
                    'exit_triggered': True,
                    'exit_reason': exit_reason,
                    'exit_price': exit_price,
                    'exit_time': candle_time,
                    'exit_type': exit_type
                }
            
            # No exit conditions found in historical data
            logger.debug(f"No historical exit conditions found for {ticker} trade {trade['id']}")
            return None
            
            if not candles:
                logger.debug(f"No historical candles found for {ticker} since {last_analysis_time}")
                return None
            
            # Extract trade parameters
            entry_price = float(trade['entry_price'])
            target_price = trade.get('target_price')
            stop_loss = trade.get('stop_loss')
            action = trade['action'].upper()
            
            if not target_price and not stop_loss:
                logger.debug(f"Trade {trade['id']} has no target_price or stop_loss to check")
                return None
            
            target_price = float(target_price) if target_price else None
            stop_loss = float(stop_loss) if stop_loss else None
            
            logger.info(f"🔍 Checking {len(candles)} historical candles for {ticker} trade {trade['id']}")
            logger.info(f"🔍 Entry: ${entry_price}, Target: ${target_price}, Stop: ${stop_loss}, Action: {action}")
            
            # Check each candle chronologically for first hit
            for candle in sorted(candles, key=lambda x: x['timestamp']):
                candle_time = candle['timestamp']
                high_price = float(candle['high'])
                low_price = float(candle['low'])
                
                # Check for exit conditions based on trade direction
                if action == 'BUY':
                    # For BUY trades: profit target hit when price goes UP, stop loss when price goes DOWN
                    target_hit = target_price and high_price >= target_price
                    stop_hit = stop_loss and low_price <= stop_loss
                    
                    if target_hit and stop_hit:
                        # Both hit in same candle - determine which happened first
                        # In practice, we assume stop loss takes precedence for risk management
                        logger.warning(f"🚨 Both target and stop hit in same candle for {ticker} at {candle_time}")
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    elif target_hit:
                        exit_price = target_price
                        exit_reason = "PROFIT_TARGET_HIT"
                        exit_type = "WIN"
                    elif stop_hit:
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    else:
                        continue  # No exit condition in this candle
                        
                elif action == 'SELL':
                    # For SELL trades: profit target hit when price goes DOWN, stop loss when price goes UP
                    target_hit = target_price and low_price <= target_price
                    stop_hit = stop_loss and high_price >= stop_loss
                    
                    if target_hit and stop_hit:
                        # Both hit in same candle - stop loss takes precedence
                        logger.warning(f"🚨 Both target and stop hit in same candle for {ticker} at {candle_time}")
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    elif target_hit:
                        exit_price = target_price
                        exit_reason = "PROFIT_TARGET_HIT"
                        exit_type = "WIN"
                    elif stop_hit:
                        exit_price = stop_loss
                        exit_reason = "STOP_LOSS_HIT"
                        exit_type = "LOSS"
                    else:
                        continue  # No exit condition in this candle
                
                # Exit condition found - close the trade
                logger.info(f"🎯 Historical exit detected for {ticker} trade {trade['id']}")
                logger.info(f"🎯 Exit: {exit_reason} at ${exit_price} on {candle_time}")
                
                # Close the trade with historical timing
                self._close_trade_with_exit(
                    trade_id=trade['id'],
                    exit_price=exit_price,
                    exit_reason=exit_reason,
                    exit_type=exit_type,
                    exit_time=candle_time
                )
                
                return {
                    'exit_triggered': True,
                    'exit_reason': exit_reason,
                    'exit_price': exit_price,
                    'exit_time': candle_time,
                    'exit_type': exit_type
                }
            
            # No exit conditions found in historical data
            logger.debug(f"No historical exit conditions found for {ticker} trade {trade['id']}")
            return None
            
        except Exception as e:
            logger.error(f"Error checking historical exit conditions for {ticker}: {str(e)}")
            return None

    def _close_trade_with_exit(self, trade_id: int, exit_price: float, exit_reason: str,
                              exit_type: str, exit_time: str) -> bool:
        """
        Close a trade with specific exit conditions and timing.
        
        Args:
            trade_id: Trade ID to close
            exit_price: Price at which trade was closed
            exit_reason: Reason for closure (PROFIT_TARGET_HIT, STOP_LOSS_HIT)
            exit_type: Type of exit (WIN, LOSS)
            exit_time: Timestamp when exit occurred
            
        Returns:
            True if trade was closed successfully, False otherwise
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Get current trade data
                    cursor.execute('SELECT * FROM active_trades WHERE id = ?', (trade_id,))
                    trade_row = cursor.fetchone()
                    if not trade_row:
                        logger.warning(f"Trade {trade_id} not found for exit closure")
                        return False
                    
                    # Convert to dict for easier access
                    columns = [desc[0] for desc in cursor.description]
                    trade = dict(zip(columns, trade_row))
                    
                    # Calculate realized P&L
                    entry_price = float(trade['entry_price'])
                    action = trade['action'].lower()
                    
                    if action == 'buy':
                        realized_pnl = exit_price - entry_price
                    else:  # sell
                        realized_pnl = entry_price - exit_price
                    
                    # Determine trade status based on exit type
                    if exit_type == "WIN":
                        status = TradeStatus.PROFIT_HIT.value
                        close_reason = TradeCloseReason.PROFIT_TARGET.value
                    else:  # LOSS
                        status = TradeStatus.STOP_HIT.value
                        close_reason = TradeCloseReason.STOP_LOSS.value
                    
                    # Update trade with exit information
                    cursor.execute('''
                        UPDATE active_trades
                        SET status = ?, close_time = ?, close_price = ?, close_reason = ?,
                            close_details = ?, realized_pnl = ?, current_price = ?, updated_at = ?
                        WHERE id = ?
                    ''', (
                        status,
                        exit_time,
                        exit_price,
                        close_reason,
                        json.dumps({
                            'exit_reason': exit_reason,
                            'exit_type': exit_type,
                            'historical_exit': True
                        }),
                        realized_pnl,
                        exit_price,
                        datetime.now(),
                        trade_id
                    ))
                    
                    # Add trade update for historical record
                    self._add_trade_update(cursor, trade_id, exit_price, exit_reason.lower(), {
                        'exit_type': exit_type,
                        'pnl': realized_pnl,
                        'historical_exit': True,
                        'exit_time': exit_time
                    })
                    
                    conn.commit()
                    
                    logger.info(f"🎯 Trade {trade_id} closed: {exit_reason} at ${exit_price} (P&L: ${realized_pnl:.2f})")
                    return True
                    
        except Exception as e:
            logger.error(f"Error closing trade {trade_id} with exit: {str(e)}")
            return False

    def _get_last_chart_analysis_time(self, ticker: str) -> Optional[datetime]:
        """
        Get the timestamp of the most recent chart analysis record for this ticker.
        This ensures we only check historical data since the last chart read.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Datetime of last chart analysis or None if no records found
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get the most recent chart analysis timestamp for this ticker
                cursor.execute('''
                    SELECT timestamp FROM chart_analysis
                    WHERE ticker = ?
                    ORDER BY timestamp DESC
                    LIMIT 1
                ''', (ticker,))
                
                result = cursor.fetchone()
                if not result:
                    logger.debug(f"No chart analysis records found for {ticker}")
                    return None
                
                # Parse the timestamp
                timestamp_str = result[0]
                last_analysis_dt = self._safe_parse_datetime(timestamp_str)
                
                if last_analysis_dt:
                    logger.debug(f"Last chart analysis for {ticker}: {last_analysis_dt}")
                    return last_analysis_dt
                else:
                    logger.warning(f"Invalid timestamp in chart analysis for {ticker}: {timestamp_str}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting last chart analysis time for {ticker}: {str(e)}")
            return None

    def _fetch_historical_candles_since_analysis(self, ticker: str, last_analysis_dt: datetime) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch historical candles since last analysis using the existing market data infrastructure.
        Uses the same routing system: AlphaVantage → YFinance → Hyperliquid for crypto.
        
        Args:
            ticker: Stock ticker symbol
            last_analysis_dt: Datetime of last chart analysis
            
        Returns:
            List of candle data or None if no data available
        """
        try:
            # Import the market data functions from the existing infrastructure
            import sys
            import os
            sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app'))
            
            from market_data_routes import fetch_hyperliquid_data, is_crypto_symbol, fetch_yfinance_data
            
            # Calculate time range since last analysis
            now = datetime.now()
            time_diff = now - last_analysis_dt
            
            # For very recent analysis (< 5 minutes), skip historical check
            if time_diff.total_seconds() < 300:  # 5 minutes
                logger.debug(f"Last analysis was {time_diff.total_seconds():.0f}s ago, skipping historical check")
                return None
            
            logger.info(f"🔍 Fetching historical data for {ticker} since {last_analysis_dt} ({time_diff})")
            
            # Use 1-minute timeframe for precise exit detection
            timeframe = '1m'
            
            # Determine appropriate period based on time difference
            if time_diff.days > 0:
                period = f"{min(time_diff.days + 1, 7)}d"  # Max 7 days for minute data
            else:
                hours = max(1, int(time_diff.total_seconds() / 3600) + 1)
                period = f"{min(hours, 24)}h"  # Max 24 hours
            
            logger.info(f"🔍 Using timeframe: {timeframe}, period: {period}")
            
            # Try the same routing as the main market data system
            candles = None
            
            # For crypto tokens (like SOLUSD), use Hyperliquid
            if is_crypto_symbol(ticker):
                logger.info(f"🔍 Detected crypto symbol {ticker}, using Hyperliquid")
                candles = fetch_hyperliquid_data(ticker, timeframe, period)
                
            # Fallback to YFinance for stocks or if Hyperliquid fails
            if not candles:
                logger.info(f"🔍 Using YFinance for {ticker}")
                candles = fetch_yfinance_data(ticker, timeframe, period)
            
            if candles and len(candles) > 0:
                # Filter candles to only include those since last analysis
                filtered_candles = []
                last_analysis_timestamp = int(last_analysis_dt.timestamp() * 1000)
                
                for candle in candles:
                    candle_time = candle.get('time', 0)
                    if candle_time > last_analysis_timestamp:
                        # Convert to our expected format
                        filtered_candles.append({
                            'timestamp': datetime.fromtimestamp(candle_time / 1000),
                            'high': float(candle.get('high', 0)),
                            'low': float(candle.get('low', 0)),
                            'open': float(candle.get('open', 0)),
                            'close': float(candle.get('close', 0))
                        })
                
                logger.info(f"🔍 Found {len(filtered_candles)} candles since last analysis")
                return filtered_candles if filtered_candles else None
            
            logger.debug(f"No historical candles available for {ticker}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching historical candles for {ticker}: {str(e)}")
            return None
    
    def _ensure_active_trades_table(self):
        """Ensure the active_trades table and chart_analysis table exist with proper schema"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create chart_analysis table for tracking analysis timestamps
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS chart_analysis (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker TEXT NOT NULL,
                        timeframe TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        analysis_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(ticker, timestamp)
                    )
                ''')
                
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
            
            # CRITICAL FIX: Check for MAINTAIN recommendation before creating trades
            # If AI recommends MAINTAIN for existing position, skip trade creation entirely
            context_assessment = analysis_data.get('context_assessment', {})
            if isinstance(context_assessment, dict):
                previous_position_status = context_assessment.get('previous_position_status', '')
                # Safely handle non-string values and whitespace
                if isinstance(previous_position_status, str) and previous_position_status.strip().upper() == 'MAINTAIN':
                    logger.info(f"🔄 MAINTAIN recommendation detected for {ticker}: Skipping trade creation as AI recommends maintaining existing position")
                    return None
            
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
            
            # CRITICAL FIX: Sort entry strategies by probability (highest first) - consistent with other services
            if entry_strategies:
                def probability_sort_key(strategy):
                    prob = strategy.get('probability', 'low').lower()
                    if prob == 'high':
                        return 3
                    elif prob == 'medium':
                        return 2
                    else:  # low or any other value
                        return 1
                
                entry_strategies = sorted(entry_strategies, key=probability_sort_key, reverse=True)
                logger.info(f"🎯 [ACTIVE TRADE PROBABILITY FIX] Sorted {len(entry_strategies)} strategies by probability for active trade creation")
            
            # Find primary entry strategy (now highest probability after sorting)
            primary_strategy = None
            if entry_strategies:
                for strategy in entry_strategies:
                    if strategy.get('entry_price') == entry_price:
                        primary_strategy = strategy
                        break
                if not primary_strategy:
                    primary_strategy = entry_strategies[0]
                    logger.info(f"🎯 [ACTIVE TRADE PROBABILITY FIX] Using highest probability strategy: {primary_strategy.get('strategy_type', 'unknown')} ({primary_strategy.get('probability', 'unknown')} probability)")
            
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
            
            # SIMPLE FIX: Check for AI trade cancellation and delete existing trade first
            context_assessment = analysis_data.get('context_assessment', {})
            if isinstance(context_assessment, dict):
                position_assessment = context_assessment.get('position_assessment', '')
                if isinstance(position_assessment, str) and 'TRADE CANCELLATION' in position_assessment:
                    # AI wants to cancel existing trade - delete it first, then create new one
                    existing_trade = self.get_active_trade(ticker)
                    if existing_trade and existing_trade['status'] == TradeStatus.WAITING.value:
                        logger.info(f"🗑️ AI TRADE CANCELLATION detected: Deleting existing waiting trade {existing_trade['id']} for {ticker}")
                        self.delete_trade_by_id(existing_trade['id'], "cancelled_before_entry: AI trade cancellation - position invalidated")
                        logger.info(f"✅ Existing trade deleted, proceeding to create new trade with updated parameters")

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
            
            # Check for exit conditions with detailed logging
            exit_triggered = False
            exit_reason = None
            exit_details = {}
            
            if trade['status'] == TradeStatus.ACTIVE.value:
                logger.info(f"🎯 Checking current price exit conditions for {ticker} trade {trade['id']}")
                logger.info(f"🎯 Current: ${current_price}, Entry: ${entry_price}, Target: ${target_price}, Stop: ${stop_loss}, Action: {action}")
                
                # Check profit target
                if target_price and ((action == 'buy' and current_price >= target_price) or
                                   (action == 'sell' and current_price <= target_price)):
                    exit_triggered = True
                    exit_reason = TradeCloseReason.PROFIT_TARGET.value
                    exit_details = {'target_price': target_price, 'achieved_price': current_price}
                    logger.info(f"🎯 PROFIT TARGET HIT: {ticker} trade {trade['id']} - Target: ${target_price}, Current: ${current_price}")
                    
                # Check stop loss
                elif stop_loss and ((action == 'buy' and current_price <= stop_loss) or
                                  (action == 'sell' and current_price >= stop_loss)):
                    exit_triggered = True
                    exit_reason = TradeCloseReason.STOP_LOSS.value
                    exit_details = {'stop_loss': stop_loss, 'hit_price': current_price}
                    logger.info(f"🎯 STOP LOSS HIT: {ticker} trade {trade['id']} - Stop: ${stop_loss}, Current: ${current_price}")
                
                else:
                    # DIAGNOSTIC: Add detailed logging for stop loss analysis
                    if stop_loss:
                        if action == 'buy':
                            logger.info(f"🔍 [STOP LOSS DIAGNOSTIC] BUY trade {trade['id']}: Current ${current_price} vs Stop ${stop_loss} - {'HIT' if current_price <= stop_loss else 'NOT HIT'}")
                            logger.info(f"🔍 [STOP LOSS DIAGNOSTIC] Price needs to drop to ${stop_loss} or below to trigger stop loss")
                        else:
                            logger.info(f"🔍 [STOP LOSS DIAGNOSTIC] SELL trade {trade['id']}: Current ${current_price} vs Stop ${stop_loss} - {'HIT' if current_price >= stop_loss else 'NOT HIT'}")
                            logger.info(f"🔍 [STOP LOSS DIAGNOSTIC] Price needs to rise to ${stop_loss} or above to trigger stop loss")
                    logger.debug(f"🎯 No exit conditions met for {ticker} trade {trade['id']} at current price ${current_price}")
            
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
    
    def close_trade_by_user(self, ticker: str, current_price: float, notes: str = "", close_reason: str = "user_closed") -> bool:
        """
        Close trade based on user override.
        
        CRITICAL FIX: Manual intervention (PROFIT/STOP/CLOSE buttons) should ALWAYS override
        automated processes and properly close trades regardless of current status.
        This ensures consistent behavior and proper performance tracking.
        
        Args:
            ticker: Stock ticker symbol
            current_price: Current market price
            notes: User notes about the closure
            close_reason: Reason for closure ('profit_hit', 'stop_hit', 'user_closed')
            
        Returns:
            True if trade was closed successfully, False otherwise
        """
        try:
            trade = self.get_active_trade(ticker)
            if not trade or trade['status'] not in [TradeStatus.WAITING.value, TradeStatus.ACTIVE.value]:
                logger.warning(f"No active trade found for {ticker} to close")
                return False
            
            # CRITICAL FIX: Manual buttons should ALWAYS close trades, never delete them
            # This ensures proper performance tracking and consistent user experience
            logger.info(f"👤 Manual close requested for {trade['status']} trade {trade['id']} ({ticker}) - reason: {close_reason}")
            
            entry_price = trade['entry_price']
            action = trade['action']
            
            # For waiting trades that are manually closed, use entry price as the effective close price
            # unless a specific close price is provided based on the close reason
            effective_close_price = current_price
            
            # Determine effective close price based on close reason and trade parameters
            if close_reason == 'profit_hit' and trade.get('target_price'):
                effective_close_price = float(trade['target_price'])
                logger.info(f"👤 Using target price ${effective_close_price} for profit hit closure")
            elif close_reason == 'stop_hit' and trade.get('stop_loss'):
                effective_close_price = float(trade['stop_loss'])
                logger.info(f"👤 Using stop loss ${effective_close_price} for stop hit closure")
            else:
                effective_close_price = current_price
                logger.info(f"👤 Using current price ${effective_close_price} for manual closure")
            
            # Calculate P&L based on effective close price
            if action == 'buy':
                realized_pnl = effective_close_price - entry_price
            else:  # sell
                realized_pnl = entry_price - effective_close_price
            
            # Map frontend close_reason to backend status and close_reason
            status_mapping = {
                'profit_hit': (TradeStatus.PROFIT_HIT.value, TradeCloseReason.PROFIT_TARGET.value),
                'stop_hit': (TradeStatus.STOP_HIT.value, TradeCloseReason.STOP_LOSS.value),
                'user_closed': (TradeStatus.USER_CLOSED.value, TradeCloseReason.USER_OVERRIDE.value)
            }
            
            trade_status, trade_close_reason = status_mapping.get(close_reason,
                (TradeStatus.USER_CLOSED.value, TradeCloseReason.USER_OVERRIDE.value))
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Enhanced close details for manual intervention
                    close_details = {
                        'notes': notes,
                        'close_reason': close_reason,
                        'manual_intervention': True,
                        'original_status': trade['status'],
                        'effective_close_price': effective_close_price,
                        'current_market_price': current_price
                    }
                    
                    cursor.execute('''
                        UPDATE active_trades
                        SET status = ?, close_time = ?, close_price = ?, close_reason = ?,
                            close_details = ?, realized_pnl = ?, current_price = ?, updated_at = ?
                        WHERE id = ?
                    ''', (
                        trade_status,
                        datetime.now(),
                        effective_close_price,  # Use effective close price, not current price
                        trade_close_reason,
                        json.dumps(close_details),
                        realized_pnl,
                        current_price,  # Keep current price for reference
                        datetime.now(),
                        trade['id']
                    ))
                    
                    # Add trade update with enhanced details
                    self._add_trade_update(cursor, trade['id'], effective_close_price, close_reason,
                                         {
                                             'notes': notes,
                                             'pnl': realized_pnl,
                                             'manual_intervention': True,
                                             'original_status': trade['status']
                                         })
                    
                    conn.commit()
                    
                    reason_text = {
                        'profit_hit': 'Profit target hit',
                        'stop_hit': 'Stop loss hit',
                        'user_closed': 'User closed'
                    }.get(close_reason, 'User closed')
                    
                    logger.info(f"👤 {reason_text} - trade {trade['id']} for {ticker} at ${effective_close_price} (P&L: ${realized_pnl:.2f})")
                    return True
                    
        except Exception as e:
            logger.error(f"Error closing trade by user for {ticker}: {str(e)}")
            return False
    
    def _get_recent_trade_closures(self, ticker: str, minutes: int = 5) -> List[Dict[str, Any]]:
        """
        Get trades that were closed recently for the given ticker.
        Used to detect if chart overlays should be cleared.
        
        Args:
            ticker: Stock ticker symbol
            minutes: How many minutes back to look for closures
            
        Returns:
            List of recently closed trades
        """
        try:
            self._ensure_active_trades_table()
            cutoff_time = datetime.now() - timedelta(minutes=minutes)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM active_trades
                    WHERE ticker = ?
                    AND status IN ('closed_profit', 'closed_loss', 'closed_user')
                    AND updated_at >= ?
                    ORDER BY updated_at DESC
                ''', (ticker.upper(), cutoff_time))
                
                trades = []
                for row in cursor.fetchall():
                    trades.append(dict(row))
                
                return trades
                
        except Exception as e:
            logger.error(f"Error getting recent trade closures for {ticker}: {str(e)}")
            return []
    
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
            
            # CRITICAL: Check for profit target and stop loss hits
            # First check current price, then historical candles if needed
            logger.info(f"🎯 [TRADE CONTEXT] Checking exit conditions for {trade['status']} trade {trade['id']} ({ticker}) at ${current_price}")
            
            # Enhanced logging for debugging trade closure issues
            created_time = self._safe_parse_datetime(trade.get('created_at'))
            if created_time:
                time_since_creation = (datetime.now() - created_time).total_seconds() / 60  # minutes
                logger.info(f"🎯 [TRADE CONTEXT] Trade {trade['id']} created {time_since_creation:.1f} minutes ago")
            
            if trade['status'] == TradeStatus.WAITING.value:
                logger.info(f"🎯 [TRADE CONTEXT] WAITING trade {trade['id']} - entry trigger at ${trade['entry_price']}")
            elif trade['status'] == TradeStatus.ACTIVE.value:
                trigger_time = self._safe_parse_datetime(trade.get('trigger_hit_time'))
                if trigger_time:
                    time_since_trigger = (datetime.now() - trigger_time).total_seconds() / 60  # minutes
                    logger.info(f"🎯 [TRADE CONTEXT] ACTIVE trade {trade['id']} - triggered {time_since_trigger:.1f} minutes ago at ${trade.get('trigger_hit_price')}")
            
            progress = self.update_trade_progress(ticker, current_price)
            
            # If trade was closed by current price check, return None
            if progress and progress.get('exit_triggered'):
                logger.info(f"🎯 Trade {trade['id']} for {ticker} closed by current price: {progress.get('exit_reason')}")
                return None
            
            # CRITICAL FIX: Only check historical exit conditions for ACTIVE trades that have been active for a reasonable time
            # WAITING trades should NEVER be subject to historical exit checks as they haven't been triggered yet
            if trade['status'] == TradeStatus.ACTIVE.value:
                # Additional safety check: ensure trade has been active for at least 1 minute before checking historical exits
                trigger_time = self._safe_parse_datetime(trade.get('trigger_hit_time'))
                if trigger_time:
                    time_since_trigger = (datetime.now() - trigger_time).total_seconds() / 60  # minutes
                    if time_since_trigger >= 1:
                        historical_exit = self._check_historical_exit_conditions(ticker, trade)
                        if historical_exit:
                            logger.info(f"🎯 Trade {trade['id']} for {ticker} closed by historical data: {historical_exit.get('exit_reason')}")
                            return None
                    else:
                        logger.debug(f"🛡️ Trade {trade['id']} triggered {time_since_trigger:.1f} minutes ago - skipping historical check (trigger grace period)")
                else:
                    # CRITICAL FIX: For ACTIVE trades without trigger_hit_time, use creation time as fallback
                    # This ensures stop loss checking still occurs for active trades
                    created_time = self._safe_parse_datetime(trade.get('created_at'))
                    if created_time:
                        time_since_creation = (datetime.now() - created_time).total_seconds() / 60  # minutes
                        if time_since_creation >= 5:  # 5 minute grace period for newly created trades
                            logger.warning(f"🔧 [STOP LOSS FIX] Trade {trade['id']} missing trigger_hit_time - using creation time for historical check")
                            logger.warning(f"🔧 [STOP LOSS FIX] This ensures stop loss detection works even without trigger timestamp")
                            historical_exit = self._check_historical_exit_conditions(ticker, trade)
                            if historical_exit:
                                logger.info(f"🎯 Trade {trade['id']} for {ticker} closed by historical data (fallback method): {historical_exit.get('exit_reason')}")
                                return None
                        else:
                            logger.debug(f"🛡️ Trade {trade['id']} created {time_since_creation:.1f} minutes ago - skipping historical check (creation grace period)")
                    else:
                        logger.warning(f"🚨 [TRIGGER TIME DIAGNOSTIC] Trade {trade['id']} has no trigger_hit_time AND no valid created_at - this prevents historical stop loss checking!")
                        logger.warning(f"🚨 [TRIGGER TIME DIAGNOSTIC] Trade status: {trade['status']}, Entry: ${trade['entry_price']}, Stop: ${trade.get('stop_loss')}")
                        logger.warning(f"🚨 [TRIGGER TIME DIAGNOSTIC] Without trigger_hit_time, only current price (${current_price}) is checked for stop loss")
            elif trade['status'] == TradeStatus.WAITING.value:
                logger.debug(f"🛡️ Trade {trade['id']} is WAITING - historical exit checks are disabled for waiting trades")
            
            # Refresh trade data after potential updates
            trade = self.get_active_trade(ticker)
            if not trade:
                return None
            
            # Calculate time since trade creation and trigger
            created_time = self._safe_parse_datetime(trade['created_at'])
            if not created_time:
                logger.warning(f"Invalid created_at timestamp for trade {trade.get('id')}")
                return None
            time_since_creation = (datetime.now() - created_time).total_seconds() / 3600
            
            trigger_time = None
            time_since_trigger = None
            if trade.get('trigger_hit_time'):
                trigger_time = self._safe_parse_datetime(trade['trigger_hit_time'])
                if trigger_time:
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
                trigger_text = f"{time_since_trigger:.1f}h ago" if time_since_trigger is not None else "recently"
                context['trade_message'] = f"ACTIVE TRADE: {trade['action'].upper()} at ${trade['entry_price']} (triggered {trigger_text}, P&L: {pnl_text})"
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
            logger.info(f"🔍 [DEBUG] ActiveTradeService: Checking active trades for analysis {analysis_id} using db_path: {self.db_path}")
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT COUNT(*) FROM active_trades
                    WHERE analysis_id = ? AND status IN ('waiting', 'active')
                ''', (analysis_id,))
                
                count = cursor.fetchone()[0]
                logger.info(f"🔍 [DEBUG] ActiveTradeService: Found {count} active trades for analysis {analysis_id}")
                return count > 0
                
        except Exception as e:
            logger.error(f"🔍 [DEBUG] ActiveTradeService: Error checking active trades for analysis {analysis_id}: {str(e)}")
            return False
    
    def force_close_trades_for_analysis(self, analysis_id: int, reason: str = "analysis_deleted") -> bool:
        """
        Force close all active trades for a specific analysis ID.
        
        Args:
            analysis_id (int): The analysis ID whose trades should be closed
            reason (str): Reason for force closure
            
        Returns:
            bool: True if all trades were closed successfully
        """
        try:
            logger.info(f"🔍 [DEBUG] ActiveTradeService: Force closing trades for analysis {analysis_id}, reason: {reason}")
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Get all active trades for this analysis with creation time
                    cursor.execute('''
                        SELECT id, ticker, action, entry_price, created_at FROM active_trades
                        WHERE analysis_id = ? AND status IN ('waiting', 'active')
                    ''', (analysis_id,))
                    
                    trades = cursor.fetchall()
                    logger.info(f"🔍 [DEBUG] ActiveTradeService: Found {len(trades)} trades to force close for analysis {analysis_id}")
                    
                    if not trades:
                        return True  # No trades to close
                    
                    # CRITICAL FIX: Protect newly created trades from immediate force closure
                    protected_trades = []
                    closeable_trades = []
                    
                    for trade in trades:
                        trade_id, ticker, action, entry_price, created_at = trade
                        
                        # Parse creation time and check if trade is too new to close
                        created_time = self._safe_parse_datetime(created_at)
                        if created_time:
                            time_since_creation = (datetime.now() - created_time).total_seconds() / 60  # minutes
                            if time_since_creation < 10:  # Protect trades created within last 10 minutes
                                protected_trades.append((trade_id, ticker, time_since_creation))
                                logger.warning(f"🛡️ [FORCE CLOSE PROTECTION] Protecting trade {trade_id} ({ticker}) - created {time_since_creation:.1f} minutes ago")
                                continue
                        
                        closeable_trades.append(trade)
                    
                    if protected_trades:
                        logger.warning(f"🛡️ [FORCE CLOSE PROTECTION] Protected {len(protected_trades)} newly created trades from force closure")
                        for trade_id, ticker, age in protected_trades:
                            logger.warning(f"🛡️ [FORCE CLOSE PROTECTION] - Trade {trade_id} ({ticker}): {age:.1f} minutes old")
                    
                    # Close only the trades that are old enough
                    for trade in closeable_trades:
                        trade_id, ticker, action, entry_price, created_at = trade
                        
                        # Update trade status to closed
                        cursor.execute('''
                            UPDATE active_trades
                            SET status = ?,
                                close_reason = ?,
                                close_price = ?,
                                close_time = ?,
                                updated_at = ?
                            WHERE id = ?
                        ''', (
                            TradeStatus.USER_CLOSED.value,
                            reason,
                            entry_price,  # Use entry price as close price for forced closure
                            datetime.now().isoformat(),
                            datetime.now().isoformat(),
                            trade_id
                        ))
                        
                        logger.info(f"🔍 [DEBUG] ActiveTradeService: Force closed trade {trade_id} for {ticker}")
                    
                    conn.commit()
                    logger.info(f"🔍 [DEBUG] ActiveTradeService: Successfully force closed {len(trades)} trades for analysis {analysis_id}")
                    return True
                    
        except Exception as e:
            logger.error(f"🔍 [DEBUG] ActiveTradeService: Error force closing trades for analysis {analysis_id}: {str(e)}")
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

    def delete_trade_by_id(self, trade_id: int, reason: str = "manual_deletion") -> bool:
        """
        Delete a trade by its database ID.
        
        Args:
            trade_id (int): Database ID of the trade to delete
            reason (str): Reason for deletion
            
        Returns:
            bool: True if trade was deleted successfully, False otherwise
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Check if trade exists
                    cursor.execute('SELECT ticker, status FROM active_trades WHERE id = ?', (trade_id,))
                    trade_row = cursor.fetchone()
                    if not trade_row:
                        logger.warning(f"Trade {trade_id} not found for deletion")
                        return False
                    
                    ticker, status = trade_row
                    
                    # Delete the trade
                    cursor.execute('DELETE FROM active_trades WHERE id = ?', (trade_id,))
                    
                    # Also delete related trade updates
                    cursor.execute('DELETE FROM trade_updates WHERE trade_id = ?', (trade_id,))
                    
                    conn.commit()
                    
                    logger.info(f"🗑️ Trade {trade_id} ({ticker}) deleted successfully. Reason: {reason}")
                    return True
                    
        except Exception as e:
            logger.error(f"Error deleting trade {trade_id}: {str(e)}")
            return False