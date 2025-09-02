"""
Trading Recommendation Service

This service manages the persistence and lifecycle of AI-generated trading recommendations,
ensuring they persist across chart reloads and maintain timeframe isolation.
"""

import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
import sqlite3
import os
from threading import Lock
from enum import Enum

logger = logging.getLogger(__name__)

class RecommendationStatus(Enum):
    """Trading recommendation status enumeration"""
    ACTIVE = "active"           # Recommendation is active and valid
    EXPIRED = "expired"         # Recommendation has expired
    SUPERSEDED = "superseded"   # Replaced by newer recommendation
    DEACTIVATED = "deactivated" # Manually deactivated

class TradingRecommendationService:
    """Service for managing trading recommendation persistence and lifecycle"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize with database path"""
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
        self.db_lock = Lock()
        self._ensure_trading_recommendations_table()
    
    def _ensure_trading_recommendations_table(self):
        """Ensure the trading_recommendations table exists with proper schema"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create trading_recommendations table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS trading_recommendations (
                        id TEXT PRIMARY KEY,
                        ticker TEXT NOT NULL,
                        timeframe TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        action TEXT NOT NULL,
                        entry_price REAL,
                        target_price REAL,
                        stop_loss REAL,
                        risk_reward REAL,
                        reasoning TEXT,
                        confidence REAL,
                        is_active BOOLEAN DEFAULT 1,
                        expires_at INTEGER,
                        analysis_id TEXT,
                        ai_model TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status TEXT DEFAULT 'active'
                    )
                ''')
                
                # Add ai_model column to existing tables if it doesn't exist
                try:
                    cursor.execute('ALTER TABLE trading_recommendations ADD COLUMN ai_model TEXT')
                    logger.info("✅ Added ai_model column to trading_recommendations table")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Could not add ai_model column: {e}")
                
                # Create indexes for efficient querying
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_trading_recommendations_ticker_timeframe 
                    ON trading_recommendations(ticker, timeframe)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_trading_recommendations_active 
                    ON trading_recommendations(is_active, status, expires_at)
                ''')
                
                cursor.execute('''
                    CREATE INDEX IF NOT EXISTS idx_trading_recommendations_timestamp 
                    ON trading_recommendations(timestamp)
                ''')
                
                # Create unique constraint to prevent duplicate recommendations
                cursor.execute('''
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_recommendations_unique 
                    ON trading_recommendations(ticker, timeframe, analysis_id)
                ''')
                
                conn.commit()
                logger.info("✅ Trading recommendations table and indexes created successfully")
                
        except Exception as e:
            logger.error(f"❌ Error creating trading recommendations table: {e}")
            raise
    
    def save_trading_recommendation(self, recommendation_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save a trading recommendation to the database
        
        Args:
            recommendation_data: Dictionary containing recommendation details
            
        Returns:
            Dictionary with the saved recommendation data including database ID
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Deactivate any existing recommendations for this ticker/timeframe
                    # to ensure only one active recommendation per ticker/timeframe
                    cursor.execute('''
                        UPDATE trading_recommendations 
                        SET is_active = 0, status = 'superseded', updated_at = CURRENT_TIMESTAMP
                        WHERE ticker = ? AND timeframe = ? AND is_active = 1
                    ''', (recommendation_data['ticker'], recommendation_data['timeframe']))
                    
                    # Insert new recommendation
                    cursor.execute('''
                        INSERT INTO trading_recommendations (
                            id, ticker, timeframe, timestamp, action, entry_price,
                            target_price, stop_loss, risk_reward, reasoning,
                            confidence, is_active, expires_at, analysis_id, ai_model, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        recommendation_data['id'],
                        recommendation_data['ticker'],
                        recommendation_data['timeframe'],
                        recommendation_data['timestamp'],
                        recommendation_data['action'],
                        recommendation_data.get('entryPrice'),
                        recommendation_data.get('targetPrice'),
                        recommendation_data.get('stopLoss'),
                        recommendation_data.get('riskReward'),
                        recommendation_data.get('reasoning', ''),
                        recommendation_data.get('confidence', 0.0),
                        recommendation_data.get('isActive', True),
                        recommendation_data.get('expiresAt'),
                        recommendation_data.get('analysisId'),
                        recommendation_data.get('aiModel', 'unknown'),
                        RecommendationStatus.ACTIVE.value
                    ))
                    
                    conn.commit()
                    
                    # Return the saved recommendation with database metadata
                    result = dict(recommendation_data)
                    result['created_at'] = datetime.now().isoformat()
                    result['updated_at'] = datetime.now().isoformat()
                    result['status'] = RecommendationStatus.ACTIVE.value
                    
                    logger.info(f"✅ Saved trading recommendation: {recommendation_data['id']} for {recommendation_data['ticker']} {recommendation_data['timeframe']}")
                    return result
                    
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                # Update existing recommendation instead
                return self._update_existing_recommendation(recommendation_data)
            else:
                logger.error(f"❌ Integrity error saving trading recommendation: {e}")
                raise
        except Exception as e:
            logger.error(f"❌ Error saving trading recommendation: {e}")
            raise
    
    def _update_existing_recommendation(self, recommendation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing recommendation with the same ticker/timeframe/analysis_id"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE trading_recommendations
                    SET action = ?, entry_price = ?, target_price = ?, stop_loss = ?,
                        risk_reward = ?, reasoning = ?, confidence = ?, is_active = ?,
                        expires_at = ?, ai_model = ?, updated_at = CURRENT_TIMESTAMP, status = ?
                    WHERE ticker = ? AND timeframe = ? AND analysis_id = ?
                ''', (
                    recommendation_data['action'],
                    recommendation_data.get('entryPrice'),
                    recommendation_data.get('targetPrice'),
                    recommendation_data.get('stopLoss'),
                    recommendation_data.get('riskReward'),
                    recommendation_data.get('reasoning', ''),
                    recommendation_data.get('confidence', 0.0),
                    recommendation_data.get('isActive', True),
                    recommendation_data.get('expiresAt'),
                    recommendation_data.get('aiModel', 'unknown'),
                    RecommendationStatus.ACTIVE.value,
                    recommendation_data['ticker'],
                    recommendation_data['timeframe'],
                    recommendation_data.get('analysisId')
                ))
                
                conn.commit()
                
                result = dict(recommendation_data)
                result['updated_at'] = datetime.now().isoformat()
                result['status'] = RecommendationStatus.ACTIVE.value
                
                logger.info(f"✅ Updated existing trading recommendation: {recommendation_data['id']}")
                return result
                
        except Exception as e:
            logger.error(f"❌ Error updating existing trading recommendation: {e}")
            raise
    
    def get_active_recommendations(self, ticker: str, timeframe: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get active trading recommendations for a ticker and optionally specific timeframe
        
        Args:
            ticker: Stock ticker symbol
            timeframe: Optional timeframe filter
            
        Returns:
            List of active recommendation dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                current_time = int(datetime.now().timestamp())
                
                if timeframe:
                    cursor.execute('''
                        SELECT * FROM trading_recommendations 
                        WHERE ticker = ? AND timeframe = ? 
                        AND is_active = 1 
                        AND status = 'active'
                        AND (expires_at IS NULL OR expires_at > ?)
                        ORDER BY timestamp DESC
                    ''', (ticker, timeframe, current_time))
                else:
                    cursor.execute('''
                        SELECT * FROM trading_recommendations 
                        WHERE ticker = ? 
                        AND is_active = 1 
                        AND status = 'active'
                        AND (expires_at IS NULL OR expires_at > ?)
                        ORDER BY timeframe, timestamp DESC
                    ''', (ticker, current_time))
                
                rows = cursor.fetchall()
                
                recommendations = []
                for row in rows:
                    rec = dict(row)
                    # Convert database format to frontend format
                    rec['entryPrice'] = rec.pop('entry_price')
                    rec['targetPrice'] = rec.pop('target_price')
                    rec['stopLoss'] = rec.pop('stop_loss')
                    rec['riskReward'] = rec.pop('risk_reward')
                    rec['isActive'] = bool(rec.pop('is_active'))
                    rec['expiresAt'] = rec.pop('expires_at')
                    rec['analysisId'] = rec.pop('analysis_id')
                    rec['aiModel'] = rec.pop('ai_model', 'unknown')
                    recommendations.append(rec)
                
                logger.info(f"📋 Retrieved {len(recommendations)} active recommendations for {ticker}" + 
                           (f" {timeframe}" if timeframe else ""))
                return recommendations
                
        except Exception as e:
            logger.error(f"❌ Error retrieving active recommendations: {e}")
            return []
    
    def update_recommendation_status(self, recommendation_id: str, is_active: bool, status: Optional[str] = None) -> bool:
        """
        Update the status of a trading recommendation
        
        Args:
            recommendation_id: ID of the recommendation to update
            is_active: Whether the recommendation should be active
            status: Optional status to set
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    if status:
                        cursor.execute('''
                            UPDATE trading_recommendations 
                            SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ''', (is_active, status, recommendation_id))
                    else:
                        cursor.execute('''
                            UPDATE trading_recommendations 
                            SET is_active = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ''', (is_active, recommendation_id))
                    
                    conn.commit()
                    
                    if cursor.rowcount > 0:
                        logger.info(f"✅ Updated recommendation {recommendation_id}: active={is_active}, status={status}")
                        return True
                    else:
                        logger.warning(f"⚠️ No recommendation found with ID: {recommendation_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"❌ Error updating recommendation status: {e}")
            return False
    
    def deactivate_recommendation(self, recommendation_id: str) -> bool:
        """Deactivate a specific recommendation"""
        return self.update_recommendation_status(
            recommendation_id, 
            is_active=False, 
            status=RecommendationStatus.DEACTIVATED.value
        )
    
    def cleanup_expired_recommendations(self) -> int:
        """
        Clean up expired recommendations by marking them as expired
        
        Returns:
            Number of recommendations that were expired
        """
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    current_time = int(datetime.now().timestamp())
                    
                    cursor.execute('''
                        UPDATE trading_recommendations 
                        SET is_active = 0, status = 'expired', updated_at = CURRENT_TIMESTAMP
                        WHERE expires_at IS NOT NULL 
                        AND expires_at <= ? 
                        AND is_active = 1
                    ''', (current_time,))
                    
                    conn.commit()
                    expired_count = cursor.rowcount
                    
                    if expired_count > 0:
                        logger.info(f"🧹 Expired {expired_count} trading recommendations")
                    
                    return expired_count
                    
        except Exception as e:
            logger.error(f"❌ Error cleaning up expired recommendations: {e}")
            return 0
    
    def get_recommendation_by_id(self, recommendation_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific recommendation by ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM trading_recommendations WHERE id = ?
                ''', (recommendation_id,))
                
                row = cursor.fetchone()
                if row:
                    rec = dict(row)
                    # Convert database format to frontend format
                    rec['entryPrice'] = rec.pop('entry_price')
                    rec['targetPrice'] = rec.pop('target_price')
                    rec['stopLoss'] = rec.pop('stop_loss')
                    rec['riskReward'] = rec.pop('risk_reward')
                    rec['isActive'] = bool(rec.pop('is_active'))
                    rec['expiresAt'] = rec.pop('expires_at')
                    rec['analysisId'] = rec.pop('analysis_id')
                    return rec
                
                return None
                
        except Exception as e:
            logger.error(f"❌ Error retrieving recommendation by ID: {e}")
            return None
    
    def get_recommendations_history(self, ticker: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get historical recommendations for a ticker"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM trading_recommendations 
                    WHERE ticker = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                ''', (ticker, limit))
                
                rows = cursor.fetchall()
                
                recommendations = []
                for row in rows:
                    rec = dict(row)
                    # Convert database format to frontend format
                    rec['entryPrice'] = rec.pop('entry_price')
                    rec['targetPrice'] = rec.pop('target_price')
                    rec['stopLoss'] = rec.pop('stop_loss')
                    rec['riskReward'] = rec.pop('risk_reward')
                    rec['isActive'] = bool(rec.pop('is_active'))
                    rec['expiresAt'] = rec.pop('expires_at')
                    rec['analysisId'] = rec.pop('analysis_id')
                    recommendations.append(rec)
                
                return recommendations
                
        except Exception as e:
            logger.error(f"❌ Error retrieving recommendations history: {e}")
            return []

# Global instance for use in routes
trading_recommendation_service = TradingRecommendationService()