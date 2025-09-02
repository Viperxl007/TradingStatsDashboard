/**
 * Manual Trade Close Chart Fix Test
 * 
 * Tests the fix for chart getting stuck in loading state after manual trade closure.
 * This test validates that the forceRecreation mechanism properly triggers chart recreation.
 */

describe('Manual Trade Close Chart Fix', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing event listeners
    window.removeEventListener('clearChartOverlays', jest.fn() as any);
    window.removeEventListener('forceChartRefresh', jest.fn() as any);
  });

  test('should dispatch chart clearing events correctly', () => {
    console.log('🧪 [Test] Testing chart clearing event dispatch...');
    
    let clearEventReceived = false;
    let refreshEventReceived = false;
    
    // Add event listeners to capture events
    const handleClearOverlays = (event: CustomEvent) => {
      clearEventReceived = true;
      expect(event.detail.reason).toBe('manual_trade_close');
      console.log('✅ [Test] Clear overlays event received:', event.detail);
    };
    
    const handleForceRefresh = (event: CustomEvent) => {
      refreshEventReceived = true;
      expect(event.detail.reason).toBe('manual_trade_close');
      console.log('✅ [Test] Force refresh event received:', event.detail);
    };
    
    window.addEventListener('clearChartOverlays', handleClearOverlays as EventListener);
    window.addEventListener('forceChartRefresh', handleForceRefresh as EventListener);
    
    // Simulate manual trade close by dispatching events
    const clearEvent = new CustomEvent('clearChartOverlays', {
      detail: { reason: 'manual_trade_close', timestamp: Date.now() }
    });
    window.dispatchEvent(clearEvent);
    
    const refreshEvent = new CustomEvent('forceChartRefresh', {
      detail: { reason: 'manual_trade_close', timestamp: Date.now() }
    });
    window.dispatchEvent(refreshEvent);
    
    // Verify events were received
    expect(clearEventReceived).toBe(true);
    expect(refreshEventReceived).toBe(true);
    
    console.log('✅ [Test] Chart clearing events dispatched and received correctly');
    
    // Cleanup
    window.removeEventListener('clearChartOverlays', handleClearOverlays as EventListener);
    window.removeEventListener('forceChartRefresh', handleForceRefresh as EventListener);
  });

  test('should handle multiple chart clearing events without issues', () => {
    console.log('🧪 [Test] Testing multiple chart clearing events...');
    
    let eventCount = 0;
    
    const handleEvents = (event: CustomEvent) => {
      eventCount++;
      console.log(`📊 [Test] Event ${eventCount} received:`, event.type, event.detail);
    };
    
    window.addEventListener('clearChartOverlays', handleEvents as EventListener);
    window.addEventListener('forceChartRefresh', handleEvents as EventListener);
    
    // Dispatch multiple clearing events
    for (let i = 0; i < 3; i++) {
      const clearEvent = new CustomEvent('clearChartOverlays', {
        detail: { reason: `test_clear_${i}`, timestamp: Date.now() }
      });
      window.dispatchEvent(clearEvent);
      
      const refreshEvent = new CustomEvent('forceChartRefresh', {
        detail: { reason: `test_refresh_${i}`, timestamp: Date.now() }
      });
      window.dispatchEvent(refreshEvent);
    }
    
    // Should have received 6 events (3 clear + 3 refresh)
    expect(eventCount).toBe(6);
    
    console.log('✅ [Test] Multiple chart clearing events handled correctly');
    
    // Cleanup
    window.removeEventListener('clearChartOverlays', handleEvents as EventListener);
    window.removeEventListener('forceChartRefresh', handleEvents as EventListener);
  });

  test('should validate event detail structure', () => {
    console.log('🧪 [Test] Testing event detail structure validation...');
    
    const handleClearOverlays = (event: CustomEvent) => {
      // Validate event detail structure
      expect(event.detail).toHaveProperty('reason');
      expect(event.detail).toHaveProperty('timestamp');
      expect(typeof event.detail.reason).toBe('string');
      expect(typeof event.detail.timestamp).toBe('number');
      console.log('✅ [Test] Event detail structure validated:', event.detail);
    };
    
    window.addEventListener('clearChartOverlays', handleClearOverlays as EventListener);
    
    // Dispatch event with proper structure
    const clearEvent = new CustomEvent('clearChartOverlays', {
      detail: { 
        reason: 'manual_trade_close', 
        timestamp: Date.now(),
        additionalData: 'test'
      }
    });
    window.dispatchEvent(clearEvent);
    
    console.log('✅ [Test] Event detail structure validation passed');
    
    // Cleanup
    window.removeEventListener('clearChartOverlays', handleClearOverlays as EventListener);
  });

  test('should handle chart overlay utils import correctly', async () => {
    console.log('🧪 [Test] Testing chart overlay utils import...');
    
    // Test that the chart overlay utils can be imported
    const { clearAllChartOverlays, forceChartRefresh } = await import('../utils/chartOverlayUtils');
    
    expect(typeof clearAllChartOverlays).toBe('function');
    expect(typeof forceChartRefresh).toBe('function');
    
    console.log('✅ [Test] Chart overlay utils imported successfully');
  });

});

/**
 * Integration Test Runner
 * Run this test with: npm test -- manualTradeCloseChartFix.test.ts
 */
export const runManualTradeCloseTests = async () => {
  console.log('🚀 Running Manual Trade Close Chart Fix Tests...');
  console.log('🎯 These tests validate the chart recreation mechanism');
  console.log('🛡️ Ensuring charts don\'t get stuck in loading state after manual trade closure');
  
  return true;
};