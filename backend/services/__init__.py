"""
Services package for the trading dashboard.

This package contains all service layer modules including:
- CL Position management services
- DexScreener API integration
- Price monitoring and updates
- Position monitoring and alerts
- Impermanent loss calculations
- Background task management
"""

# Import Phase 1 services
try:
    from .cl_service import CLService
except ImportError:
    CLService = None

# Import Phase 2 services
try:
    from .dexscreener_service import DexScreenerService
except ImportError:
    DexScreenerService = None

try:
    from .price_updater import PriceUpdateService
except ImportError:
    PriceUpdateService = None

try:
    from .position_monitor import PositionMonitorService
except ImportError:
    PositionMonitorService = None

try:
    from .il_calculator import ILCalculatorService
except ImportError:
    ILCalculatorService = None

try:
    from .background_tasks import BackgroundTaskService
except ImportError:
    BackgroundTaskService = None

# Export all available services
__all__ = [
    'CLService',
    'DexScreenerService',
    'PriceUpdateService',
    'PositionMonitorService',
    'ILCalculatorService',
    'BackgroundTaskService'
]

# Service availability check
def get_available_services():
    """
    Get a list of available services.
    
    Returns:
        dict: Dictionary of service names and their availability
    """
    return {
        'CLService': CLService is not None,
        'DexScreenerService': DexScreenerService is not None,
        'PriceUpdateService': PriceUpdateService is not None,
        'PositionMonitorService': PositionMonitorService is not None,
        'ILCalculatorService': ILCalculatorService is not None,
        'BackgroundTaskService': BackgroundTaskService is not None
    }