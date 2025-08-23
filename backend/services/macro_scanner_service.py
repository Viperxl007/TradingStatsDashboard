"""
Macro Market Sentiment Scanner Service

This service handles automated 4-hour scanning of market data and triggers
AI analysis when new data is collected. It follows the existing scheduler
patterns from the Hyperliquid system.
"""

import asyncio
import logging
import threading
import time
import os
import atexit
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import json

# Windows-specific asyncio fix for aiodns compatibility
if sys.platform == 'win32':
    # aiodns requires SelectorEventLoop on Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    from .coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
    from .macro_bootstrap_service import MacroBootstrapService
    from ..models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase, SystemStatus
except ImportError:
    # Fallback for when running from root directory
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from services.coinmarketcap_service import CoinMarketCapService, CoinMarketCapAPIError
    from services.macro_bootstrap_service import MacroBootstrapService
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase, SystemStatus

# Import local config for CMC API key
try:
    from local_config import CMC_API_KEY
except ImportError:
    CMC_API_KEY = os.environ.get('CMC_API_KEY')

logger = logging.getLogger(__name__)


class MacroScannerService:
    """
    Automated scanner service for macro market sentiment data.
    
    This service runs in a background thread and automatically collects
    market data every 4 hours, following the existing scheduler patterns.
    """
    
    def __init__(self, db: Optional[MacroSentimentDatabase] = None):
        """Initialize the scanner service"""
        self.db = db or get_macro_db()
        self.is_running = False
        self.scanner_thread = None
        self.stop_event = threading.Event()
        
        # Configuration
        self.scan_interval_hours = int(os.getenv('MACRO_SCAN_INTERVAL_HOURS', '4'))
        self.auto_start = os.getenv('AUTO_START_MACRO_SCAN', 'true').lower() == 'true'
        self.max_consecutive_failures = int(os.getenv('MACRO_MAX_FAILURES', '3'))
        
        logger.info(f"Macro scanner initialized with {self.scan_interval_hours} hour intervals")
    
    def start(self) -> bool:
        """Start the background scanner"""
        if self.is_running:
            logger.warning("Macro scanner is already running")
            return False
        
        # Check if bootstrap is completed
        system_state = self.db.get_system_state()
        if not system_state or not system_state.get('bootstrap_completed', False):
            logger.error("Cannot start scanner: bootstrap not completed")
            return False
        
        self.is_running = True
        self.stop_event.clear()
        
        # Persist running state to database
        self.db.update_system_state({'scanner_running': True})
        
        def scanner_loop():
            """Main scanner loop"""
            logger.info(f"Starting macro scanner with {self.scan_interval_hours} hour intervals")
            
            # Perform initial scan
            try:
                logger.info("Performing initial macro scan...")
                result = asyncio.run(self._perform_scan())
                if result['success']:
                    logger.info("Initial macro scan completed successfully")
                else:
                    logger.warning(f"Initial macro scan completed with errors: {result.get('error', 'Unknown error')}")
            except Exception as e:
                logger.error(f"Error in initial macro scan: {e}")
            
            # Main scanning loop
            while not self.stop_event.is_set():
                try:
                    # Wait for next scan interval
                    wait_time = self.scan_interval_hours * 60 * 60  # Convert to seconds
                    if self.stop_event.wait(wait_time):
                        break  # Stop event was set
                    
                    # Perform scheduled scan
                    logger.info("Starting scheduled macro scan...")
                    result = asyncio.run(self._perform_scan())
                    
                    if result['success']:
                        logger.info(f"Scheduled macro scan completed successfully")
                        
                        # Update system state with success
                        self.db.update_system_state({
                            'last_successful_scan': int(datetime.now(timezone.utc).timestamp()),
                            'consecutive_failures': 0,
                            'total_scans_completed': system_state.get('total_scans_completed', 0) + 1,
                            'system_status': SystemStatus.ACTIVE.value
                        })
                        
                    else:
                        logger.warning(f"Scheduled macro scan completed with errors: {result.get('error', 'Unknown error')}")
                        
                        # Update system state with failure
                        consecutive_failures = system_state.get('consecutive_failures', 0) + 1
                        self.db.update_system_state({
                            'last_failed_scan': int(datetime.now(timezone.utc).timestamp()),
                            'consecutive_failures': consecutive_failures,
                            'system_status': SystemStatus.ERROR.value if consecutive_failures >= self.max_consecutive_failures else SystemStatus.ACTIVE.value
                        })
                        
                        # Check if we should stop due to too many failures
                        if consecutive_failures >= self.max_consecutive_failures:
                            logger.error(f"Stopping scanner due to {consecutive_failures} consecutive failures")
                            break
                    
                except Exception as e:
                    logger.error(f"Error in scheduled macro scan: {e}")
                    
                    # Update failure count
                    system_state = self.db.get_system_state()
                    consecutive_failures = system_state.get('consecutive_failures', 0) + 1
                    self.db.update_system_state({
                        'last_failed_scan': int(datetime.now(timezone.utc).timestamp()),
                        'consecutive_failures': consecutive_failures,
                        'system_status': SystemStatus.ERROR.value if consecutive_failures >= self.max_consecutive_failures else SystemStatus.ACTIVE.value
                    })
            
            logger.info("Macro scanner stopped")
        
        self.scanner_thread = threading.Thread(target=scanner_loop, daemon=False, name="MacroScanner")
        self.scanner_thread.start()
        
        logger.info("Macro scanner started")
        return True
    
    def stop(self):
        """Stop the background scanner"""
        if not self.is_running:
            logger.warning("Macro scanner is not running")
            return
        
        logger.info("Stopping macro scanner...")
        self.stop_event.set()
        
        if self.scanner_thread and self.scanner_thread.is_alive():
            self.scanner_thread.join(timeout=30)
            
            if self.scanner_thread.is_alive():
                logger.warning("Scanner thread did not stop gracefully")
            else:
                logger.info("Scanner stopped successfully")
        
        self.is_running = False
        
        # Persist stopped state to database
        self.db.update_system_state({'scanner_running': False})
    
    async def _perform_scan(self) -> Dict[str, Any]:
        """
        Perform a single scan operation.
        
        Returns:
            Dict[str, Any]: Scan results
        """
        try:
            start_time = time.time()
            
            # Step 1: Collect current market data using CoinMarketCap (REAL data)
            if not CMC_API_KEY:
                raise Exception("CMC_API_KEY not configured - cannot collect real market data")
                
            async with CoinMarketCapService(CMC_API_KEY) as service:
                logger.debug("Collecting current macro market snapshot from CoinMarketCap")
                
                # Get current global metrics and real-time coin data
                global_data = await service.get_current_global_metrics()
                
                # Step 2: Get current BTC and ETH data with robust validation and retry logic
                max_retries = 3
                retry_delay = 2.0
                crypto_quotes = None
                
                for attempt in range(max_retries):
                    try:
                        logger.debug(f"Attempting to get cryptocurrency quotes (attempt {attempt + 1}/{max_retries})")
                        crypto_quotes = await service.get_cryptocurrency_quotes_latest('BTC,ETH')
                        
                        # CRITICAL VALIDATION: Ensure we have BOTH BTC and ETH data
                        btc_data = crypto_quotes.get('BTC', {})
                        eth_data = crypto_quotes.get('ETH', {})
                        
                        # Validate BTC data
                        btc_price = btc_data.get('price')
                        btc_market_cap = btc_data.get('market_cap')
                        
                        # Validate ETH data
                        eth_price = eth_data.get('price')
                        eth_market_cap = eth_data.get('market_cap')
                        
                        # STRICT VALIDATION: All data must be present and valid
                        if (not btc_price or btc_price <= 0 or
                            not btc_market_cap or btc_market_cap <= 0 or
                            not eth_price or eth_price <= 0 or
                            not eth_market_cap or eth_market_cap <= 0):
                            
                            missing_fields = []
                            if not btc_price or btc_price <= 0:
                                missing_fields.append("BTC price")
                            if not btc_market_cap or btc_market_cap <= 0:
                                missing_fields.append("BTC market cap")
                            if not eth_price or eth_price <= 0:
                                missing_fields.append("ETH price")
                            if not eth_market_cap or eth_market_cap <= 0:
                                missing_fields.append("ETH market cap")
                            
                            logger.warning(f"Incomplete cryptocurrency data on attempt {attempt + 1}: missing {', '.join(missing_fields)}")
                            
                            if attempt < max_retries - 1:
                                logger.info(f"Retrying in {retry_delay} seconds...")
                                await asyncio.sleep(retry_delay)
                                continue
                            else:
                                raise ValueError(f"Failed to get complete cryptocurrency data after {max_retries} attempts. Missing: {', '.join(missing_fields)}")
                        
                        # SUCCESS: We have complete, valid data
                        logger.info(f"✅ Successfully retrieved complete cryptocurrency data: BTC=${btc_price:,.2f}, ETH=${eth_price:,.2f}")
                        break
                        
                    except Exception as e:
                        logger.error(f"Error getting cryptocurrency quotes on attempt {attempt + 1}: {e}")
                        if attempt < max_retries - 1:
                            logger.info(f"Retrying in {retry_delay} seconds...")
                            await asyncio.sleep(retry_delay)
                        else:
                            raise CoinMarketCapAPIError(f"Failed to get cryptocurrency quotes after {max_retries} attempts: {e}")
                
                # Create snapshot with validated real-time data (all from same timestamp)
                snapshot = {
                    'timestamp': int(datetime.now(timezone.utc).timestamp()),
                    'total_market_cap': global_data['total_market_cap'],
                    'btc_market_cap': btc_market_cap,
                    'eth_market_cap': eth_market_cap,
                    'btc_price': btc_price,
                    'eth_price': eth_price,  # ETH Integration: VALIDATED ETH price
                    'btc_dominance': global_data['btc_dominance'],
                    'data_source': 'coinmarketcap_scanner_realtime',
                    'data_quality_score': 1.0,
                    'collection_latency_ms': int((time.time() - start_time) * 1000)
                }
                
                # Step 3: Store ONLY validated, complete market data
                logger.info(f"Storing validated market data: BTC=${btc_price:,.2f}, ETH=${eth_price:,.2f}")
                self.db.insert_market_data(snapshot)
                
                # Step 4: Check if we should trigger AI analysis
                should_analyze = await self._should_trigger_analysis()
                
                scan_duration = int((time.time() - start_time) * 1000)
                
                result = {
                    'success': True,
                    'timestamp': snapshot['timestamp'],
                    'data_quality': snapshot.get('data_quality_score', 1.0),
                    'scan_duration_ms': scan_duration,
                    'triggered_analysis': should_analyze
                }
                
                # Step 5: Trigger AI analysis if needed
                if should_analyze:
                    try:
                        # Import here to avoid circular imports
                        from .macro_ai_service import trigger_macro_analysis
                        
                        logger.info("Triggering AI analysis after data collection")
                        analysis_result = await trigger_macro_analysis()
                        
                        result['analysis_result'] = analysis_result
                        
                    except Exception as e:
                        logger.error(f"Error triggering AI analysis: {e}")
                        result['analysis_error'] = str(e)
                
                logger.info(f"Macro scan completed in {scan_duration}ms "
                           f"(quality: {snapshot.get('data_quality_score', 1.0):.2f})")
                
                return result
                
        except CoinMarketCapAPIError as e:
            logger.error(f"CoinMarketCap API error during scan: {e}")
            return {
                'success': False,
                'error': f"API error: {e}",
                'error_type': 'api_error'
            }
        
        except Exception as e:
            logger.error(f"Unexpected error during scan: {e}")
            return {
                'success': False,
                'error': f"Scan error: {e}",
                'error_type': 'scan_error'
            }
    
    async def _should_trigger_analysis(self) -> bool:
        """
        Determine if we should trigger AI analysis.
        
        Returns:
            bool: True if analysis should be triggered
        """
        try:
            # Get latest analysis
            latest_analysis = self.db.get_latest_sentiment()
            
            if not latest_analysis:
                logger.info("No previous analysis found, triggering analysis")
                return True
            
            # Check time since last analysis
            current_time = int(datetime.now(timezone.utc).timestamp())
            last_analysis_time = latest_analysis['analysis_timestamp']
            hours_since_analysis = (current_time - last_analysis_time) / 3600
            
            # Trigger analysis every 4 hours
            if hours_since_analysis >= 4:
                logger.info(f"Triggering analysis: {hours_since_analysis:.1f} hours since last analysis")
                return True
            
            logger.debug(f"Skipping analysis: only {hours_since_analysis:.1f} hours since last analysis")
            return False
            
        except Exception as e:
            logger.error(f"Error checking analysis trigger: {e}")
            # Default to triggering analysis on error
            return True
    
    def get_status(self) -> Dict[str, Any]:
        """Get scanner status"""
        try:
            system_state = self.db.get_system_state()
            
            # Check database for running state (cross-process compatible)
            db_running = system_state.get('scanner_running', False) if system_state else False
            
            status = {
                'is_running': db_running,
                'scan_interval_hours': self.scan_interval_hours,
                'max_consecutive_failures': self.max_consecutive_failures,
                'system_status': system_state.get('system_status', 'UNKNOWN') if system_state else 'UNKNOWN'
            }
            
            if system_state:
                status.update({
                    'last_successful_scan': system_state.get('last_successful_scan'),
                    'last_failed_scan': system_state.get('last_failed_scan'),
                    'consecutive_failures': system_state.get('consecutive_failures', 0),
                    'total_scans_completed': system_state.get('total_scans_completed', 0),
                    'bootstrap_completed': system_state.get('bootstrap_completed', False)
                })
                
                # Calculate next scan time
                if status['last_successful_scan']:
                    next_scan = status['last_successful_scan'] + (self.scan_interval_hours * 3600)
                    status['next_scan_timestamp'] = next_scan
                    status['seconds_to_next_scan'] = max(0, next_scan - int(datetime.now(timezone.utc).timestamp()))
            
            return status
            
        except Exception as e:
            logger.error(f"Error getting scanner status: {e}")
            return {
                'is_running': self.is_running,
                'error': str(e)
            }
    
    async def trigger_manual_scan(self) -> Dict[str, Any]:
        """Trigger a manual scan for testing - forces AI analysis regardless of timing"""
        # Check database for running state (cross-process compatible)
        system_state = self.db.get_system_state()
        db_running = system_state.get('scanner_running', False) if system_state else False
        
        if not db_running:
            return {
                'success': False,
                'error': 'Scanner is not running'
            }
        
        try:
            logger.info("Triggering manual macro scan with forced AI analysis...")
            
            # Perform data collection first
            start_time = time.time()
            
            # Step 1: Collect current market data using CoinMarketCap (REAL data)
            if not CMC_API_KEY:
                raise Exception("CMC_API_KEY not configured - cannot collect real market data")
                
            async with CoinMarketCapService(CMC_API_KEY) as service:
                logger.debug("Collecting current macro market snapshot from CoinMarketCap for manual scan")
                
                # Get current global metrics and real-time coin data
                global_data = await service.get_current_global_metrics()
                
                # Step 2: Get current BTC and ETH data with robust validation and retry logic
                max_retries = 3
                retry_delay = 2.0
                crypto_quotes = None
                
                for attempt in range(max_retries):
                    try:
                        logger.debug(f"Manual scan: Attempting to get cryptocurrency quotes (attempt {attempt + 1}/{max_retries})")
                        crypto_quotes = await service.get_cryptocurrency_quotes_latest('BTC,ETH')
                        
                        # CRITICAL VALIDATION: Ensure we have BOTH BTC and ETH data
                        btc_data = crypto_quotes.get('BTC', {})
                        eth_data = crypto_quotes.get('ETH', {})
                        
                        # Validate BTC data
                        btc_price = btc_data.get('price')
                        btc_market_cap = btc_data.get('market_cap')
                        
                        # Validate ETH data
                        eth_price = eth_data.get('price')
                        eth_market_cap = eth_data.get('market_cap')
                        
                        # STRICT VALIDATION: All data must be present and valid
                        if (not btc_price or btc_price <= 0 or
                            not btc_market_cap or btc_market_cap <= 0 or
                            not eth_price or eth_price <= 0 or
                            not eth_market_cap or eth_market_cap <= 0):
                            
                            missing_fields = []
                            if not btc_price or btc_price <= 0:
                                missing_fields.append("BTC price")
                            if not btc_market_cap or btc_market_cap <= 0:
                                missing_fields.append("BTC market cap")
                            if not eth_price or eth_price <= 0:
                                missing_fields.append("ETH price")
                            if not eth_market_cap or eth_market_cap <= 0:
                                missing_fields.append("ETH market cap")
                            
                            logger.warning(f"Manual scan: Incomplete cryptocurrency data on attempt {attempt + 1}: missing {', '.join(missing_fields)}")
                            
                            if attempt < max_retries - 1:
                                logger.info(f"Manual scan: Retrying in {retry_delay} seconds...")
                                await asyncio.sleep(retry_delay)
                                continue
                            else:
                                raise ValueError(f"Manual scan: Failed to get complete cryptocurrency data after {max_retries} attempts. Missing: {', '.join(missing_fields)}")
                        
                        # SUCCESS: We have complete, valid data
                        logger.info(f"✅ Manual scan: Successfully retrieved complete cryptocurrency data: BTC=${btc_price:,.2f}, ETH=${eth_price:,.2f}")
                        break
                        
                    except Exception as e:
                        logger.error(f"Manual scan: Error getting cryptocurrency quotes on attempt {attempt + 1}: {e}")
                        if attempt < max_retries - 1:
                            logger.info(f"Manual scan: Retrying in {retry_delay} seconds...")
                            await asyncio.sleep(retry_delay)
                        else:
                            raise CoinMarketCapAPIError(f"Manual scan: Failed to get cryptocurrency quotes after {max_retries} attempts: {e}")
                
                # Create snapshot with validated real-time data (all from same timestamp)
                snapshot = {
                    'timestamp': int(datetime.now(timezone.utc).timestamp()),
                    'total_market_cap': global_data['total_market_cap'],
                    'btc_market_cap': btc_market_cap,
                    'eth_market_cap': eth_market_cap,
                    'btc_price': btc_price,
                    'eth_price': eth_price,  # ETH Integration: VALIDATED ETH price
                    'btc_dominance': global_data['btc_dominance'],
                    'data_source': 'coinmarketcap_scanner_manual',
                    'data_quality_score': 1.0,
                    'collection_latency_ms': int((time.time() - start_time) * 1000)
                }
                
                # Step 3: Store ONLY validated, complete market data
                logger.info(f"Manual scan: Storing validated market data: BTC=${btc_price:,.2f}, ETH=${eth_price:,.2f}")
                self.db.insert_market_data(snapshot)
                
                scan_duration = int((time.time() - start_time) * 1000)
                
                result = {
                    'success': True,
                    'timestamp': snapshot['timestamp'],
                    'data_quality': snapshot.get('data_quality_score', 1.0),
                    'scan_duration_ms': scan_duration,
                    'triggered_analysis': True,
                    'manual_scan': True
                }
                
                # Step 4: Force AI analysis for manual scans
                try:
                    # Import here to avoid circular imports
                    from .macro_ai_service import trigger_macro_analysis
                    
                    logger.info("Forcing AI analysis for manual scan")
                    analysis_result = await trigger_macro_analysis()
                    
                    result['analysis_result'] = analysis_result
                    logger.info("Manual macro scan with AI analysis completed successfully")
                    
                except Exception as e:
                    logger.error(f"Error triggering AI analysis in manual scan: {e}")
                    result['analysis_error'] = str(e)
                
                return result
            
        except Exception as e:
            logger.error(f"Error in manual scan: {e}")
            return {
                'success': False,
                'error': str(e),
                'manual_scan': True
            }


