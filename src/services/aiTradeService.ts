/**
 * AI Trade Service - Backend Only
 * 
 * Replaces aiTradeTrackerDB.ts with backend-only operations.
 * This service provides the same interface but uses the production backend
 * as the single source of truth, eliminating the dual data source architecture.
 */

import {
  AITradeEntry,
  AITradeStatistics,
  AITradeFilterOptions,
  CreateAITradeRequest,
  UpdateAITradeRequest,
  AITradeStatus,
  AITradeConfidence,
  AIModelPerformance,
  AITokenPerformance,
  AITradePerformanceReport
} from '../types/aiTradeTracker';

import {
  getAllTradesHistoryForAITracker,
  getAllActiveTradesForAITracker,
  closeActiveTradeInProduction,
  ProductionActiveTrade
} from './productionActiveTradesService';

/**
 * AI Trade Service Class - Backend Only Implementation
 * 
 * This service provides the same interface as the old IndexedDB service
 * but uses the backend API as the single source of truth.
 */
class AITradeService {
  
  /**
   * Initialize the service (no-op for backend service)
   */
  async init(): Promise<void> {
    // No initialization needed for backend service
    console.log('✅ [AITradeService] Backend-only service initialized');
  }

  /**
   * Create a new AI trade entry
   * Note: This would typically be handled by the chart analysis system
   * that creates trades in the backend. This method is for compatibility.
   */
  async createTrade(request: CreateAITradeRequest): Promise<AITradeEntry> {
    console.warn('⚠️ [AITradeService] createTrade called - trades should be created via chart analysis system');
    
    // For now, we'll create a mock trade entry since the backend doesn't have
    // a direct "create AI trade" endpoint - trades come from chart analysis
    const now = Date.now();
    const trade: AITradeEntry = {
      id: `ai_trade_${now}_${Math.random().toString(36).substr(2, 9)}`,
      analysisId: request.analysisId,
      ticker: request.ticker.toUpperCase(),
      timeframe: request.timeframe,
      aiModel: request.aiModel,
      confidence: request.confidence,
      confidenceLevel: this.categorizeConfidence(request.confidence),
      sentiment: request.sentiment,
      action: request.action,
      entryPrice: request.entryPrice,
      targetPrice: request.targetPrice,
      stopLoss: request.stopLoss,
      riskReward: request.riskReward,
      reasoning: request.reasoning,
      status: 'waiting',
      entryDate: now,
      chartImageBase64: request.chartImageBase64,
      markedUpChartImageBase64: request.markedUpChartImageBase64,
      keyLevels: request.keyLevels,
      technicalIndicators: request.technicalIndicators,
      marketConditions: request.marketConditions,
      volumeProfile: request.volumeProfile,
      priceAtRecommendation: request.priceAtRecommendation,
      createdAt: now,
      updatedAt: now
    };

    // In a real implementation, this would call a backend API to create the trade
    console.log(`✅ [AITradeService] Mock trade created: ${trade.id} for ${trade.ticker}`);
    return trade;
  }

  /**
   * Update an existing AI trade
   * This delegates to the backend production system
   */
  async updateTrade(updateRequest: UpdateAITradeRequest): Promise<AITradeEntry> {
    console.log(`🔄 [AITradeService] Updating trade: ${updateRequest.id}`);
    
    // For production trades, we need to use the backend API
    if (updateRequest.status === 'closed' && updateRequest.exitPrice) {
      // Extract ticker from the trade ID or get it from the current trade
      const currentTrade = await this.getTradeById(updateRequest.id);
      if (currentTrade) {
        const success = await closeActiveTradeInProduction(
          currentTrade.ticker,
          updateRequest.exitPrice,
          updateRequest.notes || 'Closed via AI Trade Tracker'
        );
        
        if (success) {
          // Return the updated trade by fetching fresh data
          const updatedTrade = await this.getTradeById(updateRequest.id);
          if (updatedTrade) {
            console.log(`✅ [AITradeService] Updated trade: ${updateRequest.id}`);
            return updatedTrade;
          }
        }
      }
    }
    
    throw new Error(`Failed to update trade ${updateRequest.id} - backend update not supported for this operation`);
  }

  /**
   * Get all AI trades from backend
   */
  async getAllTrades(): Promise<AITradeEntry[]> {
    console.log('📊 [AITradeService] Fetching all trades from backend');
    const trades = await getAllTradesHistoryForAITracker();
    console.log(`✅ [AITradeService] Retrieved ${trades.length} trades from backend`);
    return trades;
  }

  /**
   * Get AI trade by ID
   */
  async getTradeById(id: string): Promise<AITradeEntry | null> {
    console.log(`🔍 [AITradeService] Searching for trade: ${id}`);
    const allTrades = await this.getAllTrades();
    const trade = allTrades.find(t => t.id === id) || null;
    
    if (trade) {
      console.log(`✅ [AITradeService] Found trade: ${id}`);
    } else {
      console.log(`📭 [AITradeService] Trade not found: ${id}`);
    }
    
    return trade;
  }

