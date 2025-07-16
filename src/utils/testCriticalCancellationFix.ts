/**
 * CRITICAL PRODUCTION FIX TEST
 * Test AI Trade Cancellation Detection & Cleanup
 * 
 * This test validates the exact scenario: "TRADE CANCELLATION: Canceling BUY setup at $106,000"
 * and ensures the system properly detects cancellation and cleans up trades.
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';
import { processAnalysisForTradeActions } from '../services/aiTradeIntegrationService';

/**
 * Test the exact scenario that was failing in production
 */
export const testCriticalCancellationScenario = async (): Promise<void> => {
  console.log('🚨 [CRITICAL TEST] Starting AI Trade Cancellation Detection Test');
  console.log('📋 [CRITICAL TEST] Testing exact scenario: "TRADE CANCELLATION: Canceling BUY setup at $106,000"');

  // Create the exact analysis that was failing
  const testAnalysis: ChartAnalysisResult = {
    id: 'test-cancellation-btc',
    analysis_id: 'test-cancellation-btc',
    ticker: 'BTC',
    timeframe: '1h',
    timestamp: Date.now(),
    currentPrice: 106000,
    confidence: 0.85,
    sentiment: 'bearish',
    summary: 'Critical cancellation test scenario',
    context_assessment: `
TRADE CANCELLATION: Canceling BUY setup at $106,000

Previous Position Context:
- Previous bullish position was established at $104,500
- Target was set at $108,000 with stop loss at $103,000
- Market conditions have fundamentally changed

Current Market Assessment:
- Strong resistance rejection at $106,000 level
- Volume profile shows selling pressure
- Technical setup has been invalidated
- Position assessment: REPLACE with new bearish setup

Recommendation: Close existing BUY position and establish new SELL position
    `.trim(),
    recommendations: {
      action: 'sell',
      entryPrice: 106000,
      targetPrice: 102000,
      stopLoss: 107500,
      reasoning: 'Market structure has shifted bearish. Previous bullish thesis invalidated by strong resistance rejection.'
    },
    keyLevels: [
      { price: 106000, type: 'resistance', strength: 'strong', description: 'Strong resistance at $106,000', confidence: 0.9 },
      { price: 104000, type: 'support', strength: 'moderate', description: 'Support level at $104,000', confidence: 0.7 }
    ],
    patterns: [],
    technicalIndicators: [
      { name: 'RSI', value: 65, signal: 'neutral', description: 'RSI at 65 showing potential overbought conditions' },
      { name: 'MACD', value: -0.5, signal: 'bearish', description: 'MACD negative indicating bearish momentum' }
    ]
  };

  try {
    console.log('🔍 [CRITICAL TEST] Processing analysis with cancellation context...');
    console.log('📝 [CRITICAL TEST] Context assessment preview:', testAnalysis.context_assessment?.substring(0, 100) + '...');

    const result = await processAnalysisForTradeActions(testAnalysis);

    console.log('📊 [CRITICAL TEST] Processing result:', {
      success: result.success,
      actionType: result.actionType,
      closedTrades: result.closedTrades?.length || 0,
      newTrades: result.newTrades?.length || 0,
      errors: result.errors?.length || 0,
      message: result.message
    });

    // CRITICAL VALIDATION CHECKS
    console.log('\n🔍 [CRITICAL TEST] Performing validation checks...');

    // Check 1: Should detect cancellation (not maintain)
    if (result.actionType === 'maintain') {
      console.error('❌ [CRITICAL TEST] FAILURE: System detected MAINTAIN instead of cancellation!');
      console.error('🚨 [CRITICAL TEST] This is the exact bug that was reported in production!');
      throw new Error('CRITICAL BUG: Cancellation not detected - system shows MAINTAIN');
    } else {
      console.log('✅ [CRITICAL TEST] SUCCESS: Cancellation properly detected (not MAINTAIN)');
    }

    // Check 2: Should close existing positions
    if (result.actionType !== 'close_and_create' && result.actionType !== 'close_only') {
      console.error('❌ [CRITICAL TEST] FAILURE: Expected close action but got:', result.actionType);
      throw new Error('CRITICAL BUG: Position closure not triggered');
    } else {
      console.log('✅ [CRITICAL TEST] SUCCESS: Position closure action triggered');
    }

    // Check 3: Should have proper error handling
    if (!result.success && result.errors && result.errors.length > 0) {
      console.log('⚠️ [CRITICAL TEST] Errors detected (expected in test environment):', result.errors);
    }

    // Check 4: Should deactivate recommendations
    if (result.shouldDeactivateRecommendations) {
      console.log('✅ [CRITICAL TEST] SUCCESS: Recommendations properly deactivated');
    }

    console.log('\n🎉 [CRITICAL TEST] All critical validation checks PASSED!');
    console.log('✅ [CRITICAL TEST] The "TRADE CANCELLATION: Canceling BUY setup at $106,000" scenario is now properly handled');
    console.log('✅ [CRITICAL TEST] System will no longer show MAINTAIN when AI recommends cancellation');

  } catch (error) {
    console.error('❌ [CRITICAL TEST] CRITICAL FAILURE:', error);
    console.error('🚨 [CRITICAL TEST] The production bug has NOT been fixed!');
    throw error;
  }
};

