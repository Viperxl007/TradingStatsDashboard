/**
 * Liquidity Tracking Service
 * API client for all CL position endpoints
 */

import {
  CLPosition,
  CLPriceHistory,
  CLFeeHistory,
  CLAlert,
  CLAnalytics,
  CLPortfolioSummary,
  CreatePositionFormData,
  CLApiResponse,
  CLRealTimeUpdate,
  CLExportData
} from '../types/liquidityTracking';

// Base API URL - adjust based on your backend configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Generic API request handler with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<CLApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    
    // Backend returns {success: true, data: [...]} format
    // Extract the actual data from the response
    if (responseData.success && responseData.data !== undefined) {
      return {
        success: true,
        data: responseData.data,
      };
    } else {
      // Handle case where backend doesn't follow expected format
      return {
        success: true,
        data: responseData,
      };
    }
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Position Management API calls
 */
export const positionService = {
  /**
   * Get all positions for a user
   */
  async getPositions(userId: string): Promise<CLApiResponse<CLPosition[]>> {
    const response = await apiRequest<any[]>(`/cl/positions?user_id=${userId}`);
    if (response.success && response.data && Array.isArray(response.data)) {
      response.data = response.data.map(transformPosition);
    }
    return response as CLApiResponse<CLPosition[]>;
  },

  /**
   * Get a specific position by ID
   */
  async getPosition(positionId: string): Promise<CLApiResponse<CLPosition>> {
    const response = await apiRequest<any>(`/cl/positions/${positionId}`);
    if (response.success && response.data) {
      response.data = transformPosition(response.data);
    }
    return response as CLApiResponse<CLPosition>;
  },

  /**
   * Create a new position
   */
  async createPosition(positionData: CreatePositionFormData): Promise<CLApiResponse<CLPosition>> {
    const response = await apiRequest<any>('/cl/positions', {
      method: 'POST',
      body: JSON.stringify(positionData),
    });
    if (response.success && response.data) {
      response.data = transformPosition(response.data);
    }
    return response as CLApiResponse<CLPosition>;
  },

  /**
   * Update an existing position
   */
  async updatePosition(
    positionId: string,
    updates: Partial<CLPosition>
  ): Promise<CLApiResponse<CLPosition>> {
    return apiRequest<CLPosition>(`/cl/positions/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete a position
   */
  async deletePosition(positionId: string): Promise<CLApiResponse<void>> {
    return apiRequest<void>(`/cl/positions/${positionId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Close a position (mark as closed)
   */
  async closePosition(positionId: string): Promise<CLApiResponse<CLPosition>> {
    return apiRequest<CLPosition>(`/cl/positions/${positionId}/close`, {
      method: 'POST',
    });
  },
};

/**
 * Price History API calls
 */
export const priceHistoryService = {
  /**
   * Get price history for a position
   */
  async getPriceHistory(
    positionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CLApiResponse<CLPriceHistory[]>> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString();
    const endpoint = `/cl/positions/${positionId}/price-history${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<CLPriceHistory[]>(endpoint);
  },

  /**
   * Get current price data for a position
   */
  async getCurrentPrice(positionId: string): Promise<CLApiResponse<any>> {
    try {
      // First try to get the position to check if it contains HYPE
      const positionResponse = await positionService.getPosition(positionId);
      
      if (positionResponse.success && positionResponse.data) {
        const position = positionResponse.data;
        
        // Check if this position involves HYPE token
        const hasHype = position.token0_address?.toLowerCase() === '0x0d01dc56dcaaca66ad901c959b4011ec' ||
                       position.token1_address?.toLowerCase() === '0x0d01dc56dcaaca66ad901c959b4011ec' ||
                       position.token0_symbol?.toLowerCase() === 'hype' ||
                       position.token1_symbol?.toLowerCase() === 'hype';
        
        if (hasHype) {
          // Use DexScreener for HYPE positions
          const dexScreenerResponse = await dexScreenerService.getPositionValue(position);
          
          if (dexScreenerResponse.success && dexScreenerResponse.data) {
            return {
              success: true,
              data: {
                position_value: {
                  current_usd_value: dexScreenerResponse.data.current_usd_value,
                  token0_price: dexScreenerResponse.data.token0_price,
                  token1_price: dexScreenerResponse.data.token1_price,
                  pnl: dexScreenerResponse.data.current_usd_value - position.initial_usd_value,
                  pnl_percentage: position.initial_usd_value > 0
                    ? ((dexScreenerResponse.data.current_usd_value - position.initial_usd_value) / position.initial_usd_value) * 100
                    : 0
                },
                price_data: dexScreenerResponse.data.price_data,
                source: 'dexscreener'
              }
            };
          }
        }
      }
      
      // Fallback to backend API for non-HYPE positions or if DexScreener fails
      return apiRequest<any>(`/cl/positions/${positionId}/current-price`);
    } catch (error) {
      console.error('Error getting current price:', error);
      // Fallback to backend API
      return apiRequest<any>(`/cl/positions/${positionId}/current-price`);
    }
  },

  /**
   * Update position with current market data
   */
  async updatePositionPrices(positionId: string): Promise<CLApiResponse<CLPosition>> {
    return apiRequest<CLPosition>(`/cl/positions/${positionId}/update-prices`, {
      method: 'POST',
    });
  },

  /**
   * Get position with enriched real-time price data
   */
  async getPositionWithCurrentPrice(positionId: string): Promise<CLApiResponse<CLPosition & { priceData?: any }>> {
    try {
      // First get the position data
      const positionResponse = await apiRequest<any>(`/cl/positions/${positionId}`);
      if (!positionResponse.success || !positionResponse.data) {
        return positionResponse as CLApiResponse<CLPosition & { priceData?: any }>;
      }

      // Then get current price data
      const priceResponse = await this.getCurrentPrice(positionId);
      
      let enrichedPosition = transformPosition(positionResponse.data);
      
      if (priceResponse.success && priceResponse.data) {
        // Update position with real-time data
        const priceData = priceResponse.data;
        
        if (priceData.position_value) {
          enrichedPosition.current_usd_value = priceData.position_value.current_usd_value || enrichedPosition.current_usd_value;
          
          // Calculate P&L if available
          if (priceData.position_value.pnl !== undefined) {
            enrichedPosition.total_return = priceData.position_value.pnl;
            enrichedPosition.total_return_percentage = priceData.position_value.pnl_percentage || 0;
          }
        }
        
        // Add price data for frontend use
        (enrichedPosition as any).priceData = priceData;
      }

      return {
        success: true,
        data: enrichedPosition as CLPosition & { priceData?: any }
      };
    } catch (error) {
      console.error('Error fetching position with current price:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch position with current price'
      };
    }
  },
};

/**
 * Fee History API calls
 */
export const feeHistoryService = {
  /**
   * Get fee collection history for a position
   */
  async getFeeHistory(
    positionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CLApiResponse<CLFeeHistory[]>> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString();
    const endpoint = `/cl/positions/${positionId}/fee-history${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<CLFeeHistory[]>(endpoint);
  },

  /**
   * Record fee collection
   */
  async recordFeeCollection(
    positionId: string,
    feeData: {
      token0_fees: number;
      token1_fees: number;
      usd_value: number;
      transaction_hash?: string;
    }
  ): Promise<CLApiResponse<CLFeeHistory>> {
    return apiRequest<CLFeeHistory>(`/cl/positions/${positionId}/fees`, {
      method: 'POST',
      body: JSON.stringify(feeData),
    });
  },
};

/**
 * Analytics API calls
 */
export const analyticsService = {
  /**
   * Get analytics for a specific position
   */
  async getPositionAnalytics(
    positionId: string,
    period?: string
  ): Promise<CLApiResponse<CLAnalytics>> {
    const endpoint = `/cl/positions/${positionId}/analytics${period ? `?period=${period}` : ''}`;
    return apiRequest<CLAnalytics>(endpoint);
  },

  /**
   * Get portfolio summary analytics
   */
  async getPortfolioSummary(userId: string): Promise<CLApiResponse<CLPortfolioSummary>> {
    return apiRequest<CLPortfolioSummary>(`/cl/portfolio/summary?user_id=${userId}`);
  },

  /**
   * Get performance comparison between positions
   */
  async comparePositions(positionIds: string[]): Promise<CLApiResponse<any>> {
    return apiRequest<any>('/cl/analytics/compare', {
      method: 'POST',
      body: JSON.stringify({ position_ids: positionIds }),
    });
  },
};

/**
 * Alert Management API calls
 */
export const alertService = {
  /**
   * Get all alerts for a user
   */
  async getAlerts(userId: string): Promise<CLApiResponse<CLAlert[]>> {
    return apiRequest<CLAlert[]>(`/cl/alerts?user_id=${userId}`);
  },

  /**
   * Get alerts for a specific position
   */
  async getPositionAlerts(positionId: string): Promise<CLApiResponse<CLAlert[]>> {
    return apiRequest<CLAlert[]>(`/cl/alerts?position_id=${positionId}`);
  },

  /**
   * Create a new alert
   */
  async createAlert(alertData: {
    position_id: string;
    alert_type: string;
    threshold_value: number;
    message: string;
  }): Promise<CLApiResponse<CLAlert>> {
    return apiRequest<CLAlert>('/cl/alerts', {
      method: 'POST',
      body: JSON.stringify(alertData),
    });
  },

  /**
   * Update an alert
   */
  async updateAlert(
    alertId: string,
    updates: Partial<CLAlert>
  ): Promise<CLApiResponse<CLAlert>> {
    return apiRequest<CLAlert>(`/cl/alerts/${alertId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string): Promise<CLApiResponse<void>> {
    return apiRequest<void>(`/cl/alerts/${alertId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Mark alert as read/acknowledged
   */
  async acknowledgeAlert(alertId: string): Promise<CLApiResponse<CLAlert>> {
    return apiRequest<CLAlert>(`/cl/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
  },
};

/**
 * Real-time Data Service
 */
export const realTimeService = {
  /**
   * Get real-time updates for all positions
   */
  async getRealTimeUpdates(userId: string): Promise<CLApiResponse<CLRealTimeUpdate[]>> {
    return apiRequest<CLRealTimeUpdate[]>(`/cl/realtime/updates?user_id=${userId}`);
  },

  /**
   * Subscribe to real-time updates (WebSocket connection)
   */
  subscribeToUpdates(
    userId: string,
    onUpdate: (update: CLRealTimeUpdate) => void,
    onError: (error: Error) => void
  ): () => void {
    // WebSocket implementation for real-time updates
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/cl/realtime/subscribe?user_id=${userId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as CLRealTimeUpdate;
        onUpdate(update);
      } catch (error) {
        onError(new Error('Failed to parse real-time update'));
      }
    };

    ws.onerror = (event) => {
      onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      console.log('Real-time connection closed');
    };

    // Return cleanup function
    return () => {
      ws.close();
    };
  },
};

/**
 * Data Export/Import Service
 */
export const dataService = {
  /**
   * Export position data
   */
  async exportData(
    userId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<CLApiResponse<CLExportData | Blob>> {
    if (format === 'csv') {
      const response = await fetch(`${API_BASE_URL}/cl/export/csv?user_id=${userId}`, {
        headers: {
          'Accept': 'text/csv',
        },
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `Export failed: ${response.statusText}`,
        };
      }
      
      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    }
    
    return apiRequest<CLExportData>(`/cl/export/json?user_id=${userId}`);
  },

  /**
   * Import position data
   */
  async importData(file: File): Promise<CLApiResponse<{ imported_count: number }>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/cl/import`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Import failed: ${response.statusText}`);
      }

      const backendResponse = await response.json();
      
      // Handle backend response format {success: true, data: [...]}
      if (backendResponse.success && backendResponse.data !== undefined) {
        return {
          success: true,
          data: backendResponse.data,
        };
      } else {
        // Handle direct data responses
        return {
          success: true,
          data: backendResponse,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Import failed',
      };
    }
  },
};

/**
 * Transform backend position data to frontend format
 */
function transformPosition(backendPosition: any): CLPosition {
  const [token0_symbol, token1_symbol] = (backendPosition.pair_symbol || '').split('/');
  
  // Convert Unix timestamps to ISO strings
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return new Date().toISOString();
    // Handle both Unix timestamps (seconds) and milliseconds
    const ts = typeof timestamp === 'number' ? timestamp : parseInt(timestamp);
    const date = ts > 1e10 ? new Date(ts) : new Date(ts * 1000);
    return date.toISOString();
  };

  // Parse notes to extract token amounts and fee tier if available
  const notes = backendPosition.notes || '';
  let token0_amount = 0;
  let token1_amount = 0;
  let fee_tier = 0;
  
  // Try to extract token amounts from notes (format: "Token0: SYMBOL (AMOUNT), Token1: SYMBOL (AMOUNT)")
  const token0Match = notes.match(/Token0:\s*\w+\s*\(([0-9.]+)\)/);
  const token1Match = notes.match(/Token1:\s*\w+\s*\(([0-9.]+)\)/);
  
  // Try to extract fee tier from notes (format: "Fee Tier: XXXbp")
  const feeTierMatch = notes.match(/Fee Tier:\s*([0-9.]+)bp/);
  
  if (token0Match) token0_amount = parseFloat(token0Match[1]) || 0;
  if (token1Match) token1_amount = parseFloat(token1Match[1]) || 0;
  if (feeTierMatch) fee_tier = parseFloat(feeTierMatch[1]) || 0;
  
  // If no token amounts in notes, split liquidity_amount equally
  if (token0_amount === 0 && token1_amount === 0 && backendPosition.liquidity_amount) {
    token0_amount = backendPosition.liquidity_amount / 2;
    token1_amount = backendPosition.liquidity_amount / 2;
  }
  
  // Handle LICKO/WHYPE position specifically - add token addresses if missing
  let token0_address = backendPosition.token0_address || '';
  let token1_address = backendPosition.token1_address || '';
  
  if (!token0_address && !token1_address && backendPosition.pair_symbol === 'LICKO/WHYPE') {
    // Add known token addresses for LICKO/WHYPE pair
    token0_address = '0x1234567890abcdef1234567890abcdef12345678'; // Placeholder LICKO address
    token1_address = '0xabcdef1234567890abcdef1234567890abcdef12'; // Placeholder WHYPE address
  }

  return {
    id: backendPosition.id || '',
    user_id: backendPosition.user_id || 'user123',
    pool_address: backendPosition.contract_address || '',
    token0_address, // Now available from backend or set for LICKO/WHYPE
    token1_address, // Now available from backend or set for LICKO/WHYPE
    token0_symbol: token0_symbol || '',
    token1_symbol: token1_symbol || '',
    pair_symbol: backendPosition.pair_symbol || '',
    fee_tier: fee_tier, // Extracted from notes
    tick_lower: 0, // Not stored in backend
    tick_upper: 0, // Not stored in backend
    price_lower: backendPosition.price_range_min || 0,
    price_upper: backendPosition.price_range_max || 0,
    liquidity: backendPosition.liquidity_amount?.toString() || '0',
    token0_amount,
    token1_amount,
    initial_token0_amount: token0_amount, // Assume same as current for now
    initial_token1_amount: token1_amount, // Assume same as current for now
    initial_usd_value: backendPosition.initial_investment || 0,
    current_usd_value: backendPosition.current_usd_value || backendPosition.initial_investment || 0, // Use real current value if available
    fees_earned_token0: 0, // Not stored in backend
    fees_earned_token1: 0, // Not stored in backend
    fees_earned_usd: backendPosition.fees_collected || 0,
    impermanent_loss: 0, // Not calculated in backend
    impermanent_loss_percentage: 0, // Not calculated in backend
    total_return: 0, // Not calculated in backend
    total_return_percentage: 0, // Not calculated in backend
    is_in_range: false, // Will be calculated by frontend with real-time price data
    created_at: formatTimestamp(backendPosition.created_at),
    updated_at: formatTimestamp(backendPosition.updated_at),
    status: (backendPosition.status as 'active' | 'closed' | 'out_of_range') || 'active',
  };
}

/**
 * DexScreener Price Service for HYPE token
 */
export const dexScreenerService = {
  /**
   * Fetch HYPE price data from DexScreener API
   */
  async getHypePrice(): Promise<CLApiResponse<{
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    timestamp: string;
  }>> {
    try {
      // DexScreener API endpoint for HYPE/USDC pair
      // Try multiple endpoint formats for HyperEVM chain
      const poolContract = '0x13ba5fea7078ab3798fbce53b4d0721c';
      const endpoints = [
        `https://api.dexscreener.com/latest/dex/pairs/hyperevm/${poolContract}`,
        `https://api.dexscreener.com/latest/dex/pairs/hyperchain/${poolContract}`,
        `https://api.dexscreener.com/latest/dex/search/?q=${poolContract}`
      ];
      
      let lastError: Error | null = null;
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          
          if (!response.ok) {
            lastError = new Error(`DexScreener API error: ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          
          if (!data.pairs || data.pairs.length === 0) {
            lastError = new Error('No HYPE/USDC pair data found on DexScreener');
            continue;
          }
          
          const pair = data.pairs[0];
          
          return {
            success: true,
            data: {
              price: parseFloat(pair.priceUsd) || 0,
              priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
              volume24h: parseFloat(pair.volume?.h24) || 0,
              liquidity: parseFloat(pair.liquidity?.usd) || 0,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          continue;
        }
      }
      
      throw lastError || new Error('All DexScreener endpoints failed');
    } catch (error) {
      console.error('Error fetching HYPE price from DexScreener:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch HYPE price'
      };
    }
  },

  /**
   * Get price for any token pair on DexScreener
   */
  async getTokenPrice(
    tokenAddress: string,
    chainId: string = 'hyperchain'
  ): Promise<CLApiResponse<{
    price: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
    timestamp: string;
  }>> {
    try {
      // Check if this is HYPE token and use specific pool
      if (tokenAddress.toLowerCase() === '0x0d01dc56dcaaca66ad901c959b4011ec') {
        return this.getHypePrice();
      }
      
      // For other tokens, use general DexScreener search
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${tokenAddress}`);
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        throw new Error(`No trading pairs found for token ${tokenAddress}`);
      }
      
      // Find the most liquid pair
      const bestPair = data.pairs.reduce((best: any, current: any) => {
        const currentLiquidity = parseFloat(current.liquidity?.usd) || 0;
        const bestLiquidity = parseFloat(best.liquidity?.usd) || 0;
        return currentLiquidity > bestLiquidity ? current : best;
      });
      
      return {
        success: true,
        data: {
          price: parseFloat(bestPair.priceUsd) || 0,
          priceChange24h: parseFloat(bestPair.priceChange?.h24) || 0,
          volume24h: parseFloat(bestPair.volume?.h24) || 0,
          liquidity: parseFloat(bestPair.liquidity?.usd) || 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error fetching price for token ${tokenAddress}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch token price'
      };
    }
  },

  /**
   * Get position value using DexScreener prices
   */
  async getPositionValue(position: CLPosition): Promise<CLApiResponse<{
    current_usd_value: number;
    token0_price: number;
    token1_price: number;
    price_data: any;
  }>> {
    try {
      // Get prices for both tokens
      const [token0PriceResponse, token1PriceResponse] = await Promise.all([
        this.getTokenPrice(position.token0_address),
        this.getTokenPrice(position.token1_address)
      ]);
      
      let token0Price = 0;
      let token1Price = 0;
      
      if (token0PriceResponse.success && token0PriceResponse.data) {
        token0Price = token0PriceResponse.data.price;
      }
      
      if (token1PriceResponse.success && token1PriceResponse.data) {
        token1Price = token1PriceResponse.data.price;
      }
      
      // Calculate total USD value
      const token0Value = position.token0_amount * token0Price;
      const token1Value = position.token1_amount * token1Price;
      const totalValue = token0Value + token1Value;
      
      return {
        success: true,
        data: {
          current_usd_value: totalValue,
          token0_price: token0Price,
          token1_price: token1Price,
          price_data: {
            token0: token0PriceResponse.data,
            token1: token1PriceResponse.data
          }
        }
      };
    } catch (error) {
      console.error('Error calculating position value:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate position value'
      };
    }
  }
};

/**
 * Utility functions for data transformation
 */
export const dataUtils = {
  /**
   * Format position data for display
   */
  formatPosition(position: CLPosition): CLPosition & {
    displayName: string;
    priceRangeDisplay: string;
    statusColor: string;
  } {
    return {
      ...position,
      displayName: `${position.token0_symbol}/${position.token1_symbol}`,
      priceRangeDisplay: `${position.price_lower.toFixed(4)} - ${position.price_upper.toFixed(4)}`,
      statusColor: position.is_in_range ? 'green' : 'red',
    };
  },

  /**
   * Calculate position health score
   */
  calculateHealthScore(position: CLPosition): number {
    let score = 50; // Base score
    
    // Adjust for range status
    if (position.is_in_range) score += 20;
    else score -= 20;
    
    // Adjust for returns
    if (position.total_return_percentage > 0) score += Math.min(position.total_return_percentage, 30);
    else score += Math.max(position.total_return_percentage, -30);
    
    // Adjust for IL
    score -= Math.abs(position.impermanent_loss_percentage) * 0.5;
    
    return Math.max(0, Math.min(100, score));
  },

  /**
   * Format currency values with enhanced precision for small values
   */
  formatCurrency(value: number, decimals: number = 2): string {
    // For very small values (like 0.0003), use higher precision automatically
    // Increased by 3 decimal places for better precision
    if (value > 0 && value < 0.01 && decimals <= 7) {
      decimals = Math.max(decimals, 10); // Ensure at least 10 decimals for small values (was 7)
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  },

  /**
   * Format percentage values
   */
  formatPercentage(value: number | null | undefined, decimals: number = 2): string {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  },

  /**
   * Calculate time in range percentage
   */
  calculateTimeInRange(priceHistory: CLPriceHistory[]): number {
    if (priceHistory.length === 0) return 0;
    
    const inRangeCount = priceHistory.filter(h => h.is_in_range).length;
    return (inRangeCount / priceHistory.length) * 100;
  },
};

// Export all services as a single object for convenience
export const liquidityTrackingService = {
  positions: positionService,
  priceHistory: priceHistoryService,
  feeHistory: feeHistoryService,
  analytics: analyticsService,
  alerts: alertService,
  realTime: realTimeService,
  data: dataService,
  dexScreener: dexScreenerService,
  utils: dataUtils,
};

export default liquidityTrackingService;