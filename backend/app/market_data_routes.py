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
        
        if data and len(data) > 0:
            logger.info(f"✅ [MarketData] Successfully fetched {len(data)} data points for {symbol} from yfinance")
            return jsonify({
                'symbol': symbol,
                'timeframe': timeframe,
                'data': data,
                'count': len(data),
                'source': 'yfinance'
            })
        
        # Try Hyperliquid for crypto tokens if yfinance failed
        if is_crypto_symbol(symbol):
            logger.info(f"🔄 [MarketData] yfinance failed for crypto {symbol}, trying Hyperliquid...")
            hyperliquid_data = fetch_hyperliquid_data(symbol, timeframe, period)
            
            if hyperliquid_data and len(hyperliquid_data) > 0:
                logger.info(f"✅ [MarketData] Successfully fetched {len(hyperliquid_data)} data points for {symbol} from Hyperliquid")
                return jsonify({
                    'symbol': symbol,
                    'timeframe': timeframe,
                    'data': hyperliquid_data,
                    'count': len(hyperliquid_data),
                    'source': 'hyperliquid'
                })
        
        # If all methods fail
        logger.error(f"❌ [MarketData] No data found for {symbol} from any source")
        return jsonify({
            'error': f'No market data available for {symbol}',
            'symbol': symbol,
            'yf_symbol': yf_symbol,
            'attempted_sources': ['yfinance'] + (['hyperliquid'] if is_crypto_symbol(symbol) else [])
        }), 404
        
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

def is_crypto_symbol(symbol):
    """Check if symbol is a crypto symbol"""
    return symbol.endswith('USD') and symbol not in ['EURUSD', 'GBPUSD', 'JPYUSD']

