"""
Macro Chart Generation Service

This service creates synchronized chart visualizations for AI analysis
including BTC price, BTC dominance, and Alt strength ratio charts.
"""

import logging
import base64
import io
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.figure import Figure
import pandas as pd
import numpy as np

try:
    from ..models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase
except ImportError:
    # Fallback for when running from root directory
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase

logger = logging.getLogger(__name__)


class MacroChartService:
    """
    Chart generation service for macro market sentiment analysis.
    
    This service creates synchronized visualizations of BTC price,
    BTC dominance, and Alt strength ratio for AI analysis.
    """
    
    def __init__(self, db: Optional[MacroSentimentDatabase] = None):
        """
        Initialize chart service.
        
        Args:
            db (Optional[MacroSentimentDatabase]): Database instance
        """
        self.db = db or get_macro_db()
        
        # Chart configuration
        self.chart_config = {
            'figure_size': (16, 12),
            'dpi': 100,
            'style': 'seaborn-v0_8-darkgrid',
            'colors': {
                'btc_price': '#F7931A',      # Bitcoin orange
                'dominance': '#2E86AB',      # Blue
                'alt_strength': '#A23B72',   # Purple
                'background': '#1E1E1E',     # Dark background
                'grid': '#404040',           # Grid color
                'text': '#FFFFFF'            # White text
            }
        }
    
    def generate_macro_charts(self, days: int = 90) -> Dict[str, Any]:
        """
        Generate complete set of macro charts for AI analysis.
        
        Args:
            days (int): Number of days of data to include
            
        Returns:
            Dict[str, Any]: Chart data and images
        """
        try:
            start_time = datetime.now()
            
            # Get market data
            end_timestamp = int(datetime.now(timezone.utc).timestamp())
            start_timestamp = end_timestamp - (days * 24 * 60 * 60)
            
            market_data = self.db.get_market_data_range(start_timestamp, end_timestamp)
            
            if not market_data:
                raise ValueError("No market data available for chart generation")
            
            # Convert to DataFrame for easier manipulation
            df = pd.DataFrame(market_data)
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
            df = df.sort_values('datetime')
            
            # Data validation and outlier filtering
            df = self._validate_and_clean_data(df)
            
            if len(df) == 0:
                raise ValueError("No valid market data after filtering outliers")
            
            logger.info(f"Using {len(df)} validated data points for chart generation")
            
            # Generate individual charts
            btc_chart = self._generate_btc_price_chart(df)
            dominance_chart = self._generate_dominance_chart(df)
            alt_strength_chart = self._generate_alt_strength_chart(df)
            combined_chart = self._generate_combined_chart(df)
            
            # Calculate data hash for caching
            data_hash = self._calculate_data_hash(market_data)
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            result = {
                'data_period_start': start_timestamp,
                'data_period_end': end_timestamp,
                'data_points': len(market_data),
                'btc_chart_image': btc_chart,
                'dominance_chart_image': dominance_chart,
                'alt_strength_chart_image': alt_strength_chart,
                'combined_chart_image': combined_chart,
                'chart_data_hash': data_hash,
                'processing_time_ms': int(processing_time),
                'chart_config': self.chart_config
            }
            
            logger.info(f"Generated macro charts in {processing_time:.1f}ms "
                       f"({len(market_data)} data points)")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating macro charts: {e}")
            raise
    
    def _generate_btc_price_chart(self, df: pd.DataFrame) -> str:
        """Generate BTC price chart."""
        try:
            plt.style.use(self.chart_config['style'])
            
            fig, ax = plt.subplots(figsize=(12, 6), facecolor=self.chart_config['colors']['background'])
            ax.set_facecolor(self.chart_config['colors']['background'])
            
            # Plot BTC price
            ax.plot(df['datetime'], df['btc_price'], 
                   color=self.chart_config['colors']['btc_price'], 
                   linewidth=2, label='BTC Price')
            
            # Formatting
            ax.set_title('Bitcoin Price (USD)', fontsize=16, color=self.chart_config['colors']['text'], pad=20)
            ax.set_xlabel('Date', fontsize=12, color=self.chart_config['colors']['text'])
            ax.set_ylabel('Price (USD)', fontsize=12, color=self.chart_config['colors']['text'])
            
            # Format y-axis as currency
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
            
            # Format x-axis dates
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, len(df) // 10)))
            
            # Style
            ax.tick_params(colors=self.chart_config['colors']['text'])
            ax.grid(True, alpha=0.3, color=self.chart_config['colors']['grid'])
            ax.legend(facecolor=self.chart_config['colors']['background'], 
                     edgecolor=self.chart_config['colors']['text'])
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=self.chart_config['dpi'], 
                       facecolor=self.chart_config['colors']['background'])
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            plt.close(fig)
            return image_base64
            
        except Exception as e:
            logger.error(f"Error generating BTC price chart: {e}")
            raise
    
    def _generate_dominance_chart(self, df: pd.DataFrame) -> str:
        """Generate BTC dominance chart."""
        try:
            plt.style.use(self.chart_config['style'])
            
            fig, ax = plt.subplots(figsize=(12, 6), facecolor=self.chart_config['colors']['background'])
            ax.set_facecolor(self.chart_config['colors']['background'])
            
            # Plot BTC dominance
            ax.plot(df['datetime'], df['btc_dominance'], 
                   color=self.chart_config['colors']['dominance'], 
                   linewidth=2, label='BTC Dominance')
            
            # Add horizontal reference lines
            ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='50% Line')
            
            # Formatting
            ax.set_title('Bitcoin Market Dominance (%)', fontsize=16, color=self.chart_config['colors']['text'], pad=20)
            ax.set_xlabel('Date', fontsize=12, color=self.chart_config['colors']['text'])
            ax.set_ylabel('Dominance (%)', fontsize=12, color=self.chart_config['colors']['text'])
            
            # Format y-axis as percentage with dynamic scaling
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:.1f}%'))
            # Use tight y-axis limits to show variation clearly
            dom_min, dom_max = df['btc_dominance'].min(), df['btc_dominance'].max()
            dom_range = dom_max - dom_min
            padding = max(0.5, dom_range * 0.05)  # Minimum 0.5% padding, max 5% of range
            ax.set_ylim(dom_min - padding, dom_max + padding)
            
            # Format x-axis dates
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, len(df) // 10)))
            
            # Style
            ax.tick_params(colors=self.chart_config['colors']['text'])
            ax.grid(True, alpha=0.3, color=self.chart_config['colors']['grid'])
            ax.legend(facecolor=self.chart_config['colors']['background'], 
                     edgecolor=self.chart_config['colors']['text'])
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=self.chart_config['dpi'], 
                       facecolor=self.chart_config['colors']['background'])
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            plt.close(fig)
            return image_base64
            
        except Exception as e:
            logger.error(f"Error generating dominance chart: {e}")
            raise
    
    def _generate_alt_strength_chart(self, df: pd.DataFrame) -> str:
        """Generate Alt strength ratio chart."""
        try:
            plt.style.use(self.chart_config['style'])
            
            fig, ax = plt.subplots(figsize=(12, 6), facecolor=self.chart_config['colors']['background'])
            ax.set_facecolor(self.chart_config['colors']['background'])
            
            # Plot Alt strength ratio
            ax.plot(df['datetime'], df['alt_strength_ratio'], 
                   color=self.chart_config['colors']['alt_strength'], 
                   linewidth=2, label='Alt Strength Ratio')
            
            # Formatting
            ax.set_title('Altcoin Strength Ratio (Alt Market Cap / BTC Price)', 
                        fontsize=16, color=self.chart_config['colors']['text'], pad=20)
            ax.set_xlabel('Date', fontsize=12, color=self.chart_config['colors']['text'])
            ax.set_ylabel('Ratio', fontsize=12, color=self.chart_config['colors']['text'])
            
            # Format y-axis with proper scaling for millions
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000000:.1f}M'))
            
            # Format x-axis dates
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, len(df) // 10)))
            
            # Style
            ax.tick_params(colors=self.chart_config['colors']['text'])
            ax.grid(True, alpha=0.3, color=self.chart_config['colors']['grid'])
            ax.legend(facecolor=self.chart_config['colors']['background'], 
                     edgecolor=self.chart_config['colors']['text'])
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=self.chart_config['dpi'], 
                       facecolor=self.chart_config['colors']['background'])
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            plt.close(fig)
            return image_base64
            
        except Exception as e:
            logger.error(f"Error generating alt strength chart: {e}")
            raise
    
    def _generate_combined_chart(self, df: pd.DataFrame) -> str:
        """Generate combined chart with all three metrics."""
        try:
            plt.style.use(self.chart_config['style'])
            
            fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(16, 12), 
                                               facecolor=self.chart_config['colors']['background'])
            
            # BTC Price (top)
            ax1.set_facecolor(self.chart_config['colors']['background'])
            ax1.plot(df['datetime'], df['btc_price'], 
                    color=self.chart_config['colors']['btc_price'], 
                    linewidth=2, label='BTC Price')
            ax1.set_title('Bitcoin Price (USD)', fontsize=14, color=self.chart_config['colors']['text'])
            ax1.set_ylabel('Price (USD)', fontsize=10, color=self.chart_config['colors']['text'])
            ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
            ax1.tick_params(colors=self.chart_config['colors']['text'])
            ax1.grid(True, alpha=0.3, color=self.chart_config['colors']['grid'])
            
            # BTC Dominance (middle)
            ax2.set_facecolor(self.chart_config['colors']['background'])
            ax2.plot(df['datetime'], df['btc_dominance'], 
                    color=self.chart_config['colors']['dominance'], 
                    linewidth=2, label='BTC Dominance')
            ax2.axhline(y=50, color='gray', linestyle='--', alpha=0.5)
            ax2.set_title('Bitcoin Market Dominance (%)', fontsize=14, color=self.chart_config['colors']['text'])
            ax2.set_ylabel('Dominance (%)', fontsize=10, color=self.chart_config['colors']['text'])
            ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:.1f}%'))
            ax2.set_ylim(0, 100)
            ax2.tick_params(colors=self.chart_config['colors']['text'])
            ax2.grid(True, alpha=0.3, color=self.chart_config['colors']['grid'])
            
            # Alt Strength Ratio (bottom)
            ax3.set_facecolor(self.chart_config['colors']['background'])
            ax3.plot(df['datetime'], df['alt_strength_ratio'], 
                    color=self.chart_config['colors']['alt_strength'], 
                    linewidth=2, label='Alt Strength Ratio')
            ax3.set_title('Altcoin Strength Ratio', fontsize=14, color=self.chart_config['colors']['text'])
            ax3.set_xlabel('Date', fontsize=10, color=self.chart_config['colors']['text'])
            ax3.set_ylabel('Ratio', fontsize=10, color=self.chart_config['colors']['text'])
            ax3.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:.2f}'))
            ax3.tick_params(colors=self.chart_config['colors']['text'])
            ax3.grid(True, alpha=0.3, color=self.chart_config['colors']['grid'])
            
            # Format x-axis dates for all subplots
            for ax in [ax1, ax2, ax3]:
                ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
                ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, len(df) // 10)))
            
            # Only show x-axis labels on bottom chart
            ax1.set_xticklabels([])
            ax2.set_xticklabels([])
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=self.chart_config['dpi'], 
                       facecolor=self.chart_config['colors']['background'])
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            plt.close(fig)
            return image_base64
            
        except Exception as e:
            logger.error(f"Error generating combined chart: {e}")
            raise
    
    def _calculate_data_hash(self, market_data: List[Dict[str, Any]]) -> str:
        """Calculate hash of market data for caching."""
        try:
            # Create a string representation of the key data
            data_str = json.dumps([
                {
                    'timestamp': item['timestamp'],
                    'btc_price': item['btc_price'],
                    'btc_dominance': item['btc_dominance'],
                    'alt_strength_ratio': item['alt_strength_ratio']
                }
                for item in market_data
            ], sort_keys=True)
            
            return hashlib.md5(data_str.encode()).hexdigest()
            
        except Exception as e:
            logger.error(f"Error calculating data hash: {e}")
            return "error_hash"
    
    def get_chart_summary(self, days: int = 30) -> Dict[str, Any]:
        """Get summary statistics for chart data."""
        try:
            end_timestamp = int(datetime.now(timezone.utc).timestamp())
            start_timestamp = end_timestamp - (days * 24 * 60 * 60)
            
            market_data = self.db.get_market_data_range(start_timestamp, end_timestamp)
            
            if not market_data:
                return {'error': 'No data available'}
            
            df = pd.DataFrame(market_data)
            
            summary = {
                'data_points': len(market_data),
                'date_range': {
                    'start': datetime.fromtimestamp(start_timestamp).isoformat(),
                    'end': datetime.fromtimestamp(end_timestamp).isoformat()
                },
                'btc_price': {
                    'current': float(df['btc_price'].iloc[-1]),
                    'min': float(df['btc_price'].min()),
                    'max': float(df['btc_price'].max()),
                    'change_percent': float(((df['btc_price'].iloc[-1] - df['btc_price'].iloc[0]) / df['btc_price'].iloc[0]) * 100)
                },
                'btc_dominance': {
                    'current': float(df['btc_dominance'].iloc[-1]),
                    'min': float(df['btc_dominance'].min()),
                    'max': float(df['btc_dominance'].max()),
                    'change_percent': float(df['btc_dominance'].iloc[-1] - df['btc_dominance'].iloc[0])
                },
                'alt_strength_ratio': {
                    'current': float(df['alt_strength_ratio'].iloc[-1]),
                    'min': float(df['alt_strength_ratio'].min()),
                    'max': float(df['alt_strength_ratio'].max()),
                    'change_percent': float(((df['alt_strength_ratio'].iloc[-1] - df['alt_strength_ratio'].iloc[0]) / df['alt_strength_ratio'].iloc[0]) * 100)
                }
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting chart summary: {e}")
            return {'error': str(e)}
    
    def _validate_and_clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Validate and clean market data to remove outliers and bad entries.
        
        Args:
            df (pd.DataFrame): Raw market data
            
        Returns:
            pd.DataFrame: Cleaned data
        """
        try:
            initial_count = len(df)
            
            # Define realistic ranges for crypto market data
            btc_price_min = 60000    # Minimum realistic BTC price
            btc_price_max = 200000   # Maximum realistic BTC price
            dominance_min = 35       # Minimum realistic BTC dominance %
            dominance_max = 75       # Maximum realistic BTC dominance %
            alt_ratio_min = 5000000  # Minimum realistic alt strength ratio
            alt_ratio_max = 25000000 # Maximum realistic alt strength ratio
            
            # Filter out outliers
            df_clean = df[
                (df['btc_price'] >= btc_price_min) & (df['btc_price'] <= btc_price_max) &
                (df['btc_dominance'] >= dominance_min) & (df['btc_dominance'] <= dominance_max) &
                (df['alt_strength_ratio'] >= alt_ratio_min) & (df['alt_strength_ratio'] <= alt_ratio_max)
            ].copy()
            
            # Remove any rows with NaN values
            df_clean = df_clean.dropna()
            
            # Log filtering results
            filtered_count = initial_count - len(df_clean)
            if filtered_count > 0:
                logger.warning(f"Filtered out {filtered_count} outlier data points "
                             f"({filtered_count/initial_count*100:.1f}% of data)")
            
            # Additional validation: ensure we have enough data points
            if len(df_clean) < 10:
                logger.warning(f"Very few data points remaining after filtering: {len(df_clean)}")
            
            return df_clean
            
        except Exception as e:
            logger.error(f"Error validating data: {e}")
            return df  # Return original data if validation fails


# Utility functions for easy access
def generate_macro_charts(days: int = 30) -> Dict[str, Any]:
    """Generate macro charts using the service."""
    service = MacroChartService()
    return service.generate_macro_charts(days)


def get_chart_summary(days: int = 30) -> Dict[str, Any]:
    """Get chart summary using the service."""
    service = MacroChartService()
    return service.get_chart_summary(days)


# Example usage and testing
if __name__ == "__main__":
    import asyncio
    
    def test_chart_service():
        """Test the chart service"""
        try:
            print("Testing macro chart service...")
            
            # Create service
            service = MacroChartService()
            
            # Test chart summary
            summary = service.get_chart_summary(7)
            print(f"✅ Chart summary: {summary}")
            
            # Test chart generation (if we have data)
            if summary.get('data_points', 0) > 0:
                charts = service.generate_macro_charts(7)
                print(f"✅ Generated charts:")
                print(f"   Processing time: {charts['processing_time_ms']}ms")
                print(f"   Data points: {charts['data_points']}")
                print(f"   Chart hash: {charts['chart_data_hash'][:16]}...")
            else:
                print("⚠️ No data available for chart generation")
            
            print("🎉 Chart service tests completed!")
            
        except Exception as e:
            print(f"❌ Chart test failed: {e}")
    
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # Run test
    test_chart_service()