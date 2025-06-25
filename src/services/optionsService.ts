/**
 * Options Service
 *
 * This service handles API calls to the options backend service.
 */

import { OptionsAnalysisResult, EarningsCalendarItem } from '../types';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Timeout configuration based on operation type
const TIMEOUT_CONFIG = {
  default: 10000,        // 10 seconds for regular requests
  fullAnalysis: 60000,   // 60 seconds for full analysis (iron condor, calendar spreads)
  scan: 30000,          // 30 seconds for scanning operations
  calendar: 20000       // 20 seconds for calendar analysis
};

/**
 * Sleep function for retry delays
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with retry functionality
 * @param url URL to fetch
 * @param options Fetch options
 * @param retries Number of retries
 * @param timeoutMs Custom timeout in milliseconds (defaults to TIMEOUT_CONFIG.default)
 * @returns Promise with fetch response
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES, timeoutMs = TIMEOUT_CONFIG.default): Promise<Response> {
  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return response;
    }
    
    // If we get a 5xx error and have retries left, retry the request
    if (response.status >= 500 && retries > 0) {
      console.warn(`Request to ${url} failed with status ${response.status}. Retrying... (${retries} retries left)`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1, timeoutMs);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      if (retries > 0) {
        console.warn(`Request to ${url} timed out after ${timeoutMs}ms. Retrying... (${retries} retries left)`);
        await sleep(RETRY_DELAY);
        return fetchWithRetry(url, options, retries - 1, timeoutMs);
      }
      throw new Error(`Request timed out after ${timeoutMs}ms and all retries exhausted`);
    }
    
    // If we have network errors and have retries left, retry the request
    if (retries > 0 && (error instanceof TypeError || (error instanceof Error && error.message.includes('network')))) {
      console.warn(`Network error when fetching ${url}. Retrying... (${retries} retries left)`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1, timeoutMs);
    }
    throw error;
  }
}

/**
 * Analyze options for a given ticker
 * 
 * @param ticker Stock ticker symbol
 * @returns Promise with analysis result
 */
export const analyzeOptions = async (
  ticker: string,
  runFullAnalysis: boolean = false,
  strategyType?: 'calendar' | 'naked' | 'ironCondor'
): Promise<OptionsAnalysisResult> => {
  try {
    // Build URL with query parameters
    let url = `${API_BASE_URL}/analyze/${ticker}?full_analysis=${runFullAnalysis}`;
    if (strategyType) {
      url += `&strategy=${strategyType}`;
    }
    
    // Add debug logging
    console.log(`Fetching from: ${url} with runFullAnalysis=${runFullAnalysis}`);
    
    // Make the request with appropriate timeout based on analysis type
    try {
      const timeoutMs = runFullAnalysis ? TIMEOUT_CONFIG.fullAnalysis : TIMEOUT_CONFIG.default;
      console.log(`Using ${timeoutMs}ms timeout for ${runFullAnalysis ? 'full' : 'basic'} analysis of ${ticker}`);
      
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }, MAX_RETRIES, timeoutMs);
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to analyze options: ${response.status} ${response.statusText}`);
        } catch (jsonError) {
          throw new Error(`Failed to analyze options: ${response.status} ${response.statusText}`);
        }
      }
      
      return await response.json();
    } catch (fetchError: any) {
      // Just pass through the fetch error without the timeout check
      throw fetchError;
    }
  } catch (error) {
    console.error('Error analyzing options:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Scan stocks with earnings today for options analysis
 * 
 * @returns Promise with scan results
 */
// This function is no longer used directly - the EventSource is created in the component
// It's kept for backward compatibility
export const scanEarningsToday = async (): Promise<OptionsAnalysisResult[]> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/scan/earnings`, {}, MAX_RETRIES, TIMEOUT_CONFIG.scan);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to scan earnings');
    }
    
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error scanning earnings:', error);
    throw error;
  }
};

/**
 * Scan stocks with earnings on a specific date for options analysis
 * 
 * @param date Date in YYYY-MM-DD format
 * @returns Promise with scan results
 */
