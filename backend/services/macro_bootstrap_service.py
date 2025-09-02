"""
Macro Market Sentiment Bootstrap Service

This service handles the one-time collection of historical market data
to initialize the macro sentiment system with baseline data.
"""

import asyncio
import logging
import time
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import json

# Windows-specific asyncio fix for aiodns compatibility
if sys.platform == 'win32':
    # aiodns requires SelectorEventLoop on Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    from ..models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase
    from ..services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
except ImportError:
    # Fallback for when running from root directory
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase
    from services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError

logger = logging.getLogger(__name__)


class BootstrapError(Exception):
    """Custom exception for bootstrap errors"""
    pass


class MacroBootstrapService:
    """
    Bootstrap service for initializing macro sentiment system with historical data.
    
    This service performs a one-time collection of historical market data
    from CoinMarketCap and populates the database with baseline information.
    """
    
    def __init__(self, db: Optional[MacroSentimentDatabase] = None):
        """
        Initialize bootstrap service.
        
        Args:
            db (Optional[MacroSentimentDatabase]): Database instance
        """
        self.db = db or get_macro_db()
        self.coinmarketcap_service = None
        self.progress_callback = None
    
    def set_progress_callback(self, callback):
        """Set callback function for progress updates."""
        self.progress_callback = callback
    
    def _report_progress(self, message: str, progress: float = None):
        """Report progress to callback and logger."""
        logger.info(message)
        if self.progress_callback:
            self.progress_callback(message, progress)
    
    async def check_bootstrap_status(self) -> Dict[str, Any]:
        """
        Check if bootstrap has been completed by checking actual data in database.
        
        Returns:
            Dict[str, Any]: Bootstrap status information
        """
        try:
            # Check if we have sufficient historical data
            # Calculate 90 days ago in Unix timestamp format
            ninety_days_ago = int(datetime.now(timezone.utc).timestamp()) - (90 * 24 * 60 * 60)
            
            query = """
                SELECT COUNT(*) as count,
                       MIN(timestamp) as earliest_date,
                       MAX(timestamp) as latest_date
                FROM macro_market_data
                WHERE timestamp >= ?
            """
            
            result = self.db.execute_query(query, (ninety_days_ago,))
            if result:
                count = result[0]['count']
                earliest = result[0]['earliest_date']
                latest = result[0]['latest_date']
                
                # Consider bootstrap complete if we have at least 80 data points in last 90 days
                completed = count >= 80
                
                return {
                    'completed': completed,
                    'data_points': count,
                    'earliest_date': earliest,
                    'latest_date': latest,
                    'reason': f"Bootstrap {'completed' if completed else 'incomplete'}: {count} data points available"
                }
            else:
                return {
                    'completed': False,
                    'data_points': 0,
                    'reason': 'No data found'
                }
                
        except Exception as e:
            logger.error(f"Error checking bootstrap status: {e}")
            return {
                'completed': False,
                'reason': f'Error checking status: {e}'
            }
    
    async def run_bootstrap(self, force: bool = False) -> Dict[str, Any]:
        """
        Run the bootstrap process to collect historical data.
        
        Args:
            force (bool): Force bootstrap even if already completed
            
        Returns:
            Dict[str, Any]: Bootstrap results
        """
        try:
            start_time = time.time()
            self._report_progress("🚀 Starting macro sentiment bootstrap process")
            
            # Check if already completed
            if not force:
                status = await self.check_bootstrap_status()
                if status['completed']:
                    return {
                        'success': True,
                        'message': 'Bootstrap already completed',
                        'data_points': status['data_points'],
                        'completed_at': status['completed_at']
                    }
            
            # Initialize progress tracking
            errors = []
            data_points_collected = 0
            
            # Update system state to indicate bootstrap in progress
            self.db.update_system_state({
                'system_status': 'INITIALIZING',
                'bootstrap_completed': False
            })
            
            # Step 1: Initialize CoinMarketCap service
            self._report_progress("📡 Initializing CoinMarketCap API service", 10)
            async with CoinMarketCapService() as service:
                self.coinmarketcap_service = service
                
                # Step 2: Collect current market snapshot
                self._report_progress("📊 Collecting current market snapshot", 20)
                try:
                    current_snapshot = await service.get_current_macro_snapshot()
                    self.db.insert_market_data(current_snapshot)
                    data_points_collected += 1
                    self._report_progress(f"✅ Current snapshot collected: ${current_snapshot['total_market_cap']:,.0f} total market cap", 30)
                except Exception as e:
                    error_msg = f"Failed to collect current snapshot: {e}"
                    errors.append(error_msg)
                    logger.error(error_msg)
                
                # Step 3: Attempt to collect historical data
                self._report_progress("📈 Attempting to collect historical market data", 40)
                try:
                    # CoinMarketCap free tier has limited historical data
                    # We'll collect what we can and supplement with synthetic data if needed
                    historical_data = await self._collect_available_historical_data(service)
                    
                    for i, data_point in enumerate(historical_data):
                        try:
                            self.db.insert_market_data(data_point)
                            data_points_collected += 1
                            
                            # Report progress
                            progress = 40 + (i / len(historical_data)) * 40
                            self._report_progress(f"📥 Inserted historical data point {i+1}/{len(historical_data)}", progress)
                            
                        except Exception as e:
                            error_msg = f"Failed to insert historical data point {i}: {e}"
                            errors.append(error_msg)
                            logger.warning(error_msg)
                    
                    self._report_progress(f"✅ Historical data collection completed: {len(historical_data)} points", 80)
                    
                except Exception as e:
                    error_msg = f"Historical data collection failed: {e}"
                    errors.append(error_msg)
                    logger.error(error_msg)
                
                # Step 4: Validate collected data
                self._report_progress("🔍 Validating collected data", 85)
                validation_result = await self._validate_bootstrap_data()
                
                if not validation_result['valid']:
                    errors.extend(validation_result['errors'])
                    self._report_progress("⚠️ Data validation found issues", 90)
                else:
                    self._report_progress("✅ Data validation passed", 90)
                
                # Step 5: Update system state
                self._report_progress("💾 Updating system state", 95)
                
                bootstrap_success = data_points_collected > 0 and len(errors) == 0
                
                self.db.update_system_state({
                    'bootstrap_completed': bootstrap_success,
                    'bootstrap_completed_at': int(datetime.now(timezone.utc).timestamp()) if bootstrap_success else None,
                    'bootstrap_data_points': data_points_collected,
                    'bootstrap_errors': json.dumps(errors),
                    'system_status': 'ACTIVE' if bootstrap_success else 'ERROR'
                })
                
                # Final results
                duration = time.time() - start_time
                
                if bootstrap_success:
                    self._report_progress(f"🎉 Bootstrap completed successfully in {duration:.1f}s", 100)
                    return {
                        'success': True,
                        'message': 'Bootstrap completed successfully',
                        'data_points': data_points_collected,
                        'duration_seconds': duration,
                        'errors': errors
                    }
                else:
                    self._report_progress(f"❌ Bootstrap completed with errors in {duration:.1f}s", 100)
                    return {
                        'success': False,
                        'message': 'Bootstrap completed with errors',
                        'data_points': data_points_collected,
                        'duration_seconds': duration,
                        'errors': errors
                    }
        
        except Exception as e:
            error_msg = f"Bootstrap process failed: {e}"
            logger.error(error_msg)
            
            # Update system state to reflect error
            self.db.update_system_state({
                'system_status': 'ERROR',
                'bootstrap_errors': json.dumps([error_msg])
            })
            
            return {
                'success': False,
                'message': error_msg,
                'data_points': 0,
                'errors': [error_msg]
            }
    
    async def _collect_available_historical_data(self, service: CoinMarketCapService) -> List[Dict[str, Any]]:
        """
        Collect available historical data from CoinMarketCap.
        
        Args:
            service (CoinMarketCapService): Initialized CoinMarketCap service
            
        Returns:
            List[Dict[str, Any]]: Historical data points
        """
        historical_data = []
        
        try:
            # PRODUCTION SYSTEM: REAL DATA ONLY - NO SYNTHETIC DATA
            logger.info("Collecting REAL historical data from CoinMarketCap API...")
            
            # Get 365 days of REAL historical data for comprehensive macro analysis
            real_historical_data = await service.get_historical_market_data(days=365)
            
            if real_historical_data and len(real_historical_data) > 0:
                historical_data = real_historical_data
                logger.info(f"✅ Successfully collected {len(historical_data)} REAL historical data points (365 days)")
                logger.info("✅ ALL DATA IS REAL - NO SYNTHETIC DATA USED")
            else:
                # FAIL HARD - NO SYNTHETIC DATA ALLOWED IN PRODUCTION
                error_msg = "CRITICAL: No real historical data available from CoinMarketCap API. PRODUCTION SYSTEM REQUIRES REAL DATA ONLY."
                logger.error(error_msg)
                raise BootstrapError(error_msg)
            
        except Exception as e:
            logger.error(f"Error collecting historical data: {e}")
            raise BootstrapError(f"Failed to collect historical data: {e}")
        
        return historical_data
    
    async def _validate_bootstrap_data(self) -> Dict[str, Any]:
        """
        Validate the collected bootstrap data.
        
        Returns:
            Dict[str, Any]: Validation results
        """
        try:
            errors = []
            
            # Check if we have any data
            current_time = int(datetime.now(timezone.utc).timestamp())
            recent_data = self.db.get_market_data_range(
                current_time - (7 * 24 * 60 * 60),  # Last 7 days
                current_time
            )
            
            if not recent_data:
                errors.append("No recent market data found")
            
            # Check data quality
            if recent_data:
                avg_quality = sum(point.get('data_quality_score', 0) for point in recent_data) / len(recent_data)
                if avg_quality < 0.5:
                    errors.append(f"Low average data quality: {avg_quality:.2f}")
            
            # Check for reasonable values
            if recent_data:
                latest = recent_data[-1]
                if latest.get('btc_price', 0) <= 0:
                    errors.append("Invalid BTC price in latest data")
                if latest.get('total_market_cap', 0) <= 0:
                    errors.append("Invalid total market cap in latest data")
            
            return {
                'valid': len(errors) == 0,
                'errors': errors,
                'data_points_checked': len(recent_data)
            }
            
        except Exception as e:
            logger.error(f"Error validating bootstrap data: {e}")
            return {
                'valid': False,
                'errors': [f"Validation error: {e}"],
                'data_points_checked': 0
            }
    
    async def reset_bootstrap(self) -> Dict[str, Any]:
        """
        Reset bootstrap status to allow re-running.
        
        Returns:
            Dict[str, Any]: Reset results
        """
        try:
            # Clear bootstrap status
            self.db.update_system_state({
                'bootstrap_completed': False,
                'bootstrap_completed_at': None,
                'bootstrap_data_points': 0,
                'bootstrap_errors': '[]',
                'system_status': 'INITIALIZING'
            })
            
            logger.info("Bootstrap status reset successfully")
            return {
                'success': True,
                'message': 'Bootstrap status reset successfully'
            }
            
        except Exception as e:
            error_msg = f"Failed to reset bootstrap: {e}"
            logger.error(error_msg)
            return {
                'success': False,
                'message': error_msg
            }


