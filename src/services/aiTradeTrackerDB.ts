/**
 * AI Trade Tracker Database Service
 * 
 * Handles all database operations for AI-generated trade tracking
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

// IndexedDB database name and version
const DB_NAME = 'AITradeTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'ai_trades';

/**
 * AI Trade Tracker Database Class
 */
class AITradeTrackerDatabase {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open AI Trade Tracker database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create the trades store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          store.createIndex('ticker', 'ticker', { unique: false });
          store.createIndex('timeframe', 'timeframe', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('aiModel', 'aiModel', { unique: false });
          store.createIndex('confidence', 'confidence', { unique: false });
          store.createIndex('entryDate', 'entryDate', { unique: false });
          store.createIndex('analysisId', 'analysisId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Create a new AI trade entry
   */
  async createTrade(request: CreateAITradeRequest): Promise<AITradeEntry> {
    const db = await this.ensureDB();
    
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

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(trade);

      request.onsuccess = () => {
        console.log(`✅ [AITradeTrackerDB] Created AI trade: ${trade.id} for ${trade.ticker}`);
        resolve(trade);
      };

      request.onerror = () => {
        reject(new Error('Failed to create AI trade'));
      };
    });
  }

  /**
   * Update an existing AI trade
   */
  async updateTrade(updateRequest: UpdateAITradeRequest): Promise<AITradeEntry> {
    const db = await this.ensureDB();
    
    // First get the existing trade
    const existingTrade = await this.getTradeById(updateRequest.id);
    if (!existingTrade) {
      throw new Error(`AI Trade with ID ${updateRequest.id} not found`);
    }

    // Calculate performance metrics if closing the trade
    const updatedTrade: AITradeEntry = {
      ...existingTrade,
      ...updateRequest,
      updatedAt: Date.now()
    };

    // Calculate performance metrics if trade is being closed
    if (updateRequest.status === 'closed' && updateRequest.exitPrice && updateRequest.exitDate) {
      const profitLoss = this.calculateProfitLoss(
        updatedTrade.action,
        updatedTrade.actualEntryPrice || updatedTrade.entryPrice,
        updateRequest.exitPrice
      );
      
      const profitLossPercentage = this.calculateProfitLossPercentage(
        updatedTrade.action,
        updatedTrade.actualEntryPrice || updatedTrade.entryPrice,
        updateRequest.exitPrice
      );

      const holdTime = (updateRequest.exitDate - (updatedTrade.actualEntryDate || updatedTrade.entryDate)) / (1000 * 60 * 60); // hours

      updatedTrade.profitLoss = profitLoss;
      updatedTrade.profitLossPercentage = profitLossPercentage;
      updatedTrade.holdTime = holdTime;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updatedTrade);

      request.onsuccess = () => {
        console.log(`✅ [AITradeTrackerDB] Updated AI trade: ${updatedTrade.id}`);
        resolve(updatedTrade);
      };

      request.onerror = () => {
        reject(new Error('Failed to update AI trade'));
      };
    });
  }

  /**
   * Get all AI trades
   */
  async getAllTrades(): Promise<AITradeEntry[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const trades = request.result || [];
        // Sort by creation date (newest first)
        trades.sort((a, b) => b.createdAt - a.createdAt);
        resolve(trades);
      };

      request.onerror = () => {
        reject(new Error('Failed to get AI trades'));
      };
    });
  }

  /**
   * Get AI trade by ID
   */
  async getTradeById(id: string): Promise<AITradeEntry | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get AI trade'));
      };
    });
  }

  /**
   * Get active AI trades (waiting or open)
   */
  async getActiveTrades(): Promise<AITradeEntry[]> {
    const allTrades = await this.getAllTrades();
    return allTrades.filter(trade => trade.status === 'waiting' || trade.status === 'open');
  }

  /**
   * Get AI trades by ticker
   */
  async getTradesByTicker(ticker: string): Promise<AITradeEntry[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('ticker');
      const request = index.getAll(ticker.toUpperCase());

      request.onsuccess = () => {
        const trades = request.result || [];
        trades.sort((a, b) => b.createdAt - a.createdAt);
        resolve(trades);
      };

      request.onerror = () => {
        reject(new Error('Failed to get AI trades by ticker'));
      };
    });
  }

  /**
   * Filter AI trades based on criteria
   */
  async filterTrades(filters: AITradeFilterOptions): Promise<AITradeEntry[]> {
    let trades = await this.getAllTrades();

    // Apply filters
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

    return trades;
  }

  /**
   * Calculate comprehensive AI trade statistics
   */
  async calculateStatistics(trades?: AITradeEntry[]): Promise<AITradeStatistics> {
    if (!trades) {
      trades = await this.getAllTrades();
    }

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
    const now = Date.now();
    const last7Days = closedTrades.filter(trade => trade.exitDate! > now - (7 * 24 * 60 * 60 * 1000));
    const last30Days = closedTrades.filter(trade => trade.exitDate! > now - (30 * 24 * 60 * 60 * 1000));
    const last90Days = closedTrades.filter(trade => trade.exitDate! > now - (90 * 24 * 60 * 60 * 1000));

    const recentTrends = {
      last7Days: this.calculatePeriodStats(last7Days),
      last30Days: this.calculatePeriodStats(last30Days),
      last90Days: this.calculatePeriodStats(last90Days)
    };

    return {
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
  }

  /**
   * Delete an AI trade
   */
  async deleteTrade(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`✅ [AITradeTrackerDB] Deleted AI trade: ${id}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete AI trade'));
      };
    });
  }

  /**
   * Clear all AI trade data
   */
  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ [AITradeTrackerDB] Cleared all AI trade data');
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to clear AI trade data'));
      };
    });
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
   * Helper: Calculate profit/loss
   */
  private calculateProfitLoss(action: 'buy' | 'sell', entryPrice: number, exitPrice: number): number {
    if (action === 'buy') {
      return exitPrice - entryPrice;
    } else {
      return entryPrice - exitPrice;
    }
  }

  /**
   * Helper: Calculate profit/loss percentage
   */
  private calculateProfitLossPercentage(action: 'buy' | 'sell', entryPrice: number, exitPrice: number): number {
    const profitLoss = this.calculateProfitLoss(action, entryPrice, exitPrice);
    return (profitLoss / entryPrice) * 100;
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
          winningTrades: 0,
          totalReturn: 0,
          returns: []
        };
      }

      monthlyData[monthKey].trades++;
      monthlyData[monthKey].totalReturn += trade.profitLoss;
      monthlyData[monthKey].returns.push(trade.profitLoss);
      
      if (trade.profitLoss > 0) {
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
   * Helper: Calculate period statistics
   */
  private calculatePeriodStats(trades: AITradeEntry[]) {
    const winningTrades = trades.filter(trade => trade.profitLoss! > 0);
    const totalReturn = trades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    return {
      trades: trades.length,
      winRate,
      totalReturn
    };
  }
}

// Create and export a singleton instance
export const aiTradeTrackerDB = new AITradeTrackerDatabase();