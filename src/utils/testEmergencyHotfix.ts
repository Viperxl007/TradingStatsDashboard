/**
 * EMERGENCY HOTFIX TEST SUITE
 * 
 * Tests the critical fixes for the AI trade auto-closure bug.
 * This test verifies that fresh analysis no longer triggers immediate trade closure.
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';
import { processAnalysisForTradeActions } from '../services/aiTradeIntegrationService';

// Test scenarios that should NOT trigger closure
const FRESH_ANALYSIS_SCENARIOS = [
  {
    name: "Fresh Analysis - No Context",
    analysis: {
      id: "test-1",
      ticker: "BTCUSD",
      timeframe: "1h",
      timestamp: Date.now() / 1000,
      currentPrice: 106000,
      confidence: 0.8,
      sentiment: "bullish",
      summary: "Fresh analysis with no context",
      keyLevels: [],
      patterns: [],
      technicalIndicators: [],
      context_assessment: undefined, // No context - should NOT trigger closure
      recommendations: {
        action: "buy" as const,
        entryPrice: 106000,
        targetPrice: 108000,
        stopLoss: 104000,
        reasoning: "Fresh bullish setup detected"
      }
    } as ChartAnalysisResult
  },
  {
    name: "Fresh Analysis - Explicit Fresh Context",
    analysis: {
      id: "test-2",
      ticker: "BTCUSD",
      timeframe: "1h",
      timestamp: Date.now() / 1000,
      currentPrice: 106000,
      confidence: 0.8,
      sentiment: "bullish",
      summary: "Fresh analysis with explicit fresh context",
      keyLevels: [],
      patterns: [],
      technicalIndicators: [],
      context_assessment: "Fresh analysis of BTCUSD. No previous position context was provided. This is an initial analysis of the current market structure.",
      recommendations: {
        action: "buy" as const,
        entryPrice: 106000,
        targetPrice: 108000,
        stopLoss: 104000,
        reasoning: "Fresh bullish setup detected"
      }
    } as ChartAnalysisResult
  },
  {
    name: "Fresh Analysis - No Position Context",
    analysis: {
      id: "test-3",
      ticker: "XRPUSD",
      timeframe: "4h",
      timestamp: Date.now() / 1000,
      currentPrice: 2.50,
      confidence: 0.75,
      sentiment: "bearish",
      summary: "Fresh analysis with no position context",
      keyLevels: [],
      patterns: [],
      technicalIndicators: [],
      context_assessment: "No previous position context available. Analyzing current market conditions for XRPUSD shows potential bearish setup.",
      recommendations: {
        action: "sell" as const,
        entryPrice: 2.50,
        targetPrice: 2.30,
        stopLoss: 2.65,
        reasoning: "Bearish reversal pattern forming"
      }
    } as ChartAnalysisResult
  }
];

// Test scenarios that SHOULD trigger closure
const VALID_CLOSURE_SCENARIOS = [
  {
    name: "Valid Closure - Trade Cancellation",
    analysis: {
      id: "test-4",
      ticker: "BTCUSD",
      timeframe: "1h",
      timestamp: Date.now() / 1000,
      currentPrice: 105000,
      confidence: 0.9,
      sentiment: "bearish",
      summary: "Trade cancellation scenario",
      keyLevels: [],
      patterns: [],
      technicalIndicators: [],
      context_assessment: "TRADE CANCELLATION: Canceling BUY setup at $106,000. Previous bullish position should be closed due to failed breakout.",
      recommendations: {
        action: "sell" as const,
        entryPrice: 105000,
        targetPrice: 102000,
        stopLoss: 107000,
        reasoning: "Canceling previous buy setup due to failed breakout"
      }
    } as ChartAnalysisResult
  },
  {
    name: "Valid Closure - Position Assessment Replace",
    analysis: {
      id: "test-5",
      ticker: "XRPUSD",
      timeframe: "4h",
      timestamp: Date.now() / 1000,
      currentPrice: 2.40,
      confidence: 0.85,
      sentiment: "bearish",
      summary: "Position replacement scenario",
      keyLevels: [],
      patterns: [],
      technicalIndicators: [],
      context_assessment: "Previous position status: close. Position assessment: replace. The previous bullish position should be closed due to market structure breakdown.",
      recommendations: {
        action: "sell" as const,
        entryPrice: 2.40,
        targetPrice: 2.20,
        stopLoss: 2.55,
        reasoning: "Replacing previous position due to breakdown"
      }
    } as ChartAnalysisResult
  }
];

/**
 * Run emergency hotfix tests
 */
