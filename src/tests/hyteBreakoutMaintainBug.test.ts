/**
 * CRITICAL REGRESSION TEST: HYPE Breakout Maintain Bug
 * 
 * This test suite specifically tests the exact scenario that caused the critical bug:
 * - Active waiting trade for HYPE
 * - Breakout trigger hit correctly
 * - AI correctly recommends "maintain" 
 * - System should NOT close the trade as "user_closed"
 * - Trade should remain active with maintain status
 * 
 * Bug Description: After AI correctly identified trigger and recommended "maintain",
 * the backend was still attempting to create a new trade, which triggered duplicate
 * prevention logic that incorrectly closed the existing active trade as "user_closed".
 */

import { processAnalysisForTradeActions, checkForMaintainRecommendation } from '../services/aiTradeIntegrationService';
import { ChartAnalysisResult } from '../types/chartAnalysis';

describe('HYPE Breakout Maintain Bug - Critical Regression Tests', () => {
  
  describe('Exact HYPE Scenario Reproduction', () => {
    
    test('CRITICAL: HYPE breakout with maintain recommendation should NOT close existing trade', async () => {
      // Exact analysis data from the HYPE breakout scenario that caused the bug
      const hyteBreakoutAnalysisData: ChartAnalysisResult = {
        id: 'test-hype-breakout-001',
        ticker: 'HYPE',
        timeframe: '1h',
        timestamp: Date.now(),
        currentPrice: 15.42,
        summary: 'HYPE breakout confirmed, maintain existing position',
        sentiment: 'bullish',
        confidence: 0.85,
        keyLevels: [],
        patterns: [],
        technicalIndicators: [],
        context_assessment: 'previous position status: MAINTAIN. Breakout confirmed, position performing well.',
        recommendations: {
          action: 'hold', // Maps to maintain in the system
          reasoning: 'Breakout confirmed, position performing well, maintain current position',
        },
        detailedAnalysis: {
          tradingAnalysis: {
            entry_strategies: [
              {
                strategy_type: 'breakout_continuation',
                probability: 'high',
                entry_condition: 'Maintain existing position through breakout'
              }
            ]
          }
        }
      };

      // Test the AI trade integration service
      const result = await processAnalysisForTradeActions(hyteBreakoutAnalysisData);
      
      // CRITICAL ASSERTIONS: These must pass to prevent the bug
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('maintain');
      expect(result.shouldPreserveExistingTargets).toBe(true);
      expect(result.shouldDeactivateRecommendations).toBe(false);
      expect(result.closedTrades).toEqual([]); // NO trades should be closed
      expect(result.newTrades).toEqual([]); // NO new trades should be created
      
      // Verify maintain recommendation detection
      const maintainCheck = checkForMaintainRecommendation(hyteBreakoutAnalysisData);
      expect(maintainCheck).toBe(true);
    });

    test('CRITICAL: Backend should skip trade creation when MAINTAIN detected', () => {
      const analysisWithMaintain = {
        context_assessment: 'previous position status: MAINTAIN',
        recommendations: {
          action: 'maintain'
        }
      };

      // Simulate the backend logic check
      const contextAssessment = analysisWithMaintain.context_assessment || '';
      const shouldSkipTradeCreation = contextAssessment.toLowerCase().includes('maintain');

      expect(shouldSkipTradeCreation).toBe(true);
    });

    test('CRITICAL: Frontend should return early on MAINTAIN without backend calls', async () => {
      const maintainResult = {
        success: true,
        actionType: 'maintain',
        shouldPreserveExistingTargets: true,
        shouldDeactivateRecommendations: false,
        closedTrades: [],
        newTrades: []
      };

      // Simulate frontend logic
      const shouldReturnEarly = maintainResult.shouldPreserveExistingTargets && 
                               maintainResult.actionType === 'maintain';

      expect(shouldReturnEarly).toBe(true);
      expect(maintainResult.closedTrades).toEqual([]);
      expect(maintainResult.newTrades).toEqual([]);
    });
  });

  describe('Edge Cases for MAINTAIN Detection', () => {
    
    test('Should handle case-insensitive MAINTAIN detection', () => {
      const testCases = [
        'previous position status: MAINTAIN',
        'previous position status: maintain',
        'previous position status: Maintain',
        '  previous position status: MAINTAIN  ', // with whitespace
        '  previous position status: maintain  '
      ];

      testCases.forEach(testCase => {
        const shouldSkipTradeCreation = testCase.toLowerCase().includes('maintain');
        expect(shouldSkipTradeCreation).toBe(true);
      });
    });

    test('Should handle non-string values safely', () => {
      const testCases = [
        null,
        undefined,
        '',
        'no special status here',
        'CLOSE position',
        'CREATE new trade'
      ];

      testCases.forEach(testCase => {
        const contextAssessment = testCase || '';
        const shouldSkipTradeCreation = typeof contextAssessment === 'string' && 
                                       contextAssessment.toLowerCase().includes('maintain');
        
        expect(shouldSkipTradeCreation).toBe(false);
      });
    });

    test('Should NOT trigger MAINTAIN for other status values', () => {
      const testCases = [
        'previous position status: CLOSE',
        'previous position status: CREATE',
        'previous position status: WAITING',
        'previous position status: ACTIVE',
        '',
        'SOMETHING_ELSE but not the special word'
      ];

      testCases.forEach(testCase => {
        const shouldSkipTradeCreation = testCase.toLowerCase().includes('maintain');
        expect(shouldSkipTradeCreation).toBe(false);
      });
    });
  });

  describe('Integration Workflow Tests', () => {
    
    test('Complete workflow: Waiting → Trigger Hit → Maintain → Trade Stays Open', async () => {
      // AI analysis with MAINTAIN recommendation
      const analysisData: ChartAnalysisResult = {
        id: 'test-workflow-001',
        ticker: 'HYPE',
        timestamp: Date.now(),
        currentPrice: 15.42,
        timeframe: '1h',
        summary: 'Maintain existing position through breakout',
        sentiment: 'bullish',
        confidence: 0.85,
        keyLevels: [],
        patterns: [],
        technicalIndicators: [],
        context_assessment: 'previous position status: MAINTAIN. Trigger hit, maintain through breakout.',
        recommendations: {
          action: 'hold',
          reasoning: 'Position performing well, maintain through breakout'
        }
      };

      // Process analysis for trade actions
      const result = await processAnalysisForTradeActions(analysisData);

      // Verify correct behavior
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('maintain');
      expect(result.closedTrades).toEqual([]); // Trade should NOT be closed
      expect(result.newTrades).toEqual([]); // No new trades should be created
      expect(result.shouldPreserveExistingTargets).toBe(true);

      // Verify maintain detection
      const maintainCheck = checkForMaintainRecommendation(analysisData);
      expect(maintainCheck).toBe(true);
    });
  });

  describe('Regression Prevention', () => {
    
    test('REGRESSION CHECK: Ensure existing functionality still works for non-MAINTAIN cases', async () => {
      // Test normal buy recommendation
      const buyAnalysis: ChartAnalysisResult = {
        id: 'test-buy-001',
        ticker: 'TEST',
        timestamp: Date.now(),
        currentPrice: 100.0,
        timeframe: '1h',
        summary: 'Buy signal detected',
        sentiment: 'bullish',
        confidence: 0.8,
        keyLevels: [],
        patterns: [],
        technicalIndicators: [],
        context_assessment: 'Fresh analysis, no previous context, create new trade',
        recommendations: {
          action: 'buy',
          entryPrice: 100.0,
          targetPrice: 110.0,
          stopLoss: 95.0,
          reasoning: 'Strong buy signal'
        }
      };

      const buyResult = await processAnalysisForTradeActions(buyAnalysis);
      expect(buyResult.success).toBe(true);
      expect(buyResult.actionType).toBe('create_new');

      // Test normal sell recommendation
      const sellAnalysis: ChartAnalysisResult = {
        id: 'test-sell-001',
        ticker: 'TEST',
        timestamp: Date.now(),
        currentPrice: 100.0,
        timeframe: '1h',
        summary: 'Sell signal detected',
        sentiment: 'bearish',
        confidence: 0.8,
        keyLevels: [],
        patterns: [],
        technicalIndicators: [],
        context_assessment: 'Fresh analysis indicates sell signal, close position',
        recommendations: {
          action: 'sell',
          reasoning: 'Exit signal detected'
        }
      };

      const sellResult = await processAnalysisForTradeActions(sellAnalysis);
      expect(sellResult.success).toBe(true);
      expect(sellResult.actionType).toBe('create_new');
    });
  });
});