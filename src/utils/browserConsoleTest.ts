/**
 * Browser Console Test for Backend-Only Architecture
 * 
 * Simple console utilities for testing the new backend-only AI Trade system.
 * Run in browser console (F12) to test functionality.
 */

import { aiTradeService } from '../services/aiTradeService';

// Make test functions available globally for browser console
declare global {
  interface Window {
    testAITradeService: () => Promise<void>;
    getAllAITrades: () => Promise<any>;
    getAITradeStats: () => Promise<any>;
  }
}

/**
 * Test the AI Trade Service functionality
 */
async function testAITradeService(): Promise<void> {
  console.log('🧪 Testing AI Trade Service (Backend-Only)...');
  
  try {
    await aiTradeService.init();
    console.log('✅ Service initialized');
    
    const trades = await aiTradeService.getAllTrades();
    console.log(`📊 Found ${trades.length} trades`);
    
    const stats = await aiTradeService.calculateStatistics();
    console.log('📈 Statistics:', stats);
    
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Get all AI trades
 */
async function getAllAITrades(): Promise<any> {
  try {
    await aiTradeService.init();
    const trades = await aiTradeService.getAllTrades();
    console.log(`📊 Retrieved ${trades.length} AI trades:`, trades);
    return trades;
  } catch (error) {
    console.error('❌ Failed to get trades:', error);
    return [];
  }
}

/**
 * Get AI trade statistics
 */
async function getAITradeStats(): Promise<any> {
  try {
    await aiTradeService.init();
    const stats = await aiTradeService.calculateStatistics();
    console.log('📈 AI Trade Statistics:', stats);
    return stats;
  } catch (error) {
    console.error('❌ Failed to get statistics:', error);
    return null;
  }
}

// Export functions for global access
export function initializeBrowserConsoleTest(): void {
  if (typeof window !== 'undefined') {
    window.testAITradeService = testAITradeService;
    window.getAllAITrades = getAllAITrades;
    window.getAITradeStats = getAITradeStats;
    
    console.log('🔧 AI Trade Console Test Functions Available:');
    console.log('  - testAITradeService() - Test backend service');
    console.log('  - getAllAITrades() - Get all trades');
    console.log('  - getAITradeStats() - Get statistics');
  }
}

// Auto-initialize when imported
initializeBrowserConsoleTest();