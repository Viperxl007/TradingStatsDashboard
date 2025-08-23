/**
 * Production Active Trades Service
 * 
 * Integrates with the existing production active trades API to fetch real trade data
 * from the Chart Analysis system. This service bridges the AI Trade Tracker with
 * the production active trades database.
 */

import { AITradeEntry, AITradeStatus } from '../types/aiTradeTracker';
import { mapProductionStatusToAIStatus, ProductionTradeStatus } from '../utils/statusMapping';

export interface ProductionActiveTrade {
  id: number;
  ticker: string;
  timeframe: string;
  status: 'waiting' | 'active' | 'profit_hit' | 'stop_hit' | 'ai_closed' | 'user_closed';
  action: 'buy' | 'sell';
  entry_price: number;
  target_price?: number;
  stop_loss?: number;
  current_price?: number;
  unrealized_pnl?: number;
  created_at: string;
  updated_at: string;
  close_time?: string;
  close_price?: number;
  close_reason?: string;
  realized_pnl?: number;
  reasoning?: string;
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
  // Default position size for consistency (can be overridden if actual position size is available)
  const defaultPositionSizeUSD = 1000;
  
  // CRITICAL FIX: Determine if trade was actually executed vs just waiting
  // A trade that was 'waiting' and then closed should be treated as invalidated, not executed
  const wasActuallyExecuted = productionTrade.status !== 'waiting' &&
    (productionTrade.status === 'active' ||
     productionTrade.status === 'profit_hit' ||
     productionTrade.status === 'stop_hit' ||
     productionTrade.status === 'ai_closed' ||
     (productionTrade.status === 'user_closed' && productionTrade.close_price !== undefined));
  
  // Calculate percentage-based PnL (PRIMARY METRIC) - only for executed trades
  let profitLossPercentage = 0;
  let profitLossUSD = productionTrade.realized_pnl || productionTrade.unrealized_pnl || 0;
  
  // Only calculate performance metrics for trades that were actually executed
  if (wasActuallyExecuted) {
    if (productionTrade.entry_price && productionTrade.current_price) {
      // For active trades, calculate percentage based on current price vs entry
      if (productionTrade.action === 'buy') {
        profitLossPercentage = ((productionTrade.current_price - productionTrade.entry_price) / productionTrade.entry_price) * 100;
      } else {
        // For sell trades, profit when price goes down
        profitLossPercentage = ((productionTrade.entry_price - productionTrade.current_price) / productionTrade.entry_price) * 100;
      }
    } else if (productionTrade.entry_price && productionTrade.close_price) {
      // For closed trades, calculate percentage based on close price vs entry
      if (productionTrade.action === 'buy') {
        profitLossPercentage = ((productionTrade.close_price - productionTrade.entry_price) / productionTrade.entry_price) * 100;
      } else {
        // For sell trades, profit when price goes down
        profitLossPercentage = ((productionTrade.entry_price - productionTrade.close_price) / productionTrade.entry_price) * 100;
      }
    } else if (productionTrade.unrealized_pnl && productionTrade.entry_price) {
      // Fallback: estimate percentage from unrealized PnL (assuming $1000 position)
      profitLossPercentage = (productionTrade.unrealized_pnl / defaultPositionSizeUSD) * 100;
    }
  }

  // Calculate hold time if we have the data
  let holdTime: number | undefined;
  if (productionTrade.close_time) {
    const entryTime = new Date(productionTrade.created_at).getTime();
    const exitTime = new Date(productionTrade.close_time).getTime();
    holdTime = (exitTime - entryTime) / (1000 * 60 * 60); // Convert to hours
  }

  const aiTrade: AITradeEntry = {
    id: `backend-${productionTrade.id}`,
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
    reasoning: productionTrade.reasoning || `Production ${productionTrade.action.toUpperCase()} trade from Chart Analysis`,
    
    // Trade Execution - CRITICAL FIX: Only set actual entry data for executed trades
    status: mapProductionStatusToAIStatus(productionTrade.status),
    entryDate: new Date(productionTrade.created_at).getTime(),
    actualEntryDate: wasActuallyExecuted ? new Date(productionTrade.created_at).getTime() : undefined,
    actualEntryPrice: wasActuallyExecuted ? productionTrade.entry_price : undefined,
    exitDate: productionTrade.close_time ? new Date(productionTrade.close_time).getTime() : undefined,
    exitPrice: productionTrade.close_price,
    
    // Performance Metrics (PERCENTAGE-BASED PRIMARY) - only for executed trades
    profitLoss: wasActuallyExecuted ? profitLossUSD : undefined,
    profitLossPercentage: wasActuallyExecuted ? profitLossPercentage : undefined,
    positionSizeUSD: wasActuallyExecuted ? defaultPositionSizeUSD : undefined,
    entryPriceUSD: wasActuallyExecuted ? productionTrade.entry_price : undefined,
    exitPriceUSD: wasActuallyExecuted ? productionTrade.close_price : undefined,
    holdTime: wasActuallyExecuted ? holdTime : undefined,
    
    // Metadata
    createdAt: new Date(productionTrade.created_at).getTime(),
    updatedAt: new Date(productionTrade.updated_at).getTime(),
    
    // Validation Data
    priceAtRecommendation: productionTrade.entry_price
  };

  return aiTrade;
};

/**
 * Fetch all trades (including closed ones) from the production API for AI Trade Tracker history
 */
export const fetchAllTradesHistoryFromProduction = async (): Promise<ProductionActiveTrade[]> => {
  try {
    console.log('🔍 [ProductionActiveTradesService] Fetching all trades history from production API');
    
    const response = await fetch('http://localhost:5000/api/active-trades/history-all');
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('📭 [ProductionActiveTradesService] No trades found in history');
        return [];
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`✅ [ProductionActiveTradesService] Found ${data.count} trades in history`);
    return data.all_trades || [];
    
  } catch (error) {
    console.error('❌ [ProductionActiveTradesService] Error fetching trades history:', error);
    return [];
  }
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
 * Get all trades (including closed ones) in AI Trade Tracker format for history panel
 */
export const getAllTradesHistoryForAITracker = async (): Promise<AITradeEntry[]> => {
  try {
    const productionTrades = await fetchAllTradesHistoryFromProduction();
    const aiTrades = productionTrades.map(convertProductionTradeToAITrade);
    
    console.log(`🔄 [ProductionActiveTradesService] Converted ${productionTrades.length} production trades history to AI format`);
    return aiTrades;
    
  } catch (error) {
    console.error('❌ [ProductionActiveTradesService] Error converting trades history:', error);
    return [];
  }
};

/**
 * Close an active trade via the production API
 */
export const closeActiveTradeInProduction = async (
  ticker: string,
  currentPrice: number,
  notes?: string,
  closeReason?: string
): Promise<boolean> => {
  try {
    console.log(`🔒 [ProductionActiveTradesService] Closing active trade for ${ticker} at $${currentPrice} (reason: ${closeReason || 'user_closed'})`);
    
    const requestBody: any = {
      current_price: currentPrice,
      notes: notes || 'Closed via AI Trade Tracker'
    };
    
    // Add close reason if provided
    if (closeReason) {
      requestBody.close_reason = closeReason;
    }
    
    const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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