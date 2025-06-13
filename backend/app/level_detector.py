"""
Level Detector Module

This module extracts and manages key support/resistance levels from AI responses
and market data, providing level-based trading insights.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
import yfinance as yf
from app.chart_context import chart_context_manager

logger = logging.getLogger(__name__)

class LevelDetector:
    """
    Detects and manages key price levels for trading analysis.
    
    This class combines AI-identified levels with technical analysis
    to provide comprehensive level-based insights.
    """
    
    def __init__(self):
        """Initialize the level detector."""
        self.context_manager = chart_context_manager
    
    def extract_levels_from_analysis(self, analysis_data: Dict[str, Any]) -> Dict[str, List[float]]:
        """
        Extract key levels from AI analysis data.
        
        Args:
            analysis_data (Dict[str, Any]): AI analysis results
            
        Returns:
            Dict[str, List[float]]: Extracted levels by type
        """
        try:
            levels = {
                'support': [],
                'resistance': [],
                'entry': [],
                'exit': [],
                'stop_loss': []
            }
            
            # Extract support/resistance levels
            support_resistance = analysis_data.get('support_resistance', {})
            
            # Support levels
            support_levels = support_resistance.get('key_support_levels', [])
            for level in support_levels:
                if isinstance(level, (int, float)) and level > 0:
                    levels['support'].append(float(level))
            
            # Resistance levels
            resistance_levels = support_resistance.get('key_resistance_levels', [])
            for level in resistance_levels:
                if isinstance(level, (int, float)) and level > 0:
                    levels['resistance'].append(float(level))
            
            # Trading levels
            trading_insights = analysis_data.get('trading_insights', {})
            
            # Entry points
            entry_points = trading_insights.get('entry_points', [])
            for level in entry_points:
                if isinstance(level, (int, float)) and level > 0:
                    levels['entry'].append(float(level))
            
            # Exit points
            exit_points = trading_insights.get('exit_points', [])
            for level in exit_points:
                if isinstance(level, (int, float)) and level > 0:
                    levels['exit'].append(float(level))
            
            # Stop loss levels
            stop_loss_levels = trading_insights.get('stop_loss_levels', [])
            for level in stop_loss_levels:
                if isinstance(level, (int, float)) and level > 0:
                    levels['stop_loss'].append(float(level))
            
            # Sort and deduplicate levels
            for level_type in levels:
                levels[level_type] = sorted(list(set(levels[level_type])))
            
            logger.info(f"Extracted levels: {sum(len(v) for v in levels.values())} total")
            return levels
            
        except Exception as e:
            logger.error(f"Error extracting levels from analysis: {str(e)}")
            return {'support': [], 'resistance': [], 'entry': [], 'exit': [], 'stop_loss': []}
    
    def detect_technical_levels(self, ticker: str, period: str = "6mo") -> Dict[str, List[float]]:
        """
        Detect key levels using technical analysis.
        
        Args:
            ticker (str): Stock ticker symbol
            period (str): Historical data period
            
        Returns:
            Dict[str, List[float]]: Detected technical levels
        """
        try:
            # Get historical data
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            
            if hist.empty:
                logger.warning(f"No historical data for {ticker}")
                return {'support': [], 'resistance': []}
            
            levels = {'support': [], 'resistance': []}
            
            # Detect pivot points
            pivot_levels = self._find_pivot_points(hist)
            levels['support'].extend(pivot_levels['support'])
            levels['resistance'].extend(pivot_levels['resistance'])
            
            # Detect volume-based levels
            volume_levels = self._find_volume_levels(hist)
            levels['support'].extend(volume_levels['support'])
            levels['resistance'].extend(volume_levels['resistance'])
            
            # Detect moving average levels
            ma_levels = self._find_moving_average_levels(hist)
            levels['support'].extend(ma_levels['support'])
            levels['resistance'].extend(ma_levels['resistance'])
            
            # Clean and sort levels
            for level_type in levels:
                levels[level_type] = self._clean_levels(levels[level_type])
            
            logger.info(f"Detected {len(levels['support'])} support and {len(levels['resistance'])} resistance levels for {ticker}")
            return levels
            
        except Exception as e:
            logger.error(f"Error detecting technical levels for {ticker}: {str(e)}")
            return {'support': [], 'resistance': []}
    
    def _find_pivot_points(self, hist_data) -> Dict[str, List[float]]:
        """
        Find pivot points in price data.
        
        Args:
            hist_data: Historical price data
            
        Returns:
            Dict[str, List[float]]: Pivot support and resistance levels
        """
        try:
            highs = hist_data['High'].values
            lows = hist_data['Low'].values
            
            support_levels = []
            resistance_levels = []
            
            # Find local minima (support) and maxima (resistance)
            window = 5  # Look for pivots in 5-day windows
            
            for i in range(window, len(lows) - window):
                # Check for local minimum (support)
                if all(lows[i] <= lows[i-j] for j in range(1, window+1)) and \
                   all(lows[i] <= lows[i+j] for j in range(1, window+1)):
                    support_levels.append(lows[i])
                
                # Check for local maximum (resistance)
                if all(highs[i] >= highs[i-j] for j in range(1, window+1)) and \
                   all(highs[i] >= highs[i+j] for j in range(1, window+1)):
                    resistance_levels.append(highs[i])
            
            return {
                'support': support_levels,
                'resistance': resistance_levels
            }
            
        except Exception as e:
            logger.warning(f"Error finding pivot points: {str(e)}")
            return {'support': [], 'resistance': []}
    
    def _find_volume_levels(self, hist_data) -> Dict[str, List[float]]:
        """
        Find levels based on high volume areas.
        
        Args:
            hist_data: Historical price data
            
        Returns:
            Dict[str, List[float]]: Volume-based levels
        """
        try:
            # Find high volume days
            volume_threshold = hist_data['Volume'].quantile(0.8)
            high_volume_data = hist_data[hist_data['Volume'] >= volume_threshold]
            
            if high_volume_data.empty:
                return {'support': [], 'resistance': []}
            
            # Use VWAP-like calculation for volume levels
            vwap_levels = []
            for _, row in high_volume_data.iterrows():
                typical_price = (row['High'] + row['Low'] + row['Close']) / 3
                vwap_levels.append(typical_price)
            
            # Cluster similar levels
            clustered_levels = self._cluster_levels(vwap_levels)
            
            return {
                'support': [level for level in clustered_levels if level < hist_data['Close'].iloc[-1]],
                'resistance': [level for level in clustered_levels if level > hist_data['Close'].iloc[-1]]
            }
            
        except Exception as e:
            logger.warning(f"Error finding volume levels: {str(e)}")
            return {'support': [], 'resistance': []}
    
    def _find_moving_average_levels(self, hist_data) -> Dict[str, List[float]]:
        """
        Find levels based on key moving averages.
        
        Args:
            hist_data: Historical price data
            
        Returns:
            Dict[str, List[float]]: Moving average levels
        """
        try:
            current_price = hist_data['Close'].iloc[-1]
            levels = {'support': [], 'resistance': []}
            
            # Key moving averages
            ma_periods = [20, 50, 100, 200]
            
            for period in ma_periods:
                if len(hist_data) >= period:
                    ma_value = hist_data['Close'].rolling(window=period).mean().iloc[-1]
                    
                    if ma_value < current_price:
                        levels['support'].append(ma_value)
                    else:
                        levels['resistance'].append(ma_value)
            
            return levels
            
        except Exception as e:
            logger.warning(f"Error finding moving average levels: {str(e)}")
            return {'support': [], 'resistance': []}
    
    def _cluster_levels(self, levels: List[float], tolerance: float = 0.02) -> List[float]:
        """
        Cluster similar price levels together.
        
        Args:
            levels (List[float]): List of price levels
            tolerance (float): Clustering tolerance as percentage
            
        Returns:
            List[float]: Clustered levels
        """
        if not levels:
            return []
        
        levels = sorted(levels)
        clustered = []
        current_cluster = [levels[0]]
        
        for level in levels[1:]:
            # Check if level is within tolerance of current cluster
            cluster_avg = sum(current_cluster) / len(current_cluster)
            if abs(level - cluster_avg) / cluster_avg <= tolerance:
                current_cluster.append(level)
            else:
                # Finalize current cluster and start new one
                clustered.append(sum(current_cluster) / len(current_cluster))
                current_cluster = [level]
        
        # Add final cluster
        if current_cluster:
            clustered.append(sum(current_cluster) / len(current_cluster))
        
        return clustered
    
    def _clean_levels(self, levels: List[float], min_distance: float = 0.01) -> List[float]:
        """
        Clean and deduplicate levels.
        
        Args:
            levels (List[float]): Raw levels
            min_distance (float): Minimum distance between levels as percentage
            
        Returns:
            List[float]: Cleaned levels
        """
        if not levels:
            return []
        
        # Remove duplicates and sort
        unique_levels = sorted(list(set(levels)))
        
        # Remove levels that are too close together
        cleaned = [unique_levels[0]]
        
        for level in unique_levels[1:]:
            if abs(level - cleaned[-1]) / cleaned[-1] >= min_distance:
                cleaned.append(level)
        
        return cleaned
    
    def get_levels_near_price(self, ticker: str, current_price: float, 
                             distance_pct: float = 0.05) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get key levels near the current price.
        
        Args:
            ticker (str): Stock ticker symbol
            current_price (float): Current stock price
            distance_pct (float): Distance percentage to search around current price
            
        Returns:
            Dict[str, List[Dict[str, Any]]]: Levels near current price with metadata
        """
        try:
            # Calculate price range
            price_range = (
                current_price * (1 - distance_pct),
                current_price * (1 + distance_pct)
            )
            
            # Get stored levels from database
            stored_levels = self.context_manager.get_key_levels(
                ticker, price_range=price_range
            )
            
            # Get technical levels
            technical_levels = self.detect_technical_levels(ticker)
            
            # Combine and organize levels
            near_levels = {
                'support_below': [],
                'resistance_above': [],
                'levels_at_price': []
            }
            
            # Process stored levels
            for level_data in stored_levels:
                level_price = level_data['price_level']
                level_info = {
                    'price': level_price,
                    'type': level_data['level_type'],
                    'significance': level_data['significance'],
                    'source': 'ai_analysis',
                    'distance_pct': abs(level_price - current_price) / current_price,
                    'identified_at': level_data['identified_at']
                }
                
                if abs(level_price - current_price) / current_price <= 0.005:  # Very close to current price
                    near_levels['levels_at_price'].append(level_info)
                elif level_price < current_price:
                    near_levels['support_below'].append(level_info)
                else:
                    near_levels['resistance_above'].append(level_info)
            
            # Process technical levels
            for level_type, levels in technical_levels.items():
                for level_price in levels:
                    if price_range[0] <= level_price <= price_range[1]:
                        level_info = {
                            'price': level_price,
                            'type': level_type,
                            'significance': 0.7,  # Default significance for technical levels
                            'source': 'technical_analysis',
                            'distance_pct': abs(level_price - current_price) / current_price,
                            'identified_at': datetime.now().isoformat()
                        }
                        
                        if abs(level_price - current_price) / current_price <= 0.005:
                            near_levels['levels_at_price'].append(level_info)
                        elif level_price < current_price:
                            near_levels['support_below'].append(level_info)
                        else:
                            near_levels['resistance_above'].append(level_info)
            
            # Sort levels by distance from current price
            for category in near_levels:
                near_levels[category].sort(key=lambda x: x['distance_pct'])
            
            logger.info(f"Found {sum(len(v) for v in near_levels.values())} levels near ${current_price:.2f} for {ticker}")
            return near_levels
            
        except Exception as e:
            logger.error(f"Error getting levels near price for {ticker}: {str(e)}")
            return {'support_below': [], 'resistance_above': [], 'levels_at_price': []}
    
    def calculate_level_strength(self, ticker: str, level_price: float, 
                               level_type: str, lookback_days: int = 90) -> float:
        """
        Calculate the strength/significance of a price level.
        
        Args:
            ticker (str): Stock ticker symbol
            level_price (float): Price level to analyze
            level_type (str): Type of level (support/resistance)
            lookback_days (int): Days to look back for testing
            
        Returns:
            float: Level strength score (0.0 to 1.0)
        """
        try:
            # Get historical data
            stock = yf.Ticker(ticker)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=lookback_days)
            hist = stock.history(start=start_date, end=end_date)
            
            if hist.empty:
                return 0.5  # Default strength
            
            # Count how many times price tested this level
            tolerance = 0.02  # 2% tolerance
            test_count = 0
            bounce_count = 0
            
            for _, row in hist.iterrows():
                high, low, close = row['High'], row['Low'], row['Close']
                
                # Check if price tested the level
                if level_type == 'support':
                    if low <= level_price * (1 + tolerance) and low >= level_price * (1 - tolerance):
                        test_count += 1
                        # Check if it bounced (closed higher)
                        if close > level_price:
                            bounce_count += 1
                elif level_type == 'resistance':
                    if high >= level_price * (1 - tolerance) and high <= level_price * (1 + tolerance):
                        test_count += 1
                        # Check if it rejected (closed lower)
                        if close < level_price:
                            bounce_count += 1
            
            # Calculate strength based on tests and bounces
            if test_count == 0:
                return 0.3  # Untested level
            
            bounce_rate = bounce_count / test_count
            
            # Strength factors
            test_factor = min(test_count / 5, 1.0)  # More tests = stronger (up to 5 tests)
            bounce_factor = bounce_rate  # Higher bounce rate = stronger
            
            strength = (test_factor * 0.4 + bounce_factor * 0.6)
            return max(0.1, min(1.0, strength))
            
        except Exception as e:
            logger.warning(f"Error calculating level strength for {ticker} at ${level_price}: {str(e)}")
            return 0.5

# Global instance
level_detector = LevelDetector()