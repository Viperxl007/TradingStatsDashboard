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

import { AITradeStatisticsCalculator } from './aiTradeStatisticsCalculator';

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
   *
   * CRITICAL BUG FIX: For waiting trades being cancelled, DELETE instead of UPDATE
   */
  async updateTrade(updateRequest: UpdateAITradeRequest): Promise<AITradeEntry> {
    console.log(`🔄 [AITradeService] Updating trade: ${updateRequest.id}`);
    
    // CRITICAL FIX: Check if this is a cancellation of a waiting trade
    const currentTrade = await this.getTradeById(updateRequest.id);
    if (!currentTrade) {
      throw new Error(`Trade ${updateRequest.id} not found`);
    }
    
    // If trying to close a waiting trade, DELETE it instead
    if (currentTrade.status === 'waiting' &&
        (updateRequest.status === 'cancelled' || updateRequest.status === 'user_closed')) {
      console.log(`🗑️ [AITradeService] CRITICAL FIX: Deleting waiting trade ${updateRequest.id} - never executed`);
      await this.deleteTrade(updateRequest.id);
      throw new Error('Trade deleted - was never entered, no performance impact');
    }
    
    // For production trades that were actually executed, use normal update flow
    if (updateRequest.status === 'closed' && updateRequest.exitPrice) {
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
   * Calculate comprehensive AI trade statistics using centralized calculator
   */
  async calculateStatistics(trades?: AITradeEntry[]): Promise<AITradeStatistics> {
    if (!trades) {
      trades = await this.getAllTrades();
    }

    console.log(`📊 [AITradeService] Delegating statistics calculation to centralized calculator for ${trades.length} trades`);
    
    // Use the centralized statistics calculator
    const statistics = AITradeStatisticsCalculator.calculateStatistics(trades);
    
    console.log(`✅ [AITradeService] Statistics calculated via centralized calculator - Win Rate: ${statistics.winRate.toFixed(1)}%, Total Return: ${statistics.totalReturn.toFixed(2)}%`);
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