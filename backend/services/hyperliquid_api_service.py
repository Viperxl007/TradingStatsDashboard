"""
Hyperliquid API Service

This module provides a comprehensive service for interacting with the Hyperliquid API
to fetch trading data, portfolio information, and vault details.
"""

import requests
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
import os
from threading import Lock
import hashlib
import hmac
from eth_account import Account
from eth_account.messages import encode_defunct

logger = logging.getLogger(__name__)


@dataclass
class HyperliquidConfig:
    """Configuration for Hyperliquid API"""
    api_url: str
    wallet_address: str
    api_private_key: Optional[str] = None
    api_wallet_address: Optional[str] = None
    rate_limit_requests_per_second: int = 10
    max_retries: int = 3
    timeout: int = 30


class RateLimiter:
    """Simple rate limiter for API requests"""
    
    def __init__(self, requests_per_second: int):
        self.requests_per_second = requests_per_second
        self.min_interval = 1.0 / requests_per_second
        self.last_request_time = 0
        self.lock = Lock()
    
    def wait_if_needed(self):
        """Wait if necessary to respect rate limits"""
        with self.lock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            
            if time_since_last < self.min_interval:
                sleep_time = self.min_interval - time_since_last
                time.sleep(sleep_time)
            
            self.last_request_time = time.time()


