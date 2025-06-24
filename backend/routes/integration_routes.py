"""
Integration API Routes for CL Position Tracking

This module provides REST API endpoints for third-party integrations including:
- Webhook endpoints for external systems
- REST API for third-party integrations
- Data synchronization with external portfolios
- Import/export APIs for position data
- Real-time data streaming endpoints
- Authentication and authorization for API access
"""

import logging
from flask import Blueprint, request, jsonify, Response, stream_template
from flask_cors import cross_origin
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import uuid
import hmac
import hashlib
import time
from functools import wraps
import jwt
from werkzeug.exceptions import BadRequest, Unauthorized, Forbidden, NotFound

# Import services
from services.cl_service import CLService
from services.alert_service import AlertService
from services.position_optimizer import PositionOptimizer
from services.advanced_analytics import AdvancedAnalytics
from services.reporting_service import ReportingService
from services.system_monitor import SystemMonitor

logger = logging.getLogger(__name__)

# Create blueprint
integration_bp = Blueprint('integration', __name__, url_prefix='/api/v1/integration')

# Initialize services
cl_service = CLService()
alert_service = AlertService()
optimizer = PositionOptimizer()
analytics = AdvancedAnalytics()
reporting_service = ReportingService()
monitor = SystemMonitor()

# Configuration (would be loaded from config file in production)
API_CONFIG = {
    'jwt_secret': 'your-jwt-secret-key',  # Should be in environment variables
    'webhook_secret': 'your-webhook-secret',  # Should be in environment variables
    'rate_limit': {
        'requests_per_minute': 100,
        'requests_per_hour': 1000
    }
}

# Rate limiting storage (would use Redis in production)
rate_limit_storage = {}


