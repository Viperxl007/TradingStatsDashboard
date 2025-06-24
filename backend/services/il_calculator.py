"""
Impermanent Loss Calculator Service

This module provides comprehensive impermanent loss calculations and analytics
for concentrated liquidity positions with historical tracking and comparisons.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

from models.cl_position import CLPosition
from models.cl_price_history import CLPriceHistory
from models.cl_fee_history import CLFeeHistory

logger = logging.getLogger(__name__)


@dataclass
class ILCalculation:
    """Data structure for impermanent loss calculation results."""
    position_id: str
    entry_price: float
    current_price: float
    price_ratio: float
    il_percentage: float
    il_dollar_amount: float
    hodl_value: float
    lp_value: float
    fees_collected: float
    net_result: float
    calculation_timestamp: datetime


@dataclass
class ILAnalytics:
    """Data structure for comprehensive IL analytics."""
    position_id: str
    current_il: ILCalculation
    historical_il: List[ILCalculation]
    max_il_experienced: float
    min_il_experienced: float
    average_il: float
    il_vs_fees_ratio: float
    break_even_fee_rate: float
    days_to_break_even: Optional[float]


class ILCalculatorService:
    """
    Service for calculating and tracking impermanent loss in CL positions.
    
    Provides standard IL calculations, historical tracking, and analytics
    comparing IL against fee collection performance.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the IL calculator service.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.position_model = CLPosition(db_path)
        self.price_history_model = CLPriceHistory(db_path)
        self.fee_history_model = CLFeeHistory(db_path)
        
        logger.info("IL Calculator Service initialized")
    
    def calculate_entry_price(self, position: Dict[str, Any]) -> float:
        """
        Calculate the effective entry price for a CL position.
        
        For CL positions, we use the geometric mean of the price range
        as the effective entry price for IL calculations.
        
        Args:
            position (Dict[str, Any]): Position data
            
        Returns:
            float: Effective entry price
        """
        try:
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            
            if price_min <= 0 or price_max <= 0:
                logger.warning(f"Invalid price range for position {position.get('id')}")
                return 0
            
            # Use geometric mean as entry price
            entry_price = math.sqrt(price_min * price_max)
            
            logger.debug(f"Calculated entry price {entry_price} for position {position.get('id')}")
            return entry_price
            
        except Exception as e:
            logger.error(f"Failed to calculate entry price for position {position.get('id')}: {str(e)}")
            return 0
    
    def calculate_standard_il(self, entry_price: float, current_price: float) -> float:
        """
        Calculate standard impermanent loss using the classic formula.
        
        Formula: IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
        
        Args:
            entry_price (float): Entry price
            current_price (float): Current price
            
        Returns:
            float: Impermanent loss as percentage (negative values indicate loss)
        """
        try:
            if entry_price <= 0 or current_price <= 0:
                return 0
            
            price_ratio = current_price / entry_price
            
            # Standard IL formula
            il_multiplier = 2 * math.sqrt(price_ratio) / (1 + price_ratio) - 1
            il_percentage = il_multiplier * 100
            
            return il_percentage
            
        except Exception as e:
            logger.error(f"Failed to calculate standard IL: {str(e)}")
            return 0
    
    def calculate_concentrated_liquidity_il(
        self, 
        position: Dict[str, Any], 
        current_price: float
    ) -> float:
        """
        Calculate impermanent loss specific to concentrated liquidity positions.
        
        This accounts for the fact that CL positions only provide liquidity
        within a specific range, affecting the IL calculation.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current price
            
        Returns:
            float: CL-specific impermanent loss percentage
        """
        try:
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            entry_price = self.calculate_entry_price(position)
            
            if entry_price <= 0:
                return 0
            
            # If price is within range, use standard IL calculation
            if price_min <= current_price <= price_max:
                return self.calculate_standard_il(entry_price, current_price)
            
            # If price is outside range, position becomes single-sided
            if current_price < price_min:
                # All liquidity is in quote token (stable)
                # IL is the difference between holding tokens vs holding stable
                price_ratio = current_price / entry_price
                il_percentage = (1 - price_ratio) * 100
            else:
                # All liquidity is in base token
                # IL is the opportunity cost of not holding 50/50
                price_ratio = current_price / entry_price
                il_percentage = (2 * math.sqrt(price_ratio) / (1 + price_ratio) - 1) * 100
            
            return il_percentage
            
        except Exception as e:
            logger.error(f"Failed to calculate CL IL for position {position.get('id')}: {str(e)}")
            return 0
    
    def calculate_dollar_il(
        self, 
        position: Dict[str, Any], 
        il_percentage: float
    ) -> float:
        """
        Calculate impermanent loss in dollar terms.
        
        Args:
            position (Dict[str, Any]): Position data
            il_percentage (float): IL percentage
            
        Returns:
            float: IL in dollar amount
        """
        try:
            initial_investment = float(position.get('initial_investment', 0))
            
            if initial_investment <= 0:
                return 0
            
            # Convert percentage to dollar amount
            il_dollar = (il_percentage / 100) * initial_investment
            
            return il_dollar
            
        except Exception as e:
            logger.error(f"Failed to calculate dollar IL: {str(e)}")
            return 0
    
    def calculate_hodl_vs_lp_value(
        self, 
        position: Dict[str, Any], 
        current_price: float
    ) -> Tuple[float, float]:
        """
        Calculate the value of HODLing vs providing liquidity.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current price
            
        Returns:
            Tuple[float, float]: (HODL value, LP value)
        """
        try:
            initial_investment = float(position.get('initial_investment', 0))
            entry_price = self.calculate_entry_price(position)
            fees_collected = float(position.get('fees_collected', 0))
            
            if initial_investment <= 0 or entry_price <= 0:
                return 0, 0
            
            # HODL value: if we had just held 50/50 tokens
            price_ratio = current_price / entry_price
            hodl_value = initial_investment * math.sqrt(price_ratio)
            
            # LP value: current position value plus fees
            # Simplified calculation - in reality this would depend on range and current price
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            
            if price_min <= current_price <= price_max:
                # In range - providing liquidity
                lp_base_value = initial_investment * (2 * math.sqrt(price_ratio) / (1 + price_ratio))
            else:
                # Out of range - single sided
                if current_price < price_min:
                    lp_base_value = initial_investment  # All in stable
                else:
                    lp_base_value = initial_investment * price_ratio  # All in base token
            
            lp_value = lp_base_value + fees_collected
            
            return hodl_value, lp_value
            
        except Exception as e:
            logger.error(f"Failed to calculate HODL vs LP value: {str(e)}")
            return 0, 0
    
    def calculate_current_il(
        self, 
        position: Dict[str, Any], 
        current_price: float
    ) -> ILCalculation:
        """
        Calculate comprehensive current IL for a position.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current price
            
        Returns:
            ILCalculation: Complete IL calculation results
        """
        try:
            position_id = position.get('id')
            entry_price = self.calculate_entry_price(position)
            
            if entry_price <= 0 or current_price <= 0:
                return ILCalculation(
                    position_id=position_id,
                    entry_price=entry_price,
                    current_price=current_price,
                    price_ratio=0,
                    il_percentage=0,
                    il_dollar_amount=0,
                    hodl_value=0,
                    lp_value=0,
                    fees_collected=0,
                    net_result=0,
                    calculation_timestamp=datetime.utcnow()
                )
            
            # Calculate IL
            price_ratio = current_price / entry_price
            il_percentage = self.calculate_concentrated_liquidity_il(position, current_price)
            il_dollar_amount = self.calculate_dollar_il(position, il_percentage)
            
            # Calculate HODL vs LP values
            hodl_value, lp_value = self.calculate_hodl_vs_lp_value(position, current_price)
            
            # Get fees collected
            fees_collected = float(position.get('fees_collected', 0))
            
            # Calculate net result (LP value - HODL value)
            net_result = lp_value - hodl_value
            
            return ILCalculation(
                position_id=position_id,
                entry_price=entry_price,
                current_price=current_price,
                price_ratio=price_ratio,
                il_percentage=il_percentage,
                il_dollar_amount=il_dollar_amount,
                hodl_value=hodl_value,
                lp_value=lp_value,
                fees_collected=fees_collected,
                net_result=net_result,
                calculation_timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to calculate current IL for position {position_id}: {str(e)}")
            return ILCalculation(
                position_id=position_id,
                entry_price=0,
                current_price=current_price,
                price_ratio=0,
                il_percentage=0,
                il_dollar_amount=0,
                hodl_value=0,
                lp_value=0,
                fees_collected=0,
                net_result=0,
                calculation_timestamp=datetime.utcnow()
            )
    
    def calculate_historical_il(
        self, 
        position: Dict[str, Any], 
        days_back: int = 30
    ) -> List[ILCalculation]:
        """
        Calculate historical IL for a position over time.
        
        Args:
            position (Dict[str, Any]): Position data
            days_back (int): Number of days to look back
            
        Returns:
            List[ILCalculation]: Historical IL calculations
        """
        try:
            position_id = position.get('id')
            
            # Get historical price data
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days_back)
            
            price_history = self.price_history_model.get_price_history(
                position_id=position_id,
                start_date=start_date,
                end_date=end_date
            )
            
            if not price_history:
                logger.warning(f"No price history found for position {position_id}")
                return []
            
            historical_calculations = []
            
            for price_entry in price_history:
                historical_price = float(price_entry.get('price', 0))
                timestamp = datetime.fromtimestamp(price_entry.get('timestamp', 0))
                
                if historical_price > 0:
                    # Create a snapshot of position at that time
                    historical_position = position.copy()
                    
                    # Calculate IL for that point in time
                    il_calc = self.calculate_current_il(historical_position, historical_price)
                    il_calc.calculation_timestamp = timestamp
                    
                    historical_calculations.append(il_calc)
            
            return historical_calculations
            
        except Exception as e:
            logger.error(f"Failed to calculate historical IL for position {position_id}: {str(e)}")
            return []
    
    def calculate_il_analytics(
        self, 
        position: Dict[str, Any], 
        current_price: float,
        days_back: int = 30
    ) -> ILAnalytics:
        """
        Calculate comprehensive IL analytics for a position.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current price
            days_back (int): Days of historical data to analyze
            
        Returns:
            ILAnalytics: Complete IL analytics
        """
        try:
            position_id = position.get('id')
            
            # Calculate current IL
            current_il = self.calculate_current_il(position, current_price)
            
            # Calculate historical IL
            historical_il = self.calculate_historical_il(position, days_back)
            
            # Calculate analytics from historical data
            if historical_il:
                il_values = [calc.il_percentage for calc in historical_il]
                max_il = min(il_values)  # Most negative (worst IL)
                min_il = max(il_values)  # Least negative (best IL)
                average_il = sum(il_values) / len(il_values)
            else:
                max_il = current_il.il_percentage
                min_il = current_il.il_percentage
                average_il = current_il.il_percentage
            
            # Calculate IL vs fees ratio
            fees_collected = current_il.fees_collected
            il_dollar_loss = abs(current_il.il_dollar_amount) if current_il.il_dollar_amount < 0 else 0
            
            if il_dollar_loss > 0:
                il_vs_fees_ratio = fees_collected / il_dollar_loss
            else:
                il_vs_fees_ratio = float('inf') if fees_collected > 0 else 0
            
            # Calculate break-even fee rate
            initial_investment = float(position.get('initial_investment', 0))
            if initial_investment > 0 and il_dollar_loss > 0:
                break_even_fee_rate = (il_dollar_loss / initial_investment) * 100
            else:
                break_even_fee_rate = 0
            
            # Calculate days to break even at current fee velocity
            entry_date_str = position.get('entry_date')
            if entry_date_str and fees_collected > 0:
                entry_date = datetime.fromisoformat(entry_date_str.replace('Z', '+00:00'))
                days_active = (datetime.utcnow() - entry_date).days
                
                if days_active > 0:
                    daily_fee_rate = fees_collected / days_active
                    if daily_fee_rate > 0 and il_dollar_loss > 0:
                        days_to_break_even = il_dollar_loss / daily_fee_rate
                    else:
                        days_to_break_even = None
                else:
                    days_to_break_even = None
            else:
                days_to_break_even = None
            
            return ILAnalytics(
                position_id=position_id,
                current_il=current_il,
                historical_il=historical_il,
                max_il_experienced=max_il,
                min_il_experienced=min_il,
                average_il=average_il,
                il_vs_fees_ratio=il_vs_fees_ratio,
                break_even_fee_rate=break_even_fee_rate,
                days_to_break_even=days_to_break_even
            )
            
        except Exception as e:
            logger.error(f"Failed to calculate IL analytics for position {position_id}: {str(e)}")
            # Return empty analytics on error
            return ILAnalytics(
                position_id=position_id,
                current_il=self.calculate_current_il(position, current_price),
                historical_il=[],
                max_il_experienced=0,
                min_il_experienced=0,
                average_il=0,
                il_vs_fees_ratio=0,
                break_even_fee_rate=0,
                days_to_break_even=None
            )
    
    def compare_positions_il(
        self, 
        positions: List[Dict[str, Any]], 
        current_prices: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Compare IL performance across multiple positions.
        
        Args:
            positions (List[Dict[str, Any]]): List of positions
            current_prices (Dict[str, float]): Current prices by position ID
            
        Returns:
            Dict[str, Any]: Comparison results
        """
        try:
            comparisons = []
            
            for position in positions:
                position_id = position.get('id')
                current_price = current_prices.get(position_id, 0)
                
                if current_price > 0:
                    il_calc = self.calculate_current_il(position, current_price)
                    
                    comparisons.append({
                        'position_id': position_id,
                        'pair_symbol': position.get('pair_symbol', ''),
                        'il_percentage': il_calc.il_percentage,
                        'il_dollar_amount': il_calc.il_dollar_amount,
                        'fees_collected': il_calc.fees_collected,
                        'net_result': il_calc.net_result,
                        'il_vs_fees_ratio': il_calc.fees_collected / abs(il_calc.il_dollar_amount) if il_calc.il_dollar_amount < 0 else float('inf')
                    })
            
            # Sort by net result (best performing first)
            comparisons.sort(key=lambda x: x['net_result'], reverse=True)
            
            # Calculate summary statistics
            if comparisons:
                il_values = [comp['il_percentage'] for comp in comparisons]
                net_results = [comp['net_result'] for comp in comparisons]
                
                summary = {
                    'total_positions': len(comparisons),
                    'average_il': sum(il_values) / len(il_values),
                    'worst_il': min(il_values),
                    'best_il': max(il_values),
                    'total_net_result': sum(net_results),
                    'profitable_positions': len([r for r in net_results if r > 0]),
                    'losing_positions': len([r for r in net_results if r < 0])
                }
            else:
                summary = {
                    'total_positions': 0,
                    'average_il': 0,
                    'worst_il': 0,
                    'best_il': 0,
                    'total_net_result': 0,
                    'profitable_positions': 0,
                    'losing_positions': 0
                }
            
            return {
                'comparisons': comparisons,
                'summary': summary,
                'comparison_timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to compare positions IL: {str(e)}")
            return {
                'comparisons': [],
                'summary': {},
                'error': str(e)
            }
    
    def get_il_insights(self, analytics: ILAnalytics) -> List[str]:
        """
        Generate insights and recommendations based on IL analytics.
        
        Args:
            analytics (ILAnalytics): IL analytics data
            
        Returns:
            List[str]: List of insights and recommendations
        """
        insights = []
        
        try:
            current_il = analytics.current_il
            
            # IL severity insights
            if current_il.il_percentage < -10:
                insights.append("⚠️ High impermanent loss detected (>10%). Consider rebalancing or closing position.")
            elif current_il.il_percentage < -5:
                insights.append("⚡ Moderate impermanent loss (5-10%). Monitor closely.")
            elif current_il.il_percentage > -2:
                insights.append("✅ Low impermanent loss (<2%). Position performing well.")
            
            # Fee vs IL comparison
            if analytics.il_vs_fees_ratio > 2:
                insights.append("💰 Fees are significantly outpacing impermanent loss. Excellent performance!")
            elif analytics.il_vs_fees_ratio > 1:
                insights.append("📈 Fees are covering impermanent loss. Good position management.")
            elif analytics.il_vs_fees_ratio > 0.5:
                insights.append("⚖️ Fees partially offsetting impermanent loss. Consider fee optimization.")
            else:
                insights.append("📉 Impermanent loss exceeding fee collection. Review position strategy.")
            
            # Break-even insights
            if analytics.days_to_break_even:
                if analytics.days_to_break_even < 30:
                    insights.append(f"🎯 Position will break even in ~{analytics.days_to_break_even:.0f} days at current fee rate.")
                elif analytics.days_to_break_even < 90:
                    insights.append(f"⏳ Position needs ~{analytics.days_to_break_even:.0f} days to break even. Consider fee optimization.")
                else:
                    insights.append(f"⏰ Long break-even period ({analytics.days_to_break_even:.0f} days). Review position viability.")
            
            # Historical performance insights
            if analytics.historical_il:
                if analytics.current_il.il_percentage > analytics.average_il:
                    insights.append("📊 Current IL is better than historical average. Good timing.")
                else:
                    insights.append("📊 Current IL is worse than historical average. Consider rebalancing.")
                
                if abs(analytics.max_il_experienced) > 15:
                    insights.append("🎢 Position has experienced high volatility. Consider tighter ranges.")
            
            # Net result insights
            if current_il.net_result > 0:
                insights.append(f"✅ Position is profitable: ${current_il.net_result:.2f} net gain.")
            else:
                insights.append(f"❌ Position is losing: ${abs(current_il.net_result):.2f} net loss.")
            
        except Exception as e:
            logger.error(f"Failed to generate IL insights: {str(e)}")
            insights.append("⚠️ Unable to generate insights due to calculation error.")
        
        return insights