// This function is no longer used directly - the EventSource is created in the component
// It's kept for backward compatibility
export const scanEarningsByDate = async (date: string): Promise<OptionsAnalysisResult[]> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/scan/earnings?date=${date}`, {}, MAX_RETRIES, TIMEOUT_CONFIG.scan);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to scan earnings');
    }
    
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error scanning earnings:', error);
    throw error;
  }
};

/**
 * Get today's earnings calendar
 * 
 * @returns Promise with earnings calendar
 */
export const getEarningsCalendarToday = async (): Promise<EarningsCalendarItem[]> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/calendar/today`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get earnings calendar');
    }
    
    const data = await response.json();
    return data.earnings;
  } catch (error) {
    console.error('Error getting earnings calendar:', error);
    throw error;
  }
};

/**
 * Get earnings calendar for a specific date
 * 
 * @param date Date in YYYY-MM-DD format
 * @returns Promise with earnings calendar
 */
export const getEarningsCalendarByDate = async (date: string): Promise<EarningsCalendarItem[]> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/calendar/${date}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get earnings calendar');
    }
    
    const data = await response.json();
    return data.earnings;
  } catch (error) {
    console.error('Error getting earnings calendar:', error);
    throw error;
  }
};

/**
 * Get detailed stock information
 *
 * @param ticker Stock ticker symbol
 * @returns Promise with stock information
 */
export const getStockInfo = async (ticker: string): Promise<any> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/stock/${ticker}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get stock information');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting stock information:', error);
    throw error;
  }
};

/**
 * Get historical earnings dates and post-earnings performance for a ticker
 *
 * @param ticker Stock ticker symbol
 * @param years Number of years of history to retrieve (default: 7)
 * @returns Promise with earnings history data
 */
export const getEarningsHistory = async (ticker: string, years: number = 7): Promise<any> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/earnings-history/${ticker}?years=${years}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get earnings history');
    }
    
    const data = await response.json();
    return data.data || {};
  } catch (error) {
    console.error('Error getting earnings history:', error);
    throw error;
  }
};

// Cache for unified calendar analysis results to prevent redundant API calls
const unifiedCalendarCache = new Map<string, {
  data: any;
  timestamp: number;
  spreadCost: number;
  liquidityScore: number;
}>();
const UNIFIED_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Add cache statistics for monitoring
let unifiedCacheHits = 0;
let unifiedCacheMisses = 0;

/**
 * Get unified calendar analysis (both spread cost and liquidity) from backend
 * This ensures both calculations use the exact same strike selection logic
 *
 * @param ticker Stock ticker symbol
 * @param currentPrice Current stock price
 * @param earningsDate Earnings date
 * @returns Promise with unified analysis data
 */
