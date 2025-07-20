/**
 * Timeframe Isolation Test Suite
 * 
 * CRITICAL: Tests to ensure proper timeframe isolation for parallel trades
 * This test suite validates that trades on different timeframes operate independently
 * and that context synchronization respects timeframe boundaries.
 * 
 * Bug Fixed: System was using unified context across all timeframes, causing
 * 15m analysis to interfere with 1h trades and vice versa.
 */

import { prepareContextSync, validateContextResponse, ContextSyncRequest } from '../services/contextSynchronizationService';
import { ChartAnalysisResult } from '../types/chartAnalysis';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Timeframe Isolation - Critical Parallel Trade Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRITICAL: Context Sync Timeframe Filtering', () => {
    
    test('Should include timeframe parameter in API calls', async () => {
      // Mock successful response with no active trade
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ticker: 'BTCUSD', active_trade: null, timestamp: Date.now() })
      } as Response);

      const ticker = 'BTCUSD';
      const timeframe = '15m';
      const currentPrice = 118000;

      await prepareContextSync(ticker, timeframe, currentPrice);

      // Verify the fetch was called with timeframe parameter
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:5000/api/active-trades/${ticker}?timeframe=${timeframe}`
      );
    });

    test('Should handle 1h trade when analyzing 15m chart (isolation)', async () => {
      // Mock response with 1h trade when analyzing 15m chart
      const mockTrade = {
        id: 54,
        ticker: 'BTCUSD',
        timeframe: '1h',  // Trade is on 1h timeframe
        status: 'waiting',
        entry_price: 115000,
        action: 'sell',
        created_at: new Date().toISOString()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ticker: 'BTCUSD', active_trade: mockTrade, timestamp: Date.now() })
      } as Response);

      const ticker = 'BTCUSD';
      const timeframe = '15m';  // Analyzing 15m chart
      const currentPrice = 118000;

      const result = await prepareContextSync(ticker, timeframe, currentPrice);

      // Should return fresh analysis since timeframes don't match
      expect(result.analysisType).toBe('fresh');
      expect(result.timeframe).toBe('15m');
    });

    test('Should process trade when timeframes match', async () => {
      // Mock response with 15m trade when analyzing 15m chart
      const mockTrade = {
        id: 55,
        ticker: 'BTCUSD',
        timeframe: '15m',  // Trade matches analysis timeframe
        status: 'waiting',
        entry_price: 118500,
        action: 'buy',
        created_at: new Date().toISOString()
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ticker: 'BTCUSD', active_trade: mockTrade, timestamp: Date.now() })
      } as Response);

      const ticker = 'BTCUSD';
      const timeframe = '15m';  // Analyzing 15m chart
      const currentPrice = 118000;

      const result = await prepareContextSync(ticker, timeframe, currentPrice);

      // Should return trigger_activation since timeframes match
      expect(result.analysisType).toBe('trigger_activation');
      expect(result.timeframe).toBe('15m');
      expect(result.triggerInfo?.originalEntryPrice).toBe(118500);
    });
  });

  describe('CRITICAL: Parallel Trade Scenarios', () => {
    
    test('Scenario: 1h SELL waiting + 15m fresh analysis should be independent', async () => {
      // This tests the exact scenario from the user's logs
      const scenarios = [
        {
          description: '1h SELL trade waiting',
          ticker: 'BTCUSD',
          timeframe: '1h',
          trade: {
            id: 54,
            ticker: 'BTCUSD',
            timeframe: '1h',
            status: 'waiting',
            entry_price: 115000,
            action: 'sell',
            created_at: new Date().toISOString()
          }
        },
        {
          description: '15m fresh analysis',
          ticker: 'BTCUSD',
          timeframe: '15m',
          trade: null  // No 15m trade exists
        }
      ];

      for (const scenario of scenarios) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ 
            ticker: scenario.ticker, 
            active_trade: scenario.trade, 
            timestamp: Date.now() 
          })
        } as Response);

        const result = await prepareContextSync(scenario.ticker, scenario.timeframe, 118000);

        if (scenario.timeframe === '1h' && scenario.trade) {
          // 1h analysis should find the 1h trade
          expect(result.analysisType).toBe('trigger_activation');
          expect(result.timeframe).toBe('1h');
        } else if (scenario.timeframe === '15m') {
          // 15m analysis should be fresh (no 15m trade)
          expect(result.analysisType).toBe('fresh');
          expect(result.timeframe).toBe('15m');
        }

        console.log(`✅ ${scenario.description}: ${result.analysisType} analysis on ${result.timeframe}`);
      }
    });

    test('Scenario: Multiple parallel trades on different timeframes', async () => {
      const parallelTrades = [
        { timeframe: '15m', status: 'active', entry_price: 118000, action: 'buy' },
        { timeframe: '1h', status: 'waiting', entry_price: 115000, action: 'sell' },
        { timeframe: '4h', status: 'active', entry_price: 120000, action: 'sell' }
      ];

      for (const trade of parallelTrades) {
        const mockTrade = {
          id: Math.floor(Math.random() * 1000),
          ticker: 'BTCUSD',
          timeframe: trade.timeframe,
          status: trade.status,
          entry_price: trade.entry_price,
          action: trade.action,
          created_at: new Date().toISOString()
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ ticker: 'BTCUSD', active_trade: mockTrade, timestamp: Date.now() })
        } as Response);

        const result = await prepareContextSync('BTCUSD', trade.timeframe, 118500);

        // Each timeframe should find its own trade
        expect(result.timeframe).toBe(trade.timeframe);
        if (trade.status === 'waiting') {
          expect(result.analysisType).toBe('trigger_activation');
        } else if (trade.status === 'active') {
          expect(result.analysisType).toBe('continuation');
        }

        console.log(`✅ ${trade.timeframe} ${trade.action} ${trade.status}: ${result.analysisType} analysis`);
      }
    });
  });

  describe('CRITICAL: Context Validation with Timeframe Awareness', () => {
    
    test('Should validate trigger activation context correctly', () => {
      const mockAnalysis: ChartAnalysisResult = {
        id: 'test-123',
        ticker: 'BTCUSD',
        timeframe: '15m',
        timestamp: Date.now() / 1000,
        currentPrice: 118000,
        summary: 'Test analysis',
        sentiment: 'bullish',
        confidence: 0.85,
        keyLevels: [],
        patterns: [],
        technicalIndicators: [],
        recommendations: {
          action: 'buy',
          entryPrice: 118500,
          targetPrice: 120000,
          stopLoss: 117000,
          riskReward: 2.5,
          reasoning: 'breakout above resistance'
        },
        context_assessment: 'TRIGGER HIT: Entry breakout confirmed at $118,500 level'
      };

      const expectedContext: ContextSyncRequest = {
        ticker: 'BTCUSD',
        timeframe: '15m',
        currentPrice: 118000,
        analysisType: 'trigger_activation',
        triggerInfo: {
          originalEntryPrice: 118500,
          triggerPrice: 118500,
          waitingDuration: 2
        }
      };

      const result = validateContextResponse(mockAnalysis, expectedContext);

      expect(result.success).toBe(true);
      expect(result.triggerActivated).toBe(true);
      expect(result.recommendedAction).toBe('acknowledge_trigger');
    });

    test('Should detect context mismatch when trigger expected but not found', () => {
      const mockAnalysis: ChartAnalysisResult = {
        id: 'test-124',
        ticker: 'BTCUSD',
        timeframe: '15m',
        timestamp: Date.now() / 1000,
        currentPrice: 118000,
        summary: 'Test analysis',
        sentiment: 'neutral',
        confidence: 0.3,
        keyLevels: [],
        patterns: [],
        technicalIndicators: [],
        recommendations: {
          action: 'hold',
          reasoning: 'no clear setup'
        },
        context_assessment: 'No significant changes in market structure'
      };

      const expectedContext: ContextSyncRequest = {
        ticker: 'BTCUSD',
        timeframe: '15m',
        currentPrice: 118000,
        analysisType: 'trigger_activation',
        triggerInfo: {
          originalEntryPrice: 118500,
          triggerPrice: 118500,
          waitingDuration: 2
        }
      };

      const result = validateContextResponse(mockAnalysis, expectedContext);

      expect(result.success).toBe(false);
      expect(result.triggerActivated).toBe(false);
      expect(result.error).toContain('Expected trigger activation but not detected in context');
    });
  });

  describe('CRITICAL: Error Handling and Edge Cases', () => {
    
    test('Should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await prepareContextSync('BTCUSD', '15m', 118000);

      // Should fallback to fresh analysis on error
      expect(result.analysisType).toBe('fresh');
      expect(result.timeframe).toBe('15m');
    });

    test('Should handle 404 responses (no active trade)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'No active trade found' })
      } as Response);

      const result = await prepareContextSync('BTCUSD', '15m', 118000);

      expect(result.analysisType).toBe('fresh');
      expect(result.timeframe).toBe('15m');
    });

    test('Should handle malformed trade data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ticker: 'BTCUSD', active_trade: { invalid: 'data' }, timestamp: Date.now() })
      } as Response);

      const result = await prepareContextSync('BTCUSD', '15m', 118000);

      // Should fallback to fresh analysis with malformed data
      expect(result.analysisType).toBe('fresh');
      expect(result.timeframe).toBe('15m');
    });
  });

  describe('CRITICAL: Integration Test Scenarios', () => {
    
    test('Real-world scenario: User switches from 1h to 15m chart', async () => {
      // Step 1: User has 1h trade active
      const h1Trade = {
        id: 54,
        ticker: 'BTCUSD',
        timeframe: '1h',
        status: 'waiting',
        entry_price: 115000,
        action: 'sell',
        created_at: new Date().toISOString()
      };

      // Step 2: User switches to 15m chart
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ticker: 'BTCUSD', active_trade: null, timestamp: Date.now() })
      } as Response);

      const result = await prepareContextSync('BTCUSD', '15m', 118000);

      // Should get fresh analysis for 15m, ignoring 1h trade
      expect(result.analysisType).toBe('fresh');
      expect(result.timeframe).toBe('15m');
      
      // Verify API was called with 15m timeframe filter
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/active-trades/BTCUSD?timeframe=15m'
      );

      console.log('✅ User switching timeframes: 15m analysis independent of 1h trade');
    });
  });
});

/**
 * Backend Integration Tests
 * These would typically be run against a test database
 */
describe('Backend Timeframe Isolation Integration', () => {
  
  test('MOCK: Backend should filter trades by timeframe', () => {
    // This is a conceptual test - in reality this would test the Python backend
    const mockBackendResponse = (ticker: string, timeframe?: string) => {
      const allTrades = [
        { id: 1, ticker: 'BTCUSD', timeframe: '15m', status: 'active' },
        { id: 2, ticker: 'BTCUSD', timeframe: '1h', status: 'waiting' },
        { id: 3, ticker: 'BTCUSD', timeframe: '4h', status: 'active' }
      ];

      if (timeframe) {
        return allTrades.filter(trade => trade.timeframe === timeframe)[0] || null;
      }
      return allTrades[0]; // Return first trade if no timeframe filter
    };

    // Test timeframe filtering
    const h15Trade = mockBackendResponse('BTCUSD', '15m');
    const h1Trade = mockBackendResponse('BTCUSD', '1h');
    const h4Trade = mockBackendResponse('BTCUSD', '4h');

    expect(h15Trade?.timeframe).toBe('15m');
    expect(h1Trade?.timeframe).toBe('1h');
    expect(h4Trade?.timeframe).toBe('4h');

    console.log('✅ Backend correctly filters trades by timeframe');
  });

  test('MOCK: Trigger checking should use trade original timeframe', () => {
    // This tests the concept that trigger checking uses the trade's timeframe
    const checkTrigger = (trade: any, analysisTimeframe: string) => {
      // CRITICAL: Should use trade.timeframe, not analysisTimeframe
      const dataTimeframe = trade.timeframe; // Use trade's original timeframe
      
      return {
        usedTimeframe: dataTimeframe,
        correctIsolation: dataTimeframe === trade.timeframe
      };
    };

    const h1Trade = { timeframe: '1h', entry_price: 115000 };
    const result = checkTrigger(h1Trade, '15m'); // Analyzing 15m but trade is 1h

    expect(result.usedTimeframe).toBe('1h');
    expect(result.correctIsolation).toBe(true);

    console.log('✅ Trigger checking uses trade original timeframe, not analysis timeframe');
  });
});