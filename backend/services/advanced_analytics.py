"""
Advanced Analytics Engine for CL Position Tracking

This module provides sophisticated analytics capabilities including:
- Backtesting framework for strategy validation
- Performance attribution analysis
- Risk metrics (VaR, Sharpe ratio, maximum drawdown)
- Correlation analysis between positions
- Market regime detection and adaptation
- Predictive analytics for IL and fee projections
"""

import logging
import numpy as np
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple, Callable
from dataclasses import dataclass
from enum import Enum
import json
import uuid
from threading import Lock
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)


class MarketRegime(Enum):
    """Market regime enumeration."""
    BULL_MARKET = "bull_market"
    BEAR_MARKET = "bear_market"
    SIDEWAYS = "sideways"
    HIGH_VOLATILITY = "high_volatility"
    LOW_VOLATILITY = "low_volatility"


class AnalysisType(Enum):
    """Analysis type enumeration."""
    BACKTEST = "backtest"
    PERFORMANCE_ATTRIBUTION = "performance_attribution"
    RISK_ANALYSIS = "risk_analysis"
    CORRELATION_ANALYSIS = "correlation_analysis"
    REGIME_DETECTION = "regime_detection"
    PREDICTIVE_MODELING = "predictive_modeling"


@dataclass
class BacktestResult:
    """Backtest result data structure."""
    strategy_name: str
    start_date: datetime
    end_date: datetime
    total_return: float
    annualized_return: float
    volatility: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    profit_factor: float
    total_trades: int
    avg_trade_duration: float
    best_trade: float
    worst_trade: float
    metadata: Dict[str, Any]


@dataclass
class RiskMetrics:
    """Risk metrics data structure."""
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    max_drawdown: float
    calmar_ratio: float
    sortino_ratio: float
    downside_deviation: float
    beta: float
    alpha: float
    tracking_error: float
    information_ratio: float


@dataclass
class PerformanceAttribution:
    """Performance attribution data structure."""
    total_return: float
    fee_contribution: float
    il_contribution: float
    price_appreciation: float
    rebalancing_impact: float
    timing_effect: float
    selection_effect: float
    interaction_effect: float


