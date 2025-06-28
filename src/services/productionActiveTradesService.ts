/**
 * Production Active Trades Service
 * 
 * Integrates with the existing production active trades API to fetch real trade data
 * from the Chart Analysis system. This service bridges the AI Trade Tracker with
 * the production active trades database.
 */

import { AITradeEntry, AITradeStatus } from '../types/aiTradeTracker';

export interface ProductionActiveTrade {
  ticker: string;
  timeframe: string;
  status: 'waiting' | 'active';
  action: 'buy' | 'sell';
  entry_price: number;
  target_price?: number;
  stop_loss?: number;
  current_price?: number;
  unrealized_pnl?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductionActiveTradesResponse {
  active_trades: ProductionActiveTrade[];
  count: number;
  timestamp: number;
}

/**
 * Fetch all active trades from the production API
 */
export const fetchAllActiveTradesFromProduction = async (): Promise<ProductionActiveTrade[]> => {
  try {
    console.log('🔍 [ProductionActiveTradesService] Fetching all active trades from production API');
    
    const response = await fetch('http://localhost:5000/api/active-trades/all');
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('📭 [ProductionActiveTradesService] No active trades found');
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data: ProductionActiveTradesResponse = await response.json();
    
    console.log(`✅ [ProductionActiveTradesService] Found ${data.count} active trades`);
    return data.active_trades || [];
    
  } catch (error) {
    console.error('❌ [ProductionActiveTradesService] Error fetching active trades:', error);
    return [];
  }
};

/**
 * Fetch active trade for a specific ticker from production API
 */
export const fetchActiveTradeFromProduction = async (ticker: string): Promise<ProductionActiveTrade | null> => {
  try {
    console.log(`🔍 [ProductionActiveTradesService] Fetching active trade for ${ticker}`);
    
    const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 [ProductionActiveTradesService] No active trade found for ${ticker}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.active_trade) {
      console.log(`✅ [ProductionActiveTradesService] Found active trade for ${ticker}`);
      return data.active_trade;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [ProductionActiveTradesService] Error fetching active trade for ${ticker}:`, error);
    return null;
  }
};

/**
 * Convert production active trade to AI Trade Tracker format
 */
export const convertProductionTradeToAITrade = (productionTrade: ProductionActiveTrade): AITradeEntry => {
  // Map production status to AI Trade Tracker status
  const mapStatus = (status: string): AITradeStatus => {
    switch (status) {
      case 'waiting':
        return 'waiting';
      case 'active':
        return 'open';
      default:
        return 'waiting';
    }
  };

  // Calculate profit/loss percentage if we have the data
  const profitLossPercentage = productionTrade.unrealized_pnl && productionTrade.entry_price
    ? (productionTrade.unrealized_pnl / productionTrade.entry_price) * 100
    : undefined;

  const aiTrade: AITradeEntry = {
    id: `production-${productionTrade.ticker}-${new Date(productionTrade.created_at).getTime()}`,
    analysisId: `chart-analysis-${productionTrade.ticker}`,
    ticker: productionTrade.ticker,
    timeframe: productionTrade.timeframe,
    
    // AI Analysis Data
    aiModel: 'production_system',
    confidence: 1.0, // Production trades have 100% confidence
    confidenceLevel: 'very_high',
    sentiment: productionTrade.action === 'buy' ? 'bullish' : 'bearish',
    
    // Trade Recommendation
    action: productionTrade.action,
    entryPrice: productionTrade.entry_price,
    targetPrice: productionTrade.target_price,
    stopLoss: productionTrade.stop_loss,
    reasoning: `Production ${productionTrade.action.toUpperCase()} trade from Chart Analysis`,
    
    // Trade Execution
    status: mapStatus(productionTrade.status),
    entryDate: new Date(productionTrade.created_at).getTime(),
    actualEntryPrice: productionTrade.entry_price,
    
    // Performance Metrics
    profitLoss: productionTrade.unrealized_pnl || 0,
    profitLossPercentage: profitLossPercentage || 0,
    
    // Metadata
    createdAt: new Date(productionTrade.created_at).getTime(),
    updatedAt: new Date(productionTrade.updated_at).getTime(),
    
    // Validation Data
    priceAtRecommendation: productionTrade.entry_price
  };

  return aiTrade;
};

/**
 * Get all active trades in AI Trade Tracker format
 */
export const getAllActiveTradesForAITracker = async (): Promise<AITradeEntry[]> => {
  try {
    const productionTrades = await fetchAllActiveTradesFromProduction();
    const aiTrades = productionTrades.map(convertProductionTradeToAITrade);
    
    console.log(`🔄 [ProductionActiveTradesService] Converted ${productionTrades.length} production trades to AI format`);
    return aiTrades;
    
  } catch (error) {
    console.error('❌ [ProductionActiveTradesService] Error converting trades:', error);
    return [];
  }
};

/**
 * Close an active trade via the production API
 */
export const closeActiveTradeInProduction = async (
  ticker: string, 
  currentPrice: number, 
  notes?: string
): Promise<boolean> => {
  try {
    console.log(`🔒 [ProductionActiveTradesService] Closing active trade for ${ticker} at $${currentPrice}`);
    
    const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_price: currentPrice,
        notes: notes || 'Closed via AI Trade Tracker'
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [ProductionActiveTradesService] Successfully closed trade for ${ticker}`);
    return result.success || true;
    
  } catch (error) {
    console.error(`❌ [ProductionActiveTradesService] Error closing trade for ${ticker}:`, error);
    return false;
  }
};