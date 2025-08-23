/**
 * Persistent Trading Recommendation Service
 * 
 * This service handles all trading recommendation persistence operations,
 * ensuring single source of truth by using backend-only storage.
 * No frontend state is maintained - all data is fetched on-demand from the backend.
 */

import { TradingRecommendationOverlay } from '../types/chartAnalysis';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Error class for trading recommendation service errors
 */
export class TradingRecommendationError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TradingRecommendationError';
  }
}

/**
 * Save a trading recommendation to the backend
 * 
 * @param ticker - Stock ticker symbol
 * @param recommendation - Trading recommendation data
 * @returns Promise with the saved recommendation data
 */
export const saveTradingRecommendation = async (
  ticker: string,
  recommendation: TradingRecommendationOverlay
): Promise<TradingRecommendationOverlay> => {
  try {
    console.log(`💾 [PersistentTradingRecommendationService] Saving recommendation for ${ticker} ${recommendation.timeframe}`);
    
    const response = await fetch(`${API_BASE_URL}/trading-recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: recommendation.id,
        ticker,
        timeframe: recommendation.timeframe,
        timestamp: recommendation.timestamp,
        action: recommendation.action,
        entryPrice: recommendation.entryPrice,
        targetPrice: recommendation.targetPrice,
        stopLoss: recommendation.stopLoss,
        riskReward: recommendation.riskReward,
        reasoning: recommendation.reasoning,
        confidence: recommendation.confidence,
        isActive: recommendation.isActive,
        expiresAt: recommendation.expiresAt,
        analysisId: recommendation.id // Use recommendation ID as analysis ID for now
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to save recommendation');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Saved recommendation: ${recommendation.id}`);
    return result.recommendation;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error saving recommendation:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    throw new TradingRecommendationError(
      `Failed to save trading recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Fetch active trading recommendations for a ticker and timeframe
 * 
 * @param ticker - Stock ticker symbol
 * @param timeframe - Chart timeframe
 * @returns Promise with array of active recommendations
 */
export const fetchActiveTradingRecommendations = async (
  ticker: string,
  timeframe: string
): Promise<TradingRecommendationOverlay[]> => {
  try {
    console.log(`🔍 [PersistentTradingRecommendationService] Fetching active recommendations for ${ticker} ${timeframe}`);
    
    const response = await fetch(
      `${API_BASE_URL}/trading-recommendations/${ticker}/${timeframe}/active`
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 [PersistentTradingRecommendationService] No active recommendations found for ${ticker} ${timeframe}`);
        return [];
      }
      
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to fetch recommendations');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Retrieved ${result.count} active recommendations`);
    return result.recommendations;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error fetching recommendations:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    // Return empty array on error to prevent UI crashes
    console.warn(`⚠️ [PersistentTradingRecommendationService] Returning empty array due to error`);
    return [];
  }
};

/**
 * Fetch all trading recommendations for a ticker (active and inactive)
 * 
 * @param ticker - Stock ticker symbol
 * @param timeframe - Optional timeframe filter
 * @returns Promise with array of all recommendations
 */
export const fetchAllTradingRecommendations = async (
  ticker: string,
  timeframe?: string
): Promise<TradingRecommendationOverlay[]> => {
  try {
    console.log(`🔍 [PersistentTradingRecommendationService] Fetching all recommendations for ${ticker}${timeframe ? ` ${timeframe}` : ''}`);
    
    const url = timeframe 
      ? `${API_BASE_URL}/trading-recommendations/${ticker}?timeframe=${timeframe}&active_only=false`
      : `${API_BASE_URL}/trading-recommendations/${ticker}?active_only=false`;
    
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 [PersistentTradingRecommendationService] No recommendations found for ${ticker}`);
        return [];
      }
      
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to fetch recommendations');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Retrieved ${result.count} total recommendations`);
    return result.recommendations;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error fetching all recommendations:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    // Return empty array on error to prevent UI crashes
    console.warn(`⚠️ [PersistentTradingRecommendationService] Returning empty array due to error`);
    return [];
  }
};

