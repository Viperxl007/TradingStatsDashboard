"""
Position Optimization Engine for CL Position Tracking

This module provides advanced optimization capabilities including:
- Range optimization suggestions based on historical volatility
- Fee tier analysis and recommendations
- Capital allocation optimization across positions
- Rebalancing suggestions and automation
- Risk-adjusted return calculations
- Portfolio diversification analysis
"""

import logging
import numpy as np
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
import json
import uuid
from threading import Lock

logger = logging.getLogger(__name__)


class OptimizationType(Enum):
    """Optimization type enumeration."""
    RANGE_OPTIMIZATION = "range_optimization"
    FEE_TIER_ANALYSIS = "fee_tier_analysis"
    CAPITAL_ALLOCATION = "capital_allocation"
    REBALANCING = "rebalancing"
    RISK_ADJUSTMENT = "risk_adjustment"
    DIVERSIFICATION = "diversification"


class RiskLevel(Enum):
    """Risk level enumeration."""
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


@dataclass
class OptimizationSuggestion:
    """Optimization suggestion data structure."""
    id: str
    position_id: Optional[str]
    optimization_type: OptimizationType
    title: str
    description: str
    current_metrics: Dict[str, Any]
    suggested_changes: Dict[str, Any]
    expected_improvement: Dict[str, Any]
    confidence_score: float
    risk_level: RiskLevel
    implementation_priority: int
    created_at: datetime
    metadata: Dict[str, Any] = None


@dataclass
class PortfolioMetrics:
    """Portfolio performance metrics."""
    total_value: float
    total_fees: float
    total_il: float
    sharpe_ratio: float
    max_drawdown: float
    var_95: float
    diversification_ratio: float
    correlation_matrix: Dict[str, Dict[str, float]]


