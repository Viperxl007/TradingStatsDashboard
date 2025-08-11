"""
CoinMarketCap API Integration Service

This service handles all interactions with the CoinMarketCap API for collecting
real historical market data including total market cap, BTC/ETH data, and dominance metrics.

Uses CoinMarketCap Hobbyist tier for access to historical endpoints that provide
REAL historical data instead of synthetic calculations.
"""

import asyncio
import aiohttp
import logging
import time
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import json

# Windows-specific asyncio fix for aiodns compatibility
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)


@dataclass
class CMCRateLimitConfig:
    """Rate limiting configuration for CoinMarketCap API"""
    calls_per_minute: int = 333  # Hobbyist tier: 10,000 calls/month ≈ 333/day ≈ 14/hour ≈ 0.23/min
    burst_size: int = 5
    retry_delay: float = 2.0
    max_retries: int = 3


class CMCRateLimiter:
    """Token bucket rate limiter for CoinMarketCap API calls"""
    
    def __init__(self, config: CMCRateLimitConfig):
        self.config = config
        self.tokens = config.burst_size
        self.last_update = time.time()
        self.lock = asyncio.Lock()
    
    async def acquire(self) -> bool:
        """Acquire a token for API call"""
        async with self.lock:
            now = time.time()
            # Add tokens based on time elapsed
            time_passed = now - self.last_update
            tokens_to_add = time_passed * (self.config.calls_per_minute / 60.0)
            self.tokens = min(self.config.burst_size, self.tokens + tokens_to_add)
            self.last_update = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False
    
    async def wait_for_token(self):
        """Wait until a token is available"""
        while not await self.acquire():
            await asyncio.sleep(0.1)


class CoinMarketCapAPIError(Exception):
    """Custom exception for CoinMarketCap API errors"""
    pass


