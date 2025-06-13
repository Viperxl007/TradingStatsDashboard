"""
Chart Context Module

This module manages historical context and storage for chart analyses.
It provides context data to enhance AI analysis accuracy.
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import sqlite3
import os
from threading import Lock

logger = logging.getLogger(__name__)

class ChartContextManager:
    """
    Manages historical context and storage for chart analyses.
    
    This class handles storing and retrieving analysis context,
    historical data, and related metadata to improve analysis accuracy.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the context manager with database configuration.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
        self.db_lock = Lock()
        self._ensure_database()
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            # Create instance directory if it doesn't exist
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create chart_analyses table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS chart_analyses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker TEXT NOT NULL,
                        analysis_timestamp DATETIME NOT NULL,
                        analysis_data TEXT NOT NULL,
                        confidence_score REAL,
                        image_hash TEXT,
                        context_data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create indexes for chart_analyses
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_chart_analyses_ticker
                    ON chart_analyses(ticker)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_chart_analyses_timestamp
                    ON chart_analyses(analysis_timestamp)
                ''')
                
                # Create key_levels table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS key_levels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker TEXT NOT NULL,
                        level_type TEXT NOT NULL,
                        price_level REAL NOT NULL,
                        significance REAL DEFAULT 1.0,
                        identified_at DATETIME NOT NULL,
                        last_tested DATETIME,
                        test_count INTEGER DEFAULT 0,
                        is_active BOOLEAN DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create indexes for key_levels
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_key_levels_ticker
                    ON key_levels(ticker)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_key_levels_type
                    ON key_levels(level_type)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_key_levels_price
                    ON key_levels(price_level)
                ''')
                
                # Create analysis_context table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS analysis_context (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker TEXT NOT NULL,
                        context_type TEXT NOT NULL,
                        context_data TEXT NOT NULL,
                        valid_until DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create indexes for analysis_context
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_analysis_context_ticker
                    ON analysis_context(ticker)
                ''')
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_analysis_context_type
                    ON analysis_context(context_type)
                ''')
                
                conn.commit()
                logger.info(f"Database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
    
    def store_analysis(self, ticker: str, analysis_data: Dict[str, Any], 
                      image_hash: Optional[str] = None, context_data: Optional[Dict] = None) -> int:
        """
        Store a chart analysis in the database.
        
        Args:
            ticker (str): Stock ticker symbol
            analysis_data (Dict[str, Any]): Analysis results
            image_hash (Optional[str]): Hash of the analyzed image
            context_data (Optional[Dict]): Additional context data
            
        Returns:
            int: Analysis ID
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO chart_analyses 
                        (ticker, analysis_timestamp, analysis_data, confidence_score, image_hash, context_data)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        ticker.upper(),
                        datetime.now(),
                        json.dumps(analysis_data),
                        analysis_data.get('confidence_score', 0.5),
                        image_hash,
                        json.dumps(context_data) if context_data else None
                    ))
                    
                    analysis_id = cursor.lastrowid
                    conn.commit()
                    
                    # Extract and store key levels
                    self._extract_and_store_levels(ticker, analysis_data, cursor)
                    conn.commit()
                    
                    logger.info(f"Stored analysis for {ticker} with ID {analysis_id}")
                    return analysis_id
                    
        except Exception as e:
            logger.error(f"Error storing analysis for {ticker}: {str(e)}")
            raise
    
    def update_analysis_markup(self, analysis_id: int, marked_up_chart_base64: str) -> bool:
        """
        Update an existing analysis with marked-up chart image.
        
        Args:
            analysis_id (int): ID of the analysis to update
            marked_up_chart_base64 (str): Base64 encoded marked-up chart image
            
        Returns:
            bool: True if update was successful, False if analysis not found
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # First, get the existing analysis data
                    cursor.execute('''
                        SELECT analysis_data FROM chart_analyses WHERE id = ?
                    ''', (analysis_id,))
                    
                    result = cursor.fetchone()
                    if not result:
                        logger.warning(f"Analysis {analysis_id} not found for markup update")
                        return False
                    
                    # Parse existing analysis data
                    analysis_data = json.loads(result[0])
                    
                    # Add the marked-up chart image
                    analysis_data['markedUpChartImageBase64'] = marked_up_chart_base64
                    
                    # Update the analysis data
                    cursor.execute('''
                        UPDATE chart_analyses
                        SET analysis_data = ?
                        WHERE id = ?
                    ''', (json.dumps(analysis_data), analysis_id))
                    
                    conn.commit()
                    
                    logger.info(f"Updated analysis {analysis_id} with marked-up chart")
                    return True
                    
        except Exception as e:
            logger.error(f"Error updating analysis markup for ID {analysis_id}: {str(e)}")
            raise
    
    def get_analysis_history(self, ticker: str, limit: int = 10,
                           days_back: int = 30) -> List[Dict[str, Any]]:
        """
        Get historical analyses for a ticker.
        
        Args:
            ticker (str): Stock ticker symbol
            limit (int): Maximum number of analyses to return
            days_back (int): Number of days to look back
            
        Returns:
            List[Dict[str, Any]]: List of historical analyses
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cutoff_date = datetime.now() - timedelta(days=days_back)
                
                cursor.execute('''
                    SELECT id, analysis_timestamp, analysis_data, confidence_score, context_data
                    FROM chart_analyses
                    WHERE ticker = ? AND analysis_timestamp >= ?
                    ORDER BY analysis_timestamp DESC
                    LIMIT ?
                ''', (ticker.upper(), cutoff_date, limit))
                
                results = []
                for row in cursor.fetchall():
                    analysis_id, timestamp, analysis_data, confidence, context_data = row
                    
                    try:
                        parsed_analysis = json.loads(analysis_data)
                        parsed_context = json.loads(context_data) if context_data else None
                        
                        results.append({
                            'id': analysis_id,
                            'timestamp': timestamp,
                            'analysis': parsed_analysis,
                            'confidence_score': confidence,
                            'context_data': parsed_context
                        })
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse analysis data for ID {analysis_id}")
                        continue
                
                logger.info(f"Retrieved {len(results)} historical analyses for {ticker}")
                return results
                
        except Exception as e:
            logger.error(f"Error retrieving analysis history for {ticker}: {str(e)}")
            return []
    
    def store_context(self, ticker: str, context_type: str, context_data: Dict[str, Any],
                     valid_hours: int = 24) -> bool:
        """
        Store context data for a ticker.
        
        Args:
            ticker (str): Stock ticker symbol
            context_type (str): Type of context (e.g., 'earnings', 'market_data')
            context_data (Dict[str, Any]): Context data
            valid_hours (int): Hours the context remains valid
            
        Returns:
            bool: Success status
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    valid_until = datetime.now() + timedelta(hours=valid_hours)
                    
                    # Update existing or insert new
                    cursor.execute('''
                        INSERT OR REPLACE INTO analysis_context
                        (ticker, context_type, context_data, valid_until, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        ticker.upper(),
                        context_type,
                        json.dumps(context_data),
                        valid_until,
                        datetime.now()
                    ))
                    
                    conn.commit()
                    logger.info(f"Stored {context_type} context for {ticker}")
                    return True
                    
        except Exception as e:
            logger.error(f"Error storing context for {ticker}: {str(e)}")
            return False
    
    def get_context(self, ticker: str, context_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Get context data for a ticker.
        
        Args:
            ticker (str): Stock ticker symbol
            context_type (Optional[str]): Specific context type to retrieve
            
        Returns:
            Dict[str, Any]: Context data
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                if context_type:
                    cursor.execute('''
                        SELECT context_data FROM analysis_context
                        WHERE ticker = ? AND context_type = ? 
                        AND (valid_until IS NULL OR valid_until > ?)
                        ORDER BY updated_at DESC LIMIT 1
                    ''', (ticker.upper(), context_type, datetime.now()))
                else:
                    cursor.execute('''
                        SELECT context_type, context_data FROM analysis_context
                        WHERE ticker = ? AND (valid_until IS NULL OR valid_until > ?)
                        ORDER BY updated_at DESC
                    ''', (ticker.upper(), datetime.now()))
                
                if context_type:
                    row = cursor.fetchone()
                    if row:
                        return json.loads(row[0])
                    return {}
                else:
                    context = {}
                    for row in cursor.fetchall():
                        ctx_type, ctx_data = row
                        try:
                            context[ctx_type] = json.loads(ctx_data)
                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse context data for {ticker}:{ctx_type}")
                    return context
                    
        except Exception as e:
            logger.error(f"Error retrieving context for {ticker}: {str(e)}")
            return {}
    
    def _extract_and_store_levels(self, ticker: str, analysis_data: Dict[str, Any], cursor):
        """
        Extract and store key levels from analysis data.
        
        Args:
            ticker (str): Stock ticker symbol
            analysis_data (Dict[str, Any]): Analysis results
            cursor: Database cursor
        """
        try:
            support_resistance = analysis_data.get('support_resistance', {})
            
            # Store support levels
            support_levels = support_resistance.get('key_support_levels', [])
            for level in support_levels:
                if isinstance(level, (int, float)):
                    cursor.execute('''
                        INSERT OR IGNORE INTO key_levels
                        (ticker, level_type, price_level, identified_at)
                        VALUES (?, ?, ?, ?)
                    ''', (ticker.upper(), 'support', float(level), datetime.now()))
            
            # Store resistance levels
            resistance_levels = support_resistance.get('key_resistance_levels', [])
            for level in resistance_levels:
                if isinstance(level, (int, float)):
                    cursor.execute('''
                        INSERT OR IGNORE INTO key_levels
                        (ticker, level_type, price_level, identified_at)
                        VALUES (?, ?, ?, ?)
                    ''', (ticker.upper(), 'resistance', float(level), datetime.now()))
            
            # Store entry/exit points from trading insights
            trading_insights = analysis_data.get('trading_insights', {})
            
            entry_points = trading_insights.get('entry_points', [])
            for level in entry_points:
                if isinstance(level, (int, float)):
                    cursor.execute('''
                        INSERT OR IGNORE INTO key_levels
                        (ticker, level_type, price_level, identified_at)
                        VALUES (?, ?, ?, ?)
                    ''', (ticker.upper(), 'entry', float(level), datetime.now()))
            
            exit_points = trading_insights.get('exit_points', [])
            for level in exit_points:
                if isinstance(level, (int, float)):
                    cursor.execute('''
                        INSERT OR IGNORE INTO key_levels
                        (ticker, level_type, price_level, identified_at)
                        VALUES (?, ?, ?, ?)
                    ''', (ticker.upper(), 'exit', float(level), datetime.now()))
            
        except Exception as e:
            logger.warning(f"Error extracting levels for {ticker}: {str(e)}")
    
    def get_key_levels(self, ticker: str, level_type: Optional[str] = None,
                      price_range: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """
        Get key levels for a ticker.
        
        Args:
            ticker (str): Stock ticker symbol
            level_type (Optional[str]): Filter by level type
            price_range (Optional[tuple]): (min_price, max_price) range filter
            
        Returns:
            List[Dict[str, Any]]: List of key levels
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                query = '''
                    SELECT level_type, price_level, significance, identified_at, 
                           last_tested, test_count
                    FROM key_levels
                    WHERE ticker = ? AND is_active = 1
                '''
                params = [ticker.upper()]
                
                if level_type:
                    query += ' AND level_type = ?'
                    params.append(level_type)
                
                if price_range:
                    query += ' AND price_level BETWEEN ? AND ?'
                    params.extend(price_range)
                
                query += ' ORDER BY significance DESC, identified_at DESC'
                
                cursor.execute(query, params)
                
                levels = []
                for row in cursor.fetchall():
                    level_type, price_level, significance, identified_at, last_tested, test_count = row
                    levels.append({
                        'level_type': level_type,
                        'price_level': price_level,
                        'significance': significance,
                        'identified_at': identified_at,
                        'last_tested': last_tested,
                        'test_count': test_count
                    })
                
                return levels
                
        except Exception as e:
            logger.error(f"Error retrieving key levels for {ticker}: {str(e)}")
            return []
    
    def cleanup_old_data(self, days_to_keep: int = 90) -> bool:
        """
        Clean up old analysis data.
        
        Args:
            days_to_keep (int): Number of days of data to keep
            
        Returns:
            bool: Success status
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cutoff_date = datetime.now() - timedelta(days=days_to_keep)
                    
                    # Clean up old analyses
                    cursor.execute('''
                        DELETE FROM chart_analyses 
                        WHERE created_at < ?
                    ''', (cutoff_date,))
                    
                    # Clean up expired context
                    cursor.execute('''
                        DELETE FROM analysis_context 
                        WHERE valid_until IS NOT NULL AND valid_until < ?
                    ''', (datetime.now(),))
                    
                    # Clean up old key levels (keep more recent ones)
                    old_levels_cutoff = datetime.now() - timedelta(days=days_to_keep * 2)
                    cursor.execute('''
                        DELETE FROM key_levels 
                        WHERE identified_at < ? AND test_count = 0
                    ''', (old_levels_cutoff,))
                    
                    conn.commit()
                    logger.info(f"Cleaned up data older than {days_to_keep} days")
                    return True
                    
        except Exception as e:
            logger.error(f"Error cleaning up old data: {str(e)}")
            return False
    
    def delete_analysis(self, analysis_id: int) -> bool:
        """
        Delete a specific chart analysis.
        
        Args:
            analysis_id (int): Analysis ID to delete
            
        Returns:
            bool: Success status
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Check if analysis exists
                    cursor.execute('SELECT id FROM chart_analyses WHERE id = ?', (analysis_id,))
                    if not cursor.fetchone():
                        return False
                    
                    # Delete the analysis
                    cursor.execute('DELETE FROM chart_analyses WHERE id = ?', (analysis_id,))
                    conn.commit()
                    
                    logger.info(f"Deleted analysis with ID {analysis_id}")
                    return True
                    
        except Exception as e:
            logger.error(f"Error deleting analysis {analysis_id}: {str(e)}")
            return False
    
    def delete_analyses_bulk(self, analysis_ids: List[int]) -> int:
        """
        Delete multiple chart analyses.
        
        Args:
            analysis_ids (List[int]): List of analysis IDs to delete
            
        Returns:
            int: Number of analyses successfully deleted
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    deleted_count = 0
                    for analysis_id in analysis_ids:
                        try:
                            cursor.execute('DELETE FROM chart_analyses WHERE id = ?', (analysis_id,))
                            if cursor.rowcount > 0:
                                deleted_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to delete analysis {analysis_id}: {str(e)}")
                            continue
                    
                    conn.commit()
                    logger.info(f"Bulk deleted {deleted_count} of {len(analysis_ids)} analyses")
                    return deleted_count
                    
        except Exception as e:
            logger.error(f"Error bulk deleting analyses: {str(e)}")
            return 0

# Global instance
chart_context_manager = ChartContextManager()