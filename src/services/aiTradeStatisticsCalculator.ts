/**
 * AI Trade Statistics Calculator
 * 
 * Centralized calculation engine for all AI trade statistics.
 * Focuses on percentage-based performance metrics as the primary measurement.
 */

import {
  AITradeEntry,
  AITradeStatistics,
  AITradeConfidence,
  AIModelPerformance,
  AITokenPerformance
} from '../types/aiTradeTracker';
import { shouldCountForPerformance } from '../utils/statusMapping';

export class AITradeStatisticsCalculator {
  
  /**
   * Calculate comprehensive statistics from trade data
   */
  static calculateStatistics(trades: AITradeEntry[]): AITradeStatistics {
    console.log(`📊 [AITradeStatisticsCalculator] Calculating statistics for ${trades.length} trades`);

    // Filter trades by status - CRITICAL FIX: Only count executed trades toward performance
    const closedTrades = trades.filter(trade => shouldCountForPerformance(trade));
    
    const activeTrades = trades.filter(trade => 
      ['waiting', 'open'].includes(trade.status)
    );

    // Basic metrics using percentage-based calculations
    const winningTrades = closedTrades.filter(trade => (trade.profitLossPercentage || 0) > 0);
    const losingTrades = closedTrades.filter(trade => (trade.profitLossPercentage || 0) <= 0);

    const totalReturnPercentage = closedTrades.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const averageReturnPercentage = closedTrades.length > 0 ? totalReturnPercentage / closedTrades.length : 0;

    const bestTradePercentage = closedTrades.length > 0 ? 
      Math.max(...closedTrades.map(t => t.profitLossPercentage || 0)) : 0;
    const worstTradePercentage = closedTrades.length > 0 ? 
      Math.min(...closedTrades.map(t => t.profitLossPercentage || 0)) : 0;

    // Calculate average hold time
    const averageHoldTime = closedTrades.length > 0 
      ? closedTrades.reduce((sum, trade) => sum + (trade.holdTime || 0), 0) / closedTrades.length 
      : 0;

    // Calculate average confidence
    const averageConfidence = trades.length > 0 
      ? trades.reduce((sum, trade) => sum + trade.confidence, 0) / trades.length 
      : 0;

    // Calculate profit factor (percentage-based)
    const totalProfitPercentage = winningTrades.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);
    const totalLossPercentage = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0));
    const profitFactor = totalLossPercentage > 0 ? totalProfitPercentage / totalLossPercentage : 
      totalProfitPercentage > 0 ? Infinity : 0;

    // Calculate Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(closedTrades);

    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(closedTrades);

    // Calculate average risk/reward ratio from setup parameters
    const averageRiskReward = this.calculateAverageRiskReward(trades);

    // Performance by confidence level
    const byConfidence = this.calculateConfidencePerformance(closedTrades);

    // Performance by timeframe
    const byTimeframe = this.calculateTimeframePerformance(closedTrades);

    // Performance by AI model
    const byModel = this.calculateModelPerformance(trades);

    // Performance by ticker
    const byTicker = this.calculateTickerPerformance(trades);

    // Monthly performance
    const monthlyPerformance = this.calculateMonthlyPerformance(closedTrades);

    // Recent trends
    const recentTrends = this.calculateRecentTrends(closedTrades);

    const statistics: AITradeStatistics = {
      totalRecommendations: trades.length,
      activeTrades: activeTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalReturn: totalReturnPercentage, // Now percentage-based
      averageReturn: averageReturnPercentage, // Now percentage-based
      bestTrade: bestTradePercentage, // Now percentage-based
      worstTrade: worstTradePercentage, // Now percentage-based
      averageHoldTime,
      averageConfidence,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      averageRiskReward,
      byConfidence,
      byTimeframe,
      byModel,
      byTicker,
      monthlyPerformance,
      recentTrends
    };

    console.log(`✅ [AITradeStatisticsCalculator] Statistics calculated - Win Rate: ${winRate.toFixed(1)}%, Total Return: ${totalReturnPercentage.toFixed(2)}%`);
    return statistics;
  }

  /**
   * Calculate Sharpe ratio using percentage returns
   */
  private static calculateSharpeRatio(trades: AITradeEntry[]): number {
    if (trades.length === 0) return 0;

    const returns = trades.map(trade => trade.profitLossPercentage || 0);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  /**
   * Calculate maximum drawdown using percentage returns
   */
  private static calculateMaxDrawdown(trades: AITradeEntry[]): number {
    if (trades.length === 0) return 0;

    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;
    
    // Sort trades by exit date
    const sortedTrades = trades
      .filter(trade => trade.exitDate)
      .sort((a, b) => (a.exitDate || 0) - (b.exitDate || 0));
    
    for (const trade of sortedTrades) {
      runningTotal += trade.profitLossPercentage || 0;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate average risk/reward ratio from trade setup parameters
   * Uses theoretical entry, target, and stop loss prices to determine setup quality
   */
  private static calculateAverageRiskReward(trades: AITradeEntry[]): number {
    if (trades.length === 0) return 0;

    // Filter trades that have all required setup parameters
    const tradesWithSetup = trades.filter(trade =>
      trade.entryPrice &&
      trade.targetPrice &&
      trade.stopLoss &&
      trade.entryPrice !== trade.targetPrice &&
      trade.entryPrice !== trade.stopLoss
    );

    if (tradesWithSetup.length === 0) return 0;

    const riskRewardRatios = tradesWithSetup.map(trade => {
      const entryPrice = trade.entryPrice!;
      const targetPrice = trade.targetPrice!;
      const stopLoss = trade.stopLoss!;

      // Calculate potential reward and risk based on trade direction
      let potentialReward: number;
      let potentialRisk: number;

      if (trade.action === 'buy') {
        // For long positions: reward = target - entry, risk = entry - stop
        potentialReward = Math.abs(targetPrice - entryPrice);
        potentialRisk = Math.abs(entryPrice - stopLoss);
      } else {
        // For short positions: reward = entry - target, risk = stop - entry
        potentialReward = Math.abs(entryPrice - targetPrice);
        potentialRisk = Math.abs(stopLoss - entryPrice);
      }

      // Calculate R/R ratio (reward divided by risk)
      return potentialRisk > 0 ? potentialReward / potentialRisk : 0;
    });

    // Return average R/R ratio
    const totalRR = riskRewardRatios.reduce((sum, rr) => sum + rr, 0);
    return totalRR / riskRewardRatios.length;
  }

  /**
   * Calculate performance by confidence level
   */
  private static calculateConfidencePerformance(trades: AITradeEntry[]): Record<AITradeConfidence, any> {
    const byConfidence: Record<AITradeConfidence, any> = {
      low: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
      medium: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
      high: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
      very_high: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 }
    };

    for (const confidence of Object.keys(byConfidence) as AITradeConfidence[]) {
      const confidenceTrades = trades.filter(trade => trade.confidenceLevel === confidence);
      const confWinning = confidenceTrades.filter(trade => (trade.profitLossPercentage || 0) > 0);
      const confTotal = confidenceTrades.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);

      byConfidence[confidence] = {
        count: confidenceTrades.length,
        winRate: confidenceTrades.length > 0 ? (confWinning.length / confidenceTrades.length) * 100 : 0,
        averageReturn: confidenceTrades.length > 0 ? confTotal / confidenceTrades.length : 0,
        totalReturn: confTotal
      };
    }

    return byConfidence;
  }

  /**
   * Calculate performance by timeframe
   */
  private static calculateTimeframePerformance(trades: AITradeEntry[]): Record<string, any> {
    const byTimeframe: Record<string, any> = {};
    const timeframes = [...new Set(trades.map(trade => trade.timeframe))];
    
    for (const timeframe of timeframes) {
      const timeframeTrades = trades.filter(trade => trade.timeframe === timeframe);
      const tfWinning = timeframeTrades.filter(trade => (trade.profitLossPercentage || 0) > 0);
      const tfTotal = timeframeTrades.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);

      byTimeframe[timeframe] = {
        count: timeframeTrades.length,
        winRate: timeframeTrades.length > 0 ? (tfWinning.length / timeframeTrades.length) * 100 : 0,
        averageReturn: timeframeTrades.length > 0 ? tfTotal / timeframeTrades.length : 0,
        totalReturn: tfTotal
      };
    }

    return byTimeframe;
  }

  /**
   * Calculate performance by AI model
   */
  private static calculateModelPerformance(allTrades: AITradeEntry[]): Record<string, AIModelPerformance> {
    const byModel: Record<string, AIModelPerformance> = {};
    const models = [...new Set(allTrades.map(trade => trade.aiModel))];
    
    for (const model of models) {
      const modelTrades = allTrades.filter(trade => trade.aiModel === model);
      const modelClosed = modelTrades.filter(trade => 
        ['closed', 'profit_hit', 'stop_hit', 'ai_closed', 'user_closed'].includes(trade.status) && 
        trade.profitLossPercentage !== undefined
      );
      const modelWinning = modelClosed.filter(trade => (trade.profitLossPercentage || 0) > 0);
      const modelTotal = modelClosed.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);
      const modelAvgReturn = modelClosed.length > 0 ? modelTotal / modelClosed.length : 0;
      const modelAvgConfidence = modelTrades.length > 0 
        ? modelTrades.reduce((sum, trade) => sum + trade.confidence, 0) / modelTrades.length 
        : 0;
      const modelAvgHoldTime = modelClosed.length > 0 
        ? modelClosed.reduce((sum, trade) => sum + (trade.holdTime || 0), 0) / modelClosed.length 
        : 0;

      byModel[model] = {
        modelId: model,
        modelName: model,
        totalRecommendations: modelTrades.length,
        successfulTrades: modelWinning.length,
        failedTrades: modelClosed.length - modelWinning.length,
        winRate: modelClosed.length > 0 ? (modelWinning.length / modelClosed.length) * 100 : 0,
        averageReturn: modelAvgReturn,
        totalReturn: modelTotal,
        averageConfidence: modelAvgConfidence,
        averageHoldTime: modelAvgHoldTime,
        bestTrade: modelClosed.length > 0 ? Math.max(...modelClosed.map(t => t.profitLossPercentage || 0)) : 0,
        worstTrade: modelClosed.length > 0 ? Math.min(...modelClosed.map(t => t.profitLossPercentage || 0)) : 0,
        sharpeRatio: this.calculateSharpeRatio(modelClosed),
        maxDrawdown: this.calculateMaxDrawdown(modelClosed),
        averageRiskReward: this.calculateAverageRiskReward(modelTrades)
      };
    }

    return byModel;
  }

  /**
   * Calculate performance by ticker
   */
  private static calculateTickerPerformance(allTrades: AITradeEntry[]): Record<string, AITokenPerformance> {
    const byTicker: Record<string, AITokenPerformance> = {};
    const tickers = [...new Set(allTrades.map(trade => trade.ticker))];
    
    for (const ticker of tickers) {
      const tickerTrades = allTrades.filter(trade => trade.ticker === ticker);
      const tickerClosed = tickerTrades.filter(trade => 
        ['closed', 'profit_hit', 'stop_hit', 'ai_closed', 'user_closed'].includes(trade.status) && 
        trade.profitLossPercentage !== undefined
      );
      const tickerWinning = tickerClosed.filter(trade => (trade.profitLossPercentage || 0) > 0);
      const tickerTotal = tickerClosed.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);
      const tickerAvgReturn = tickerClosed.length > 0 ? tickerTotal / tickerClosed.length : 0;
      const tickerAvgConfidence = tickerTrades.length > 0 
        ? tickerTrades.reduce((sum, trade) => sum + trade.confidence, 0) / tickerTrades.length 
        : 0;
      const tickerAvgHoldTime = tickerClosed.length > 0 
        ? tickerClosed.reduce((sum, trade) => sum + (trade.holdTime || 0), 0) / tickerClosed.length 
        : 0;
      const tickerLastTrade = tickerTrades.length > 0 
        ? Math.max(...tickerTrades.map(t => t.entryDate)) 
        : 0;

      // Calculate profit factor for ticker
      const tickerProfit = tickerWinning.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);
      const tickerLoss = Math.abs(tickerClosed.filter(t => (t.profitLossPercentage || 0) <= 0)
        .reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0));
      const tickerProfitFactor = tickerLoss > 0 ? tickerProfit / tickerLoss : 
        tickerProfit > 0 ? Infinity : 0;

      // Calculate best win (only positive returns) and worst loss (only negative returns)
      const tickerWins = tickerClosed.filter(t => (t.profitLossPercentage || 0) > 0);
      const tickerLosses = tickerClosed.filter(t => (t.profitLossPercentage || 0) <= 0);
      
      const bestWin = tickerWins.length > 0 ? Math.max(...tickerWins.map(t => t.profitLossPercentage || 0)) : null;
      const worstLoss = tickerLosses.length > 0 ? Math.min(...tickerLosses.map(t => t.profitLossPercentage || 0)) : null;

      byTicker[ticker] = {
        ticker,
        totalTrades: tickerTrades.length,
        winningTrades: tickerWinning.length,
        losingTrades: tickerClosed.length - tickerWinning.length,
        winRate: tickerClosed.length > 0 ? (tickerWinning.length / tickerClosed.length) * 100 : 0,
        totalReturn: tickerTotal,
        averageReturn: tickerAvgReturn,
        bestTrade: bestWin, // Now only positive returns or null
        worstTrade: worstLoss, // Now only negative returns or null
        averageConfidence: tickerAvgConfidence,
        averageHoldTime: tickerAvgHoldTime,
        lastTradeDate: tickerLastTrade,
        profitFactor: tickerProfitFactor,
        averageRiskReward: this.calculateAverageRiskReward(tickerTrades)
      };
    }

    return byTicker;
  }

  /**
   * Calculate monthly performance
   */
  private static calculateMonthlyPerformance(trades: AITradeEntry[]) {
    const monthlyData: Record<string, any> = {};
    
    for (const trade of trades) {
      if (!trade.exitDate) continue;
      
      const date = new Date(trade.exitDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          trades: 0,
          winningTrades: 0,
          totalReturn: 0,
          returns: []
        };
      }
      
      monthlyData[monthKey].trades++;
      monthlyData[monthKey].totalReturn += trade.profitLossPercentage || 0;
      monthlyData[monthKey].returns.push(trade.profitLossPercentage || 0);
      
      if ((trade.profitLossPercentage || 0) > 0) {
        monthlyData[monthKey].winningTrades++;
      }
    }
    
    return Object.values(monthlyData).map((month: any) => ({
      month: month.month,
      trades: month.trades,
      winRate: month.trades > 0 ? (month.winningTrades / month.trades) * 100 : 0,
      totalReturn: month.totalReturn,
      averageReturn: month.trades > 0 ? month.totalReturn / month.trades : 0,
      bestTrade: month.returns.length > 0 ? Math.max(...month.returns) : 0,
      worstTrade: month.returns.length > 0 ? Math.min(...month.returns) : 0
    })).sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate recent trends
   */
  private static calculateRecentTrends(trades: AITradeEntry[]) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    const calculatePeriodStats = (days: number) => {
      const cutoff = now - (days * day);
      const periodTrades = trades.filter(trade => trade.exitDate && trade.exitDate >= cutoff);
      const winningTrades = periodTrades.filter(trade => (trade.profitLossPercentage || 0) > 0);
      const totalReturn = periodTrades.reduce((sum, trade) => sum + (trade.profitLossPercentage || 0), 0);
      
      return {
        trades: periodTrades.length,
        winRate: periodTrades.length > 0 ? (winningTrades.length / periodTrades.length) * 100 : 0,
        totalReturn: totalReturn
      };
    };

    return {
      last7Days: calculatePeriodStats(7),
      last30Days: calculatePeriodStats(30),
      last90Days: calculatePeriodStats(90)
    };
  }
}