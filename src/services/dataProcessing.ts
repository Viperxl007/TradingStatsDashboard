import { 
  TradeData, 
  TokenPerformance, 
  AccountSummary, 
  MonthlyPerformance,
  TimeframePerformance
} from '../types';
import * as dateFns from 'date-fns';
import * as _ from 'lodash';

/**
 * Calculate account summary metrics
 * @param data Array of TradeData objects
 * @returns AccountSummary object
 */
export const calculateAccountSummary = (data: TradeData[]): AccountSummary => {
  if (!data.length) {
    return createEmptyAccountSummary();
  }

  const totalTrades = data.length;
  
  // Calculate unique tokens
  const uniqueTokens = new Set(data.map(trade => trade.token)).size;
  
  // Calculate profit/loss metrics - only consider closing trades with actual P/L
  // Filter out opening trades where P/L is just the negative of the fee
  const closingTrades = data.filter(trade => {
    // Exclude any trade with "open" in the exchange field regardless of type
    if (trade.exchange.toLowerCase().includes('open')) {
      return false;
    }
    
    // Include only sell trades or trades with "close" in the exchange field
    return trade.type === 'sell' || trade.exchange.toLowerCase().includes('close');
  });
  
  const totalProfitLoss = closingTrades.reduce((acc, trade) => acc + trade.profitLoss, 0);
  const averageProfitLoss = closingTrades.length > 0
    ? totalProfitLoss / closingTrades.length
    : 0;
  
  // Calculate win rate - only consider trades with actual P/L
  const winningTrades = closingTrades.filter(trade => trade.profitLoss > 0).length;
  const winRate = closingTrades.length > 0
    ? (winningTrades / closingTrades.length) * 100
    : 0;
  
  // Calculate token performance
  const tokenPerformance = analyzeTokenPerformance(data);
  
  // Find best and worst performing tokens
  let bestPerformingToken = 'UNKNOWN';
  let worstPerformingToken = 'UNKNOWN';
  let mostTradedToken = 'UNKNOWN';
  
  if (tokenPerformance.length > 0) {
    // Filter tokens with at least one closing trade (with actual profit/loss)
    const tokensWithProfitLoss = tokenPerformance.filter(token =>
      token.sellTrades > 0 && Math.abs(token.totalProfitLoss) > 0.01
    );
    
    if (tokensWithProfitLoss.length > 0) {
      // Sort by total profit/loss
      const sortedByProfitLoss = [...tokensWithProfitLoss].sort((a, b) => b.totalProfitLoss - a.totalProfitLoss);
      bestPerformingToken = sortedByProfitLoss[0].token;
      worstPerformingToken = sortedByProfitLoss[sortedByProfitLoss.length - 1].token;
    }
    
    // Sort by total trades
    const sortedByTrades = [...tokenPerformance].sort((a, b) => b.totalTrades - a.totalTrades);
    mostTradedToken = sortedByTrades[0].token;
  }
  
  // Calculate total fees
  const totalFees = data.reduce((acc, trade) => acc + trade.fees, 0);
  
  // Calculate net profit/loss
  const netProfitLoss = totalProfitLoss;  // Don't subtract fees as they're already accounted for in the P/L
  
  // Calculate average trades per day
  const dates = data.map(trade => dateFns.parseISO(trade.date));
  const minDate = new Date(Math.min(...dates.map(date => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map(date => date.getTime())));
  const tradingDays = dateFns.differenceInDays(maxDate, minDate) + 1;
  const averageTradesPerDay = tradingDays > 0 ? totalTrades / tradingDays : totalTrades;
  
  // Calculate monthly performance
  const monthlyPerformance = calculateMonthlyPerformance(data);
  
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
    monthlyPerformance
  };
};

/**
 * Create an empty account summary object
 * @returns Empty AccountSummary object
 */
const createEmptyAccountSummary = (): AccountSummary => ({
  totalTrades: 0,
  uniqueTokens: 0,
  totalProfitLoss: 0,
  averageProfitLoss: 0,
  winRate: 0,
  bestPerformingToken: '',
  worstPerformingToken: '',
  mostTradedToken: '',
  averageTradesPerDay: 0,
  totalFees: 0,
  netProfitLoss: 0,
  monthlyPerformance: []
});

/**
 * Analyze performance of each token
 * @param data Array of TradeData objects
 * @returns Array of TokenPerformance objects
 */
