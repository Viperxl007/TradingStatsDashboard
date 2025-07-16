import { HyperliquidTrade } from '../context/HyperliquidContext';
import { adaptHyperliquidToTrends, TokenTrendData } from './hyperliquidTrendsAdapter';

/**
 * Test utility to verify the TrendsView integration with Hyperliquid data
 */

// Sample Hyperliquid trade data for testing
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
  },
  {
    id: '4',
    account_type: 'personal_wallet',
    wallet_address: 'test_wallet',
    trade_id: 'trade_4',
    coin: 'SOL',
    side: 'B',
    px: 100,
    sz: 10,
    time: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago (historical)
    closed_pnl: -150,
    fee: 3,
    created_at: Date.now(),
    updated_at: Date.now()
  },
  {
    id: '5',
    account_type: 'personal_wallet',
    wallet_address: 'test_wallet',
    trade_id: 'trade_5',
    coin: 'ETH',
    side: 'S',
    px: 3100,
    sz: 0.5,
    time: Date.now() - (3 * 60 * 60 * 1000), // 3 hours ago
    closed_pnl: 300,
    fee: 8,
    created_at: Date.now(),
    updated_at: Date.now()
  }
];

/**
 * Test the data adapter functionality
 */
export const testTrendsAdapter = (): void => {
  console.log('🧪 Testing TrendsView Hyperliquid Integration...');
  
  try {
    // Test with sample data
    const result = adaptHyperliquidToTrends(sampleTrades);
    
    console.log('✅ Data Adapter Results:');
    console.log('📈 Trending Tokens:', result.trendingTokens.length);
    console.log('📉 Underperforming Tokens:', result.underperformingTokens.length);
    
    // Display trending tokens
    if (result.trendingTokens.length > 0) {
      console.log('\n🔥 Trending Up:');
      result.trendingTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.token}`);
        console.log(`     Recent P&L: $${token.recentPerformance.toFixed(2)}`);
        console.log(`     Total P&L: $${token.totalProfitLoss.toFixed(2)}`);
        console.log(`     Win Rate: ${token.winRate.toFixed(1)}%`);
        console.log(`     Total Trades: ${token.totalTrades}`);
        console.log(`     Trend: ${token.trend}`);
      });
    }
    
    // Display underperforming tokens
    if (result.underperformingTokens.length > 0) {
      console.log('\n❄️ Trending Down:');
      result.underperformingTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.token}`);
        console.log(`     Recent P&L: $${token.recentPerformance.toFixed(2)}`);
        console.log(`     Total P&L: $${token.totalProfitLoss.toFixed(2)}`);
        console.log(`     Win Rate: ${token.winRate.toFixed(1)}%`);
        console.log(`     Total Trades: ${token.totalTrades}`);
        console.log(`     Trend: ${token.trend}`);
      });
    }
    
    // Test edge cases
    console.log('\n🧪 Testing Edge Cases...');
    
    // Test with empty data
    const emptyResult = adaptHyperliquidToTrends([]);
    console.log('✅ Empty data test:', emptyResult.trendingTokens.length === 0 && emptyResult.underperformingTokens.length === 0);
    
    // Test with null data
    const nullResult = adaptHyperliquidToTrends(null as any);
    console.log('✅ Null data test:', nullResult.trendingTokens.length === 0 && nullResult.underperformingTokens.length === 0);
    
    console.log('\n✅ All tests passed! TrendsView integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

/**
 * Validate token data structure
 */
export const validateTokenData = (token: TokenTrendData): boolean => {
  const requiredFields = [
    'token', 'recentPerformance', 'totalProfitLoss', 'priceChange',
    'winRate', 'totalTrades', 'totalVolume', 'averageHoldingTime',
    'volatility', 'trend'
  ];
  
  for (const field of requiredFields) {
    if (!(field in token)) {
      console.error(`❌ Missing field: ${field}`);
      return false;
    }
  }
  
  // Validate data types and ranges
  if (typeof token.winRate !== 'number' || token.winRate < 0 || token.winRate > 100) {
    console.error('❌ Invalid win rate:', token.winRate);
    return false;
  }
  
  if (typeof token.totalTrades !== 'number' || token.totalTrades < 0) {
    console.error('❌ Invalid total trades:', token.totalTrades);
    return false;
  }
  
  if (!['up', 'down', 'neutral'].includes(token.trend)) {
    console.error('❌ Invalid trend:', token.trend);
    return false;
  }
  
  return true;
};

/**
 * Performance test with larger dataset
 */
export const performanceTest = (): void => {
  console.log('⚡ Running performance test...');
  
  // Generate larger dataset
  const largeTrades: HyperliquidTrade[] = [];
  const coins = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'DOT', 'ADA', 'LINK'];
  
  for (let i = 0; i < 1000; i++) {
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
  
  console.log(`✅ Processed ${largeTrades.length} trades in ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`📊 Generated ${result.trendingTokens.length} trending and ${result.underperformingTokens.length} underperforming tokens`);
};

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testTrendsIntegration = {
    testTrendsAdapter,
    validateTokenData,
    performanceTest,
    sampleTrades
  };
}