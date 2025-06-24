"""
Concentrated Liquidity API Routes

This module defines the API endpoints for managing concentrated liquidity positions.
Following the existing Flask application patterns and conventions.
"""

from flask import Blueprint, jsonify, request
import logging
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.cl_service import CLService
from services.price_updater import PriceUpdateService
from services.position_monitor import PositionMonitorService
from services.il_calculator import ILCalculatorService
from services.background_tasks import BackgroundTaskService

logger = logging.getLogger(__name__)

# Create blueprint for CL routes
cl_bp = Blueprint('cl', __name__, url_prefix='/api/cl')

# Initialize services
cl_service = CLService()
price_updater = PriceUpdateService()
position_monitor = PositionMonitorService()
il_calculator = ILCalculatorService()
background_tasks = BackgroundTaskService()


@cl_bp.route('/positions', methods=['GET'])
def get_positions():
    """
    Get all CL positions with optional filtering.
    
    Query Parameters:
        status (str, optional): Filter by status ('active' or 'closed')
        include_calculations (bool, optional): Include calculated fields (default: true)
    
    Returns:
        JSON response with positions list
    """
    try:
        status = request.args.get('status')
        include_calculations = request.args.get('include_calculations', 'true').lower() == 'true'
        
        # Validate status parameter
        if status and status not in ['active', 'closed']:
            return jsonify({
                'error': 'Invalid status parameter. Must be "active" or "closed"'
            }), 400
        
        positions = cl_service.get_positions(
            status=status,
            include_calculations=include_calculations
        )
        
        return jsonify({
            'success': True,
            'data': positions,
            'count': len(positions)
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving CL positions: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve positions',
            'details': str(e)
        }), 500