/**
 * Update the status of a trading recommendation
 * 
 * @param recommendationId - ID of the recommendation to update
 * @param isActive - Whether the recommendation should be active
 * @param status - Optional status to set
 * @returns Promise with success status
 */
export const updateRecommendationStatus = async (
  recommendationId: string,
  isActive: boolean,
  status?: string
): Promise<boolean> => {
  try {
    console.log(`🔄 [PersistentTradingRecommendationService] Updating recommendation ${recommendationId}: active=${isActive}, status=${status}`);
    
    const response = await fetch(`${API_BASE_URL}/trading-recommendations/id/${recommendationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isActive,
        status
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to update recommendation');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Updated recommendation: ${recommendationId}`);
    return true;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error updating recommendation:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    throw new TradingRecommendationError(
      `Failed to update recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Deactivate a trading recommendation
 * 
 * @param recommendationId - ID of the recommendation to deactivate
 * @returns Promise with success status
 */
export const deactivateRecommendation = async (
  recommendationId: string
): Promise<boolean> => {
  try {
    console.log(`🔒 [PersistentTradingRecommendationService] Deactivating recommendation: ${recommendationId}`);
    
    const response = await fetch(`${API_BASE_URL}/trading-recommendations/id/${recommendationId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to deactivate recommendation');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Deactivated recommendation: ${recommendationId}`);
    return true;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error deactivating recommendation:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    throw new TradingRecommendationError(
      `Failed to deactivate recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Clean up expired trading recommendations
 * 
 * @returns Promise with number of expired recommendations cleaned up
 */
export const cleanupExpiredRecommendations = async (): Promise<number> => {
  try {
    console.log(`🧹 [PersistentTradingRecommendationService] Cleaning up expired recommendations`);
    
    const response = await fetch(`${API_BASE_URL}/trading-recommendations/cleanup/expired`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to cleanup expired recommendations');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Cleaned up ${result.expired_count} expired recommendations`);
    return result.expired_count;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error cleaning up expired recommendations:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    throw new TradingRecommendationError(
      `Failed to cleanup expired recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Get a specific trading recommendation by ID
 * 
 * @param recommendationId - ID of the recommendation to fetch
 * @returns Promise with the recommendation data or null if not found
 */
export const getRecommendationById = async (
  recommendationId: string
): Promise<TradingRecommendationOverlay | null> => {
  try {
    console.log(`🔍 [PersistentTradingRecommendationService] Fetching recommendation by ID: ${recommendationId}`);
    
    const response = await fetch(`${API_BASE_URL}/trading-recommendations/id/${recommendationId}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📭 [PersistentTradingRecommendationService] Recommendation not found: ${recommendationId}`);
        return null;
      }
      
      const errorData = await response.json();
      throw new TradingRecommendationError(
        errorData.error || `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new TradingRecommendationError(result.error || 'Failed to fetch recommendation');
    }

    console.log(`✅ [PersistentTradingRecommendationService] Retrieved recommendation: ${recommendationId}`);
    return result.recommendation;

  } catch (error) {
    console.error(`❌ [PersistentTradingRecommendationService] Error fetching recommendation by ID:`, error);
    
    if (error instanceof TradingRecommendationError) {
      throw error;
    }
    
    // Return null on error to indicate not found
    console.warn(`⚠️ [PersistentTradingRecommendationService] Returning null due to error`);
    return null;
  }
};

/**
 * Helper function to check if the backend service is available
 * 
 * @returns Promise with availability status
 */
export const checkServiceAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/trading-recommendations/cleanup/expired`, {
      method: 'HEAD'
    });
    
    return response.status !== 404; // Service exists if not 404
    
  } catch (error) {
    console.warn(`⚠️ [PersistentTradingRecommendationService] Service availability check failed:`, error);
    return false;
  }
};