class HyperliquidAPIService:
    """
    Service for interacting with Hyperliquid API.
    
    This service handles all API interactions including authentication,
    rate limiting, error handling, and data fetching.
    """
    
    def __init__(self, config: HyperliquidConfig):
        """
        Initialize the Hyperliquid API service.
        
        Args:
            config (HyperliquidConfig): API configuration
        """
        self.config = config
        self.rate_limiter = RateLimiter(config.rate_limit_requests_per_second)
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'TradingStatsDashboard/1.0'
        })
        
        # Initialize account for signing if private key is provided
        self.account = None
        if config.api_private_key:
            try:
                self.account = Account.from_key(config.api_private_key)
                logger.info("Initialized Hyperliquid API with authentication")
            except Exception as e:
                logger.warning(f"Failed to initialize account for signing: {e}")
    
    def _make_request(self, endpoint: str, data: Dict[str, Any], 
                     signed: bool = False, retries: int = None) -> Dict[str, Any]:
        """
        Make a request to the Hyperliquid API.
        
        Args:
            endpoint (str): API endpoint
            data (Dict[str, Any]): Request data
            signed (bool): Whether the request needs to be signed
            retries (int): Number of retries (uses config default if None)
            
        Returns:
            Dict[str, Any]: API response
            
        Raises:
            Exception: If request fails after all retries
        """
        if retries is None:
            retries = self.config.max_retries
        
        url = f"{self.config.api_url}/{endpoint}"
        
        # Add signature if required
        if signed and self.account:
            data = self._sign_request(data)
        
        for attempt in range(retries + 1):
            try:
                self.rate_limiter.wait_if_needed()
                
                logger.debug(f"Making request to {url} (attempt {attempt + 1})")
                
                response = self.session.post(
                    url,
                    json=data,
                    timeout=self.config.timeout
                )
                
                response.raise_for_status()
                result = response.json()
                
                logger.debug(f"Request successful: {endpoint}")
                return result
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request failed (attempt {attempt + 1}): {e}")
                
                if attempt == retries:
                    logger.error(f"Request failed after {retries + 1} attempts: {e}")
                    raise
                
                # Exponential backoff
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            
            except Exception as e:
                logger.error(f"Unexpected error in API request: {e}")
                raise
    
    def _format_timestamp(self, timestamp_ms: int) -> str:
        """Format timestamp in milliseconds to readable string"""
        try:
            from datetime import datetime
            dt = datetime.fromtimestamp(timestamp_ms / 1000)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except:
            return str(timestamp_ms)
    
    def _sign_request(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sign a request for authenticated endpoints.
        
        Args:
            data (Dict[str, Any]): Request data
            
        Returns:
            Dict[str, Any]: Signed request data
        """
        if not self.account:
            raise ValueError("No account configured for signing")
        
        # Create message to sign
        message_data = json.dumps(data, separators=(',', ':'), sort_keys=True)
        message = encode_defunct(text=message_data)
        
        # Sign the message
        signature = self.account.sign_message(message)
        
        # Add signature to request
        signed_data = data.copy()
        signed_data['signature'] = {
            'r': hex(signature.r),
            's': hex(signature.s),
            'v': signature.v
        }
        
        return signed_data
    
    def get_user_fills(self, user_address: str, start_time: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get user fills (trades) from Hyperliquid with proper time-based pagination.
        
        Uses the userFillsByTime endpoint to access up to 10,000 most recent fills
        through pagination (2000 fills per request).
        
        Args:
            user_address (str): User wallet address
            start_time (Optional[int]): Start time in milliseconds (optional, for incremental sync)
            
        Returns:
            List[Dict[str, Any]]: List of user fills (up to 10,000)
        """
        try:
            all_fills = []
            current_end_time = None  # Start from current time (most recent)
            page_count = 0
            max_pages = 5  # 5 pages * 2000 = 10,000 max fills
            
            # If no start_time provided, use a default of 90 days ago to get maximum history
            if not start_time:
                import time
                start_time = int(time.time() * 1000) - (90 * 24 * 60 * 60 * 1000)  # 90 days ago
            
            logger.info(f"Fetching user fills for {user_address} with time-based pagination (up to 10,000 fills)")
            
            while page_count < max_pages:
                data = {
                    "type": "userFillsByTime",
                    "user": user_address,
                    "startTime": start_time  # startTime is required for userFillsByTime
                }
                
                logger.debug(f"Fetching page {page_count + 1} for {user_address} (startTime: {start_time})")
                response = self._make_request("info", data)
                
                fills = response if isinstance(response, list) else []
                
                if not fills:
                    logger.debug(f"No more fills to fetch (page {page_count + 1})")
                    break
                
                # Add fills to our collection
                all_fills.extend(fills)
                page_count += 1
                
                logger.debug(f"Page {page_count}: Retrieved {len(fills)} fills")
                
                # If we got less than 2000 fills, we've reached the end
                if len(fills) < 2000:
                    logger.debug(f"Received {len(fills)} fills (< 2000), reached end of data")
                    break
                
                # For next page, start from the newest time + 1ms
                # This ensures we get the next batch of newer trades chronologically
                newest_time = max(fill.get('time', 0) for fill in fills)
                start_time = newest_time + 1
                
                logger.debug(f"Next page will start from: {start_time}")
            
            if all_fills:
                # Log the time range of all retrieved trades
                times = [fill.get('time', 0) for fill in all_fills]
                oldest_time = min(times)
                newest_time = max(times)
                logger.info(f"Retrieved {len(all_fills)} total fills for {user_address} across {page_count} pages (time range: {oldest_time} to {newest_time})")
            else:
                logger.info(f"No fills found for {user_address}")
            
            return all_fills
            
        except Exception as e:
            logger.error(f"Error fetching user fills for {user_address}: {e}")
            raise
    
    def get_user_portfolio(self, user_address: str) -> Dict[str, Any]:
        """
        Get user portfolio information.
        
        Args:
            user_address (str): User wallet address
            
        Returns:
            Dict[str, Any]: Portfolio information
        """
        try:
            data = {
                "type": "clearinghouseState",
                "user": user_address
            }
            
            logger.info(f"Fetching portfolio for {user_address}")
            response = self._make_request("info", data)
            
            logger.debug(f"Retrieved portfolio data for {user_address}")
            return response
            
        except Exception as e:
            logger.error(f"Error fetching portfolio for {user_address}: {e}")
            raise
    
    def get_vault_details(self, vault_address: str) -> Dict[str, Any]:
        """
        Get vault details.
        
        Args:
            vault_address (str): Vault address
            
        Returns:
            Dict[str, Any]: Vault details
        """
        try:
            data = {
                "type": "vaultDetails",
                "vaultAddress": vault_address
            }
            
            logger.info(f"Fetching vault details for {vault_address}")
            response = self._make_request("info", data)
            
            logger.debug(f"Retrieved vault details for {vault_address}")
            return response
            
        except Exception as e:
            logger.error(f"Error fetching vault details for {vault_address}: {e}")
            raise
    
    def get_user_vault_equities(self, user_address: str) -> List[Dict[str, Any]]:
        """
        Get user vault equities.
        
        Args:
            user_address (str): User wallet address
            
        Returns:
            List[Dict[str, Any]]: List of vault equities
        """
        try:
            data = {
                "type": "userVaultEquities",
                "user": user_address
            }
            
            logger.info(f"Fetching vault equities for {user_address}")
            response = self._make_request("info", data)
            
            equities = response if isinstance(response, list) else []
            logger.info(f"Retrieved {len(equities)} vault equities for {user_address}")
            
            return equities
            
        except Exception as e:
            logger.error(f"Error fetching vault equities for {user_address}: {e}")
            raise
    
    def get_all_mids(self) -> Dict[str, str]:
        """
        Get all mid prices for available assets.
        
        Returns:
            Dict[str, str]: Dictionary of asset -> mid price
        """
        try:
            data = {"type": "allMids"}
            
            logger.debug("Fetching all mid prices")
            response = self._make_request("info", data)
            
            logger.debug(f"Retrieved mid prices for {len(response)} assets")
            return response
            
        except Exception as e:
            logger.error(f"Error fetching mid prices: {e}")
            raise
    
    def get_meta(self) -> Dict[str, Any]:
        """
        Get meta information about available assets.
        
        Returns:
            Dict[str, Any]: Meta information
        """
        try:
            data = {"type": "meta"}
            
            logger.debug("Fetching meta information")
            response = self._make_request("info", data)
            
            logger.debug("Retrieved meta information")
            return response
            
        except Exception as e:
            logger.error(f"Error fetching meta information: {e}")
            raise
    
    def health_check(self) -> bool:
        """
        Perform a health check on the API.
        
        Returns:
            bool: True if API is healthy, False otherwise
        """
        try:
            # Use a simple meta request as health check
            self.get_meta()
            logger.info("Hyperliquid API health check passed")
            return True
            
        except Exception as e:
            logger.error(f"Hyperliquid API health check failed: {e}")
            return False


def create_hyperliquid_service() -> HyperliquidAPIService:
    """
    Create a Hyperliquid API service instance from environment variables.
    
    Returns:
        HyperliquidAPIService: Configured API service
    """
    config = HyperliquidConfig(
        api_url=os.getenv('HYPERLIQUID_API_URL', 'https://api.hyperliquid.xyz'),
        wallet_address=os.getenv('HYPERLIQUID_WALLET_ADDRESS', ''),
        api_private_key=os.getenv('HYPERLIQUID_API_PRIVATE_KEY'),
        api_wallet_address=os.getenv('HYPERLIQUID_API_WALLET_ADDRESS'),
        rate_limit_requests_per_second=int(os.getenv('RATE_LIMIT_REQUESTS_PER_SECOND', '10')),
        max_retries=int(os.getenv('MAX_RETRIES', '3')),
        timeout=int(os.getenv('API_TIMEOUT', '30'))
    )
    
    if not config.wallet_address:
        raise ValueError("HYPERLIQUID_WALLET_ADDRESS environment variable is required")
    
    return HyperliquidAPIService(config)


# Example usage and testing functions
if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(level=logging.DEBUG)
    
    try:
        # Create service
        service = create_hyperliquid_service()
        
        # Test health check
        if service.health_check():
            print("✅ API health check passed")
        else:
            print("❌ API health check failed")
            
        # Test meta information
        meta = service.get_meta()
        print(f"✅ Retrieved meta info with {len(meta.get('universe', []))} assets")
        
        # Test mid prices
        mids = service.get_all_mids()
        print(f"✅ Retrieved {len(mids)} mid prices")
        
    except Exception as e:
        print(f"❌ Error testing Hyperliquid API service: {e}")