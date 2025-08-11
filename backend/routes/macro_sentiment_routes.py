"""
Macro Market Sentiment API Routes

This module defines the API routes for the macro market sentiment system,
following existing patterns from the main routes module.
"""

from flask import Blueprint, jsonify, request
import logging
import asyncio
import traceback
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Import services
try:
    from ..services.macro_bootstrap_service import MacroBootstrapService, run_bootstrap, check_bootstrap_status
    from ..services.macro_scanner_service import get_scanner, get_scanner_status, trigger_manual_scan
    from ..services.macro_ai_service import MacroAIService, get_latest_macro_sentiment, trigger_macro_analysis
    from ..services.macro_chart_service import MacroChartService, get_chart_summary
    from ..models.macro_sentiment_models import get_macro_db
except ImportError:
    # Fallback for when running from root directory
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from services.macro_bootstrap_service import MacroBootstrapService, run_bootstrap, check_bootstrap_status
    from services.macro_scanner_service import get_scanner, get_scanner_status, trigger_manual_scan
    from services.macro_ai_service import MacroAIService, get_latest_macro_sentiment, trigger_macro_analysis
    from services.macro_chart_service import MacroChartService, get_chart_summary
    from models.macro_sentiment_models import get_macro_db

logger = logging.getLogger(__name__)

# Create blueprint
macro_sentiment_bp = Blueprint('macro_sentiment', __name__, url_prefix='/api/macro-sentiment')


