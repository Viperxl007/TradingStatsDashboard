"""
Macro Market Sentiment Data Models

This module defines the database models for storing macro market sentiment data
including market data, AI analysis results, and system state tracking.
"""

import sqlite3
import logging
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Union
from threading import Lock
from enum import Enum
import os

logger = logging.getLogger(__name__)


class TrendDirection(Enum):
    """Trend direction enumeration"""
    UP = "UP"
    DOWN = "DOWN"
    SIDEWAYS = "SIDEWAYS"


class TradePermission(Enum):
    """Trade permission levels"""
    NO_TRADE = "NO_TRADE"
    SELECTIVE = "SELECTIVE"
    ACTIVE = "ACTIVE"
    AGGRESSIVE = "AGGRESSIVE"


class MarketRegime(Enum):
    """Market regime classifications"""
    BTC_SEASON = "BTC_SEASON"
    ALT_SEASON = "ALT_SEASON"
    TRANSITION = "TRANSITION"
    BEAR_MARKET = "BEAR_MARKET"


class SystemStatus(Enum):
    """System status enumeration"""
    INITIALIZING = "INITIALIZING"
    ACTIVE = "ACTIVE"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"


class MacroSentimentDatabase:
    """
    Database manager for macro market sentiment data.
    
    This class handles all database operations for macro sentiment data including
    market data collection, AI analysis results, and system state tracking.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the macro sentiment database manager.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db'
        )
        self.db_lock = Lock()
        self._ensure_database()
    
    def _ensure_database(self):
        """Ensure the database and all tables exist with proper schema."""
        try:
            # Create instance directory if it doesn't exist
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create macro_market_data table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS macro_market_data (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp INTEGER NOT NULL,
                        data_source TEXT NOT NULL DEFAULT 'coingecko',
                        
                        -- Raw market data (all values in USD)
                        total_market_cap REAL NOT NULL,
                        btc_market_cap REAL NOT NULL,
                        eth_market_cap REAL NOT NULL,
                        btc_price REAL NOT NULL,
                        eth_price REAL NOT NULL,
                        
                        -- Calculated derived metrics
                        alt_market_cap REAL NOT NULL,
                        alt_strength_ratio REAL NOT NULL,
                        btc_dominance REAL NOT NULL,
                        
                        -- Data quality and metadata
                        data_quality_score REAL DEFAULT 1.0,
                        collection_latency_ms INTEGER,
                        created_at INTEGER NOT NULL,
                        
                        -- Constraints
                        UNIQUE(timestamp),
                        CHECK(total_market_cap > 0),
                        CHECK(btc_market_cap > 0),
                        CHECK(eth_market_cap > 0),
                        CHECK(btc_price > 0),
                        CHECK(eth_price > 0),
                        CHECK(btc_dominance >= 0 AND btc_dominance <= 100),
                        CHECK(data_quality_score >= 0 AND data_quality_score <= 1)
                    )
                ''')
                
                # Create macro_sentiment_analysis table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS macro_sentiment_analysis (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        analysis_timestamp INTEGER NOT NULL,
                        data_period_start INTEGER NOT NULL,
                        data_period_end INTEGER NOT NULL,
                        
                        -- Core confidence and trend analysis
                        overall_confidence INTEGER NOT NULL,
                        btc_trend_direction TEXT NOT NULL,
                        btc_trend_strength INTEGER NOT NULL,
                        eth_trend_direction TEXT NOT NULL,
                        eth_trend_strength INTEGER NOT NULL,
                        alt_trend_direction TEXT NOT NULL,
                        alt_trend_strength INTEGER NOT NULL,
                        
                        -- Trading recommendations
                        trade_permission TEXT NOT NULL,
                        market_regime TEXT NOT NULL,
                        
                        -- AI analysis metadata
                        ai_reasoning TEXT NOT NULL,
                        chart_data_hash TEXT NOT NULL,
                        processing_time_ms INTEGER NOT NULL,
                        model_used TEXT NOT NULL,
                        prompt_version TEXT DEFAULT 'v1.0',
                        
                        -- Chart images (base64 encoded)
                        btc_chart_image TEXT,
                        eth_chart_image TEXT,
                        dominance_chart_image TEXT,
                        alt_strength_chart_image TEXT,
                        eth_btc_ratio_chart_image TEXT,
                        
                        -- System metadata
                        created_at INTEGER NOT NULL,
                        
                        -- Constraints
                        UNIQUE(analysis_timestamp),
                        CHECK(overall_confidence >= 0 AND overall_confidence <= 100),
                        CHECK(btc_trend_strength >= 0 AND btc_trend_strength <= 100),
                        CHECK(eth_trend_strength >= 0 AND eth_trend_strength <= 100),
                        CHECK(alt_trend_strength >= 0 AND alt_trend_strength <= 100),
                        CHECK(btc_trend_direction IN ('UP', 'DOWN', 'SIDEWAYS')),
                        CHECK(eth_trend_direction IN ('UP', 'DOWN', 'SIDEWAYS')),
                        CHECK(alt_trend_direction IN ('UP', 'DOWN', 'SIDEWAYS')),
                        CHECK(trade_permission IN ('NO_TRADE', 'SELECTIVE', 'ACTIVE', 'AGGRESSIVE')),
                        CHECK(market_regime IN ('BTC_SEASON', 'ALT_SEASON', 'TRANSITION', 'BEAR_MARKET')),
                        CHECK(data_period_start <= data_period_end),
                        CHECK(processing_time_ms >= 0)
                    )
                ''')
                
                # Create macro_system_state table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS macro_system_state (
                        id INTEGER PRIMARY KEY DEFAULT 1,
                        
                        -- Bootstrap status
                        bootstrap_completed BOOLEAN DEFAULT FALSE,
                        bootstrap_completed_at INTEGER NULL,
                        bootstrap_data_points INTEGER DEFAULT 0,
                        bootstrap_errors TEXT NULL,
                        
                        -- Scanning system status
                        last_successful_scan INTEGER NULL,
                        last_failed_scan INTEGER NULL,
                        consecutive_failures INTEGER DEFAULT 0,
                        total_scans_completed INTEGER DEFAULT 0,
                        
                        -- Analysis system status
                        last_analysis_id INTEGER NULL,
                        last_analysis_timestamp INTEGER NULL,
                        consecutive_analysis_failures INTEGER DEFAULT 0,
                        total_analyses_completed INTEGER DEFAULT 0,
                        
                        -- System health
                        system_status TEXT DEFAULT 'INITIALIZING',
                        health_score REAL DEFAULT 1.0,
                        
                        -- Performance metrics
                        avg_scan_duration_ms INTEGER DEFAULT 0,
                        avg_analysis_duration_ms INTEGER DEFAULT 0,
                        data_quality_trend REAL DEFAULT 1.0,
                        
                        -- Configuration
                        scan_interval_hours INTEGER DEFAULT 4,
                        max_consecutive_failures INTEGER DEFAULT 3,
                        
                        -- Metadata
                        updated_at INTEGER NOT NULL,
                        
                        -- Constraints
                        CHECK (id = 1),
                        CHECK(consecutive_failures >= 0),
                        CHECK(health_score >= 0 AND health_score <= 1),
                        CHECK(data_quality_trend >= 0 AND data_quality_trend <= 1),
                        CHECK(scan_interval_hours > 0),
                        CHECK(system_status IN ('INITIALIZING', 'ACTIVE', 'ERROR', 'MAINTENANCE'))
                    )
                ''')
                
                # Add scanner_running field if it doesn't exist (migration)
                try:
                    cursor.execute('ALTER TABLE macro_system_state ADD COLUMN scanner_running BOOLEAN DEFAULT FALSE')
                    logger.info("Added scanner_running field to macro_system_state table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add scanner_running field: {e}")
                
                # ETH Integration Migration - Add eth_price field if it doesn't exist
                try:
                    cursor.execute('ALTER TABLE macro_market_data ADD COLUMN eth_price REAL')
                    logger.info("Added eth_price field to macro_market_data table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add eth_price field: {e}")
                
                # ETH Integration Migration - Add ETH trend fields if they don't exist
                try:
                    cursor.execute('ALTER TABLE macro_sentiment_analysis ADD COLUMN eth_trend_direction TEXT')
                    logger.info("Added eth_trend_direction field to macro_sentiment_analysis table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add eth_trend_direction field: {e}")
                
                try:
                    cursor.execute('ALTER TABLE macro_sentiment_analysis ADD COLUMN eth_trend_strength INTEGER')
                    logger.info("Added eth_trend_strength field to macro_sentiment_analysis table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add eth_trend_strength field: {e}")
                
                try:
                    cursor.execute('ALTER TABLE macro_sentiment_analysis ADD COLUMN eth_chart_image TEXT')
                    logger.info("Added eth_chart_image field to macro_sentiment_analysis table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add eth_chart_image field: {e}")

                # Add eth_btc_ratio_chart_image field if it doesn't exist
                try:
                    cursor.execute('ALTER TABLE macro_sentiment_analysis ADD COLUMN eth_btc_ratio_chart_image TEXT')
                    logger.info("Added eth_btc_ratio_chart_image field to macro_sentiment_analysis table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add eth_btc_ratio_chart_image field: {e}")
                
                # Create performance indexes
                indexes = [
                    # Primary performance indexes
                    'CREATE INDEX IF NOT EXISTS idx_macro_market_data_timestamp ON macro_market_data(timestamp DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_macro_market_data_source_timestamp ON macro_market_data(data_source, timestamp DESC)',
                    
                    'CREATE INDEX IF NOT EXISTS idx_macro_sentiment_analysis_timestamp ON macro_sentiment_analysis(analysis_timestamp DESC)',
                    'CREATE INDEX IF NOT EXISTS idx_macro_sentiment_confidence ON macro_sentiment_analysis(overall_confidence)',
                    'CREATE INDEX IF NOT EXISTS idx_macro_sentiment_permission ON macro_sentiment_analysis(trade_permission)',
                    'CREATE INDEX IF NOT EXISTS idx_macro_sentiment_regime ON macro_sentiment_analysis(market_regime)',
                    
                    # Composite indexes for common queries
                    'CREATE INDEX IF NOT EXISTS idx_macro_market_data_timerange ON macro_market_data(timestamp, btc_price, btc_dominance)',
                    'CREATE INDEX IF NOT EXISTS idx_macro_sentiment_recent ON macro_sentiment_analysis(analysis_timestamp DESC, overall_confidence, trade_permission)',
                    
                    # Data quality and monitoring indexes
                    'CREATE INDEX IF NOT EXISTS idx_macro_market_data_quality ON macro_market_data(data_quality_score, timestamp)',
                    'CREATE INDEX IF NOT EXISTS idx_macro_sentiment_performance ON macro_sentiment_analysis(processing_time_ms, analysis_timestamp)',
                ]
                
                for index_sql in indexes:
                    cursor.execute(index_sql)
                
                # Initialize system state if not exists
                cursor.execute('''
                    INSERT OR IGNORE INTO macro_system_state (id, updated_at) 
                    VALUES (1, ?)
                ''', (int(datetime.now(timezone.utc).timestamp()),))
                
                # Create schema version tracking
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS schema_versions (
                        component TEXT PRIMARY KEY,
                        version TEXT NOT NULL,
                        applied_at INTEGER NOT NULL
                    )
                ''')
                
                cursor.execute('''
                    INSERT OR REPLACE INTO schema_versions VALUES 
                    ('macro_sentiment', '1.0.0', ?)
                ''', (int(datetime.now(timezone.utc).timestamp()),))
                
                conn.commit()
                logger.info(f"Macro sentiment database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing macro sentiment database: {str(e)}")
            raise
    
    def insert_market_data(self, market_data: Dict[str, Any]) -> str:
        """
        Insert market data record.
        
        Args:
            market_data (Dict[str, Any]): Market data from external API
            
        Returns:
            str: The ID of the inserted record
        """
        try:
            record_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            # Calculate derived metrics
            alt_market_cap = market_data['total_market_cap'] - market_data['btc_market_cap'] - market_data['eth_market_cap']
            alt_strength_ratio = alt_market_cap / market_data['btc_price']
            btc_dominance = (market_data['btc_market_cap'] / market_data['total_market_cap']) * 100
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO macro_market_data (
                            timestamp, data_source, total_market_cap, btc_market_cap,
                            eth_market_cap, btc_price, eth_price, alt_market_cap, alt_strength_ratio,
                            btc_dominance, data_quality_score, collection_latency_ms, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        market_data['timestamp'],
                        market_data.get('data_source', 'coingecko'),
                        market_data['total_market_cap'],
                        market_data['btc_market_cap'],
                        market_data['eth_market_cap'],
                        market_data['btc_price'],
                        market_data.get('eth_price', 0),  # Default to 0 for backward compatibility
                        alt_market_cap,
                        alt_strength_ratio,
                        btc_dominance,
                        market_data.get('data_quality_score', 1.0),
                        market_data.get('collection_latency_ms'),
                        current_timestamp
                    ))
                    
                    conn.commit()
                    logger.debug(f"Inserted market data for timestamp {market_data['timestamp']}")
                    return str(cursor.lastrowid)
                    
        except Exception as e:
            logger.error(f"Error inserting market data: {str(e)}")
            raise
    
    def insert_sentiment_analysis(self, analysis_data: Dict[str, Any]) -> str:
        """
        Insert sentiment analysis result.
        
        Args:
            analysis_data (Dict[str, Any]): Analysis result from AI service
            
        Returns:
            str: The ID of the inserted analysis
        """
        try:
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO macro_sentiment_analysis (
                            analysis_timestamp, data_period_start, data_period_end,
                            overall_confidence, btc_trend_direction, btc_trend_strength,
                            eth_trend_direction, eth_trend_strength, alt_trend_direction,
                            alt_trend_strength, trade_permission, market_regime, ai_reasoning,
                            chart_data_hash, processing_time_ms, model_used, prompt_version,
                            btc_chart_image, eth_chart_image, dominance_chart_image,
                            alt_strength_chart_image, eth_btc_ratio_chart_image, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        analysis_data['analysis_timestamp'],
                        analysis_data['data_period_start'],
                        analysis_data['data_period_end'],
                        analysis_data['overall_confidence'],
                        analysis_data['btc_trend_direction'],
                        analysis_data['btc_trend_strength'],
                        analysis_data.get('eth_trend_direction', 'SIDEWAYS'),  # Default for backward compatibility
                        analysis_data.get('eth_trend_strength', 50),  # Default for backward compatibility
                        analysis_data['alt_trend_direction'],
                        analysis_data['alt_trend_strength'],
                        analysis_data['trade_permission'],
                        analysis_data['market_regime'],
                        analysis_data['ai_reasoning'],
                        analysis_data['chart_data_hash'],
                        analysis_data['processing_time_ms'],
                        analysis_data['model_used'],
                        analysis_data.get('prompt_version', 'v1.0'),
                        analysis_data.get('btc_chart_image'),
                        analysis_data.get('eth_chart_image'),
                        analysis_data.get('dominance_chart_image'),
                        analysis_data.get('alt_strength_chart_image'),
                        analysis_data.get('eth_btc_ratio_chart_image'),
                        current_timestamp
                    ))
                    
                    analysis_id = cursor.lastrowid
                    
                    # Update system state
                    cursor.execute('''
                        UPDATE macro_system_state 
                        SET last_analysis_id = ?, 
                            last_analysis_timestamp = ?,
                            total_analyses_completed = total_analyses_completed + 1,
                            consecutive_analysis_failures = 0,
                            updated_at = ?
                        WHERE id = 1
                    ''', (analysis_id, analysis_data['analysis_timestamp'], current_timestamp))
                    
                    conn.commit()
                    logger.info(f"Inserted sentiment analysis {analysis_id}")
                    return str(analysis_id)
                    
        except Exception as e:
            logger.error(f"Error inserting sentiment analysis: {str(e)}")
            raise
    
    def get_latest_sentiment(self) -> Optional[Dict[str, Any]]:
        """Get the most recent sentiment analysis."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM macro_sentiment_analysis 
                    ORDER BY analysis_timestamp DESC 
                    LIMIT 1
                ''')
                
                row = cursor.fetchone()
                return dict(row) if row else None
                
        except Exception as e:
            logger.error(f"Error getting latest sentiment: {str(e)}")
            return None
    
    def get_market_data_range(self, start_timestamp: int, end_timestamp: int) -> List[Dict[str, Any]]:
        """Get market data within timestamp range."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM macro_market_data
                    WHERE timestamp BETWEEN ? AND ?
                    ORDER BY timestamp ASC
                ''', (start_timestamp, end_timestamp))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Error getting market data range: {str(e)}")
            return []
    
    def clear_all_market_data(self) -> bool:
        """Clear all market data from the database - USE WITH EXTREME CAUTION!"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Delete all market data
                cursor.execute('DELETE FROM macro_market_data')
                
                # Reset any auto-increment counters
                cursor.execute('DELETE FROM sqlite_sequence WHERE name="macro_market_data"')
                
                conn.commit()
                
                logger.info("All market data cleared from database")
                return True
                
        except Exception as e:
            logger.error(f"Error clearing market data: {str(e)}")
            return False
    
    def delete_market_data_by_ids(self, ids: List[str]) -> bool:
        """Delete specific market data records by ID."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create placeholders for the IN clause
                placeholders = ','.join('?' * len(ids))
                
                cursor.execute(f'''
                    DELETE FROM macro_market_data
                    WHERE id IN ({placeholders})
                ''', ids)
                
                conn.commit()
                
                logger.info(f"Deleted {cursor.rowcount} market data records")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting market data: {str(e)}")
            return False
    
    def get_system_state(self) -> Optional[Dict[str, Any]]:
        """Get current system state."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM macro_system_state WHERE id = 1')
                row = cursor.fetchone()
                return dict(row) if row else None
                
        except Exception as e:
            logger.error(f"Error getting system state: {str(e)}")
            return None
    
    def update_system_state(self, updates: Dict[str, Any]) -> bool:
        """Update system state."""
        try:
            current_timestamp = int(datetime.now(timezone.utc).timestamp())
            updates['updated_at'] = current_timestamp
            
            # Build dynamic update query
            set_clauses = []
            values = []
            for key, value in updates.items():
                set_clauses.append(f"{key} = ?")
                values.append(value)
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    query = f"UPDATE macro_system_state SET {', '.join(set_clauses)} WHERE id = 1"
                    cursor.execute(query, values)
                    
                    conn.commit()
                    return cursor.rowcount > 0
                    
        except Exception as e:
            logger.error(f"Error updating system state: {str(e)}")
            return False
    
    def get_confidence_history(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get confidence history for the specified number of days."""
        try:
            start_timestamp = int(datetime.now(timezone.utc).timestamp()) - (days * 24 * 60 * 60)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT analysis_timestamp, overall_confidence, trade_permission, market_regime
                    FROM macro_sentiment_analysis 
                    WHERE analysis_timestamp > ?
                    ORDER BY analysis_timestamp ASC
                ''', (start_timestamp,))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Error getting confidence history: {str(e)}")
            return []


# Global database instance
_db_instance = None


def get_macro_db() -> MacroSentimentDatabase:
    """Get the global macro sentiment database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = MacroSentimentDatabase()
    return _db_instance


# Example usage and testing
if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    try:
        # Create database instance
        db = MacroSentimentDatabase()
        
        # Test market data insertion
        test_market_data = {
            'timestamp': int(datetime.now(timezone.utc).timestamp()),
            'total_market_cap': 2500000000000,  # $2.5T
            'btc_market_cap': 1000000000000,    # $1T
            'eth_market_cap': 400000000000,     # $400B
            'btc_price': 50000,                 # $50k
            'data_source': 'coingecko',
            'collection_latency_ms': 1500
        }
        
        market_id = db.insert_market_data(test_market_data)
        print(f"✅ Inserted test market data: {market_id}")
        
        # Test sentiment analysis insertion
        test_analysis = {
            'analysis_timestamp': int(datetime.now(timezone.utc).timestamp()),
            'data_period_start': int(datetime.now(timezone.utc).timestamp()) - 86400,
            'data_period_end': int(datetime.now(timezone.utc).timestamp()),
            'overall_confidence': 75,
            'btc_trend_direction': 'UP',
            'btc_trend_strength': 80,
            'alt_trend_direction': 'SIDEWAYS',
            'alt_trend_strength': 45,
            'trade_permission': 'ACTIVE',
            'market_regime': 'BTC_SEASON',
            'ai_reasoning': 'Test analysis reasoning',
            'chart_data_hash': 'test_hash_123',
            'processing_time_ms': 5000,
            'model_used': 'claude-sonnet-4-20250514'
        }
        
        analysis_id = db.insert_sentiment_analysis(test_analysis)
        print(f"✅ Inserted test sentiment analysis: {analysis_id}")
        
        # Test data retrieval
        latest = db.get_latest_sentiment()
        print(f"✅ Latest sentiment: {latest['overall_confidence']}% confidence")
        
        system_state = db.get_system_state()
        print(f"✅ System state: {system_state['system_status']}")
        
        print("🎉 Database tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Database test failed: {e}")