"""
Chart Data Integration Module

This module extends existing data sources to provide OHLCV data and market context
for AI chart analysis, following existing patterns and rate limiting.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import yfinance as yf
import pandas as pd
from app.rate_limiter import yf_rate_limiter
from app.data_fetcher import get_current_price
from app.earnings_calendar import get_earnings_calendar

logger = logging.getLogger(__name__)

class ChartDataIntegrator:
    """
    Integrates with existing data sources to provide chart context data.
    
    This class follows existing patterns for data fetching, rate limiting,
    and error handling while providing enhanced context for AI analysis.
    """
    
    def __init__(self):
        """Initialize the chart data integrator."""
        self.rate_limiter = yf_rate_limiter
    
    def get_chart_context_data(self, ticker: str, period: str = "6mo") -> Dict[str, Any]:
        """
        Get comprehensive context data for chart analysis.
        
        Args:
            ticker (str): Stock ticker symbol
            period (str): Historical data period
            
        Returns:
            Dict[str, Any]: Context data including OHLCV, metrics, and events
        """
        try:
            context_data = {
                'ticker': ticker,
                'timestamp': datetime.now().isoformat(),
                'data_sources': []
            }
            
            # Get current price using existing pattern
            try:
                current_price = get_current_price(ticker)
                if current_price:
                    context_data['current_price'] = current_price
                    context_data['data_sources'].append('current_price')
            except Exception as e:
                logger.warning(f"Could not get current price for {ticker}: {str(e)}")
            
            # Get OHLCV data with rate limiting
            try:
                ohlcv_data = self._get_ohlcv_data(ticker, period)
                if ohlcv_data:
                    context_data.update(ohlcv_data)
                    context_data['data_sources'].append('ohlcv')
            except Exception as e:
                logger.warning(f"Could not get OHLCV data for {ticker}: {str(e)}")
            
            # Get volatility metrics
            try:
                volatility_data = self._get_volatility_metrics(ticker, period)
                if volatility_data:
                    context_data.update(volatility_data)
                    context_data['data_sources'].append('volatility')
            except Exception as e:
                logger.warning(f"Could not get volatility data for {ticker}: {str(e)}")
            
            # Get earnings information
            try:
                earnings_data = self._get_earnings_context(ticker)
                if earnings_data:
                    context_data.update(earnings_data)
                    context_data['data_sources'].append('earnings')
            except Exception as e:
                logger.warning(f"Could not get earnings data for {ticker}: {str(e)}")
            
            # Get volume analysis
            try:
                volume_data = self._get_volume_analysis(ticker, period)
                if volume_data:
                    context_data.update(volume_data)
                    context_data['data_sources'].append('volume')
            except Exception as e:
                logger.warning(f"Could not get volume data for {ticker}: {str(e)}")
            
            logger.info(f"Retrieved chart context for {ticker} from sources: {context_data['data_sources']}")
            return context_data
            
        except Exception as e:
            logger.error(f"Error getting chart context for {ticker}: {str(e)}")
            return {
                'ticker': ticker,
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }
    
    def _get_ohlcv_data(self, ticker: str, period: str) -> Optional[Dict[str, Any]]:
        """
        Get OHLCV data using existing rate limiting patterns.
        
        Args:
            ticker (str): Stock ticker symbol
            period (str): Historical data period
            
        Returns:
            Optional[Dict[str, Any]]: OHLCV data and statistics
        """
        try:
            # Apply rate limiting before API call
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            
            if hist.empty:
                return None
            
            # Calculate key statistics
            latest = hist.iloc[-1]
            
            ohlcv_data = {
                'ohlcv_period': period,
                'data_points': len(hist),
                'latest_ohlc': {
                    'open': float(latest['Open']),
                    'high': float(latest['High']),
                    'low': float(latest['Low']),
                    'close': float(latest['Close']),
                    'volume': int(latest['Volume']),
                    'date': latest.name.strftime('%Y-%m-%d')
                },
                'price_range': {
                    'period_high': float(hist['High'].max()),
                    'period_low': float(hist['Low'].min()),
                    'current_position_pct': float((latest['Close'] - hist['Low'].min()) / 
                                                (hist['High'].max() - hist['Low'].min()) * 100)
                },
                'recent_performance': {
                    'change_1d': float((latest['Close'] - hist['Close'].iloc[-2]) / hist['Close'].iloc[-2] * 100) if len(hist) > 1 else 0,
                    'change_5d': float((latest['Close'] - hist['Close'].iloc[-6]) / hist['Close'].iloc[-6] * 100) if len(hist) > 5 else 0,
                    'change_20d': float((latest['Close'] - hist['Close'].iloc[-21]) / hist['Close'].iloc[-21] * 100) if len(hist) > 20 else 0
                }
            }
            
            return ohlcv_data
            
        except Exception as e:
            logger.warning(f"Error getting OHLCV data for {ticker}: {str(e)}")
            return None
    
    def _get_volatility_metrics(self, ticker: str, period: str) -> Optional[Dict[str, Any]]:
        """
        Calculate volatility metrics for context.
        
        Args:
            ticker (str): Stock ticker symbol
            period (str): Historical data period
            
        Returns:
            Optional[Dict[str, Any]]: Volatility metrics
        """
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            
            if hist.empty or len(hist) < 20:
                return None
            
            # Calculate returns
            returns = hist['Close'].pct_change().dropna()
            
            # Calculate volatility metrics
            volatility_data = {
                'volatility_metrics': {
                    'realized_vol_annualized': float(returns.std() * (252 ** 0.5) * 100),
                    'vol_20d': float(returns.tail(20).std() * (252 ** 0.5) * 100),
                    'vol_60d': float(returns.tail(60).std() * (252 ** 0.5) * 100) if len(returns) >= 60 else None,
                    'max_daily_move': float(abs(returns).max() * 100),
                    'avg_daily_move': float(abs(returns).mean() * 100)
                }
            }
            
            # Add volatility ranking if we have enough data
            if len(returns) >= 252:
                current_vol = returns.tail(20).std() * (252 ** 0.5)
                historical_vols = [returns.iloc[i:i+20].std() * (252 ** 0.5) 
                                 for i in range(len(returns) - 20)]
                vol_rank = sum(1 for vol in historical_vols if current_vol > vol) / len(historical_vols) * 100
                volatility_data['volatility_metrics']['vol_rank'] = float(vol_rank)
            
            return volatility_data
            
        except Exception as e:
            logger.warning(f"Error calculating volatility for {ticker}: {str(e)}")
            return None
    
    def _get_earnings_context(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get earnings context using existing earnings calendar functionality.
        
        Args:
            ticker (str): Stock ticker symbol
            
        Returns:
            Optional[Dict[str, Any]]: Earnings context data
        """
        try:
            # Check upcoming earnings using existing functionality
            today = datetime.now()
            
            # Check next 30 days for earnings
            earnings_data = {'earnings_context': {}}
            
            for days_ahead in range(30):
                check_date = today + timedelta(days=days_ahead)
                date_str = check_date.strftime('%Y-%m-%d')
                
                try:
                    earnings_calendar = get_earnings_calendar(date_str)
                    
                    # Look for this ticker in the earnings calendar
                    for earning in earnings_calendar:
                        if earning.get('ticker', '').upper() == ticker.upper():
                            earnings_data['earnings_context'] = {
                                'next_earnings_date': date_str,
                                'days_to_earnings': days_ahead,
                                'report_time': earning.get('reportTime', 'unknown'),
                                'company_name': earning.get('companyName', ''),
                                'is_earnings_week': days_ahead <= 7
                            }
                            return earnings_data
                            
                except Exception:
                    continue  # Skip if earnings data not available for this date
            
            # If no upcoming earnings found, note that
            earnings_data['earnings_context'] = {
                'next_earnings_date': None,
                'days_to_earnings': None,
                'is_earnings_week': False
            }
            
            return earnings_data
            
        except Exception as e:
            logger.warning(f"Error getting earnings context for {ticker}: {str(e)}")
            return None
    
    def _get_volume_analysis(self, ticker: str, period: str) -> Optional[Dict[str, Any]]:
        """
        Analyze volume patterns for context.
        
        Args:
            ticker (str): Stock ticker symbol
            period (str): Historical data period
            
        Returns:
            Optional[Dict[str, Any]]: Volume analysis data
        """
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period=period)
            
            if hist.empty or len(hist) < 20:
                return None
            
            # Calculate volume statistics
            volume_data = {
                'volume_analysis': {
                    'avg_volume_20d': int(hist['Volume'].tail(20).mean()),
                    'avg_volume_60d': int(hist['Volume'].tail(60).mean()) if len(hist) >= 60 else None,
                    'latest_volume': int(hist['Volume'].iloc[-1]),
                    'volume_ratio_20d': float(hist['Volume'].iloc[-1] / hist['Volume'].tail(20).mean()),
                    'high_volume_days': int(sum(1 for v in hist['Volume'].tail(20) 
                                              if v > hist['Volume'].tail(60).mean() * 1.5)) if len(hist) >= 60 else 0
                }
            }
            
            # Identify volume spikes
            if len(hist) >= 20:
                avg_vol = hist['Volume'].tail(20).mean()
                recent_spikes = []
                
                for i in range(min(10, len(hist))):  # Check last 10 days
                    day_data = hist.iloc[-(i+1)]
                    if day_data['Volume'] > avg_vol * 2:  # Volume spike threshold
                        recent_spikes.append({
                            'date': day_data.name.strftime('%Y-%m-%d'),
                            'volume': int(day_data['Volume']),
                            'volume_ratio': float(day_data['Volume'] / avg_vol),
                            'price_change': float((day_data['Close'] - day_data['Open']) / day_data['Open'] * 100)
                        })
                
                volume_data['volume_analysis']['recent_spikes'] = recent_spikes
            
            return volume_data
            
        except Exception as e:
            logger.warning(f"Error analyzing volume for {ticker}: {str(e)}")
            return None
    
    def get_market_context(self) -> Dict[str, Any]:
        """
        Get broader market context for analysis.
        
        Returns:
            Dict[str, Any]: Market context data
        """
        try:
            market_context = {
                'timestamp': datetime.now().isoformat(),
                'market_indices': {}
            }
            
            # Get major indices for context
            indices = {
                'SPY': 'S&P 500',
                'QQQ': 'NASDAQ',
                'IWM': 'Russell 2000',
                'VIX': 'Volatility Index'
            }
            
            for symbol, name in indices.items():
                try:
                    ticker_obj = yf.Ticker(symbol)
                    hist = ticker_obj.history(period="5d")
                    
                    if not hist.empty:
                        latest = hist.iloc[-1]
                        prev = hist.iloc[-2] if len(hist) > 1 else latest
                        
                        market_context['market_indices'][symbol] = {
                            'name': name,
                            'price': float(latest['Close']),
                            'change_pct': float((latest['Close'] - prev['Close']) / prev['Close'] * 100),
                            'volume': int(latest['Volume'])
                        }
                        
                except Exception as e:
                    logger.warning(f"Could not get data for {symbol}: {str(e)}")
                    continue
            
            return market_context
            
        except Exception as e:
            logger.error(f"Error getting market context: {str(e)}")
            return {'timestamp': datetime.now().isoformat(), 'error': str(e)}

# Global instance
chart_data_integrator = ChartDataIntegrator()