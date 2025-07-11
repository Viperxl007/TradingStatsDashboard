import { HyperliquidTrade } from '../context/HyperliquidContext';
import { adaptHyperliquidToTrends, TokenTrendData } from './hyperliquidTrendsAdapter';

describe('TrendsView Hyperliquid Integration', () => {
  // Sample test data
  const sampleTrades: HyperliquidTrade[] = [
    {
      id: '1',
      account_type: 'personal_wallet',
      wallet_address: 'test_wallet',
      trade_id: 'trade_1',
      coin: 'BTC',
      side: 'B',
      px: 45000,
      sz: 0.1,
      time: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
      closed_pnl: 500,
      fee: 10,
      created_at: Date.now(),
      updated_at: Date.now()
    },
    {
      id: '2',
      account_type: 'personal_wallet',
      wallet_address: 'test_wallet',
      trade_id: 'trade_2',
      coin: 'ETH',
      side: 'B',
      px: 3000,
      sz: 1,
      time: Date.now() - (1 * 24 * 60 * 60 * 1000), // 1 day ago
      closed_pnl: -200,
      fee: 5,
      created_at: Date.now(),
      updated_at: Date.now()
    },
    {
      id: '3',
      account_type: 'personal_wallet',
      wallet_address: 'test_wallet',
      trade_id: 'trade_3',
      coin: 'BTC',
      side: 'S',
      px: 46000,
      sz: 0.1,
      time: Date.now() - (6 * 60 * 60 * 1000), // 6 hours ago
      closed_pnl: 800,
      fee: 12,
      created_at: Date.now(),
      updated_at: Date.now()
    }
  ];

  test('should adapt Hyperliquid trades to trends format', () => {
    const result = adaptHyperliquidToTrends(sampleTrades);
    
    expect(result).toHaveProperty('trendingTokens');
    expect(result).toHaveProperty('underperformingTokens');
    expect(Array.isArray(result.trendingTokens)).toBe(true);
    expect(Array.isArray(result.underperformingTokens)).toBe(true);
  });

  test('should handle empty trades array', () => {
    const result = adaptHyperliquidToTrends([]);
    
    expect(result.trendingTokens).toHaveLength(0);
    expect(result.underperformingTokens).toHaveLength(0);
  });

  test('should handle null/undefined trades', () => {
    const result = adaptHyperliquidToTrends(null as any);
    
    expect(result.trendingTokens).toHaveLength(0);
    expect(result.underperformingTokens).toHaveLength(0);
  });

  test('should group trades by coin correctly', () => {
    const result = adaptHyperliquidToTrends(sampleTrades);
    const allTokens = [...result.trendingTokens, ...result.underperformingTokens];
    
    // Should have BTC and ETH tokens
    const tokenNames = allTokens.map(token => token.token);
    expect(tokenNames).toContain('BTC');
    expect(tokenNames).toContain('ETH');
  });

  test('should calculate performance metrics correctly', () => {
    const result = adaptHyperliquidToTrends(sampleTrades);
    const allTokens = [...result.trendingTokens, ...result.underperformingTokens];
    
    allTokens.forEach(token => {
      // Validate required fields exist
      expect(token).toHaveProperty('token');
      expect(token).toHaveProperty('recentPerformance');
      expect(token).toHaveProperty('totalProfitLoss');
      expect(token).toHaveProperty('winRate');
      expect(token).toHaveProperty('totalTrades');
      expect(token).toHaveProperty('trend');
      
      // Validate data types
      expect(typeof token.token).toBe('string');
      expect(typeof token.recentPerformance).toBe('number');
      expect(typeof token.totalProfitLoss).toBe('number');
      expect(typeof token.winRate).toBe('number');
      expect(typeof token.totalTrades).toBe('number');
      expect(['up', 'down', 'neutral']).toContain(token.trend);
      
      // Validate ranges
      expect(token.winRate).toBeGreaterThanOrEqual(0);
      expect(token.winRate).toBeLessThanOrEqual(100);
      expect(token.totalTrades).toBeGreaterThan(0);
    });
  });

  test('should categorize tokens as trending or underperforming', () => {
    const result = adaptHyperliquidToTrends(sampleTrades);
    
    // BTC should be trending (positive recent performance: 800 - 12 = 788)
    const btcToken = [...result.trendingTokens, ...result.underperformingTokens]
      .find(token => token.token === 'BTC');
    
    expect(btcToken).toBeDefined();
    if (btcToken) {
      expect(btcToken.recentPerformance).toBeGreaterThan(0);
    }
    
    // ETH should be underperforming (negative recent performance: -200 - 5 = -205)
    const ethToken = [...result.trendingTokens, ...result.underperformingTokens]
      .find(token => token.token === 'ETH');
    
    expect(ethToken).toBeDefined();
    if (ethToken) {
      expect(ethToken.recentPerformance).toBeLessThan(0);
    }
  });

  test('should handle performance test with larger dataset', () => {
    // Generate larger dataset
    const largeTrades: HyperliquidTrade[] = [];
    const coins = ['BTC', 'ETH', 'SOL', 'AVAX'];
    
    for (let i = 0; i < 100; i++) {
      largeTrades.push({
        id: `perf_${i}`,
        account_type: 'personal_wallet',
        wallet_address: 'test_wallet',
        trade_id: `trade_${i}`,
        coin: coins[i % coins.length],
        side: Math.random() > 0.5 ? 'B' : 'S',
        px: Math.random() * 50000 + 1000,
        sz: Math.random() * 10 + 0.1,
        time: Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000),
        closed_pnl: (Math.random() - 0.5) * 1000,
        fee: Math.random() * 20 + 1,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    }
    
    const startTime = performance.now();
    const result = adaptHyperliquidToTrends(largeTrades);
    const endTime = performance.now();
    
    // Should complete within reasonable time (< 100ms for 100 trades)
    expect(endTime - startTime).toBeLessThan(100);
    
    // Should process all coins
    const allTokens = [...result.trendingTokens, ...result.underperformingTokens];
    expect(allTokens.length).toBeGreaterThan(0);
    expect(allTokens.length).toBeLessThanOrEqual(coins.length);
  });
});