  /**
   * Get active AI trades (waiting or open)
   */
  async getActiveTrades(): Promise<AITradeEntry[]> {
    console.log('📊 [AITradeService] Fetching active trades from backend');
    const activeTrades = await getAllActiveTradesForAITracker();
    console.log(`✅ [AITradeService] Retrieved ${activeTrades.length} active trades from backend`);
    return activeTrades;
  }

  /**
   * Get AI trades by ticker
   */
  async getTradesByTicker(ticker: string): Promise<AITradeEntry[]> {
    console.log(`🔍 [AITradeService] Fetching trades for ticker: ${ticker}`);
    const allTrades = await this.getAllTrades();
    const tickerTrades = allTrades.filter(trade => trade.ticker.toUpperCase() === ticker.toUpperCase());
    
    // Sort by creation date (newest first)
    tickerTrades.sort((a, b) => b.createdAt - a.createdAt);
    
    console.log(`✅ [AITradeService] Found ${tickerTrades.length} trades for ${ticker}`);
    return tickerTrades;
  }

  /**
   * Filter AI trades based on criteria
   */
  async filterTrades(filters: AITradeFilterOptions): Promise<AITradeEntry[]> {
    console.log('🔍 [AITradeService] Applying trade filters');
    let trades = await this.getAllTrades();

    // Apply filters (same logic as before)
    if (filters.tickers && filters.tickers.length > 0) {
      const upperTickers = filters.tickers.map(t => t.toUpperCase());
      trades = trades.filter(trade => upperTickers.includes(trade.ticker));
    }

    if (filters.timeframes && filters.timeframes.length > 0) {
      trades = trades.filter(trade => filters.timeframes!.includes(trade.timeframe));
    }

    if (filters.status && filters.status.length > 0) {
      trades = trades.filter(trade => filters.status!.includes(trade.status));
    }

    if (filters.confidence && filters.confidence.length > 0) {
      trades = trades.filter(trade => filters.confidence!.includes(trade.confidenceLevel));
    }

    if (filters.aiModels && filters.aiModels.length > 0) {
      trades = trades.filter(trade => filters.aiModels!.includes(trade.aiModel));
    }

    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const startTime = filters.dateRange[0].getTime();
      const endTime = filters.dateRange[1].getTime();
      trades = trades.filter(trade => trade.entryDate >= startTime && trade.entryDate <= endTime);
    }

    if (filters.profitableOnly) {
      trades = trades.filter(trade => trade.profitLoss && trade.profitLoss > 0);
    }

    if (filters.minConfidence !== undefined) {
      trades = trades.filter(trade => trade.confidence >= filters.minConfidence!);
    }

