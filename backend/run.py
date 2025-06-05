"""
Run Module

This is the entry point for the Flask application.
Merged from run_direct.py to provide unified Flask app flow.
"""

import os
import sys
import importlib.util
import logging
from app import create_app
from app.rate_limiter import update_rate_limiter_config

# Check for required packages
required_packages = ['flask', 'flask_cors', 'yfinance', 'numpy', 'scipy', 'finance_calendars', 'pandas']
missing_packages = []

for package in required_packages:
    if importlib.util.find_spec(package) is None:
        missing_packages.append(package)

if missing_packages:
    print(f"Missing required packages: {', '.join(missing_packages)}")
    print("Please install them using:")
    print(f"python -m pip install --user {' '.join(missing_packages)}")
    sys.exit(1)

# Configure logging (enhanced from run_direct.py)
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG to see detailed logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Suppress excessive debug logging from external libraries
logging.getLogger('yfinance').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('peewee').setLevel(logging.WARNING)
logging.getLogger('werkzeug').setLevel(logging.WARNING)

# Create app
app = create_app()

if __name__ == '__main__':
    # Update rate limiter configuration
    update_rate_limiter_config()
    
    # Get port from environment variable or use default
    port = int(os.environ.get('PORT', 5000))
    
    # Run app with more stable socket handling (merged from run_direct.py)
    # Disable auto-reloader to prevent server restarts during scans
    # while keeping debug mode for better error reporting
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False, threaded=True)