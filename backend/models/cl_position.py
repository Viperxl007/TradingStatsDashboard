"""
Concentrated Liquidity Position Model

This module defines the CLPosition model for tracking concentrated liquidity positions
in DeFi protocols like HyperSwap on HyperEVM chain.
"""

import sqlite3
import logging
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from threading import Lock

logger = logging.getLogger(__name__)


class CLPosition:
    """
    Model for managing Concentrated Liquidity positions.
    
    This class handles CRUD operations for CL positions using SQLite database
    following the existing application patterns.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the CLPosition model with database configuration.
        
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
                
                # Create cl_positions table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cl_positions (
                        id TEXT PRIMARY KEY,
                        trade_name TEXT NOT NULL,
                        pair_symbol TEXT NOT NULL,
                        contract_address TEXT,
                        token0_address TEXT,
                        token1_address TEXT,
                        protocol TEXT DEFAULT 'HyperSwap',
                        chain TEXT DEFAULT 'HyperEVM',
                        price_range_min REAL NOT NULL,
                        price_range_max REAL NOT NULL,
                        liquidity_amount REAL NOT NULL,
                        initial_investment REAL NOT NULL,
                        entry_date TEXT NOT NULL,
                        exit_date TEXT,
                        status TEXT DEFAULT 'active',
                        fees_collected REAL DEFAULT 0,
                        notes TEXT DEFAULT '',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                ''')
                
                # Add token address columns if they don't exist (for existing databases)
                try:
                    cursor.execute('ALTER TABLE cl_positions ADD COLUMN token0_address TEXT')
                except sqlite3.OperationalError:
                    pass  # Column already exists
                
                try:
                    cursor.execute('ALTER TABLE cl_positions ADD COLUMN token1_address TEXT')
                except sqlite3.OperationalError:
                    pass  # Column already exists
                
                # Create indexes for cl_positions
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_positions_pair_symbol
                    ON cl_positions(pair_symbol)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_positions_status
                    ON cl_positions(status)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_positions_protocol
                    ON cl_positions(protocol)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_cl_positions_entry_date
                    ON cl_positions(entry_date)
                ''')
                
                conn.commit()
                logger.info(f"CL positions database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing CL positions database: {str(e)}")
            raise
    
    def create_position(self, position_data: Dict[str, Any]) -> str:
        """
        Create a new CL position.
        
        Args:
            position_data (Dict[str, Any]): Position data containing required fields
            
        Returns:
            str: The ID of the created position
            
        Raises:
            ValueError: If required fields are missing
            Exception: If database operation fails
        """
        required_fields = [
            'trade_name', 'pair_symbol', 'price_range_min', 'price_range_max',
            'liquidity_amount', 'initial_investment', 'entry_date'
        ]
        
        # Validate required fields
        for field in required_fields:
            if field not in position_data:
                raise ValueError(f"Missing required field: {field}")
        
        try:
            position_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO cl_positions (
                            id, trade_name, pair_symbol, contract_address, token0_address, token1_address,
                            protocol, chain, price_range_min, price_range_max, liquidity_amount, initial_investment,
                            entry_date, exit_date, status, fees_collected, notes,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        position_id,
                        position_data['trade_name'],
                        position_data['pair_symbol'],
                        position_data.get('contract_address'),
                        position_data.get('token0_address'),
                        position_data.get('token1_address'),
                        position_data.get('protocol', 'HyperSwap'),
                        position_data.get('chain', 'HyperEVM'),
                        position_data['price_range_min'],
                        position_data['price_range_max'],
                        position_data['liquidity_amount'],
                        position_data['initial_investment'],
                        position_data['entry_date'],
                        position_data.get('exit_date'),
                        position_data.get('status', 'active'),
                        position_data.get('fees_collected', 0),
                        position_data.get('notes', ''),
                        current_timestamp,
                        current_timestamp
                    ))
                    
                    conn.commit()
                    logger.info(f"Created CL position: {position_id}")
                    return position_id
                    
        except Exception as e:
            logger.error(f"Error creating CL position: {str(e)}")
            raise
    
    def get_positions(self, status: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get CL positions with optional filtering.
        
        Args:
            status (Optional[str]): Filter by status ('active' or 'closed')
            limit (Optional[int]): Limit number of results
            
        Returns:
            List[Dict[str, Any]]: List of position dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM cl_positions'
                params = []
                
                if status:
                    query += ' WHERE status = ?'
                    params.append(status)
                
                query += ' ORDER BY created_at DESC'
                
                if limit:
                    query += ' LIMIT ?'
                    params.append(limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                positions = []
                for row in rows:
                    position = dict(row)
                    positions.append(position)
                
                logger.debug(f"Retrieved {len(positions)} CL positions")
                return positions
                
        except Exception as e:
            logger.error(f"Error retrieving CL positions: {str(e)}")
            raise
    
    def get_position_by_id(self, position_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific CL position by ID.
        
        Args:
            position_id (str): The position ID
            
        Returns:
            Optional[Dict[str, Any]]: Position data or None if not found
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM cl_positions WHERE id = ?', (position_id,))
                row = cursor.fetchone()
                
                if row:
                    position = dict(row)
                    logger.debug(f"Retrieved CL position: {position_id}")
                    return position
                else:
                    logger.warning(f"CL position not found: {position_id}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error retrieving CL position {position_id}: {str(e)}")
            raise
    
    def update_position(self, position_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update an existing CL position.
        
        Args:
            position_id (str): The position ID
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
            
            # Add updated_at timestamp
            set_clauses.append("updated_at = ?")
            params.append(int(datetime.now().timestamp()))
            params.append(position_id)
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    query = f"UPDATE cl_positions SET {', '.join(set_clauses)} WHERE id = ?"
                    cursor.execute(query, params)
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Updated CL position: {position_id}")
                        return True
                    else:
                        logger.warning(f"CL position not found for update: {position_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error updating CL position {position_id}: {str(e)}")
            raise
    
    def close_position(self, position_id: str, exit_data: Dict[str, Any]) -> bool:
        """
        Close a CL position.
        
        Args:
            position_id (str): The position ID
            exit_data (Dict[str, Any]): Exit data including exit_date
            
        Returns:
            bool: True if position was closed successfully, False otherwise
        """
        try:
            updates = {
                'status': 'closed',
                'exit_date': exit_data.get('exit_date', datetime.now().isoformat()),
                **exit_data
            }
            
            result = self.update_position(position_id, updates)
            if result:
                logger.info(f"Closed CL position: {position_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error closing CL position {position_id}: {str(e)}")
            raise
    
    def delete_position(self, position_id: str) -> bool:
        """
        Delete a CL position.
        
        Args:
            position_id (str): The position ID
            
        Returns:
            bool: True if position was deleted successfully, False otherwise
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('DELETE FROM cl_positions WHERE id = ?', (position_id,))
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Deleted CL position: {position_id}")
                        return True
                    else:
                        logger.warning(f"CL position not found for deletion: {position_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error deleting CL position {position_id}: {str(e)}")
            raise
    
    def get_positions_by_pair(self, pair_symbol: str) -> List[Dict[str, Any]]:
        """
        Get all positions for a specific trading pair.
        
        Args:
            pair_symbol (str): The trading pair symbol (e.g., "USDC/ETH")
            
        Returns:
            List[Dict[str, Any]]: List of positions for the pair
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute(
                    'SELECT * FROM cl_positions WHERE pair_symbol = ? ORDER BY created_at DESC',
                    (pair_symbol,)
                )
                rows = cursor.fetchall()
                
                positions = [dict(row) for row in rows]
                logger.debug(f"Retrieved {len(positions)} positions for pair {pair_symbol}")
                return positions
                
        except Exception as e:
            logger.error(f"Error retrieving positions for pair {pair_symbol}: {str(e)}")
            raise
    
    def __repr__(self) -> str:
        """String representation of the CLPosition model."""
        return f"<CLPosition(db_path='{self.db_path}')>"