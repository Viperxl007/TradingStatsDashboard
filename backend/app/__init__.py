from flask import Flask
from flask_cors import CORS
import os
import logging
import sys
from dotenv import load_dotenv
from app.utils import CustomJSONEncoder

# Load environment variables from .env file
load_dotenv()

# Configure enhanced logging (merged from run_direct.py)
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG to see detailed logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Set up logging
logger = logging.getLogger(__name__)

# Suppress excessive debug logging from external libraries
logging.getLogger('yfinance').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('peewee').setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)

# Import configuration
try:
    from config import YF_RATE_LIMIT, SEQUENTIAL_PROCESSING, QUICK_FILTER
    logger.info("Loaded configuration from config.py")
except ImportError:
    # Default configuration if config.py is not found
    logger.warning("config.py not found, using default configuration")
    YF_RATE_LIMIT = {"rate": 5, "per": 1.0, "burst": 10}
    SEQUENTIAL_PROCESSING = {
        "api_calls_per_ticker": 8,
        "requests_per_minute": 60,
        "max_consecutive_requests": 10,
        "pause_duration": 2.0
    }
    QUICK_FILTER = {"min_price": 2.50, "min_volume": 1500000}

# Import earnings history functionality
try:
    from run_direct_earnings_history import register_earnings_history_endpoint
    logger.info("Loaded earnings history module")
except ImportError:
    logger.warning("run_direct_earnings_history.py not found, earnings history endpoint will not be available")
    register_earnings_history_endpoint = None

def create_app(test_config=None):
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    
    # Enable CORS with enhanced settings (merged from run_direct.py)
    CORS(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})
    
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
        
    # Initialize market data provider and log which API is being used
    try:
        from app.market_data import market_data
        logger.warning(f"Initialized market data provider: {market_data.__class__.__name__}")
    except Exception as e:
        logger.error(f"Failed to initialize market data provider: {str(e)}")

    # Register earnings history endpoint if available
    if register_earnings_history_endpoint:
        try:
            register_earnings_history_endpoint(app)
            logger.info("Registered earnings history endpoint")
        except Exception as e:
            logger.error(f"Failed to register earnings history endpoint: {str(e)}")

    # Register blueprints
    from app.routes import api_bp
    app.register_blueprint(api_bp)
    
    # Register unified calendar endpoint
    try:
        from app.unified_calendar_endpoint import unified_calendar_bp
        app.register_blueprint(unified_calendar_bp)
        logger.info("Registered unified calendar endpoint")
    except Exception as e:
        logger.error(f"Failed to register unified calendar endpoint: {str(e)}")
    
    # Register market data routes
    try:
        from app.market_data_routes import market_data_bp
        app.register_blueprint(market_data_bp)
        logger.info("Registered market data routes")
    except Exception as e:
        logger.error(f"Failed to register market data routes: {str(e)}")
    
    # Register concentrated liquidity routes
    try:
        from routes.cl_routes import cl_bp
        app.register_blueprint(cl_bp)
        logger.info("Registered concentrated liquidity routes")
    except Exception as e:
        logger.error(f"Failed to register concentrated liquidity routes: {str(e)}")
    
    # Register Hyperliquid routes
    try:
        # Add the backend directory to the path
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        
        from routes.hyperliquid_routes import register_hyperliquid_routes
        register_hyperliquid_routes(app)
        logger.info("Registered Hyperliquid routes")
    except Exception as e:
        logger.error(f"Failed to register Hyperliquid routes: {str(e)}")
    
    # Initialize Hyperliquid scheduler
    try:
        from services.hyperliquid_scheduler import auto_start_scheduler
        auto_start_scheduler()
        logger.info("Hyperliquid scheduler initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Hyperliquid scheduler: {str(e)}")

    return app