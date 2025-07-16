"""
Hyperliquid Data Synchronization Service

This module provides comprehensive data synchronization between Hyperliquid API
and the local database, including deduplication, error handling, and scheduling.
"""

import logging
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
import os
import json

from models.hyperliquid_models import HyperliquidDatabase, AccountType, SyncStatus
from services.hyperliquid_api_service import HyperliquidAPIService, create_hyperliquid_service

logger = logging.getLogger(__name__)


@dataclass
class SyncConfig:
    """Configuration for data synchronization"""
    sync_interval_minutes: int = 5
    max_retries: int = 3
    batch_size: int = 1000
    enable_portfolio_sync: bool = True
    enable_vault_sync: bool = True
    historical_sync_days: int = 30


class HyperliquidSyncService:
    """
    Service for synchronizing Hyperliquid data with local database.
    
    This service handles:
    - Historical data synchronization
    - Real-time data updates
    - Deduplication
    - Error handling and retries
    - Background scheduling
    """
    
    def __init__(self, api_service: HyperliquidAPIService, database: HyperliquidDatabase, 
                 config: SyncConfig):
        """
        Initialize the sync service.
        
        Args:
            api_service (HyperliquidAPIService): API service instance
            database (HyperliquidDatabase): Database instance
            config (SyncConfig): Sync configuration
        """
        self.api_service = api_service
        self.database = database
        self.config = config
        self.is_running = False
        self.sync_thread = None
        self.stop_event = threading.Event()
        
        # Callbacks for sync events
        self.on_sync_start: Optional[Callable] = None
        self.on_sync_complete: Optional[Callable] = None
        self.on_sync_error: Optional[Callable] = None
        
        logger.info("Hyperliquid sync service initialized")
    
    def sync_user_trades(self, wallet_address: str, account_type: AccountType, 
                        start_time: Optional[int] = None) -> Dict[str, Any]:
        """
        Sync user trades for a specific wallet.
        
        Args:
            wallet_address (str): Wallet address to sync
            account_type (AccountType): Type of account
            start_time (Optional[int]): Start time in milliseconds
            
        Returns:
            Dict[str, Any]: Sync results
        """
        sync_type = "trades"
        
        try:
            logger.info(f"Starting trade sync for {account_type.value}: {wallet_address}")
            
            # Update sync status to in progress
            self.database.update_sync_status(
                account_type, wallet_address, sync_type, SyncStatus.IN_PROGRESS
            )
            
            # Determine sync strategy: initial full sync vs incremental sync
            is_initial_sync = not self.database.has_completed_initial_sync(account_type, wallet_address)
            
            if start_time is None:
                if is_initial_sync:
                    # Initial sync: get ALL historical trades (no start_time = get everything)
                    logger.info(f"Performing initial full sync for {account_type.value}: {wallet_address}")
                    start_time = None
                else:
                    # Incremental sync: start from the last trade time + 1ms
                    latest_time = self.database.get_latest_trade_time(account_type, wallet_address)
                    if latest_time:
                        start_time = latest_time + 1
                        logger.info(f"Performing incremental sync from {start_time} for {account_type.value}: {wallet_address}")
                    else:
                        # Fallback to historical sync
                        start_time = int((datetime.now(timezone.utc) -
                                       timedelta(days=self.config.historical_sync_days)).timestamp() * 1000)
                        logger.info(f"Performing fallback historical sync for {account_type.value}: {wallet_address}")
            
            # Fetch trades from API
            fills = self.api_service.get_user_fills(wallet_address, start_time)
            
            # Process and insert trades
            new_trades = 0
            updated_trades = 0
            errors = []
            
            for fill in fills:
                try:
                    trade_id = fill.get('tid', '')
                    if not trade_id:
                        continue
                    
                    # Check if trade already exists using efficient method
                    if not self.database.trade_exists(trade_id, account_type, wallet_address):
                        self.database.insert_trade(fill, account_type, wallet_address)
                        new_trades += 1
                    else:
                        updated_trades += 1
                        
                except Exception as e:
                    error_msg = f"Error processing trade {fill.get('tid', 'unknown')}: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            # Update sync status
            if errors:
                error_summary = f"{len(errors)} errors occurred during sync"
                self.database.update_sync_status(
                    account_type, wallet_address, sync_type, SyncStatus.FAILED,
                    error_message=error_summary,
                    metadata={'errors': errors[:10]}  # Store first 10 errors
                )
            else:
                # Mark sync as completed with metadata
                metadata = {
                    'new_trades': new_trades,
                    'updated_trades': updated_trades,
                    'total_processed': len(fills),
                    'sync_time': int(datetime.now(timezone.utc).timestamp() * 1000)
                }
                
                # Mark initial sync as completed if this was the first sync
                if is_initial_sync and new_trades > 0:
                    metadata['initial_sync_completed'] = True
                    logger.info(f"Initial sync completed for {account_type.value}: {wallet_address} - {new_trades} trades imported")
                
                self.database.update_sync_status(
                    account_type, wallet_address, sync_type, SyncStatus.COMPLETED,
                    metadata=metadata
                )
            
            result = {
                'success': len(errors) == 0,
                'new_trades': new_trades,
                'updated_trades': updated_trades,
                'total_processed': len(fills),
                'errors': errors
            }
            
            logger.info(f"Trade sync completed for {account_type.value}: {wallet_address} - "
                       f"{new_trades} new, {updated_trades} updated, {len(errors)} errors")
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to sync trades for {account_type.value}: {e}"
            logger.error(error_msg)
            
            self.database.update_sync_status(
                account_type, wallet_address, sync_type, SyncStatus.FAILED,
                error_message=error_msg
            )
            
            return {
                'success': False,
                'error': error_msg,
                'new_trades': 0,
                'updated_trades': 0,
                'total_processed': 0,
                'errors': [error_msg]
            }
    
    def sync_user_portfolio(self, wallet_address: str, account_type: AccountType) -> Dict[str, Any]:
        """
        Sync user portfolio snapshot.
        
        Args:
            wallet_address (str): Wallet address to sync
            account_type (AccountType): Type of account
            
        Returns:
            Dict[str, Any]: Sync results
        """
        sync_type = "portfolio"
        
        try:
            logger.info(f"Starting portfolio sync for {account_type.value}: {wallet_address}")
            
            # Update sync status to in progress
            self.database.update_sync_status(
                account_type, wallet_address, sync_type, SyncStatus.IN_PROGRESS
            )
            
            # Fetch portfolio from API
            portfolio_data = self.api_service.get_user_portfolio(wallet_address)
            
            # Insert portfolio snapshot
            snapshot_id = self.database.insert_portfolio_snapshot(
                portfolio_data, account_type, wallet_address
            )
            
            # Update sync status
            self.database.update_sync_status(
                account_type, wallet_address, sync_type, SyncStatus.COMPLETED,
                metadata={
                    'snapshot_id': snapshot_id,
                    'account_value': portfolio_data.get('accountValue', 0)
                }
            )
            
            result = {
                'success': True,
                'snapshot_id': snapshot_id,
                'account_value': portfolio_data.get('accountValue', 0)
            }
            
            logger.info(f"Portfolio sync completed for {account_type.value}: {wallet_address}")
            return result
            
        except Exception as e:
            error_msg = f"Failed to sync portfolio for {account_type.value}: {e}"
            logger.error(error_msg)
            
            self.database.update_sync_status(
                account_type, wallet_address, sync_type, SyncStatus.FAILED,
                error_message=error_msg
            )
            
            return {
                'success': False,
                'error': error_msg
            }
    
    def sync_vault_equities(self, user_address: str) -> Dict[str, Any]:
        """
        Sync vault equities for a user.
        
        Args:
            user_address (str): User address
            
        Returns:
            Dict[str, Any]: Sync results
        """
        sync_type = "vault_equity"
        
        try:
            logger.info(f"Starting vault equity sync for: {user_address}")
            
            # Fetch vault equities from API
            vault_equities = self.api_service.get_user_vault_equities(user_address)
            
            # Process and insert vault equities
            new_equities = 0
            errors = []
            
            for equity_data in vault_equities:
                try:
                    vault_address = equity_data.get('vaultAddress', '')
                    if vault_address:
                        self.database.insert_vault_equity(equity_data, vault_address, user_address)
                        new_equities += 1
                        
                except Exception as e:
                    error_msg = f"Error processing vault equity: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            result = {
                'success': len(errors) == 0,
                'new_equities': new_equities,
                'total_processed': len(vault_equities),
                'errors': errors
            }
            
            logger.info(f"Vault equity sync completed for: {user_address} - "
                       f"{new_equities} new, {len(errors)} errors")
            
            return result
            
        except Exception as e:
            error_msg = f"Failed to sync vault equities: {e}"
            logger.error(error_msg)
            
            return {
                'success': False,
                'error': error_msg,
                'new_equities': 0,
                'total_processed': 0,
                'errors': [error_msg]
            }
    
    def sync_all_accounts(self, accounts: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Sync all configured accounts.
        
        Args:
            accounts (List[Dict[str, str]]): List of account configurations
                Each dict should have 'wallet_address' and 'account_type' keys
                
        Returns:
            Dict[str, Any]: Overall sync results
        """
        logger.info(f"Starting sync for {len(accounts)} accounts")
        
        if self.on_sync_start:
            self.on_sync_start()
        
        overall_results = {
            'success': True,
            'accounts_synced': 0,
            'total_accounts': len(accounts),
            'results': {},
            'errors': []
        }
        
        for account_config in accounts:
            wallet_address = account_config.get('wallet_address', '')
            account_type_str = account_config.get('account_type', 'personal_wallet')
            
            try:
                account_type = AccountType(account_type_str)
                
                logger.info(f"Syncing account: {account_type.value} - {wallet_address}")
                
                account_results = {
                    'trades': None,
                    'portfolio': None,
                    'vault_equity': None
                }
                
                # Sync trades
                trade_result = self.sync_user_trades(wallet_address, account_type)
                account_results['trades'] = trade_result
                
                # Sync portfolio if enabled
                if self.config.enable_portfolio_sync:
                    portfolio_result = self.sync_user_portfolio(wallet_address, account_type)
                    account_results['portfolio'] = portfolio_result
                
                # Sync vault equities if enabled and account type is trading vault
                if (self.config.enable_vault_sync and 
                    account_type == AccountType.TRADING_VAULT):
                    vault_result = self.sync_vault_equities(wallet_address)
                    account_results['vault_equity'] = vault_result
                
                overall_results['results'][f"{account_type.value}_{wallet_address}"] = account_results
                overall_results['accounts_synced'] += 1
                
                # Check if any sync failed
                if not trade_result.get('success', False):
                    overall_results['success'] = False
                
            except Exception as e:
                error_msg = f"Error syncing account {wallet_address}: {e}"
                logger.error(error_msg)
                overall_results['errors'].append(error_msg)
                overall_results['success'] = False
        
        if self.on_sync_complete:
            self.on_sync_complete(overall_results)
        
        if not overall_results['success'] and self.on_sync_error:
            self.on_sync_error(overall_results['errors'])
        
        logger.info(f"Sync completed: {overall_results['accounts_synced']}/{overall_results['total_accounts']} accounts")
        
        return overall_results
    
    def start_background_sync(self, accounts: List[Dict[str, str]]) -> None:
        """
        Start background synchronization.
        
        Args:
            accounts (List[Dict[str, str]]): List of account configurations
        """
        if self.is_running:
            logger.warning("Background sync is already running")
            return
        
        self.is_running = True
        self.stop_event.clear()
        
        def sync_loop():
            logger.info(f"Starting background sync with {self.config.sync_interval_minutes} minute intervals")
            
            while not self.stop_event.is_set():
                try:
                    # Perform sync
                    results = self.sync_all_accounts(accounts)
                    
                    # Log results
                    if results['success']:
                        logger.info("Background sync completed successfully")
                    else:
                        logger.warning(f"Background sync completed with errors: {results['errors']}")
                    
                except Exception as e:
                    logger.error(f"Error in background sync: {e}")
                
                # Wait for next sync interval
                wait_time = self.config.sync_interval_minutes * 60
                if self.stop_event.wait(wait_time):
                    break  # Stop event was set
            
            logger.info("Background sync stopped")
        
        self.sync_thread = threading.Thread(target=sync_loop, daemon=True)
        self.sync_thread.start()
        
        logger.info("Background sync started")
    
    def stop_background_sync(self) -> None:
        """Stop background synchronization."""
        if not self.is_running:
            logger.warning("Background sync is not running")
            return
        
        logger.info("Stopping background sync...")
        self.stop_event.set()
        
        if self.sync_thread and self.sync_thread.is_alive():
            self.sync_thread.join(timeout=30)
            
            if self.sync_thread.is_alive():
                logger.warning("Background sync thread did not stop gracefully")
            else:
                logger.info("Background sync stopped successfully")
        
        self.is_running = False
    
    def get_sync_statistics(self) -> Dict[str, Any]:
        """
        Get synchronization statistics.
        
        Returns:
            Dict[str, Any]: Sync statistics
        """
        try:
            sync_statuses = self.database.get_sync_status()
            
            stats = {
                'total_syncs': len(sync_statuses),
                'successful_syncs': 0,
                'failed_syncs': 0,
                'in_progress_syncs': 0,
                'last_successful_sync': None,
                'accounts': {},
                'sync_types': {}
            }
            
            for status in sync_statuses:
                # Count by status
                if status['status'] == SyncStatus.COMPLETED.value:
                    stats['successful_syncs'] += 1
                elif status['status'] == SyncStatus.FAILED.value:
                    stats['failed_syncs'] += 1
                elif status['status'] == SyncStatus.IN_PROGRESS.value:
                    stats['in_progress_syncs'] += 1
                
                # Track last successful sync
                if (status['status'] == SyncStatus.COMPLETED.value and 
                    status['last_successful_sync']):
                    if (stats['last_successful_sync'] is None or 
                        status['last_successful_sync'] > stats['last_successful_sync']):
                        stats['last_successful_sync'] = status['last_successful_sync']
                
                # Group by account
                account_key = f"{status['account_type']}_{status['wallet_address']}"
                if account_key not in stats['accounts']:
                    stats['accounts'][account_key] = {
                        'syncs': 0,
                        'successful': 0,
                        'failed': 0,
                        'last_sync': None
                    }
                
                account_stats = stats['accounts'][account_key]
                account_stats['syncs'] += 1
                
                if status['status'] == SyncStatus.COMPLETED.value:
                    account_stats['successful'] += 1
                elif status['status'] == SyncStatus.FAILED.value:
                    account_stats['failed'] += 1
                
                if (account_stats['last_sync'] is None or 
                    status['updated_at'] > account_stats['last_sync']):
                    account_stats['last_sync'] = status['updated_at']
                
                # Group by sync type
                sync_type = status['sync_type']
                if sync_type not in stats['sync_types']:
                    stats['sync_types'][sync_type] = {
                        'syncs': 0,
                        'successful': 0,
                        'failed': 0
                    }
                
                type_stats = stats['sync_types'][sync_type]
                type_stats['syncs'] += 1
                
                if status['status'] == SyncStatus.COMPLETED.value:
                    type_stats['successful'] += 1
                elif status['status'] == SyncStatus.FAILED.value:
                    type_stats['failed'] += 1
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting sync statistics: {e}")
            return {}


def create_sync_service() -> HyperliquidSyncService:
    """
    Create a Hyperliquid sync service instance from environment variables.
    
    Returns:
        HyperliquidSyncService: Configured sync service
    """
    # Create API service
    api_service = create_hyperliquid_service()
    
    # Create database
    database = HyperliquidDatabase()
    
    # Create config
    config = SyncConfig(
        sync_interval_minutes=int(os.getenv('SYNC_INTERVAL_MINUTES', '5')),
        max_retries=int(os.getenv('MAX_RETRIES', '3')),
        batch_size=int(os.getenv('SYNC_BATCH_SIZE', '1000')),
        enable_portfolio_sync=os.getenv('ENABLE_PORTFOLIO_SYNC', 'true').lower() == 'true',
        enable_vault_sync=os.getenv('ENABLE_VAULT_SYNC', 'true').lower() == 'true',
        historical_sync_days=int(os.getenv('HISTORICAL_SYNC_DAYS', '30'))
    )
    
    return HyperliquidSyncService(api_service, database, config)


# Example usage
if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    try:
        # Create sync service
        sync_service = create_sync_service()
        
        # Example accounts configuration
        accounts = [
            {
                'wallet_address': os.getenv('HYPERLIQUID_WALLET_ADDRESS', ''),
                'account_type': 'personal_wallet'
            }
        ]
        
        if accounts[0]['wallet_address']:
            # Test sync
            results = sync_service.sync_all_accounts(accounts)
            print(f"✅ Sync completed: {results}")
            
            # Get statistics
            stats = sync_service.get_sync_statistics()
            print(f"✅ Sync statistics: {stats}")
        else:
            print("❌ No wallet address configured for testing")
            
    except Exception as e:
        print(f"❌ Error testing sync service: {e}")