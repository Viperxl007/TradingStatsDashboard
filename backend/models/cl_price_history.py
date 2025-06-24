"""
Concentrated Liquidity Price History Model

This module defines the CLPriceHistory model for tracking price movements
of token pairs in concentrated liquidity positions.
"""

import sqlite3
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from threading import Lock

logger = logging.getLogger(__name__)


class CLPriceHistory:
    """
    Model for managing price history data for CL positions.
    
    This class handles CRUD operations for price history using SQLite database
    following the existing application patterns.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the CLPriceHistory model with database configuration.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'cl_positions.db'
        )
        self.db_lock = Lock()
        self._ensure_database()
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            # Create instance directory if it doesn't exist
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create cl_price_history table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cl_price_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        position_id TEXT NOT NULL,
                        token_pair TEXT NOT NULL,
                        price REAL NOT NULL,
                        timestamp INTEGER NOT NULL,
                        source TEXT DEFAULT 'dexscreener',
                        FOREIGN KEY (position_id) REFERENCES cl_positions (id)
                    )
                ''')
                
                # Create indexes for cl_price_history
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_price_history_position_id
                    ON cl_price_history(position_id)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_price_history_token_pair
                    ON cl_price_history(token_pair)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_price_history_timestamp
                    ON cl_price_history(timestamp)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_price_history_pair_timestamp
                    ON cl_price_history(token_pair, timestamp)
                ''')
                
                conn.commit()
                logger.info(f"CL price history database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing CL price history database: {str(e)}")
            raise
    
    def add_price_record(self, price_data: Dict[str, Any]) -> int:
        """
        Add a new price record.
        
        Args:
            price_data (Dict[str, Any]): Price data containing required fields
            
        Returns:
            int: The ID of the created price record
            
        Raises:
            ValueError: If required fields are missing
            Exception: If database operation fails
        """
        required_fields = ['position_id', 'token_pair', 'price']
        
        # Validate required fields
        for field in required_fields:
            if field not in price_data:
                raise ValueError(f"Missing required field: {field}")
        
        try:
            timestamp = price_data.get('timestamp', int(datetime.now().timestamp()))
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO cl_price_history (
                            position_id, token_pair, price, timestamp, source
                        ) VALUES (?, ?, ?, ?, ?)
                    ''', (
                        price_data['position_id'],
                        price_data['token_pair'],
                        price_data['price'],
                        timestamp,
                        price_data.get('source', 'dexscreener')
                    ))
                    
                    record_id = cursor.lastrowid
                    conn.commit()
                    logger.debug(f"Added price record: {record_id} for {price_data['token_pair']}")
                    return record_id
                    
        except Exception as e:
            logger.error(f"Error adding price record: {str(e)}")
            raise
    
    def get_price_history(self, position_id: Optional[str] = None, 
                         token_pair: Optional[str] = None,
                         limit: Optional[int] = None,
                         start_time: Optional[int] = None,
                         end_time: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get price history with optional filtering.
        
        Args:
            position_id (Optional[str]): Filter by position ID
            token_pair (Optional[str]): Filter by token pair
            limit (Optional[int]): Limit number of results
            start_time (Optional[int]): Start timestamp filter
            end_time (Optional[int]): End timestamp filter
            
        Returns:
            List[Dict[str, Any]]: List of price history records
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM cl_price_history WHERE 1=1'
                params = []
                
                if position_id:
                    query += ' AND position_id = ?'
                    params.append(position_id)
                
                if token_pair:
                    query += ' AND token_pair = ?'
                    params.append(token_pair)
                
                if start_time:
                    query += ' AND timestamp >= ?'
                    params.append(start_time)
                
                if end_time:
                    query += ' AND timestamp <= ?'
                    params.append(end_time)
                
                query += ' ORDER BY timestamp DESC'
                
                if limit:
                    query += ' LIMIT ?'
                    params.append(limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                records = [dict(row) for row in rows]
                logger.debug(f"Retrieved {len(records)} price history records")
                return records
                
        except Exception as e:
            logger.error(f"Error retrieving price history: {str(e)}")
            raise
    
    def get_latest_price(self, token_pair: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest price for a token pair.
        
        Args:
            token_pair (str): The token pair symbol
            
        Returns:
            Optional[Dict[str, Any]]: Latest price record or None if not found
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM cl_price_history 
                    WHERE token_pair = ? 
                    ORDER BY timestamp DESC 
                    LIMIT 1
                ''', (token_pair,))
                
                row = cursor.fetchone()
                
                if row:
                    record = dict(row)
                    logger.debug(f"Retrieved latest price for {token_pair}: {record['price']}")
                    return record
                else:
                    logger.debug(f"No price history found for {token_pair}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error retrieving latest price for {token_pair}: {str(e)}")
            raise
    
    def get_price_at_time(self, token_pair: str, timestamp: int) -> Optional[Dict[str, Any]]:
        """
        Get the price closest to a specific timestamp.
        
        Args:
            token_pair (str): The token pair symbol
            timestamp (int): Target timestamp
            
        Returns:
            Optional[Dict[str, Any]]: Price record closest to timestamp or None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM cl_price_history 
                    WHERE token_pair = ? 
                    ORDER BY ABS(timestamp - ?) ASC 
                    LIMIT 1
                ''', (token_pair, timestamp))
                
                row = cursor.fetchone()
                
                if row:
                    record = dict(row)
                    logger.debug(f"Retrieved price for {token_pair} at {timestamp}: {record['price']}")
                    return record
                else:
                    logger.debug(f"No price history found for {token_pair} at {timestamp}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error retrieving price at time for {token_pair}: {str(e)}")
            raise
    
    def delete_old_records(self, days_to_keep: int = 90) -> int:
        """
        Delete old price records to manage database size.
        
        Args:
            days_to_keep (int): Number of days of history to keep
            
        Returns:
            int: Number of records deleted
        """
        try:
            cutoff_timestamp = int((datetime.now().timestamp() - (days_to_keep * 24 * 3600)))
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        DELETE FROM cl_price_history 
                        WHERE timestamp < ?
                    ''', (cutoff_timestamp,))
                    
                    deleted_count = cursor.rowcount
                    conn.commit()
                    logger.info(f"Deleted {deleted_count} old price records")
                    return deleted_count
                    
        except Exception as e:
            logger.error(f"Error deleting old price records: {str(e)}")
            raise
    
    def get_price_range(self, token_pair: str, start_time: int, end_time: int) -> Dict[str, float]:
        """
        Get price statistics for a time range.
        
        Args:
            token_pair (str): The token pair symbol
            start_time (int): Start timestamp
            end_time (int): End timestamp
            
        Returns:
            Dict[str, float]: Price statistics (min, max, avg, first, last)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT 
                        MIN(price) as min_price,
                        MAX(price) as max_price,
                        AVG(price) as avg_price,
                        COUNT(*) as count
                    FROM cl_price_history 
                    WHERE token_pair = ? AND timestamp BETWEEN ? AND ?
                ''', (token_pair, start_time, end_time))
                
                row = cursor.fetchone()
                
                if row and row[3] > 0:  # count > 0
                    # Get first and last prices in the range
                    cursor.execute('''
                        SELECT price FROM cl_price_history 
                        WHERE token_pair = ? AND timestamp BETWEEN ? AND ?
                        ORDER BY timestamp ASC LIMIT 1
                    ''', (token_pair, start_time, end_time))
                    first_price = cursor.fetchone()[0]
                    
                    cursor.execute('''
                        SELECT price FROM cl_price_history 
                        WHERE token_pair = ? AND timestamp BETWEEN ? AND ?
                        ORDER BY timestamp DESC LIMIT 1
                    ''', (token_pair, start_time, end_time))
                    last_price = cursor.fetchone()[0]
                    
                    stats = {
                        'min_price': row[0],
                        'max_price': row[1],
                        'avg_price': row[2],
                        'first_price': first_price,
                        'last_price': last_price,
                        'count': row[3]
                    }
                    
                    logger.debug(f"Retrieved price range stats for {token_pair}: {stats}")
                    return stats
                else:
                    logger.debug(f"No price data found for {token_pair} in time range")
                    return {}
                    
        except Exception as e:
            logger.error(f"Error retrieving price range for {token_pair}: {str(e)}")
            raise
    
    def __repr__(self) -> str:
        """String representation of the CLPriceHistory model."""
        return f"<CLPriceHistory(db_path='{self.db_path}')>"