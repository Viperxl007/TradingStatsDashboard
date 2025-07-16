import { HyperliquidTrade } from '../context/HyperliquidContext';

// Interface matching the original TrendsView expected format
export interface TokenTrendData {
  token: string;
  recentPerformance: number;
  totalProfitLoss: number;
  priceChange: number;
  winRate: number;
  totalTrades: number;
  totalVolume: number;
  averageHoldingTime: number;
  volatility: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface TrendsData {
  trendingTokens: TokenTrendData[];
  underperformingTokens: TokenTrendData[];
}

/**
 * Transforms Hyperliquid trade data into the format expected by the original TrendsView
 */
export const adaptHyperliquidToTrends = (trades: HyperliquidTrade[]): TrendsData => {
  if (!trades || trades.length === 0) {
    return {
      trendingTokens: [],
      underperformingTokens: []
    };
  }

  // Group trades by coin
  const coinStats: Record<string, {
    trades: HyperliquidTrade[];
    totalPnL: number;
    totalVolume: number;
    winningTrades: number;
    recentTrades: HyperliquidTrade[];
  }> = {};

  // Define "recent" as last 7 days
  const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);

  trades.forEach(trade => {
    if (!coinStats[trade.coin]) {
      coinStats[trade.coin] = {
        trades: [],
        totalPnL: 0,
        totalVolume: 0,
        winningTrades: 0,
        recentTrades: []
      };
    }

    const stats = coinStats[trade.coin];
    stats.trades.push(trade);
    stats.totalPnL += trade.closed_pnl || 0;
    stats.totalVolume += trade.px * trade.sz;
    
    if ((trade.closed_pnl || 0) > 0) {
      stats.winningTrades++;
    }

    // Check if trade is recent (convert trade.time from seconds to milliseconds if needed)
    const tradeTime = trade.time > 1000000000000 ? trade.time : trade.time * 1000;
    if (tradeTime >= recentCutoff) {
      stats.recentTrades.push(trade);
    }
  });

  // Transform to TokenTrendData format
  const tokenTrends: TokenTrendData[] = Object.entries(coinStats).map(([coin, stats]) => {
    const totalTrades = stats.trades.length;
    const winRate = totalTrades > 0 ? (stats.winningTrades / totalTrades) * 100 : 0;
    
    // Calculate recent performance (last 7 days P&L)
    const recentPerformance = stats.recentTrades.reduce((sum, trade) => sum + (trade.closed_pnl || 0), 0);
    
    // Calculate average holding time (simplified - using time between first and last trade)
    const sortedTrades = stats.trades.sort((a, b) => a.time - b.time);
    const firstTrade = sortedTrades[0];
    const lastTrade = sortedTrades[sortedTrades.length - 1];
    const timeSpan = lastTrade.time - firstTrade.time;
    const averageHoldingTime = totalTrades > 1 ? timeSpan / (totalTrades - 1) / (24 * 60 * 60) : 1; // Convert to days
    
    // Calculate volatility based on P&L variance
    const avgPnL = stats.totalPnL / totalTrades;
    const variance = stats.trades.reduce((sum, trade) => {
      const diff = (trade.closed_pnl || 0) - avgPnL;
      return sum + (diff * diff);
    }, 0) / totalTrades;
    const volatility = Math.sqrt(variance) / 100; // Normalize
    
    // Calculate price change percentage (recent vs historical average)
    const historicalAvgPnL = stats.totalPnL / totalTrades;
    const recentAvgPnL = stats.recentTrades.length > 0 
      ? recentPerformance / stats.recentTrades.length 
      : historicalAvgPnL;
    
    const priceChange = historicalAvgPnL !== 0 
      ? ((recentAvgPnL - historicalAvgPnL) / Math.abs(historicalAvgPnL)) * 100 
      : 0;

    // Determine trend
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (recentPerformance > 0 && priceChange > 5) {
      trend = 'up';
    } else if (recentPerformance < 0 && priceChange < -5) {
      trend = 'down';
    }

    return {
      token: coin,
      recentPerformance,
      totalProfitLoss: stats.totalPnL,
      priceChange,
      winRate,
      totalTrades,
      totalVolume: stats.totalVolume,
      averageHoldingTime: Math.max(0.1, averageHoldingTime), // Minimum 0.1 days
      volatility: Math.min(20, Math.max(1, volatility)), // Clamp between 1-20
      trend
    };
  });

  // Sort by recent performance and separate into trending up/down
  const sortedByPerformance = tokenTrends.sort((a, b) => b.recentPerformance - a.recentPerformance);
  
  // Filter and limit results
  const trendingTokens = sortedByPerformance
    .filter(token => token.recentPerformance > 0 && token.totalTrades >= 1)
    .slice(0, 5); // Top 5 trending

  const underperformingTokens = sortedByPerformance
    .filter(token => token.recentPerformance < 0 && token.totalTrades >= 1)
    .reverse() // Worst performers first
    .slice(0, 5); // Top 5 underperforming

  return {
    trendingTokens,
    underperformingTokens
  };
};

/**
 * Helper function to format currency values
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Helper function to format percentage values
 */
export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

/**
 * Helper function to get trend color
 */
export const getTrendColor = (trend: 'up' | 'down' | 'neutral'): string => {
  switch (trend) {
    case 'up': return 'green.500';
    case 'down': return 'red.500';
    default: return 'gray.500';
  }
};