export const analyzeTokenPerformance = (data: TradeData[]): TokenPerformance[] => {
  // Group trades by token
  const tradesByToken: Record<string, TradeData[]> = {};
  
  // Manually group trades by token
  data.forEach(trade => {
    if (!tradesByToken[trade.token]) {
      tradesByToken[trade.token] = [];
    }
    tradesByToken[trade.token].push(trade);
  });
  
  // Calculate performance metrics for each token
  return Object.entries(tradesByToken).map(([token, trades]) => {
    const totalTrades = trades.length;
    const buyTrades = trades.filter(trade => trade.type === 'buy').length;
    const sellTrades = trades.filter(trade => trade.type === 'sell').length;
    
    // Calculate total volume
    const totalVolume = trades.reduce((acc, trade) => acc + trade.totalValue, 0);
    
    // Calculate profit/loss metrics - only consider closing trades with actual P/L
    const closingTrades = trades.filter(trade => {
      // Exclude any trade with "open" in the exchange field regardless of type
      if (trade.exchange.toLowerCase().includes('open')) {
        return false;
      }
      
      // Include only sell trades or trades with "close" in the exchange field
      return trade.type === 'sell' || trade.exchange.toLowerCase().includes('close');
    });
    
    const totalProfitLoss = closingTrades.reduce((acc, trade) => acc + trade.profitLoss, 0);
    const averageProfitLoss = closingTrades.length > 0
      ? totalProfitLoss / closingTrades.length
      : 0;
    
    // Calculate win rate - only consider trades with actual P/L
    const winningTrades = closingTrades.filter(trade => trade.profitLoss > 0).length;
    const winRate = closingTrades.length > 0
      ? (winningTrades / closingTrades.length) * 100
      : 0;
    
    // Calculate average holding time
    const holdingTimes: number[] = [];
    const buyTradesMap = new Map<string, TradeData[]>();
    
    // Group buy trades by token amount for matching
    trades.filter(trade => trade.type === 'buy').forEach(buyTrade => {
      const key = `${buyTrade.amount.toFixed(8)}`;
      if (!buyTradesMap.has(key)) {
        buyTradesMap.set(key, []);
      }
      buyTradesMap.get(key)!.push(buyTrade);
    });
    
    // Match sell trades with buy trades to calculate holding time
    trades.filter(trade => trade.type === 'sell').forEach(sellTrade => {
      const key = `${sellTrade.amount.toFixed(8)}`;
      if (buyTradesMap.has(key) && buyTradesMap.get(key)!.length > 0) {
        // Sort buy trades by date (oldest first) to match FIFO
        const buyTradesForAmount = buyTradesMap.get(key)!.sort(
          (a, b) => dateFns.parseISO(a.date).getTime() - dateFns.parseISO(b.date).getTime()
        );
        
        // Get the oldest buy trade
        const buyTrade = buyTradesForAmount.shift()!;
        
        const buyDate = dateFns.parseISO(buyTrade.date);
        const sellDate = dateFns.parseISO(sellTrade.date);
        const holdingTime = dateFns.differenceInDays(sellDate, buyDate);
        
        if (holdingTime >= 0) {
          holdingTimes.push(holdingTime);
        }
        
        // Update the map with remaining buy trades
        buyTradesMap.set(key, buyTradesForAmount);
      }
    });
    
    const averageHoldingTime = holdingTimes.length > 0
      ? holdingTimes.reduce((acc, time) => acc + time, 0) / holdingTimes.length
      : 0;
    
    // Calculate recent performance (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = dateFns.subDays(now, 30);
    const recentTrades = trades.filter(trade => {
      const tradeDate = dateFns.parseISO(trade.date);
      return dateFns.isWithinInterval(tradeDate, { start: thirtyDaysAgo, end: now });
    });
    
    // Calculate recent performance - only consider closing trades with actual P/L
    const recentClosingTrades = recentTrades.filter(trade =>
      trade.type === 'sell' &&
      (trade.exchange.toLowerCase().includes('close') ||
       !trade.exchange.toLowerCase().includes('open'))
    );
    
    const recentProfitLoss = recentClosingTrades.reduce((acc, trade) => acc + trade.profitLoss, 0);
    
    // Calculate price change
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const firstTrade = sortedTrades[0];
    const lastTrade = sortedTrades[sortedTrades.length - 1];
    const priceChange = firstTrade && lastTrade
      ? ((lastTrade.price - firstTrade.price) / firstTrade.price) * 100
      : 0;
    
    // Calculate volatility (standard deviation of price changes)
    const priceChanges: number[] = [];
    for (let i = 1; i < sortedTrades.length; i++) {
      const prevPrice = sortedTrades[i-1].price;
      const currentPrice = sortedTrades[i].price;
      if (prevPrice > 0) {  // Avoid division by zero
        const change = ((currentPrice - prevPrice) / prevPrice) * 100;
        priceChanges.push(change);
      }
    }
    
    const volatility = calculateStandardDeviation(priceChanges);
    
    // Determine trend
    const trend = determineTrend(recentProfitLoss, priceChange);
    
    return {
      token,
      totalTrades,
      buyTrades,
      sellTrades,
      totalVolume,
      totalProfitLoss,
      averageProfitLoss,
      winRate,
      averageHoldingTime,
      trend,
      volatility,
      recentPerformance: recentProfitLoss,
      priceChange
    };
  });
};

