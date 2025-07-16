/**
 * EMERGENCY TRADE DEBUGGER
 * 
 * This utility adds comprehensive logging to track exactly where new trades are being deleted.
 * This is a temporary debugging tool to identify the race condition causing immediate trade deletion.
 */

import { aiTradeService } from '../services/aiTradeService';
import { processAnalysisForTradeActions } from '../services/aiTradeIntegrationService';

// Store original methods for restoration
const originalDeleteTrade = aiTradeService.deleteTrade.bind(aiTradeService);
const originalCreateTrade = aiTradeService.createTrade.bind(aiTradeService);

// Track all trade operations
const tradeOperations: Array<{
  timestamp: number;
  operation: 'create' | 'delete';
  tradeId: string;
  ticker?: string;
  stackTrace: string;
}> = [];

/**
 * Enable emergency debugging
 */
export const enableEmergencyDebugging = () => {
  console.log('🚨 [EMERGENCY DEBUG] Enabling comprehensive trade operation tracking...');
  
  // Patch createTrade to log all creations
  aiTradeService.createTrade = async function(request) {
    const stackTrace = new Error().stack || 'No stack trace available';
    console.log('🚨 [EMERGENCY DEBUG] CREATE TRADE CALLED:', {
      ticker: request.ticker,
      action: request.action,
      entryPrice: request.entryPrice,
      stackTrace: stackTrace.split('\n').slice(0, 5).join('\n')
    });
    
    const result = await originalCreateTrade(request);
    
    tradeOperations.push({
      timestamp: Date.now(),
      operation: 'create',
      tradeId: result.id,
      ticker: request.ticker,
      stackTrace
    });
    
    console.log('🚨 [EMERGENCY DEBUG] TRADE CREATED:', {
      id: result.id,
      ticker: request.ticker,
      timestamp: Date.now()
    });
    
    return result;
  };
  
  // Patch deleteTrade to log all deletions
  aiTradeService.deleteTrade = async function(id) {
    const stackTrace = new Error().stack || 'No stack trace available';
    console.log('🚨 [EMERGENCY DEBUG] DELETE TRADE CALLED:', {
      tradeId: id,
      stackTrace: stackTrace.split('\n').slice(0, 10).join('\n')
    });
    
    tradeOperations.push({
      timestamp: Date.now(),
      operation: 'delete',
      tradeId: id,
      stackTrace
    });
    
    // Check if this is a newly created trade being deleted
    const recentCreation = tradeOperations.find(op => 
      op.operation === 'create' && 
      op.tradeId === id && 
      (Date.now() - op.timestamp) < 10000 // Within 10 seconds
    );
    
    if (recentCreation) {
      console.error('🚨 [EMERGENCY DEBUG] CRITICAL: DELETING NEWLY CREATED TRADE!', {
        tradeId: id,
        createdAt: recentCreation.timestamp,
        deletedAt: Date.now(),
        timeDiff: Date.now() - recentCreation.timestamp,
        creationStack: recentCreation.stackTrace.split('\n').slice(0, 5).join('\n'),
        deletionStack: stackTrace.split('\n').slice(0, 10).join('\n')
      });
    }
    
    return await originalDeleteTrade(id);
  };
  
  console.log('✅ [EMERGENCY DEBUG] Trade operation tracking enabled');
};

/**
 * Disable emergency debugging
 */
export const disableEmergencyDebugging = () => {
  console.log('🔧 [EMERGENCY DEBUG] Disabling trade operation tracking...');
  
  // Restore original methods
  aiTradeService.createTrade = originalCreateTrade;
  aiTradeService.deleteTrade = originalDeleteTrade;
  
  console.log('✅ [EMERGENCY DEBUG] Trade operation tracking disabled');
};

/**
 * Get trade operations log
 */
export const getTradeOperationsLog = () => {
  return [...tradeOperations];
};

/**
 * Clear trade operations log
 */
export const clearTradeOperationsLog = () => {
  tradeOperations.length = 0;
  console.log('🧹 [EMERGENCY DEBUG] Trade operations log cleared');
};

/**
 * Analyze trade operations for patterns
 */
export const analyzeTradeOperations = () => {
  console.log('📊 [EMERGENCY DEBUG] Analyzing trade operations...');
  
  const creates = tradeOperations.filter(op => op.operation === 'create');
  const deletes = tradeOperations.filter(op => op.operation === 'delete');
  
  console.log(`📈 Total creates: ${creates.length}`);
  console.log(`🗑️ Total deletes: ${deletes.length}`);
  
  // Find rapid delete-after-create patterns
  const rapidDeletions = creates.filter(create => {
    const correspondingDelete = deletes.find(del => 
      del.tradeId === create.tradeId && 
      del.timestamp > create.timestamp &&
      (del.timestamp - create.timestamp) < 5000 // Within 5 seconds
    );
    return correspondingDelete;
  });
  
  if (rapidDeletions.length > 0) {
    console.error('🚨 [EMERGENCY DEBUG] RAPID DELETIONS DETECTED:', rapidDeletions.length);
    rapidDeletions.forEach(create => {
      const del = deletes.find(d => d.tradeId === create.tradeId);
      console.error('🚨 Rapid deletion:', {
        tradeId: create.tradeId,
        ticker: create.ticker,
        createTime: create.timestamp,
        deleteTime: del?.timestamp,
        timeDiff: del ? del.timestamp - create.timestamp : 'N/A'
      });
    });
  }
  
  return {
    totalCreates: creates.length,
    totalDeletes: deletes.length,
    rapidDeletions: rapidDeletions.length,
    operations: tradeOperations
  };
};

/**
 * Test the debugging system
 */
export const testEmergencyDebugging = async () => {
  console.log('🧪 [EMERGENCY DEBUG] Testing debugging system...');
  
  enableEmergencyDebugging();
  
  // Create a mock trade
  const mockRequest = {
    analysisId: 'test-analysis',
    ticker: 'TESTUSD',
    timeframe: '1h',
    aiModel: 'test-model',
    confidence: 0.8,
    sentiment: 'bullish' as const,
    action: 'buy' as const,
    entryPrice: 100,
    targetPrice: 110,
    stopLoss: 95,
    reasoning: 'Test trade for debugging',
    priceAtRecommendation: 100
  };
  
  try {
    const trade = await aiTradeService.createTrade(mockRequest);
    console.log('✅ [EMERGENCY DEBUG] Test trade created:', trade.id);
    
    // Wait a moment then delete it
    setTimeout(async () => {
      try {
        await aiTradeService.deleteTrade(trade.id);
        console.log('✅ [EMERGENCY DEBUG] Test trade deleted');
        
        // Analyze the operations
        analyzeTradeOperations();
      } catch (error) {
        console.error('❌ [EMERGENCY DEBUG] Test deletion failed:', error);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ [EMERGENCY DEBUG] Test creation failed:', error);
  }
};