def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        
        # Validate API key (would check against database in production)
        if not _validate_api_key(api_key):
            return jsonify({'error': 'Invalid API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


def require_jwt_token(f):
    """Decorator to require JWT token authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Authorization token required'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(token, API_CONFIG['jwt_secret'], algorithms=['HS256'])
            request.user_id = payload.get('user_id')
            request.permissions = payload.get('permissions', [])
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


def rate_limit(requests_per_minute: int = 60):
    """Decorator to implement rate limiting."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.remote_addr
            current_time = time.time()
            
            # Clean old entries
            cutoff_time = current_time - 60  # 1 minute ago
            if client_ip in rate_limit_storage:
                rate_limit_storage[client_ip] = [
                    timestamp for timestamp in rate_limit_storage[client_ip]
                    if timestamp > cutoff_time
                ]
            
            # Check rate limit
            if client_ip not in rate_limit_storage:
                rate_limit_storage[client_ip] = []
            
            if len(rate_limit_storage[client_ip]) >= requests_per_minute:
                return jsonify({'error': 'Rate limit exceeded'}), 429
            
            # Add current request
            rate_limit_storage[client_ip].append(current_time)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify webhook signature."""
    expected_signature = hmac.new(
        API_CONFIG['webhook_secret'].encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected_signature}", signature)


# Authentication endpoints
@integration_bp.route('/auth/token', methods=['POST'])
@cross_origin()
@rate_limit(10)  # 10 requests per minute for auth
def generate_token():
    """Generate JWT token for API access."""
    try:
        data = request.get_json()
        
        if not data or 'api_key' not in data:
            return jsonify({'error': 'API key required'}), 400
        
        api_key = data['api_key']
        
        # Validate API key and get user info
        user_info = _get_user_info_by_api_key(api_key)
        if not user_info:
            return jsonify({'error': 'Invalid API key'}), 401
        
        # Generate JWT token
        payload = {
            'user_id': user_info['user_id'],
            'permissions': user_info['permissions'],
            'exp': datetime.utcnow() + timedelta(hours=24),
            'iat': datetime.utcnow()
        }
        
        token = jwt.encode(payload, API_CONFIG['jwt_secret'], algorithm='HS256')
        
        return jsonify({
            'token': token,
            'expires_in': 86400,  # 24 hours
            'token_type': 'Bearer'
        })
        
    except Exception as e:
        logger.error(f"Error generating token: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


# Position data endpoints
@integration_bp.route('/positions', methods=['GET'])
@cross_origin()
@require_jwt_token
@rate_limit()
def get_positions():
    """Get positions with filtering and pagination."""
    try:
        # Parse query parameters
        status = request.args.get('status')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int, default=0)
        include_calculations = request.args.get('include_calculations', 'true').lower() == 'true'
        
        # Get positions
        positions = cl_service.get_positions(status=status, include_calculations=include_calculations)
        
        # Apply pagination
        if limit:
            positions = positions[offset:offset + limit]
        
        return jsonify({
            'positions': positions,
            'total_count': len(positions),
            'offset': offset,
            'limit': limit
        })
        
    except Exception as e:
        logger.error(f"Error getting positions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@integration_bp.route('/positions', methods=['POST'])
@cross_origin()
@require_jwt_token
@rate_limit(30)  # 30 positions per minute
def create_position():
    """Create a new position."""
    try:
        if 'write' not in request.permissions:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Position data required'}), 400
        
        # Create position
        position = cl_service.create_position(data)
        
        return jsonify({
            'message': 'Position created successfully',
            'position': position
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating position: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@integration_bp.route('/positions/<position_id>', methods=['PUT'])
@cross_origin()
@require_jwt_token
@rate_limit(60)
def update_position(position_id: str):
    """Update an existing position."""
    try:
        if 'write' not in request.permissions:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Update data required'}), 400
        
        # Update position
        position = cl_service.update_position(position_id, data)
        
        if not position:
            return jsonify({'error': 'Position not found'}), 404
        
        return jsonify({
            'message': 'Position updated successfully',
            'position': position
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating position: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@integration_bp.route('/positions/bulk', methods=['POST'])
@cross_origin()
@require_jwt_token
@rate_limit(10)  # 10 bulk operations per minute
def bulk_import_positions():
    """Bulk import positions."""
    try:
        if 'write' not in request.permissions:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data or 'positions' not in data:
            return jsonify({'error': 'Positions array required'}), 400
        
        positions = data['positions']
        if not isinstance(positions, list):
            return jsonify({'error': 'Positions must be an array'}), 400
        
        results = []
        errors = []
        
        for i, position_data in enumerate(positions):
            try:
                position = cl_service.create_position(position_data)
                results.append({
                    'index': i,
                    'status': 'success',
                    'position_id': position['id']
                })
            except Exception as e:
                errors.append({
                    'index': i,
                    'status': 'error',
                    'error': str(e)
                })
        
        return jsonify({
            'message': f'Bulk import completed: {len(results)} successful, {len(errors)} failed',
            'results': results,
            'errors': errors
        })
        
    except Exception as e:
        logger.error(f"Error in bulk import: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


# Portfolio analytics endpoints
@integration_bp.route('/analytics/portfolio', methods=['GET'])
@cross_origin()
@require_jwt_token
@rate_limit()
def get_portfolio_analytics():
    """Get portfolio analytics and metrics."""
    try:
        # Get portfolio summary
        summary = cl_service.get_portfolio_summary()
        
        # Get positions for detailed analytics
        positions = cl_service.get_positions(include_calculations=True)
        
        # Calculate advanced metrics
        portfolio_metrics = optimizer.calculate_portfolio_metrics(positions)
        
        return jsonify({
            'summary': summary,
            'metrics': {
                'total_value': portfolio_metrics.total_value,
                'total_fees': portfolio_metrics.total_fees,
                'total_il': portfolio_metrics.total_il,
                'sharpe_ratio': portfolio_metrics.sharpe_ratio,
                'max_drawdown': portfolio_metrics.max_drawdown,
                'var_95': portfolio_metrics.var_95,
                'diversification_ratio': portfolio_metrics.diversification_ratio
            },
            'correlation_matrix': portfolio_metrics.correlation_matrix,
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting portfolio analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@integration_bp.route('/analytics/optimization', methods=['GET'])
@cross_origin()
@require_jwt_token
@rate_limit()
def get_optimization_suggestions():
    """Get optimization suggestions."""
    try:
        position_id = request.args.get('position_id')
        optimization_type = request.args.get('type')
        
        suggestions = optimizer.get_optimization_suggestions(
            position_id=position_id,
            optimization_type=optimization_type
        )
        
        return jsonify({
            'suggestions': suggestions,
            'count': len(suggestions)
        })
        
    except Exception as e:
        logger.error(f"Error getting optimization suggestions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


# Webhook endpoints
@integration_bp.route('/webhooks/price-update', methods=['POST'])
@cross_origin()
@rate_limit(1000)  # High rate limit for price updates
def price_update_webhook():
    """Webhook endpoint for price updates from external sources."""
    try:
        # Verify webhook signature
        signature = request.headers.get('X-Signature-256')
        if not signature:
            return jsonify({'error': 'Signature required'}), 401
        
        payload = request.get_data()
        if not verify_webhook_signature(payload, signature):
            return jsonify({'error': 'Invalid signature'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Price data required'}), 400
        
        # Process price update
        pair_symbol = data.get('pair_symbol')
        price = data.get('price')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not pair_symbol or not price:
            return jsonify({'error': 'pair_symbol and price required'}), 400
        
        # Update price history (would integrate with price history service)
        logger.info(f"Received price update: {pair_symbol} = {price}")
        
        # Trigger any necessary alerts or rebalancing checks
        # This would integrate with the alert service and optimizer
        
        return jsonify({'message': 'Price update processed successfully'})
        
    except Exception as e:
        logger.error(f"Error processing price update webhook: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@integration_bp.route('/webhooks/position-event', methods=['POST'])
@cross_origin()
@rate_limit(100)
def position_event_webhook():
    """Webhook endpoint for position events from external systems."""
    try:
        # Verify webhook signature
        signature = request.headers.get('X-Signature-256')
        if signature:
            payload = request.get_data()
            if not verify_webhook_signature(payload, signature):
                return jsonify({'error': 'Invalid signature'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Event data required'}), 400
        
        event_type = data.get('event_type')
        position_id = data.get('position_id')
        event_data = data.get('data', {})
        
        if not event_type or not position_id:
            return jsonify({'error': 'event_type and position_id required'}), 400
        
        # Process different event types
        if event_type == 'fee_collected':
            # Update fee collection
            fee_amount = event_data.get('amount')
            if fee_amount:
                cl_service.update_position_fees(position_id, {
                    'fees_amount': fee_amount,
                    'update_date': datetime.now().isoformat()
                })
        
        elif event_type == 'position_closed':
            # Close position
            cl_service.close_position(position_id, event_data)
        
        elif event_type == 'rebalance':
            # Handle rebalancing event
            logger.info(f"Rebalance event for position {position_id}")
        
        return jsonify({'message': f'Event {event_type} processed successfully'})
        
    except Exception as e:
        logger.error(f"Error processing position event webhook: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


# Data export endpoints
@integration_bp.route('/export/positions', methods=['GET'])
@cross_origin()
@require_jwt_token
@rate_limit(10)  # 10 exports per minute
def export_positions():
    """Export positions in various formats."""
    try:
        export_format = request.args.get('format', 'json').lower()
        status = request.args.get('status')
        
        # Get positions
        positions = cl_service.get_positions(status=status, include_calculations=True)
        
        if export_format == 'csv':
            csv_content = reporting_service.export_positions_csv(positions)
            return Response(
                csv_content,
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=positions.csv'}
            )
        
        elif export_format == 'excel':
            portfolio_metrics = cl_service.get_portfolio_summary()
            excel_content = reporting_service.generate_portfolio_summary_excel(positions, portfolio_metrics)
            return Response(
                excel_content,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers={'Content-Disposition': 'attachment; filename=portfolio_summary.xlsx'}
            )
        
        elif export_format == 'json':
            return jsonify({
                'positions': positions,
                'exported_at': datetime.now().isoformat(),
                'count': len(positions)
            })
        
        else:
            return jsonify({'error': 'Unsupported export format'}), 400
        
    except Exception as e:
        logger.error(f"Error exporting positions: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@integration_bp.route('/export/reports/<report_type>', methods=['GET'])
@cross_origin()
@require_jwt_token
@rate_limit(5)  # 5 reports per minute
def export_report(report_type: str):
    """Export various types of reports."""
    try:
        export_format = request.args.get('format', 'pdf').lower()
        
        if report_type == 'portfolio':
            positions = cl_service.get_positions(include_calculations=True)
            portfolio_metrics = cl_service.get_portfolio_summary()
            
            if export_format == 'pdf':
                pdf_content = reporting_service.generate_portfolio_summary_pdf(positions, portfolio_metrics)
                return Response(
                    pdf_content,
                    mimetype='application/pdf',
                    headers={'Content-Disposition': 'attachment; filename=portfolio_report.pdf'}
                )
            elif export_format == 'excel':
                excel_content = reporting_service.generate_portfolio_summary_excel(positions, portfolio_metrics)
                return Response(
                    excel_content,
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': 'attachment; filename=portfolio_report.xlsx'}
                )
        
        elif report_type == 'tax':
            tax_year = request.args.get('year', type=int, default=datetime.now().year)
            positions = cl_service.get_positions(include_calculations=True)
            tax_report = reporting_service.generate_tax_report(positions, tax_year)
            
            return jsonify(tax_report)
        
        else:
            return jsonify({'error': 'Unsupported report type'}), 400
        
    except Exception as e:
        logger.error(f"Error exporting report: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


# Real-time streaming endpoints
@integration_bp.route('/stream/metrics')
@cross_origin()
@require_jwt_token
def stream_metrics():
    """Stream real-time system metrics."""
    def generate_metrics():
        while True:
            try:
                metrics = monitor.get_current_metrics()
                health = monitor.get_health_status()
                
                data = {
                    'timestamp': datetime.now().isoformat(),
                    'metrics': metrics,
                    'health': health
                }
                
                yield f"data: {json.dumps(data)}\n\n"
                time.sleep(5)  # Update every 5 seconds
                
            except Exception as e:
                logger.error(f"Error streaming metrics: {str(e)}")
                break
    
    return Response(
        generate_metrics(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    )


# System status endpoints
@integration_bp.route('/status', methods=['GET'])
@cross_origin()
@rate_limit(120)  # 120 requests per minute for status checks
def get_system_status():
    """Get system status and health information."""
    try:
        health_status = monitor.get_health_status()
        current_metrics = monitor.get_current_metrics()
        active_alerts = monitor.get_active_alerts()
        
        return jsonify({
            'status': 'operational',
            'health': health_status,
            'metrics': current_metrics,
            'active_alerts': len(active_alerts),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': 'Unable to retrieve system status',
            'timestamp': datetime.now().isoformat()
        }), 500


# Helper functions
def _validate_api_key(api_key: str) -> bool:
    """Validate API key (placeholder implementation)."""
    # In production, this would check against a database
    valid_keys = ['demo-api-key-123', 'test-api-key-456']
    return api_key in valid_keys


def _get_user_info_by_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """Get user information by API key (placeholder implementation)."""
    # In production, this would query a database
    user_data = {
        'demo-api-key-123': {
            'user_id': 'demo-user',
            'permissions': ['read', 'write']
        },
        'test-api-key-456': {
            'user_id': 'test-user',
            'permissions': ['read']
        }
    }
    
    return user_data.get(api_key)


# Error handlers
@integration_bp.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request'}), 400


@integration_bp.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized'}), 401


@integration_bp.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden'}), 403


@integration_bp.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@integration_bp.errorhandler(429)
def rate_limit_exceeded(error):
    return jsonify({'error': 'Rate limit exceeded'}), 429


@integration_bp.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500