"""
Concentrated Liquidity Service

This module provides business logic and service layer operations
for managing concentrated liquidity positions.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
import uuid

from models.cl_position import CLPosition
from models.cl_price_history import CLPriceHistory
from models.cl_fee_history import CLFeeHistory

logger = logging.getLogger(__name__)


class CLService:
    """
    Service class for concentrated liquidity position management.
    
    This class provides high-level business logic operations for CL positions,
    including position creation, validation, calculations, and analytics.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the CL service with database models.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.position_model = CLPosition(db_path)
        self.price_history_model = CLPriceHistory(db_path)
        self.fee_history_model = CLFeeHistory(db_path)
        logger.info("CL Service initialized")
    
    def create_position(self, position_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new CL position with validation.
        
        Args:
            position_data (Dict[str, Any]): Position data
            
        Returns:
            Dict[str, Any]: Created position with calculated fields
            
        Raises:
            ValueError: If validation fails
            Exception: If creation fails
        """
        try:
            # Auto-detect token addresses for known pairs before validation
            position_data = self._auto_detect_token_addresses(position_data)
            
            # Validate position data
            self._validate_position_data(position_data)
            
            # Create the position
            position_id = self.position_model.create_position(position_data)
            
            # Retrieve the created position
            position = self.position_model.get_position_by_id(position_id)
            
            if position:
                # Add calculated fields
                position = self._enrich_position_data(position)
                logger.info(f"Created CL position: {position_id}")
                return position
            else:
                raise Exception("Failed to retrieve created position")
                
        except Exception as e:
            logger.error(f"Error creating CL position: {str(e)}")
            raise
    
    def get_positions(self, status: Optional[str] = None, 
                     include_calculations: bool = True) -> List[Dict[str, Any]]:
        """
        Get CL positions with optional filtering and calculations.
        
        Args:
            status (Optional[str]): Filter by status ('active' or 'closed')
            include_calculations (bool): Whether to include calculated fields
            
        Returns:
            List[Dict[str, Any]]: List of positions with optional calculations
        """
        try:
            positions = self.position_model.get_positions(status=status)
            
            if include_calculations:
                enriched_positions = []
                for position in positions:
                    enriched_position = self._enrich_position_data(position)
                    enriched_positions.append(enriched_position)
                return enriched_positions
            
            return positions
            
        except Exception as e:
            logger.error(f"Error retrieving CL positions: {str(e)}")
            raise
    
    def get_position_by_id(self, position_id: str, 
                          include_calculations: bool = True) -> Optional[Dict[str, Any]]:
        """
        Get a specific CL position by ID.
        
        Args:
            position_id (str): The position ID
            include_calculations (bool): Whether to include calculated fields
            
        Returns:
            Optional[Dict[str, Any]]: Position data or None if not found
        """
        try:
            position = self.position_model.get_position_by_id(position_id)
            
            if position and include_calculations:
                position = self._enrich_position_data(position)
            
            return position
            
        except Exception as e:
            logger.error(f"Error retrieving CL position {position_id}: {str(e)}")
            raise
    
    def update_position(self, position_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update a CL position.
        
        Args:
            position_id (str): The position ID
            updates (Dict[str, Any]): Fields to update
            
        Returns:
            Optional[Dict[str, Any]]: Updated position data or None if not found
        """
        try:
            # Validate updates if they contain critical fields
            if any(field in updates for field in ['price_range_min', 'price_range_max', 'liquidity_amount']):
                self._validate_position_updates(updates)
            
            success = self.position_model.update_position(position_id, updates)
            
            if success:
                return self.get_position_by_id(position_id)
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error updating CL position {position_id}: {str(e)}")
            raise
    
    def close_position(self, position_id: str, exit_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Close a CL position.
        
        Args:
            position_id (str): The position ID
            exit_data (Dict[str, Any]): Exit data including exit_date
            
        Returns:
            Optional[Dict[str, Any]]: Closed position data or None if not found
        """
        try:
            # Ensure exit_date is provided
            if 'exit_date' not in exit_data:
                exit_data['exit_date'] = datetime.now().isoformat()
            
            success = self.position_model.close_position(position_id, exit_data)
            
            if success:
                return self.get_position_by_id(position_id)
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error closing CL position {position_id}: {str(e)}")
            raise
    
    def delete_position(self, position_id: str) -> bool:
        """
        Delete a CL position and all related data.
        
        Args:
            position_id (str): The position ID
            
        Returns:
            bool: True if deletion was successful
        """
        try:
            # Note: In a production system, you might want to soft delete
            # or archive the data instead of hard deletion
            success = self.position_model.delete_position(position_id)
            
            if success:
                logger.info(f"Deleted CL position and related data: {position_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error deleting CL position {position_id}: {str(e)}")
            raise
    
    def update_position_fees(self, position_id: str, fee_data: Dict[str, Any]) -> bool:
        """
        Update fees for a CL position.
        
        Args:
            position_id (str): The position ID
            fee_data (Dict[str, Any]): Fee update data
            
        Returns:
            bool: True if update was successful
        """
        try:
            # Validate fee data
            required_fields = ['fees_amount', 'update_date']
            for field in required_fields:
                if field not in fee_data:
                    raise ValueError(f"Missing required field: {field}")
            
            # Get current total fees
            current_total = self.fee_history_model.get_total_fees_collected(position_id)
            
            # Calculate new cumulative total
            new_cumulative = current_total + fee_data['fees_amount']
            
            # Add fee history record
            fee_record_data = {
                'position_id': position_id,
                'fees_amount': fee_data['fees_amount'],
                'cumulative_fees': new_cumulative,
                'update_date': fee_data['update_date'],
                'notes': fee_data.get('notes', '')
            }
            
            self.fee_history_model.add_fee_update(fee_record_data)
            
            # Update position's fees_collected field
            self.position_model.update_position(position_id, {'fees_collected': new_cumulative})
            
            logger.info(f"Updated fees for position {position_id}: +{fee_data['fees_amount']}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating fees for position {position_id}: {str(e)}")
            raise
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """
        Get portfolio summary statistics.
        
        Returns:
            Dict[str, Any]: Portfolio summary data
        """
        try:
            all_positions = self.get_positions(include_calculations=True)
            active_positions = [p for p in all_positions if p['status'] == 'active']
            closed_positions = [p for p in all_positions if p['status'] == 'closed']
            
            # Calculate totals
            total_investment = sum(p['initial_investment'] for p in all_positions)
            total_current_value = sum(p.get('current_value', p['initial_investment']) for p in active_positions)
            total_fees_collected = sum(p['fees_collected'] for p in all_positions)
            
            # Calculate performance metrics
            total_pnl = total_current_value - sum(p['initial_investment'] for p in active_positions)
            total_return_pct = (total_pnl / sum(p['initial_investment'] for p in active_positions) * 100) if active_positions else 0
            
            # Find best and worst performing positions
            best_position = None
            worst_position = None
            
            if all_positions:
                positions_with_returns = [(p, self._calculate_position_return_pct(p)) for p in all_positions]
                positions_with_returns.sort(key=lambda x: x[1], reverse=True)
                
                if positions_with_returns:
                    best_position = positions_with_returns[0][0]['trade_name']
                    worst_position = positions_with_returns[-1][0]['trade_name']
            
            summary = {
                'total_positions': len(all_positions),
                'active_positions': len(active_positions),
                'closed_positions': len(closed_positions),
                'total_investment': total_investment,
                'current_value': total_current_value,
                'total_fees_collected': total_fees_collected,
                'total_pnl': total_pnl,
                'total_return_pct': total_return_pct,
                'best_performing_position': best_position,
                'worst_performing_position': worst_position
            }
            
            logger.debug(f"Generated portfolio summary: {summary}")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating portfolio summary: {str(e)}")
            raise
    
    def _auto_detect_token_addresses(self, position_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Auto-detect token addresses for known pairs like LICKO/WHYPE.
        
        Args:
            position_data (Dict[str, Any]): Position data
            
        Returns:
            Dict[str, Any]: Position data with auto-detected token addresses
        """
        # Make a copy to avoid modifying the original
        data = position_data.copy()
        
        # Known token addresses for auto-detection
        known_tokens = {
            'LICKO': '0xBf7F2B530c073e21EA0627F36DeEaec21A6adfec',
            'HYPE': '0x6b175474e89094c44da98b954eedeac495271d0f',  # HYPE token address - will update with correct address
            'WHYPE': '0x6b175474e89094c44da98b954eedeac495271d0f'   # Map WHYPE to HYPE for better price data
        }
        
        # Check if pair_symbol contains known tokens
        pair_symbol = data.get('pair_symbol', '').upper()
        
        # Auto-detect for LICKO/HYPE pairs (including WHYPE references)
        hype_variants = ['HYPE', 'WHYPE']
        has_licko = 'LICKO' in pair_symbol
        has_hype = any(variant in pair_symbol for variant in hype_variants)
        
        if has_licko and has_hype:
            # Determine which token is token0 and which is token1 based on pair_symbol order
            if pair_symbol.startswith('LICKO'):
                # LICKO/HYPE format
                if not data.get('token0_address'):
                    data['token0_address'] = known_tokens['LICKO']
                    logger.info("Auto-detected LICKO token0_address")
                if not data.get('token1_address'):
                    data['token1_address'] = known_tokens['HYPE']
                    logger.info("Auto-detected HYPE token1_address (using HYPE for reliable pricing)")
            elif any(pair_symbol.startswith(variant) for variant in hype_variants):
                # HYPE/LICKO or WHYPE/LICKO format
                if not data.get('token0_address'):
                    data['token0_address'] = known_tokens['HYPE']
                    logger.info("Auto-detected HYPE token0_address (using HYPE for reliable pricing)")
                if not data.get('token1_address'):
                    data['token1_address'] = known_tokens['LICKO']
                    logger.info("Auto-detected LICKO token1_address")
            else:
                # Generic LICKO/HYPE detection - default to LICKO first
                if not data.get('token0_address'):
                    data['token0_address'] = known_tokens['LICKO']
                    logger.info("Auto-detected LICKO token0_address (default order)")
                if not data.get('token1_address'):
                    data['token1_address'] = known_tokens['HYPE']
                    logger.info("Auto-detected HYPE token1_address (default order, using HYPE for reliable pricing)")
        
        return data

    def _validate_position_data(self, position_data: Dict[str, Any]) -> None:
        """
        Validate position data before creation.
        
        Args:
            position_data (Dict[str, Any]): Position data to validate
            
        Raises:
            ValueError: If validation fails
        """
        required_fields = [
            'trade_name', 'pair_symbol', 'price_range_min', 'price_range_max',
            'liquidity_amount', 'initial_investment', 'entry_date'
        ]
        
        # Check required fields
        for field in required_fields:
            if field not in position_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Validate numeric fields
        numeric_fields = ['price_range_min', 'price_range_max', 'liquidity_amount', 'initial_investment']
        for field in numeric_fields:
            if not isinstance(position_data[field], (int, float)) or position_data[field] <= 0:
                raise ValueError(f"Field {field} must be a positive number")
        
        # Validate price range
        if position_data['price_range_min'] >= position_data['price_range_max']:
            raise ValueError("price_range_min must be less than price_range_max")
        
        # Validate date format
        try:
            datetime.fromisoformat(position_data['entry_date'].replace('Z', '+00:00'))
        except ValueError:
            raise ValueError("entry_date must be in ISO format")
        
        # Validate status if provided
        if 'status' in position_data and position_data['status'] not in ['active', 'closed']:
            raise ValueError("status must be 'active' or 'closed'")
    
    def _validate_position_updates(self, updates: Dict[str, Any]) -> None:
        """
        Validate position update data.
        
        Args:
            updates (Dict[str, Any]): Update data to validate
            
        Raises:
            ValueError: If validation fails
        """
        # Validate numeric fields if present
        numeric_fields = ['price_range_min', 'price_range_max', 'liquidity_amount', 'initial_investment']
        for field in numeric_fields:
            if field in updates:
                if not isinstance(updates[field], (int, float)) or updates[field] <= 0:
                    raise ValueError(f"Field {field} must be a positive number")
        
        # Validate price range consistency if both are being updated
        if 'price_range_min' in updates and 'price_range_max' in updates:
            if updates['price_range_min'] >= updates['price_range_max']:
                raise ValueError("price_range_min must be less than price_range_max")
    
    def _enrich_position_data(self, position: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich position data with calculated fields.
        
        Args:
            position (Dict[str, Any]): Base position data
            
        Returns:
            Dict[str, Any]: Position data with calculated fields
        """
        try:
            # Try to get real-time prices if token addresses are available
            current_value = None
            current_price = None
            token0_data = None
            token1_data = None
            
            if position.get('token0_address') and position.get('token1_address'):
                try:
                    # Import DexScreenerService
                    from services.dexscreener_service import DexScreenerService
                    dex_service = DexScreenerService()
                    
                    # Get current prices for both tokens
                    chain_id = position.get('chain', 'hyperevm').lower()
                    token0_data = dex_service.get_token_data(chain_id, position['token0_address'])
                    token1_data = dex_service.get_token_data(chain_id, position['token1_address'])
                    
                    if token0_data or token1_data:
                        current_value = self._calculate_current_value_with_prices(position, token0_data, token1_data)
                        
                        # Calculate current price ratio for range checking
                        if token0_data and token1_data and token0_data.get('price_usd', 0) > 0:
                            current_price = token1_data.get('price_usd', 0) / token0_data.get('price_usd', 1)
                        
                except Exception as e:
                    logger.warning(f"Failed to get real-time prices for position {position['id']}: {str(e)}")
            
            # Fallback to historical price data if real-time failed
            if current_price is None:
                latest_price_record = self.price_history_model.get_latest_price(position['pair_symbol'])
                current_price = latest_price_record['price'] if latest_price_record else None
            
            # If we still don't have current_value, use the old method
            if current_value is None and current_price:
                current_value = self._calculate_current_value(position, current_price)
            elif current_value is None:
                current_value = position['initial_investment']  # Final fallback
            
            # Calculate basic metrics
            position['current_price'] = current_price
            position['is_in_range'] = self._is_price_in_range(current_price, position) if current_price else None
            position['current_value'] = current_value
            
            # Add token price data if available
            if token0_data:
                position['token0_price_usd'] = token0_data.get('price_usd', 0)
            if token1_data:
                position['token1_price_usd'] = token1_data.get('price_usd', 0)
            
            # For active positions, calculate performance metrics
            if position['status'] == 'active':
                position['impermanent_loss'] = self._calculate_impermanent_loss(position, current_price) if current_price else 0.0
                position['total_return'] = current_value + position['fees_collected'] - position['initial_investment']
                position['total_return_pct'] = self._calculate_position_return_pct(position)
                position['apr'] = self._calculate_apr(position)
            else:
                # For closed positions, use final values
                position['impermanent_loss'] = 0.0
                position['total_return'] = position['fees_collected']  # Simplified
                position['total_return_pct'] = self._calculate_position_return_pct(position)
                position['apr'] = 0.0
            
            return position
            
        except Exception as e:
            logger.error(f"Error enriching position data: {str(e)}")
            # Return original position if enrichment fails
            return position
    
    def _is_price_in_range(self, current_price: float, position: Dict[str, Any]) -> bool:
        """Check if current price is within position range."""
        return position['price_range_min'] <= current_price <= position['price_range_max']
    
    def _calculate_current_value(self, position: Dict[str, Any], current_price: float) -> float:
        """
        Calculate current value of the position.
        
        This is a simplified calculation. In reality, you'd need more complex
        math based on the specific AMM formula and liquidity distribution.
        """
        # Simplified calculation - in reality this would be much more complex
        # involving the specific AMM math for concentrated liquidity
        return position['initial_investment']  # Placeholder
    
    def _calculate_current_value_with_prices(self, position: Dict[str, Any], token0_data: Optional[Dict[str, Any]], token1_data: Optional[Dict[str, Any]]) -> float:
        """
        Calculate current value of the position using real token prices.
        
        This implements a more realistic calculation using actual token prices
        and the concentrated liquidity math for the position.
        
        Args:
            position (Dict[str, Any]): Position data
            token0_data (Optional[Dict[str, Any]]): Token0 price data from DexScreener
            token1_data (Optional[Dict[str, Any]]): Token1 price data from DexScreener
            
        Returns:
            float: Current USD value of the position
        """
        try:
            # Get token prices (fallback to 0 if no data)
            token0_price = token0_data.get('price_usd', 0) if token0_data else 0
            token1_price = token1_data.get('price_usd', 0) if token1_data else 0
            
            # If we don't have price data, return initial investment as fallback
            if token0_price == 0 and token1_price == 0:
                logger.warning(f"No price data available for position {position['id']}")
                return position['initial_investment']
            
            # Get position parameters
            price_min = position['price_range_min']
            price_max = position['price_range_max']
            liquidity = position['liquidity_amount']
            
            # For this implementation, we'll use a simplified approach
            # In a real system, you'd need the exact AMM math for concentrated liquidity
            
            # Calculate current price ratio (assuming token1/token0 price)
            if token0_price > 0:
                current_price_ratio = token1_price / token0_price
            else:
                current_price_ratio = price_min  # Fallback
            
            # Check if price is in range
            if current_price_ratio < price_min:
                # Price below range - all liquidity is in token0
                # Calculate token0 amount based on liquidity and price range
                token0_amount = liquidity / (price_max ** 0.5 - price_min ** 0.5)
                token1_amount = 0
            elif current_price_ratio > price_max:
                # Price above range - all liquidity is in token1
                # Calculate token1 amount based on liquidity and price range
                token1_amount = liquidity * (price_max ** 0.5 - price_min ** 0.5)
                token0_amount = 0
            else:
                # Price in range - calculate both token amounts
                # This is a simplified version of the Uniswap V3 math
                sqrt_price = current_price_ratio ** 0.5
                sqrt_price_min = price_min ** 0.5
                sqrt_price_max = price_max ** 0.5
                
                # Calculate token amounts using concentrated liquidity formulas
                token0_amount = liquidity * (sqrt_price_max - sqrt_price) / (sqrt_price * sqrt_price_max)
                token1_amount = liquidity * (sqrt_price - sqrt_price_min)
            
            # Calculate total USD value
            total_value = (token0_amount * token0_price) + (token1_amount * token1_price)
            
            logger.debug(f"Position {position['id']} value calculation: "
                        f"token0_amount={token0_amount:.4f}, token1_amount={token1_amount:.4f}, "
                        f"total_value=${total_value:.2f}")
            
            return total_value
            
        except Exception as e:
            logger.error(f"Error calculating current value for position {position['id']}: {str(e)}")
            # Return initial investment as fallback
            return position['initial_investment']
    
    def _calculate_impermanent_loss(self, position: Dict[str, Any], current_price: float) -> float:
        """
        Calculate impermanent loss.
        
        This is a simplified calculation. Real IL calculation for concentrated
        liquidity is complex and depends on the price path and range utilization.
        """
        # Simplified calculation - placeholder
        return 0.0
    
    def _calculate_position_return_pct(self, position: Dict[str, Any]) -> float:
        """Calculate position return percentage."""
        if position['initial_investment'] == 0:
            return 0.0
        
        total_return = position.get('total_return', position['fees_collected'])
        return (total_return / position['initial_investment']) * 100
    
    def _calculate_apr(self, position: Dict[str, Any]) -> float:
        """
        Calculate annualized percentage return (APR).
        
        Args:
            position (Dict[str, Any]): Position data
            
        Returns:
            float: APR percentage
        """
        try:
            from datetime import timezone
            
            entry_date = datetime.fromisoformat(position['entry_date'].replace('Z', '+00:00'))
            current_date = datetime.now(timezone.utc)
            
            if position['status'] == 'closed' and position.get('exit_date'):
                current_date = datetime.fromisoformat(position['exit_date'].replace('Z', '+00:00'))
            
            # Ensure both dates are timezone-aware
            if entry_date.tzinfo is None:
                entry_date = entry_date.replace(tzinfo=timezone.utc)
            if current_date.tzinfo is None:
                current_date = current_date.replace(tzinfo=timezone.utc)
            
            days_elapsed = (current_date - entry_date).days
            
            if days_elapsed <= 0:
                return 0.0
            
            total_return_pct = self._calculate_position_return_pct(position)
            apr = (total_return_pct / days_elapsed) * 365
            
            return apr
            
        except Exception as e:
            logger.error(f"Error calculating APR: {str(e)}")
            return 0.0
    
    def __repr__(self) -> str:
        """String representation of the CLService."""
        return f"<CLService(db_path='{self.position_model.db_path}')>"