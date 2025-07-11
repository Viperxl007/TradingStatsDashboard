import { TradeData } from '../types';
import { HyperliquidTrade } from '../context/HyperliquidContext';
import { format } from 'date-fns';

/**
 * Transform Hyperliquid trade data to TradeData format for Performance Analysis
 * This service provides a clean transformation layer without altering the original database data
 */

/**
 * Convert a single Hyperliquid trade to TradeData format
 * @param hyperliquidTrade - Raw trade from Hyperliquid database
 * @returns TradeData object compatible with Performance Analysis
 */
export const transformHyperliquidTrade = (hyperliquidTrade: HyperliquidTrade): TradeData => {
  // Convert timestamp from milliseconds to date string
  const date = format(new Date(hyperliquidTrade.time), 'yyyy-MM-dd');
  
  // Determine trade type based on side
  const type: 'buy' | 'sell' = hyperliquidTrade.side.toLowerCase() === 'b' ? 'buy' : 'sell';
  
  // Calculate total value (price * size)
  const totalValue = hyperliquidTrade.px * hyperliquidTrade.sz;
  
  // Use closed_pnl if available, otherwise 0
  const profitLoss = hyperliquidTrade.closed_pnl || 0;
  
  // Use fee if available, otherwise 0
  const fees = hyperliquidTrade.fee || 0;
  
  return {
    id: hyperliquidTrade.trade_id,
    token: hyperliquidTrade.coin.toUpperCase(),
    date,
    timestamp: hyperliquidTrade.time,
    type,
    amount: hyperliquidTrade.sz,
    price: hyperliquidTrade.px,
    totalValue,
    profitLoss,
    fees,
    exchange: hyperliquidTrade.dir || `${type} ${hyperliquidTrade.coin}`,
    notes: `Hyperliquid ${type} trade`
  };
};

/**
 * Transform an array of Hyperliquid trades to TradeData format
 * @param hyperliquidTrades - Array of trades from Hyperliquid database
 * @returns Array of TradeData objects
 */
export const transformHyperliquidTrades = (hyperliquidTrades: HyperliquidTrade[]): TradeData[] => {
  return hyperliquidTrades
    .map(transformHyperliquidTrade)
    .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending (newest first)
};

/**
 * Calculate token performance from Hyperliquid trades
 * @param hyperliquidTrades - Array of trades from Hyperliquid database
 * @returns Token performance data compatible with Performance Analysis
 */
export const calculateTokenPerformanceFromHyperliquid = (hyperliquidTrades: HyperliquidTrade[]) => {
  const tokenGroups = hyperliquidTrades.reduce((acc, trade) => {
    const token = trade.coin.toUpperCase();
    if (!acc[token]) {
      acc[token] = [];
    }
    acc[token].push(trade);
    return acc;
  }, {} as Record<string, HyperliquidTrade[]>);

  return Object.keys(tokenGroups).map(token => {
    const trades = tokenGroups[token];
    const totalTrades = trades.length;
    
    // Filter for closing trades to calculate win rate
    const closingTrades = trades.filter(trade => 
      trade.closed_pnl !== null && trade.closed_pnl !== undefined
    );
    
    const winningTrades = closingTrades.filter(trade => (trade.closed_pnl || 0) > 0).length;
    const winRate = closingTrades.length > 0 ? (winningTrades / closingTrades.length) * 100 : 0;
    
    const totalProfitLoss = trades.reduce((sum, trade) => sum + (trade.closed_pnl || 0), 0);
    const averageProfitLoss = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;
    const totalVolume = trades.reduce((sum, trade) => sum + (trade.px * trade.sz), 0);
    
    return {
      token,
      totalTrades,
      winningTrades,
      winRate,
      totalProfitLoss,
      averageProfitLoss,
      totalVolume
    };
  });
};

/**
 * Get account summary from Hyperliquid trades
 * @param hyperliquidTrades - Array of trades from Hyperliquid database
 * @returns Account summary data
 */
export const getAccountSummaryFromHyperliquid = (hyperliquidTrades: HyperliquidTrade[]) => {
  const totalTrades = hyperliquidTrades.length;
  const uniqueTokens = new Set(hyperliquidTrades.map(trade => trade.coin.toUpperCase())).size;
  
  const closingTrades = hyperliquidTrades.filter(trade => 
    trade.closed_pnl !== null && trade.closed_pnl !== undefined
  );
  
  const totalProfitLoss = hyperliquidTrades.reduce((sum, trade) => sum + (trade.closed_pnl || 0), 0);
  const totalFees = hyperliquidTrades.reduce((sum, trade) => sum + (trade.fee || 0), 0);
  const netProfitLoss = totalProfitLoss - totalFees;
  
  const winningTrades = closingTrades.filter(trade => (trade.closed_pnl || 0) > 0).length;
  const winRate = closingTrades.length > 0 ? (winningTrades / closingTrades.length) * 100 : 0;
  
  const averageProfitLoss = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;
  
  // Calculate token performance for best/worst/most traded
  const tokenPerformance = calculateTokenPerformanceFromHyperliquid(hyperliquidTrades);
  const bestPerformingToken = tokenPerformance.reduce((best, current) => 
    current.totalProfitLoss > best.totalProfitLoss ? current : best, 
    tokenPerformance[0] || { token: '', totalProfitLoss: 0 }
  ).token;
  
  const worstPerformingToken = tokenPerformance.reduce((worst, current) => 
    current.totalProfitLoss < worst.totalProfitLoss ? current : worst, 
    tokenPerformance[0] || { token: '', totalProfitLoss: 0 }
  ).token;
  
  const mostTradedToken = tokenPerformance.reduce((most, current) => 
    current.totalTrades > most.totalTrades ? current : most, 
    tokenPerformance[0] || { token: '', totalTrades: 0 }
  ).token;
  
  // Calculate average trades per day
  const tradeDates = hyperliquidTrades.map(trade => format(new Date(trade.time), 'yyyy-MM-dd'));
  const uniqueDates = new Set(tradeDates).size;
  const averageTradesPerDay = uniqueDates > 0 ? totalTrades / uniqueDates : 0;
  
  return {
    totalTrades,
    uniqueTokens,
    totalProfitLoss,
    averageProfitLoss,
    winRate,
    bestPerformingToken,
    worstPerformingToken,
    mostTradedToken,
    averageTradesPerDay,
    totalFees,
    netProfitLoss,
    monthlyPerformance: [] // This would need additional calculation if required
  };
};