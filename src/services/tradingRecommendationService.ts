import { ChartAnalysisResult, TradingRecommendationOverlay, TradingAnnotation } from '../types/chartAnalysis';

/**
 * Trading Recommendation Service
 * 
 * Converts AI chart analysis results into trading recommendation overlays
 * that can be displayed on charts for specific timeframes
 */

/**
 * Creates a trading recommendation overlay from AI analysis results
 */
export const createTradingRecommendationOverlay = (
  analysis: ChartAnalysisResult
): TradingRecommendationOverlay | null => {
  if (!analysis.recommendations || !analysis.recommendations.action) {
    console.warn('No trading recommendations found in analysis');
    return null;
  }

  const { recommendations } = analysis;
  
  // Create the overlay object
  const overlay: TradingRecommendationOverlay = {
    id: `recommendation-${analysis.id}`,
    timeframe: analysis.timeframe,
    timestamp: analysis.timestamp,
    action: recommendations.action,
    entryPrice: recommendations.entryPrice || analysis.currentPrice,
    targetPrice: recommendations.targetPrice,
    stopLoss: recommendations.stopLoss,
    riskReward: recommendations.riskReward,
    reasoning: recommendations.reasoning,
    confidence: analysis.confidence,
    isActive: true,
    expiresAt: calculateExpirationTime(analysis.timeframe, analysis.timestamp)
  };

  console.log(`🎯 [TradingRecommendationService] Created overlay for ${analysis.ticker} ${analysis.timeframe}:`, {
    action: overlay.action,
    entryPrice: overlay.entryPrice,
    targetPrice: overlay.targetPrice,
    stopLoss: overlay.stopLoss,
    timeframe: overlay.timeframe
  });

  return overlay;
};

/**
 * Calculate when a trading recommendation should expire based on timeframe
 */
const calculateExpirationTime = (timeframe: string, timestamp: number): number => {
  const now = timestamp * 1000; // Convert to milliseconds
  
  // Define expiration periods based on timeframe
  const expirationPeriods: { [key: string]: number } = {
    '1m': 1 * 60 * 60 * 1000,      // 1 hour for 1-minute charts
    '5m': 4 * 60 * 60 * 1000,      // 4 hours for 5-minute charts
    '15m': 12 * 60 * 60 * 1000,    // 12 hours for 15-minute charts
    '30m': 24 * 60 * 60 * 1000,    // 1 day for 30-minute charts
    '1h': 3 * 24 * 60 * 60 * 1000, // 3 days for 1-hour charts
    '4h': 7 * 24 * 60 * 60 * 1000, // 1 week for 4-hour charts
    '1D': 30 * 24 * 60 * 60 * 1000, // 1 month for daily charts
    '1W': 90 * 24 * 60 * 60 * 1000, // 3 months for weekly charts
  };

  const expirationPeriod = expirationPeriods[timeframe] || 24 * 60 * 60 * 1000; // Default to 1 day
  return now + expirationPeriod;
};

/**
 * Check if a trading recommendation is still valid/active
 */
export const isRecommendationActive = (overlay: TradingRecommendationOverlay): boolean => {
  const now = Date.now();
  
  // Check if expired
  if (overlay.expiresAt && now > overlay.expiresAt) {
    return false;
  }
  
  // Check if manually deactivated
  if (!overlay.isActive) {
    return false;
  }
  
  return true;
};

/**
 * Update the active status of a trading recommendation
 */
export const updateRecommendationStatus = (
  overlay: TradingRecommendationOverlay,
  isActive: boolean
): TradingRecommendationOverlay => {
  return {
    ...overlay,
    isActive
  };
};

/**
 * Get all active trading recommendations for a specific timeframe
 */
export const getActiveRecommendationsForTimeframe = (
  recommendations: Map<string, TradingRecommendationOverlay>,
  timeframe: string
): TradingRecommendationOverlay[] => {
  const active: TradingRecommendationOverlay[] = [];
  
  recommendations.forEach((recommendation) => {
    if (recommendation.timeframe === timeframe && isRecommendationActive(recommendation)) {
      active.push(recommendation);
    }
  });
  
  return active;
};

/**
 * Clean up expired recommendations from the map
 */
export const cleanupExpiredRecommendations = (
  recommendations: Map<string, TradingRecommendationOverlay>
): Map<string, TradingRecommendationOverlay> => {
  const cleaned = new Map<string, TradingRecommendationOverlay>();
  
  recommendations.forEach((recommendation, key) => {
    if (isRecommendationActive(recommendation)) {
      cleaned.set(key, recommendation);
    } else {
      console.log(`🧹 [TradingRecommendationService] Removing expired recommendation: ${key}`);
    }
  });
  
  return cleaned;
};

/**
 * Create trading annotations from a recommendation overlay
 */
export const createTradingAnnotations = (
  overlay: TradingRecommendationOverlay
): TradingAnnotation[] => {
  const annotations: TradingAnnotation[] = [];
  
  // Entry annotation
  if (overlay.entryPrice) {
    annotations.push({
      id: `entry-${overlay.id}`,
      type: 'entry',
      price: overlay.entryPrice,
      color: overlay.action === 'buy' ? '#10b981' : '#ef4444',
      label: `${overlay.action.toUpperCase()} Entry`,
      description: `Entry point for ${overlay.action} recommendation`,
      visible: true,
      style: 'solid',
      width: 3,
      timeframe: overlay.timeframe
    });
  }
  
  // Target annotation
  if (overlay.targetPrice) {
    annotations.push({
      id: `target-${overlay.id}`,
      type: 'target',
      price: overlay.targetPrice,
      color: '#22c55e',
      label: 'Target',
      description: 'Price target for the trade',
      visible: true,
      style: 'dashed',
      width: 2,
      timeframe: overlay.timeframe
    });
  }
  
  // Stop loss annotation
  if (overlay.stopLoss) {
    annotations.push({
      id: `stopLoss-${overlay.id}`,
      type: 'stopLoss',
      price: overlay.stopLoss,
      color: '#ef4444',
      label: 'Stop Loss',
      description: 'Stop loss level to limit risk',
      visible: true,
      style: 'dashed',
      width: 2,
      timeframe: overlay.timeframe
    });
  }
  
  return annotations;
};

/**
 * Format trading recommendation for display
 */
export const formatRecommendationSummary = (overlay: TradingRecommendationOverlay): string => {
  const parts: string[] = [];
  
  parts.push(`${overlay.action.toUpperCase()} at $${overlay.entryPrice?.toFixed(2) || 'N/A'}`);
  
  if (overlay.targetPrice) {
    parts.push(`Target: $${overlay.targetPrice.toFixed(2)}`);
  }
  
  if (overlay.stopLoss) {
    parts.push(`Stop: $${overlay.stopLoss.toFixed(2)}`);
  }
  
  if (overlay.riskReward) {
    parts.push(`R/R: 1:${overlay.riskReward.toFixed(2)}`);
  }
  
  return parts.join(' | ');
};