"""
Market Data Routes for Real-Time Trading Data

This module provides endpoints for fetching real market data for the trading dashboard.
It integrates with multiple data sources to ensure reliable market data availability.
"""

import yfinance as yf
import requests
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

market_data_bp = Blueprint('market_data', __name__)

@market_data_bp.route('/api/market-data/<symbol>', methods=['GET'])
def get_market_data(symbol):
    """
    Get real market data for a symbol
    
    Args:
        symbol: Stock/crypto symbol (e.g., AVAXUSD, AAPL)
        
    Query Parameters:
        timeframe: Chart timeframe (1m, 5m, 15m, 1h, 4h, 1D, 1W)
        limit: Number of data points to return (default: 100)
    
    Returns:
        JSON with market data in TradingView Lightweight Charts format
    """
    try:
        timeframe = request.args.get('timeframe', '1D')
        period = request.args.get('period', '1y')  # Default to 1 year
        
        logger.info(f"Fetching market data for {symbol} ({timeframe})")
        
        # Convert symbol to yfinance format
        yf_symbol = convert_to_yfinance_symbol(symbol)
        logger.info(f"Converted {symbol} to yfinance symbol: {yf_symbol}")
        
        # Fetch data using yfinance
        data = fetch_yfinance_data(yf_symbol, timeframe, period)
        
        if not data:
            logger.error(f"No data found for {symbol}")
            return jsonify({
                'error': f'No market data available for {symbol}',
                'symbol': symbol,
                'yf_symbol': yf_symbol
            }), 404
        
        logger.info(f"Successfully fetched {len(data)} data points for {symbol}")
        
        return jsonify({
            'symbol': symbol,
            'timeframe': timeframe,
            'data': data,
            'count': len(data),
            'source': 'yfinance'
        })
        
    except Exception as e:
        logger.error(f"Error fetching market data for {symbol}: {str(e)}")
        return jsonify({
            'error': f'Failed to fetch market data: {str(e)}',
            'symbol': symbol
        }), 500

def convert_to_yfinance_symbol(symbol):
    """Convert symbol to yfinance format"""
    
    # Handle crypto pairs
    if symbol.endswith('USD'):
        base = symbol.replace('USD', '')
        return f"{base}-USD"
    
    # Common symbol mappings
    symbol_map = {
        'AVAXUSD': 'AVAX-USD',
        'BTCUSD': 'BTC-USD', 
        'ETHUSD': 'ETH-USD',
        'SOLUSD': 'SOL-USD',
        'ADAUSD': 'ADA-USD',
        'DOTUSD': 'DOT-USD',
        'LINKUSD': 'LINK-USD',
        'MATICUSD': 'MATIC-USD',
        'ALGOUSD': 'ALGO-USD',
        'ATOMUSD': 'ATOM-USD',
    }
    
    return symbol_map.get(symbol, symbol)

def fetch_yfinance_data(symbol, timeframe, period):
    """Fetch data using yfinance"""
    try:
        # Get interval from timeframe
        interval = get_yfinance_interval(timeframe)
        
        # Convert period to yfinance format
        yf_period = convert_period_to_yfinance(period)
        
        logger.info(f"Fetching {symbol} with period={yf_period}, interval={interval}")
        
        # Create ticker object
        ticker = yf.Ticker(symbol)
        
        # Fetch historical data
        hist = ticker.history(period=yf_period, interval=interval)
        
        if hist.empty:
            logger.warning(f"No historical data found for {symbol}")
            return None
        
        # Convert to TradingView Lightweight Charts format
        data = []
        for index, row in hist.iterrows():
            timestamp = int(index.timestamp())
            data.append({
                'time': timestamp,
                'open': round(float(row['Open']), 2),
                'high': round(float(row['High']), 2),
                'low': round(float(row['Low']), 2),
                'close': round(float(row['Close']), 2),
                'volume': int(row['Volume']) if 'Volume' in row else 0
            })
        
        # Return all data points (no limit needed since period controls the range)
        return data
        
    except Exception as e:
        logger.error(f"yfinance fetch failed for {symbol}: {str(e)}")
        return None

def get_yfinance_interval(timeframe):
    """Get yfinance interval from timeframe"""
    
    # Map timeframes to yfinance intervals
    interval_map = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '1h',  # yfinance doesn't have 4h, use 1h
        '1D': '1d',
        '1W': '1wk'
    }
    
    return interval_map.get(timeframe, '1d')

def convert_period_to_yfinance(period):
    """Convert our period format to yfinance format"""
    
    # Handle common period formats
    period_map = {
        '1w': '7d',      # 1 week = 7 days
        '2w': '14d',     # 2 weeks = 14 days
        '1mo': '1mo',    # 1 month (yfinance supports this)
        '3mo': '3mo',    # 3 months (yfinance supports this)
        '6mo': '6mo',    # 6 months (yfinance supports this)
        '1y': '1y',      # 1 year (yfinance supports this)
        '2y': '2y',      # 2 years (yfinance supports this)
        '5y': '5y',      # 5 years (yfinance supports this)
        'max': 'max'     # Maximum available data
    }
    
    # Check if it's already in yfinance format (like '7d', '1mo', etc.)
    if period in ['1d', '5d', '7d', '14d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'ytd', 'max']:
        return period
    
    # Convert from our format to yfinance format
    return period_map.get(period, period)