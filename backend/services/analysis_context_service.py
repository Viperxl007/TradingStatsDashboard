"""
Analysis Context Service

This service provides intelligent retrieval of recent analyses based on timeframe
to provide context for new analyses while preventing erratic recommendations.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import sqlite3
import json
import os

logger = logging.getLogger(__name__)

class AnalysisContextService:
    """Service for retrieving contextual analysis data based on timeframes"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize with database path"""
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
    
    @staticmethod
    def get_contextual_timeframe_hours(chart_timeframe: str) -> int:
        """Determine how far back to look based on chart timeframe"""
        timeframe_context_map = {
            '1m': 2,    # 2 hours for minute charts
            '5m': 4,    # 4 hours for 5-minute charts  
            '15m': 6,   # 6 hours for 15-minute charts
            '30m': 8,   # 8 hours for 30-minute charts
            '1h': 12,   # 12 hours for hourly charts
            '4h': 24,   # 24 hours for 4-hour charts
            '1D': 48,   # 48 hours for daily charts
            '1W': 168,  # 1 week for weekly charts
        }
        return timeframe_context_map.get(chart_timeframe, 24)  # Default 24 hours
    
    def get_recent_analysis_context(self, ticker: str, current_timeframe: str, 
                                  current_price: float) -> Optional[Dict[str, Any]]:
        """
        Retrieve the most recent relevant analysis for context
        Returns None if no relevant context found
        """
        try:
            logger.info(f"🔍 Retrieving context for {ticker} on {current_timeframe} timeframe")
            
            # Calculate lookback window using local time since SQLite stores local timestamps
            lookback_hours = self.get_contextual_timeframe_hours(current_timeframe)
            cutoff_time = datetime.now() - timedelta(hours=lookback_hours)
            
            logger.info(f"📅 Looking for analyses newer than {cutoff_time} ({lookback_hours}h ago)")
            
            # Query most recent analysis within timeframe
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, analysis_timestamp, analysis_data, confidence_score
                    FROM chart_analyses 
                    WHERE ticker = ? AND analysis_timestamp >= ?
                    ORDER BY analysis_timestamp DESC 
                    LIMIT 1
                ''', (ticker.upper(), cutoff_time))
                
                result = cursor.fetchone()
                
            if not result:
                logger.info(f"📭 No recent analysis found for {ticker} within {lookback_hours} hours")
                return None
                
            # Parse analysis data safely
            analysis_id, analysis_timestamp, analysis_data_json, confidence_score = result
            
            try:
                analysis_data = json.loads(analysis_data_json) if analysis_data_json else {}
            except json.JSONDecodeError:
                logger.warning(f"⚠️ Could not parse analysis_data for analysis {analysis_id}")
                return None
                
            if not analysis_data:
                logger.warning(f"⚠️ Recent analysis found but no analysis_data available")
                return None
                
            # Extract key information with safe fallbacks
            context = self._extract_context_safely(
                analysis_data, analysis_id, analysis_timestamp, current_price, lookback_hours
            )
            
            logger.info(f"✅ Context extracted for {ticker}: {context['hours_ago']:.1f}h ago, "
                       f"action: {context.get('action', 'unknown')}")
            
            return context
            
        except Exception as e:
            logger.error(f"❌ Error retrieving analysis context for {ticker}: {str(e)}")
            return None
    
    def _extract_context_safely(self, analysis_data: Dict, analysis_id: int, 
                               analysis_timestamp: str, current_price: float, 
                               lookback_hours: int) -> Dict[str, Any]:
        """Safely extract context data with comprehensive error handling"""
        
        try:
            # Calculate time difference
            if isinstance(analysis_timestamp, str):
                # Handle different timestamp formats
                try:
                    analysis_time = datetime.fromisoformat(analysis_timestamp.replace('Z', '+00:00'))
                except ValueError:
                    # Try parsing as SQLite datetime format
                    analysis_time = datetime.strptime(analysis_timestamp, '%Y-%m-%d %H:%M:%S.%f')
            else:
                analysis_time = analysis_timestamp
            
            # Use local time for comparison since SQLite stores local timestamps
            current_time = datetime.now()
            hours_ago = (current_time - analysis_time).total_seconds() / 3600
            
            # Extract recommendation data safely
            recommendations = analysis_data.get('recommendations', {})
            action = recommendations.get('action', 'unknown')
            entry_price = recommendations.get('entryPrice')
            target_price = recommendations.get('targetPrice')
            stop_loss = recommendations.get('stopLoss')
            reasoning = recommendations.get('reasoning', 'No reasoning available')
            
            # Extract detailed entry strategies from trading analysis
            detailed_analysis = analysis_data.get('detailedAnalysis', {})
            trading_analysis = detailed_analysis.get('tradingAnalysis', {})
            entry_strategies = trading_analysis.get('entry_strategies', [])
            
            # Find the primary entry strategy (usually the first one or the one matching the main recommendation)
            primary_strategy = None
            if entry_strategies:
                # Try to find strategy matching the main entry price
                for strategy in entry_strategies:
                    if strategy.get('entry_price') == entry_price:
                        primary_strategy = strategy
                        break
                # If no match, use the first strategy
                if not primary_strategy:
                    primary_strategy = entry_strategies[0]
            
            # Extract other key data
            sentiment = analysis_data.get('sentiment', 'neutral')
            confidence = analysis_data.get('confidence', 0.0)
            timeframe = analysis_data.get('timeframe', 'unknown')
            summary = analysis_data.get('summary', 'No summary available')
            
            # Determine context urgency based on time elapsed
            if hours_ago < 6:
                context_urgency = 'recent'
                context_message = f"RECENT POSITION ({hours_ago:.1f} hours ago)"
            elif hours_ago < 24:
                context_urgency = 'active' 
                context_message = f"ACTIVE POSITION ({hours_ago:.1f} hours ago)"
            else:
                context_urgency = 'reference'
                context_message = f"Previous analysis from {hours_ago:.0f} hours ago noted for reference only"
                
            # Get the price at the time of the previous analysis
            previous_analysis_price = analysis_data.get('currentPrice') or analysis_data.get('current_price', 0.0)
            
            return {
                'has_context': True,
                'hours_ago': hours_ago,
                'context_urgency': context_urgency,
                'context_message': context_message,
                'action': action,
                'entry_price': entry_price,
                'target_price': target_price,
                'stop_loss': stop_loss,
                'sentiment': sentiment,
                'confidence': confidence,
                'timeframe': timeframe,
                'summary': summary,
                'reasoning': reasoning,
                'analysis_id': analysis_id,
                'current_price': current_price,
                'previous_analysis_price': previous_analysis_price,  # CRITICAL: Price when analysis was made
                # Entry strategy details (CRITICAL for position status)
                'entry_strategy': primary_strategy.get('strategy_type') if primary_strategy else 'unknown',
                'entry_condition': primary_strategy.get('entry_condition') if primary_strategy else 'No condition specified',
                'entry_probability': primary_strategy.get('probability') if primary_strategy else 'unknown',
                'all_entry_strategies': entry_strategies  # Include all strategies for complete context
            }
            
        except Exception as e:
            logger.error(f"❌ Error extracting context data: {str(e)}")
            # Return minimal context on error
            return {
                'has_context': True,
                'hours_ago': 999,  # Mark as very old
                'context_urgency': 'error',
                'context_message': 'Previous analysis found but could not be parsed',
                'action': 'unknown',
                'current_price': current_price
            }