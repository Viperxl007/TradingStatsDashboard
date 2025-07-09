"""
Hyperliquid Background Scheduler

This module provides background scheduling for automatic Hyperliquid data synchronization.
"""

import logging
import threading
import time
import os
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import atexit

from services.hyperliquid_sync_service import create_sync_service

logger = logging.getLogger(__name__)


class HyperliquidScheduler:
    """
    Background scheduler for Hyperliquid data synchronization.
    
    This scheduler runs in a separate thread and automatically triggers
    data synchronization at configured intervals.
    """
    
    def __init__(self):
        """Initialize the scheduler"""
        self.sync_service = None
        self.is_running = False
        self.scheduler_thread = None
        self.stop_event = threading.Event()
        
        # Configuration
        self.sync_interval_minutes = int(os.getenv('SYNC_INTERVAL_MINUTES', '5'))
        self.auto_start = os.getenv('AUTO_START_SYNC', 'true').lower() == 'true'
        
        # Accounts to sync
        self.accounts = self._get_configured_accounts()
        
        logger.info(f"Hyperliquid scheduler initialized with {self.sync_interval_minutes} minute intervals")
    
    def _get_configured_accounts(self) -> List[Dict[str, str]]:
        """Get configured accounts from environment variables"""
        accounts = []
        
        personal_wallet = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
        vault_wallet = os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
        
        if personal_wallet:
            accounts.append({
                'wallet_address': personal_wallet,
                'account_type': 'personal_wallet'
            })
        
        # Note: vault_wallet is an agent address that trades on behalf of personal_wallet
        # Agent addresses don't have separate trade history - all trades are under the main wallet
        # So we don't sync trades for the agent address separately
        if vault_wallet and vault_wallet != personal_wallet:
            logger.info(f"Agent address {vault_wallet} configured for trading operations (trades recorded under main wallet)")
        
        logger.info(f"Configured {len(accounts)} accounts for sync")
        return accounts
    
    def initialize_sync_service(self):
        """Initialize the sync service"""
        try:
            self.sync_service = create_sync_service()
            logger.info("Sync service initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize sync service: {e}")
            return False
    
    def start(self):
        """Start the background scheduler"""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return False
        
        if not self.sync_service:
            if not self.initialize_sync_service():
                logger.error("Cannot start scheduler without sync service")
                return False
        
        if not self.accounts:
            logger.warning("No accounts configured for sync")
            return False
        
        self.is_running = True
        self.stop_event.clear()
        
        def scheduler_loop():
            """Main scheduler loop"""
            logger.info(f"Starting Hyperliquid scheduler with {self.sync_interval_minutes} minute intervals")
            
            # Perform initial sync
            try:
                logger.info("Performing initial sync...")
                results = self.sync_service.sync_all_accounts(self.accounts)
                if results['success']:
                    logger.info("Initial sync completed successfully")
                else:
                    logger.warning(f"Initial sync completed with errors: {results.get('errors', [])}")
            except Exception as e:
                logger.error(f"Error in initial sync: {e}")
            
            # Main scheduling loop
            while not self.stop_event.is_set():
                try:
                    # Wait for next sync interval
                    wait_time = self.sync_interval_minutes * 60
                    if self.stop_event.wait(wait_time):
                        break  # Stop event was set
                    
                    # Perform sync
                    logger.info("Starting scheduled sync...")
                    results = self.sync_service.sync_all_accounts(self.accounts)
                    
                    if results['success']:
                        logger.info(f"Scheduled sync completed successfully - "
                                  f"{results['accounts_synced']}/{results['total_accounts']} accounts")
                    else:
                        logger.warning(f"Scheduled sync completed with errors: {results.get('errors', [])}")
                    
                except Exception as e:
                    logger.error(f"Error in scheduled sync: {e}")
            
            logger.info("Hyperliquid scheduler stopped")
        
        self.scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True, name="HyperliquidScheduler")
        self.scheduler_thread.start()
        
        logger.info("Hyperliquid scheduler started")
        return True
    
    def stop(self):
        """Stop the background scheduler"""
        if not self.is_running:
            logger.warning("Scheduler is not running")
            return
        
        logger.info("Stopping Hyperliquid scheduler...")
        self.stop_event.set()
        
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=30)
            
            if self.scheduler_thread.is_alive():
                logger.warning("Scheduler thread did not stop gracefully")
            else:
                logger.info("Scheduler stopped successfully")
        
        self.is_running = False
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status"""
        status = {
            'is_running': self.is_running,
            'sync_interval_minutes': self.sync_interval_minutes,
            'accounts_count': len(self.accounts),
            'accounts': self.accounts,
            'sync_service_available': self.sync_service is not None
        }
        
        if self.sync_service:
            try:
                sync_stats = self.sync_service.get_sync_statistics()
                status['sync_statistics'] = sync_stats
            except Exception as e:
                logger.error(f"Error getting sync statistics: {e}")
                status['sync_statistics'] = None
        
        return status
    
    def trigger_manual_sync(self) -> Dict[str, Any]:
        """Trigger a manual sync"""
        if not self.sync_service:
            return {
                'success': False,
                'error': 'Sync service not available'
            }
        
        if not self.accounts:
            return {
                'success': False,
                'error': 'No accounts configured'
            }
        
        try:
            logger.info("Triggering manual sync...")
            results = self.sync_service.sync_all_accounts(self.accounts)
            logger.info(f"Manual sync completed: {results['success']}")
            return results
        except Exception as e:
            logger.error(f"Error in manual sync: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Global scheduler instance
_scheduler = None


def get_scheduler() -> HyperliquidScheduler:
    """Get the global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = HyperliquidScheduler()
    return _scheduler


def start_scheduler():
    """Start the global scheduler"""
    scheduler = get_scheduler()
    return scheduler.start()


def stop_scheduler():
    """Stop the global scheduler"""
    scheduler = get_scheduler()
    scheduler.stop()


def get_scheduler_status() -> Dict[str, Any]:
    """Get the global scheduler status"""
    scheduler = get_scheduler()
    return scheduler.get_status()


def trigger_manual_sync() -> Dict[str, Any]:
    """Trigger a manual sync"""
    scheduler = get_scheduler()
    return scheduler.trigger_manual_sync()


# Register cleanup function
def cleanup_scheduler():
    """Cleanup function to stop scheduler on exit"""
    global _scheduler
    if _scheduler and _scheduler.is_running:
        logger.info("Cleaning up Hyperliquid scheduler...")
        _scheduler.stop()


atexit.register(cleanup_scheduler)


# Auto-start scheduler if configured
def auto_start_scheduler():
    """Auto-start scheduler if configured"""
    scheduler = get_scheduler()
    if scheduler.auto_start:
        logger.info("Auto-starting Hyperliquid scheduler...")
        if scheduler.start():
            logger.info("Hyperliquid scheduler auto-started successfully")
        else:
            logger.error("Failed to auto-start Hyperliquid scheduler")


# Example usage and testing
if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    try:
        # Create and start scheduler
        scheduler = HyperliquidScheduler()
        
        if scheduler.start():
            print("✅ Scheduler started successfully")
            
            # Get status
            status = scheduler.get_status()
            print(f"✅ Scheduler status: {status}")
            
            # Wait a bit
            time.sleep(5)
            
            # Trigger manual sync
            results = scheduler.trigger_manual_sync()
            print(f"✅ Manual sync results: {results}")
            
            # Stop scheduler
            scheduler.stop()
            print("✅ Scheduler stopped successfully")
        else:
            print("❌ Failed to start scheduler")
            
    except Exception as e:
        print(f"❌ Error testing scheduler: {e}")