class CoinMarketCapService:
    """
    CoinMarketCap API integration service with rate limiting and error handling.
    
    This service provides methods to collect real historical market data from CoinMarketCap
    including total market cap, BTC/ETH data, and calculated metrics using hobbyist tier endpoints.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize CoinMarketCap service.
        
        Args:
            api_key (str): CoinMarketCap API key (required for hobbyist tier)
        """
        if not api_key:
            raise ValueError("CoinMarketCap API key is required for hobbyist tier access")
            
        self.base_url = "https://pro-api.coinmarketcap.com"
        self.api_key = api_key
        self.rate_limiter = CMCRateLimiter(CMCRateLimitConfig())
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Headers for requests
        self.headers = {
            'X-CMC_PRO_API_KEY': self.api_key,
            'Accept': 'application/json',
            'Accept-Encoding': 'deflate, gzip'
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            headers=self.headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make rate-limited request to CoinMarketCap API.
        
        Args:
            endpoint (str): API endpoint
            params (Optional[Dict[str, Any]]): Query parameters
            
        Returns:
            Dict[str, Any]: API response data
            
        Raises:
            CoinMarketCapAPIError: If API request fails
        """
        if not self.session:
            raise CoinMarketCapAPIError("Service not initialized. Use async context manager.")
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        for attempt in range(self.rate_limiter.config.max_retries + 1):
            try:
                # Wait for rate limit token
                await self.rate_limiter.wait_for_token()
                
                logger.debug(f"Making request to {url} (attempt {attempt + 1})")
                
                async with self.session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Check for API errors in response
                        if data.get('status', {}).get('error_code') != 0:
                            error_msg = data.get('status', {}).get('error_message', 'Unknown API error')
                            raise CoinMarketCapAPIError(f"API error: {error_msg}")
                        
                        logger.debug(f"Successful request to {endpoint}")
                        return data
                    
                    elif response.status == 429:  # Rate limited
                        retry_after = int(response.headers.get('Retry-After', 60))
                        logger.warning(f"Rate limited. Waiting {retry_after} seconds")
                        await asyncio.sleep(retry_after)
                        continue
                    
                    elif response.status == 401:  # Unauthorized
                        raise CoinMarketCapAPIError("Invalid API key or insufficient permissions")
                    
                    elif response.status == 402:  # Payment required
                        raise CoinMarketCapAPIError("API credit limit exceeded or subscription required")
                    
                    elif response.status >= 500:  # Server error
                        if attempt < self.rate_limiter.config.max_retries:
                            wait_time = self.rate_limiter.config.retry_delay * (2 ** attempt)
                            logger.warning(f"Server error {response.status}. Retrying in {wait_time}s")
                            await asyncio.sleep(wait_time)
                            continue
                    
                    # Client error or final attempt
                    error_text = await response.text()
                    raise CoinMarketCapAPIError(f"API request failed: {response.status} - {error_text}")
            
            except aiohttp.ClientError as e:
                if attempt < self.rate_limiter.config.max_retries:
                    wait_time = self.rate_limiter.config.retry_delay * (2 ** attempt)
                    logger.warning(f"Network error: {e}. Retrying in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                raise CoinMarketCapAPIError(f"Network error: {e}")
        
        raise CoinMarketCapAPIError("Max retries exceeded")
    
    async def get_global_metrics_historical(self, start_date: str, end_date: str, interval: str = "daily") -> List[Dict[str, Any]]:
        """
        Get historical global cryptocurrency market metrics.
        
        Args:
            start_date (str): Start date in YYYY-MM-DD format
            end_date (str): End date in YYYY-MM-DD format
            interval (str): Data interval (daily, weekly, monthly)
            
        Returns:
            List[Dict[str, Any]]: Historical global market data
        """
        try:
            params = {
                'time_start': start_date,
                'time_end': end_date,
                'interval': interval,
                'count': 100  # Max results per request
            }
            
            data = await self._make_request('/v1/global-metrics/quotes/historical', params)
            
            if 'data' not in data:
                raise CoinMarketCapAPIError("No data in global metrics response")
            
            historical_data = []
            for quote in data['data']['quotes']:
                timestamp = int(datetime.fromisoformat(quote['timestamp'].replace('Z', '+00:00')).timestamp())
                
                quote_data = quote['quote']['USD']
                
                data_point = {
                    'timestamp': timestamp,
                    'total_market_cap': quote_data.get('total_market_cap', 0),
                    'total_volume_24h': quote_data.get('total_volume_24h', 0),
                    'btc_dominance': quote_data.get('btc_dominance', 0),
                    'eth_dominance': quote_data.get('eth_dominance', 0),
                    'data_source': 'coinmarketcap_historical',
                    'data_quality_score': 1.0,  # Maximum quality for real data
                    'collection_latency_ms': 0
                }
                
                historical_data.append(data_point)
            
            logger.info(f"Retrieved {len(historical_data)} global metrics data points")
            return historical_data
            
        except Exception as e:
            logger.error(f"Error getting global metrics historical data: {e}")
            raise CoinMarketCapAPIError(f"Failed to get global metrics historical data: {e}")
    
    async def get_cryptocurrency_quotes_historical(self, symbol: str, start_date: str, end_date: str, interval: str = "daily") -> List[Dict[str, Any]]:
        """
        Get historical cryptocurrency quotes for specific coins.
        
        Args:
            symbol (str): Cryptocurrency symbol (e.g., 'BTC', 'ETH')
            start_date (str): Start date in YYYY-MM-DD format
            end_date (str): End date in YYYY-MM-DD format
            interval (str): Data interval (daily, weekly, monthly)
            
        Returns:
            List[Dict[str, Any]]: Historical cryptocurrency data
        """
        try:
            params = {
                'symbol': symbol,
                'time_start': start_date,
                'time_end': end_date,
                'interval': interval,
                'count': 100  # Max results per request
            }
            
            data = await self._make_request('/v1/cryptocurrency/quotes/historical', params)
            
            if 'data' not in data or 'quotes' not in data['data']:
                raise CoinMarketCapAPIError(f"No data in {symbol} quotes response")
            
            historical_data = []
            for quote in data['data']['quotes']:
                timestamp = int(datetime.fromisoformat(quote['timestamp'].replace('Z', '+00:00')).timestamp())
                
                quote_data = quote['quote']['USD']
                
                data_point = {
                    'timestamp': timestamp,
                    'symbol': symbol,
                    'price': quote_data.get('price', 0),
                    'market_cap': quote_data.get('market_cap', 0),
                    'volume_24h': quote_data.get('volume_24h', 0),
                    'percent_change_24h': quote_data.get('percent_change_24h', 0),
                    'data_source': 'coinmarketcap_historical'
                }
                
                historical_data.append(data_point)
            
            logger.info(f"Retrieved {len(historical_data)} {symbol} quotes data points")
            return historical_data
            
        except Exception as e:
            logger.error(f"Error getting {symbol} quotes historical data: {e}")
            raise CoinMarketCapAPIError(f"Failed to get {symbol} quotes historical data: {e}")
    
    async def get_historical_market_data(self, days: int = 90) -> List[Dict[str, Any]]:
        """
        Get REAL historical market data for macro analysis using CoinMarketCap hobbyist tier.
        
        Args:
            days (int): Number of days of historical data (max 365 for hobbyist tier)
            
        Returns:
            List[Dict[str, Any]]: REAL historical market data points from CoinMarketCap API
            
        Raises:
            CoinMarketCapAPIError: If real data cannot be retrieved
        """
        try:
            historical_data = []
            
            logger.info(f"🔍 Fetching REAL historical data from CoinMarketCap API for {days} days...")
            
            # Calculate date range
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            start_date_str = start_date.strftime('%Y-%m-%d')
            end_date_str = end_date.strftime('%Y-%m-%d')
            
            # Get global metrics (total market cap and BTC dominance) - REAL DATA
            logger.info("📊 Fetching real global market metrics...")
            global_data = await self.get_global_metrics_historical(start_date_str, end_date_str)
            
            if not global_data:
                raise CoinMarketCapAPIError("CRITICAL: No real global metrics data available from CoinMarketCap API")
            
            # Get BTC historical data - REAL DATA
            logger.info("₿ Fetching real BTC historical data...")
            btc_data = await self.get_cryptocurrency_quotes_historical('BTC', start_date_str, end_date_str)
            
            if not btc_data:
                raise CoinMarketCapAPIError("CRITICAL: No real BTC historical data available from CoinMarketCap API")
            
            # Get ETH historical data - REAL DATA
            logger.info("Ξ Fetching real ETH historical data...")
            eth_data = await self.get_cryptocurrency_quotes_historical('ETH', start_date_str, end_date_str)
            
            if not eth_data:
                raise CoinMarketCapAPIError("CRITICAL: No real ETH historical data available from CoinMarketCap API")
            
            # Create lookup dictionaries for efficient matching
            btc_lookup = {point['timestamp']: point for point in btc_data}
            eth_lookup = {point['timestamp']: point for point in eth_data}
            
            # Combine data points by timestamp
            for global_point in global_data:
                timestamp = global_point['timestamp']
                
                # Find matching BTC and ETH data
                btc_point = btc_lookup.get(timestamp)
                eth_point = eth_lookup.get(timestamp)
                
                if not btc_point or not eth_point:
                    logger.warning(f"Missing BTC or ETH data for timestamp {timestamp}, skipping")
                    continue
                
                # Calculate alt market cap from real data
                alt_market_cap = global_point['total_market_cap'] - btc_point['market_cap'] - eth_point['market_cap']
                alt_strength_index = max(0.1, min(0.9, (100 - global_point['btc_dominance']) / 100))
                
                combined_data_point = {
                    'timestamp': timestamp,
                    'total_market_cap': global_point['total_market_cap'],
                    'btc_market_cap': btc_point['market_cap'],
                    'eth_market_cap': eth_point['market_cap'],
                    'btc_price': btc_point['price'],
                    'btc_dominance': global_point['btc_dominance'],
                    'alt_market_cap': alt_market_cap,
                    'alt_strength_index': alt_strength_index,
                    'data_source': 'coinmarketcap_real_historical',
                    'data_quality_score': 1.0,  # Maximum quality for real data
                    'collection_latency_ms': 0
                }
                
                historical_data.append(combined_data_point)
            
            if not historical_data:
                raise CoinMarketCapAPIError("CRITICAL: No historical data points could be processed from CoinMarketCap API")
            
            # Sort by timestamp
            historical_data.sort(key=lambda x: x['timestamp'])
            
            logger.info(f"✅ Successfully retrieved {len(historical_data)} REAL historical data points for {days} days")
            logger.info("✅ ALL DATA IS REAL FROM COINMARKETCAP API - NO SYNTHETIC DATA")
            
            return historical_data
            
        except Exception as e:
            logger.error(f"❌ CRITICAL ERROR getting real historical market data: {e}")
            raise CoinMarketCapAPIError(f"PRODUCTION SYSTEM FAILURE: Cannot retrieve real historical data from CoinMarketCap API: {e}")
    
    async def get_current_global_metrics(self) -> Dict[str, Any]:
        """
        Get current global cryptocurrency market metrics.
        
        Returns:
            Dict[str, Any]: Current global market data
        """
        try:
            data = await self._make_request('/v1/global-metrics/quotes/latest')
            
            if 'data' not in data:
                raise CoinMarketCapAPIError("No data in global metrics response")
            
            quote_data = data['data']['quote']['USD']
            
            result = {
                'timestamp': int(datetime.now(timezone.utc).timestamp()),
                'total_market_cap': quote_data.get('total_market_cap', 0),
                'total_volume_24h': quote_data.get('total_volume_24h', 0),
                'btc_dominance': quote_data.get('btc_dominance', 0),
                'eth_dominance': quote_data.get('eth_dominance', 0),
                'data_source': 'coinmarketcap_current'
            }
            
            logger.info(f"Retrieved current global metrics: ${result['total_market_cap']:,.0f} total market cap")
            return result
            
        except Exception as e:
            logger.error(f"Error getting current global metrics: {e}")
            raise CoinMarketCapAPIError(f"Failed to get current global metrics: {e}")

    async def get_cryptocurrency_quotes_latest(self, symbols: str) -> Dict[str, Any]:
        """
        Get current/latest cryptocurrency quotes for specific symbols.
        
        Args:
            symbols (str): Comma-separated cryptocurrency symbols (e.g., 'BTC,ETH')
            
        Returns:
            Dict[str, Any]: Current cryptocurrency data
        """
        try:
            params = {
                'symbol': symbols,
                'convert': 'USD'
            }
            
            data = await self._make_request('/v1/cryptocurrency/quotes/latest', params)
            
            if 'data' not in data:
                raise CoinMarketCapAPIError("No data in cryptocurrency quotes response")
            
            result = {}
            for symbol, coin_data in data['data'].items():
                quote_data = coin_data['quote']['USD']
                result[symbol] = {
                    'symbol': symbol,
                    'name': coin_data.get('name', ''),
                    'price': quote_data.get('price', 0),
                    'market_cap': quote_data.get('market_cap', 0),
                    'volume_24h': quote_data.get('volume_24h', 0),
                    'percent_change_24h': quote_data.get('percent_change_24h', 0),
                    'last_updated': quote_data.get('last_updated', ''),
                    'timestamp': int(datetime.now(timezone.utc).timestamp()),
                    'data_source': 'coinmarketcap_latest'
                }
            
            logger.info(f"Retrieved current quotes for {len(result)} cryptocurrencies")
            return result
            
        except Exception as e:
            logger.error(f"Error getting current cryptocurrency quotes: {e}")
            raise CoinMarketCapAPIError(f"Failed to get current cryptocurrency quotes: {e}")


async def get_current_macro_data_cmc(api_key: str) -> Dict[str, Any]:
    """
    Convenience function to get current macro data from CoinMarketCap.
    
    Args:
        api_key (str): CoinMarketCap API key
        
    Returns:
        Dict[str, Any]: Current macro market data
    """
    async with CoinMarketCapService(api_key) as service:
        return await service.get_current_global_metrics()


async def get_historical_macro_data_cmc(api_key: str, days: int = 90) -> List[Dict[str, Any]]:
    """
    Convenience function to get historical macro data from CoinMarketCap.
    
    Args:
        api_key (str): CoinMarketCap API key
        days (int): Number of days of historical data
        
    Returns:
        List[Dict[str, Any]]: Historical macro market data
    """
    async with CoinMarketCapService(api_key) as service:
        return await service.get_historical_market_data(days)


if __name__ == "__main__":
    import asyncio
    import os
    
    async def test_service():
        """Test the CoinMarketCap service"""
        api_key = os.environ.get('CMC_API_KEY')
        if not api_key:
            print("Please set CMC_API_KEY environment variable")
            return
        
        try:
            async with CoinMarketCapService(api_key) as service:
                # Test current data
                print("Testing current global metrics...")
                current_data = await service.get_current_global_metrics()
                print(f"Current total market cap: ${current_data['total_market_cap']:,.0f}")
                print(f"Current BTC dominance: {current_data['btc_dominance']:.2f}%")
                
                # Test historical data (small sample)
                print("\nTesting historical data (7 days)...")
                historical_data = await service.get_historical_market_data(days=7)
                print(f"Retrieved {len(historical_data)} historical data points")
                
                if historical_data:
                    latest = historical_data[-1]
                    print(f"Latest historical point:")
                    print(f"  Date: {datetime.fromtimestamp(latest['timestamp']).strftime('%Y-%m-%d')}")
                    print(f"  Total market cap: ${latest['total_market_cap']:,.0f}")
                    print(f"  BTC dominance: {latest['btc_dominance']:.2f}%")
                    print(f"  BTC price: ${latest['btc_price']:,.2f}")
                
        except Exception as e:
            print(f"Error testing service: {e}")
    
    # Run the test
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_service())