def fetch_hyperliquid_data(symbol, timeframe, period):
    """Fetch data using Hyperliquid Perps Dex Info API"""
    try:
        # Convert symbol to Hyperliquid format (remove USD suffix)
        hyperliquid_symbol = convert_to_hyperliquid_symbol(symbol)
        logger.info(f"🔍 [Hyperliquid] Using symbol: {hyperliquid_symbol} for {symbol}")
        
        # Convert timeframe to Hyperliquid interval
        interval = get_hyperliquid_interval(timeframe)
        logger.info(f"📊 [Hyperliquid] Using interval: {interval} for timeframe: {timeframe}")
        
        # Calculate date range
        import time
        end_time = int(time.time() * 1000)  # Current time in milliseconds
        
        if period:
            start_time = calculate_start_time_from_period(period, end_time)
        else:
            # Default to 30 days of data for better chart analysis
            start_time = end_time - (30 * 24 * 60 * 60 * 1000)
        
        days_diff = round((end_time - start_time) / (24 * 60 * 60 * 1000))
        logger.info(f"📅 [Hyperliquid] Date range: {start_time} to {end_time}")
        logger.info(f"📊 [Hyperliquid] Requesting ~{days_diff} days of {interval} data for enhanced chart analysis")
        
        # Prepare request body
        request_body = {
            "type": "candleSnapshot",
            "req": {
                "coin": hyperliquid_symbol,
                "interval": interval,
                "startTime": start_time,
                "endTime": end_time
            }
        }
        
        logger.info(f"🌐 [Hyperliquid] Request body: {request_body}")
        
        # Make API request
        response = requests.post(
            'https://api.hyperliquid.xyz/info',
            json=request_body,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if not response.ok:
            logger.error(f"Hyperliquid API error: {response.status_code} {response.text}")
            return None
        
        data = response.json()
        
        if not isinstance(data, list) or len(data) == 0:
            logger.warning(f"No data returned from Hyperliquid for {symbol}")
            return None
        
        logger.info(f"📊 [Hyperliquid] Received {len(data)} candles")
        
        # Convert Hyperliquid format to TradingView Lightweight Charts format
        candlestick_data = []
        for candle in data:
            try:
                candlestick_data.append({
                    'time': int(candle['t'] // 1000),  # Convert from milliseconds to seconds
                    'open': round(float(candle['o']), 2),
                    'high': round(float(candle['h']), 2),
                    'low': round(float(candle['l']), 2),
                    'close': round(float(candle['c']), 2),
                    'volume': int(float(candle.get('v', 0)))  # Volume if available
                })
            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Skipping invalid candle data: {candle}, error: {e}")
                continue
        
        # Sort by time
        candlestick_data.sort(key=lambda x: x['time'])
        
        logger.info(f"✅ [Hyperliquid] Processed {len(candlestick_data)} data points")
        return candlestick_data
        
    except Exception as e:
        logger.error(f"🔴 [Hyperliquid] Fetch failed for {symbol}: {str(e)}")
        return None

def convert_to_hyperliquid_symbol(symbol):
    """Convert symbol to Hyperliquid format"""
    # Remove USD suffix and return base currency
    if symbol.endswith('USD'):
        return symbol.replace('USD', '')
    
    # Handle common symbol mappings
    symbol_map = {
        'AVAXUSD': 'AVAX',
        'BTCUSD': 'BTC',
        'ETHUSD': 'ETH',
        'SOLUSD': 'SOL',
        'ADAUSD': 'ADA',
        'DOTUSD': 'DOT',
        'LINKUSD': 'LINK',
        'MATICUSD': 'MATIC',
        'ALGOUSD': 'ALGO',
        'ATOMUSD': 'ATOM',
        'UNIUSD': 'UNI',
        'AAVEUSD': 'AAVE',
        'COMPUSD': 'COMP',
        'MKRUSD': 'MKR',
        'SNXUSD': 'SNX',
        'YFIUSD': 'YFI',
        'SUSHIUSD': 'SUSHI',
        'CRVUSD': 'CRV',
        'BALUSD': 'BAL',
        'RENUSD': 'REN',
        'KNCUSD': 'KNC',
        'ZRXUSD': 'ZRX',
        'BANDUSD': 'BAND',
        'STORJUSD': 'STORJ',
        'MANAUSD': 'MANA',
        'SANDUSD': 'SAND',
        'AXSUSD': 'AXS',
        'ENJUSD': 'ENJ',
        'CHZUSD': 'CHZ',
        'FLOWUSD': 'FLOW',
        'ICPUSD': 'ICP',
        'FILUSD': 'FIL',
        'ARUSD': 'AR',
        'GRTUSD': 'GRT',
        'LRCUSD': 'LRC',
        'SKLUSD': 'SKL',
        'ANKRUSD': 'ANKR',
        'CTSIUSD': 'CTSI',
        'OCEANUSD': 'OCEAN',
        'NMRUSD': 'NMR',
        'FETUSD': 'FET',
        'NUUSD': 'NU',
        'KEEPUSD': 'KEEP'
    }
    
    return symbol_map.get(symbol, symbol)

def get_hyperliquid_interval(timeframe):
    """Convert timeframe to Hyperliquid interval"""
    # Hyperliquid supported intervals: "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"
    interval_map = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1D': '1d',
        '1W': '1w'
    }
    
    return interval_map.get(timeframe, '1h')  # Default to 1h if not found

def calculate_start_time_from_period(period, end_time):
    """Calculate start time from period string"""
    import re
    
    period_match = re.match(r'^(\d+)([dwmy])$', period)
    if period_match:
        num, unit = period_match.groups()
        value = int(num)
        
        if unit == 'd':
            return end_time - (value * 24 * 60 * 60 * 1000)
        elif unit == 'w':
            return end_time - (value * 7 * 24 * 60 * 60 * 1000)
        elif unit == 'm':
            return end_time - (value * 30 * 24 * 60 * 60 * 1000)  # Approximate month
        elif unit == 'y':
            return end_time - (value * 365 * 24 * 60 * 60 * 1000)  # Approximate year
    
    # Handle yfinance-style periods with more generous data ranges
    period_map = {
        '1d': 1 * 24 * 60 * 60 * 1000,
        '5d': 5 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '14d': 14 * 24 * 60 * 60 * 1000,
        '1mo': 30 * 24 * 60 * 60 * 1000,
        '3mo': 90 * 24 * 60 * 60 * 1000,
        '6mo': 180 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000,
        '2y': 730 * 24 * 60 * 60 * 1000,
        '5y': 1825 * 24 * 60 * 60 * 1000,
        'max': 1825 * 24 * 60 * 60 * 1000  # 5 years max for Hyperliquid
    }
    
    if period in period_map:
        return end_time - period_map[period]
    
    # Default to 30 days for better chart analysis
    return end_time - (30 * 24 * 60 * 60 * 1000)