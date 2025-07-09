"""
Hyperliquid API Routes

This module provides Flask routes for accessing Hyperliquid trading data
from the frontend application.
"""

from flask import Blueprint, request, jsonify, current_app
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import os

from models.hyperliquid_models import HyperliquidDatabase, AccountType, SyncStatus
from services.hyperliquid_sync_service import create_sync_service

logger = logging.getLogger(__name__)

# Create blueprint
hyperliquid_bp = Blueprint('hyperliquid', __name__, url_prefix='/api/hyperliquid')

# Global sync service instance
sync_service = None
database = None


def init_hyperliquid_services():
    """Initialize Hyperliquid services"""
    global sync_service, database
    try:
        sync_service = create_sync_service()
        database = sync_service.database
        logger.info("Hyperliquid services initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Hyperliquid services: {e}")
        sync_service = None
        database = None


def get_account_type_from_string(account_type_str: str) -> AccountType:
    """Convert string to AccountType enum"""
    try:
        return AccountType(account_type_str.lower())
    except ValueError:
        raise ValueError(f"Invalid account type: {account_type_str}")


@hyperliquid_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        if sync_service and sync_service.api_service.health_check():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'services': {
                    'api': 'healthy',
                    'database': 'healthy' if database else 'unavailable',
                    'sync': 'healthy' if sync_service else 'unavailable'
                }
            }), 200
        else:
            return jsonify({
                'status': 'unhealthy',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'error': 'API service unavailable'
            }), 503
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/accounts', methods=['GET'])
def get_accounts():
    """Get available accounts"""
    try:
        # Get configured accounts from environment
        personal_wallet = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
        vault_wallet = os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
        
        accounts = []
        
        if personal_wallet:
            accounts.append({
                'wallet_address': personal_wallet,
                'account_type': 'personal_wallet',
                'display_name': 'Personal Wallet'
            })
        
        # Note: vault_wallet is an agent address that trades on behalf of personal_wallet
        # Agent addresses don't have separate trade history - all trades are under the main wallet
        # We don't expose the agent address as a separate account in the UI
        if vault_wallet and vault_wallet != personal_wallet:
            logger.info(f"Agent address {vault_wallet} available for trading operations")
        
        return jsonify({
            'success': True,
            'accounts': accounts
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting accounts: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/trades', methods=['GET'])
def get_trades():
    """Get trades with optional filtering"""
    try:
        if not database:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 503
        
        # Get query parameters
        account_type_str = request.args.get('account_type')
        wallet_address = request.args.get('wallet_address')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', 0, type=int)
        
        # Convert account type
        account_type = None
        if account_type_str:
            account_type = get_account_type_from_string(account_type_str)
        
        # Get trades from database
        trades = database.get_trades(
            account_type=account_type,
            wallet_address=wallet_address,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'success': True,
            'trades': trades,
            'count': len(trades)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting trades: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/portfolio', methods=['GET'])
def get_portfolio():
    """Get portfolio snapshots"""
    try:
        if not database:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 503
        
        # Get query parameters
        account_type_str = request.args.get('account_type')
        wallet_address = request.args.get('wallet_address')
        limit = request.args.get('limit', 10, type=int)
        
        # Convert account type
        account_type = None
        if account_type_str:
            account_type = get_account_type_from_string(account_type_str)
        
        # Get portfolio snapshots from database
        snapshots = database.get_portfolio_snapshots(
            account_type=account_type,
            wallet_address=wallet_address,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'snapshots': snapshots,
            'count': len(snapshots)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting portfolio: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/statistics', methods=['GET'])
def get_statistics():
    """Get trade statistics for an account"""
    try:
        if not database:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 503
        
        # Get query parameters
        account_type_str = request.args.get('account_type', required=True)
        wallet_address = request.args.get('wallet_address', required=True)
        
        # Convert account type
        account_type = get_account_type_from_string(account_type_str)
        
        # Get statistics from database
        stats = database.get_trade_statistics(account_type, wallet_address)
        
        return jsonify({
            'success': True,
            'statistics': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/sync/status', methods=['GET'])
def get_sync_status():
    """Get synchronization status"""
    try:
        if not database:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 503
        
        # Get query parameters
        account_type_str = request.args.get('account_type')
        wallet_address = request.args.get('wallet_address')
        
        # Convert account type
        account_type = None
        if account_type_str:
            account_type = get_account_type_from_string(account_type_str)
        
        # Get sync status from database
        sync_statuses = database.get_sync_status(
            account_type=account_type,
            wallet_address=wallet_address
        )
        
        return jsonify({
            'success': True,
            'sync_statuses': sync_statuses,
            'count': len(sync_statuses)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting sync status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/sync/statistics', methods=['GET'])
def get_sync_statistics():
    """Get synchronization statistics"""
    try:
        if not sync_service:
            return jsonify({
                'success': False,
                'error': 'Sync service not available'
            }), 503
        
        # Get sync statistics
        stats = sync_service.get_sync_statistics()
        
        return jsonify({
            'success': True,
            'statistics': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting sync statistics: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/sync/trigger', methods=['POST'])
def trigger_sync():
    """Manually trigger synchronization"""
    try:
        if not sync_service:
            return jsonify({
                'success': False,
                'error': 'Sync service not available'
            }), 503
        
        # Get request data
        data = request.get_json() or {}
        accounts = data.get('accounts', [])
        
        # If no accounts specified, use default accounts
        if not accounts:
            personal_wallet = os.getenv('HYPERLIQUID_WALLET_ADDRESS')
            vault_wallet = os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
            
            if personal_wallet:
                accounts.append({
                    'wallet_address': personal_wallet,
                    'account_type': 'personal_wallet'
                })
            
            # Note: vault_wallet is an agent address - don't sync separately
            if vault_wallet and vault_wallet != personal_wallet:
                logger.info(f"Agent address {vault_wallet} available for trading operations")
        
        if not accounts:
            return jsonify({
                'success': False,
                'error': 'No accounts configured for sync'
            }), 400
        
        # Trigger sync
        results = sync_service.sync_all_accounts(accounts)
        
        return jsonify({
            'success': True,
            'sync_results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error triggering sync: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/summary', methods=['GET'])
def get_account_summary():
    """Get account summary for dashboard"""
    try:
        if not database:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 503
        
        # Get query parameters
        account_type_str = request.args.get('account_type', required=True)
        wallet_address = request.args.get('wallet_address', required=True)
        
        # Convert account type
        account_type = get_account_type_from_string(account_type_str)
        
        # Get basic statistics
        stats = database.get_trade_statistics(account_type, wallet_address)
        
        # Get recent trades for additional metrics
        recent_trades = database.get_trades(
            account_type=account_type,
            wallet_address=wallet_address,
            limit=100
        )
        
        # Get latest portfolio snapshot
        portfolio_snapshots = database.get_portfolio_snapshots(
            account_type=account_type,
            wallet_address=wallet_address,
            limit=1
        )
        
        current_portfolio = portfolio_snapshots[0] if portfolio_snapshots else None
        
        # Calculate additional metrics
        summary = {
            'account_info': {
                'wallet_address': wallet_address,
                'account_type': account_type.value,
                'display_name': 'Personal Wallet' if account_type == AccountType.PERSONAL_WALLET else 'Trading Vault'
            },
            'trade_statistics': stats,
            'current_portfolio': {
                'account_value': current_portfolio['account_value'] if current_portfolio else 0,
                'snapshot_time': current_portfolio['snapshot_time'] if current_portfolio else None
            },
            'recent_activity': {
                'recent_trades_count': len(recent_trades),
                'last_trade_time': recent_trades[0]['time'] if recent_trades else None
            }
        }
        
        return jsonify({
            'success': True,
            'summary': summary
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting account summary: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@hyperliquid_bp.route('/performance', methods=['GET'])
def get_performance_data():
    """Get performance data for charts"""
    try:
        if not database:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 503
        
        # Get query parameters
        account_type_str = request.args.get('account_type', required=True)
        wallet_address = request.args.get('wallet_address', required=True)
        timeframe = request.args.get('timeframe', 'monthly')  # daily, weekly, monthly
        
        # Convert account type
        account_type = get_account_type_from_string(account_type_str)
        
        # Get trades for performance calculation
        trades = database.get_trades(
            account_type=account_type,
            wallet_address=wallet_address
        )
        
        # Get portfolio snapshots for account value over time
        portfolio_snapshots = database.get_portfolio_snapshots(
            account_type=account_type,
            wallet_address=wallet_address,
            limit=100
        )
        
        # Process data based on timeframe
        performance_data = {
            'trades_over_time': [],
            'pnl_over_time': [],
            'account_value_over_time': [],
            'coin_performance': {}
        }
        
        # Group trades by timeframe and calculate metrics
        # This is a simplified version - you might want to implement more sophisticated grouping
        for trade in trades:
            trade_date = datetime.fromtimestamp(trade['time'] / 1000, tz=timezone.utc)
            
            # Group by coin
            coin = trade['coin']
            if coin not in performance_data['coin_performance']:
                performance_data['coin_performance'][coin] = {
                    'total_trades': 0,
                    'total_pnl': 0,
                    'total_volume': 0
                }
            
            coin_perf = performance_data['coin_performance'][coin]
            coin_perf['total_trades'] += 1
            coin_perf['total_pnl'] += trade.get('closed_pnl', 0) or 0
            coin_perf['total_volume'] += trade['px'] * trade['sz']
        
        # Add portfolio snapshots to account value over time
        for snapshot in portfolio_snapshots:
            snapshot_date = datetime.fromtimestamp(snapshot['snapshot_time'], tz=timezone.utc)
            performance_data['account_value_over_time'].append({
                'date': snapshot_date.isoformat(),
                'value': snapshot['account_value']
            })
        
        return jsonify({
            'success': True,
            'performance_data': performance_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting performance data: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# Error handlers
@hyperliquid_bp.errorhandler(400)
def bad_request(error):
    return jsonify({
        'success': False,
        'error': 'Bad request',
        'message': str(error)
    }), 400


@hyperliquid_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Not found',
        'message': str(error)
    }), 404


@hyperliquid_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'message': str(error)
    }), 500


# Register the blueprint initialization function
def register_hyperliquid_routes(app):
    """Register Hyperliquid routes with the Flask app"""
    app.register_blueprint(hyperliquid_bp)
    
    # Initialize services
    with app.app_context():
        init_hyperliquid_services()
    
    logger.info("Hyperliquid routes registered successfully")