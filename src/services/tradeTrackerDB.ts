/**
 * Trade Tracker Database Service
 * 
 * This service provides an interface to the IndexedDB database for storing and retrieving trade data.
 * It implements CRUD operations for trade entries and provides methods for querying and analyzing trades.
 */

import { 
  AnyTradeEntry, 
  TradeFilterOptions, 
  TradeStatistics,
  SchemaInfo,
  StrategyType
} from '../types/tradeTracker';

// Database configuration
const DB_NAME = 'TradeTrackerDB';
const DB_VERSION = 1;
const TRADES_STORE = 'trades';
const SCHEMA_STORE = 'schema';

/**
 * IndexedDB service for Trade Tracker
 */
export class TradeTrackerDB {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;
  private dbError: Error | null = null;

  constructor() {
    this.dbReady = this.initDatabase();
  }

  /**
   * Initialize the database connection
   */
  private async initDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      // Open database connection
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Handle database upgrade (called when DB is created or version changes)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create trades object store with id as key path
        if (!db.objectStoreNames.contains(TRADES_STORE)) {
          const tradesStore = db.createObjectStore(TRADES_STORE, { keyPath: 'id' });
          
          // Create indexes for common queries
          tradesStore.createIndex('ticker', 'ticker', { unique: false });
          tradesStore.createIndex('status', 'status', { unique: false });
          tradesStore.createIndex('strategy', 'strategy', { unique: false });
          tradesStore.createIndex('entryDate', 'entryDate', { unique: false });
          tradesStore.createIndex('exitDate', 'exitDate', { unique: false });
          tradesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create schema store for version tracking
        if (!db.objectStoreNames.contains(SCHEMA_STORE)) {
          const schemaStore = db.createObjectStore(SCHEMA_STORE, { keyPath: 'version' });
          
          // Add initial schema info
          const schemaInfo: SchemaInfo = {
            version: DB_VERSION,
            lastUpdated: Date.now()
          };
          
          schemaStore.add(schemaInfo);
        }
      };