@cl_bp.route('/positions', methods=['POST'])
def create_position():
    """
    Create a new CL position.
    
    Request Body:
        JSON object with position data including:
        - trade_name (str): Name/identifier for the position
        - pair_symbol (str): Trading pair symbol (e.g., "USDC/ETH")
        - price_range_min (float): Lower price bound
        - price_range_max (float): Upper price bound
        - liquidity_amount (float): Amount of liquidity provided
        - initial_investment (float): Initial USD investment
        - entry_date (str): Entry date in ISO format
        - contract_address (str, optional): Contract address
        - protocol (str, optional): Protocol name (default: "HyperSwap")
        - chain (str, optional): Blockchain (default: "HyperEVM")
        - notes (str, optional): User notes
    
    Returns:
        JSON response with created position data
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        position_data = request.get_json()
        
        if not position_data:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        # Create the position
        position = cl_service.create_position(position_data)
        
        return jsonify({
            'success': True,
            'data': position,
            'message': 'Position created successfully'
        }), 201
        
    except ValueError as e:
        logger.warning(f"Validation error creating CL position: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Validation error',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error creating CL position: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create position',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>', methods=['GET'])
def get_position(position_id):
    """
    Get a specific CL position by ID.
    
    Path Parameters:
        position_id (str): The position ID
    
    Query Parameters:
        include_calculations (bool, optional): Include calculated fields (default: true)
    
    Returns:
        JSON response with position data
    """
    try:
        include_calculations = request.args.get('include_calculations', 'true').lower() == 'true'
        
        position = cl_service.get_position_by_id(
            position_id,
            include_calculations=include_calculations
        )
        
        if position:
            return jsonify({
                'success': True,
                'data': position
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Position not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error retrieving CL position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve position',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>', methods=['PUT'])
def update_position(position_id):
    """
    Update a CL position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Request Body:
        JSON object with fields to update
    
    Returns:
        JSON response with updated position data
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        updates = request.get_json()
        
        if not updates:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        # Don't allow updating the ID
        if 'id' in updates:
            del updates['id']
        
        position = cl_service.update_position(position_id, updates)
        
        if position:
            return jsonify({
                'success': True,
                'data': position,
                'message': 'Position updated successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Position not found'
            }), 404
            
    except ValueError as e:
        logger.warning(f"Validation error updating CL position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Validation error',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error updating CL position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update position',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>', methods=['DELETE'])
def delete_position(position_id):
    """
    Delete a CL position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Returns:
        JSON response confirming deletion
    """
    try:
        success = cl_service.delete_position(position_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Position deleted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Position not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error deleting CL position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete position',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>/close', methods=['POST'])
def close_position(position_id):
    """
    Close a CL position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Request Body:
        JSON object with exit data:
        - exit_date (str, optional): Exit date in ISO format (default: current time)
        - notes (str, optional): Exit notes
    
    Returns:
        JSON response with closed position data
    """
    try:
        exit_data = {}
        
        if request.is_json:
            exit_data = request.get_json() or {}
        
        position = cl_service.close_position(position_id, exit_data)
        
        if position:
            return jsonify({
                'success': True,
                'data': position,
                'message': 'Position closed successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Position not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error closing CL position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to close position',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>/fees', methods=['POST'])
def update_position_fees(position_id):
    """
    Update fees for a CL position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Request Body:
        JSON object with fee data:
        - fees_amount (float): Amount of fees collected
        - update_date (str): Date of fee collection in ISO format
        - notes (str, optional): Notes about the fee update
    
    Returns:
        JSON response confirming fee update
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        fee_data = request.get_json()
        
        if not fee_data:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        success = cl_service.update_position_fees(position_id, fee_data)
        
        if success:
            # Get updated position
            position = cl_service.get_position_by_id(position_id)
            return jsonify({
                'success': True,
                'data': position,
                'message': 'Fees updated successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update fees'
            }), 400
            
    except ValueError as e:
        logger.warning(f"Validation error updating fees for position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Validation error',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error updating fees for position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update fees',
            'details': str(e)
        }), 500


@cl_bp.route('/portfolio/summary', methods=['GET'])
def get_portfolio_summary():
    """
    Get portfolio summary statistics.
    
    Returns:
        JSON response with portfolio summary data
    """
    try:
        summary = cl_service.get_portfolio_summary()
        
        return jsonify({
            'success': True,
            'data': summary
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving portfolio summary: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve portfolio summary',
            'details': str(e)
        }), 500


@cl_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for CL service.
    
    Returns:
        JSON response with service status
    """
    try:
        # Simple health check - try to get positions count
        positions = cl_service.get_positions(include_calculations=False)
        
        return jsonify({
            'success': True,
            'status': 'healthy',
            'positions_count': len(positions),
            'timestamp': int(datetime.now().timestamp())
        }), 200
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': int(datetime.now().timestamp())
        }), 500


# =============================================================================
# PHASE 2 API ENDPOINTS - Price Monitoring and Analytics
# =============================================================================

@cl_bp.route('/prices/<position_id>', methods=['GET'])
def get_position_price_history(position_id):
    """
    Get price history for a specific position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Query Parameters:
        days (int, optional): Number of days of history (default: 30)
        limit (int, optional): Maximum number of records (default: 100)
    
    Returns:
        JSON response with price history data
    """
    try:
        days = int(request.args.get('days', 30))
        limit = int(request.args.get('limit', 100))
        
        # Validate parameters
        if days < 1 or days > 365:
            return jsonify({
                'success': False,
                'error': 'Days parameter must be between 1 and 365'
            }), 400
        
        if limit < 1 or limit > 1000:
            return jsonify({
                'success': False,
                'error': 'Limit parameter must be between 1 and 1000'
            }), 400
        
        # Get price history
        from datetime import datetime, timedelta
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        price_history = price_updater.price_history_model.get_price_history(
            position_id=position_id,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        
        if not price_history:
            return jsonify({
                'success': False,
                'error': 'No price history found for this position'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'position_id': position_id,
                'price_history': price_history,
                'count': len(price_history),
                'period_days': days
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid parameter format',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error retrieving price history for position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve price history',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>/current-price', methods=['GET'])
def get_position_current_price(position_id):
    """
    Get current token prices for a specific position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Returns:
        JSON response with current token prices from DexScreener
    """
    try:
        # Get position data
        position = cl_service.get_position_by_id(position_id, include_calculations=False)
        if not position:
            return jsonify({
                'success': False,
                'error': 'Position not found'
            }), 404
        
        # Check if position has token addresses
        if not position.get('token0_address') or not position.get('token1_address'):
            return jsonify({
                'success': False,
                'error': 'Position missing token addresses. Please update position with token0_address and token1_address.'
            }), 400
        
        # Import DexScreenerService
        from services.dexscreener_service import DexScreenerService
        dex_service = DexScreenerService()
        
        # Get current prices for both tokens
        chain_id = position.get('chain', 'hyperevm').lower()
        token0_data = dex_service.get_token_data(chain_id, position['token0_address'])
        token1_data = dex_service.get_token_data(chain_id, position['token1_address'])
        
        if not token0_data and not token1_data:
            return jsonify({
                'success': False,
                'error': 'Unable to fetch price data for either token'
            }), 404
        
        # Calculate position value using real prices
        current_value = cl_service._calculate_current_value_with_prices(position, token0_data, token1_data)
        
        response_data = {
            'position_id': position_id,
            'pair_symbol': position['pair_symbol'],
            'token0': {
                'address': position['token0_address'],
                'price_data': token0_data
            },
            'token1': {
                'address': position['token1_address'],
                'price_data': token1_data
            },
            'position_value': {
                'current_usd_value': current_value,
                'initial_investment': position['initial_investment'],
                'pnl': current_value - position['initial_investment'],
                'pnl_percentage': ((current_value - position['initial_investment']) / position['initial_investment'] * 100) if position['initial_investment'] > 0 else 0
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting current price for position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get current price',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>/update-price', methods=['POST'])
def update_position_price(position_id):
    """
    Manually trigger a price update for a specific position.
    
    Path Parameters:
        position_id (str): The position ID
    
    Returns:
        JSON response with updated price data
    """
    try:
        result = price_updater.update_position_price(position_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result,
                'message': 'Position price updated successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to update price')
            }), 400
            
    except Exception as e:
        logger.error(f"Error updating price for position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update position price',
            'details': str(e)
        }), 500


@cl_bp.route('/positions/<position_id>/analytics', methods=['GET'])
def get_position_analytics(position_id):
    """
    Get comprehensive analytics for a position including IL calculations.
    
    Path Parameters:
        position_id (str): The position ID
    
    Query Parameters:
        days_back (int, optional): Days of historical data for analysis (default: 30)
        include_insights (bool, optional): Include AI-generated insights (default: true)
    
    Returns:
        JSON response with position analytics
    """
    try:
        days_back = int(request.args.get('days_back', 30))
        include_insights = request.args.get('include_insights', 'true').lower() == 'true'
        
        # Get position
        position = cl_service.get_position_by_id(position_id)
        if not position:
            return jsonify({
                'success': False,
                'error': 'Position not found'
            }), 404
        
        # Get current price
        latest_price_data = price_updater.price_history_model.get_latest_price(position_id)
        if not latest_price_data:
            return jsonify({
                'success': False,
                'error': 'No price data available for this position'
            }), 404
        
        current_price = latest_price_data.get('price', 0)
        
        # Calculate IL analytics
        il_analytics = il_calculator.calculate_il_analytics(position, current_price, days_back)
        
        # Get position monitoring data
        monitoring_result = position_monitor.monitor_position(
            position,
            current_price,
            {
                'price_usd': current_price,
                'volume_24h': latest_price_data.get('volume_24h', 0),
                'liquidity_usd': latest_price_data.get('liquidity_usd', 0)
            }
        )
        
        # Prepare response data
        analytics_data = {
            'position_id': position_id,
            'current_price': current_price,
            'impermanent_loss': {
                'current_il_percentage': il_analytics.current_il.il_percentage,
                'current_il_dollar': il_analytics.current_il.il_dollar_amount,
                'max_il_experienced': il_analytics.max_il_experienced,
                'min_il_experienced': il_analytics.min_il_experienced,
                'average_il': il_analytics.average_il,
                'il_vs_fees_ratio': il_analytics.il_vs_fees_ratio,
                'break_even_fee_rate': il_analytics.break_even_fee_rate,
                'days_to_break_even': il_analytics.days_to_break_even
            },
            'position_values': {
                'hodl_value': il_analytics.current_il.hodl_value,
                'lp_value': il_analytics.current_il.lp_value,
                'net_result': il_analytics.current_il.net_result,
                'fees_collected': il_analytics.current_il.fees_collected
            },
            'monitoring': {
                'health_score': monitoring_result.get('health_score', 0),
                'in_range': monitoring_result.get('in_range', False),
                'fee_velocity_apr': monitoring_result.get('fee_velocity_apr'),
                'alerts_generated': monitoring_result.get('alerts_generated', 0)
            },
            'analysis_period_days': days_back
        }
        
        # Add insights if requested
        if include_insights:
            insights = il_calculator.get_il_insights(il_analytics)
            analytics_data['insights'] = insights
        
        return jsonify({
            'success': True,
            'data': analytics_data
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid parameter format',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error retrieving analytics for position {position_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve position analytics',
            'details': str(e)
        }), 500


@cl_bp.route('/alerts', methods=['GET'])
def get_active_alerts():
    """
    Get active alerts for all positions or a specific position.
    
    Query Parameters:
        position_id (str, optional): Filter alerts by position ID
        severity (str, optional): Filter by severity (info, warning, critical)
        limit (int, optional): Maximum number of alerts (default: 50)
    
    Returns:
        JSON response with active alerts
    """
    try:
        position_id = request.args.get('position_id')
        severity = request.args.get('severity')
        limit = int(request.args.get('limit', 50))
        
        # Validate parameters
        if severity and severity not in ['info', 'warning', 'critical']:
            return jsonify({
                'success': False,
                'error': 'Invalid severity. Must be info, warning, or critical'
            }), 400
        
        if limit < 1 or limit > 200:
            return jsonify({
                'success': False,
                'error': 'Limit must be between 1 and 200'
            }), 400
        
        # Get alerts
        alerts = position_monitor.get_active_alerts(position_id)
        
        # Filter by severity if specified
        if severity:
            alerts = [alert for alert in alerts if alert.get('severity') == severity]
        
        # Apply limit
        alerts = alerts[:limit]
        
        return jsonify({
            'success': True,
            'data': {
                'alerts': alerts,
                'count': len(alerts),
                'filters': {
                    'position_id': position_id,
                    'severity': severity,
                    'limit': limit
                }
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid parameter format',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error retrieving alerts: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve alerts',
            'details': str(e)
        }), 500


@cl_bp.route('/alerts/<alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    """
    Acknowledge a specific alert.
    
    Path Parameters:
        alert_id (str): The alert ID
    
    Returns:
        JSON response confirming acknowledgment
    """
    try:
        success = position_monitor.acknowledge_alert(alert_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Alert acknowledged successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Alert not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error acknowledging alert {alert_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to acknowledge alert',
            'details': str(e)
        }), 500


@cl_bp.route('/background-tasks/status', methods=['GET'])
def get_background_tasks_status():
    """
    Get the status of background tasks and scheduler.
    
    Returns:
        JSON response with background task status
    """
    try:
        status = background_tasks.get_service_status()
        
        return jsonify({
            'success': True,
            'data': status
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving background tasks status: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve background tasks status',
            'details': str(e)
        }), 500


@cl_bp.route('/background-tasks/execute/<task_name>', methods=['POST'])
def execute_background_task(task_name):
    """
    Execute a specific background task immediately.
    
    Path Parameters:
        task_name (str): Name of the task to execute (price_update, position_monitoring, data_cleanup)
    
    Returns:
        JSON response with task execution result
    """
    try:
        result = background_tasks.execute_task_now(task_name)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': result,
                'message': f'Task {task_name} executed successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Task execution failed'),
                'available_tasks': result.get('available_tasks', [])
            }), 400
            
    except Exception as e:
        logger.error(f"Error executing background task {task_name}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to execute background task',
            'details': str(e)
        }), 500


@cl_bp.route('/background-tasks/executions', methods=['GET'])
def get_task_executions():
    """
    Get recent background task execution history.
    
    Query Parameters:
        limit (int, optional): Maximum number of executions (default: 20)
    
    Returns:
        JSON response with task execution history
    """
    try:
        limit = int(request.args.get('limit', 20))
        
        if limit < 1 or limit > 100:
            return jsonify({
                'success': False,
                'error': 'Limit must be between 1 and 100'
            }), 400
        
        executions = background_tasks.get_task_executions(limit)
        
        return jsonify({
            'success': True,
            'data': {
                'executions': executions,
                'count': len(executions)
            }
        }), 200
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid parameter format',
            'details': str(e)
        }), 400
        
    except Exception as e:
        logger.error(f"Error retrieving task executions: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve task executions',
            'details': str(e)
        }), 500


@cl_bp.route('/monitoring/stats', methods=['GET'])
def get_monitoring_stats():
    """
    Get monitoring service statistics.
    
    Returns:
        JSON response with monitoring statistics
    """
    try:
        stats = position_monitor.get_monitoring_stats()
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving monitoring stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve monitoring statistics',
            'details': str(e)
        }), 500


@cl_bp.route('/price-updater/stats', methods=['GET'])
def get_price_updater_stats():
    """
    Get price updater service statistics.
    
    Returns:
        JSON response with price updater statistics
    """
    try:
        stats = price_updater.get_update_stats()
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving price updater stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve price updater statistics',
            'details': str(e)
        }), 500


# Error handlers for the blueprint
@cl_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@cl_bp.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors."""
    return jsonify({
        'success': False,
        'error': 'Method not allowed'
    }), 405


@cl_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


# Import datetime for health check
from datetime import datetime

logger.info("CL routes blueprint initialized")