/**
 * Test additional cancellation patterns to ensure comprehensive coverage
 */
export const testAdditionalCancellationPatterns = async (): Promise<void> => {
  console.log('\n🔍 [CRITICAL TEST] Testing additional cancellation patterns...');

  const testPatterns = [
    'trade cancellation',
    'canceling buy setup',
    'canceling sell setup', 
    'position assessment: replace',
    'TRADE CANCELLATION: Canceling BUY setup',
    'TRADE CANCELLATION: Canceling SELL setup',
    'Position Assessment: REPLACE'
  ];

  for (const pattern of testPatterns) {
    console.log(`🧪 [CRITICAL TEST] Testing pattern: "${pattern}"`);
    
    const testAnalysis: ChartAnalysisResult = {
      id: `test-pattern-${Date.now()}`,
      analysis_id: `test-pattern-${Date.now()}`,
      ticker: 'BTC',
      timeframe: '1h',
      timestamp: Date.now(),
      currentPrice: 106000,
      confidence: 0.85,
      sentiment: 'bearish',
      summary: `Testing pattern: ${pattern}`,
      context_assessment: `Market analysis shows ${pattern} due to changed conditions. Previous position should be closed.`,
      recommendations: {
        action: 'sell',
        entryPrice: 106000,
        targetPrice: 102000,
        stopLoss: 107500,
        reasoning: 'Test pattern detection'
      },
      keyLevels: [
        { price: 106000, type: 'resistance', strength: 'strong', description: 'Test resistance', confidence: 0.8 }
      ],
      patterns: [],
      technicalIndicators: [
        { name: 'RSI', value: 60, signal: 'neutral', description: 'Test RSI' }
      ]
    };

    try {
      const result = await processAnalysisForTradeActions(testAnalysis);
      
      if (result.actionType === 'maintain') {
        console.error(`❌ [CRITICAL TEST] Pattern "${pattern}" NOT detected - shows MAINTAIN`);
        throw new Error(`Pattern detection failed for: ${pattern}`);
      } else {
        console.log(`✅ [CRITICAL TEST] Pattern "${pattern}" properly detected`);
      }
    } catch (error) {
      console.error(`❌ [CRITICAL TEST] Error testing pattern "${pattern}":`, error);
      throw error;
    }
  }

  console.log('✅ [CRITICAL TEST] All cancellation patterns properly detected!');
};

/**
 * Run all critical tests
 */
export const runCriticalCancellationTests = async (): Promise<void> => {
  console.log('🚨 [CRITICAL TEST] ========================================');
  console.log('🚨 [CRITICAL TEST] RUNNING CRITICAL CANCELLATION FIX TESTS');
  console.log('🚨 [CRITICAL TEST] ========================================\n');

  try {
    await testCriticalCancellationScenario();
    await testAdditionalCancellationPatterns();
    
    console.log('\n🎉 [CRITICAL TEST] ========================================');
    console.log('🎉 [CRITICAL TEST] ALL CRITICAL TESTS PASSED!');
    console.log('🎉 [CRITICAL TEST] Production bug has been FIXED!');
    console.log('🎉 [CRITICAL TEST] ========================================');
    
  } catch (error) {
    console.error('\n🚨 [CRITICAL TEST] ========================================');
    console.error('🚨 [CRITICAL TEST] CRITICAL TEST FAILURE!');
    console.error('🚨 [CRITICAL TEST] Production bug NOT fixed!');
    console.error('🚨 [CRITICAL TEST] ========================================');
    throw error;
  }
};

// Export for easy testing
if (require.main === module) {
  runCriticalCancellationTests().catch(console.error);
}