class PositionOptimizer:
    """
    Advanced position optimization engine for CL positions.
    
    Provides comprehensive optimization analysis and suggestions
    for improving position performance and portfolio efficiency.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the position optimizer.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'optimizer.db'
        )
        self.db_lock = Lock()
        
        # Initialize database
        self._ensure_database()
        
        logger.info("Position Optimizer initialized")
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create optimization_suggestions table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS optimization_suggestions (
                        id TEXT PRIMARY KEY,
                        position_id TEXT,
                        optimization_type TEXT NOT NULL,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        current_metrics TEXT NOT NULL,
                        suggested_changes TEXT NOT NULL,
                        expected_improvement TEXT NOT NULL,
                        confidence_score REAL NOT NULL,
                        risk_level TEXT NOT NULL,
                        implementation_priority INTEGER NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL,
                        metadata TEXT
                    )
                ''')
                
                # Create portfolio_snapshots table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                        id TEXT PRIMARY KEY,
                        snapshot_date INTEGER NOT NULL,
                        total_value REAL NOT NULL,
                        total_fees REAL NOT NULL,
                        total_il REAL NOT NULL,
                        sharpe_ratio REAL,
                        max_drawdown REAL,
                        var_95 REAL,
                        diversification_ratio REAL,
                        metrics_data TEXT,
                        created_at INTEGER NOT NULL
                    )
                ''')
                
                # Create optimization_history table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS optimization_history (
                        id TEXT PRIMARY KEY,
                        suggestion_id TEXT NOT NULL,
                        position_id TEXT,
                        action_taken TEXT NOT NULL,
                        implementation_date INTEGER NOT NULL,
                        before_metrics TEXT,
                        after_metrics TEXT,
                        actual_improvement TEXT,
                        notes TEXT,
                        created_at INTEGER NOT NULL,
                        FOREIGN KEY (suggestion_id) REFERENCES optimization_suggestions (id)
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_suggestions_position_id ON optimization_suggestions(position_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_suggestions_type ON optimization_suggestions(optimization_type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_suggestions_status ON optimization_suggestions(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_snapshots_date ON portfolio_snapshots(snapshot_date)')
                
                conn.commit()
                logger.info(f"Optimizer database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing optimizer database: {str(e)}")
            raise
    
    def analyze_position_range(self, position_data: Dict[str, Any], 
                              price_history: List[Dict[str, Any]]) -> OptimizationSuggestion:
        """
        Analyze position range and suggest optimizations.
        
        Args:
            position_data (Dict[str, Any]): Position data
            price_history (List[Dict[str, Any]]): Historical price data
            
        Returns:
            OptimizationSuggestion: Range optimization suggestion
        """
        try:
            if not price_history:
                raise ValueError("Price history required for range analysis")
            
            # Extract price data
            prices = [float(p['price']) for p in price_history]
            timestamps = [datetime.fromisoformat(p['timestamp'].replace('Z', '+00:00')) for p in price_history]
            
            # Calculate volatility metrics
            returns = np.diff(np.log(prices))
            volatility = np.std(returns) * np.sqrt(365)  # Annualized volatility
            
            # Current range metrics
            current_min = position_data['price_range_min']
            current_max = position_data['price_range_max']
            current_price = prices[-1] if prices else None
            
            # Calculate range utilization
            price_range = current_max - current_min
            range_center = (current_max + current_min) / 2
            
            # Analyze historical price distribution
            price_percentiles = np.percentile(prices, [5, 10, 25, 50, 75, 90, 95])
            
            # Suggest optimal range based on volatility
            optimal_width = volatility * current_price * 0.5  # 50% of annual volatility
            suggested_min = current_price - optimal_width / 2
            suggested_max = current_price + optimal_width / 2
            
            # Calculate expected improvements
            current_range_utilization = self._calculate_range_utilization(prices, current_min, current_max)
            suggested_range_utilization = self._calculate_range_utilization(prices, suggested_min, suggested_max)
            
            # Determine confidence and risk level
            confidence_score = min(0.95, len(prices) / 100)  # More data = higher confidence
            risk_level = self._determine_risk_level(volatility)
            
            current_metrics = {
                'range_min': current_min,
                'range_max': current_max,
                'range_width': price_range,
                'range_utilization': current_range_utilization,
                'volatility': volatility,
                'current_price': current_price
            }
            
            suggested_changes = {
                'new_range_min': suggested_min,
                'new_range_max': suggested_max,
                'new_range_width': optimal_width,
                'rebalance_frequency': 'weekly' if volatility > 0.5 else 'monthly'
            }
            
            expected_improvement = {
                'range_utilization_improvement': suggested_range_utilization - current_range_utilization,
                'expected_fee_increase': max(0, (suggested_range_utilization - current_range_utilization) * 0.1),
                'il_risk_change': self._calculate_il_risk_change(current_metrics, suggested_changes)
            }
            
            suggestion = OptimizationSuggestion(
                id=str(uuid.uuid4()),
                position_id=position_data['id'],
                optimization_type=OptimizationType.RANGE_OPTIMIZATION,
                title=f"Range Optimization for {position_data['trade_name']}",
                description=f"Optimize price range based on {len(prices)} days of historical data and {volatility:.2%} volatility",
                current_metrics=current_metrics,
                suggested_changes=suggested_changes,
                expected_improvement=expected_improvement,
                confidence_score=confidence_score,
                risk_level=risk_level,
                implementation_priority=self._calculate_priority(expected_improvement),
                created_at=datetime.now(),
                metadata={'analysis_period_days': len(prices), 'price_percentiles': price_percentiles.tolist()}
            )
            
            # Save suggestion
            self._save_suggestion(suggestion)
            
            logger.info(f"Generated range optimization suggestion for position {position_data['id']}")
            return suggestion
            
        except Exception as e:
            logger.error(f"Error analyzing position range: {str(e)}")
            raise
    
    def analyze_fee_tier_optimization(self, position_data: Dict[str, Any],
                                    volume_data: List[Dict[str, Any]]) -> OptimizationSuggestion:
        """
        Analyze fee tier optimization opportunities.
        
        Args:
            position_data (Dict[str, Any]): Position data
            volume_data (List[Dict[str, Any]]): Historical volume data
            
        Returns:
            OptimizationSuggestion: Fee tier optimization suggestion
        """
        try:
            if not volume_data:
                raise ValueError("Volume data required for fee tier analysis")
            
            # Current fee tier (assume 0.3% if not specified)
            current_fee_tier = position_data.get('fee_tier', 0.003)
            
            # Analyze volume patterns
            volumes = [float(v['volume']) for v in volume_data]
            avg_volume = np.mean(volumes)
            volume_volatility = np.std(volumes) / avg_volume if avg_volume > 0 else 0
            
            # Fee tier recommendations based on volume
            fee_tiers = [0.0005, 0.003, 0.01]  # 0.05%, 0.3%, 1%
            
            best_tier = current_fee_tier
            best_expected_fees = 0
            
            for tier in fee_tiers:
                # Estimate fees based on volume and tier
                expected_fees = avg_volume * tier * 365  # Annualized
                if expected_fees > best_expected_fees:
                    best_expected_fees = expected_fees
                    best_tier = tier
            
            current_metrics = {
                'current_fee_tier': current_fee_tier,
                'avg_daily_volume': avg_volume,
                'volume_volatility': volume_volatility,
                'current_annual_fees': avg_volume * current_fee_tier * 365
            }
            
            suggested_changes = {
                'recommended_fee_tier': best_tier,
                'tier_change_reason': self._get_fee_tier_reason(current_fee_tier, best_tier, avg_volume)
            }
            
            fee_improvement = best_expected_fees - current_metrics['current_annual_fees']
            
            expected_improvement = {
                'annual_fee_increase': fee_improvement,
                'fee_improvement_percent': (fee_improvement / current_metrics['current_annual_fees'] * 100) if current_metrics['current_annual_fees'] > 0 else 0,
                'liquidity_competition_impact': self._estimate_competition_impact(best_tier)
            }
            
            suggestion = OptimizationSuggestion(
                id=str(uuid.uuid4()),
                position_id=position_data['id'],
                optimization_type=OptimizationType.FEE_TIER_ANALYSIS,
                title=f"Fee Tier Optimization for {position_data['trade_name']}",
                description=f"Optimize fee tier based on volume analysis. Current: {current_fee_tier:.3%}, Suggested: {best_tier:.3%}",
                current_metrics=current_metrics,
                suggested_changes=suggested_changes,
                expected_improvement=expected_improvement,
                confidence_score=min(0.9, len(volumes) / 30),
                risk_level=RiskLevel.MODERATE,
                implementation_priority=self._calculate_priority(expected_improvement),
                created_at=datetime.now(),
                metadata={'volume_analysis_days': len(volumes)}
            )
            
            self._save_suggestion(suggestion)
            
            logger.info(f"Generated fee tier optimization suggestion for position {position_data['id']}")
            return suggestion
            
        except Exception as e:
            logger.error(f"Error analyzing fee tier optimization: {str(e)}")
            raise
    
    def analyze_capital_allocation(self, positions: List[Dict[str, Any]]) -> List[OptimizationSuggestion]:
        """
        Analyze capital allocation across positions.
        
        Args:
            positions (List[Dict[str, Any]]): List of all positions
            
        Returns:
            List[OptimizationSuggestion]: Capital allocation suggestions
        """
        try:
            if len(positions) < 2:
                return []
            
            suggestions = []
            
            # Calculate current allocation metrics
            total_capital = sum(p['initial_investment'] for p in positions)
            position_weights = {p['id']: p['initial_investment'] / total_capital for p in positions}
            
            # Calculate performance metrics for each position
            position_metrics = {}
            for position in positions:
                apr = position.get('apr', 0)
                sharpe = self._calculate_position_sharpe(position)
                risk_score = self._calculate_position_risk(position)
                
                position_metrics[position['id']] = {
                    'apr': apr,
                    'sharpe': sharpe,
                    'risk_score': risk_score,
                    'current_weight': position_weights[position['id']]
                }
            
            # Suggest optimal allocation using risk-adjusted returns
            optimal_weights = self._calculate_optimal_allocation(position_metrics)
            
            # Generate suggestions for significant reallocation opportunities
            for position_id, current_weight in position_weights.items():
                optimal_weight = optimal_weights.get(position_id, current_weight)
                weight_change = optimal_weight - current_weight
                
                if abs(weight_change) > 0.05:  # 5% threshold
                    position = next(p for p in positions if p['id'] == position_id)
                    
                    current_metrics = {
                        'current_allocation': current_weight,
                        'current_capital': position['initial_investment'],
                        'position_apr': position_metrics[position_id]['apr'],
                        'position_sharpe': position_metrics[position_id]['sharpe']
                    }
                    
                    suggested_capital = optimal_weight * total_capital
                    capital_change = suggested_capital - position['initial_investment']
                    
                    suggested_changes = {
                        'optimal_allocation': optimal_weight,
                        'suggested_capital': suggested_capital,
                        'capital_change': capital_change,
                        'reallocation_direction': 'increase' if capital_change > 0 else 'decrease'
                    }
                    
                    expected_improvement = {
                        'portfolio_sharpe_improvement': self._estimate_sharpe_improvement(position_metrics, optimal_weights),
                        'expected_return_improvement': abs(capital_change) * position_metrics[position_id]['apr'] / 100,
                        'risk_reduction': self._estimate_risk_reduction(position_metrics, optimal_weights)
                    }
                    
                    suggestion = OptimizationSuggestion(
                        id=str(uuid.uuid4()),
                        position_id=position_id,
                        optimization_type=OptimizationType.CAPITAL_ALLOCATION,
                        title=f"Capital Reallocation for {position['trade_name']}",
                        description=f"{'Increase' if capital_change > 0 else 'Decrease'} allocation by {abs(weight_change):.1%}",
                        current_metrics=current_metrics,
                        suggested_changes=suggested_changes,
                        expected_improvement=expected_improvement,
                        confidence_score=0.8,
                        risk_level=RiskLevel.MODERATE,
                        implementation_priority=self._calculate_priority(expected_improvement),
                        created_at=datetime.now(),
                        metadata={'total_portfolio_capital': total_capital}
                    )
                    
                    suggestions.append(suggestion)
                    self._save_suggestion(suggestion)
            
            logger.info(f"Generated {len(suggestions)} capital allocation suggestions")
            return suggestions
            
        except Exception as e:
            logger.error(f"Error analyzing capital allocation: {str(e)}")
            raise
    
    def analyze_rebalancing_opportunities(self, position_data: Dict[str, Any],
                                        current_price: float) -> Optional[OptimizationSuggestion]:
        """
        Analyze rebalancing opportunities for a position.
        
        Args:
            position_data (Dict[str, Any]): Position data
            current_price (float): Current market price
            
        Returns:
            Optional[OptimizationSuggestion]: Rebalancing suggestion if needed
        """
        try:
            range_min = position_data['price_range_min']
            range_max = position_data['price_range_max']
            range_center = (range_min + range_max) / 2
            
            # Calculate price deviation from center
            price_deviation = abs(current_price - range_center) / range_center
            
            # Check if rebalancing is needed
            rebalance_threshold = 0.15  # 15% deviation threshold
            
            if price_deviation < rebalance_threshold:
                return None
            
            # Calculate optimal new range centered on current price
            range_width = range_max - range_min
            new_range_min = current_price - range_width / 2
            new_range_max = current_price + range_width / 2
            
            # Estimate costs and benefits
            rebalance_cost = position_data['initial_investment'] * 0.001  # 0.1% estimated cost
            expected_fee_increase = self._estimate_rebalance_fee_benefit(position_data, current_price)
            
            current_metrics = {
                'current_range_min': range_min,
                'current_range_max': range_max,
                'current_price': current_price,
                'price_deviation': price_deviation,
                'is_in_range': range_min <= current_price <= range_max
            }
            
            suggested_changes = {
                'new_range_min': new_range_min,
                'new_range_max': new_range_max,
                'rebalance_cost_estimate': rebalance_cost,
                'optimal_timing': 'immediate' if price_deviation > 0.25 else 'within_week'
            }
            
            expected_improvement = {
                'fee_earning_improvement': expected_fee_increase,
                'range_utilization_improvement': 0.3,  # Estimated improvement
                'net_benefit': expected_fee_increase - rebalance_cost,
                'payback_period_days': rebalance_cost / (expected_fee_increase / 365) if expected_fee_increase > 0 else float('inf')
            }
            
            suggestion = OptimizationSuggestion(
                id=str(uuid.uuid4()),
                position_id=position_data['id'],
                optimization_type=OptimizationType.REBALANCING,
                title=f"Rebalancing Opportunity for {position_data['trade_name']}",
                description=f"Price has moved {price_deviation:.1%} from range center. Rebalancing recommended.",
                current_metrics=current_metrics,
                suggested_changes=suggested_changes,
                expected_improvement=expected_improvement,
                confidence_score=0.85,
                risk_level=RiskLevel.MODERATE,
                implementation_priority=self._calculate_priority(expected_improvement),
                created_at=datetime.now(),
                metadata={'deviation_threshold': rebalance_threshold}
            )
            
            self._save_suggestion(suggestion)
            
            logger.info(f"Generated rebalancing suggestion for position {position_data['id']}")
            return suggestion
            
        except Exception as e:
            logger.error(f"Error analyzing rebalancing opportunities: {str(e)}")
            raise
    
    def calculate_portfolio_metrics(self, positions: List[Dict[str, Any]]) -> PortfolioMetrics:
        """
        Calculate comprehensive portfolio metrics.
        
        Args:
            positions (List[Dict[str, Any]]): List of all positions
            
        Returns:
            PortfolioMetrics: Portfolio performance metrics
        """
        try:
            if not positions:
                return PortfolioMetrics(0, 0, 0, 0, 0, 0, 0, {})
            
            # Calculate basic totals
            total_value = sum(p.get('current_value', p['initial_investment']) for p in positions)
            total_fees = sum(p.get('fees_collected', 0) for p in positions)
            total_il = sum(p.get('impermanent_loss', 0) for p in positions)
            
            # Calculate returns for each position
            returns = []
            for position in positions:
                initial = position['initial_investment']
                current = position.get('current_value', initial)
                fees = position.get('fees_collected', 0)
                total_return = (current + fees - initial) / initial if initial > 0 else 0
                returns.append(total_return)
            
            # Calculate Sharpe ratio
            if len(returns) > 1:
                avg_return = np.mean(returns)
                return_std = np.std(returns)
                sharpe_ratio = avg_return / return_std if return_std > 0 else 0
            else:
                sharpe_ratio = 0
            
            # Calculate maximum drawdown
            cumulative_returns = np.cumprod(1 + np.array(returns))
            running_max = np.maximum.accumulate(cumulative_returns)
            drawdowns = (cumulative_returns - running_max) / running_max
            max_drawdown = np.min(drawdowns) if len(drawdowns) > 0 else 0
            
            # Calculate VaR (95% confidence)
            var_95 = np.percentile(returns, 5) if len(returns) > 0 else 0
            
            # Calculate diversification ratio
            diversification_ratio = self._calculate_diversification_ratio(positions)
            
            # Calculate correlation matrix
            correlation_matrix = self._calculate_correlation_matrix(positions)
            
            metrics = PortfolioMetrics(
                total_value=total_value,
                total_fees=total_fees,
                total_il=total_il,
                sharpe_ratio=sharpe_ratio,
                max_drawdown=max_drawdown,
                var_95=var_95,
                diversification_ratio=diversification_ratio,
                correlation_matrix=correlation_matrix
            )
            
            # Save portfolio snapshot
            self._save_portfolio_snapshot(metrics)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating portfolio metrics: {str(e)}")
            raise
    
    def get_optimization_suggestions(self, position_id: Optional[str] = None,
                                   optimization_type: Optional[str] = None,
                                   status: str = 'pending') -> List[Dict[str, Any]]:
        """
        Get optimization suggestions with optional filtering.
        
        Args:
            position_id (Optional[str]): Filter by position ID
            optimization_type (Optional[str]): Filter by optimization type
            status (str): Filter by status
            
        Returns:
            List[Dict[str, Any]]: List of optimization suggestions
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM optimization_suggestions WHERE status = ?'
                params = [status]
                
                if position_id:
                    query += ' AND position_id = ?'
                    params.append(position_id)
                
                if optimization_type:
                    query += ' AND optimization_type = ?'
                    params.append(optimization_type)
                
                query += ' ORDER BY implementation_priority DESC, created_at DESC'
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                suggestions = []
                for row in rows:
                    suggestion_dict = dict(row)
                    # Parse JSON fields
                    for field in ['current_metrics', 'suggested_changes', 'expected_improvement', 'metadata']:
                        if suggestion_dict[field]:
                            suggestion_dict[field] = json.loads(suggestion_dict[field])
                    suggestions.append(suggestion_dict)
                
                return suggestions
                
        except Exception as e:
            logger.error(f"Error retrieving optimization suggestions: {str(e)}")
            raise
    
    def _calculate_range_utilization(self, prices: List[float], range_min: float, range_max: float) -> float:
        """Calculate how much of the price range is utilized."""
        if not prices:
            return 0.0
        
        in_range_count = sum(1 for p in prices if range_min <= p <= range_max)
        return in_range_count / len(prices)
    
    def _determine_risk_level(self, volatility: float) -> RiskLevel:
        """Determine risk level based on volatility."""
        if volatility < 0.3:
            return RiskLevel.CONSERVATIVE
        elif volatility < 0.6:
            return RiskLevel.MODERATE
        else:
            return RiskLevel.AGGRESSIVE
    
    def _calculate_il_risk_change(self, current_metrics: Dict[str, Any], 
                                 suggested_changes: Dict[str, Any]) -> float:
        """Calculate change in impermanent loss risk."""
        # Simplified IL risk calculation
        current_width = current_metrics['range_width']
        suggested_width = suggested_changes['new_range_width']
        
        # Wider ranges generally have lower IL risk
        return (current_width - suggested_width) / current_width * 0.1
    
    def _calculate_priority(self, expected_improvement: Dict[str, Any]) -> int:
        """Calculate implementation priority (1-10, 10 being highest)."""
        # Simple priority calculation based on expected improvements
        score = 0
        
        if 'annual_fee_increase' in expected_improvement:
            score += min(5, expected_improvement['annual_fee_increase'] / 1000)
        
        if 'net_benefit' in expected_improvement:
            score += min(3, expected_improvement['net_benefit'] / 500)
        
        if 'fee_improvement_percent' in expected_improvement:
            score += min(2, expected_improvement['fee_improvement_percent'] / 10)
        
        return max(1, min(10, int(score)))
    
    def _get_fee_tier_reason(self, current_tier: float, suggested_tier: float, volume: float) -> str:
        """Get reason for fee tier recommendation."""
        if suggested_tier > current_tier:
            return f"Higher volume ({volume:.0f}) supports higher fee tier for better returns"
        elif suggested_tier < current_tier:
            return f"Lower volume ({volume:.0f}) suggests lower fee tier for better competitiveness"
        else:
            return "Current fee tier is optimal for observed volume"
    
    def _estimate_competition_impact(self, fee_tier: float) -> str:
        """Estimate impact on liquidity competition."""
        if fee_tier <= 0.0005:
            return "High competition expected in low fee tier"
        elif fee_tier <= 0.003:
            return "Moderate competition in standard fee tier"
        else:
            return "Lower competition in high fee tier"
    
    def _calculate_position_sharpe(self, position: Dict[str, Any]) -> float:
        """Calculate Sharpe ratio for a position."""
        apr = position.get('apr', 0)
        # Simplified Sharpe calculation (would need more data for accurate calculation)
        return apr / 20 if apr > 0 else 0  # Assuming 20% volatility
    
    def _calculate_position_risk(self, position: Dict[str, Any]) -> float:
        """Calculate risk score for a position."""
        # Simplified risk calculation based on range width and IL
        range_width = position['price_range_max'] - position['price_range_min']
        current_price = position.get('current_price', (position['price_range_max'] + position['price_range_min']) / 2)
        
        if current_price > 0:
            relative_width = range_width / current_price
            return min(1.0, relative_width * 2)  # Normalize to 0-1
        return 0.5
    
    def _calculate_optimal_allocation(self, position_metrics: Dict[str, Dict[str, Any]]) -> Dict[str, float]:
        """Calculate optimal capital allocation using risk-adjusted returns."""
        # Simplified mean-variance optimization
        total_score = sum(metrics['sharpe'] for metrics in position_metrics.values())
        
        if total_score <= 0:
            # Equal allocation if no positive Sharpe ratios
            equal_weight = 1.0 / len(position_metrics)
            return {pos_id: equal_weight for pos_id in position_metrics.keys()}
        
        # Weight by Sharpe ratio
        optimal_weights = {}
        for pos_id, metrics in position_metrics.items():
            optimal_weights[pos_id] = max(0.05, metrics['sharpe'] / total_score)  # Minimum 5% allocation
        
        # Normalize to sum to 1
        total_weight = sum(optimal_weights.values())
        return {pos_id: weight / total_weight for pos_id, weight in optimal_weights.items()}
    
    def _estimate_sharpe_improvement(self, position_metrics: Dict[str, Dict[str, Any]],
                                   optimal_weights: Dict[str, float]) -> float:
        """Estimate portfolio Sharpe ratio improvement."""
        # Simplified calculation
        current_sharpe = sum(metrics['sharpe'] * metrics['current_weight'] 
                           for metrics in position_metrics.values())
        optimal_sharpe = sum(position_metrics[pos_id]['sharpe'] * weight 
                           for pos_id, weight in optimal_weights.items())
        
        return optimal_sharpe - current_sharpe
    
    def _estimate_risk_reduction(self, position_metrics: Dict[str, Dict[str, Any]],
                               optimal_weights: Dict[str, float]) -> float:
        """Estimate portfolio risk reduction."""
        # Simplified risk reduction estimate
        current_risk = sum(metrics['risk_score'] * metrics['current_weight']
                          for metrics in position_metrics.values())
        optimal_risk = sum(position_metrics[pos_id]['risk_score'] * weight
                          for pos_id, weight in optimal_weights.items())
        
        return max(0, current_risk - optimal_risk)
    
    def _estimate_rebalance_fee_benefit(self, position_data: Dict[str, Any], current_price: float) -> float:
        """Estimate fee benefit from rebalancing."""
        # Simplified calculation - would need more sophisticated modeling in practice
        daily_volume = position_data.get('daily_volume', 10000)  # Default estimate
        fee_tier = position_data.get('fee_tier', 0.003)
        
        # Estimate increased fee collection from better range positioning
        return daily_volume * fee_tier * 0.2 * 365  # 20% improvement estimate
    
    def _calculate_diversification_ratio(self, positions: List[Dict[str, Any]]) -> float:
        """Calculate portfolio diversification ratio."""
        if len(positions) <= 1:
            return 1.0
        
        # Simplified diversification calculation
        # In practice, this would use correlation matrix and volatilities
        unique_pairs = set(p['pair_symbol'] for p in positions)
        unique_protocols = set(p.get('protocol', 'Unknown') for p in positions)
        
        pair_diversification = len(unique_pairs) / len(positions)
        protocol_diversification = len(unique_protocols) / len(positions)
        
        return (pair_diversification + protocol_diversification) / 2
    
    def _calculate_correlation_matrix(self, positions: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        """Calculate correlation matrix between positions."""
        # Simplified correlation matrix
        # In practice, this would use historical return data
        correlation_matrix = {}
        
        for i, pos1 in enumerate(positions):
            pos1_id = pos1['id']
            correlation_matrix[pos1_id] = {}
            
            for j, pos2 in enumerate(positions):
                pos2_id = pos2['id']
                
                if i == j:
                    correlation_matrix[pos1_id][pos2_id] = 1.0
                else:
                    # Estimate correlation based on pair similarity
                    if pos1['pair_symbol'] == pos2['pair_symbol']:
                        correlation_matrix[pos1_id][pos2_id] = 0.8
                    elif any(token in pos1['pair_symbol'] for token in pos2['pair_symbol'].split('/')):
                        correlation_matrix[pos1_id][pos2_id] = 0.4
                    else:
                        correlation_matrix[pos1_id][pos2_id] = 0.1
        
        return correlation_matrix
    
    def _save_suggestion(self, suggestion: OptimizationSuggestion):
        """Save optimization suggestion to database."""
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO optimization_suggestions (
                            id, position_id, optimization_type, title, description,
                            current_metrics, suggested_changes, expected_improvement,
                            confidence_score, risk_level, implementation_priority,
                            created_at, updated_at, metadata
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        suggestion.id, suggestion.position_id, suggestion.optimization_type.value,
                        suggestion.title, suggestion.description,
                        json.dumps(suggestion.current_metrics),
                        json.dumps(suggestion.suggested_changes),
                        json.dumps(suggestion.expected_improvement),
                        suggestion.confidence_score, suggestion.risk_level.value,
                        suggestion.implementation_priority,
                        int(suggestion.created_at.timestamp()),
                        int(suggestion.created_at.timestamp()),
                        json.dumps(suggestion.metadata) if suggestion.metadata else None
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving optimization suggestion: {str(e)}")
            raise
    
    def _save_portfolio_snapshot(self, metrics: PortfolioMetrics):
        """Save portfolio metrics snapshot."""
        try:
            snapshot_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO portfolio_snapshots (
                            id, snapshot_date, total_value, total_fees, total_il,
                            sharpe_ratio, max_drawdown, var_95, diversification_ratio,
                            metrics_data, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        snapshot_id, current_timestamp, metrics.total_value,
                        metrics.total_fees, metrics.total_il, metrics.sharpe_ratio,
                        metrics.max_drawdown, metrics.var_95, metrics.diversification_ratio,
                        json.dumps({
                            'correlation_matrix': metrics.correlation_matrix
                        }),
                        current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving portfolio snapshot: {str(e)}")
            # Don't raise - this is not critical
    
    def implement_suggestion(self, suggestion_id: str, implementation_notes: str = "") -> bool:
        """
        Mark a suggestion as implemented.
        
        Args:
            suggestion_id (str): The suggestion ID
            implementation_notes (str): Notes about implementation
            
        Returns:
            bool: True if successful
        """
        try:
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Update suggestion status
                    cursor.execute('''
                        UPDATE optimization_suggestions
                        SET status = 'implemented', updated_at = ?
                        WHERE id = ?
                    ''', (current_timestamp, suggestion_id))
                    
                    if cursor.rowcount > 0:
                        # Add to optimization history
                        history_id = str(uuid.uuid4())
                        cursor.execute('''
                            INSERT INTO optimization_history (
                                id, suggestion_id, position_id, action_taken,
                                implementation_date, notes, created_at
                            ) SELECT ?, ?, position_id, 'implemented', ?, ?, ?
                            FROM optimization_suggestions WHERE id = ?
                        ''', (
                            history_id, suggestion_id, current_timestamp,
                            implementation_notes, current_timestamp, suggestion_id
                        ))
                        
                        conn.commit()
                        logger.info(f"Marked suggestion as implemented: {suggestion_id}")
                        return True
                    else:
                        logger.warning(f"Suggestion not found: {suggestion_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error implementing suggestion {suggestion_id}: {str(e)}")
            raise
    
    def get_optimization_history(self, position_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get optimization implementation history.
        
        Args:
            position_id (Optional[str]): Filter by position ID
            
        Returns:
            List[Dict[str, Any]]: List of optimization history records
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = '''
                    SELECT oh.*, os.title, os.optimization_type
                    FROM optimization_history oh
                    JOIN optimization_suggestions os ON oh.suggestion_id = os.id
                '''
                params = []
                
                if position_id:
                    query += ' WHERE oh.position_id = ?'
                    params.append(position_id)
                
                query += ' ORDER BY oh.implementation_date DESC'
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                history = []
                for row in rows:
                    history_dict = dict(row)
                    # Parse JSON fields if they exist
                    for field in ['before_metrics', 'after_metrics', 'actual_improvement']:
                        if history_dict.get(field):
                            history_dict[field] = json.loads(history_dict[field])
                    history.append(history_dict)
                
                return history
                
        except Exception as e:
            logger.error(f"Error retrieving optimization history: {str(e)}")
            raise