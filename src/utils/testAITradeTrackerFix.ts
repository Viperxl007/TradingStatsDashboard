/**
 * Comprehensive test to verify AI Trade Tracker percentage-based fixes
 * Tests that all statistics panels show meaningful data instead of hardcoded zeros
 */

import { AITradeStatisticsCalculator } from '../services/aiTradeStatisticsCalculator';
import { AITradeEntry } from '../types/aiTradeTracker';

// Sample test data with realistic AI trade entries
const sampleTrades: AITradeEntry[] = [
  {
    id: 'test-1',
    analysisId: 'analysis-1',
    ticker: 'AAPL',
    timeframe: '1d',
    aiModel: 'gpt-4',
    confidence: 0.85,
    confidenceLevel: 'high',
    sentiment: 'bullish',
    action: 'buy',
    entryPrice: 150.00,
    reasoning: 'Strong technical indicators',
    status: 'closed',
    entryDate: new Date('2024-01-15T10:00:00Z').getTime(),
    exitDate: new Date('2024-01-22T10:00:00Z').getTime(),
    exitPrice: 165.00,
    profitLoss: 150.00,
    profitLossPercentage: 10.0, // 10% gain
    positionSizeUSD: 1000,
    entryPriceUSD: 150.00,
    exitPriceUSD: 165.00,
    holdTime: 7 * 24, // 7 days in hours
    priceAtRecommendation: 150.00,
    createdAt: new Date('2024-01-15T10:00:00Z').getTime(),
    updatedAt: new Date('2024-01-22T10:00:00Z').getTime()
  },
  {
    id: 'test-2',
    analysisId: 'analysis-2',
    ticker: 'TSLA',
    timeframe: '4h',
    aiModel: 'claude-3',
    confidence: 0.65,
    confidenceLevel: 'medium',
    sentiment: 'bearish',
    action: 'sell',
    entryPrice: 200.00,
    reasoning: 'Overbought conditions',
    status: 'closed',
    entryDate: new Date('2024-01-20T14:30:00Z').getTime(),
    exitDate: new Date('2024-01-23T14:30:00Z').getTime(),
    exitPrice: 180.00,
    profitLoss: 200.00,
    profitLossPercentage: 10.0, // 10% gain (short position)
    positionSizeUSD: 1000,
    entryPriceUSD: 200.00,
    exitPriceUSD: 180.00,
    holdTime: 3 * 24, // 3 days in hours
    priceAtRecommendation: 200.00,
    createdAt: new Date('2024-01-20T14:30:00Z').getTime(),
    updatedAt: new Date('2024-01-23T14:30:00Z').getTime()
  },
  {
    id: 'test-3',
    analysisId: 'analysis-3',
    ticker: 'NVDA',
    timeframe: '1h',
    aiModel: 'gpt-4',
    confidence: 0.95,
    confidenceLevel: 'very_high',
    sentiment: 'bullish',
    action: 'buy',
    entryPrice: 500.00,
    reasoning: 'AI sector momentum',
    status: 'closed',
    entryDate: new Date('2024-01-25T09:15:00Z').getTime(),
    exitDate: new Date('2024-01-27T09:15:00Z').getTime(),
    exitPrice: 475.00,
    profitLoss: -125.00,
    profitLossPercentage: -5.0, // 5% loss
    positionSizeUSD: 1000,
    entryPriceUSD: 500.00,
    exitPriceUSD: 475.00,
    holdTime: 2 * 24, // 2 days in hours
    priceAtRecommendation: 500.00,
    createdAt: new Date('2024-01-25T09:15:00Z').getTime(),
    updatedAt: new Date('2024-01-27T09:15:00Z').getTime()
  },
  {
    id: 'test-4',
    analysisId: 'analysis-4',
    ticker: 'MSFT',
    timeframe: '1d',
    aiModel: 'claude-3',
    confidence: 0.35,
    confidenceLevel: 'low',
    sentiment: 'bullish',
    action: 'buy',
    entryPrice: 300.00,
    reasoning: 'Weak signal but testing',
    status: 'open',
    entryDate: new Date('2024-02-01T11:00:00Z').getTime(),
    positionSizeUSD: 1000,
    entryPriceUSD: 300.00,
    priceAtRecommendation: 300.00,
    createdAt: new Date('2024-02-01T11:00:00Z').getTime(),
    updatedAt: new Date('2024-02-01T11:00:00Z').getTime()
  }
];

