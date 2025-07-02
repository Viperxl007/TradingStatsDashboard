/**
 * Chart Overlay Utilities
 *
 * Utilities for managing chart overlays, especially for clearing them
 * when trades are closed to prevent contaminating AI analysis screenshots.
 */

export {};

/**
 * Clear all chart overlays by triggering a global chart refresh
 * This is used when a trade is closed to ensure clean screenshots for AI analysis
 */
export const clearAllChartOverlays = async (): Promise<void> => {
  try {
    console.log('🧹 [ChartOverlayUtils] Clearing all chart overlays...');
    
    // Dispatch a custom event that overlay components can listen to
    const clearEvent = new CustomEvent('clearChartOverlays', {
      detail: { reason: 'trade_closure', timestamp: Date.now() }
    });
    
    window.dispatchEvent(clearEvent);
    
    // Wait a moment for overlays to clear
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('✅ [ChartOverlayUtils] Chart overlays cleared');
  } catch (error) {
    console.error('❌ [ChartOverlayUtils] Error clearing chart overlays:', error);
  }
};

/**
 * Force refresh chart to ensure clean state
 * This can be used as a more aggressive clearing method
 */
export const forceChartRefresh = async (): Promise<void> => {
  try {
    console.log('🔄 [ChartOverlayUtils] Forcing chart refresh...');
    
    // Dispatch a custom event for chart refresh
    const refreshEvent = new CustomEvent('forceChartRefresh', {
      detail: { reason: 'trade_closure', timestamp: Date.now() }
    });
    
    window.dispatchEvent(refreshEvent);
    
    // Wait for refresh to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('✅ [ChartOverlayUtils] Chart refresh completed');
  } catch (error) {
    console.error('❌ [ChartOverlayUtils] Error refreshing chart:', error);
  }
};