# Utility functions for easy access
async def run_bootstrap(force: bool = False, progress_callback=None) -> Dict[str, Any]:
    """Run bootstrap process with optional progress callback."""
    service = MacroBootstrapService()
    if progress_callback:
        service.set_progress_callback(progress_callback)
    return await service.run_bootstrap(force)


async def check_bootstrap_status() -> Dict[str, Any]:
    """Check bootstrap completion status."""
    service = MacroBootstrapService()
    return await service.check_bootstrap_status()


# Example usage and testing
if __name__ == "__main__":
    import asyncio
    
    async def test_bootstrap():
        """Test the bootstrap service"""
        try:
            print("Testing macro bootstrap service...")
            
            # Create service
            service = MacroBootstrapService()
            
            # Set up progress callback
            def progress_callback(message, progress=None):
                if progress:
                    print(f"[{progress:5.1f}%] {message}")
                else:
                    print(f"[     ] {message}")
            
            service.set_progress_callback(progress_callback)
            
            # Check initial status
            status = await service.check_bootstrap_status()
            print(f"Initial bootstrap status: {status}")
            
            # Run bootstrap
            result = await service.run_bootstrap(force=True)
            print(f"Bootstrap result: {result}")
            
            # Check final status
            final_status = await service.check_bootstrap_status()
            print(f"Final bootstrap status: {final_status}")
            
            print("🎉 Bootstrap service tests completed!")
            
        except Exception as e:
            print(f"❌ Bootstrap test failed: {e}")
    
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # Run test
    asyncio.run(test_bootstrap())