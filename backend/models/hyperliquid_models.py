"""
Hyperliquid Trading Data Models

This module defines the database models for storing Hyperliquid trading data
including trades, portfolio snapshots, vault equities, and sync status.
"""

import sqlite3
import logging
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Union
from threading import Lock
from enum import Enum

logger = logging.getLogger(__name__)


class AccountType(Enum):
    """Account types for Hyperliquid data"""
    PERSONAL_WALLET = "personal_wallet"
    TRADING_VAULT = "trading_vault"


class SyncStatus(Enum):
    """Sync status for tracking data synchronization"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class HyperliquidDatabase:
    """
    Database manager for Hyperliquid trading data.
    
    This class handles all database operations for Hyperliquid data including
    trades, portfolio snapshots, vault equities, and sync status tracking.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the Hyperliquid database manager.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'hyperliquid_data.db'
        )
        self.db_lock = Lock()
        self._ensure_database()
    
    def _ensure_database(self):
        """Ensure the database and all tables exist."""
        try:
            # Create instance directory if it doesn't exist
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create hyperliquid_trades table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS hyperliquid_trades (
                        id TEXT PRIMARY KEY,
                        account_type TEXT NOT NULL,
                        wallet_address TEXT NOT NULL,
                        trade_id TEXT NOT NULL,
                        coin TEXT NOT NULL,
                        side TEXT NOT NULL,
                        px REAL NOT NULL,
                        sz REAL NOT NULL,
                        time INTEGER NOT NULL,
                        start_position REAL,
                        dir TEXT,
                        closed_pnl REAL,
                        hash TEXT,
                        oid INTEGER,
                        crossed BOOLEAN,
                        fee REAL,
                        liquidation_markup REAL,
                        raw_data TEXT,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL,
                        UNIQUE(trade_id, account_type, wallet_address)
                    )
                ''')
                
                # Create hyperliquid_portfolio_snapshots table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS hyperliquid_portfolio_snapshots (
                        id TEXT PRIMARY KEY,
                        account_type TEXT NOT NULL,
                        wallet_address TEXT NOT NULL,
                        snapshot_time INTEGER NOT NULL,
                        account_value REAL NOT NULL,
                        total_ntl_pos REAL,
                        total_raw_usd REAL,
                        margin_summary TEXT,
                        positions TEXT,
                        raw_data TEXT,
                        created_at INTEGER NOT NULL,
                        UNIQUE(account_type, wallet_address, snapshot_time)
                    )
                ''')
                
                # Create hyperliquid_vault_equities table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS hyperliquid_vault_equities (
                        id TEXT PRIMARY KEY,
                        vault_address TEXT NOT NULL,
                        user_address TEXT NOT NULL,
                        equity REAL NOT NULL,
                        timestamp INTEGER NOT NULL,
                        raw_data TEXT,
                        created_at INTEGER NOT NULL,
                        UNIQUE(vault_address, user_address, timestamp)
                    )
                ''')
                
                # Create hyperliquid_sync_status table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS hyperliquid_sync_status (
                        id TEXT PRIMARY KEY,
                        account_type TEXT NOT NULL,
                        wallet_address TEXT NOT NULL,
                        sync_type TEXT NOT NULL,
                        status TEXT NOT NULL,
                        last_sync_time INTEGER,
                        last_successful_sync INTEGER,
                        error_message TEXT,
                        retry_count INTEGER DEFAULT 0,
                        next_retry_time INTEGER,
                        metadata TEXT,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL,
                        UNIQUE(account_type, wallet_address, sync_type)
                    )
                ''')
                
                # Create indexes for performance
                indexes = [
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_trades_account_type ON hyperliquid_trades(account_type)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_trades_wallet_address ON hyperliquid_trades(wallet_address)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_trades_coin ON hyperliquid_trades(coin)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_trades_time ON hyperliquid_trades(time)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_trades_side ON hyperliquid_trades(side)',
                    
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_portfolio_account_type ON hyperliquid_portfolio_snapshots(account_type)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_portfolio_wallet_address ON hyperliquid_portfolio_snapshots(wallet_address)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_portfolio_snapshot_time ON hyperliquid_portfolio_snapshots(snapshot_time)',
                    
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_vault_vault_address ON hyperliquid_vault_equities(vault_address)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_vault_user_address ON hyperliquid_vault_equities(user_address)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_vault_timestamp ON hyperliquid_vault_equities(timestamp)',
                    
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_sync_account_type ON hyperliquid_sync_status(account_type)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_sync_wallet_address ON hyperliquid_sync_status(wallet_address)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_sync_status ON hyperliquid_sync_status(status)',
                    'CREATE INDEX IF NOT EXISTS idx_hyperliquid_sync_type ON hyperliquid_sync_status(sync_type)',
                ]
                
                for index_sql in indexes:
                    cursor.execute(index_sql)
                
                conn.commit()
                logger.info(f"Hyperliquid database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing Hyperliquid database: {str(e)}")
            raise
    
    def insert_trade(self, trade_data: Dict[str, Any], account_type: AccountType, wallet_address: str) -> str:
        """
        Insert a new trade record.
        
        Args:
            trade_data (Dict[str, Any]): Trade data from Hyperliquid API
            account_type (AccountType): Type of account (personal_wallet or trading_vault)
            wallet_address (str): Wallet address
            
        Returns:
            str: The ID of the inserted trade
        """
        try:
            trade_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO hyperliquid_trades (
                            id, account_type, wallet_address, trade_id, coin, side, px, sz, time,
                            start_position, dir, closed_pnl, hash, oid, crossed, fee, liquidation_markup,
                            raw_data, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        trade_id,
                        account_type.value,
                        wallet_address,
                        trade_data.get('tid', ''),
                        trade_data.get('coin', ''),
                        trade_data.get('side', ''),
                        float(trade_data.get('px', 0)),
                        float(trade_data.get('sz', 0)),
                        int(trade_data.get('time', 0)),
                        float(trade_data.get('startPosition', 0)) if trade_data.get('startPosition') else None,
                        trade_data.get('dir', ''),
                        float(trade_data.get('closedPnl', 0)) if trade_data.get('closedPnl') else None,
                        trade_data.get('hash', ''),
                        int(trade_data.get('oid', 0)) if trade_data.get('oid') else None,
                        bool(trade_data.get('crossed', False)),
                        float(trade_data.get('fee', 0)) if trade_data.get('fee') else None,
                        float(trade_data.get('liquidationMarkup', 0)) if trade_data.get('liquidationMarkup') else None,
                        json.dumps(trade_data),
                        current_timestamp,
                        current_timestamp
                    ))
                    
                    conn.commit()
                    logger.debug(f"Inserted trade: {trade_data.get('tid', 'unknown')} for {account_type.value}")
                    return trade_id
                    
        except Exception as e:
            logger.error(f"Error inserting trade: {str(e)}")
            raise
    
    def insert_portfolio_snapshot(self, portfolio_data: Dict[str, Any], account_type: AccountType, wallet_address: str) -> str:
        """
        Insert a portfolio snapshot.
        
        Args:
            portfolio_data (Dict[str, Any]): Portfolio data from Hyperliquid API
            account_type (AccountType): Type of account
            wallet_address (str): Wallet address
            
        Returns:
            str: The ID of the inserted snapshot
        """
        try:
            snapshot_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO hyperliquid_portfolio_snapshots (
                            id, account_type, wallet_address, snapshot_time, account_value,
                            total_ntl_pos, total_raw_usd, margin_summary, positions, raw_data, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id,
                        account_type.value,
                        wallet_address,
                        current_timestamp,
                        float(portfolio_data.get('accountValue', 0)),
                        float(portfolio_data.get('totalNtlPos', 0)) if portfolio_data.get('totalNtlPos') else None,
                        float(portfolio_data.get('totalRawUsd', 0)) if portfolio_data.get('totalRawUsd') else None,
                        json.dumps(portfolio_data.get('marginSummary', {})),
                        json.dumps(portfolio_data.get('assetPositions', [])),
                        json.dumps(portfolio_data),
                        current_timestamp
                    ))
                    
                    conn.commit()
                    logger.debug(f"Inserted portfolio snapshot for {account_type.value}")
                    return snapshot_id
                    
        except Exception as e:
            logger.error(f"Error inserting portfolio snapshot: {str(e)}")
            raise
    
    def insert_vault_equity(self, vault_data: Dict[str, Any], vault_address: str, user_address: str) -> str:
        """
        Insert vault equity data.
        
        Args:
            vault_data (Dict[str, Any]): Vault equity data from Hyperliquid API
            vault_address (str): Vault address
            user_address (str): User address
            
        Returns:
            str: The ID of the inserted equity record
        """
        try:
            equity_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO hyperliquid_vault_equities (
                            id, vault_address, user_address, equity, timestamp, raw_data, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        equity_id,
                        vault_address,
                        user_address,
                        float(vault_data.get('equity', 0)),
                        current_timestamp,
                        json.dumps(vault_data),
                        current_timestamp
                    ))
                    
                    conn.commit()
                    logger.debug(f"Inserted vault equity for {vault_address}")
                    return equity_id
                    
        except Exception as e:
            logger.error(f"Error inserting vault equity: {str(e)}")
            raise
    
    def trade_exists(self, trade_id: str, account_type: AccountType, wallet_address: str) -> bool:
        """
        Check if a trade already exists in the database.
        
        Args:
            trade_id (str): Trade ID to check
            account_type (AccountType): Account type
            wallet_address (str): Wallet address
            
        Returns:
            bool: True if trade exists, False otherwise
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT 1 FROM hyperliquid_trades WHERE trade_id = ? AND account_type = ? AND wallet_address = ? LIMIT 1',
                    (trade_id, account_type.value, wallet_address)
                )
                return cursor.fetchone() is not None
        except Exception as e:
            logger.error(f"Error checking if trade exists: {str(e)}")
            return False
    
    def get_latest_trade_time(self, account_type: AccountType, wallet_address: str) -> Optional[int]:
        """
        Get the timestamp of the most recent trade for an account.
        
        Args:
            account_type (AccountType): Account type
            wallet_address (str): Wallet address
            
        Returns:
            Optional[int]: Latest trade timestamp in milliseconds, or None if no trades
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT MAX(time) FROM hyperliquid_trades WHERE account_type = ? AND wallet_address = ?',
                    (account_type.value, wallet_address)
                )
                result = cursor.fetchone()
                return result[0] if result and result[0] is not None else None
        except Exception as e:
            logger.error(f"Error getting latest trade time: {str(e)}")
            return None
    
    def has_completed_initial_sync(self, account_type: AccountType, wallet_address: str) -> bool:
        """
        Check if initial historical sync has been completed for an account.
        
        Args:
            account_type (AccountType): Account type
            wallet_address (str): Wallet address
            
        Returns:
            bool: True if initial sync completed, False otherwise
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    '''SELECT metadata FROM hyperliquid_sync_status
                       WHERE account_type = ? AND wallet_address = ? AND sync_type = ? AND status = ?''',
                    (account_type.value, wallet_address, 'trades', SyncStatus.COMPLETED.value)
                )
                result = cursor.fetchone()
                if result and result[0]:
                    import json
                    metadata = json.loads(result[0])
                    return metadata.get('initial_sync_completed', False)
                return False
        except Exception as e:
            logger.error(f"Error checking initial sync status: {str(e)}")
            return False
    
    def get_trades(self, account_type: Optional[AccountType] = None, wallet_address: Optional[str] = None,
                   limit: Optional[int] = None, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get trades with optional filtering.
        
        Args:
            account_type (Optional[AccountType]): Filter by account type
            wallet_address (Optional[str]): Filter by wallet address
            limit (Optional[int]): Limit number of results
            offset (int): Offset for pagination
            
        Returns:
            List[Dict[str, Any]]: List of trade records
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM hyperliquid_trades'
                params = []
                conditions = []
                
                if account_type:
                    conditions.append('account_type = ?')
                    params.append(account_type.value)
                
                if wallet_address:
                    conditions.append('wallet_address = ?')
                    params.append(wallet_address)
                
                if conditions:
                    query += ' WHERE ' + ' AND '.join(conditions)
                
                query += ' ORDER BY time DESC'
                
                if limit:
                    query += ' LIMIT ? OFFSET ?'
                    params.extend([limit, offset])
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                trades = []
                for row in rows:
                    trade = dict(row)
                    # Parse raw_data JSON
                    if trade['raw_data']:
                        try:
                            trade['raw_data'] = json.loads(trade['raw_data'])
                        except json.JSONDecodeError:
                            pass
                    trades.append(trade)
                
                logger.debug(f"Retrieved {len(trades)} trades")
                return trades
                
        except Exception as e:
            logger.error(f"Error retrieving trades: {str(e)}")
            raise
    
    def get_portfolio_snapshots(self, account_type: Optional[AccountType] = None, 
                               wallet_address: Optional[str] = None, 
                               limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get portfolio snapshots with optional filtering.
        
        Args:
            account_type (Optional[AccountType]): Filter by account type
            wallet_address (Optional[str]): Filter by wallet address
            limit (Optional[int]): Limit number of results
            
        Returns:
            List[Dict[str, Any]]: List of portfolio snapshots
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM hyperliquid_portfolio_snapshots'
                params = []
                conditions = []
                
                if account_type:
                    conditions.append('account_type = ?')
                    params.append(account_type.value)
                
                if wallet_address:
                    conditions.append('wallet_address = ?')
                    params.append(wallet_address)
                
                if conditions:
                    query += ' WHERE ' + ' AND '.join(conditions)
                
                query += ' ORDER BY snapshot_time DESC'
                
                if limit:
                    query += ' LIMIT ?'
                    params.append(limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                snapshots = []
                for row in rows:
                    snapshot = dict(row)
                    # Parse JSON fields
                    for field in ['margin_summary', 'positions', 'raw_data']:
                        if snapshot[field]:
                            try:
                                snapshot[field] = json.loads(snapshot[field])
                            except json.JSONDecodeError:
                                pass
                    snapshots.append(snapshot)
                
                logger.debug(f"Retrieved {len(snapshots)} portfolio snapshots")
                return snapshots
                
        except Exception as e:
            logger.error(f"Error retrieving portfolio snapshots: {str(e)}")
            raise
    
    def update_sync_status(self, account_type: AccountType, wallet_address: str, sync_type: str, 
                          status: SyncStatus, error_message: Optional[str] = None, 
                          metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Update sync status for a specific account and sync type.
        
        Args:
            account_type (AccountType): Type of account
            wallet_address (str): Wallet address
            sync_type (str): Type of sync (e.g., 'trades', 'portfolio', 'vault_equity')
            status (SyncStatus): Current sync status
            error_message (Optional[str]): Error message if sync failed
            metadata (Optional[Dict[str, Any]]): Additional metadata
        """
        try:
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Check if record exists
                    cursor.execute('''
                        SELECT id, retry_count FROM hyperliquid_sync_status 
                        WHERE account_type = ? AND wallet_address = ? AND sync_type = ?
                    ''', (account_type.value, wallet_address, sync_type))
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Update existing record
                        retry_count = existing[1] if status == SyncStatus.FAILED else 0
                        if status == SyncStatus.FAILED:
                            retry_count += 1
                        
                        cursor.execute('''
                            UPDATE hyperliquid_sync_status 
                            SET status = ?, last_sync_time = ?, error_message = ?, 
                                retry_count = ?, metadata = ?, updated_at = ?,
                                last_successful_sync = CASE WHEN ? = 'completed' THEN ? ELSE last_successful_sync END
                            WHERE account_type = ? AND wallet_address = ? AND sync_type = ?
                        ''', (
                            status.value, current_timestamp, error_message, retry_count,
                            json.dumps(metadata) if metadata else None, current_timestamp,
                            status.value, current_timestamp,
                            account_type.value, wallet_address, sync_type
                        ))
                    else:
                        # Insert new record
                        sync_id = str(uuid.uuid4())
                        cursor.execute('''
                            INSERT INTO hyperliquid_sync_status (
                                id, account_type, wallet_address, sync_type, status, 
                                last_sync_time, last_successful_sync, error_message, 
                                retry_count, metadata, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            sync_id, account_type.value, wallet_address, sync_type, status.value,
                            current_timestamp, 
                            current_timestamp if status == SyncStatus.COMPLETED else None,
                            error_message, 1 if status == SyncStatus.FAILED else 0,
                            json.dumps(metadata) if metadata else None,
                            current_timestamp, current_timestamp
                        ))
                    
                    conn.commit()
                    logger.debug(f"Updated sync status: {account_type.value}/{sync_type} -> {status.value}")
                    
        except Exception as e:
            logger.error(f"Error updating sync status: {str(e)}")
            raise
    
    def get_sync_status(self, account_type: Optional[AccountType] = None, 
                       wallet_address: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get sync status records.
        
        Args:
            account_type (Optional[AccountType]): Filter by account type
            wallet_address (Optional[str]): Filter by wallet address
            
        Returns:
            List[Dict[str, Any]]: List of sync status records
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM hyperliquid_sync_status'
                params = []
                conditions = []
                
                if account_type:
                    conditions.append('account_type = ?')
                    params.append(account_type.value)
                
                if wallet_address:
                    conditions.append('wallet_address = ?')
                    params.append(wallet_address)
                
                if conditions:
                    query += ' WHERE ' + ' AND '.join(conditions)
                
                query += ' ORDER BY updated_at DESC'
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                statuses = []
                for row in rows:
                    status = dict(row)
                    # Parse metadata JSON
                    if status['metadata']:
                        try:
                            status['metadata'] = json.loads(status['metadata'])
                        except json.JSONDecodeError:
                            pass
                    statuses.append(status)
                
                logger.debug(f"Retrieved {len(statuses)} sync status records")
                return statuses
                
        except Exception as e:
            logger.error(f"Error retrieving sync status: {str(e)}")
            raise
    
    def get_trade_statistics(self, account_type: AccountType, wallet_address: str) -> Dict[str, Any]:
        """
        Calculate trade statistics for an account.
        
        Args:
            account_type (AccountType): Type of account
            wallet_address (str): Wallet address
            
        Returns:
            Dict[str, Any]: Trade statistics
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get basic trade counts
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_trades,
                        COUNT(DISTINCT coin) as unique_coins,
                        SUM(CASE WHEN closed_pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
                        SUM(CASE WHEN closed_pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
                        SUM(CASE WHEN closed_pnl IS NOT NULL THEN closed_pnl ELSE 0 END) as total_pnl,
                        SUM(CASE WHEN fee IS NOT NULL THEN fee ELSE 0 END) as total_fees,
                        AVG(CASE WHEN closed_pnl IS NOT NULL THEN closed_pnl ELSE 0 END) as avg_pnl
                    FROM hyperliquid_trades 
                    WHERE account_type = ? AND wallet_address = ?
                ''', (account_type.value, wallet_address))
                
                stats = cursor.fetchone()
                
                if not stats or stats[0] == 0:
                    return {
                        'total_trades': 0,
                        'unique_coins': 0,
                        'winning_trades': 0,
                        'losing_trades': 0,
                        'win_rate': 0,
                        'total_pnl': 0,
                        'total_fees': 0,
                        'net_pnl': 0,
                        'avg_pnl': 0
                    }
                
                total_trades, unique_coins, winning_trades, losing_trades, total_pnl, total_fees, avg_pnl = stats
                
                win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
                net_pnl = total_pnl - total_fees
                
                return {
                    'total_trades': total_trades,
                    'unique_coins': unique_coins,
                    'winning_trades': winning_trades,
                    'losing_trades': losing_trades,
                    'win_rate': round(win_rate, 2),
                    'total_pnl': round(total_pnl, 2),
                    'total_fees': round(total_fees, 2),
                    'net_pnl': round(net_pnl, 2),
                    'avg_pnl': round(avg_pnl, 2)
                }
                
        except Exception as e:
            logger.error(f"Error calculating trade statistics: {str(e)}")
            raise
    
    def __repr__(self) -> str:
        """String representation of the HyperliquidDatabase."""
        return f"<HyperliquidDatabase(db_path='{self.db_path}')>"