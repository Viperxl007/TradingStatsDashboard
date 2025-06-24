"""
Concentrated Liquidity Fee History Model

This module defines the CLFeeHistory model for tracking fee collection
history for concentrated liquidity positions.
"""

import sqlite3
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from threading import Lock

logger = logging.getLogger(__name__)


class CLFeeHistory:
    """
    Model for managing fee history data for CL positions.
    
    This class handles CRUD operations for fee collection history using SQLite database
    following the existing application patterns.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the CLFeeHistory model with database configuration.
        
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
                
                # Create cl_fee_history table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cl_fee_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        position_id TEXT NOT NULL,
                        fees_amount REAL NOT NULL,
                        cumulative_fees REAL NOT NULL,
                        update_date TEXT NOT NULL,
                        notes TEXT DEFAULT '',
                        created_at INTEGER NOT NULL,
                        FOREIGN KEY (position_id) REFERENCES cl_positions (id)
                    )
                ''')
                
                # Create indexes for cl_fee_history
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_fee_history_position_id
                    ON cl_fee_history(position_id)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_fee_history_update_date
                    ON cl_fee_history(update_date)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_fee_history_created_at
                    ON cl_fee_history(created_at)
                ''')
                
                conn.commit()
                logger.info(f"CL fee history database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing CL fee history database: {str(e)}")
            raise
    
    def add_fee_update(self, fee_data: Dict[str, Any]) -> int:
        """
        Add a new fee update record.
        
        Args:
            fee_data (Dict[str, Any]): Fee data containing required fields
            
        Returns:
            int: The ID of the created fee record
            
        Raises:
            ValueError: If required fields are missing
            Exception: If database operation fails
        """
        required_fields = ['position_id', 'fees_amount', 'cumulative_fees', 'update_date']
        
        # Validate required fields
        for field in required_fields:
            if field not in fee_data:
                raise ValueError(f"Missing required field: {field}")
        
        try:
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO cl_fee_history (
                            position_id, fees_amount, cumulative_fees, update_date, notes, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        fee_data['position_id'],
                        fee_data['fees_amount'],
                        fee_data['cumulative_fees'],
                        fee_data['update_date'],
                        fee_data.get('notes', ''),
                        current_timestamp
                    ))
                    
                    record_id = cursor.lastrowid
                    conn.commit()
                    logger.info(f"Added fee update record: {record_id} for position {fee_data['position_id']}")
                    return record_id
                    
        except Exception as e:
            logger.error(f"Error adding fee update record: {str(e)}")
            raise
    
    def get_fee_history(self, position_id: Optional[str] = None,
                       limit: Optional[int] = None,
                       start_date: Optional[str] = None,
                       end_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get fee history with optional filtering.
        
        Args:
            position_id (Optional[str]): Filter by position ID
            limit (Optional[int]): Limit number of results
            start_date (Optional[str]): Start date filter (ISO format)
            end_date (Optional[str]): End date filter (ISO format)
            
        Returns:
            List[Dict[str, Any]]: List of fee history records
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM cl_fee_history WHERE 1=1'
                params = []
                
                if position_id:
                    query += ' AND position_id = ?'
                    params.append(position_id)
                
                if start_date:
                    query += ' AND update_date >= ?'
                    params.append(start_date)
                
                if end_date:
                    query += ' AND update_date <= ?'
                    params.append(end_date)
                
                query += ' ORDER BY created_at DESC'
                
                if limit:
                    query += ' LIMIT ?'
                    params.append(limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                records = [dict(row) for row in rows]
                logger.debug(f"Retrieved {len(records)} fee history records")
                return records
                
        except Exception as e:
            logger.error(f"Error retrieving fee history: {str(e)}")
            raise
    
    def get_latest_fee_update(self, position_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest fee update for a position.
        
        Args:
            position_id (str): The position ID
            
        Returns:
            Optional[Dict[str, Any]]: Latest fee update record or None if not found
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM cl_fee_history 
                    WHERE position_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ''', (position_id,))
                
                row = cursor.fetchone()
                
                if row:
                    record = dict(row)
                    logger.debug(f"Retrieved latest fee update for position {position_id}")
                    return record
                else:
                    logger.debug(f"No fee history found for position {position_id}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error retrieving latest fee update for position {position_id}: {str(e)}")
            raise
    
    def get_total_fees_collected(self, position_id: str) -> float:
        """
        Get the total fees collected for a position.
        
        Args:
            position_id (str): The position ID
            
        Returns:
            float: Total fees collected
        """
        try:
            latest_update = self.get_latest_fee_update(position_id)
            if latest_update:
                return latest_update['cumulative_fees']
            else:
                return 0.0
                
        except Exception as e:
            logger.error(f"Error retrieving total fees for position {position_id}: {str(e)}")
            raise
    
    def get_fee_statistics(self, position_id: str) -> Dict[str, Any]:
        """
        Get fee collection statistics for a position.
        
        Args:
            position_id (str): The position ID
            
        Returns:
            Dict[str, Any]: Fee statistics including total, count, average, etc.
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT 
                        COUNT(*) as update_count,
                        SUM(fees_amount) as total_fees,
                        AVG(fees_amount) as avg_fee_amount,
                        MIN(fees_amount) as min_fee_amount,
                        MAX(fees_amount) as max_fee_amount,
                        MAX(cumulative_fees) as cumulative_total
                    FROM cl_fee_history 
                    WHERE position_id = ?
                ''', (position_id,))
                
                row = cursor.fetchone()
                
                if row and row[0] > 0:  # update_count > 0
                    stats = {
                        'update_count': row[0],
                        'total_fees': row[1] or 0.0,
                        'avg_fee_amount': row[2] or 0.0,
                        'min_fee_amount': row[3] or 0.0,
                        'max_fee_amount': row[4] or 0.0,
                        'cumulative_total': row[5] or 0.0
                    }
                    
                    # Get first and last update dates
                    cursor.execute('''
                        SELECT update_date FROM cl_fee_history 
                        WHERE position_id = ? 
                        ORDER BY created_at ASC LIMIT 1
                    ''', (position_id,))
                    first_update = cursor.fetchone()
                    
                    cursor.execute('''
                        SELECT update_date FROM cl_fee_history 
                        WHERE position_id = ? 
                        ORDER BY created_at DESC LIMIT 1
                    ''', (position_id,))
                    last_update = cursor.fetchone()
                    
                    if first_update:
                        stats['first_update_date'] = first_update[0]
                    if last_update:
                        stats['last_update_date'] = last_update[0]
                    
                    logger.debug(f"Retrieved fee statistics for position {position_id}: {stats}")
                    return stats
                else:
                    logger.debug(f"No fee history found for position {position_id}")
                    return {
                        'update_count': 0,
                        'total_fees': 0.0,
                        'avg_fee_amount': 0.0,
                        'min_fee_amount': 0.0,
                        'max_fee_amount': 0.0,
                        'cumulative_total': 0.0
                    }
                    
        except Exception as e:
            logger.error(f"Error retrieving fee statistics for position {position_id}: {str(e)}")
            raise
    
    def delete_fee_record(self, record_id: int) -> bool:
        """
        Delete a specific fee record.
        
        Args:
            record_id (int): The fee record ID
            
        Returns:
            bool: True if record was deleted successfully, False otherwise
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('DELETE FROM cl_fee_history WHERE id = ?', (record_id,))
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Deleted fee record: {record_id}")
                        return True
                    else:
                        logger.warning(f"Fee record not found for deletion: {record_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error deleting fee record {record_id}: {str(e)}")
            raise
    
    def update_fee_record(self, record_id: int, updates: Dict[str, Any]) -> bool:
        """
        Update an existing fee record.
        
        Args:
            record_id (int): The fee record ID
            updates (Dict[str, Any]): Fields to update
            
        Returns:
            bool: True if update was successful, False otherwise
        """
        if not updates:
            return True
        
        try:
            # Build dynamic update query
            set_clauses = []
            params = []
            
            for field, value in updates.items():
                if field != 'id':  # Don't allow ID updates
                    set_clauses.append(f"{field} = ?")
                    params.append(value)
            
            if not set_clauses:
                return True
            
            params.append(record_id)
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    query = f"UPDATE cl_fee_history SET {', '.join(set_clauses)} WHERE id = ?"
                    cursor.execute(query, params)
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Updated fee record: {record_id}")
                        return True
                    else:
                        logger.warning(f"Fee record not found for update: {record_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error updating fee record {record_id}: {str(e)}")
            raise
    
    def __repr__(self) -> str:
        """String representation of the CLFeeHistory model."""
        return f"<CLFeeHistory(db_path='{self.db_path}')>"