/**
 * Calculate standard deviation
 * @param values Array of numbers
 * @returns Standard deviation
 */
const calculateStandardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / values.length;
  
  return Math.sqrt(variance);
};

/**
 * Determine trend based on recent performance and price change
 * @param recentPerformance Recent profit/loss
 * @param priceChange Price change percentage
 * @returns Trend ('up', 'down', or 'neutral')
 */
const determineTrend = (recentPerformance: number, priceChange: number): 'up' | 'down' | 'neutral' => {
  // Normalize the inputs to handle different scales
  // For profit/loss, we consider the sign and magnitude
  const normalizedProfitLoss = recentPerformance === 0 ? 0 :
    Math.sign(recentPerformance) * Math.min(Math.abs(recentPerformance) / 100, 10);
  
  // For price change, we already have a percentage
  const normalizedPriceChange = Math.max(Math.min(priceChange / 10, 10), -10);
  
  // Weight recent performance more heavily than price change
  const trendScore = (normalizedProfitLoss * 0.7) + (normalizedPriceChange * 0.3);
  
  if (trendScore > 1) return 'up';
  if (trendScore < -1) return 'down';
  return 'neutral';
};

/**
 * Identify trending tokens with positive performance
 * @param tokenPerformance Array of TokenPerformance objects
 * @returns Array of TokenPerformance objects for trending tokens
 */
export const identifyTrendingTokens = (tokenPerformance: TokenPerformance[]): TokenPerformance[] => {
  return tokenPerformance
    .filter(token => token.trend === 'up' && token.totalTrades >= 3)
    .sort((a, b) => b.recentPerformance - a.recentPerformance);
};

/**
 * Identify underperforming tokens with negative performance
 * @param tokenPerformance Array of TokenPerformance objects
 * @returns Array of TokenPerformance objects for underperforming tokens
 */
export const identifyUnderperformingTokens = (tokenPerformance: TokenPerformance[]): TokenPerformance[] => {
  return tokenPerformance
    .filter(token => token.trend === 'down' && token.totalTrades >= 3)
    .sort((a, b) => a.recentPerformance - b.recentPerformance);
};

/**
 * Calculate monthly performance
 * @param data Array of TradeData objects
 * @returns Array of MonthlyPerformance objects
 */
export const calculateMonthlyPerformance = (data: TradeData[]): MonthlyPerformance[] => {
  // Group trades by month
  const tradesByMonth: Record<string, TradeData[]> = {};
  
  // Manually group trades by month
  data.forEach(trade => {
    const month = dateFns.format(dateFns.parseISO(trade.date), 'yyyy-MM');
    if (!tradesByMonth[month]) {
      tradesByMonth[month] = [];
    }
    tradesByMonth[month].push(trade);
  });
  
  // Calculate performance metrics for each month
  return Object.entries(tradesByMonth).map(([month, trades]) => {
    const tradesCount = trades.length;
    
    // Calculate profit/loss - only consider closing trades with actual P/L
    const closingTrades = trades.filter(trade => {
      // Exclude any trade with "open" in the exchange field regardless of type
      if (trade.exchange.toLowerCase().includes('open')) {
        return false;
      }
      
      // Include only sell trades or trades with "close" in the exchange field
      return trade.type === 'sell' || trade.exchange.toLowerCase().includes('close');
    });
    
    const profitLoss = closingTrades.reduce((acc, trade) => acc + trade.profitLoss, 0);
    
    // Calculate win rate - only consider trades with actual P/L
    const winningTrades = closingTrades.filter(trade => trade.profitLoss > 0).length;
    const winRate = closingTrades.length > 0
      ? (winningTrades / closingTrades.length) * 100
      : 0;
    
    return {
      month,
      trades: tradesCount,
      profitLoss,
      winRate
    };
  }).sort((a, b) => a.month.localeCompare(b.month));
};