      // Handle success
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      // Handle error
      request.onerror = (event) => {
        const error = new Error(`Failed to open database: ${(event.target as IDBOpenDBRequest).error}`);
        this.dbError = error;
        reject(error);
      };
    });
  }

  /**
   * Get database connection, waiting for initialization if necessary
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.dbError) {
      throw this.dbError;
    }
    return this.dbReady;
  }

  /**
   * Create a new trade entry
   * @param trade Trade entry to create
   * @returns Promise resolving to the created trade entry
   */
  async createTrade(trade: AnyTradeEntry): Promise<AnyTradeEntry> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      // Ensure timestamps are set
      const now = Date.now();
      const newTrade: AnyTradeEntry = {
        ...trade,
        createdAt: now,
        updatedAt: now
      };
      
      const transaction = db.transaction([TRADES_STORE], 'readwrite');
      const store = transaction.objectStore(TRADES_STORE);
      
      const request = store.add(newTrade);
      
      request.onsuccess = () => {
        resolve(newTrade);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to create trade: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Get a trade entry by ID
   * @param id Trade ID
   * @returns Promise resolving to the trade entry or null if not found
   */
  async getTrade(id: string): Promise<AnyTradeEntry | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRADES_STORE], 'readonly');
      const store = transaction.objectStore(TRADES_STORE);
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to get trade: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Update an existing trade entry
   * @param trade Trade entry to update
   * @returns Promise resolving to the updated trade entry
   */
  async updateTrade(trade: AnyTradeEntry): Promise<AnyTradeEntry> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      // Update timestamp
      const updatedTrade: AnyTradeEntry = {
        ...trade,
        updatedAt: Date.now()
      };
      
      const transaction = db.transaction([TRADES_STORE], 'readwrite');
      const store = transaction.objectStore(TRADES_STORE);
      
      // Check if trade exists
      const getRequest = store.get(trade.id);
      
      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          reject(new Error(`Trade with ID ${trade.id} not found`));
          return;
        }
        
        // Update trade
        const updateRequest = store.put(updatedTrade);
        
        updateRequest.onsuccess = () => {
          resolve(updatedTrade);
        };
        
        updateRequest.onerror = (event) => {
          reject(new Error(`Failed to update trade: ${(event.target as IDBRequest).error}`));
        };
      };
      
      getRequest.onerror = (event) => {
        reject(new Error(`Failed to check trade existence: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Delete a trade entry
   * @param id Trade ID
   * @returns Promise resolving to true if deleted, false if not found
   */
  async deleteTrade(id: string): Promise<boolean> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRADES_STORE], 'readwrite');
      const store = transaction.objectStore(TRADES_STORE);
      
      // Check if trade exists
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          resolve(false);
          return;
        }
        
        // Delete trade
        const deleteRequest = store.delete(id);
        
        deleteRequest.onsuccess = () => {
          resolve(true);
        };
        
        deleteRequest.onerror = (event) => {
          reject(new Error(`Failed to delete trade: ${(event.target as IDBRequest).error}`));
        };
      };
      
      getRequest.onerror = (event) => {
        reject(new Error(`Failed to check trade existence: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Get all trade entries
   * @returns Promise resolving to an array of all trade entries
   */
  async getAllTrades(): Promise<AnyTradeEntry[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRADES_STORE], 'readonly');
      const store = transaction.objectStore(TRADES_STORE);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to get all trades: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Filter trades based on criteria
   * @param filters Filter options
   * @returns Promise resolving to an array of filtered trade entries
   */
  async filterTrades(filters: TradeFilterOptions): Promise<AnyTradeEntry[]> {
    const allTrades = await this.getAllTrades();
    
    return allTrades.filter(trade => {
      // Filter by ticker
      if (filters.tickers && filters.tickers.length > 0) {
        if (!filters.tickers.includes(trade.ticker)) {
          return false;
        }
      }
      
      // Filter by status
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(trade.status)) {
          return false;
        }
      }
      
      // Filter by strategy
      if (filters.strategies && filters.strategies.length > 0) {
        if (!filters.strategies.includes(trade.strategy)) {
          return false;
        }
      }
      
      // Filter by date range
      if (filters.dateRange) {
        const [startDate, endDate] = filters.dateRange;
        
        if (startDate) {
          const tradeEntryDate = new Date(trade.entryDate);
          if (tradeEntryDate < startDate) {
            return false;
          }
        }
        
        if (endDate) {
          const tradeEntryDate = new Date(trade.entryDate);
          if (tradeEntryDate > endDate) {
            return false;
          }
        }
      }
      
      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.some(tag => trade.tags.includes(tag))) {
          return false;
        }
      }
      
      // Filter profitable only
      if (filters.profitableOnly && trade.status === 'closed') {
        if (!trade.profitLoss || trade.profitLoss <= 0) {
          return false;
        }
      }
      
      // Filter by search text
      if (filters.searchText) {
        const searchText = filters.searchText.toLowerCase();
        const matchesTicker = trade.ticker.toLowerCase().includes(searchText);
        const matchesNotes = trade.notes.toLowerCase().includes(searchText);
        const matchesTags = trade.tags.some(tag => tag.toLowerCase().includes(searchText));
        
        if (!matchesTicker && !matchesNotes && !matchesTags) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Calculate trade statistics
   * @param trades Array of trades to analyze (defaults to all trades)
   * @returns Promise resolving to trade statistics
   */
  async calculateStatistics(trades?: AnyTradeEntry[]): Promise<TradeStatistics> {
    const allTrades = trades || await this.getAllTrades();
    const closedTrades = allTrades.filter(trade => trade.status === 'closed');
    
    // Initialize statistics
    const statistics: TradeStatistics = {
      totalTrades: allTrades.length,
      openTrades: allTrades.filter(trade => trade.status === 'open').length,
      closedTrades: closedTrades.length,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfitLoss: 0,
      averageProfit: 0,
      averageLoss: 0,
      largestProfit: 0,
      largestLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      sharpeRatio: 0,
      averageDuration: 0,
      byStrategy: {} as Record<StrategyType, { count: number; winRate: number; netProfitLoss: number }>,
      byTicker: {} as Record<string, { count: number; winRate: number; netProfitLoss: number }>,
      byIvRvRatio: {
        high: { count: 0, winRate: 0, netProfitLoss: 0 },
        medium: { count: 0, winRate: 0, netProfitLoss: 0 },
        low: { count: 0, winRate: 0, netProfitLoss: 0 }
      },
      byTsSlope: {
        positive: { count: 0, winRate: 0, netProfitLoss: 0 },
        neutral: { count: 0, winRate: 0, netProfitLoss: 0 },
        negative: { count: 0, winRate: 0, netProfitLoss: 0 }
      }
    };
    
    // Return early if no closed trades
    if (closedTrades.length === 0) {
      return statistics;
    }
    
    // Calculate basic statistics
    let totalDuration = 0;
    const winningTrades: AnyTradeEntry[] = [];
    const losingTrades: AnyTradeEntry[] = [];
    
    // Initialize strategy and ticker stats
    const strategyStats: Record<StrategyType, { 
      count: number; 
      wins: number; 
      losses: number; 
      profit: number; 
      loss: number 
    }> = {} as any;
    
    const tickerStats: Record<string, { 
      count: number; 
      wins: number; 
      losses: number; 
      profit: number; 
      loss: number 
    }> = {};
    
    // Process each closed trade
    for (const trade of closedTrades) {
      // Skip trades without profit/loss data
      if (trade.profitLoss === undefined) continue;
      
      // Calculate duration
      if (trade.exitDate) {
        const entryDate = new Date(trade.entryDate);
        const exitDate = new Date(trade.exitDate);
        const duration = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24); // in days
        totalDuration += duration;
      }
      
      // Track winning/losing trades
      if (trade.profitLoss > 0) {
        winningTrades.push(trade);
        statistics.totalProfit += trade.profitLoss;
        statistics.largestProfit = Math.max(statistics.largestProfit, trade.profitLoss);
      } else {
        losingTrades.push(trade);
        statistics.totalLoss += Math.abs(trade.profitLoss);
        statistics.largestLoss = Math.max(statistics.largestLoss, Math.abs(trade.profitLoss));
      }
      
      // Update strategy stats
      if (!strategyStats[trade.strategy]) {
        strategyStats[trade.strategy] = { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 };
      }
      strategyStats[trade.strategy].count++;
      if (trade.profitLoss > 0) {
        strategyStats[trade.strategy].wins++;
        strategyStats[trade.strategy].profit += trade.profitLoss;
      } else {
        strategyStats[trade.strategy].losses++;
        strategyStats[trade.strategy].loss += Math.abs(trade.profitLoss);
      }
      
      // Update ticker stats
      if (!tickerStats[trade.ticker]) {
        tickerStats[trade.ticker] = { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 };
      }
      tickerStats[trade.ticker].count++;
      if (trade.profitLoss > 0) {
        tickerStats[trade.ticker].wins++;
        tickerStats[trade.ticker].profit += trade.profitLoss;
      } else {
        tickerStats[trade.ticker].losses++;
        tickerStats[trade.ticker].loss += Math.abs(trade.profitLoss);
      }
    }
    
    // Update statistics
    statistics.winningTrades = winningTrades.length;
    statistics.losingTrades = losingTrades.length;
    statistics.winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;
    statistics.averageProfit = winningTrades.length > 0 ? statistics.totalProfit / winningTrades.length : 0;
    statistics.averageLoss = losingTrades.length > 0 ? statistics.totalLoss / losingTrades.length : 0;
    statistics.netProfitLoss = statistics.totalProfit - statistics.totalLoss;
    statistics.profitFactor = statistics.totalLoss > 0 ? statistics.totalProfit / statistics.totalLoss : 0;
    statistics.expectancy = statistics.winRate * statistics.averageProfit - (1 - statistics.winRate) * statistics.averageLoss;
    
    // Calculate Sharpe ratio (risk-adjusted return)
    if (closedTrades.length > 1) {
      // Calculate returns for each trade (as percentage of entry price)
      const returns: number[] = [];
      for (const trade of closedTrades) {
        if (trade.profitLoss !== undefined && trade.entryPrice > 0) {
          const returnPct = (trade.profitLoss / (trade.entryPrice * trade.quantity)) * 100;
          returns.push(returnPct);
        }
      }
      
      if (returns.length > 1) {
        // Calculate mean return
        const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        
        // Calculate standard deviation of returns
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
        const stdDev = Math.sqrt(variance);
        
        // Sharpe ratio = (mean return - risk-free rate) / standard deviation
        // Assuming risk-free rate of 0 for simplicity (can be adjusted later)
        statistics.sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;
      }
    }
    
    statistics.averageDuration = closedTrades.length > 0 ? totalDuration / closedTrades.length : 0;
    
    // Format strategy stats
    for (const strategy in strategyStats) {
      const stats = strategyStats[strategy as StrategyType];
      statistics.byStrategy[strategy as StrategyType] = {
        count: stats.count,
        winRate: stats.count > 0 ? stats.wins / stats.count : 0,
        netProfitLoss: stats.profit - stats.loss
      };
    }
    
    // Format ticker stats
    for (const ticker in tickerStats) {
      const stats = tickerStats[ticker];
      statistics.byTicker[ticker] = {
        count: stats.count,
        winRate: stats.count > 0 ? stats.wins / stats.count : 0,
        netProfitLoss: stats.profit - stats.loss
      };
    }
    
    // Calculate IV/RV and TS Slope statistics for calendar spreads
    const ivRvStats = { high: { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 },
                       medium: { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 },
                       low: { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 } };
    
    const tsSlopeStats = { positive: { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 },
                          neutral: { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 },
                          negative: { count: 0, wins: 0, losses: 0, profit: 0, loss: 0 } };
    
    // Process calendar spread trades for IV/RV and TS Slope analysis
    for (const trade of closedTrades) {
      if (trade.strategy === 'calendar_spread' && trade.metadata && trade.profitLoss !== undefined) {
        const { ivRvRatioAtEntry, tsSlopeAtEntry } = trade.metadata;
        
        // Skip if we don't have the required metadata
        if (ivRvRatioAtEntry === undefined || tsSlopeAtEntry === undefined) continue;
        
        // Categorize by IV/RV ratio
        let ivRvCategory: 'high' | 'medium' | 'low';
        if (ivRvRatioAtEntry > 1.2) {
          ivRvCategory = 'high';
        } else if (ivRvRatioAtEntry >= 0.8) {
          ivRvCategory = 'medium';
        } else {
          ivRvCategory = 'low';
        }
        
        ivRvStats[ivRvCategory].count++;
        if (trade.profitLoss > 0) {
          ivRvStats[ivRvCategory].wins++;
          ivRvStats[ivRvCategory].profit += trade.profitLoss;
        } else {
          ivRvStats[ivRvCategory].losses++;
          ivRvStats[ivRvCategory].loss += Math.abs(trade.profitLoss);
        }
        
        // Categorize by TS Slope
        let tsSlopeCategory: 'positive' | 'neutral' | 'negative';
        if (tsSlopeAtEntry > 0.1) {
          tsSlopeCategory = 'positive';
        } else if (tsSlopeAtEntry >= -0.1) {
          tsSlopeCategory = 'neutral';
        } else {
          tsSlopeCategory = 'negative';
        }
        
        tsSlopeStats[tsSlopeCategory].count++;
        if (trade.profitLoss > 0) {
          tsSlopeStats[tsSlopeCategory].wins++;
          tsSlopeStats[tsSlopeCategory].profit += trade.profitLoss;
        } else {
          tsSlopeStats[tsSlopeCategory].losses++;
          tsSlopeStats[tsSlopeCategory].loss += Math.abs(trade.profitLoss);
        }
      }
    }
    
    // Format IV/RV stats
    for (const category of ['high', 'medium', 'low'] as const) {
      const stats = ivRvStats[category];
      statistics.byIvRvRatio[category] = {
        count: stats.count,
        winRate: stats.count > 0 ? stats.wins / stats.count : 0,
        netProfitLoss: stats.profit - stats.loss
      };
    }
    
    // Format TS Slope stats
    for (const category of ['positive', 'neutral', 'negative'] as const) {
      const stats = tsSlopeStats[category];
      statistics.byTsSlope[category] = {
        count: stats.count,
        winRate: stats.count > 0 ? stats.wins / stats.count : 0,
        netProfitLoss: stats.profit - stats.loss
      };
    }
    
    return statistics;
  }

  /**
   * Clear all data from the database
   * @returns Promise resolving when the operation is complete
   */
  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRADES_STORE], 'readwrite');
      const store = transaction.objectStore(TRADES_STORE);
      
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to clear data: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Get database schema information
   * @returns Promise resolving to schema information
   */
  async getSchemaInfo(): Promise<SchemaInfo> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEMA_STORE], 'readonly');
      const store = transaction.objectStore(SCHEMA_STORE);
      
      const request = store.get(DB_VERSION);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          resolve({
            version: DB_VERSION,
            lastUpdated: Date.now()
          });
        }
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to get schema info: ${(event.target as IDBRequest).error}`));
      };
    });
  }

  /**
   * Import trades from JSON
   * @param trades Array of trades to import
   * @returns Promise resolving to the number of trades imported
   */
  async importTrades(trades: AnyTradeEntry[]): Promise<number> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TRADES_STORE], 'readwrite');
      const store = transaction.objectStore(TRADES_STORE);
      
      let importedCount = 0;
      
      transaction.oncomplete = () => {
        resolve(importedCount);
      };
      
      transaction.onerror = (event) => {
        reject(new Error(`Failed to import trades: ${transaction.error}`));
      };
      
      // Process each trade
      for (const trade of trades) {
        // Ensure timestamps are set
        const now = Date.now();
        const importedTrade: AnyTradeEntry = {
          ...trade,
          createdAt: trade.createdAt || now,
          updatedAt: now
        };
        
        const request = store.put(importedTrade);
        
        request.onsuccess = () => {
          importedCount++;
        };
      }
    });
  }

  /**
   * Export all trades to JSON
   * @returns Promise resolving to an array of all trades
   */
  async exportTrades(): Promise<AnyTradeEntry[]> {
    return this.getAllTrades();
  }
}

// Create and export a singleton instance
export const tradeTrackerDB = new TradeTrackerDB();