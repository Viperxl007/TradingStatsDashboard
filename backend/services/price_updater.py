"""
Price Update Service

This module provides automated price updates for concentrated liquidity positions
using the DexScreener API and manages price history storage.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from threading import Lock
import json

from .dexscreener_service import DexScreenerService
from models.cl_position import CLPosition
from models.cl_price_history import CLPriceHistory

logger = logging.getLogger(__name__)


class PriceUpdateService:
    """
    Service for automated price updates of CL positions.
    
    Handles fetching current prices, storing price history,
    and updating position values with error recovery.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the price update service.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.dexscreener = DexScreenerService()
        self.position_model = CLPosition(db_path)
        self.price_history_model = CLPriceHistory(db_path)
        
        # Update state tracking
        self._update_lock = Lock()
        self._last_update = None
        self._update_stats = {
            'total_updates': 0,
            'successful_updates': 0,
            'failed_updates': 0,
            'last_error': None
        }
        
        # Import configuration
        try:
            from backend.local_config import PRICE_UPDATE_INTERVAL
            self.update_interval = PRICE_UPDATE_INTERVAL
        except ImportError:
            self.update_interval = 1800  # 30 minutes default
        
        logger.info("Price Update Service initialized")
    
    def get_active_positions(self) -> List[Dict[str, Any]]:
        """
        Get all active CL positions that need price updates.
        
        Returns:
            List[Dict[str, Any]]: List of active positions
        """
        try:
            positions = self.position_model.get_all_positions()
            active_positions = [pos for pos in positions if pos.get('status') == 'active']
            
            logger.debug(f"Found {len(active_positions)} active positions for price updates")
            return active_positions
            
        except Exception as e:
            logger.error(f"Failed to get active positions: {str(e)}")
            return []
    
    def extract_token_info(self, position: Dict[str, Any]) -> Optional[List[Dict[str, str]]]:
        """
        Extract token information from a position for price fetching.
        
        Args:
            position (Dict[str, Any]): Position data
            
        Returns:
            Optional[List[Dict[str, str]]]: List of token info with chain_id and address for both tokens
        """
        try:
            # Extract chain
            chain = position.get('chain', 'hyperevm').lower()
            position_id = position.get('id')
            
            # Check for new token address fields first
            token0_address = position.get('token0_address')
            token1_address = position.get('token1_address')
            
            if token0_address and token1_address:
                # Use the new token address fields
                return [
                    {
                        'chain_id': chain,
                        'address': token0_address,
                        'position_id': position_id,
                        'pair_symbol': position.get('pair_symbol', ''),
                        'token_type': 'token0'
                    },
                    {
                        'chain_id': chain,
                        'address': token1_address,
                        'position_id': position_id,
                        'pair_symbol': position.get('pair_symbol', ''),
                        'token_type': 'token1'
                    }
                ]
            
            # Fallback to old contract_address field
            contract_address = position.get('contract_address')
            if contract_address:
                logger.warning(f"Position {position_id} using legacy contract_address field. Consider updating with token0_address and token1_address.")
                return [
                    {
                        'chain_id': chain,
                        'address': contract_address,
                        'position_id': position_id,
                        'pair_symbol': position.get('pair_symbol', ''),
                        'token_type': 'legacy'
                    }
                ]
            
            logger.warning(f"Position {position_id} has no token addresses")
            return None
            
        except Exception as e:
            logger.error(f"Failed to extract token info from position {position.get('id')}: {str(e)}")
            return None
    
    def fetch_current_prices(self, positions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch current prices for all active positions.
        
        Args:
            positions (List[Dict[str, Any]]): List of positions
            
        Returns:
            Dict[str, Dict[str, Any]]: Price data keyed by position ID with both token prices
        """
        # Extract token requests
        token_requests = []
        position_token_map = {}  # Maps position_id to token info
        
        for position in positions:
            token_info_list = self.extract_token_info(position)
            if token_info_list:
                position_id = position.get('id')
                position_token_map[position_id] = {'tokens': []}
                
                for token_info in token_info_list:
                    token_requests.append({
                        'chain_id': token_info['chain_id'],
                        'address': token_info['address']
                    })
                    
                    # Store token info for this position
                    position_token_map[position_id]['tokens'].append(token_info)
        
        if not token_requests:
            logger.warning("No valid token requests found for price updates")
            return {}
        
        # Fetch prices from DexScreener
        try:
            logger.info(f"Fetching prices for {len(token_requests)} tokens")
            price_data = self.dexscreener.get_multiple_tokens(token_requests)
            
            # Map results back to position IDs with both token prices
            position_prices = {}
            for position_id, position_info in position_token_map.items():
                position_price_data = {
                    'position_id': position_id,
                    'tokens': {}
                }
                
                for token_info in position_info['tokens']:
                    token_key = f"{token_info['chain_id']}:{token_info['address']}"
                    if token_key in price_data and price_data[token_key]:
                        token_type = token_info.get('token_type', 'unknown')
                        position_price_data['tokens'][token_type] = price_data[token_key]
                
                # Only include positions that have at least one token price
                if position_price_data['tokens']:
                    position_prices[position_id] = position_price_data
            
            logger.info(f"Successfully fetched prices for {len(position_prices)} positions")
            return position_prices
            
        except Exception as e:
            logger.error(f"Failed to fetch current prices: {str(e)}")
            return {}
    
    def store_price_history(self, position_id: str, price_data: Dict[str, Any]) -> bool:
        """
        Store price data in the price history table.
        
        Args:
            position_id (str): Position ID
            price_data (Dict[str, Any]): Price data from DexScreener
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Get position info for token pair
            position = self.position_model.get_position(position_id)
            if not position:
                logger.error(f"Position {position_id} not found")
                return False
            
            # Prepare price history entry
            price_entry = {
                'position_id': position_id,
                'token_pair': position.get('pair_symbol', ''),
                'price': price_data.get('price_usd', 0),
                'timestamp': int(datetime.utcnow().timestamp()),
                'source': 'dexscreener',
                'volume_24h': price_data.get('volume_24h', 0),
                'liquidity_usd': price_data.get('liquidity_usd', 0),
                'price_native': price_data.get('price_native', 0)
            }
            
            # Store in database
            success = self.price_history_model.add_price_entry(price_entry)
            
            if success:
                logger.debug(f"Stored price history for position {position_id}")
            else:
                logger.error(f"Failed to store price history for position {position_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to store price history for position {position_id}: {str(e)}")
            return False
    
    def calculate_position_value(self, position: Dict[str, Any], current_price: float) -> Dict[str, float]:
        """
        Calculate current position value and metrics.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current token price
            
        Returns:
            Dict[str, float]: Calculated values
        """
        try:
            initial_investment = float(position.get('initial_investment', 0))
            liquidity_amount = float(position.get('liquidity_amount', 0))
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            fees_collected = float(position.get('fees_collected', 0))
            
            # Check if position is in range
            in_range = price_min <= current_price <= price_max
            
            # Calculate position value (simplified - assumes equal token distribution)
            # In a real implementation, this would use the actual CL math
            if in_range:
                # Position is providing liquidity
                current_value = liquidity_amount * current_price
            else:
                # Position is single-sided
                if current_price < price_min:
                    # All in quote token
                    current_value = initial_investment
                else:
                    # All in base token
                    current_value = liquidity_amount * current_price
            
            # Calculate returns
            total_value = current_value + fees_collected
            total_return = total_value - initial_investment
            return_percentage = (total_return / initial_investment * 100) if initial_investment > 0 else 0
            
            # Calculate distance to range bounds
            distance_to_min = abs(current_price - price_min) / price_min * 100 if price_min > 0 else 0
            distance_to_max = abs(current_price - price_max) / price_max * 100 if price_max > 0 else 0
            
            return {
                'current_price': current_price,
                'current_value': current_value,
                'total_value': total_value,
                'total_return': total_return,
                'return_percentage': return_percentage,
                'in_range': in_range,
                'distance_to_min_percent': distance_to_min,
                'distance_to_max_percent': distance_to_max
            }
            
        except Exception as e:
            logger.error(f"Failed to calculate position value: {str(e)}")
            return {
                'current_price': current_price,
                'current_value': 0,
                'total_value': 0,
                'total_return': 0,
                'return_percentage': 0,
                'in_range': False,
                'distance_to_min_percent': 0,
                'distance_to_max_percent': 0
            }
    
    def update_position_metrics(self, position_id: str, metrics: Dict[str, float]) -> bool:
        """
        Update position with calculated metrics.
        
        Args:
            position_id (str): Position ID
            metrics (Dict[str, float]): Calculated metrics
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Update position with current metrics
            update_data = {
                'current_price': metrics['current_price'],
                'current_value': metrics['current_value'],
                'total_return': metrics['total_return'],
                'return_percentage': metrics['return_percentage'],
                'in_range': metrics['in_range'],
                'last_price_update': datetime.utcnow().isoformat()
            }
            
            success = self.position_model.update_position(position_id, update_data)
            
            if success:
                logger.debug(f"Updated metrics for position {position_id}")
            else:
                logger.error(f"Failed to update metrics for position {position_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to update position metrics for {position_id}: {str(e)}")
            return False
    
    def update_single_position(self, position: Dict[str, Any], price_data: Dict[str, Any]) -> bool:
        """
        Update a single position with new price data.
        
        Args:
            position (Dict[str, Any]): Position data
            price_data (Dict[str, Any]): Price data structure with token prices
            
        Returns:
            bool: True if successful, False otherwise
        """
        position_id = position.get('id')
        
        try:
            # Extract token prices from the new structure
            tokens = price_data.get('tokens', {})
            token0_data = tokens.get('token0')
            token1_data = tokens.get('token1')
            legacy_data = tokens.get('legacy')
            
            # Store price history for available tokens
            price_stored = False
            if token0_data:
                price_stored = self.store_price_history(position_id, token0_data) or price_stored
            if token1_data:
                price_stored = self.store_price_history(position_id, token1_data) or price_stored
            if legacy_data:
                price_stored = self.store_price_history(position_id, legacy_data) or price_stored
            
            # Calculate position metrics using available price data
            current_price = 0
            if token0_data and token1_data:
                # Calculate price ratio for concentrated liquidity
                token0_price = token0_data.get('price_usd', 0)
                token1_price = token1_data.get('price_usd', 0)
                if token0_price > 0:
                    current_price = token1_price / token0_price
                else:
                    current_price = token1_price
            elif legacy_data:
                current_price = legacy_data.get('price_usd', 0)
            elif token0_data:
                current_price = token0_data.get('price_usd', 0)
            elif token1_data:
                current_price = token1_data.get('price_usd', 0)
            
            # Calculate position metrics
            metrics = self.calculate_position_value(position, current_price)
            
            # Add token price information to metrics
            if token0_data:
                metrics['token0_price_usd'] = token0_data.get('price_usd', 0)
            if token1_data:
                metrics['token1_price_usd'] = token1_data.get('price_usd', 0)
            
            # Update position metrics
            metrics_updated = self.update_position_metrics(position_id, metrics)
            
            success = price_stored and metrics_updated
            
            if success:
                logger.debug(f"Successfully updated position {position_id}")
            else:
                logger.warning(f"Partial update for position {position_id}: price_stored={price_stored}, metrics_updated={metrics_updated}")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to update position {position_id}: {str(e)}")
            return False
    
    def update_all_positions(self) -> Dict[str, Any]:
        """
        Update prices for all active positions.
        
        Returns:
            Dict[str, Any]: Update results and statistics
        """
        with self._update_lock:
            start_time = time.time()
            
            try:
                # Get active positions
                positions = self.get_active_positions()
                if not positions:
                    logger.info("No active positions found for price updates")
                    return {
                        'success': True,
                        'positions_processed': 0,
                        'successful_updates': 0,
                        'failed_updates': 0,
                        'duration': 0,
                        'message': 'No active positions to update'
                    }
                
                # Fetch current prices
                price_data = self.fetch_current_prices(positions)
                
                # Update each position
                successful_updates = 0
                failed_updates = 0
                
                for position in positions:
                    position_id = position.get('id')
                    
                    if position_id in price_data:
                        success = self.update_single_position(position, price_data[position_id])
                        if success:
                            successful_updates += 1
                        else:
                            failed_updates += 1
                    else:
                        logger.warning(f"No price data available for position {position_id}")
                        failed_updates += 1
                
                # Update statistics
                duration = time.time() - start_time
                self._last_update = datetime.utcnow()
                self._update_stats['total_updates'] += 1
                self._update_stats['successful_updates'] += successful_updates
                self._update_stats['failed_updates'] += failed_updates
                
                if failed_updates > 0:
                    self._update_stats['last_error'] = f"{failed_updates} positions failed to update"
                
                logger.info(f"Price update completed: {successful_updates} successful, {failed_updates} failed, {duration:.2f}s")
                
                return {
                    'success': True,
                    'positions_processed': len(positions),
                    'successful_updates': successful_updates,
                    'failed_updates': failed_updates,
                    'duration': duration,
                    'timestamp': self._last_update.isoformat()
                }
                
            except Exception as e:
                error_msg = f"Price update failed: {str(e)}"
                logger.error(error_msg)
                
                self._update_stats['total_updates'] += 1
                self._update_stats['failed_updates'] += 1
                self._update_stats['last_error'] = error_msg
                
                return {
                    'success': False,
                    'error': error_msg,
                    'duration': time.time() - start_time
                }
    
    def update_position_price(self, position_id: str) -> Dict[str, Any]:
        """
        Update price for a specific position.
        
        Args:
            position_id (str): Position ID to update
            
        Returns:
            Dict[str, Any]: Update result
        """
        try:
            # Get position
            position = self.position_model.get_position_by_id(position_id)
            if not position:
                return {
                    'success': False,
                    'error': f'Position {position_id} not found'
                }
            
            if position.get('status') != 'active':
                return {
                    'success': False,
                    'error': f'Position {position_id} is not active'
                }
            
            # Extract token info and fetch prices
            token_info_list = self.extract_token_info(position)
            if not token_info_list:
                return {
                    'success': False,
                    'error': f'Invalid token info for position {position_id}'
                }
            
            # Fetch prices for all tokens
            token_requests = []
            for token_info in token_info_list:
                token_requests.append({
                    'chain_id': token_info['chain_id'],
                    'address': token_info['address']
                })
            
            price_data_raw = self.dexscreener.get_multiple_tokens(token_requests)
            
            # Structure the price data
            position_price_data = {
                'position_id': position_id,
                'tokens': {}
            }
            
            for token_info in token_info_list:
                token_key = f"{token_info['chain_id']}:{token_info['address']}"
                if token_key in price_data_raw and price_data_raw[token_key]:
                    token_type = token_info.get('token_type', 'unknown')
                    position_price_data['tokens'][token_type] = price_data_raw[token_key]
            
            if not position_price_data['tokens']:
                return {
                    'success': False,
                    'error': f'No price data available for position {position_id}'
                }
            
            # Update position
            success = self.update_single_position(position, position_price_data)
            
            if success:
                # Extract current prices for response
                tokens = position_price_data['tokens']
                current_prices = {}
                for token_type, data in tokens.items():
                    current_prices[f'{token_type}_price_usd'] = data.get('price_usd', 0)
                
                return {
                    'success': True,
                    'position_id': position_id,
                    'current_prices': current_prices,
                    'timestamp': datetime.utcnow().isoformat()
                }
            else:
                return {
                    'success': False,
                    'error': f'Failed to update position {position_id}'
                }
                
        except Exception as e:
            error_msg = f"Failed to update position {position_id}: {str(e)}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
    
    def get_update_stats(self) -> Dict[str, Any]:
        """
        Get price update statistics.
        
        Returns:
            Dict[str, Any]: Update statistics
        """
        return {
            **self._update_stats,
            'last_update': self._last_update.isoformat() if self._last_update else None,
            'update_interval': self.update_interval,
            'service_status': 'running'
        }
    
    def cleanup_old_price_data(self, days_to_keep: int = 90) -> int:
        """
        Clean up old price history data.
        
        Args:
            days_to_keep (int): Number of days of data to keep
            
        Returns:
            int: Number of records deleted
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            cutoff_timestamp = int(cutoff_date.timestamp())
            
            deleted_count = self.price_history_model.cleanup_old_data(cutoff_timestamp)
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} old price history records")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup old price data: {str(e)}")
            return 0