"""
Utility Module

This module contains utility functions and classes used throughout the application.
"""

import json
import numpy as np

class CustomJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles NumPy types and other special types.
    
    This encoder ensures that all data types are properly serialized to JSON,
    including NumPy types which are not natively supported by the default
    JSON encoder.
    """
    def default(self, obj):
        if isinstance(obj, bool):
            return str(obj).lower()  # Convert True/False to "true"/"false"
        elif isinstance(obj, np.integer):
            return int(obj)  # Convert numpy integers to Python int
        elif isinstance(obj, np.floating):
            # Handle NaN values by converting them to 0 instead of None
            # This ensures toFixed() calls in the frontend won't fail
            if np.isnan(obj):
                return 0.0
            return float(obj)  # Convert numpy floats to Python float
        elif isinstance(obj, np.ndarray):
            return obj.tolist()  # Convert numpy arrays to lists
        elif isinstance(obj, np.bool_):
            return bool(obj)  # Convert numpy booleans to Python bool
        # Handle Python float NaN values
        elif isinstance(obj, float) and np.isnan(obj):
            return 0.0  # Return 0.0 instead of None
        return super().default(obj)

def convert_numpy_types(obj):
    """
    Convert NumPy types to Python native types for JSON serialization.
    
    Args:
        obj: Any Python object that might contain NumPy types
        
    Returns:
        The same object with NumPy types converted to Python native types
    """
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, np.bool_):
        return str(bool(obj)).lower()  # Convert NumPy boolean to string "true" or "false"
    elif isinstance(obj, bool):
        return str(obj).lower()  # Convert Python boolean to string "true" or "false"
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        # Handle NaN values by converting them to 0.0 instead of None
        if np.isnan(obj):
            return 0.0
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return [convert_numpy_types(item) for item in obj.tolist()]
    # Handle Python float NaN values
    elif isinstance(obj, float) and np.isnan(obj):
        return 0.0  # Return 0.0 instead of None
    else:
        return obj