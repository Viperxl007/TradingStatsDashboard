/**
 * Test utilities for AI Trade Integration
 * 
 * Helper functions to test the AI trade integration functionality
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';
import { processAnalysisForTradeActions } from '../services/aiTradeIntegrationService';

/**
 * Create a mock analysis result for testing
 */
export const createMockAnalysisWithClosure = (ticker: string = 'ETHUSD'): ChartAnalysisResult => {
  return {
    id: `test-analysis-${Date.now()}`,
    analysis_id: `test-${Date.now()}`,
    ticker,
    timestamp: Date.now() / 1000,
    currentPrice: 2416.80,
    timeframe: '1H',
    summary: 'Bearish reversal pattern detected',
    sentiment: 'bearish',
    confidence: 0.95,
    keyLevels: [
      {
        price: 2465,
        type: 'resistance',
        strength: 'strong',
        description: 'Key resistance level',
        confidence: 0.9
      },
      {
        price: 2420,
        type: 'support',
        strength: 'moderate',
        description: 'Support level',
        confidence: 0.8
      }
    ],
    patterns: [],
    technicalIndicators: [],
    recommendations: {
      action: 'sell',
      entryPrice: 2400.00,
      targetPrice: 2330.00,
      stopLoss: 2435.00,
      riskReward: 2.0,
      reasoning: 'ETHUSD is showing clear rejection from the $2465 resistance level with price currently below both the entry trigger level and target. The previous bullish breakout attempt has failed, and price is now forming lower highs while struggling to maintain above $2420 support. The rejection from resistance combined with weakening momentum suggests a bearish shift in the short term.'
    },
    context_assessment: `Previous Position Status: CLOSE | Position Assessment: POSITION CLOSURE: The previous buy at $2470.0 should be closed due to fundamental change in market structure. Entry Strategy Status: The breakout strategy WAS TRIGGERED at $2420.18, but the position is now underwater as price failed to reach the $2470 target and has since rejected from resistance. The breakout has failed with price now below the trigger level, indicating the bullish thesis was invalidated. | Market Changes: The key resistance at $2465 has held firm with strong rejection, invalidating the breakout scenario. Price action shows failed breakout with lower highs forming, shifting market structure from bullish to bearish. | Position Continuity: Previous bullish position should be closed as the breakout attempt failed. New bearish bias requires opposite positioning due to failed resistance break and weakening price action.`
  };
};

/**
 * Create a mock analysis result without closure recommendation
 */
export const createMockAnalysisWithoutClosure = (ticker: string = 'ETHUSD'): ChartAnalysisResult => {
  return {
    id: `test-analysis-${Date.now()}`,
    analysis_id: `test-${Date.now()}`,
    ticker,
    timestamp: Date.now() / 1000,
    currentPrice: 2450.00,
    timeframe: '1H',
    summary: 'Bullish continuation pattern',
    sentiment: 'bullish',
    confidence: 0.85,
    keyLevels: [],
    patterns: [],
    technicalIndicators: [],
    recommendations: {
      action: 'buy',
      entryPrice: 2455.00,
      targetPrice: 2500.00,
      stopLoss: 2430.00,
      reasoning: 'Strong bullish momentum with breakout above resistance'
    },
    context_assessment: 'Market showing strong bullish momentum with clean breakout above previous resistance. No existing positions to consider. Fresh bullish setup with good risk/reward ratio.'
  };
};

/**
 * Test the closure detection logic
 */
export const testClosureDetection = () => {
  console.log('🧪 [TestAITradeIntegration] Testing closure detection...');
  
  // Test case 1: Should detect closure
  const analysisWithClosure = createMockAnalysisWithClosure();
  const shouldClose1 = analysisWithClosure.context_assessment?.toLowerCase().includes('previous position status: close');
  console.log(`Test 1 - Should detect closure: ${shouldClose1 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test case 2: Should not detect closure
  const analysisWithoutClosure = createMockAnalysisWithoutClosure();
  const shouldClose2 = analysisWithoutClosure.context_assessment?.toLowerCase().includes('previous position status: close');
  console.log(`Test 2 - Should not detect closure: ${!shouldClose2 ? '✅ PASS' : '❌ FAIL'}`);
  
  return { shouldClose1, shouldClose2: !shouldClose2 };
};

/**
 * Test the full integration workflow (dry run)
 */
export const testIntegrationWorkflow = async (dryRun: boolean = true) => {
  console.log('🧪 [TestAITradeIntegration] Testing integration workflow...');
  
  if (dryRun) {
    console.log('🔍 [TestAITradeIntegration] Running in DRY RUN mode - no actual trades will be created/closed');
  }
  
  try {
    const mockAnalysis = createMockAnalysisWithClosure();
    
    if (dryRun) {
      // Just test the parsing logic without actually executing trades
      const contextAssessment = mockAnalysis.context_assessment?.toLowerCase() || '';
      const shouldClose = contextAssessment.includes('previous position status: close');
      const hasNewRecommendation = mockAnalysis.recommendations && mockAnalysis.recommendations.action !== 'hold';
      
      console.log(`📊 Analysis Summary:`);
      console.log(`  - Ticker: ${mockAnalysis.ticker}`);
      console.log(`  - Should close position: ${shouldClose}`);
      console.log(`  - Has new recommendation: ${hasNewRecommendation}`);
      console.log(`  - New action: ${mockAnalysis.recommendations?.action}`);
      console.log(`  - Entry price: $${mockAnalysis.recommendations?.entryPrice}`);
      console.log(`  - Target price: $${mockAnalysis.recommendations?.targetPrice}`);
      console.log(`  - Stop loss: $${mockAnalysis.recommendations?.stopLoss}`);
      
      return {
        success: true,
        shouldClose,
        hasNewRecommendation,
        analysis: mockAnalysis
      };
    } else {
      // Actually run the integration
      const result = await processAnalysisForTradeActions(mockAnalysis);
      console.log(`📊 Integration Result:`, result);
      return result;
    }
    
  } catch (error) {
    console.error('❌ [TestAITradeIntegration] Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Log the current state for debugging
 */
export const logCurrentState = async (ticker: string = 'ETHUSD') => {
  console.log(`🔍 [TestAITradeIntegration] Current state for ${ticker}:`);
  
  try {
    const { getActiveTradesSummary } = await import('../services/aiTradeIntegrationService');
    const summary = await getActiveTradesSummary(ticker);
    
    console.log(`📊 Active Trades Summary:`);
    console.log(`  - Production trade: ${summary.productionTrade ? 'YES' : 'NO'}`);
    console.log(`  - AI trades: ${summary.aiTrades.length}`);
    console.log(`  - Has active trades: ${summary.hasActiveTrades}`);
    
    if (summary.productionTrade) {
      console.log(`  - Production trade details:`, summary.productionTrade);
    }
    
    if (summary.aiTrades.length > 0) {
      console.log(`  - AI trade details:`, summary.aiTrades);
    }
    
    return summary;
  } catch (error) {
    console.error('❌ [TestAITradeIntegration] Failed to get current state:', error);
    return null;
  }
};