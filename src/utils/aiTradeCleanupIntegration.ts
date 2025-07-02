/**
 * AI Trade Cleanup Integration - Backend-Only Architecture
 * 
 * Simplified cleanup utilities for the new backend-only AI Trade system.
 * Legacy IndexedDB cleanup functionality has been removed.
 */

import { aiTradeService } from '../services/aiTradeService';

/**
 * AI Trade Cleanup Manager for Backend-Only Architecture
 */
export class AITradeCleanupManager {
  
  /**
   * Get current AI trade status from backend
   */
  static async getTradeStatus(): Promise<{
    totalTrades: number;
    statusBreakdown: Record<string, number>;
    needsAttention: boolean;
  }> {
    console.log('📊 [AITradeCleanup] Getting trade status from backend...');
    
    try {
      await aiTradeService.init();
      const allTrades = await aiTradeService.getAllTrades();
      
      const statusBreakdown: Record<string, number> = {};
      allTrades.forEach(trade => {
        statusBreakdown[trade.status] = (statusBreakdown[trade.status] || 0) + 1;
      });
      
      const needsAttention = (statusBreakdown['user_closed'] || 0) > 0;
      
      console.log(`✅ [AITradeCleanup] Found ${allTrades.length} total trades`);
      console.log('📈 Status breakdown:', statusBreakdown);
      
      return {
        totalTrades: allTrades.length,
        statusBreakdown,
        needsAttention
      };
    } catch (error) {
      console.error('❌ [AITradeCleanup] Failed to get trade status:', error);
      return {
        totalTrades: 0,
        statusBreakdown: {},
        needsAttention: false
      };
    }
  }

  /**
   * Delete trades by status (backend operation)
   */
  static async deleteTradesByStatus(status: string): Promise<{
    success: boolean;
    deletedCount: number;
    errors: string[];
  }> {
    console.log(`🗑️ [AITradeCleanup] Deleting trades with status: ${status}`);
    
    try {
      await aiTradeService.init();
      const allTrades = await aiTradeService.getAllTrades();
      const tradesToDelete = allTrades.filter(trade => trade.status === status);
      
      console.log(`📋 Found ${tradesToDelete.length} trades to delete`);
      
      let deletedCount = 0;
      const errors: string[] = [];
      
      for (const trade of tradesToDelete) {
        try {
          await aiTradeService.deleteTrade(trade.id);
          deletedCount++;
          console.log(`✅ Deleted trade: ${trade.id} (${trade.ticker})`);
        } catch (error) {
          const errorMsg = `Failed to delete trade ${trade.id}: ${error}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
      
      console.log(`✅ [AITradeCleanup] Deletion complete: ${deletedCount}/${tradesToDelete.length} trades deleted`);
      
      return {
        success: errors.length === 0,
        deletedCount,
        errors
      };
    } catch (error) {
      console.error('❌ [AITradeCleanup] Deletion failed:', error);
      return {
        success: false,
        deletedCount: 0,
        errors: [String(error)]
      };
    }
  }
}

/**
 * Initialize cleanup tools for browser console access
 */
export function initializeCleanupTools(): void {
  if (typeof window !== 'undefined') {
    (window as any).aiTradeCleanup = AITradeCleanupManager;
    
    console.log('🔧 AI Trade Cleanup Tools Available:');
    console.log('  - aiTradeCleanup.getTradeStatus() - Get current status');
    console.log('  - aiTradeCleanup.deleteTradesByStatus("status") - Delete by status');
  }
}

// Auto-initialize when imported
initializeCleanupTools();