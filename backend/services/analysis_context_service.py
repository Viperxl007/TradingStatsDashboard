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
import requests
from .active_trade_service import ActiveTradeService

logger = logging.getLogger(__name__)

class AnalysisContextService:
    """Service for retrieving contextual analysis data based on timeframes"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize with database path"""
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
        self.active_trade_service = ActiveTradeService(self.db_path)
    
    def _safe_parse_datetime(self, datetime_str):
        """Safely parse datetime string with validation"""
        if not datetime_str or not isinstance(datetime_str, str):
            return None
        try:
            return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            try:
                # Try parsing as SQLite datetime format
                return datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S.%f')
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid datetime format: {datetime_str}, error: {e}")
                return None
    
    @staticmethod
    def get_contextual_timeframe_hours(chart_timeframe: str) -> int:
        """Determine how far back to look based on chart timeframe"""
        timeframe_context_map = {
            '1m': 2,    # 2 hours for minute charts
            '5m': 4,    # 4 hours for 5-minute charts  
            '15m': 6,   # 6 hours for 15-minute charts
            '30m': 16,   # 16 hours for 30-minute charts
            '1h': 48,   # 48 hours for hourly charts
            '4h': 72,   # 72 hours for 4-hour charts
            '1D': 96,   # 96 hours for daily charts
            '1W': 168,  # 168 hours for weekly charts
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
            
            logger.info(f"📅 Looking for {current_timeframe} analyses newer than {cutoff_time} ({lookback_hours}h ago)")
            
            # Query most recent analysis within timeframe - handle missing timeframe column gracefully
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # First, check if timeframe column exists
                cursor.execute("PRAGMA table_info(chart_analyses)")
                columns = [column[1] for column in cursor.fetchall()]
                has_timeframe_column = 'timeframe' in columns
                
                if has_timeframe_column:
                    # Use timeframe-specific query for newer records
                    cursor.execute('''
                        SELECT id, analysis_timestamp, analysis_data, confidence_score
                        FROM chart_analyses
                        WHERE ticker = ? AND analysis_timestamp >= ? AND timeframe = ?
                        ORDER BY analysis_timestamp DESC
                        LIMIT 1
                    ''', (ticker.upper(), cutoff_time, current_timeframe))
                else:
                    # Fallback to timeframe-agnostic query for older records
                    logger.warning(f"⚠️ No timeframe column found in database - using timeframe-agnostic query for {ticker}")
                    cursor.execute('''
                        SELECT id, analysis_timestamp, analysis_data, confidence_score
                        FROM chart_analyses
                        WHERE ticker = ? AND analysis_timestamp >= ?
                        ORDER BY analysis_timestamp DESC
                        LIMIT 1
                    ''', (ticker.upper(), cutoff_time))
                
                result = cursor.fetchone()
                
            if not result:
                if has_timeframe_column:
                    logger.info(f"📭 No recent analysis found for {ticker} on {current_timeframe} timeframe within {lookback_hours} hours")
                else:
                    logger.info(f"📭 No recent analysis found for {ticker} within {lookback_hours} hours (timeframe-agnostic search)")
                
                # Try expanded search window (7 days) as fallback
                logger.info(f"🔍 Trying expanded search window (7 days) for {ticker}")
                expanded_hours = 168  # 7 days
                expanded_cutoff = datetime.now() - timedelta(hours=expanded_hours)
                
                if has_timeframe_column:
                    cursor.execute('''
                        SELECT id, analysis_timestamp, analysis_data, confidence_score
                        FROM chart_analyses
                        WHERE ticker = ? AND analysis_timestamp >= ? AND timeframe = ?
                        ORDER BY analysis_timestamp DESC
                        LIMIT 1
                    ''', (ticker.upper(), expanded_cutoff, current_timeframe))
                else:
                    cursor.execute('''
                        SELECT id, analysis_timestamp, analysis_data, confidence_score
                        FROM chart_analyses
                        WHERE ticker = ? AND analysis_timestamp >= ?
                        ORDER BY analysis_timestamp DESC
                        LIMIT 1
                    ''', (ticker.upper(), expanded_cutoff))
                
                result = cursor.fetchone()
                
                if not result:
                    logger.info(f"📭 No analysis found for {ticker} even with expanded 7-day window")
                    return None
                else:
                    logger.info(f"✅ Found historical analysis for {ticker} in expanded window")
                
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
                
            # CRITICAL: Check if entry trigger was hit in candlestick data since last analysis
            # Do this first to get trigger status for context extraction
            trigger_status = self._check_entry_trigger_hit(
                ticker, current_timeframe, analysis_timestamp,
                analysis_data.get('recommendations', {}).get('entryPrice'),
                analysis_data.get('recommendations', {}).get('action', 'unknown'),
                'entry condition check'  # Will be refined in context extraction
            )
            
            # Extract key information with safe fallbacks, including trigger status
            context = self._extract_context_safely(
                analysis_data, analysis_id, analysis_timestamp, current_price, lookback_hours,
                ticker, current_timeframe, trigger_status
            )
            
            # Add metadata about search type
            context['timeframe_specific_search'] = has_timeframe_column
            
            search_type = "timeframe-specific" if has_timeframe_column else "timeframe-agnostic"
            logger.info(f"✅ Context extracted for {ticker} ({search_type}): {context['hours_ago']:.1f}h ago, "
                       f"action: {context.get('action', 'unknown')}, trigger_hit: {context.get('trigger_hit', False)}")
            
            return context
            
        except Exception as e:
            logger.error(f"❌ Error retrieving analysis context for {ticker}: {str(e)}")
            return None
    
    def _extract_context_safely(self, analysis_data: Dict, analysis_id: int,
                               analysis_timestamp: str, current_price: float,
                               lookback_hours: int, ticker: str, current_timeframe: str,
                               trigger_status: Dict = None) -> Dict[str, Any]:
        """Safely extract context data with comprehensive error handling"""
        
        try:
            # Calculate time difference
            if isinstance(analysis_timestamp, str):
                analysis_time = self._safe_parse_datetime(analysis_timestamp)
                if not analysis_time:
                    logger.warning(f"Could not parse analysis timestamp: {analysis_timestamp}")
                    return None
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
            
            # Determine context urgency - prioritize active trades over time-based categorization
            # Check if trigger was hit by calling the trigger check method
            trigger_status = self._check_entry_trigger_hit(
                ticker, current_timeframe, analysis_timestamp, entry_price, action,
                primary_strategy.get('entry_condition') if primary_strategy else 'No condition specified'
            )
            trigger_hit = trigger_status.get('trigger_hit', False)
            
            if trigger_hit:
                # If trigger was hit, this is an active position regardless of time
                context_urgency = 'active'
                context_message = f"ACTIVE POSITION ({hours_ago:.1f} hours ago) - TRIGGER HIT"
            elif hours_ago < 6:
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
                'all_entry_strategies': entry_strategies,  # Include all strategies for complete context
                # Trigger status (CRITICAL for active position detection)
                'trigger_hit': trigger_status.get('trigger_hit', False),
                'trigger_details': trigger_status.get('trigger_details'),
                'trigger_message': trigger_status.get('trigger_message')
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
    
    def _check_entry_trigger_hit(self, ticker: str, timeframe: str, last_analysis_timestamp: str,
                                entry_price: Optional[float], action: str, entry_condition: str) -> Dict[str, Any]:
        """
        Check if entry trigger was hit in candlestick data since last analysis.
        
        Args:
            ticker: Stock ticker symbol
            timeframe: Chart timeframe
            last_analysis_timestamp: Timestamp of last analysis
            entry_price: Entry price from previous analysis
            action: Trading action (buy/sell/hold)
            entry_condition: Entry condition description
            
        Returns:
            Dict with trigger status information
        """
        try:
            # Default response - no trigger detected
            default_response = {
                'trigger_hit': False,
                'trigger_details': None,
                'trigger_message': None
            }
            
            # Skip trigger check if no entry price or not a buy/sell action
            if not entry_price or action not in ['buy', 'sell']:
                logger.info(f"🔍 Skipping trigger check for {ticker}: entry_price={entry_price}, action={action}")
                return default_response
            
            # Parse last analysis timestamp
            try:
                if isinstance(last_analysis_timestamp, str):
                    last_analysis_time = self._safe_parse_datetime(last_analysis_timestamp)
                    if not last_analysis_time:
                        logger.warning(f"Could not parse last analysis timestamp: {last_analysis_timestamp}")
                        return default_response
                else:
                    last_analysis_time = last_analysis_timestamp
            except Exception as e:
                logger.warning(f"⚠️ Could not parse last analysis timestamp for {ticker}: {e}")
                return default_response
            
            # Calculate time window for checking candlestick data
            current_time = datetime.now()
            time_diff_hours = (current_time - last_analysis_time).total_seconds() / 3600
            
            # Only check if analysis is recent (within 48 hours) to avoid excessive API calls
            if time_diff_hours > 48:
                logger.info(f"🔍 Skipping trigger check for {ticker}: analysis too old ({time_diff_hours:.1f}h ago)")
                return default_response
            
            logger.info(f"🎯 Checking trigger for {ticker}: entry_price=${entry_price}, action={action}, time_window={time_diff_hours:.1f}h")
            
            # Fetch candlestick data since last analysis
            candlestick_data = self._fetch_candlestick_data_since(ticker, timeframe, last_analysis_time)
            
            if not candlestick_data:
                logger.warning(f"⚠️ No candlestick data available for {ticker} trigger check")
                return default_response
            
            # Check if trigger was hit in the candlestick data
            trigger_hit = False
            trigger_details = None
            
            for candle in candlestick_data:
                candle_time = candle.get('time', '')
                candle_high = candle.get('high', 0)
                candle_low = candle.get('low', 0)
                
                # For buy actions, check if price dipped to or below entry price
                if action == 'buy' and candle_low <= entry_price:
                    trigger_hit = True
                    trigger_details = {
                        'trigger_time': candle_time,
                        'trigger_price': candle_low,
                        'entry_price': entry_price,
                        'candle_data': candle
                    }
                    logger.info(f"🎯 BUY TRIGGER HIT for {ticker}: price dipped to ${candle_low} (target: ${entry_price}) at {candle_time}")
                    break
                
                # For sell actions, check if price rose to or above entry price
                elif action == 'sell' and candle_high >= entry_price:
                    trigger_hit = True
                    trigger_details = {
                        'trigger_time': candle_time,
                        'trigger_price': candle_high,
                        'entry_price': entry_price,
                        'candle_data': candle
                    }
                    logger.info(f"🎯 SELL TRIGGER HIT for {ticker}: price rose to ${candle_high} (target: ${entry_price}) at {candle_time}")
                    break
            
            if trigger_hit:
                trigger_message = f"ENTRY TRIGGER WAS HIT: {action.upper()} at ${trigger_details['trigger_price']} (target: ${entry_price}) on {trigger_details['trigger_time']}"
                logger.info(f"✅ {trigger_message}")
            else:
                logger.info(f"📊 No trigger hit for {ticker}: checked {len(candlestick_data)} candles since last analysis")
            
            return {
                'trigger_hit': trigger_hit,
                'trigger_details': trigger_details,
                'trigger_message': trigger_message if trigger_hit else None
            }
            
        except Exception as e:
            logger.error(f"❌ Error checking entry trigger for {ticker}: {str(e)}")
            return {
                'trigger_hit': False,
                'trigger_details': None,
                'trigger_message': None,
                'trigger_error': str(e)
            }
    
    def _fetch_candlestick_data_since(self, ticker: str, timeframe: str, since_time: datetime) -> List[Dict[str, Any]]:
        """
        Fetch candlestick data since a specific timestamp using the backend market data API.
        
        Args:
            ticker: Stock ticker symbol
            timeframe: Chart timeframe
            since_time: Fetch data since this timestamp
            
        Returns:
            List of candlestick data points
        """
        try:
            # Calculate appropriate period based on timeframe and time difference
            time_diff_hours = (datetime.now() - since_time).total_seconds() / 3600
            
            # Map timeframe to appropriate period for API call
            if timeframe in ['1m', '5m', '15m']:
                period = '1d'  # Intraday data
            elif timeframe in ['1h', '4h']:
                period = '5d' if time_diff_hours <= 120 else '1mo'  # 5 days or 1 month
            elif timeframe == '1D':
                period = '1mo' if time_diff_hours <= 720 else '3mo'  # 1 month or 3 months
            else:
                period = '1y'  # Default for weekly/monthly
            
            # Call backend market data API
            api_url = f"http://localhost:5000/api/market-data/{ticker}"
            params = {
                'timeframe': timeframe,
                'period': period
            }
            
            logger.info(f"🔍 Fetching candlestick data for {ticker} ({timeframe}) since {since_time}")
            
            response = requests.get(api_url, params=params, timeout=10)
            
            if response.status_code != 200:
                logger.warning(f"⚠️ Market data API returned status {response.status_code} for {ticker}")
                return []
            
            data = response.json()
            candlestick_data = data.get('data', [])
            
            if not candlestick_data:
                logger.warning(f"⚠️ No candlestick data returned for {ticker}")
                return []
            
            # Filter data to only include candles since the last analysis
            filtered_data = []
            since_timestamp = since_time.timestamp()
            
            for candle in candlestick_data:
                candle_time = candle.get('time', 0)
                
                # Handle different time formats
                if isinstance(candle_time, str):
                    parsed_time = self._safe_parse_datetime(candle_time)
                    if parsed_time:
                        candle_timestamp = parsed_time.timestamp()
                    else:
                        continue
                else:
                    candle_timestamp = float(candle_time)
                
                # Only include candles after the last analysis
                if candle_timestamp > since_timestamp:
                    filtered_data.append(candle)
            
            logger.info(f"📊 Filtered {len(filtered_data)} candles since last analysis from {len(candlestick_data)} total candles")
            return filtered_data
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"⚠️ Network error fetching candlestick data for {ticker}: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"❌ Error fetching candlestick data for {ticker}: {str(e)}")
            return []
    
    def get_comprehensive_context(self, ticker: str, current_timeframe: str,
                                current_price: float) -> Optional[Dict[str, Any]]:
        """
        Get comprehensive context including both historical analysis and active trade information.
        This is the primary method that should be used for getting context for AI analysis.
        
        Args:
            ticker: Stock ticker symbol
            current_timeframe: Chart timeframe
            current_price: Current market price
            
        Returns:
            Comprehensive context data or None if no relevant context found
        """
        try:
            logger.info(f"🔍 Getting comprehensive context for {ticker} at ${current_price}")
            
            # First, check for active trades
            active_trade_context = self.active_trade_service.get_trade_context_for_ai(ticker, current_price)
            
            if active_trade_context:
                logger.info(f"🎯 Active trade found for {ticker}: {active_trade_context['status']}")
                
                # For active trades, ALWAYS try to get the original analysis first to ensure context continuity
                historical_context = None
                
                if active_trade_context.get('original_analysis_id'):
                    logger.info(f"📋 Retrieving original analysis for active trade: {active_trade_context['original_analysis_id']}")
                    historical_context = self._get_analysis_by_id(active_trade_context['original_analysis_id'], ticker, current_timeframe)
                
                # If original analysis not found or no ID, fall back to recent context
                if not historical_context:
                    logger.info(f"📅 Original analysis not found, trying recent context within time window")
                    historical_context = self.get_recent_analysis_context(ticker, current_timeframe, current_price)
                
                # If still no context, try expanding the time window for active trades
                if not historical_context:
                    logger.info(f"🔍 Expanding search window for active trade context")
                    historical_context = self._get_recent_analysis_expanded_window(ticker, current_timeframe, current_price)
                
                # Merge contexts with active trade taking priority
                comprehensive_context = {
                    **active_trade_context,
                    'context_type': 'active_trade',
                    'has_context': True,
                    'historical_context': historical_context
                }
                
                # Update trade progress and check for trigger hits
                if active_trade_context['status'] == 'waiting':
                    # Check if trigger was hit since last update
                    trigger_status = self._check_entry_trigger_hit(
                        ticker, current_timeframe,
                        active_trade_context.get('trigger_hit_time') or datetime.now() - timedelta(hours=24),
                        active_trade_context['entry_price'],
                        active_trade_context['action'],
                        active_trade_context['entry_condition']
                    )
                    
                    if trigger_status.get('trigger_hit'):
                        # Update the trade to active status
                        self.active_trade_service.update_trade_trigger(ticker, trigger_status['trigger_details'])
                        # Refresh context after update
                        active_trade_context = self.active_trade_service.get_trade_context_for_ai(ticker, current_price)
                        comprehensive_context.update(active_trade_context)
                        logger.info(f"🎯 Trade trigger updated for {ticker}: now ACTIVE")
                
                return comprehensive_context
            
            else:
                # No active trade, use standard historical context
                logger.info(f"📭 No active trade for {ticker}, using historical context")
                historical_context = self.get_recent_analysis_context(ticker, current_timeframe, current_price)
                
                if historical_context:
                    historical_context['context_type'] = 'historical'
                    return historical_context
                else:
                    return None
                    
        except Exception as e:
            logger.error(f"❌ Error getting comprehensive context for {ticker}: {str(e)}")
            return None
                    
    def _get_recent_analysis_expanded_window(self, ticker: str, current_timeframe: str, current_price: float) -> Optional[Dict[str, Any]]:
        """
        Get recent analysis with expanded time window for active trades
        This ensures we don't lose context due to restrictive time windows
        """
        try:
            # Use a much larger window for active trades (7 days)
            expanded_hours = 168  # 7 days
            cutoff_time = datetime.now() - timedelta(hours=expanded_hours)
            
            logger.info(f"🔍 Expanded search: Looking for {ticker} analyses newer than {cutoff_time} ({expanded_hours}h ago)")
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check if timeframe column exists
                cursor.execute("PRAGMA table_info(chart_analyses)")
                columns = [column[1] for column in cursor.fetchall()]
                has_timeframe_column = 'timeframe' in columns
                
                if has_timeframe_column:
                    cursor.execute('''
                        SELECT id, analysis_timestamp, analysis_data, confidence_score
                        FROM chart_analyses
                        WHERE ticker = ? AND analysis_timestamp >= ? AND timeframe = ?
                        ORDER BY analysis_timestamp DESC
                        LIMIT 1
                    ''', (ticker.upper(), cutoff_time, current_timeframe))
                else:
                    cursor.execute('''
                        SELECT id, analysis_timestamp, analysis_data, confidence_score
                        FROM chart_analyses
                        WHERE ticker = ? AND analysis_timestamp >= ?
                        ORDER BY analysis_timestamp DESC
                        LIMIT 1
                    ''', (ticker.upper(), cutoff_time))
                
                result = cursor.fetchone()
                
            if not result:
                logger.info(f"📭 No analysis found for {ticker} even with expanded {expanded_hours}h window")
                return None
                
            # Parse and return the analysis
            analysis_id, analysis_timestamp, analysis_data_json, confidence_score = result
            
            try:
                analysis_data = json.loads(analysis_data_json) if analysis_data_json else {}
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON in analysis {analysis_id}")
                analysis_data = {}
            
            # Calculate time difference
            if isinstance(analysis_timestamp, str):
                analysis_time = self._safe_parse_datetime(analysis_timestamp)
                if not analysis_time:
                    logger.warning(f"Could not parse analysis timestamp: {analysis_timestamp}")
                    return None
            else:
                analysis_time = analysis_timestamp
            
            hours_ago = (datetime.now() - analysis_time).total_seconds() / 3600
            
            logger.info(f"📋 Found expanded context: Analysis {analysis_id} from {hours_ago:.1f}h ago")
            
            return {
                'analysis_id': analysis_id,
                'analysis_timestamp': analysis_timestamp,
                'hours_ago': hours_ago,
                'confidence_score': confidence_score,
                'summary': analysis_data.get('summary', 'No summary available'),
                'sentiment': analysis_data.get('sentiment', 'neutral'),
                'action': analysis_data.get('recommendations', {}).get('action', 'hold'),
                'entry_price': analysis_data.get('recommendations', {}).get('entryPrice'),
                'target_price': analysis_data.get('recommendations', {}).get('targetPrice'),
                'stop_loss': analysis_data.get('recommendations', {}).get('stopLoss'),
                'context_urgency': 'expanded_search',
                'has_context': True
            }
            
        except Exception as e:
            logger.error(f"Error in expanded window search for {ticker}: {str(e)}")
            return None
    
    def _get_analysis_by_id(self, analysis_id: int, ticker: str, current_timeframe: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a specific analysis by ID, bypassing time window restrictions.
        Used for active trades to ensure we always have the original context.
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT id, analysis_timestamp, analysis_data, confidence_score
                    FROM chart_analyses
                    WHERE id = ?
                ''', (analysis_id,))
                
                result = cursor.fetchone()
                
                if not result:
                    logger.warning(f"⚠️ No analysis found with ID {analysis_id}")
                    return None
                
                # Parse analysis data safely
                analysis_id, analysis_timestamp, analysis_data_json, confidence_score = result
                
                try:
                    analysis_data = json.loads(analysis_data_json) if analysis_data_json else {}
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Could not parse analysis_data for analysis {analysis_id}")
                    return None
                    
                if not analysis_data:
                    logger.warning(f"⚠️ Analysis found but no analysis_data available for ID {analysis_id}")
                    return None
                
                # Extract context using the same method as recent analysis
                context = self._extract_context_safely(
                    analysis_data, analysis_id, analysis_timestamp, None, None,
                    ticker, current_timeframe
                )
                
                logger.info(f"📋 Retrieved original analysis context for ID {analysis_id}")
                return context
                
        except Exception as e:
            logger.error(f"❌ Error retrieving analysis by ID {analysis_id}: {str(e)}")
            return None