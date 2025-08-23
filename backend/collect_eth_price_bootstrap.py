#!/usr/bin/env python3
"""
ETH Price Bootstrap Script - ONE-TIME USE ONLY

This script backfills ETH price data for existing macro_market_data records
that were collected before the ETH integration. It uses the CoinMarketCap API
to fetch historical ETH prices and updates existing records.

CRITICAL: This is a one-time bootstrap script for production data migration.
Use with extreme caution on live production systems.
"""

import asyncio
import logging
import sys
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import sqlite3

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Windows-specific asyncio fix
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase
    from services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
    from local_config import CMC_API_KEY
except ImportError:
    # Fallback for direct execution
    sys.path.append(os.path.dirname(__file__))
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase
    from services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
    from local_config import CMC_API_KEY

# Configure logging with UTF-8 encoding for Windows compatibility
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('eth_price_bootstrap.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class ETHPriceBootstrapError(Exception):
    """Custom exception for ETH price bootstrap errors"""
    pass


class ETHPriceBootstrapService:
    """
    Service to backfill ETH price data for existing macro market data records.
    
    This service identifies records missing eth_price data and fetches the
    historical ETH prices from CoinMarketCap API to update them.
    """
    
    def __init__(self, api_key: str, db: Optional[MacroSentimentDatabase] = None):
        """
        Initialize ETH price bootstrap service.
        
        Args:
            api_key (str): CoinMarketCap API key
            db (Optional[MacroSentimentDatabase]): Database instance
        """
        self.db = db or get_macro_db()
        self.cmc_service = CoinMarketCapService(api_key)
        self.updated_count = 0
        self.error_count = 0
        
    async def analyze_missing_eth_prices(self) -> Dict[str, Any]:
        """
        Analyze how many records are missing ETH price data.
        
        Returns:
            Dict[str, Any]: Analysis results
        """
        try:
            with sqlite3.connect(self.db.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Check for records with NULL or 0 eth_price
                cursor.execute('''
                    SELECT COUNT(*) as total_records,
                           COUNT(CASE WHEN eth_price IS NULL OR eth_price = 0 THEN 1 END) as missing_eth_price,
                           MIN(timestamp) as earliest_timestamp,
                           MAX(timestamp) as latest_timestamp
                    FROM macro_market_data
                ''')
                
                result = cursor.fetchone()
                
                if result:
                    analysis = {
                        'total_records': result['total_records'],
                        'missing_eth_price': result['missing_eth_price'],
                        'earliest_timestamp': result['earliest_timestamp'],
                        'latest_timestamp': result['latest_timestamp'],
                        'needs_bootstrap': result['missing_eth_price'] > 0
                    }
                    
                    if analysis['earliest_timestamp']:
                        earliest_date = datetime.fromtimestamp(analysis['earliest_timestamp'], timezone.utc)
                        latest_date = datetime.fromtimestamp(analysis['latest_timestamp'], timezone.utc)
                        analysis['date_range'] = f"{earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}"
                    
                    return analysis
                
                return {'total_records': 0, 'missing_eth_price': 0, 'needs_bootstrap': False}
                
        except Exception as e:
            logger.error(f"Error analyzing missing ETH prices: {e}")
            raise ETHPriceBootstrapError(f"Failed to analyze missing ETH prices: {e}")
    
    async def get_records_missing_eth_price(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get records that are missing ETH price data.
        
        Args:
            limit (int): Maximum number of records to return
            
        Returns:
            List[Dict[str, Any]]: Records missing ETH price data
        """
        try:
            with sqlite3.connect(self.db.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT id, timestamp, eth_market_cap
                    FROM macro_market_data
                    WHERE eth_price IS NULL OR eth_price = 0
                    ORDER BY timestamp ASC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Error getting records missing ETH price: {e}")
            raise ETHPriceBootstrapError(f"Failed to get records missing ETH price: {e}")
    
    async def fetch_eth_price_for_timestamp(self, timestamp: int) -> Optional[float]:
        """
        Fetch ETH price for a specific timestamp using CoinMarketCap API.
        
        Args:
            timestamp (int): Unix timestamp
            
        Returns:
            Optional[float]: ETH price in USD, or None if not found
        """
        try:
            # Convert timestamp to date string
            date = datetime.fromtimestamp(timestamp, timezone.utc)
            date_str = date.strftime('%Y-%m-%d')
            
            # Use async context manager for CoinMarketCap service
            async with self.cmc_service as service:
                # Get ETH historical data for that date
                eth_data = await service.get_cryptocurrency_quotes_historical('ETH', date_str, date_str)
                
                if eth_data and len(eth_data) > 0:
                    # Find the closest timestamp match
                    closest_data = min(eth_data, key=lambda x: abs(x['timestamp'] - timestamp))
                    return closest_data.get('price')
            
            return None
            
        except Exception as e:
            logger.warning(f"Error fetching ETH price for timestamp {timestamp}: {e}")
            return None
    
    async def update_record_eth_price(self, record_id: int, eth_price: float) -> bool:
        """
        Update a specific record with ETH price data.
        
        Args:
            record_id (int): Record ID to update
            eth_price (float): ETH price in USD
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            with sqlite3.connect(self.db.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE macro_market_data 
                    SET eth_price = ?
                    WHERE id = ?
                ''', (eth_price, record_id))
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    self.updated_count += 1
                    return True
                else:
                    logger.warning(f"No record updated for ID {record_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error updating record {record_id} with ETH price {eth_price}: {e}")
            self.error_count += 1
            return False
    
    async def bootstrap_eth_prices(self, batch_size: int = 50, max_records: int = None) -> Dict[str, Any]:
        """
        Bootstrap ETH prices for all missing records.
        
        Args:
            batch_size (int): Number of records to process in each batch
            max_records (int): Maximum number of records to process (None for all)
            
        Returns:
            Dict[str, Any]: Bootstrap results
        """
        try:
            logger.info("Starting ETH price bootstrap process...")
            
            # Analyze current state
            analysis = await self.analyze_missing_eth_prices()
            logger.info(f"Analysis: {analysis['missing_eth_price']} records missing ETH price out of {analysis['total_records']} total")
            
            if not analysis['needs_bootstrap']:
                logger.info("No ETH price bootstrap needed - all records have ETH price data")
                return {
                    'success': True,
                    'updated_count': 0,
                    'error_count': 0,
                    'message': 'No bootstrap needed'
                }
            
            # CoinMarketCap service will be used with async context manager
            
            total_to_process = min(analysis['missing_eth_price'], max_records or analysis['missing_eth_price'])
            processed = 0
            
            logger.info(f"Processing {total_to_process} records in batches of {batch_size}")
            
            while processed < total_to_process:
                # Get next batch of records
                remaining = min(batch_size, total_to_process - processed)
                records = await self.get_records_missing_eth_price(remaining)
                
                if not records:
                    logger.info("No more records to process")
                    break
                
                logger.info(f"Processing batch of {len(records)} records...")
                
                for record in records:
                    try:
                        # Fetch ETH price for this timestamp
                        eth_price = await self.fetch_eth_price_for_timestamp(record['timestamp'])
                        
                        if eth_price:
                            # Update the record
                            success = await self.update_record_eth_price(record['id'], eth_price)
                            if success:
                                logger.debug(f"Updated record {record['id']} with ETH price ${eth_price:.2f}")
                            else:
                                logger.warning(f"Failed to update record {record['id']}")
                        else:
                            # If we can't get ETH price, estimate from market cap
                            # This is a fallback for data gaps
                            if record['eth_market_cap'] and record['eth_market_cap'] > 0:
                                # Rough estimate: use a reasonable ETH supply estimate
                                estimated_supply = 120_000_000  # Approximate ETH supply
                                estimated_price = record['eth_market_cap'] / estimated_supply
                                
                                success = await self.update_record_eth_price(record['id'], estimated_price)
                                if success:
                                    logger.info(f"Updated record {record['id']} with estimated ETH price ${estimated_price:.2f}")
                                else:
                                    logger.warning(f"Failed to update record {record['id']} with estimated price")
                            else:
                                logger.warning(f"No ETH price or market cap data for record {record['id']}")
                                self.error_count += 1
                        
                        processed += 1
                        
                        # Rate limiting - small delay between requests
                        await asyncio.sleep(0.1)
                        
                    except Exception as e:
                        logger.error(f"Error processing record {record['id']}: {e}")
                        self.error_count += 1
                        processed += 1
                
                # Progress update
                progress = (processed / total_to_process) * 100
                logger.info(f"Progress: {processed}/{total_to_process} ({progress:.1f}%) - Updated: {self.updated_count}, Errors: {self.error_count}")
                
                # Longer delay between batches to respect API limits
                await asyncio.sleep(2.0)
            
            # Final results
            results = {
                'success': True,
                'total_processed': processed,
                'updated_count': self.updated_count,
                'error_count': self.error_count,
                'success_rate': (self.updated_count / processed * 100) if processed > 0 else 0
            }
            
            logger.info(f"ETH price bootstrap completed!")
            logger.info(f"Results: {self.updated_count} updated, {self.error_count} errors, {results['success_rate']:.1f}% success rate")
            
            return results
            
        except Exception as e:
            logger.error(f"ETH price bootstrap failed: {e}")
            raise ETHPriceBootstrapError(f"Bootstrap process failed: {e}")
        
        finally:
            # Clean up (no cleanup needed for CoinMarketCap service)
            pass


async def main():
    """Main function to run ETH price bootstrap."""
    try:
        # Get API key from local_config.py
        try:
            api_key = CMC_API_KEY
            if not api_key:
                raise ValueError("CMC_API_KEY not set in local_config.py")
            print(f"Using CoinMarketCap API key from local_config.py")
        except (ImportError, NameError):
            print("CMC_API_KEY not found in local_config.py")
            print("Please set your CoinMarketCap API key:")
            api_key = input("API Key: ").strip()
            
            if not api_key:
                print("No API key provided. Exiting.")
                return
        
        # Initialize bootstrap service
        bootstrap_service = ETHPriceBootstrapService(api_key)
        
        # Analyze current state
        print("Analyzing current database state...")
        analysis = await bootstrap_service.analyze_missing_eth_prices()
        
        print(f"\nDatabase Analysis:")
        print(f"   Total records: {analysis['total_records']}")
        print(f"   Missing ETH price: {analysis['missing_eth_price']}")
        print(f"   Date range: {analysis.get('date_range', 'N/A')}")
        print(f"   Needs bootstrap: {'Yes' if analysis['needs_bootstrap'] else 'No'}")
        
        if not analysis['needs_bootstrap']:
            print("No bootstrap needed. All records have ETH price data.")
            return
        
        # Confirm with user
        print(f"\nPRODUCTION SYSTEM WARNING")
        print(f"This will update {analysis['missing_eth_price']} records in the production database.")
        print(f"This operation cannot be easily undone.")
        
        confirm = input("\nProceed with ETH price bootstrap? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("Bootstrap cancelled by user.")
            return
        
        # Run bootstrap
        print("\nStarting ETH price bootstrap...")
        results = await bootstrap_service.bootstrap_eth_prices(
            batch_size=50,
            max_records=None  # Process all records
        )
        
        print(f"\nBootstrap completed!")
        print(f"   Total processed: {results['total_processed']}")
        print(f"   Successfully updated: {results['updated_count']}")
        print(f"   Errors: {results['error_count']}")
        print(f"   Success rate: {results['success_rate']:.1f}%")
        
        if results['error_count'] > 0:
            print(f"\n{results['error_count']} records had errors. Check eth_price_bootstrap.log for details.")
        
    except KeyboardInterrupt:
        print("\nBootstrap interrupted by user.")
    except Exception as e:
        logger.error(f"Bootstrap failed: {e}")
        print(f"\nBootstrap failed: {e}")
        print("Check eth_price_bootstrap.log for detailed error information.")


if __name__ == "__main__":
    print("ETH Price Bootstrap Script")
    print("=" * 50)
    print("This script backfills ETH price data for existing macro market data records.")
    print("Use with caution on production systems.")
    print("=" * 50)
    
    asyncio.run(main())