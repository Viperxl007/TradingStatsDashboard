/**
 * Test Context Synchronization
 * 
 * Test utilities to validate the AI trade context synchronization fixes.
 * Specifically tests the SOL scenario and MAINTAIN status handling.
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';
import { processAnalysisForTradeActions } from '../services/aiTradeIntegrationService';
import { prepareContextSync, validateContextResponse, enhanceAnalysisRequest } from '../services/contextSynchronizationService';

/**
 * Mock data for testing SOL trigger activation scenario
 */
export const createSOLTriggerActivationMock = (): ChartAnalysisResult => ({
  id: 'test_sol_trigger_129',
  analysis_id: '129',
  ticker: 'SOLUSD',
  timestamp: Date.now(),
  currentPrice: 146.77,
  timeframe: '1h',
  summary: 'SOLUSD has completed a strong V-shaped recovery from $132 lows and is currently testing the critical $144.50 resistance level.',
  sentiment: 'bullish',
  confidence: 0.75,
  keyLevels: [
    { price: 144.5, type: 'resistance', strength: 'strong', description: 'Critical resistance level', confidence: 0.8 },
    { price: 152.0, type: 'resistance', strength: 'moderate', description: 'Next resistance target', confidence: 0.7 },
    { price: 140.0, type: 'support', strength: 'moderate', description: 'Support zone', confidence: 0.7 },
    { price: 135.0, type: 'support', strength: 'strong', description: 'Strong support', confidence: 0.8 },
    { price: 132.0, type: 'support', strength: 'strong', description: 'Recent low support', confidence: 0.9 }
  ],
  patterns: [],
  technicalIndicators: [],
  recommendations: {
    action: 'buy',
    entryPrice: 144.5,
    targetPrice: 152.0,
    stopLoss: 135.0,
    riskReward: 1.2,
    reasoning: 'Strong recovery momentum with breakout above resistance'
  },
  context_assessment: 'TRIGGER ACTIVATION DETECTED: Previous waiting trade for SOLUSD has been triggered. Original entry target was $144.50, and price has now broken above this level at $146.77. The waiting trade should now be converted to an ACTIVE position. Market structure shows strong bullish momentum with V-shaped recovery from $132 lows. Position should be maintained with original targets: Target $152.00, Stop Loss $135.00.',
  chartImageBase64: 'mock_chart_data',
  markedUpChartImageBase64: 'mock_marked_up_chart_data'
});

/**
 * Mock data for testing MAINTAIN status scenario
 */
export const createMAINTAINStatusMock = (): ChartAnalysisResult => ({
  id: 'test_maintain_130',
  analysis_id: '130',
  ticker: 'ETHUSD',
  timestamp: Date.now(),
  currentPrice: 2420.0,
  timeframe: '1h',
  summary: 'ETHUSD continues to trade within established range with no significant market structure changes.',
  sentiment: 'neutral',
  confidence: 0.65,
  keyLevels: [
    { price: 2470.0, type: 'resistance', strength: 'strong', description: 'Key resistance', confidence: 0.8 },
    { price: 2350.0, type: 'support', strength: 'strong', description: 'Key support', confidence: 0.8 }
  ],
  patterns: [],
  technicalIndicators: [],
  recommendations: {
    action: 'hold',
    reasoning: 'Current position remains valid. No significant market structure changes warrant position adjustment.'
  },
  context_assessment: 'POSITION MAINTENANCE: Active trade for ETHUSD remains valid. Current price action shows consolidation within expected range. No major market structure changes detected. Recommendation: MAINTAIN current position with existing targets. Original analysis remains relevant with price holding above key support levels.',
  chartImageBase64: 'mock_chart_data',
  markedUpChartImageBase64: 'mock_marked_up_chart_data'
});

/**
 * Mock data for testing fresh analysis scenario
 */
export const createFreshAnalysisMock = (): ChartAnalysisResult => ({
  id: 'test_fresh_131',
  analysis_id: '131',
  ticker: 'BTCUSD',
  timestamp: Date.now(),
  currentPrice: 45000.0,
  timeframe: '1D',
  summary: 'BTCUSD showing strong bullish momentum with breakout above key resistance.',
  sentiment: 'bullish',
  confidence: 0.8,
  keyLevels: [
    { price: 46000.0, type: 'resistance', strength: 'moderate', description: 'Next resistance', confidence: 0.7 },
    { price: 44000.0, type: 'support', strength: 'strong', description: 'Breakout support', confidence: 0.8 }
  ],
  patterns: [],
  technicalIndicators: [],
  recommendations: {
    action: 'buy',
    entryPrice: 45000.0,
    targetPrice: 48000.0,
    stopLoss: 43000.0,
    riskReward: 1.5,
    reasoning: 'Strong breakout with high volume confirmation'
  },
  context_assessment: 'Position Assessment: No previous position context was provided in the analysis. This is a fresh analysis of the current market structure.',
  chartImageBase64: 'mock_chart_data',
  markedUpChartImageBase64: 'mock_marked_up_chart_data'
});

/**
 * Test SOL trigger activation scenario
 */