@macro_sentiment_bp.route('/status', methods=['GET'])
def get_macro_sentiment_status():
    """
    Get current macro sentiment analysis and system status.
    
    Returns:
        JSON response with latest sentiment data and system health
    """
    try:
        logger.info("Macro sentiment status endpoint called")
        
        # Get latest sentiment analysis
        latest_sentiment = get_latest_macro_sentiment()
        
        # Get system status
        scanner_status = get_scanner_status()
        
        # Get bootstrap status
        bootstrap_status = asyncio.run(check_bootstrap_status())
        
        # Calculate next update time
        next_update = None
        if scanner_status.get('next_scan_timestamp'):
            next_update = datetime.fromtimestamp(scanner_status['next_scan_timestamp']).isoformat()
        
        response_data = {
            'sentiment': latest_sentiment,
            'system_status': {
                'scanner': scanner_status,
                'bootstrap': bootstrap_status,
                'next_update': next_update
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in macro sentiment status endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/history', methods=['GET'])
def get_macro_sentiment_history():
    """
    Get historical macro sentiment analysis data.
    
    Query Parameters:
        days (int): Number of days of history (default: 7, max: 30)
    
    Returns:
        JSON response with historical sentiment data
    """
    try:
        # Get query parameters
        days = request.args.get('days', 7, type=int)
        days = min(max(days, 1), 30)  # Clamp between 1 and 30 days
        
        logger.info(f"Macro sentiment history endpoint called for {days} days")
        
        # Get confidence history
        db = get_macro_db()
        history = db.get_confidence_history(days)
        
        # Format response
        response_data = {
            'history': history,
            'days_requested': days,
            'data_points': len(history),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in macro sentiment history endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/bootstrap', methods=['POST'])
def trigger_bootstrap():
    """
    Trigger bootstrap process to collect historical data.
    
    Request Body:
        force (bool): Force bootstrap even if already completed
    
    Returns:
        JSON response with bootstrap results
    """
    try:
        # Get request data
        data = request.get_json() or {}
        force = data.get('force', False)
        
        logger.info(f"Bootstrap endpoint called (force: {force})")
        
        # Progress tracking
        progress_messages = []
        
        def progress_callback(message: str, progress: Optional[float] = None):
            progress_messages.append({
                'message': message,
                'progress': progress,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
        
        # Run bootstrap
        result = asyncio.run(run_bootstrap(force=force, progress_callback=progress_callback))
        
        # Add progress messages to result
        result['progress_log'] = progress_messages
        result['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            'success': result['success'],
            'data': result
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in bootstrap endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/scan', methods=['POST'])
def manual_scan_endpoint():
    """
    Trigger manual scan for testing and immediate updates.
    
    Returns:
        JSON response with scan results
    """
    try:
        logger.info("Manual scan endpoint called")
        
        # Trigger manual scan using the imported service function
        result = asyncio.run(trigger_manual_scan())
        result['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            'success': result['success'],
            'data': result
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in manual scan endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/analyze', methods=['POST'])
def trigger_analysis():
    """
    Trigger manual AI analysis.
    
    Request Body:
        model (str): Claude model to use (optional)
        days (int): Days of data to analyze (default: 30)
    
    Returns:
        JSON response with analysis results
    """
    try:
        # Get request data
        data = request.get_json() or {}
        model = data.get('model')
        days = data.get('days', 90)
        days = min(max(days, 7), 90)  # Clamp between 7 and 90 days
        
        logger.info(f"Manual analysis endpoint called (model: {model}, days: {days})")
        
        # Trigger analysis
        result = asyncio.run(trigger_macro_analysis(model=model, days=days))
        result['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in analysis endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/system-health', methods=['GET'])
def get_system_health():
    """
    Get comprehensive system health information.
    
    Returns:
        JSON response with system health metrics
    """
    try:
        logger.info("System health endpoint called")
        
        # Get system state
        db = get_macro_db()
        system_state = db.get_system_state()
        
        # Get scanner status
        scanner_status = get_scanner_status()
        
        # Get bootstrap status
        bootstrap_status = asyncio.run(check_bootstrap_status())
        
        # Get recent data quality
        recent_data = db.get_market_data_range(
            int(datetime.now(timezone.utc).timestamp()) - (24 * 60 * 60),  # Last 24 hours
            int(datetime.now(timezone.utc).timestamp())
        )
        
        avg_quality = 0
        if recent_data:
            avg_quality = sum(point.get('data_quality_score', 0) for point in recent_data) / len(recent_data)
        
        # Calculate health score
        health_score = 1.0
        health_issues = []
        
        if not bootstrap_status.get('completed', False):
            health_score -= 0.5
            health_issues.append("Bootstrap not completed")
        
        if not scanner_status.get('is_running', False):
            health_score -= 0.3
            health_issues.append("Scanner not running")
        
        if scanner_status.get('consecutive_failures', 0) > 0:
            health_score -= 0.2
            health_issues.append(f"Recent scan failures: {scanner_status['consecutive_failures']}")
        
        if avg_quality < 0.8:
            health_score -= 0.1
            health_issues.append(f"Low data quality: {avg_quality:.2f}")
        
        health_score = max(0.0, health_score)
        
        response_data = {
            'health_score': health_score,
            'health_status': 'HEALTHY' if health_score > 0.8 else 'WARNING' if health_score > 0.5 else 'CRITICAL',
            'health_issues': health_issues,
            'system_state': system_state,
            'scanner_status': scanner_status,
            'bootstrap_status': bootstrap_status,
            'data_quality': {
                'recent_points': len(recent_data),
                'average_quality': avg_quality
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in system health endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/charts/summary', methods=['GET'])
def get_chart_summary():
    """
    Get chart data summary for the specified period.
    
    Query Parameters:
        days (int): Number of days (default: 30, max: 90)
    
    Returns:
        JSON response with chart summary data
    """
    try:
        # Get query parameters
        days = request.args.get('days', 90, type=int)
        days = min(max(days, 7), 90)  # Clamp between 7 and 90 days
        
        logger.info(f"Chart summary endpoint called for {days} days")
        
        # Get chart summary
        summary = get_chart_summary(days)
        summary['timestamp'] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            'success': True,
            'data': summary
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in chart summary endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/scanner/start', methods=['POST'])
def start_scanner():
    """
    Start the macro scanner service.
    
    Returns:
        JSON response with start result
    """
    try:
        logger.info("Scanner start endpoint called")
        
        scanner = get_scanner()
        success = scanner.start()
        
        response_data = {
            'started': success,
            'status': scanner.get_status(),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': success,
            'data': response_data
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in scanner start endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@macro_sentiment_bp.route('/scanner/stop', methods=['POST'])
def stop_scanner():
    """
    Stop the macro scanner service.
    
    Returns:
        JSON response with stop result
    """
    try:
        logger.info("Scanner stop endpoint called")
        
        scanner = get_scanner()
        scanner.stop()
        
        response_data = {
            'stopped': True,
            'status': scanner.get_status(),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': response_data
        })
        
    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in scanner stop endpoint: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


# Error handlers
@macro_sentiment_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 404


@macro_sentiment_bp.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors"""
    return jsonify({
        'success': False,
        'error': 'Method not allowed',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 405


@macro_sentiment_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 500


# Health check endpoint
@macro_sentiment_bp.route('/ping', methods=['GET'])
def ping():
    """Simple health check endpoint"""
    return jsonify({
        'success': True,
        'message': 'Macro sentiment API is running',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })


# Register blueprint function for main app
def register_macro_sentiment_routes(app):
    """
    Register macro sentiment routes with the Flask app.
    
    Args:
        app: Flask application instance
    """
    try:
        app.register_blueprint(macro_sentiment_bp)
        logger.info("Macro sentiment routes registered successfully")
    except Exception as e:
        logger.error(f"Failed to register macro sentiment routes: {e}")
        raise


# Example usage for testing
if __name__ == "__main__":
    from flask import Flask
    
    # Create test app
    app = Flask(__name__)
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Register routes
    register_macro_sentiment_routes(app)
    
    # List registered routes
    print("Registered macro sentiment routes:")
    for rule in app.url_map.iter_rules():
        if rule.endpoint.startswith('macro_sentiment'):
            print(f"  {rule.methods} {rule.rule} -> {rule.endpoint}")
    
    print("🎉 Macro sentiment routes ready for testing!")