export const getUnifiedCalendarAnalysis = async (
  ticker: string,
  currentPrice: number,
  earningsDate: string
): Promise<any> => {
  // Create cache key based on ticker, price (rounded), and earnings date
  const cacheKey = `unified_${ticker}_${Math.round(currentPrice * 100) / 100}_${earningsDate}`;
  
  // Check cache first
  const cached = unifiedCalendarCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < UNIFIED_CACHE_DURATION) {
    unifiedCacheHits++;
    console.log(`📋 ${ticker}: Using cached unified analysis (Cache hits: ${unifiedCacheHits})`);
    return cached.data;
  }
  
  unifiedCacheMisses++;
  
  try {
    console.log(`🌐 ${ticker}: Fetching unified calendar analysis from backend... (Cache misses: ${unifiedCacheMisses})`);
    const response = await fetchWithRetry(`${API_BASE_URL}/calendar-analysis/${ticker}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        current_price: currentPrice,
        earnings_date: earningsDate
      })
    }, MAX_RETRIES, TIMEOUT_CONFIG.calendar);
    
    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
          // Log specific data quality issues for debugging
          if (errorData.error.includes('Invalid') || errorData.error.includes('No valid')) {
            console.warn(`🚨 ${ticker}: Data quality issue - ${errorData.error}`);
          }
        }
      } catch (jsonError) {
        // If we can't parse the error response, use the status code
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Cache the result with extracted values for easy access
    unifiedCalendarCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      spreadCost: data.spread_cost || 2.50,
      liquidityScore: data.liquidity_score || 0
    });
    
    console.log(`💾 ${ticker}: Cached unified analysis - Spread: $${data.spread_cost?.toFixed(2)}, Liquidity: ${data.liquidity_score?.toFixed(2)}`);
    
    return data;
    
  } catch (error) {
    console.error(`❌ ${ticker}: Unified calendar analysis failed:`, error);
    throw error;
  }
};

/**
 * Calculate liquidity score for a specific calendar spread
 * Now uses the unified endpoint to ensure consistent strike selection
 *
 * @param ticker Stock ticker symbol
 * @param currentPrice Current stock price
 * @param earningsDate Earnings date
 * @returns Promise with liquidity score (0-10)
 */
export const calculateCalendarLiquidityScore = async (
  ticker: string,
  currentPrice: number,
  earningsDate: string
): Promise<number> => {
  try {
    const unifiedData = await getUnifiedCalendarAnalysis(ticker, currentPrice, earningsDate);
    return unifiedData.liquidity_score || 0;
  } catch (error) {
    console.warn(`Error calculating calendar liquidity score for ${ticker}:`, error);
    return 0; // Return 0 if there's an error
  }
};

/**
 * Get real calendar spread cost from backend
 * Now uses the unified endpoint to ensure consistent strike selection
 *
 * @param ticker Stock ticker symbol
 * @param currentPrice Current stock price
 * @param earningsDate Earnings date
 * @returns Promise with actual spread cost from market data
 */
export const getCalendarSpreadCost = async (
  ticker: string,
  currentPrice: number,
  earningsDate: string
): Promise<number> => {
  try {
    const unifiedData = await getUnifiedCalendarAnalysis(ticker, currentPrice, earningsDate);
    return unifiedData.spread_cost || 2.50;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting calendar spread cost:', error);
    
    // Determine fallback strategy based on error type
    let fallbackCost: number;
    let fallbackReason: string;
    
    if (errorMessage.includes('Invalid') || errorMessage.includes('No valid') || errorMessage.includes('Unreasonably high')) {
      // Data quality issues - use more conservative estimates
      fallbackReason = 'poor data quality';
      if (currentPrice < 10) fallbackCost = 0.05;
      else if (currentPrice < 25) fallbackCost = 0.15;
      else if (currentPrice < 50) fallbackCost = 0.25;
      else if (currentPrice < 100) fallbackCost = 0.50;
      else if (currentPrice < 200) fallbackCost = 0.75;
      else if (currentPrice < 300) fallbackCost = 1.00;
      else fallbackCost = 1.50;
    } else {
      // Network or other errors - use standard estimates
      fallbackReason = 'API error';
      if (currentPrice < 10) fallbackCost = 0.30;
      else if (currentPrice < 25) fallbackCost = 0.75;
      else if (currentPrice < 50) fallbackCost = 1.25;
      else if (currentPrice < 100) fallbackCost = 2.00;
      else if (currentPrice < 200) fallbackCost = 2.50;
      else if (currentPrice < 300) fallbackCost = 3.50;
      else fallbackCost = 4.50;
    }
    
    console.log(`🔄 ${ticker}: Using fallback spread cost: $${fallbackCost.toFixed(2)} (reason: ${fallbackReason})`);
    
    return fallbackCost;
  }
};

/**
 * Clear the spread cost cache (useful for testing or when starting new scans)
 */
export const clearSpreadCostCache = (): void => {
  const cacheSize = unifiedCalendarCache.size;
  unifiedCalendarCache.clear();
  unifiedCacheHits = 0;
  unifiedCacheMisses = 0;
  console.log(`🗑️ Spread cost cache cleared (${cacheSize} entries removed, stats reset)`);
};

/**
 * Get cache statistics for monitoring performance
 */
export const getSpreadCostCacheStats = () => {
  return {
    size: unifiedCalendarCache.size,
    hits: unifiedCacheHits,
    misses: unifiedCacheMisses,
    hitRate: unifiedCacheMisses > 0 ? ((unifiedCacheHits / (unifiedCacheHits + unifiedCacheMisses)) * 100).toFixed(1) + '%' : '0%'
  };
};