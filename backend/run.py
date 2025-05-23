"""
Run Module

This is the entry point for the Flask application.
"""

import os
from app import create_app
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed from INFO to DEBUG to capture all debug logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Create app
app = create_app()

if __name__ == '__main__':
    # Get port from environment variable or use default
    port = int(os.environ.get('PORT', 5000))
    
    # Run app
    # Disable auto-reloader to prevent server restarts during scans
    # while keeping debug mode for better error reporting
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)