"""
Test script for logging configuration.

This script tests the logging configuration changes to verify that:
1. Naked options debug messages are filtered except for start and end messages
2. Warnings about prev_close and next_close being Series are suppressed
"""

import sys
import os
import logging
import numpy as np

# Add app directory to path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Custom filter for naked options debug messages
class NakedOptionsFilter(logging.Filter):
    def filter(self, record):
        # Allow only start and end messages for naked options
        if "NAKED OPTIONS DEBUG:" in record.getMessage():
            msg = record.getMessage()
            return "Starting search for" in msg or "Returning naked options result" in msg
        return True

# Custom filter for earnings history warnings
class EarningsHistoryFilter(logging.Filter):
    def filter(self, record):
        # Filter out specific warnings about prev_close and next_close being Series
        if record.levelname == "WARNING" and "is a Series for" in record.getMessage():
            return False
        return True

# Apply filters to specific loggers
options_analyzer_logger = logging.getLogger('app.options_analyzer')
options_analyzer_logger.addFilter(NakedOptionsFilter())

earnings_history_logger = logging.getLogger('run_direct_earnings_history')
earnings_history_logger.addFilter(EarningsHistoryFilter())

def test_naked_options_logging():
    """Test naked options logging filter."""
    logger.info("Testing naked options logging filter...")
    
    # Create a logger that simulates the options_analyzer logger
    test_logger = logging.getLogger('app.options_analyzer')
    
    # Log messages that should be filtered
    test_logger.debug("NAKED OPTIONS DEBUG: Starting search for AAPL")
    test_logger.debug("NAKED OPTIONS DEBUG: Found options chain for AAPL")
    test_logger.debug("NAKED OPTIONS DEBUG: Processing options for AAPL")
    test_logger.debug("NAKED OPTIONS DEBUG: Returning naked options result with 3 options")
    
    logger.info("Naked options logging test complete. Check the output to verify only start and end messages are shown.")

def test_earnings_history_logging():
    """Test earnings history logging filter."""
    logger.info("Testing earnings history logging filter...")
    
    # Create a logger that simulates the run_direct_earnings_history logger
    test_logger = logging.getLogger('run_direct_earnings_history')
    
    # Log messages that should be filtered
    test_logger.warning("prev_close is a Series for 2019-03-28, using first value")
    test_logger.warning("next_close is a Series for 2019-03-28, using first value")
    test_logger.warning("This is a regular warning that should not be filtered")
    
    logger.info("Earnings history logging test complete. Check the output to verify Series warnings are filtered.")

def test_json_serialization():
    """Test JSON serialization of NaN values."""
    logger.info("Testing JSON serialization of NaN values...")
    
    # Import the CustomJSONEncoder and convert_numpy_types
    from app.utils import CustomJSONEncoder, convert_numpy_types
    import json
    
    # Create a test object with NaN values
    test_obj = {
        "breakEven": float('nan'),
        "value": 42.0,
        "numpy_nan": np.nan,
        "nested": {
            "nan_value": float('nan')
        }
    }
    
    # Convert NumPy types
    converted_obj = convert_numpy_types(test_obj)
    
    # Serialize to JSON
    try:
        json_str = json.dumps(converted_obj, cls=CustomJSONEncoder)
        logger.info(f"JSON serialization successful: {json_str}")
    except Exception as e:
        logger.error(f"JSON serialization failed: {str(e)}")
    
    logger.info("JSON serialization test complete.")

if __name__ == "__main__":
    logger.info("Starting logging tests...")
    
    test_naked_options_logging()
    test_earnings_history_logging()
    test_json_serialization()
    
    logger.info("All tests completed.")