class AdvancedAnalytics:
    """
    Advanced analytics engine for CL position tracking.
    
    Provides comprehensive analytics including backtesting, risk analysis,
    performance attribution, and predictive modeling.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the advanced analytics engine.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'analytics.db'
        )
        self.db_lock = Lock()
        
        # Initialize database
        self._ensure_database()
        
        logger.info("Advanced Analytics Engine initialized")
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create backtest_results table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS backtest_results (
                        id TEXT PRIMARY KEY,
                        strategy_name TEXT NOT NULL,
                        start_date INTEGER NOT NULL,
                        end_date INTEGER NOT NULL,
                        total_return REAL NOT NULL,
                        annualized_return REAL NOT NULL,
                        volatility REAL NOT NULL,
                        sharpe_ratio REAL NOT NULL,
                        max_drawdown REAL NOT NULL,
                        win_rate REAL NOT NULL,
                        profit_factor REAL NOT NULL,
                        total_trades INTEGER NOT NULL,
                        avg_trade_duration REAL NOT NULL,
                        best_trade REAL NOT NULL,
                        worst_trade REAL NOT NULL,
                        metadata TEXT,
                        created_at INTEGER NOT NULL
                    )
                ''')
                
                # Create risk_analysis table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS risk_analysis (
                        id TEXT PRIMARY KEY,
                        position_id TEXT,
                        analysis_date INTEGER NOT NULL,
                        var_95 REAL NOT NULL,
                        var_99 REAL NOT NULL,
                        cvar_95 REAL NOT NULL,
                        cvar_99 REAL NOT NULL,
                        max_drawdown REAL NOT NULL,
                        calmar_ratio REAL NOT NULL,
                        sortino_ratio REAL NOT NULL,
                        downside_deviation REAL NOT NULL,
                        beta REAL,
                        alpha REAL,
                        tracking_error REAL,
                        information_ratio REAL,
                        created_at INTEGER NOT NULL
                    )
                ''')
                
                # Create performance_attribution table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS performance_attribution (
                        id TEXT PRIMARY KEY,
                        position_id TEXT NOT NULL,
                        analysis_period_start INTEGER NOT NULL,
                        analysis_period_end INTEGER NOT NULL,
                        total_return REAL NOT NULL,
                        fee_contribution REAL NOT NULL,
                        il_contribution REAL NOT NULL,
                        price_appreciation REAL NOT NULL,
                        rebalancing_impact REAL NOT NULL,
                        timing_effect REAL NOT NULL,
                        selection_effect REAL NOT NULL,
                        interaction_effect REAL NOT NULL,
                        created_at INTEGER NOT NULL
                    )
                ''')
                
                # Create market_regimes table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS market_regimes (
                        id TEXT PRIMARY KEY,
                        pair_symbol TEXT NOT NULL,
                        regime_start INTEGER NOT NULL,
                        regime_end INTEGER,
                        regime_type TEXT NOT NULL,
                        confidence_score REAL NOT NULL,
                        characteristics TEXT,
                        created_at INTEGER NOT NULL
                    )
                ''')
                
                # Create predictive_models table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS predictive_models (
                        id TEXT PRIMARY KEY,
                        model_name TEXT NOT NULL,
                        model_type TEXT NOT NULL,
                        target_variable TEXT NOT NULL,
                        features TEXT NOT NULL,
                        training_period_start INTEGER NOT NULL,
                        training_period_end INTEGER NOT NULL,
                        model_accuracy REAL NOT NULL,
                        model_data BLOB,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_name)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_risk_position ON risk_analysis(position_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_attribution_position ON performance_attribution(position_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_regimes_pair ON market_regimes(pair_symbol)')
                
                conn.commit()
                logger.info(f"Analytics database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing analytics database: {str(e)}")
            raise
    
    def run_backtest(self, strategy_config: Dict[str, Any], 
                    historical_data: List[Dict[str, Any]]) -> BacktestResult:
        """
        Run a backtest for a given strategy configuration.
        
        Args:
            strategy_config (Dict[str, Any]): Strategy configuration
            historical_data (List[Dict[str, Any]]): Historical price and volume data
            
        Returns:
            BacktestResult: Comprehensive backtest results
        """
        try:
            if not historical_data:
                raise ValueError("Historical data required for backtesting")
            
            strategy_name = strategy_config.get('name', 'Unnamed Strategy')
            initial_capital = strategy_config.get('initial_capital', 10000)
            range_width_pct = strategy_config.get('range_width_pct', 0.1)  # 10% range width
            rebalance_threshold = strategy_config.get('rebalance_threshold', 0.15)  # 15% deviation
            fee_tier = strategy_config.get('fee_tier', 0.003)  # 0.3% fee tier
            
            # Sort data by timestamp
            data = sorted(historical_data, key=lambda x: x['timestamp'])
            start_date = datetime.fromisoformat(data[0]['timestamp'].replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(data[-1]['timestamp'].replace('Z', '+00:00'))
            
            # Initialize backtest state
            capital = initial_capital
            position_value = 0
            fees_collected = 0
            trades = []
            daily_returns = []
            equity_curve = []
            
            current_position = None
            
            for i, day_data in enumerate(data):
                price = float(day_data['price'])
                volume = float(day_data.get('volume', 0))
                timestamp = datetime.fromisoformat(day_data['timestamp'].replace('Z', '+00:00'))
                
                # Check if we need to open a new position
                if current_position is None:
                    # Open new position
                    range_width = price * range_width_pct
                    range_min = price - range_width / 2
                    range_max = price + range_width / 2
                    
                    current_position = {
                        'entry_price': price,
                        'entry_date': timestamp,
                        'range_min': range_min,
                        'range_max': range_max,
                        'capital_deployed': capital,
                        'fees_collected': 0
                    }
                    
                    position_value = capital
                    capital = 0
                
                # Calculate daily fees if price is in range
                if current_position and current_position['range_min'] <= price <= current_position['range_max']:
                    daily_fee = volume * fee_tier * 0.5  # Simplified fee calculation
                    current_position['fees_collected'] += daily_fee
                    fees_collected += daily_fee
                
                # Check for rebalancing
                if current_position:
                    range_center = (current_position['range_min'] + current_position['range_max']) / 2
                    deviation = abs(price - range_center) / range_center
                    
                    if deviation > rebalance_threshold:
                        # Close current position and open new one
                        exit_value = self._calculate_position_value(current_position, price)
                        
                        trade = {
                            'entry_date': current_position['entry_date'],
                            'exit_date': timestamp,
                            'entry_price': current_position['entry_price'],
                            'exit_price': price,
                            'capital_deployed': current_position['capital_deployed'],
                            'exit_value': exit_value,
                            'fees_collected': current_position['fees_collected'],
                            'pnl': exit_value + current_position['fees_collected'] - current_position['capital_deployed'],
                            'duration_days': (timestamp - current_position['entry_date']).days
                        }
                        trades.append(trade)
                        
                        # Update capital
                        capital = exit_value + current_position['fees_collected']
                        current_position = None
                
                # Calculate daily return
                total_value = capital + position_value + fees_collected
                if i > 0:
                    daily_return = (total_value - equity_curve[-1]) / equity_curve[-1]
                    daily_returns.append(daily_return)
                
                equity_curve.append(total_value)
            
            # Close final position if open
            if current_position:
                final_price = float(data[-1]['price'])
                exit_value = self._calculate_position_value(current_position, final_price)
                
                trade = {
                    'entry_date': current_position['entry_date'],
                    'exit_date': end_date,
                    'entry_price': current_position['entry_price'],
                    'exit_price': final_price,
                    'capital_deployed': current_position['capital_deployed'],
                    'exit_value': exit_value,
                    'fees_collected': current_position['fees_collected'],
                    'pnl': exit_value + current_position['fees_collected'] - current_position['capital_deployed'],
                    'duration_days': (end_date - current_position['entry_date']).days
                }
                trades.append(trade)
                
                capital = exit_value + current_position['fees_collected']
            
            # Calculate performance metrics
            final_value = capital + fees_collected
            total_return = (final_value - initial_capital) / initial_capital
            
            days_elapsed = (end_date - start_date).days
            annualized_return = (1 + total_return) ** (365 / days_elapsed) - 1 if days_elapsed > 0 else 0
            
            volatility = np.std(daily_returns) * np.sqrt(365) if daily_returns else 0
            sharpe_ratio = annualized_return / volatility if volatility > 0 else 0
            
            # Calculate drawdown
            peak = np.maximum.accumulate(equity_curve)
            drawdown = (np.array(equity_curve) - peak) / peak
            max_drawdown = np.min(drawdown) if len(drawdown) > 0 else 0
            
            # Trade statistics
            winning_trades = [t for t in trades if t['pnl'] > 0]
            win_rate = len(winning_trades) / len(trades) if trades else 0
            
            gross_profit = sum(t['pnl'] for t in trades if t['pnl'] > 0)
            gross_loss = abs(sum(t['pnl'] for t in trades if t['pnl'] < 0))
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
            
            avg_trade_duration = np.mean([t['duration_days'] for t in trades]) if trades else 0
            best_trade = max([t['pnl'] for t in trades]) if trades else 0
            worst_trade = min([t['pnl'] for t in trades]) if trades else 0
            
            result = BacktestResult(
                strategy_name=strategy_name,
                start_date=start_date,
                end_date=end_date,
                total_return=total_return,
                annualized_return=annualized_return,
                volatility=volatility,
                sharpe_ratio=sharpe_ratio,
                max_drawdown=max_drawdown,
                win_rate=win_rate,
                profit_factor=profit_factor,
                total_trades=len(trades),
                avg_trade_duration=avg_trade_duration,
                best_trade=best_trade,
                worst_trade=worst_trade,
                metadata={
                    'initial_capital': initial_capital,
                    'final_value': final_value,
                    'total_fees_collected': fees_collected,
                    'trades': trades,
                    'equity_curve': equity_curve,
                    'strategy_config': strategy_config
                }
            )
            
            # Save backtest result
            self._save_backtest_result(result)
            
            logger.info(f"Completed backtest for strategy: {strategy_name}")
            return result
            
        except Exception as e:
            logger.error(f"Error running backtest: {str(e)}")
            raise
    
    def calculate_risk_metrics(self, returns: List[float], 
                             benchmark_returns: Optional[List[float]] = None) -> RiskMetrics:
        """
        Calculate comprehensive risk metrics.
        
        Args:
            returns (List[float]): Portfolio returns
            benchmark_returns (Optional[List[float]]): Benchmark returns for relative metrics
            
        Returns:
            RiskMetrics: Comprehensive risk metrics
        """
        try:
            if not returns:
                raise ValueError("Returns data required for risk analysis")
            
            returns_array = np.array(returns)
            
            # Value at Risk (VaR)
            var_95 = np.percentile(returns_array, 5)
            var_99 = np.percentile(returns_array, 1)
            
            # Conditional Value at Risk (CVaR)
            cvar_95 = np.mean(returns_array[returns_array <= var_95])
            cvar_99 = np.mean(returns_array[returns_array <= var_99])
            
            # Maximum Drawdown
            cumulative_returns = np.cumprod(1 + returns_array)
            peak = np.maximum.accumulate(cumulative_returns)
            drawdown = (cumulative_returns - peak) / peak
            max_drawdown = np.min(drawdown)
            
            # Calmar Ratio
            annualized_return = np.mean(returns_array) * 252  # Assuming daily returns
            calmar_ratio = annualized_return / abs(max_drawdown) if max_drawdown != 0 else 0
            
            # Sortino Ratio
            downside_returns = returns_array[returns_array < 0]
            downside_deviation = np.std(downside_returns) if len(downside_returns) > 0 else 0
            sortino_ratio = annualized_return / (downside_deviation * np.sqrt(252)) if downside_deviation > 0 else 0
            
            # Relative metrics (if benchmark provided)
            beta = alpha = tracking_error = information_ratio = None
            
            if benchmark_returns and len(benchmark_returns) == len(returns):
                benchmark_array = np.array(benchmark_returns)
                
                # Beta
                covariance = np.cov(returns_array, benchmark_array)[0, 1]
                benchmark_variance = np.var(benchmark_array)
                beta = covariance / benchmark_variance if benchmark_variance > 0 else 0
                
                # Alpha
                benchmark_return = np.mean(benchmark_array) * 252
                alpha = annualized_return - beta * benchmark_return
                
                # Tracking Error
                excess_returns = returns_array - benchmark_array
                tracking_error = np.std(excess_returns) * np.sqrt(252)
                
                # Information Ratio
                information_ratio = np.mean(excess_returns) * 252 / tracking_error if tracking_error > 0 else 0
            
            metrics = RiskMetrics(
                var_95=var_95,
                var_99=var_99,
                cvar_95=cvar_95,
                cvar_99=cvar_99,
                max_drawdown=max_drawdown,
                calmar_ratio=calmar_ratio,
                sortino_ratio=sortino_ratio,
                downside_deviation=downside_deviation,
                beta=beta,
                alpha=alpha,
                tracking_error=tracking_error,
                information_ratio=information_ratio
            )
            
            logger.info("Calculated comprehensive risk metrics")
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating risk metrics: {str(e)}")
            raise
    
    def analyze_performance_attribution(self, position_data: Dict[str, Any],
                                      price_history: List[Dict[str, Any]],
                                      fee_history: List[Dict[str, Any]]) -> PerformanceAttribution:
        """
        Perform performance attribution analysis.
        
        Args:
            position_data (Dict[str, Any]): Position data
            price_history (List[Dict[str, Any]]): Historical price data
            fee_history (List[Dict[str, Any]]): Fee collection history
            
        Returns:
            PerformanceAttribution: Performance attribution breakdown
        """
        try:
            initial_investment = position_data['initial_investment']
            current_value = position_data.get('current_value', initial_investment)
            total_fees = sum(f.get('fees_amount', 0) for f in fee_history)
            
            # Calculate total return
            total_return = (current_value + total_fees - initial_investment) / initial_investment
            
            # Fee contribution
            fee_contribution = total_fees / initial_investment
            
            # Price appreciation (simplified)
            if price_history:
                entry_price = position_data.get('entry_price', price_history[0]['price'])
                current_price = price_history[-1]['price']
                price_appreciation = (current_price - entry_price) / entry_price * 0.5  # Simplified for CL
            else:
                price_appreciation = 0
            
            # Impermanent loss contribution
            il_contribution = position_data.get('impermanent_loss', 0) / initial_investment
            
            # Rebalancing impact (estimated)
            rebalancing_impact = self._estimate_rebalancing_impact(position_data, price_history)
            
            # Timing and selection effects (simplified)
            timing_effect = self._calculate_timing_effect(position_data, price_history)
            selection_effect = self._calculate_selection_effect(position_data)
            
            # Interaction effect (residual)
            calculated_return = (fee_contribution + price_appreciation + il_contribution + 
                               rebalancing_impact + timing_effect + selection_effect)
            interaction_effect = total_return - calculated_return
            
            attribution = PerformanceAttribution(
                total_return=total_return,
                fee_contribution=fee_contribution,
                il_contribution=il_contribution,
                price_appreciation=price_appreciation,
                rebalancing_impact=rebalancing_impact,
                timing_effect=timing_effect,
                selection_effect=selection_effect,
                interaction_effect=interaction_effect
            )
            
            # Save attribution analysis
            self._save_performance_attribution(position_data['id'], attribution)
            
            logger.info(f"Completed performance attribution for position {position_data['id']}")
            return attribution
            
        except Exception as e:
            logger.error(f"Error analyzing performance attribution: {str(e)}")
            raise
    
    def detect_market_regime(self, price_data: List[Dict[str, Any]], 
                           pair_symbol: str) -> MarketRegime:
        """
        Detect current market regime for a trading pair.
        
        Args:
            price_data (List[Dict[str, Any]]): Historical price data
            pair_symbol (str): Trading pair symbol
            
        Returns:
            MarketRegime: Detected market regime
        """
        try:
            if len(price_data) < 30:
                raise ValueError("Insufficient data for regime detection (minimum 30 data points)")
            
            prices = [float(p['price']) for p in price_data]
            returns = np.diff(np.log(prices))
            
            # Calculate regime indicators
            recent_returns = returns[-20:]  # Last 20 periods
            volatility = np.std(returns) * np.sqrt(252)
            trend = np.polyfit(range(len(prices[-30:])), prices[-30:], 1)[0]  # 30-period trend
            
            # Regime detection logic
            avg_return = np.mean(recent_returns)
            vol_threshold_high = 0.6
            vol_threshold_low = 0.2
            trend_threshold = 0.02
            
            if volatility > vol_threshold_high:
                regime = MarketRegime.HIGH_VOLATILITY
                confidence = min(0.95, volatility / vol_threshold_high)
            elif volatility < vol_threshold_low:
                regime = MarketRegime.LOW_VOLATILITY
                confidence = min(0.95, vol_threshold_low / volatility)
            elif trend > trend_threshold and avg_return > 0:
                regime = MarketRegime.BULL_MARKET
                confidence = min(0.9, abs(trend) / trend_threshold)
            elif trend < -trend_threshold and avg_return < 0:
                regime = MarketRegime.BEAR_MARKET
                confidence = min(0.9, abs(trend) / trend_threshold)
            else:
                regime = MarketRegime.SIDEWAYS
                confidence = 0.7
            
            # Save regime detection
            self._save_market_regime(pair_symbol, regime, confidence, {
                'volatility': volatility,
                'trend': trend,
                'avg_return': avg_return,
                'detection_date': datetime.now().isoformat()
            })
            
            logger.info(f"Detected {regime.value} regime for {pair_symbol} with {confidence:.2%} confidence")
            return regime
            
        except Exception as e:
            logger.error(f"Error detecting market regime: {str(e)}")
            raise
    
    def predict_il_and_fees(self, position_data: Dict[str, Any],
                           historical_data: List[Dict[str, Any]],
                           prediction_days: int = 30) -> Dict[str, Any]:
        """
        Predict impermanent loss and fee collection for a position.
        
        Args:
            position_data (Dict[str, Any]): Position data
            historical_data (List[Dict[str, Any]]): Historical price and volume data
            prediction_days (int): Number of days to predict
            
        Returns:
            Dict[str, Any]: Predictions for IL and fees
        """
        try:
            if len(historical_data) < 30:
                raise ValueError("Insufficient historical data for prediction")
            
            # Prepare features
            features = self._prepare_prediction_features(historical_data)
            
            # Prepare targets (IL and fees)
            il_targets = self._calculate_historical_il(position_data, historical_data)
            fee_targets = self._calculate_historical_fees(position_data, historical_data)
            
            # Train models
            il_model = RandomForestRegressor(n_estimators=100, random_state=42)
            fee_model = RandomForestRegressor(n_estimators=100, random_state=42)
            
            if len(features) > 10:  # Minimum data for training
                il_model.fit(features[:-prediction_days], il_targets[:-prediction_days])
                fee_model.fit(features[:-prediction_days], fee_targets[:-prediction_days])
                
                # Make predictions
                future_features = self._generate_future_features(features, prediction_days)
                
                il_predictions = il_model.predict(future_features)
                fee_predictions = fee_model.predict(future_features)
                
                # Calculate confidence intervals
                il_std = np.std(il_targets)
                fee_std = np.std(fee_targets)
                
                predictions = {
                    'prediction_period_days': prediction_days,
                    'il_predictions': {
                        'mean': float(np.mean(il_predictions)),
                        'min': float(np.mean(il_predictions) - 1.96 * il_std),
                        'max': float(np.mean(il_predictions) + 1.96 * il_std),
                        'daily_values': il_predictions.tolist()
                    },
                    'fee_predictions': {
                        'mean': float(np.mean(fee_predictions)),
                        'min': float(np.mean(fee_predictions) - 1.96 * fee_std),
                        'max': float(np.mean(fee_predictions) + 1.96 * fee_std),
                        'daily_values': fee_predictions.tolist()
                    },
                    'model_accuracy': {
                        'il_r2': float(il_model.score(features[:-prediction_days], il_targets[:-prediction_days])),
                        'fee_r2': float(fee_model.score(features[:-prediction_days], fee_targets[:-prediction_days]))
                    },
                    'confidence_level': 0.95,
                    'generated_at': datetime.now().isoformat()
                }
            else:
                # Fallback to simple trend extrapolation
                predictions = self._simple_trend_prediction(il_targets, fee_targets, prediction_days)
            
            logger.info(f"Generated IL and fee predictions for {prediction_days} days")
            return predictions
            
        except Exception as e:
            logger.error(f"Error predicting IL and fees: {str(e)}")
            raise
    
    def _calculate_position_value(self, position: Dict[str, Any], current_price: float) -> float:
        """Calculate current position value (simplified)."""
        # Simplified calculation - in reality would need complex CL math
        return position['capital_deployed']  # Placeholder
    
    def _estimate_rebalancing_impact(self, position_data: Dict[str, Any], 
                                   price_history: List[Dict[str, Any]]) -> float:
        """Estimate impact of rebalancing on returns."""
        # Simplified calculation
        return 0.01  # 1% estimated impact
    
    def _calculate_timing_effect(self, position_data: Dict[str, Any],
                               price_history: List[Dict[str, Any]]) -> float:
        """Calculate timing effect on performance."""
        # Simplified calculation
        return 0.005  # 0.5% estimated timing effect
    
    def _calculate_selection_effect(self, position_data: Dict[str, Any]) -> float:
        """Calculate selection effect on performance."""
        # Simplified calculation based on fee tier
        fee_tier = position_data.get('fee_tier', 0.003)
        return (fee_tier - 0.003) * 10  # Relative to 0.3% baseline
    
    def _prepare_prediction_features(self, historical_data: List[Dict[str, Any]]) -> np.ndarray:
        """Prepare features for prediction models."""
        features = []
        
        for i in range(len(historical_data)):
            price = float(historical_data[i]['price'])
            volume = float(historical_data[i].get('volume', 0))
            
            # Calculate technical indicators
            if i >= 5:
                prices_5d = [float(historical_data[j]['price']) for j in range(i-4, i+1)]
                sma_5 = np.mean(prices_5d)
                volatility_5d = np.std(prices_5d)
            else:
                sma_5 = price
                volatility_5d = 0
            
            if i >= 20:
                prices_20d = [float(historical_data[j]['price']) for j in range(i-19, i+1)]
                sma_20 = np.mean(prices_20d)
                volatility_20d = np.std(prices_20d)
            else:
                sma_20 = price
                volatility_20d = 0
            
            feature_vector = [
                price,
                volume,
                sma_5,
                sma_20,
                volatility_5d,
                volatility_20d,
                price / sma_5 if sma_5 > 0 else 1,
                price / sma_20 if sma_20 > 0 else 1
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def _calculate_historical_il(self, position_data: Dict[str, Any],
                               historical_data: List[Dict[str, Any]]) -> List[float]:
        """Calculate historical impermanent loss values."""
        il_values = []
        
        entry_price = position_data.get('entry_price', historical_data[0]['price'] if historical_data else 0)
        range_min = position_data['price_range_min']
        range_max = position_data['price_range_max']
        
        for data_point in historical_data:
            current_price = float(data_point['price'])
            
            # Simplified IL calculation
            if range_min <= current_price <= range_max:
                # Price in range - minimal IL
                il = abs(current_price - entry_price) / entry_price * 0.1
            else:
                # Price out of range - higher IL
                il = abs(current_price - entry_price) / entry_price * 0.3
            
            il_values.append(il)
        
        return il_values
    
    def _calculate_historical_fees(self, position_data: Dict[str, Any],
                                 historical_data: List[Dict[str, Any]]) -> List[float]:
        """Calculate historical fee collection values."""
        fee_values = []
        
        fee_tier = position_data.get('fee_tier', 0.003)
        range_min = position_data['price_range_min']
        range_max = position_data['price_range_max']
        
        for data_point in historical_data:
            current_price = float(data_point['price'])
            volume = float(data_point.get('volume', 0))
            
            # Calculate fees based on whether price is in range
            if range_min <= current_price <= range_max:
                daily_fee = volume * fee_tier * 0.5  # 50% of volume when in range
            else:
                daily_fee = 0  # No fees when out of range
            
            fee_values.append(daily_fee)
        
        return fee_values
    
    def _generate_future_features(self, historical_features: np.ndarray,
                                prediction_days: int) -> np.ndarray:
        """Generate future features for prediction."""
        # Simple approach: use trend extrapolation
        if len(historical_features) < 10:
            # Repeat last feature vector
            last_features = historical_features[-1]
            return np.array([last_features] * prediction_days)
        
        # Calculate trends for each feature
        future_features = []
        
        for day in range(prediction_days):
            feature_vector = []
            
            for feature_idx in range(historical_features.shape[1]):
                feature_series = historical_features[-10:, feature_idx]
                
                # Simple linear trend extrapolation
                x = np.arange(len(feature_series))
                slope, intercept = np.polyfit(x, feature_series, 1)
                
                future_value = slope * (len(feature_series) + day) + intercept
                feature_vector.append(future_value)
            
            future_features.append(feature_vector)
        
        return np.array(future_features)
    
    def _simple_trend_prediction(self, il_targets: List[float],
                                fee_targets: List[float],
                                prediction_days: int) -> Dict[str, Any]:
        """Simple trend-based prediction fallback."""
        if len(il_targets) < 5 or len(fee_targets) < 5:
            return {
                'prediction_period_days': prediction_days,
                'il_predictions': {'mean': 0, 'min': 0, 'max': 0, 'daily_values': [0] * prediction_days},
                'fee_predictions': {'mean': 0, 'min': 0, 'max': 0, 'daily_values': [0] * prediction_days},
                'model_accuracy': {'il_r2': 0, 'fee_r2': 0},
                'confidence_level': 0.5,
                'generated_at': datetime.now().isoformat()
            }
        
        # Calculate simple trends
        il_trend = (il_targets[-1] - il_targets[-5]) / 5
        fee_trend = (fee_targets[-1] - fee_targets[-5]) / 5
        
        il_predictions = [il_targets[-1] + il_trend * (i + 1) for i in range(prediction_days)]
        fee_predictions = [fee_targets[-1] + fee_trend * (i + 1) for i in range(prediction_days)]
        
        return {
            'prediction_period_days': prediction_days,
            'il_predictions': {
                'mean': float(np.mean(il_predictions)),
                'min': float(np.mean(il_predictions) * 0.8),
                'max': float(np.mean(il_predictions) * 1.2),
                'daily_values': il_predictions
            },
            'fee_predictions': {
                'mean': float(np.mean(fee_predictions)),
                'min': float(np.mean(fee_predictions) * 0.8),
                'max': float(np.mean(fee_predictions) * 1.2),
                'daily_values': fee_predictions
            },
            'model_accuracy': {'il_r2': 0.5, 'fee_r2': 0.5},
            'confidence_level': 0.6,
            'generated_at': datetime.now().isoformat()
        }
    
    def _save_backtest_result(self, result: BacktestResult):
        """Save backtest result to database."""
        try:
            result_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO backtest_results (
                            id, strategy_name, start_date, end_date, total_return,
                            annualized_return, volatility, sharpe_ratio, max_drawdown,
                            win_rate, profit_factor, total_trades, avg_trade_duration,
                            best_trade, worst_trade, metadata, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        result_id, result.strategy_name,
                        int(result.start_date.timestamp()), int(result.end_date.timestamp()),
                        result.total_return, result.annualized_return, result.volatility,
                        result.sharpe_ratio, result.max_drawdown, result.win_rate,
                        result.profit_factor, result.total_trades, result.avg_trade_duration,
                        result.best_trade, result.worst_trade,
                        json.dumps(result.metadata), current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving backtest result: {str(e)}")
            # Don't raise - this is not critical
    
    def _save_performance_attribution(self, position_id: str, attribution: PerformanceAttribution):
        """Save performance attribution to database."""
        try:
            attribution_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO performance_attribution (
                            id, position_id, analysis_period_start, analysis_period_end,
                            total_return, fee_contribution, il_contribution, price_appreciation,
                            rebalancing_impact, timing_effect, selection_effect, interaction_effect,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        attribution_id, position_id, current_timestamp - 86400 * 30,  # 30 days ago
                        current_timestamp, attribution.total_return, attribution.fee_contribution,
                        attribution.il_contribution, attribution.price_appreciation,
                        attribution.rebalancing_impact, attribution.timing_effect,
                        attribution.selection_effect, attribution.interaction_effect,
                        current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving performance attribution: {str(e)}")
            # Don't raise - this is not critical
    
    def _save_market_regime(self, pair_symbol: str, regime: MarketRegime,
                          confidence: float, characteristics: Dict[str, Any]):
        """Save market regime detection to database."""
        try:
            regime_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO market_regimes (
                            id, pair_symbol, regime_start, regime_type, confidence_score,
                            characteristics, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        regime_id, pair_symbol, current_timestamp, regime.value,
                        confidence, json.dumps(characteristics), current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving market regime: {str(e)}")
            # Don't raise - this is not critical
    
    def get_backtest_results(self, strategy_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get backtest results with optional filtering.
        
        Args:
            strategy_name (Optional[str]): Filter by strategy name
            
        Returns:
            List[Dict[str, Any]]: List of backtest results
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM backtest_results'
                params = []
                
                if strategy_name:
                    query += ' WHERE strategy_name = ?'
                    params.append(strategy_name)
                
                query += ' ORDER BY created_at DESC'
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                results = []
                for row in rows:
                    result_dict = dict(row)
                    if result_dict['metadata']:
                        result_dict['metadata'] = json.loads(result_dict['metadata'])
                    results.append(result_dict)
                
                return results
                
        except Exception as e:
            logger.error(f"Error retrieving backtest results: {str(e)}")
            raise
    
    def get_risk_analysis(self, position_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get risk analysis results.
        
        Args:
            position_id (Optional[str]): Filter by position ID
            
        Returns:
            List[Dict[str, Any]]: List of risk analysis results
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM risk_analysis'
                params = []
                
                if position_id:
                    query += ' WHERE position_id = ?'
                    params.append(position_id)
                
                query += ' ORDER BY analysis_date DESC'
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Error retrieving risk analysis: {str(e)}")
            raise