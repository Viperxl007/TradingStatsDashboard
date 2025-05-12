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
 * @returns Promise with fetch response
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    
    // If we get a 5xx error and have retries left, retry the request
    if (response.status >= 500 && retries > 0) {
      console.warn(`Request to ${url} failed with status ${response.status}. Retrying... (${retries} retries left)`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
    }
    
    return response;
  } catch (error) {
    // If we have network errors and have retries left, retry the request
    if (retries > 0 && (error instanceof TypeError || (error instanceof Error && error.message.includes('network')))) {
      console.warn(`Network error when fetching ${url}. Retrying... (${retries} retries left)`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
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
    
    console.log(`Fetching from: ${url}`);
    
    // Make the request without a timeout
    try {
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
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
    const response = await fetchWithRetry(`${API_BASE_URL}/scan/earnings`);
    
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
    const response = await fetchWithRetry(`${API_BASE_URL}/scan/earnings?date=${date}`);
    
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