/**
 * Calculate performance for a specific timeframe
 * @param data Array of TradeData objects
 * @param timeframe Timeframe label
 * @param startDate Start date of the timeframe
 * @param endDate End date of the timeframe
 * @returns TimeframePerformance object
 */
export const calculateTimeframePerformance = (
  data: TradeData[], 
  timeframe: string,
  startDate: Date,
  endDate: Date
): TimeframePerformance => {
  // Filter trades within the timeframe
  const tradesInTimeframe = data.filter(trade => {
    const tradeDate = dateFns.parseISO(trade.date);
    return dateFns.isWithinInterval(tradeDate, { start: startDate, end: endDate });
  });
  
  // Calculate trades count
  const tradesCount = tradesInTimeframe.length;
  
  // Calculate profit/loss - only consider closing trades with actual P/L
  const closingTrades = tradesInTimeframe.filter(trade => {
    // Exclude any trade with "open" in the exchange field regardless of type
    if (trade.exchange.toLowerCase().includes('open')) {
      return false;
    }
    
    // Include only sell trades or trades with "close" in the exchange field
    return trade.type === 'sell' || trade.exchange.toLowerCase().includes('close');
  });
  
  const profitLoss = closingTrades.reduce((acc, trade) => acc + trade.profitLoss, 0);
  
  // Calculate win rate - only consider trades with actual P/L
  const winningTrades = closingTrades.filter(trade => trade.profitLoss > 0).length;
  const winRate = closingTrades.length > 0
    ? (winningTrades / closingTrades.length) * 100
    : 0;
  
  // Find top performing token
  const tokenPerformance = analyzeTokenPerformance(tradesInTimeframe);
  const topToken = tokenPerformance.length > 0 
    ? tokenPerformance.sort((a, b) => b.totalProfitLoss - a.totalProfitLoss)[0].token 
    : '';
  
  return {
    timeframe,
    startDate: dateFns.format(startDate, 'yyyy-MM-dd'),
    endDate: dateFns.format(endDate, 'yyyy-MM-dd'),
    trades: tradesCount,
    profitLoss,
    winRate,
    topToken
  };
};

/**
 * Filter trades based on selected tokens, date range, and trade type
 * @param data Array of TradeData objects
 * @param selectedTokens Array of selected token symbols
 * @param dateRange Date range [start, end]
 * @param tradeType Trade type filter ('all', 'buy', or 'sell')
 * @returns Filtered array of TradeData objects
 */
export const filterTrades = (
  data: TradeData[],
  selectedTokens: string[],
  dateRange: [Date | null, Date | null],
  tradeType: 'all' | 'buy' | 'sell'
): TradeData[] => {
  return data.filter(trade => {
    // Filter by token
    if (selectedTokens.length > 0 && !selectedTokens.includes(trade.token)) {
      return false;
    }
    
    // Filter by date range
    if (dateRange[0] && dateRange[1]) {
      const tradeDate = dateFns.parseISO(trade.date);
      // Ensure start date is before or equal to end date to avoid "Invalid interval" error
      const start = dateRange[0];
      const end = dateRange[1];
      
      // If start date is after end date, swap them to create a valid interval
      const validStart = dateFns.isBefore(start, end) ? start : end;
      const validEnd = dateFns.isBefore(start, end) ? end : start;
      
      try {
        if (!dateFns.isWithinInterval(tradeDate, { start: validStart, end: validEnd })) {
          return false;
        }
      } catch (error) {
        // If there's still an error, just include the trade (don't filter it out)
        console.warn("Date filtering error:", error);
      }
    }
    
    // Filter by trade type
    if (tradeType !== 'all' && trade.type !== tradeType) {
      return false;
    }
    
    return true;
  });
};