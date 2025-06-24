"""
DexScreener API Service

This module provides integration with the DexScreener API for fetching
real-time token price data and market information for CL positions.
"""

import requests
import logging
import time
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
import json
from threading import Lock

logger = logging.getLogger(__name__)


class DexScreenerService:
    """
    Service for interacting with the DexScreener API.
    
    Provides methods for fetching token data, handling rate limits,
    and caching responses for efficient data retrieval.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the DexScreener service.
        
        Args:
            config (Optional[Dict[str, Any]]): Configuration dictionary
        """
        # Import config here to avoid circular imports
        try:
            from backend.local_config import (
                DEXSCREENER_BASE_URL, 
                DEXSCREENER_RATE_LIMIT,
                SUPPORTED_CHAINS
            )
            self.base_url = DEXSCREENER_BASE_URL
            self.rate_limit = DEXSCREENER_RATE_LIMIT
            self.supported_chains = SUPPORTED_CHAINS
        except ImportError:
            # Fallback configuration
            self.base_url = 'https://api.dexscreener.com/latest'
            self.rate_limit = {"rate": 300, "per": 60.0, "burst": 10}
            self.supported_chains = {
                'hyperevm': {'chain_id': 'hyperevm'},
                'ethereum': {'chain_id': 'ethereum'},
                'polygon': {'chain_id': 'polygon'}
            }
        
        # Rate limiting state
        self._request_times = []
        self._rate_lock = Lock()
        
        # Response cache
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes cache TTL
        self._cache_lock = Lock()
        
        logger.info("DexScreener service initialized")
    
    def _check_rate_limit(self) -> bool:
        """
        Check if we can make a request without exceeding rate limits.
        
        Returns:
            bool: True if request can be made, False otherwise
        """
        with self._rate_lock:
            now = time.time()
            
            # Remove old requests outside the time window
            cutoff = now - self.rate_limit['per']
            self._request_times = [t for t in self._request_times if t > cutoff]
            
            # Check if we're under the rate limit
            if len(self._request_times) < self.rate_limit['rate']:
                self._request_times.append(now)
                return True
            
            return False
    
    def _wait_for_rate_limit(self) -> None:
        """Wait until we can make a request within rate limits."""
        while not self._check_rate_limit():
            time.sleep(1)
    
    def _get_cache_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """
        Generate a cache key for the request.
        
        Args:
            endpoint (str): API endpoint
            params (Dict[str, Any]): Request parameters
            
        Returns:
            str: Cache key
        """
        param_str = json.dumps(params, sort_keys=True)
        return f"{endpoint}:{param_str}"
    
    def _get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Get cached response if still valid.
        
        Args:
            cache_key (str): Cache key
            
        Returns:
            Optional[Dict[str, Any]]: Cached response or None
        """
        with self._cache_lock:
            if cache_key in self._cache:
                cached_data, timestamp = self._cache[cache_key]
                if time.time() - timestamp < self._cache_ttl:
                    logger.debug(f"Cache hit for key: {cache_key}")
                    return cached_data
                else:
                    # Remove expired cache entry
                    del self._cache[cache_key]
        
        return None
    
    def _cache_response(self, cache_key: str, response: Dict[str, Any]) -> None:
        """
        Cache the API response.
        
        Args:
            cache_key (str): Cache key
            response (Dict[str, Any]): Response to cache
        """
        with self._cache_lock:
            self._cache[cache_key] = (response, time.time())
            logger.debug(f"Cached response for key: {cache_key}")
    
    def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make a request to the DexScreener API with rate limiting and caching.
        
        Args:
            endpoint (str): API endpoint
            params (Optional[Dict[str, Any]]): Request parameters
            
        Returns:
            Dict[str, Any]: API response
            
        Raises:
            requests.RequestException: If the request fails
        """
        params = params or {}
        cache_key = self._get_cache_key(endpoint, params)
        
        # Check cache first
        cached_response = self._get_cached_response(cache_key)
        if cached_response:
            return cached_response
        
        # Wait for rate limit if needed
        self._wait_for_rate_limit()
        
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        try:
            logger.debug(f"Making request to: {url} with params: {params}")
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Cache the response
            self._cache_response(cache_key, data)
            
            logger.debug(f"Successfully fetched data from {url}")
            return data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed for {url}: {str(e)}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response from {url}: {str(e)}")
            raise
    
    def get_token_data(self, chain_id: str, token_address: str) -> Optional[Dict[str, Any]]:
        """
        Get token data for a specific token on a chain.
        
        Args:
            chain_id (str): Blockchain chain ID
            token_address (str): Token contract address
            
        Returns:
            Optional[Dict[str, Any]]: Token data or None if not found
        """
        try:
            # DexScreener API format: /dex/tokens/{tokenAddress} (no chain in URL)
            endpoint = f"dex/tokens/{token_address}"
            response = self._make_request(endpoint)
            
            if 'pairs' in response and response['pairs']:
                # Filter pairs by the requested chain_id and find the most liquid one
                chain_pairs = [pair for pair in response['pairs'] if pair.get('chainId') == chain_id]
                
                if not chain_pairs:
                    # If no pairs found for the specific chain, try with any chain
                    logger.warning(f"No pairs found for token {token_address} on {chain_id}, using first available pair")
                    chain_pairs = response['pairs']
                
                if chain_pairs:
                    # Return the first pair data (most liquid)
                    pair_data = chain_pairs[0]
                    
                    return {
                        'token_address': token_address,
                        'chain_id': pair_data.get('chainId', chain_id),
                        'price_usd': float(pair_data.get('priceUsd', 0)),
                        'price_native': float(pair_data.get('priceNative', 0)),
                        'volume_24h': float(pair_data.get('volume', {}).get('h24', 0)),
                        'liquidity_usd': float(pair_data.get('liquidity', {}).get('usd', 0)),
                        'pair_address': pair_data.get('pairAddress'),
                        'dex_id': pair_data.get('dexId'),
                        'pair_symbol': pair_data.get('baseToken', {}).get('symbol', ''),
                        'timestamp': datetime.utcnow().isoformat()
                    }
            
            logger.warning(f"No pairs found for token {token_address} on {chain_id}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to get token data for {token_address} on {chain_id}: {str(e)}")
            return None
    
    def get_multiple_tokens(self, token_requests: List[Dict[str, str]]) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Get data for multiple tokens efficiently.
        
        Args:
            token_requests (List[Dict[str, str]]): List of token requests with 'chain_id' and 'address'
            
        Returns:
            Dict[str, Optional[Dict[str, Any]]]: Token data keyed by "chain_id:address"
        """
        results = {}
        
        # Group requests by chain to optimize API calls
        chain_groups = {}
        for req in token_requests:
            chain_id = req['chain_id']
            address = req['address']
            
            if chain_id not in chain_groups:
                chain_groups[chain_id] = []
            chain_groups[chain_id].append(address)
        
        # Process each chain group
        for chain_id, addresses in chain_groups.items():
            # DexScreener supports batch requests (up to 30 tokens)
            batch_size = 30
            
            for i in range(0, len(addresses), batch_size):
                batch_addresses = addresses[i:i + batch_size]
                
                try:
                    # For batch requests, we'll make individual calls
                    # DexScreener API doesn't have a true batch endpoint
                    for address in batch_addresses:
                        key = f"{chain_id}:{address}"
                        token_data = self.get_token_data(chain_id, address)
                        results[key] = token_data
                        
                        # Small delay between requests to be respectful
                        time.sleep(0.1)
                        
                except Exception as e:
                    logger.error(f"Failed to process batch for chain {chain_id}: {str(e)}")
                    # Mark failed tokens as None
                    for address in batch_addresses:
                        key = f"{chain_id}:{address}"
                        if key not in results:
                            results[key] = None
        
        return results
    
    def get_pair_data(self, chain_id: str, pair_address: str) -> Optional[Dict[str, Any]]:
        """
        Get pair data for a specific trading pair.
        
        Args:
            chain_id (str): Blockchain chain ID
            pair_address (str): Pair contract address
            
        Returns:
            Optional[Dict[str, Any]]: Pair data or None if not found
        """
        try:
            endpoint = f"dex/pairs/{chain_id}/{pair_address}"
            response = self._make_request(endpoint)
            
            if 'pair' in response:
                pair_data = response['pair']
                
                return {
                    'pair_address': pair_address,
                    'chain_id': chain_id,
                    'dex_id': pair_data.get('dexId'),
                    'base_token': {
                        'address': pair_data.get('baseToken', {}).get('address'),
                        'symbol': pair_data.get('baseToken', {}).get('symbol'),
                        'name': pair_data.get('baseToken', {}).get('name')
                    },
                    'quote_token': {
                        'address': pair_data.get('quoteToken', {}).get('address'),
                        'symbol': pair_data.get('quoteToken', {}).get('symbol'),
                        'name': pair_data.get('quoteToken', {}).get('name')
                    },
                    'price_usd': float(pair_data.get('priceUsd', 0)),
                    'price_native': float(pair_data.get('priceNative', 0)),
                    'volume_24h': float(pair_data.get('volume', {}).get('h24', 0)),
                    'volume_6h': float(pair_data.get('volume', {}).get('h6', 0)),
                    'volume_1h': float(pair_data.get('volume', {}).get('h1', 0)),
                    'liquidity_usd': float(pair_data.get('liquidity', {}).get('usd', 0)),
                    'fdv': float(pair_data.get('fdv', 0)),
                    'market_cap': float(pair_data.get('marketCap', 0)),
                    'price_change_24h': float(pair_data.get('priceChange', {}).get('h24', 0)),
                    'price_change_6h': float(pair_data.get('priceChange', {}).get('h6', 0)),
                    'price_change_1h': float(pair_data.get('priceChange', {}).get('h1', 0)),
                    'timestamp': datetime.utcnow().isoformat()
                }
            
            logger.warning(f"No pair data found for {pair_address} on {chain_id}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to get pair data for {pair_address} on {chain_id}: {str(e)}")
            return None
    
    def search_pairs(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for trading pairs by token symbol or name.
        
        Args:
            query (str): Search query
            limit (int): Maximum number of results
            
        Returns:
            List[Dict[str, Any]]: List of matching pairs
        """
        try:
            endpoint = "dex/search"
            params = {'q': query}
            response = self._make_request(endpoint, params)
            
            pairs = []
            if 'pairs' in response:
                for pair_data in response['pairs'][:limit]:
                    pairs.append({
                        'pair_address': pair_data.get('pairAddress'),
                        'chain_id': pair_data.get('chainId'),
                        'dex_id': pair_data.get('dexId'),
                        'base_token_symbol': pair_data.get('baseToken', {}).get('symbol'),
                        'quote_token_symbol': pair_data.get('quoteToken', {}).get('symbol'),
                        'pair_symbol': f"{pair_data.get('baseToken', {}).get('symbol')}/{pair_data.get('quoteToken', {}).get('symbol')}",
                        'price_usd': float(pair_data.get('priceUsd', 0)),
                        'volume_24h': float(pair_data.get('volume', {}).get('h24', 0)),
                        'liquidity_usd': float(pair_data.get('liquidity', {}).get('usd', 0))
                    })
            
            return pairs
            
        except Exception as e:
            logger.error(f"Failed to search pairs for query '{query}': {str(e)}")
            return []
    
    def validate_token_address(self, chain_id: str, token_address: str) -> bool:
        """
        Validate if a token address exists and has trading data.
        
        Args:
            chain_id (str): Blockchain chain ID
            token_address (str): Token contract address
            
        Returns:
            bool: True if token is valid and has data
        """
        try:
            token_data = self.get_token_data(chain_id, token_address)
            return token_data is not None
        except Exception as e:
            logger.error(f"Failed to validate token {token_address} on {chain_id}: {str(e)}")
            return False
    
    def get_supported_chains(self) -> List[str]:
        """
        Get list of supported blockchain chains.
        
        Returns:
            List[str]: List of supported chain IDs
        """
        return list(self.supported_chains.keys())
    
    def clear_cache(self) -> None:
        """Clear the response cache."""
        with self._cache_lock:
            self._cache.clear()
            logger.info("DexScreener cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dict[str, Any]: Cache statistics
        """
        with self._cache_lock:
            return {
                'cache_size': len(self._cache),
                'cache_ttl': self._cache_ttl,
                'rate_limit': self.rate_limit,
                'recent_requests': len(self._request_times)
            }