# Global scanner instance
_scanner = None


def get_scanner() -> MacroScannerService:
    """Get the global scanner instance"""
    global _scanner
    if _scanner is None:
        _scanner = MacroScannerService()
    return _scanner


def start_scanner() -> bool:
    """Start the global scanner"""
    scanner = get_scanner()
    return scanner.start()


def stop_scanner():
    """Stop the global scanner"""
    scanner = get_scanner()
    scanner.stop()


def get_scanner_status() -> Dict[str, Any]:
    """Get the global scanner status"""
    scanner = get_scanner()
    return scanner.get_status()


async def trigger_manual_scan() -> Dict[str, Any]:
    """Trigger a manual scan"""
    scanner = get_scanner()
    return await scanner.trigger_manual_scan()


# Register cleanup function
def cleanup_scanner():
    """Cleanup function to stop scanner on exit"""
    global _scanner
    if _scanner and _scanner.is_running:
        logger.info("Process exiting - cleaning up macro scanner...")
        _scanner.stop()


# Don't register atexit cleanup as it interferes with Flask app creation
# The scanner will be cleaned up when the process actually exits
# atexit.register(cleanup_scanner)


# Auto-start scanner if configured
def auto_start_scanner():
    """Auto-start scanner if configured"""
    try:
        logger.info("🚀 Auto-start scanner function called")
        scanner = get_scanner()
        logger.info(f"Scanner instance created, auto_start configured: {scanner.auto_start}")
        
        if scanner.auto_start:
            logger.info("Auto-starting macro scanner...")
            
            # Check if bootstrap is completed first
            system_state = scanner.db.get_system_state()
            logger.info(f"System state retrieved: {system_state}")
            
            if not system_state or not system_state.get('bootstrap_completed', False):
                logger.warning("Bootstrap not completed, scanner will not start automatically")
                return False
            
            logger.info("Bootstrap completed, attempting to start scanner...")
            start_result = scanner.start()
            logger.info(f"Scanner start result: {start_result}")
            
            if start_result:
                logger.info("✅ Macro scanner auto-started successfully")
                
                # Log scanner status for verification
                status = scanner.get_status()
                logger.info(f"Scanner status: running={status['is_running']}, interval={status['scan_interval_hours']}h")
                
                # Double-check that it's actually running
                if status['is_running']:
                    logger.info("🎉 Scanner confirmed running!")
                    return True
                else:
                    logger.error("⚠️ Scanner start returned True but status shows not running")
                    return False
            else:
                logger.error("❌ Failed to auto-start macro scanner")
                return False
        else:
            logger.info("Auto-start disabled for macro scanner")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error in auto_start_scanner: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False


# Example usage and testing
if __name__ == "__main__":
    import asyncio
    
    async def test_scanner():
        """Test the scanner service"""
        try:
            # Configure logging for testing
            logging.basicConfig(level=logging.INFO)
            
            # Create scanner
            scanner = MacroScannerService()
            
            print("Testing macro scanner service...")
            
            # Test manual scan
            print("🔍 Testing manual scan...")
            result = await scanner.trigger_manual_scan()
            print(f"Manual scan result: {result}")
            
            # Test status
            status = scanner.get_status()
            print(f"Scanner status: {status}")
            
            # Test starting scanner (briefly)
            print("🚀 Testing scanner start/stop...")
            if scanner.start():
                print("✅ Scanner started successfully")
                
                # Wait a moment
                await asyncio.sleep(2)
                
                # Stop scanner
                scanner.stop()
                print("✅ Scanner stopped successfully")
            else:
                print("❌ Failed to start scanner")
            
            print("🎉 Scanner service tests completed!")
            
        except Exception as e:
            print(f"❌ Scanner test failed: {e}")
    
    # Run test
    asyncio.run(test_scanner())