export const runEmergencyHotfixTests = async (): Promise<void> => {
  console.log(`🚨 [EMERGENCY TEST] Starting critical hotfix validation...`);
  console.log(`🚨 [EMERGENCY TEST] Testing ${FRESH_ANALYSIS_SCENARIOS.length} fresh analysis scenarios and ${VALID_CLOSURE_SCENARIOS.length} valid closure scenarios`);
  
  let passedTests = 0;
  let failedTests = 0;
  const failures: string[] = [];

  // Test fresh analysis scenarios - these should NOT trigger closure
  console.log(`\n🛡️ [EMERGENCY TEST] Testing fresh analysis scenarios (should NOT trigger closure):`);
  
  for (const scenario of FRESH_ANALYSIS_SCENARIOS) {
    try {
      console.log(`\n📋 [EMERGENCY TEST] Testing: ${scenario.name}`);
      console.log(`📋 [EMERGENCY TEST] Context: "${scenario.analysis.context_assessment?.substring(0, 100) || 'No context'}"`);
      
      const result = await processAnalysisForTradeActions(scenario.analysis);
      
      // Check if closure was triggered (this would be the bug)
      const closureTriggered = result.closedTrades && result.closedTrades.length > 0;
      
      if (closureTriggered) {
        console.log(`❌ [EMERGENCY TEST] CRITICAL FAILURE: ${scenario.name} - Fresh analysis triggered closure! This is the bug we're fixing.`);
        console.log(`❌ [EMERGENCY TEST] Closed trades: ${result.closedTrades?.join(', ')}`);
        console.log(`❌ [EMERGENCY TEST] Action type: ${result.actionType}`);
        failedTests++;
        failures.push(`${scenario.name}: Fresh analysis incorrectly triggered closure`);
      } else {
        console.log(`✅ [EMERGENCY TEST] PASS: ${scenario.name} - No closure triggered on fresh analysis`);
        console.log(`✅ [EMERGENCY TEST] Action type: ${result.actionType}`);
        passedTests++;
      }
    } catch (error) {
      console.log(`❌ [EMERGENCY TEST] ERROR in ${scenario.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failedTests++;
      failures.push(`${scenario.name}: Test error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test valid closure scenarios - these SHOULD trigger closure
  console.log(`\n🚨 [EMERGENCY TEST] Testing valid closure scenarios (SHOULD trigger closure):`);
  
  for (const scenario of VALID_CLOSURE_SCENARIOS) {
    try {
      console.log(`\n📋 [EMERGENCY TEST] Testing: ${scenario.name}`);
      console.log(`📋 [EMERGENCY TEST] Context: "${scenario.analysis.context_assessment?.substring(0, 100)}"`);
      
      const result = await processAnalysisForTradeActions(scenario.analysis);
      
      // Check if closure was triggered (this should happen)
      const closureTriggered = result.closedTrades && result.closedTrades.length > 0;
      
      if (!closureTriggered) {
        console.log(`❌ [EMERGENCY TEST] FAILURE: ${scenario.name} - Valid closure scenario did not trigger closure`);
        console.log(`❌ [EMERGENCY TEST] Action type: ${result.actionType}`);
        failedTests++;
        failures.push(`${scenario.name}: Valid closure scenario did not trigger closure`);
      } else {
        console.log(`✅ [EMERGENCY TEST] PASS: ${scenario.name} - Closure correctly triggered`);
        console.log(`✅ [EMERGENCY TEST] Closed trades: ${result.closedTrades?.join(', ')}`);
        console.log(`✅ [EMERGENCY TEST] Action type: ${result.actionType}`);
        passedTests++;
      }
    } catch (error) {
      console.log(`❌ [EMERGENCY TEST] ERROR in ${scenario.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failedTests++;
      failures.push(`${scenario.name}: Test error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Summary
  console.log(`\n🏁 [EMERGENCY TEST] HOTFIX VALIDATION COMPLETE:`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log(`\n🚨 [EMERGENCY TEST] CRITICAL FAILURES DETECTED:`);
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure}`);
    });
    console.log(`\n🚨 [EMERGENCY TEST] HOTFIX VALIDATION FAILED - PRODUCTION ISSUE NOT RESOLVED`);
  } else {
    console.log(`\n✅ [EMERGENCY TEST] ALL TESTS PASSED - HOTFIX SUCCESSFULLY PREVENTS FRESH ANALYSIS CLOSURE BUG`);
    console.log(`✅ [EMERGENCY TEST] Production issue should be resolved`);
  }
};

/**
 * Quick test function for immediate validation
 */
export const quickEmergencyTest = async (): Promise<boolean> => {
  console.log(`🚨 [QUICK TEST] Running emergency validation...`);
  
  // Test the most critical scenario - fresh analysis with no context
  const freshAnalysis: ChartAnalysisResult = {
    id: "quick-test",
    ticker: "BTCUSD",
    timeframe: "1h",
    timestamp: Date.now() / 1000,
    currentPrice: 106000,
    confidence: 0.8,
    sentiment: "bullish",
    summary: "Quick test fresh analysis",
    keyLevels: [],
    patterns: [],
    technicalIndicators: [],
    context_assessment: undefined, // This should NOT trigger closure
    recommendations: {
      action: "buy" as const,
      entryPrice: 106000,
      targetPrice: 108000,
      stopLoss: 104000,
      reasoning: "Fresh bullish setup"
    }
  };

  try {
    const result = await processAnalysisForTradeActions(freshAnalysis);
    const closureTriggered = result.closedTrades && result.closedTrades.length > 0;
    
    if (closureTriggered) {
      console.log(`❌ [QUICK TEST] CRITICAL: Fresh analysis still triggers closure - HOTFIX FAILED`);
      return false;
    } else {
      console.log(`✅ [QUICK TEST] SUCCESS: Fresh analysis does not trigger closure - HOTFIX WORKING`);
      return true;
    }
  } catch (error) {
    console.log(`❌ [QUICK TEST] ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Export for immediate testing
if (require.main === module) {
  quickEmergencyTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}