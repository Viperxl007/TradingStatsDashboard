#!/usr/bin/env python3
"""
Historical Market Data Collection Script

This script collects 3 months of historical market data using CoinGecko's free tier
and stores it in the database for immediate use with the regime indicator.

Features:
- Uses real BTC and ETH historical data from CoinGecko
- Calculates real current dominance ratios (no hardcoded 0.65 ratios)
- Stores data in the macro_market_data table
- Handles rate limiting and error recovery
- Provides progress tracking and data validation
"""

import asyncio
import sys
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
import time

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import our services
from services.coingecko_service import CoinGeckoService, CoinGeckoAPIError
from models.macro_sentiment_models import MacroSentimentDatabase

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(backend_dir, 'historical_data_collection.log'))
    ]
)

logger = logging.getLogger(__name__)


class HistoricalDataCollector:
    """
    Collects and stores historical market data using CoinGecko free tier.
    """
    
    def __init__(self):
        """Initialize the historical data collector."""
        self.db = MacroSentimentDatabase()
        self.coingecko_service = None
        self.collection_stats = {
            'total_points': 0,
            'successful_inserts': 0,
            'failed_inserts': 0,
            'start_time': None,
            'end_time': None
        }
    
    async def collect_historical_data(self, days: int = 90) -> bool:
        """
        Collect historical market data for the specified number of days.
        
        Args:
            days (int): Number of days of historical data to collect (default: 90 for 3 months)
            
        Returns:
            bool: True if collection was successful, False otherwise
        """
        logger.info(f"🚀 Starting historical data collection for {days} days")
        logger.info("📊 Using CoinGecko free tier with REAL data and current dominance ratios")
        
        self.collection_stats['start_time'] = time.time()
        
        try:
            async with CoinGeckoService() as service:
                self.coingecko_service = service
                
                # Get historical market data using the existing service method
                logger.info("🔍 Fetching historical data from CoinGecko API...")
                historical_data = await service.get_historical_market_data(days=days)
                
                if not historical_data:
                    logger.error("❌ No historical data received from CoinGecko API")
                    return False
                
                self.collection_stats['total_points'] = len(historical_data)
                logger.info(f"✅ Retrieved {len(historical_data)} data points from CoinGecko")
                
                # Store data in database
                logger.info("💾 Storing data in database...")
                await self._store_historical_data(historical_data)
                
                # Calculate and log statistics
                self._log_collection_stats()
                
                return self.collection_stats['successful_inserts'] > 0
                
        except CoinGeckoAPIError as e:
            logger.error(f"❌ CoinGecko API error: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error during data collection: {e}")
            return False
        finally:
            self.collection_stats['end_time'] = time.time()
    
    async def _store_historical_data(self, historical_data: List[Dict[str, Any]]) -> None:
        """
        Store historical data points in the database.
        
        Args:
            historical_data (List[Dict[str, Any]]): Historical data points from CoinGecko
        """
        logger.info(f"💾 Storing {len(historical_data)} data points in database...")
        
        for i, data_point in enumerate(historical_data):
            try:
                # Prepare data for database insertion
                market_data = {
                    'timestamp': data_point['timestamp'],
                    'data_source': data_point.get('data_source', 'coingecko_historical'),
                    'total_market_cap': data_point['total_market_cap'],
                    'btc_market_cap': data_point['btc_market_cap'],
                    'eth_market_cap': data_point['eth_market_cap'],
                    'btc_price': data_point['btc_price'],
                    'data_quality_score': data_point.get('data_quality_score', 1.0),
                    'collection_latency_ms': data_point.get('collection_latency_ms', 0)
                }
                
                # Insert into database
                record_id = self.db.insert_market_data(market_data)
                self.collection_stats['successful_inserts'] += 1
                
                # Log progress every 10 records
                if (i + 1) % 10 == 0:
                    progress = ((i + 1) / len(historical_data)) * 100
                    logger.info(f"📈 Progress: {i + 1}/{len(historical_data)} ({progress:.1f}%) - "
                              f"Latest: {datetime.fromtimestamp(data_point['timestamp']).strftime('%Y-%m-%d')}")
                
            except Exception as e:
                logger.error(f"❌ Failed to insert data point {i}: {e}")
                self.collection_stats['failed_inserts'] += 1
                continue
        
        logger.info(f"✅ Database storage complete: {self.collection_stats['successful_inserts']} successful, "
                   f"{self.collection_stats['failed_inserts']} failed")
    
    def _log_collection_stats(self) -> None:
        """Log collection statistics."""
        stats = self.collection_stats
        duration = stats['end_time'] - stats['start_time'] if stats['end_time'] and stats['start_time'] else 0
        
        logger.info("📊 COLLECTION STATISTICS:")
        logger.info(f"   Total data points: {stats['total_points']}")
        logger.info(f"   Successful inserts: {stats['successful_inserts']}")
        logger.info(f"   Failed inserts: {stats['failed_inserts']}")
        logger.info(f"   Success rate: {(stats['successful_inserts'] / max(stats['total_points'], 1)) * 100:.1f}%")
        logger.info(f"   Collection duration: {duration:.1f} seconds")
        
        if stats['successful_inserts'] > 0:
            logger.info("✅ Historical data collection completed successfully!")
            logger.info("🎯 Data is now available for regime indicator analysis")
        else:
            logger.error("❌ Historical data collection failed - no data was stored")
    
    async def verify_data_quality(self) -> Dict[str, Any]:
        """
        Verify the quality and completeness of collected data.
        
        Returns:
            Dict[str, Any]: Data quality report
        """
        logger.info("🔍 Verifying data quality...")
        
        try:
            # Get data from the last 90 days
            end_timestamp = int(datetime.now(timezone.utc).timestamp())
            start_timestamp = end_timestamp - (90 * 24 * 60 * 60)  # 90 days ago
            
            market_data = self.db.get_market_data_range(start_timestamp, end_timestamp)
            
            if not market_data:
                return {
                    'status': 'error',
                    'message': 'No data found in database',
                    'data_points': 0
                }
            
            # Calculate quality metrics
            total_points = len(market_data)
            quality_scores = [point.get('data_quality_score', 0) for point in market_data]
            avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
            
            # Check for data gaps (should have roughly daily data)
            timestamps = sorted([point['timestamp'] for point in market_data])
            gaps = []
            for i in range(1, len(timestamps)):
                gap_hours = (timestamps[i] - timestamps[i-1]) / 3600
                if gap_hours > 36:  # More than 36 hours gap
                    gaps.append(gap_hours)
            
            # Get date range
            start_date = datetime.fromtimestamp(timestamps[0]).strftime('%Y-%m-%d')
            end_date = datetime.fromtimestamp(timestamps[-1]).strftime('%Y-%m-%d')
            
            quality_report = {
                'status': 'success',
                'data_points': total_points,
                'date_range': f"{start_date} to {end_date}",
                'avg_quality_score': avg_quality,
                'data_gaps': len(gaps),
                'largest_gap_hours': max(gaps) if gaps else 0,
                'latest_btc_price': market_data[-1].get('btc_price', 0),
                'latest_total_mcap': market_data[-1].get('total_market_cap', 0),
                'latest_btc_dominance': market_data[-1].get('btc_dominance', 0)
            }
            
            logger.info("📊 DATA QUALITY REPORT:")
            logger.info(f"   Data points: {quality_report['data_points']}")
            logger.info(f"   Date range: {quality_report['date_range']}")
            logger.info(f"   Average quality score: {quality_report['avg_quality_score']:.3f}")
            logger.info(f"   Data gaps: {quality_report['data_gaps']}")
            logger.info(f"   Latest BTC price: ${quality_report['latest_btc_price']:,.2f}")
            logger.info(f"   Latest total market cap: ${quality_report['latest_total_mcap']:,.0f}")
            logger.info(f"   Latest BTC dominance: {quality_report['latest_btc_dominance']:.2f}%")
            
            return quality_report
            
        except Exception as e:
            logger.error(f"❌ Error verifying data quality: {e}")
            return {
                'status': 'error',
                'message': str(e),
                'data_points': 0
            }


async def main():
    """Main function to run the historical data collection."""
    logger.info("🚀 Historical Market Data Collection Script")
    logger.info("=" * 60)
    
    collector = HistoricalDataCollector()
    
    try:
        # Collect 3 months (90 days) of historical data
        logger.info("📅 Collecting 3 months (90 days) of historical market data...")
        success = await collector.collect_historical_data(days=90)
        
        if success:
            logger.info("✅ Data collection completed successfully!")
            
            # Verify data quality
            quality_report = await collector.verify_data_quality()
            
            if quality_report['status'] == 'success':
                logger.info("🎯 Data is ready for regime indicator analysis!")
                logger.info("💡 You can now use the regime indicator with real historical data")
            else:
                logger.warning("⚠️ Data quality verification failed")
        else:
            logger.error("❌ Data collection failed")
            return 1
            
    except KeyboardInterrupt:
        logger.info("⏹️ Collection interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    # Run the collection script
    exit_code = asyncio.run(main())
    sys.exit(exit_code)