    if (filters.maxConfidence !== undefined) {
      trades = trades.filter(trade => trade.confidence <= filters.maxConfidence!);
    }

    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      trades = trades.filter(trade => 
        trade.ticker.toLowerCase().includes(searchLower) ||
        trade.reasoning.toLowerCase().includes(searchLower) ||
        (trade.notes && trade.notes.toLowerCase().includes(searchLower)) ||
        (trade.tags && trade.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    console.log(`✅ [AITradeService] Filtered to ${trades.length} trades`);
    return trades;
  }

  /**
   * Calculate comprehensive AI trade statistics
   */
  async calculateStatistics(trades?: AITradeEntry[]): Promise<AITradeStatistics> {
    if (!trades) {
      trades = await this.getAllTrades();
    }

    console.log(`📊 [AITradeService] Calculating statistics for ${trades.length} trades`);

    const closedTrades = trades.filter(trade => trade.status === 'closed' && trade.profitLoss !== undefined);
    const activeTrades = trades.filter(trade => trade.status === 'waiting' || trade.status === 'open');
    const winningTrades = closedTrades.filter(trade => trade.profitLoss! > 0);
    const losingTrades = closedTrades.filter(trade => trade.profitLoss! <= 0);

    const totalReturn = closedTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const averageReturn = closedTrades.length > 0 ? totalReturn / closedTrades.length : 0;

    const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.profitLoss || 0)) : 0;
    const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map(t => t.profitLoss || 0)) : 0;

    const averageHoldTime = closedTrades.length > 0 
      ? closedTrades.reduce((sum, trade) => sum + (trade.holdTime || 0), 0) / closedTrades.length 
      : 0;

    const averageConfidence = trades.length > 0 
      ? trades.reduce((sum, trade) => sum + trade.confidence, 0) / trades.length 
      : 0;

    // Calculate profit factor
    const totalProfit = winningTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // Calculate Sharpe ratio (simplified)
    const returns = closedTrades.map(trade => trade.profitLossPercentage || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length 
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;
    
    for (const trade of closedTrades.sort((a, b) => a.exitDate! - b.exitDate!)) {
      runningTotal += trade.profitLoss || 0;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Performance by confidence level
    const byConfidence: Record<AITradeConfidence, any> = {
      low: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
      medium: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
      high: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
      very_high: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 }
    };

    for (const confidence of Object.keys(byConfidence) as AITradeConfidence[]) {
      const confidenceTrades = closedTrades.filter(trade => trade.confidenceLevel === confidence);
      const confWinning = confidenceTrades.filter(trade => trade.profitLoss! > 0);
      const confTotal = confidenceTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);

      byConfidence[confidence] = {
        count: confidenceTrades.length,
        winRate: confidenceTrades.length > 0 ? (confWinning.length / confidenceTrades.length) * 100 : 0,
        averageReturn: confidenceTrades.length > 0 ? confTotal / confidenceTrades.length : 0,
        totalReturn: confTotal
      };
    }

    // Performance by timeframe
    const byTimeframe: Record<string, any> = {};
    const timeframes = [...new Set(trades.map(trade => trade.timeframe))];
    
    for (const timeframe of timeframes) {
      const timeframeTrades = closedTrades.filter(trade => trade.timeframe === timeframe);
      const tfWinning = timeframeTrades.filter(trade => trade.profitLoss! > 0);
      const tfTotal = timeframeTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);

      byTimeframe[timeframe] = {
        count: timeframeTrades.length,
        winRate: timeframeTrades.length > 0 ? (tfWinning.length / timeframeTrades.length) * 100 : 0,
        averageReturn: timeframeTrades.length > 0 ? tfTotal / timeframeTrades.length : 0,
        totalReturn: tfTotal
      };
    }

    // Performance by AI model
    const byModel: Record<string, AIModelPerformance> = {};
    const models = [...new Set(trades.map(trade => trade.aiModel))];
    
    for (const model of models) {
      const modelTrades = trades.filter(trade => trade.aiModel === model);
      const modelClosed = modelTrades.filter(trade => trade.status === 'closed' && trade.profitLoss !== undefined);
      const modelWinning = modelClosed.filter(trade => trade.profitLoss! > 0);
      const modelTotal = modelClosed.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
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
        bestTrade: modelClosed.length > 0 ? Math.max(...modelClosed.map(t => t.profitLoss || 0)) : 0,
        worstTrade: modelClosed.length > 0 ? Math.min(...modelClosed.map(t => t.profitLoss || 0)) : 0,
        sharpeRatio: 0, // Simplified for now
        maxDrawdown: 0 // Simplified for now
      };
    }

    // Performance by ticker
    const byTicker: Record<string, AITokenPerformance> = {};
    const tickers = [...new Set(trades.map(trade => trade.ticker))];
    
    for (const ticker of tickers) {
      const tickerTrades = trades.filter(trade => trade.ticker === ticker);
      const tickerClosed = tickerTrades.filter(trade => trade.status === 'closed' && trade.profitLoss !== undefined);
      const tickerWinning = tickerClosed.filter(trade => trade.profitLoss! > 0);
      const tickerTotal = tickerClosed.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
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
      const tickerProfit = tickerWinning.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
      const tickerLoss = Math.abs(tickerClosed.filter(t => t.profitLoss! <= 0).reduce((sum, trade) => sum + (trade.profitLoss || 0), 0));
      const tickerProfitFactor = tickerLoss > 0 ? tickerProfit / tickerLoss : tickerProfit > 0 ? Infinity : 0;

      byTicker[ticker] = {
        ticker,
        totalTrades: tickerTrades.length,
        winningTrades: tickerWinning.length,
        losingTrades: tickerClosed.length - tickerWinning.length,
        winRate: tickerClosed.length > 0 ? (tickerWinning.length / tickerClosed.length) * 100 : 0,
        totalReturn: tickerTotal,
        averageReturn: tickerAvgReturn,
        bestTrade: tickerClosed.length > 0 ? Math.max(...tickerClosed.map(t => t.profitLoss || 0)) : 0,
        worstTrade: tickerClosed.length > 0 ? Math.min(...tickerClosed.map(t => t.profitLoss || 0)) : 0,
        averageConfidence: tickerAvgConfidence,
        averageHoldTime: tickerAvgHoldTime,
        lastTradeDate: tickerLastTrade,
        profitFactor: tickerProfitFactor
      };
    }

    // Monthly performance
    const monthlyPerformance = this.calculateMonthlyPerformance(closedTrades);

    // Recent trends
    const recentTrends = this.calculatePeriodStats(closedTrades);

    const statistics: AITradeStatistics = {
      totalRecommendations: trades.length,
      activeTrades: activeTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalReturn,
      averageReturn,
      bestTrade,
      worstTrade,
      averageHoldTime,
      averageConfidence,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      byConfidence,
      byTimeframe,
      byModel,
      byTicker,
      monthlyPerformance,
      recentTrends
    };

    console.log(`✅ [AITradeService] Statistics calculated - Win Rate: ${winRate.toFixed(1)}%, Total Return: $${totalReturn.toFixed(2)}`);
    return statistics;
  }

  /**
   * Delete a trade (delegates to backend)
   */
  async deleteTrade(id: string): Promise<void> {
    console.log(`🗑️ [AITradeService] Attempting to delete trade: ${id}`);
    
    // Extract backend ID from the AI trade ID format: "backend-{id}"
    if (!id.startsWith('backend-')) {
      throw new Error(`Invalid trade ID format: ${id}. Expected format: backend-{id}`);
    }
    
    const backendId = id.replace('backend-', '');
    const tradeId = parseInt(backendId, 10);
    
    if (isNaN(tradeId)) {
      throw new Error(`Invalid backend ID: ${backendId}. Must be a number.`);
    }

    // Use the new backend delete endpoint with database ID
    try {
      const deleteResponse = await fetch(`http://localhost:5000/api/active-trades/id/${tradeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'AI Trade Tracker deletion'
        })
      });

      if (deleteResponse.ok) {
        const result = await deleteResponse.json();
        console.log(`✅ [AITradeService] Successfully deleted trade: ${id} (backend ID: ${tradeId})`);
      } else {
        const errorData = await deleteResponse.json().catch(() => ({ error: deleteResponse.statusText }));
        throw new Error(errorData.error || `HTTP ${deleteResponse.status}: ${deleteResponse.statusText}`);
      }
    } catch (error) {
      console.error(`❌ [AITradeService] Failed to delete trade ${id}:`, error);
      throw error;
    }
  }

  /**
   * Clear all data (not supported for backend service)
   */
  async clearAllData(): Promise<void> {
    throw new Error('clearAllData not supported for backend service - use backend admin tools');
  }

  /**
   * Helper: Categorize confidence level
   */
  private categorizeConfidence(confidence: number): AITradeConfidence {
    if (confidence >= 0.9) return 'very_high';
    if (confidence >= 0.75) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Helper: Calculate monthly performance
   */
  private calculateMonthlyPerformance(trades: AITradeEntry[]) {
    const monthlyData: Record<string, any> = {};
    
    for (const trade of trades) {
      if (!trade.exitDate || trade.profitLoss === undefined) continue;
      
      const date = new Date(trade.exitDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          trades: 0,
          totalReturn: 0,
          winningTrades: 0,
          losingTrades: 0
        };
      }
      
      monthlyData[monthKey].trades++;
      monthlyData[monthKey].totalReturn += trade.profitLoss;
      if (trade.profitLoss > 0) {
        monthlyData[monthKey].winningTrades++;
      } else {
        monthlyData[monthKey].losingTrades++;
      }
    }
    
    return Object.values(monthlyData).map((month: any) => ({
      ...month,
      winRate: month.trades > 0 ? (month.winningTrades / month.trades) * 100 : 0,
      averageReturn: month.trades > 0 ? month.totalReturn / month.trades : 0
    }));
  }

  /**
   * Helper: Calculate period statistics
   */
  private calculatePeriodStats(trades: AITradeEntry[]) {
    const now = Date.now();
    
    const last7Days = trades.filter(trade =>
      trade.exitDate && (now - trade.exitDate) <= (7 * 24 * 60 * 60 * 1000)
    );
    
    const last30Days = trades.filter(trade =>
      trade.exitDate && (now - trade.exitDate) <= (30 * 24 * 60 * 60 * 1000)
    );
    
    const last90Days = trades.filter(trade =>
      trade.exitDate && (now - trade.exitDate) <= (90 * 24 * 60 * 60 * 1000)
    );
    
    return {
      last7Days: {
        trades: last7Days.length,
        totalReturn: last7Days.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0),
        winRate: last7Days.length > 0
          ? (last7Days.filter(trade => trade.profitLoss! > 0).length / last7Days.length) * 100
          : 0
      },
      last30Days: {
        trades: last30Days.length,
        totalReturn: last30Days.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0),
        winRate: last30Days.length > 0
          ? (last30Days.filter(trade => trade.profitLoss! > 0).length / last30Days.length) * 100
          : 0
      },
      last90Days: {
        trades: last90Days.length,
        totalReturn: last90Days.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0),
        winRate: last90Days.length > 0
          ? (last90Days.filter(trade => trade.profitLoss! > 0).length / last90Days.length) * 100
          : 0
      }
    };
  }
}

// Create and export a singleton instance
export const aiTradeService = new AITradeService();

// Export the class for testing
export { AITradeService };