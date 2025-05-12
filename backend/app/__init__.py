from flask import Flask
from flask_cors import CORS
import os
import logging
from app.utils import CustomJSONEncoder

# Set up logging
logger = logging.getLogger(__name__)

def create_app(test_config=None):
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    
    # Enable CORS
    CORS(app)
    
    # Configure Flask to properly handle JSON serialization
    app.json_encoder = CustomJSONEncoder
    
    # Set default configuration
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev'),
        DEBUG=os.environ.get('FLASK_ENV', 'development') == 'development'
    )

    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Initialize rate limiter
    try:
        from app.rate_limiter import update_rate_limiter_config
        update_rate_limiter_config()
        logger.info("Rate limiter initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize rate limiter: {str(e)}")

    # Register blueprints
    from app.routes import api_bp
    app.register_blueprint(api_bp)

    return app