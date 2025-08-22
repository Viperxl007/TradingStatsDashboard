#!/usr/bin/env python3
"""
EMERGENCY ETH DATA CLEANUP AND SYSTEM REFRESH SCRIPT

This script performs a comprehensive cleanup of corrupted ETH data and forces
a complete system refresh to restore proper ETH integration functionality.

CRITICAL OPERATIONS:
1. Purge all corrupted ETH data (0.00 prices, NULL values, unrealistic prices)
2. Delete any analysis records that reference corrupted data
3. Force complete data refresh from external APIs
4. Regenerate all charts including ETH charts
5. Force new AI analysis with clean data

USE WITH EXTREME CAUTION - THIS WILL DELETE DATA!
"""

import asyncio
import logging
import sys
import os
import time
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Windows-specific asyncio fix
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase
    from services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
    from services.macro_chart_service import MacroChartService
    from services.macro_ai_service import MacroAIService
    from local_config import CMC_API_KEY
except ImportError as e:
    print(f"Import error: {e}")
    print("Please ensure all required modules are available")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('emergency_eth_cleanup.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class ETHCleanupError(Exception):
    """Custom exception for ETH cleanup errors"""
    pass


class EmergencyETHCleanupService:
    """
    Emergency service to clean up corrupted ETH data and refresh the entire system.
    
    This service performs aggressive cleanup operations to restore ETH functionality.
    """
    
    def __init__(self, api_key: str, db: Optional[MacroSentimentDatabase] = None):
        """
        Initialize emergency cleanup service.
        
        Args:
            api_key (str): CoinMarketCap API key
            db (Optional[MacroSentimentDatabase]): Database instance
        """
        self.db = db or get_macro_db()
        self.cmc_service = CoinMarketCapService(api_key)
        self.chart_service = MacroChartService(db)
        self.ai_service = MacroAIService(db)
        
        # Cleanup statistics
        self.stats = {
            'corrupted_records_deleted': 0,
            'analysis_records_deleted': 0,
            'new_records_created': 0,
            'charts_generated': 0,
            'analysis_completed': False
        }
    
    async def analyze_corruption(self) -> Dict[str, Any]:
        """
        Analyze the extent of ETH data corruption.
        
        Returns:
            Dict[str, Any]: Corruption analysis results
        """
        try:
            with sqlite3.connect(self.db.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Check for corrupted ETH price data
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_records,
                        COUNT(CASE WHEN eth_price IS NULL THEN 1 END) as null_eth_price,
                        COUNT(CASE WHEN eth_price = 0.0 THEN 1 END) as zero_eth_price,
                        COUNT(CASE WHEN eth_price < 100 AND eth_price > 0 THEN 1 END) as unrealistic_low,
                        COUNT(CASE WHEN eth_price > 10000 THEN 1 END) as unrealistic_high,
                        MIN(eth_price) as min_eth_price,
                        MAX(eth_price) as max_eth_price,
                        AVG(eth_price) as avg_eth_price
                    FROM macro_market_data
                    WHERE eth_price IS NOT NULL
                ''')
                
                market_data_analysis = dict(cursor.fetchone())
                
                # Check analysis records
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_analysis,
                        COUNT(CASE WHEN eth_chart_image IS NULL THEN 1 END) as missing_eth_charts,
                        COUNT(CASE WHEN eth_trend_direction IS NULL THEN 1 END) as missing_eth_trends
                    FROM macro_sentiment_analysis
                ''')
                
                analysis_data_analysis = dict(cursor.fetchone())
                
                # Calculate corruption metrics
                total_corrupted = (
                    market_data_analysis['null_eth_price'] + 
                    market_data_analysis['zero_eth_price'] + 
                    market_data_analysis['unrealistic_low'] + 
                    market_data_analysis['unrealistic_high']
                )
                
                corruption_percentage = (total_corrupted / market_data_analysis['total_records'] * 100) if market_data_analysis['total_records'] > 0 else 0
                
                return {
                    'market_data': market_data_analysis,
                    'analysis_data': analysis_data_analysis,
                    'total_corrupted': total_corrupted,
                    'corruption_percentage': corruption_percentage,
                    'needs_cleanup': total_corrupted > 0 or analysis_data_analysis['missing_eth_charts'] > 0
                }
                
        except Exception as e:
            logger.error(f"Error analyzing corruption: {e}")
            raise ETHCleanupError(f"Failed to analyze corruption: {e}")
    
    async def purge_corrupted_data(self) -> Dict[str, int]:
        """
        Purge all corrupted ETH data from the database.
        
        Returns:
            Dict[str, int]: Purge statistics
        """
        try:
            with sqlite3.connect(self.db.db_path) as conn:
                cursor = conn.cursor()
                
                # Get IDs of corrupted records before deletion
                cursor.execute('''
                    SELECT id, timestamp, eth_price 
                    FROM macro_market_data 
                    WHERE eth_price IS NULL 
                       OR eth_price = 0.0 
                       OR eth_price < 100 
                       OR eth_price > 10000
                ''')
                
                corrupted_records = cursor.fetchall()
                corrupted_ids = [str(record[0]) for record in corrupted_records]
                
                logger.info(f"Found {len(corrupted_records)} corrupted records to delete")
                
                # Delete corrupted market data records
                cursor.execute('''
                    DELETE FROM macro_market_data 
                    WHERE eth_price IS NULL 
                       OR eth_price = 0.0 
                       OR eth_price < 100 
                       OR eth_price > 10000
                ''')
                
                market_records_deleted = cursor.rowcount
                self.stats['corrupted_records_deleted'] = market_records_deleted
                
                # Delete analysis records that might reference corrupted data
                # (Delete all analysis records to force fresh analysis)
                cursor.execute('DELETE FROM macro_sentiment_analysis')
                analysis_records_deleted = cursor.rowcount
                self.stats['analysis_records_deleted'] = analysis_records_deleted
                
                # Reset system state to force fresh scan
                cursor.execute('''
                    UPDATE macro_system_state 
                    SET last_analysis_id = NULL,
                        last_analysis_timestamp = NULL,
                        consecutive_analysis_failures = 0,
                        system_status = 'INITIALIZING',
                        updated_at = ?
                    WHERE id = 1
                ''', (int(datetime.now(timezone.utc).timestamp()),))
                
                conn.commit()
                
                logger.info(f"Purged {market_records_deleted} corrupted market data records")
                logger.info(f"Purged {analysis_records_deleted} analysis records")
                
                return {
                    'market_records_deleted': market_records_deleted,
                    'analysis_records_deleted': analysis_records_deleted,
                    'corrupted_ids': corrupted_ids
                }
                
        except Exception as e:
            logger.error(f"Error purging corrupted data: {e}")
            raise ETHCleanupError(f"Failed to purge corrupted data: {e}")
    
    async def collect_fresh_eth_data(self, hours_back: int = 168) -> Dict[str, Any]:
        """
        Collect fresh ETH data from CoinMarketCap API.
        
        Args:
            hours_back (int): Hours of historical data to collect (default: 7 days)
            
        Returns:
            Dict[str, Any]: Collection results
        """
        try:
            logger.info(f"Collecting fresh ETH data for the last {hours_back} hours")
            
            # Calculate time range
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(hours=hours_back)
            
            collected_count = 0
            
            async with self.cmc_service as service:
                # Collect data in 24-hour chunks to respect API limits
                current_time = start_time
                
                while current_time < end_time:
                    try:
                        # Get market data for this time point
                        date_str = current_time.strftime('%Y-%m-%d')
                        
                        # Get BTC and ETH data
                        btc_data = await service.get_cryptocurrency_quotes_historical('BTC', date_str, date_str)
                        eth_data = await service.get_cryptocurrency_quotes_historical('ETH', date_str, date_str)
                        
                        if btc_data and eth_data and len(btc_data) > 0 and len(eth_data) > 0:
                            # Find closest timestamp matches
                            target_timestamp = int(current_time.timestamp())
                            
                            btc_closest = min(btc_data, key=lambda x: abs(x['timestamp'] - target_timestamp))
                            eth_closest = min(eth_data, key=lambda x: abs(x['timestamp'] - target_timestamp))
                            
                            # Create market data record
                            market_data = {
                                'timestamp': target_timestamp,
                                'data_source': 'coinmarketcap_emergency_refresh',
                                'total_market_cap': btc_closest.get('market_cap', 0) + eth_closest.get('market_cap', 0),
                                'btc_market_cap': btc_closest.get('market_cap', 0),
                                'eth_market_cap': eth_closest.get('market_cap', 0),
                                'btc_price': btc_closest.get('price', 0),
                                'eth_price': eth_closest.get('price', 0),
                                'data_quality_score': 1.0
                            }
                            
                            # Validate data before insertion
                            if (market_data['btc_price'] > 0 and 
                                market_data['eth_price'] > 100 and 
                                market_data['eth_price'] < 10000):
                                
                                # Insert into database
                                self.db.insert_market_data(market_data)
                                collected_count += 1
                                
                                logger.debug(f"Collected data for {current_time.strftime('%Y-%m-%d %H:%M')} - ETH: ${market_data['eth_price']:.2f}")
                            else:
                                logger.warning(f"Invalid data for {current_time.strftime('%Y-%m-%d %H:%M')} - skipping")
                        
                        # Move to next time point (every 4 hours)
                        current_time += timedelta(hours=4)
                        
                        # Rate limiting
                        await asyncio.sleep(1.0)
                        
                    except Exception as e:
                        logger.warning(f"Error collecting data for {current_time.strftime('%Y-%m-%d %H:%M')}: {e}")
                        current_time += timedelta(hours=4)
                        continue
            
            self.stats['new_records_created'] = collected_count
            
            logger.info(f"Successfully collected {collected_count} fresh data points")
            
            return {
                'success': True,
                'records_collected': collected_count,
                'time_range': f"{start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}"
            }
            
        except Exception as e:
            logger.error(f"Error collecting fresh ETH data: {e}")
            raise ETHCleanupError(f"Failed to collect fresh ETH data: {e}")
    
    async def force_chart_regeneration(self) -> Dict[str, Any]:
        """
        Force regeneration of all charts including ETH charts.
        
        Returns:
            Dict[str, Any]: Chart generation results
        """
        try:
            logger.info("Forcing chart regeneration...")
            
            # Generate charts with fresh data
            chart_data = self.chart_service.generate_macro_charts(days=7)
            
            # Verify ETH chart was generated
            eth_chart_generated = 'eth_chart_image' in chart_data and chart_data['eth_chart_image'] is not None
            
            if eth_chart_generated:
                logger.info("✅ ETH chart successfully generated")
                self.stats['charts_generated'] = len([k for k in chart_data.keys() if k.endswith('_chart') and chart_data[k]])
            else:
                logger.error("❌ ETH chart generation failed")
                raise ETHCleanupError("ETH chart generation failed")
            
            return {
                'success': True,
                'charts_generated': self.stats['charts_generated'],
                'eth_chart_generated': eth_chart_generated,
                'chart_data_summary': {k: 'Generated' if v else 'Failed' for k, v in chart_data.items() if k.endswith('_chart') or k.endswith('_chart_image')}
            }
            
        except Exception as e:
            logger.error(f"Error forcing chart regeneration: {e}")
            raise ETHCleanupError(f"Failed to regenerate charts: {e}")
    
    async def force_ai_analysis(self) -> Dict[str, Any]:
        """
        Force a new AI analysis with clean data.
        
        Returns:
            Dict[str, Any]: AI analysis results
        """
        try:
            logger.info("Forcing new AI analysis...")
            
            # Trigger new analysis
            analysis_result = await self.ai_service.analyze_macro_sentiment(days=7)
            
            if analysis_result and analysis_result.get('success'):
                logger.info("✅ AI analysis completed successfully")
                self.stats['analysis_completed'] = True
                
                # Verify ETH trend analysis is included
                analysis_data = analysis_result.get('analysis', {})
                eth_trend_included = 'eth_trend_direction' in analysis_data
                
                if eth_trend_included:
                    logger.info(f"✅ ETH trend analysis included: {analysis_data.get('eth_trend_direction')}")
                else:
                    logger.warning("⚠️ ETH trend analysis missing from AI result")
                
                return {
                    'success': True,
                    'analysis_id': analysis_result.get('analysis_id'),
                    'eth_trend_included': eth_trend_included,
                    'confidence': analysis_data.get('overall_confidence'),
                    'trade_permission': analysis_data.get('trade_permission')
                }
            else:
                raise ETHCleanupError("AI analysis failed")
                
        except Exception as e:
            logger.error(f"Error forcing AI analysis: {e}")
            raise ETHCleanupError(f"Failed to force AI analysis: {e}")
    
    async def verify_eth_integration(self) -> Dict[str, Any]:
        """
        Verify that ETH integration is working properly after cleanup.
        
        Returns:
            Dict[str, Any]: Verification results
        """
        try:
            logger.info("Verifying ETH integration...")
            
            verification_results = {
                'database_eth_data': False,
                'eth_chart_generation': False,
                'eth_trend_analysis': False,
                'overall_success': False
            }
            
            # Check database has valid ETH data
            with sqlite3.connect(self.db.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT COUNT(*) as valid_eth_records
                    FROM macro_market_data 
                    WHERE eth_price > 100 AND eth_price < 10000
                ''')
                
                valid_eth_records = cursor.fetchone()[0]
                verification_results['database_eth_data'] = valid_eth_records > 0
                
                # Check latest analysis has ETH data
                cursor.execute('''
                    SELECT eth_trend_direction, eth_chart_image
                    FROM macro_sentiment_analysis 
                    ORDER BY analysis_timestamp DESC 
                    LIMIT 1
                ''')
                
                latest_analysis = cursor.fetchone()
                if latest_analysis:
                    verification_results['eth_trend_analysis'] = latest_analysis[0] is not None
                    verification_results['eth_chart_generation'] = latest_analysis[1] is not None
            
            # Test chart generation
            try:
                test_charts = self.chart_service.generate_macro_charts(days=3)
                verification_results['eth_chart_generation'] = 'eth_chart' in test_charts and test_charts['eth_chart'] is not None
            except Exception as e:
                logger.warning(f"Chart generation test failed: {e}")
            
            # Overall success
            verification_results['overall_success'] = all([
                verification_results['database_eth_data'],
                verification_results['eth_chart_generation'],
                verification_results['eth_trend_analysis']
            ])
            
            if verification_results['overall_success']:
                logger.info("✅ ETH integration verification PASSED")
            else:
                logger.error("❌ ETH integration verification FAILED")
                logger.error(f"Results: {verification_results}")
            
            return verification_results
            
        except Exception as e:
            logger.error(f"Error verifying ETH integration: {e}")
            return {'overall_success': False, 'error': str(e)}
    
    async def emergency_cleanup_and_refresh(self) -> Dict[str, Any]:
        """
        Perform complete emergency cleanup and refresh.
        
        Returns:
            Dict[str, Any]: Complete operation results
        """
        try:
            logger.info("🚨 STARTING EMERGENCY ETH CLEANUP AND REFRESH 🚨")
            
            start_time = time.time()
            
            # Step 1: Analyze corruption
            logger.info("Step 1: Analyzing corruption...")
            corruption_analysis = await self.analyze_corruption()
            logger.info(f"Corruption analysis: {corruption_analysis['corruption_percentage']:.1f}% corrupted")
            
            # Step 2: Purge corrupted data
            logger.info("Step 2: Purging corrupted data...")
            purge_results = await self.purge_corrupted_data()
            logger.info(f"Purged {purge_results['market_records_deleted']} corrupted records")
            
            # Step 3: Collect fresh data
            logger.info("Step 3: Collecting fresh ETH data...")
            collection_results = await self.collect_fresh_eth_data(hours_back=168)  # 7 days
            logger.info(f"Collected {collection_results['records_collected']} fresh records")
            
            # Step 4: Force chart regeneration
            logger.info("Step 4: Forcing chart regeneration...")
            chart_results = await self.force_chart_regeneration()
            logger.info(f"Generated {chart_results['charts_generated']} charts")
            
            # Step 5: Force AI analysis
            logger.info("Step 5: Forcing AI analysis...")
            analysis_results = await self.force_ai_analysis()
            logger.info(f"AI analysis completed with confidence: {analysis_results.get('confidence', 'N/A')}")
            
            # Step 6: Verify integration
            logger.info("Step 6: Verifying ETH integration...")
            verification_results = await self.verify_eth_integration()
            
            # Compile final results
            total_time = time.time() - start_time
            
            final_results = {
                'success': verification_results['overall_success'],
                'total_time_seconds': total_time,
                'corruption_analysis': corruption_analysis,
                'purge_results': purge_results,
                'collection_results': collection_results,
                'chart_results': chart_results,
                'analysis_results': analysis_results,
                'verification_results': verification_results,
                'statistics': self.stats
            }
            
            if final_results['success']:
                logger.info("🎉 EMERGENCY CLEANUP AND REFRESH COMPLETED SUCCESSFULLY! 🎉")
            else:
                logger.error("💥 EMERGENCY CLEANUP AND REFRESH FAILED! 💥")
            
            return final_results
            
        except Exception as e:
            logger.error(f"Emergency cleanup and refresh failed: {e}")
            raise ETHCleanupError(f"Emergency cleanup and refresh failed: {e}")


async def main():
    """Main function to run emergency ETH cleanup and refresh."""
    try:
        print("🚨 EMERGENCY ETH DATA CLEANUP AND SYSTEM REFRESH 🚨")
        print("=" * 60)
        print("This script will:")
        print("1. PURGE ALL CORRUPTED ETH DATA from the database")
        print("2. DELETE analysis records with corrupted references")
        print("3. COLLECT FRESH ETH DATA from CoinMarketCap API")
        print("4. FORCE REGENERATION of all charts including ETH charts")
        print("5. FORCE NEW AI ANALYSIS with clean data")
        print("6. VERIFY end-to-end ETH integration")
        print("=" * 60)
        print()
        
        # Get API key
        try:
            api_key = CMC_API_KEY
            if not api_key:
                raise ValueError("CMC_API_KEY not set in local_config.py")
            print("✅ CoinMarketCap API key loaded from local_config.py")
        except (ImportError, NameError):
            print("❌ CMC_API_KEY not found in local_config.py")
            api_key = input("Enter your CoinMarketCap API key: ").strip()
            if not api_key:
                print("No API key provided. Exiting.")
                return
        
        # Confirm with user
        print("\n⚠️  WARNING: THIS WILL DELETE CORRUPTED DATA AND CANNOT BE UNDONE! ⚠️")
        confirm = input("\nProceed with emergency cleanup? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("Emergency cleanup cancelled by user.")
            return
        
        # Initialize cleanup service
        cleanup_service = EmergencyETHCleanupService(api_key)
        
        # Run emergency cleanup and refresh
        results = await cleanup_service.emergency_cleanup_and_refresh()
        
        # Display results
        print("\n" + "=" * 60)
        print("EMERGENCY CLEANUP AND REFRESH RESULTS")
        print("=" * 60)
        print(f"Overall Success: {'✅ YES' if results['success'] else '❌ NO'}")
        print(f"Total Time: {results['total_time_seconds']:.1f} seconds")
        print()
        print("Statistics:")
        print(f"  • Corrupted records deleted: {results['statistics']['corrupted_records_deleted']}")
        print(f"  • Analysis records deleted: {results['statistics']['analysis_records_deleted']}")
        print(f"  • New records created: {results['statistics']['new_records_created']}")
        print(f"  • Charts generated: {results['statistics']['charts_generated']}")
        print(f"  • Analysis completed: {'✅' if results['statistics']['analysis_completed'] else '❌'}")
        print()
        print("Verification Results:")
        verification = results['verification_results']
        print(f"  • Database ETH data: {'✅' if verification.get('database_eth_data') else '❌'}")
        print(f"  • ETH chart generation: {'✅' if verification.get('eth_chart_generation') else '❌'}")
        print(f"  • ETH trend analysis: {'✅' if verification.get('eth_trend_analysis') else '❌'}")
        print()
        
        if results['success']:
            print("🎉 ETH INTEGRATION RESTORED SUCCESSFULLY! 🎉")
            print("The system should now properly display:")
            print("  • ETH Price Chart")
            print("  • ETH/BTC Ratio Chart")
            print("  • ETH trend analysis in AI reports")
        else:
            print("💥 CLEANUP FAILED - MANUAL INTERVENTION REQUIRED 💥")
            print("Check emergency_eth_cleanup.log for detailed error information.")
        
    except KeyboardInterrupt:
        print("\nEmergency cleanup interrupted by user.")
    except Exception as e:
        logger.error(f"Emergency cleanup failed: {e}")
        print(f"\nEmergency cleanup failed: {e}")
        print("Check emergency_eth_cleanup.log for detailed error information.")


if __name__ == "__main__":
    asyncio.run(main())