export function testAITradeTrackerFix(): void {
  console.log('🧪 Testing AI Trade Tracker Percentage-Based Fixes');
  console.log('=' .repeat(60));

  // Test centralized statistics calculator
  const stats = AITradeStatisticsCalculator.calculateStatistics(sampleTrades);

  console.log('\n📊 BASIC STATISTICS:');
  console.log(`Total Recommendations: ${stats.totalRecommendations}`);
  console.log(`Active Trades: ${stats.activeTrades}`);
  console.log(`Closed Trades: ${stats.closedTrades}`);
  console.log(`Win Rate: ${stats.winRate.toFixed(2)}%`);
  console.log(`Total Return: ${stats.totalReturn.toFixed(2)}%`);
  console.log(`Average Return: ${stats.averageReturn.toFixed(2)}%`);
  console.log(`Best Trade: ${stats.bestTrade.toFixed(2)}%`);
  console.log(`Worst Trade: ${stats.worstTrade.toFixed(2)}%`);
  console.log(`Sharpe Ratio: ${stats.sharpeRatio.toFixed(3)}`);
  console.log(`Max Drawdown: ${stats.maxDrawdown.toFixed(2)}%`);
  console.log(`Profit Factor: ${stats.profitFactor.toFixed(2)}`);

  console.log('\n🎯 CONFIDENCE LEVEL BREAKDOWN:');
  Object.entries(stats.byConfidence).forEach(([level, data]) => {
    console.log(`${level.toUpperCase()}: ${data.count} trades, ${data.winRate.toFixed(1)}% win rate, ${data.totalReturn.toFixed(2)}% total return`);
  });

  console.log('\n🤖 MODEL PERFORMANCE:');
  Object.entries(stats.byModel).forEach(([model, data]) => {
    console.log(`${model}: ${data.totalRecommendations} trades, ${data.winRate.toFixed(1)}% win rate, ${data.totalReturn.toFixed(2)}% total return`);
  });

  console.log('\n📈 TICKER PERFORMANCE:');
  Object.entries(stats.byTicker).forEach(([ticker, data]) => {
    console.log(`${ticker}: ${data.totalTrades} trades, ${data.winRate.toFixed(1)}% win rate, ${data.totalReturn.toFixed(2)}% total return`);
  });

  console.log('\n⏰ TIMEFRAME ANALYSIS:');
  Object.entries(stats.byTimeframe).forEach(([timeframe, data]) => {
    console.log(`${timeframe}: ${data.count} trades, ${data.winRate.toFixed(1)}% win rate, ${data.totalReturn.toFixed(2)}% total return`);
  });

  console.log('\n📅 RECENT TRENDS:');
  console.log(`Last 7 Days: ${stats.recentTrends.last7Days.trades} trades, ${stats.recentTrends.last7Days.totalReturn.toFixed(2)}% return`);
  console.log(`Last 30 Days: ${stats.recentTrends.last30Days.trades} trades, ${stats.recentTrends.last30Days.totalReturn.toFixed(2)}% return`);
  console.log(`Last 90 Days: ${stats.recentTrends.last90Days.trades} trades, ${stats.recentTrends.last90Days.totalReturn.toFixed(2)}% return`);

  // Verify no hardcoded zeros
  console.log('\n✅ VERIFICATION CHECKS:');
  
  const hasRealConfidenceData = Object.values(stats.byConfidence).some(data => data.count > 0);
  console.log(`Confidence Level Data: ${hasRealConfidenceData ? '✅ REAL DATA' : '❌ STILL ZEROS'}`);
  
  const hasRealModelData = Object.keys(stats.byModel).length > 0;
  console.log(`Model Performance Data: ${hasRealModelData ? '✅ REAL DATA' : '❌ STILL ZEROS'}`);
  
  const hasRealTickerData = Object.keys(stats.byTicker).length > 0;
  console.log(`Ticker Performance Data: ${hasRealTickerData ? '✅ REAL DATA' : '❌ STILL ZEROS'}`);
  
  const hasValidWinRate = stats.winRate > 0 && stats.winRate <= 100;
  console.log(`Win Rate Calculation: ${hasValidWinRate ? '✅ VALID' : '❌ INVALID'}`);
  
  const hasValidSharpeRatio = !isNaN(stats.sharpeRatio) && isFinite(stats.sharpeRatio);
  console.log(`Sharpe Ratio Calculation: ${hasValidSharpeRatio ? '✅ VALID' : '❌ INVALID'}`);
  
  const hasValidProfitFactor = stats.profitFactor > 0 && isFinite(stats.profitFactor);
  console.log(`Profit Factor Calculation: ${hasValidProfitFactor ? '✅ VALID' : '❌ INVALID'}`);

  console.log('\n🎉 AI Trade Tracker Fix Test Complete!');
  console.log('=' .repeat(60));
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testAITradeTrackerFix = testAITradeTrackerFix;
}