export const testSOLTriggerActivation = async (): Promise<{
  success: boolean;
  message: string;
  details: any;
}> => {
  try {
    console.log('🧪 Testing SOL trigger activation scenario...');
    
    const mockAnalysis = createSOLTriggerActivationMock();
    
    // Test context synchronization
    const contextSync = await prepareContextSync('SOLUSD', '1h', 146.77);
    console.log('📋 Context sync result:', contextSync);
    
    // Test context validation
    const contextValidation = validateContextResponse(mockAnalysis, contextSync);
    console.log('🔍 Context validation:', contextValidation);
    
    // Test trade action processing
    const tradeActionResult = await processAnalysisForTradeActions(mockAnalysis);
    console.log('⚙️ Trade action result:', tradeActionResult);
    
    // Validate expected behavior
    const expectedBehavior = {
      contextSyncType: contextSync.analysisType === 'trigger_activation',
      triggerDetected: contextValidation.triggerActivated,
      newTradeCreated: tradeActionResult.newTrades && tradeActionResult.newTrades.length > 0,
      actionType: tradeActionResult.actionType
    };
    
    const success = !!expectedBehavior.triggerDetected && !!expectedBehavior.newTradeCreated;
    
    return {
      success,
      message: success
        ? 'SOL trigger activation test passed - trigger detected and new trade created'
        : 'SOL trigger activation test failed - check context detection logic',
      details: {
        contextSync,
        contextValidation,
        tradeActionResult,
        expectedBehavior
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `SOL trigger activation test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Test MAINTAIN status scenario
 */
export const testMAINTAINStatus = async (): Promise<{
  success: boolean;
  message: string;
  details: any;
}> => {
  try {
    console.log('🧪 Testing MAINTAIN status scenario...');
    
    const mockAnalysis = createMAINTAINStatusMock();
    
    // Test trade action processing
    const tradeActionResult = await processAnalysisForTradeActions(mockAnalysis);
    console.log('⚙️ Trade action result:', tradeActionResult);
    
    // Validate expected behavior
    const expectedBehavior = {
      shouldPreserveTargets: tradeActionResult.shouldPreserveExistingTargets,
      actionType: tradeActionResult.actionType,
      noNewTrades: !tradeActionResult.newTrades || tradeActionResult.newTrades.length === 0
    };
    
    const success = !!expectedBehavior.shouldPreserveTargets &&
                   expectedBehavior.actionType === 'maintain' &&
                   !!expectedBehavior.noNewTrades;
    
    return {
      success,
      message: success
        ? 'MAINTAIN status test passed - existing targets preserved, no new trades created'
        : 'MAINTAIN status test failed - check maintain detection logic',
      details: {
        tradeActionResult,
        expectedBehavior
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `MAINTAIN status test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Test fresh analysis scenario
 */
export const testFreshAnalysis = async (): Promise<{
  success: boolean;
  message: string;
  details: any;
}> => {
  try {
    console.log('🧪 Testing fresh analysis scenario...');
    
    const mockAnalysis = createFreshAnalysisMock();
    
    // Test context synchronization
    const contextSync = await prepareContextSync('BTCUSD', '1D', 45000.0);
    console.log('📋 Context sync result:', contextSync);
    
    // Test trade action processing
    const tradeActionResult = await processAnalysisForTradeActions(mockAnalysis);
    console.log('⚙️ Trade action result:', tradeActionResult);
    
    // Validate expected behavior
    const expectedBehavior = {
      contextSyncType: contextSync.analysisType === 'fresh',
      newTradeCreated: tradeActionResult.newTrades && tradeActionResult.newTrades.length > 0,
      actionType: tradeActionResult.actionType
    };
    
    const success = !!(expectedBehavior.contextSyncType && expectedBehavior.newTradeCreated);
    
    return {
      success,
      message: success 
        ? 'Fresh analysis test passed - new trade recommendation created'
        : 'Fresh analysis test failed - check fresh analysis logic',
      details: {
        contextSync,
        tradeActionResult,
        expectedBehavior
      }
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Fresh analysis test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

/**
 * Run all context synchronization tests
 */
export const runAllContextSyncTests = async (): Promise<{
  success: boolean;
  summary: string;
  results: any[];
}> => {
  console.log('🚀 Running all context synchronization tests...');
  console.log('='.repeat(50));
  
  const results = [];
  
  // Test SOL trigger activation
  const solTest = await testSOLTriggerActivation();
  results.push({ test: 'SOL Trigger Activation', ...solTest });
  console.log(`${solTest.success ? '✅' : '❌'} SOL Trigger: ${solTest.message}`);
  
  // Test MAINTAIN status
  const maintainTest = await testMAINTAINStatus();
  results.push({ test: 'MAINTAIN Status', ...maintainTest });
  console.log(`${maintainTest.success ? '✅' : '❌'} MAINTAIN: ${maintainTest.message}`);
  
  // Test fresh analysis
  const freshTest = await testFreshAnalysis();
  results.push({ test: 'Fresh Analysis', ...freshTest });
  console.log(`${freshTest.success ? '✅' : '❌'} Fresh: ${freshTest.message}`);
  
  const allPassed = results.every(result => result.success);
  const passedCount = results.filter(result => result.success).length;
  
  console.log('='.repeat(50));
  console.log(`📊 Test Results: ${passedCount}/${results.length} passed`);
  
  return {
    success: allPassed,
    summary: `${passedCount}/${results.length} tests passed`,
    results
  };
};

/**
 * Debug helper to log current system state
 */
export const debugContextSyncState = async (ticker: string, timeframe: string, currentPrice: number) => {
  console.log(`🔍 Debug Context Sync State for ${ticker}`);
  console.log('='.repeat(40));
  
  try {
    // Check context sync preparation
    const contextSync = await prepareContextSync(ticker, timeframe, currentPrice);
    console.log('📋 Context Sync:', JSON.stringify(contextSync, null, 2));
    
    // Check active trades
    try {
      const response = await fetch(`/api/active-trades/${ticker}`);
      if (response.ok) {
        const activeTradeData = await response.json();
        console.log('🎯 Active Trade:', JSON.stringify(activeTradeData, null, 2));
      } else {
        console.log('📭 No active trade found');
      }
    } catch (error) {
      console.log('❌ Error fetching active trade:', error);
    }
    
  } catch (error) {
    console.log('❌ Error in debug:', error);
  }
};