import { TradingRecommendationOverlay } from '../types/chartAnalysis';

/**
 * Active Trade Service
 * 
 * Handles fetching and converting active trades to trading recommendation overlays
 * for chart display
 */

export interface ActiveTrade {
  id: number;
  ticker: string;
  timeframe: string;
  status: 'waiting' | 'active';
  action: 'buy' | 'sell';
  entry_price: number;
  target_price?: number;
  stop_loss?: number;
  current_price?: number;
  unrealized_pnl?: number;
  entry_strategy?: string;
  entry_condition?: string;
  time_since_creation_hours?: number;
  time_since_trigger_hours?: number;
  max_favorable_price?: number;
  max_adverse_price?: number;
}

/**
 * Fetch active trade for a specific ticker
 */
export const fetchActiveTrade = async (ticker: string): Promise<ActiveTrade | null> => {
  try {
    console.log(`🔍 [ActiveTradeService] Fetching active trade for ${ticker}`);
    
    const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 [ActiveTradeService] No active trade found for ${ticker}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.active_trade) {
      console.log(`✅ [ActiveTradeService] Found active trade for ${ticker}:`, data.active_trade);
      return data.active_trade;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [ActiveTradeService] Error fetching active trade for ${ticker}:`, error);
    return null;
  }
};

/**
 * Convert an active trade to a trading recommendation overlay for chart display
 */
export const convertActiveTradeToOverlay = (
  activeTrade: ActiveTrade,
  currentTimeframe: string
): TradingRecommendationOverlay | null => {
  // Only show active trade overlay if it matches the current timeframe
  if (activeTrade.timeframe !== currentTimeframe) {
    console.log(`⏭️ [ActiveTradeService] Active trade timeframe (${activeTrade.timeframe}) doesn't match current timeframe (${currentTimeframe})`);
    return null;
  }

  const overlay: TradingRecommendationOverlay = {
    id: `active-trade-${activeTrade.id}`,
    timeframe: activeTrade.timeframe,
    timestamp: Date.now() / 1000, // Current timestamp
    action: activeTrade.action,
    entryPrice: activeTrade.entry_price,
    targetPrice: activeTrade.target_price,
    stopLoss: activeTrade.stop_loss,
    riskReward: activeTrade.target_price && activeTrade.stop_loss 
      ? Math.abs((activeTrade.target_price - activeTrade.entry_price) / (activeTrade.entry_price - activeTrade.stop_loss))
      : undefined,
    reasoning: `Active ${activeTrade.action.toUpperCase()} trade (ID: ${activeTrade.id})`,
    confidence: 100, // Active trades have 100% confidence since they're already executed
    isActive: true,
    expiresAt: undefined, // Active trades don't expire until closed
    isActiveTrade: true // Flag to distinguish from AI recommendations
  };

  console.log(`🎯 [ActiveTradeService] Created overlay for active trade ${activeTrade.id}:`, {
    action: overlay.action,
    entryPrice: overlay.entryPrice,
    targetPrice: overlay.targetPrice,
    stopLoss: overlay.stopLoss,
    timeframe: overlay.timeframe
  });

  return overlay;
};

/**
 * Get active trade overlay for a specific ticker and timeframe
 */
export const getActiveTradeOverlay = async (
  ticker: string,
  timeframe: string
): Promise<TradingRecommendationOverlay | null> => {
  const activeTrade = await fetchActiveTrade(ticker);
  
  if (!activeTrade) {
    return null;
  }
  
  return convertActiveTradeToOverlay(activeTrade, timeframe);
};