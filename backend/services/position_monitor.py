"""
Position Monitor Service

This module provides monitoring capabilities for concentrated liquidity positions,
including range breach detection, fee velocity monitoring, and alert generation.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json
from dataclasses import dataclass
from enum import Enum

from models.cl_position import CLPosition
from models.cl_price_history import CLPriceHistory
from models.cl_fee_history import CLFeeHistory

logger = logging.getLogger(__name__)


class AlertType(Enum):
    """Types of alerts that can be generated."""
    RANGE_BREACH = "range_breach"
    RANGE_WARNING = "range_warning"
    LOW_FEE_VELOCITY = "low_fee_velocity"
    HIGH_IMPERMANENT_LOSS = "high_impermanent_loss"
    POSITION_OUT_OF_RANGE = "position_out_of_range"
    LIQUIDITY_LOW = "liquidity_low"


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    position_id: str
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    data: Dict[str, Any]
    created_at: datetime
    acknowledged: bool = False


class PositionMonitorService:
    """
    Service for monitoring CL positions and generating alerts.
    
    Monitors position health, range breaches, fee collection,
    and other critical metrics for active positions.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the position monitor service.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.position_model = CLPosition(db_path)
        self.price_history_model = CLPriceHistory(db_path)
        self.fee_history_model = CLFeeHistory(db_path)
        
        # Alert storage (in-memory for now, could be moved to database)
        self._alerts = []
        self._alert_counter = 0
        
        # Load configuration
        try:
            from backend.local_config import ALERT_THRESHOLDS
            self.thresholds = ALERT_THRESHOLDS
        except ImportError:
            self.thresholds = {
                'out_of_range_alert': True,
                'fee_collection_threshold': 10.0,
                'impermanent_loss_threshold': 5.0,
                'position_value_change_threshold': 10.0,
                'range_warning_threshold': 5.0,  # Alert when within 5% of range bounds
                'low_fee_velocity_threshold': 10.0,  # Alert when APR < 10%
                'liquidity_threshold': 1000.0  # Alert when liquidity < $1000
            }
        
        logger.info("Position Monitor Service initialized")
    
    def _generate_alert_id(self) -> str:
        """Generate a unique alert ID."""
        self._alert_counter += 1
        return f"alert_{int(datetime.utcnow().timestamp())}_{self._alert_counter}"
    
    def _create_alert(
        self, 
        position_id: str, 
        alert_type: AlertType, 
        severity: AlertSeverity,
        title: str, 
        message: str, 
        data: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """
        Create a new alert.
        
        Args:
            position_id (str): Position ID
            alert_type (AlertType): Type of alert
            severity (AlertSeverity): Alert severity
            title (str): Alert title
            message (str): Alert message
            data (Optional[Dict[str, Any]]): Additional alert data
            
        Returns:
            Alert: Created alert
        """
        alert = Alert(
            id=self._generate_alert_id(),
            position_id=position_id,
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            data=data or {},
            created_at=datetime.utcnow()
        )
        
        self._alerts.append(alert)
        logger.info(f"Created {severity.value} alert for position {position_id}: {title}")
        
        return alert
    
    def check_range_breach(self, position: Dict[str, Any], current_price: float) -> List[Alert]:
        """
        Check if position is approaching or has breached its range.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current token price
            
        Returns:
            List[Alert]: List of generated alerts
        """
        alerts = []
        position_id = position.get('id')
        pair_symbol = position.get('pair_symbol', '')
        
        try:
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            
            if price_min <= 0 or price_max <= 0:
                return alerts
            
            # Check if completely out of range
            if current_price < price_min or current_price > price_max:
                if self.thresholds.get('out_of_range_alert', True):
                    side = "below minimum" if current_price < price_min else "above maximum"
                    bound = price_min if current_price < price_min else price_max
                    
                    alert = self._create_alert(
                        position_id=position_id,
                        alert_type=AlertType.POSITION_OUT_OF_RANGE,
                        severity=AlertSeverity.CRITICAL,
                        title=f"Position Out of Range - {pair_symbol}",
                        message=f"Price ${current_price:.4f} is {side} bound of ${bound:.4f}. Position is not earning fees.",
                        data={
                            'current_price': current_price,
                            'price_min': price_min,
                            'price_max': price_max,
                            'out_of_range_side': side
                        }
                    )
                    alerts.append(alert)
            
            else:
                # Check if approaching range bounds
                warning_threshold = self.thresholds.get('range_warning_threshold', 5.0)
                
                # Distance to minimum bound
                distance_to_min = (current_price - price_min) / price_min * 100
                if distance_to_min <= warning_threshold:
                    alert = self._create_alert(
                        position_id=position_id,
                        alert_type=AlertType.RANGE_WARNING,
                        severity=AlertSeverity.WARNING,
                        title=f"Approaching Range Minimum - {pair_symbol}",
                        message=f"Price ${current_price:.4f} is {distance_to_min:.1f}% above minimum bound ${price_min:.4f}",
                        data={
                            'current_price': current_price,
                            'price_min': price_min,
                            'distance_percent': distance_to_min
                        }
                    )
                    alerts.append(alert)
                
                # Distance to maximum bound
                distance_to_max = (price_max - current_price) / price_max * 100
                if distance_to_max <= warning_threshold:
                    alert = self._create_alert(
                        position_id=position_id,
                        alert_type=AlertType.RANGE_WARNING,
                        severity=AlertSeverity.WARNING,
                        title=f"Approaching Range Maximum - {pair_symbol}",
                        message=f"Price ${current_price:.4f} is {distance_to_max:.1f}% below maximum bound ${price_max:.4f}",
                        data={
                            'current_price': current_price,
                            'price_max': price_max,
                            'distance_percent': distance_to_max
                        }
                    )
                    alerts.append(alert)
            
        except Exception as e:
            logger.error(f"Failed to check range breach for position {position_id}: {str(e)}")
        
        return alerts
    
    def calculate_fee_velocity(self, position: Dict[str, Any]) -> Optional[float]:
        """
        Calculate the fee collection velocity (APR) for a position.
        
        Args:
            position (Dict[str, Any]): Position data
            
        Returns:
            Optional[float]: Fee velocity as APR percentage, or None if cannot calculate
        """
        try:
            position_id = position.get('id')
            initial_investment = float(position.get('initial_investment', 0))
            fees_collected = float(position.get('fees_collected', 0))
            
            if initial_investment <= 0:
                return None
            
            # Get position age in days
            entry_date_str = position.get('entry_date')
            if not entry_date_str:
                return None
            
            entry_date = datetime.fromisoformat(entry_date_str.replace('Z', '+00:00'))
            days_active = (datetime.utcnow() - entry_date).days
            
            if days_active <= 0:
                return None
            
            # Calculate annualized fee rate
            daily_fee_rate = (fees_collected / initial_investment) / days_active
            annual_fee_rate = daily_fee_rate * 365 * 100  # Convert to percentage
            
            return annual_fee_rate
            
        except Exception as e:
            logger.error(f"Failed to calculate fee velocity for position {position.get('id')}: {str(e)}")
            return None
    
    def check_fee_velocity(self, position: Dict[str, Any]) -> List[Alert]:
        """
        Check if position has low fee collection velocity.
        
        Args:
            position (Dict[str, Any]): Position data
            
        Returns:
            List[Alert]: List of generated alerts
        """
        alerts = []
        position_id = position.get('id')
        pair_symbol = position.get('pair_symbol', '')
        
        try:
            fee_velocity = self.calculate_fee_velocity(position)
            
            if fee_velocity is not None:
                threshold = self.thresholds.get('low_fee_velocity_threshold', 10.0)
                
                if fee_velocity < threshold:
                    alert = self._create_alert(
                        position_id=position_id,
                        alert_type=AlertType.LOW_FEE_VELOCITY,
                        severity=AlertSeverity.WARNING,
                        title=f"Low Fee Velocity - {pair_symbol}",
                        message=f"Position earning {fee_velocity:.2f}% APR, below threshold of {threshold}%",
                        data={
                            'fee_velocity_apr': fee_velocity,
                            'threshold': threshold,
                            'fees_collected': position.get('fees_collected', 0),
                            'initial_investment': position.get('initial_investment', 0)
                        }
                    )
                    alerts.append(alert)
            
        except Exception as e:
            logger.error(f"Failed to check fee velocity for position {position_id}: {str(e)}")
        
        return alerts
    
    def calculate_impermanent_loss(self, position: Dict[str, Any], current_price: float) -> Optional[float]:
        """
        Calculate impermanent loss for a position.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current token price
            
        Returns:
            Optional[float]: Impermanent loss percentage, or None if cannot calculate
        """
        try:
            # Get entry price (simplified - using middle of range)
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            
            if price_min <= 0 or price_max <= 0:
                return None
            
            # Use geometric mean of range as entry price
            entry_price = (price_min * price_max) ** 0.5
            
            if entry_price <= 0:
                return None
            
            # Calculate price ratio
            price_ratio = current_price / entry_price
            
            # Standard IL formula: IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
            if price_ratio > 0:
                il_multiplier = 2 * (price_ratio ** 0.5) / (1 + price_ratio) - 1
                il_percentage = il_multiplier * 100
                return il_percentage
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to calculate impermanent loss for position {position.get('id')}: {str(e)}")
            return None
    
    def check_impermanent_loss(self, position: Dict[str, Any], current_price: float) -> List[Alert]:
        """
        Check if position has high impermanent loss.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current token price
            
        Returns:
            List[Alert]: List of generated alerts
        """
        alerts = []
        position_id = position.get('id')
        pair_symbol = position.get('pair_symbol', '')
        
        try:
            il_percentage = self.calculate_impermanent_loss(position, current_price)
            
            if il_percentage is not None:
                threshold = self.thresholds.get('impermanent_loss_threshold', 5.0)
                
                # IL is typically negative, so we check if it's below negative threshold
                if il_percentage < -threshold:
                    alert = self._create_alert(
                        position_id=position_id,
                        alert_type=AlertType.HIGH_IMPERMANENT_LOSS,
                        severity=AlertSeverity.WARNING,
                        title=f"High Impermanent Loss - {pair_symbol}",
                        message=f"Position has {abs(il_percentage):.2f}% impermanent loss, above {threshold}% threshold",
                        data={
                            'impermanent_loss_percent': il_percentage,
                            'threshold': threshold,
                            'current_price': current_price
                        }
                    )
                    alerts.append(alert)
            
        except Exception as e:
            logger.error(f"Failed to check impermanent loss for position {position_id}: {str(e)}")
        
        return alerts
    
    def check_liquidity_health(self, position: Dict[str, Any], price_data: Dict[str, Any]) -> List[Alert]:
        """
        Check if position has adequate liquidity.
        
        Args:
            position (Dict[str, Any]): Position data
            price_data (Dict[str, Any]): Current price data from DexScreener
            
        Returns:
            List[Alert]: List of generated alerts
        """
        alerts = []
        position_id = position.get('id')
        pair_symbol = position.get('pair_symbol', '')
        
        try:
            liquidity_usd = price_data.get('liquidity_usd', 0)
            threshold = self.thresholds.get('liquidity_threshold', 1000.0)
            
            if liquidity_usd < threshold:
                alert = self._create_alert(
                    position_id=position_id,
                    alert_type=AlertType.LIQUIDITY_LOW,
                    severity=AlertSeverity.WARNING,
                    title=f"Low Liquidity - {pair_symbol}",
                    message=f"Pool liquidity ${liquidity_usd:,.2f} is below threshold of ${threshold:,.2f}",
                    data={
                        'liquidity_usd': liquidity_usd,
                        'threshold': threshold,
                        'volume_24h': price_data.get('volume_24h', 0)
                    }
                )
                alerts.append(alert)
            
        except Exception as e:
            logger.error(f"Failed to check liquidity health for position {position_id}: {str(e)}")
        
        return alerts
    
    def calculate_position_health_score(self, position: Dict[str, Any], current_price: float, price_data: Dict[str, Any]) -> float:
        """
        Calculate an overall health score for a position (0-100).
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current token price
            price_data (Dict[str, Any]): Current price data
            
        Returns:
            float: Health score from 0 (poor) to 100 (excellent)
        """
        try:
            score = 100.0
            
            # Range position score (40 points max)
            price_min = float(position.get('price_range_min', 0))
            price_max = float(position.get('price_range_max', 0))
            
            if price_min > 0 and price_max > 0:
                if price_min <= current_price <= price_max:
                    # In range - full points
                    range_score = 40.0
                else:
                    # Out of range - score based on distance
                    if current_price < price_min:
                        distance = (price_min - current_price) / price_min
                    else:
                        distance = (current_price - price_max) / price_max
                    
                    range_score = max(0, 40.0 - (distance * 100))
            else:
                range_score = 0
            
            # Fee velocity score (30 points max)
            fee_velocity = self.calculate_fee_velocity(position)
            if fee_velocity is not None:
                if fee_velocity >= 20:
                    fee_score = 30.0
                elif fee_velocity >= 10:
                    fee_score = 20.0
                elif fee_velocity >= 5:
                    fee_score = 10.0
                else:
                    fee_score = 0
            else:
                fee_score = 15.0  # Neutral score if can't calculate
            
            # Impermanent loss score (20 points max)
            il_percentage = self.calculate_impermanent_loss(position, current_price)
            if il_percentage is not None:
                if il_percentage >= -2:
                    il_score = 20.0
                elif il_percentage >= -5:
                    il_score = 15.0
                elif il_percentage >= -10:
                    il_score = 10.0
                else:
                    il_score = 0
            else:
                il_score = 10.0  # Neutral score if can't calculate
            
            # Liquidity score (10 points max)
            liquidity_usd = price_data.get('liquidity_usd', 0)
            if liquidity_usd >= 100000:
                liquidity_score = 10.0
            elif liquidity_usd >= 10000:
                liquidity_score = 7.0
            elif liquidity_usd >= 1000:
                liquidity_score = 5.0
            else:
                liquidity_score = 0
            
            total_score = range_score + fee_score + il_score + liquidity_score
            return min(100.0, max(0.0, total_score))
            
        except Exception as e:
            logger.error(f"Failed to calculate health score for position {position.get('id')}: {str(e)}")
            return 50.0  # Neutral score on error
    
    def monitor_position(self, position: Dict[str, Any], current_price: float, price_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Monitor a single position and generate alerts.
        
        Args:
            position (Dict[str, Any]): Position data
            current_price (float): Current token price
            price_data (Dict[str, Any]): Current price data
            
        Returns:
            Dict[str, Any]: Monitoring results
        """
        position_id = position.get('id')
        alerts = []
        
        try:
            # Check various conditions
            alerts.extend(self.check_range_breach(position, current_price))
            alerts.extend(self.check_fee_velocity(position))
            alerts.extend(self.check_impermanent_loss(position, current_price))
            alerts.extend(self.check_liquidity_health(position, price_data))
            
            # Calculate health score
            health_score = self.calculate_position_health_score(position, current_price, price_data)
            
            # Calculate additional metrics
            fee_velocity = self.calculate_fee_velocity(position)
            il_percentage = self.calculate_impermanent_loss(position, current_price)
            
            return {
                'position_id': position_id,
                'alerts_generated': len(alerts),
                'health_score': health_score,
                'fee_velocity_apr': fee_velocity,
                'impermanent_loss_percent': il_percentage,
                'in_range': position.get('price_range_min', 0) <= current_price <= position.get('price_range_max', float('inf')),
                'monitoring_timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to monitor position {position_id}: {str(e)}")
            return {
                'position_id': position_id,
                'error': str(e),
                'monitoring_timestamp': datetime.utcnow().isoformat()
            }
    
    def monitor_all_positions(self, positions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Monitor all provided positions.
        
        Args:
            positions_data (List[Dict[str, Any]]): List of position data with prices
            
        Returns:
            Dict[str, Any]: Overall monitoring results
        """
        results = []
        total_alerts = 0
        
        for pos_data in positions_data:
            position = pos_data.get('position', {})
            current_price = pos_data.get('current_price', 0)
            price_data = pos_data.get('price_data', {})
            
            if position and current_price > 0:
                result = self.monitor_position(position, current_price, price_data)
                results.append(result)
                total_alerts += result.get('alerts_generated', 0)
        
        return {
            'positions_monitored': len(results),
            'total_alerts_generated': total_alerts,
            'results': results,
            'monitoring_timestamp': datetime.utcnow().isoformat()
        }
    
    def get_active_alerts(self, position_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get active alerts, optionally filtered by position.
        
        Args:
            position_id (Optional[str]): Filter by position ID
            
        Returns:
            List[Dict[str, Any]]: List of active alerts
        """
        alerts = self._alerts
        
        if position_id:
            alerts = [alert for alert in alerts if alert.position_id == position_id]
        
        # Filter out acknowledged alerts older than 24 hours
        cutoff = datetime.utcnow() - timedelta(hours=24)
        active_alerts = [
            alert for alert in alerts 
            if not alert.acknowledged or alert.created_at > cutoff
        ]
        
        # Convert to dict format
        return [
            {
                'id': alert.id,
                'position_id': alert.position_id,
                'type': alert.alert_type.value,
                'severity': alert.severity.value,
                'title': alert.title,
                'message': alert.message,
                'data': alert.data,
                'created_at': alert.created_at.isoformat(),
                'acknowledged': alert.acknowledged
            }
            for alert in active_alerts
        ]
    
    def acknowledge_alert(self, alert_id: str) -> bool:
        """
        Acknowledge an alert.
        
        Args:
            alert_id (str): Alert ID to acknowledge
            
        Returns:
            bool: True if successful, False otherwise
        """
        for alert in self._alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                logger.info(f"Acknowledged alert {alert_id}")
                return True
        
        logger.warning(f"Alert {alert_id} not found")
        return False
    
    def clear_old_alerts(self, hours: int = 168) -> int:
        """
        Clear old acknowledged alerts.
        
        Args:
            hours (int): Hours after which to clear acknowledged alerts
            
        Returns:
            int: Number of alerts cleared
        """
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        initial_count = len(self._alerts)
        self._alerts = [
            alert for alert in self._alerts
            if not alert.acknowledged or alert.created_at > cutoff
        ]
        
        cleared_count = initial_count - len(self._alerts)
        
        if cleared_count > 0:
            logger.info(f"Cleared {cleared_count} old alerts")
        
        return cleared_count
    
    def get_monitoring_stats(self) -> Dict[str, Any]:
        """
        Get monitoring service statistics.
        
        Returns:
            Dict[str, Any]: Monitoring statistics
        """
        total_alerts = len(self._alerts)
        active_alerts = len([alert for alert in self._alerts if not alert.acknowledged])
        
        # Count alerts by type
        alert_counts = {}
        for alert in self._alerts:
            alert_type = alert.alert_type.value
            alert_counts[alert_type] = alert_counts.get(alert_type, 0) + 1
        
        return {
            'total_alerts': total_alerts,
            'active_alerts': active_alerts,
            'acknowledged_alerts': total_alerts - active_alerts,
            'alert_counts_by_type': alert_counts,
            'thresholds': self.thresholds,
            'service_status': 'running'
        }