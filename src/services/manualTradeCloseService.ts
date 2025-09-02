/**
 * Manual Trade Close Service
 * 
 * Handles manual closing of active trades with different close reasons:
 * - Profit Hit: Target was reached
 * - Stop Loss Hit: Stop loss was triggered
 * - Early Close: User-initiated close with custom price
 */

import { closeActiveTradeInProduction } from './productionActiveTradesService';
import { TradingRecommendationOverlay } from '../types/chartAnalysis';
import { fetchActiveTradingRecommendations, deactivateRecommendation } from './persistentTradingRecommendationService';

export type ManualCloseReason = 'profit_hit' | 'stop_hit' | 'user_closed';

export interface ManualCloseRequest {
  ticker: string;
  reason: ManualCloseReason;
  closePrice: number;
  notes?: string;
}

export interface ManualCloseResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Close an active trade manually with the specified reason
 */
export const closeTradeManually = async (
  request: ManualCloseRequest
): Promise<ManualCloseResult> => {
  try {
    console.log(`🎯 [ManualTradeClose] Closing ${request.ticker} trade manually:`, {
      reason: request.reason,
      closePrice: request.closePrice,
      notes: request.notes
    });

    // Prepare notes and close reason based on close type
    let closeNotes = request.notes || '';
    let closeReason = '';
    
    switch (request.reason) {
      case 'profit_hit':
        closeNotes = `🎯 PROFIT TARGET HIT - Manual close at $${request.closePrice}. ${closeNotes}`.trim();
        closeReason = 'profit_hit';
        break;
      case 'stop_hit':
        closeNotes = `🛡️ STOP LOSS HIT - Manual close at $${request.closePrice}. ${closeNotes}`.trim();
        closeReason = 'stop_hit';
        break;
      case 'user_closed':
        closeNotes = `⏰ EARLY CLOSE - User initiated close at $${request.closePrice}. ${closeNotes}`.trim();
        closeReason = 'user_closed';
        break;
    }

    // Call the production API to close the trade with proper reason
    const success = await closeActiveTradeInProduction(
      request.ticker,
      request.closePrice,
      closeNotes,
      closeReason
    );

    if (success) {
      // CRITICAL: Clear trading recommendations from backend database
      try {
        console.log(`🧹 [ManualTradeClose] Clearing trading recommendations for ${request.ticker} after manual closure`);
        
        // Get all active recommendations for all timeframes for this ticker
        const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D'];
        const allRecommendations = [];
        
        for (const timeframe of timeframes) {
          try {
            const recommendations = await fetchActiveTradingRecommendations(request.ticker, timeframe);
            allRecommendations.push(...recommendations);
          } catch (error) {
            // Continue if no recommendations found for this timeframe
            console.log(`📭 [ManualTradeClose] No recommendations found for ${request.ticker} ${timeframe}`);
          }
        }
        
        // Deactivate all found recommendations
        for (const recommendation of allRecommendations) {
          try {
            await deactivateRecommendation(recommendation.id);
            console.log(`🔒 [ManualTradeClose] Deactivated recommendation ${recommendation.id} for ${request.ticker}`);
          } catch (error) {
            console.error(`❌ [ManualTradeClose] Failed to deactivate recommendation ${recommendation.id}:`, error);
          }
        }
        
        console.log(`✅ [ManualTradeClose] Cleared ${allRecommendations.length} trading recommendations for ${request.ticker}`);
      } catch (error) {
        console.error(`❌ [ManualTradeClose] Error clearing trading recommendations:`, error);
        // Don't fail the trade closure if recommendation clearing fails
      }

      const reasonText = {
        profit_hit: 'Profit Target Hit',
        stop_hit: 'Stop Loss Hit',
        user_closed: 'Early Close'
      }[request.reason];

      return {
        success: true,
        message: `✅ Trade closed successfully - ${reasonText} at $${request.closePrice}`
      };
    } else {
      return {
        success: false,
        message: '❌ Failed to close trade',
        error: 'Backend API call failed'
      };
    }

  } catch (error) {
    console.error(`❌ [ManualTradeClose] Error closing trade for ${request.ticker}:`, error);
    
    return {
      success: false,
      message: '❌ Error closing trade',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Validate if a trade can be closed manually
 */
export const validateTradeForManualClose = (
  recommendation: TradingRecommendationOverlay | null,
  currentTimeframe: string
): { canClose: boolean; reason?: string } => {
  if (!recommendation) {
    return { canClose: false, reason: 'No active recommendation found' };
  }

  if (!recommendation.isActive) {
    return { canClose: false, reason: 'Recommendation is not active' };
  }

  if (recommendation.timeframe !== currentTimeframe) {
    return { canClose: false, reason: 'Recommendation timeframe does not match current timeframe' };
  }

  return { canClose: true };
};

/**
 * Get suggested close price based on close reason
 */
export const getSuggestedClosePrice = (
  recommendation: TradingRecommendationOverlay,
  reason: ManualCloseReason,
  currentPrice?: number
): number => {
  switch (reason) {
    case 'profit_hit':
      return recommendation.targetPrice || currentPrice || recommendation.entryPrice;
    case 'stop_hit':
      return recommendation.stopLoss || currentPrice || recommendation.entryPrice;
    case 'user_closed':
      return currentPrice || recommendation.entryPrice;
    default:
      return currentPrice || recommendation.entryPrice;
  }
};

/**
 * Calculate profit/loss for display purposes
 */
export const calculateProfitLoss = (
  recommendation: TradingRecommendationOverlay,
  closePrice: number
): { amount: number; percentage: number; isProfit: boolean } => {
  const entryPrice = recommendation.entryPrice;
  const isLong = recommendation.action === 'buy';
  
  let amount: number;
  if (isLong) {
    amount = closePrice - entryPrice;
  } else {
    amount = entryPrice - closePrice;
  }
  
  const percentage = (Math.abs(amount) / entryPrice) * 100;
  const isProfit = amount > 0;
  
  return {
    amount: Math.abs(amount),
    percentage,
    isProfit
  };
};