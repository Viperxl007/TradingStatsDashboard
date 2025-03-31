/**
 * Options Service
 * 
 * This service handles API calls to the options backend service.
 */

import { OptionsAnalysisResult, EarningsCalendarItem } from '../types';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Analyze options for a given ticker
 * 
 * @param ticker Stock ticker symbol
 * @returns Promise with analysis result
 */
export const analyzeOptions = async (ticker: string): Promise<OptionsAnalysisResult> => {
  try {
    console.log(`Fetching from: ${API_BASE_URL}/analyze/${ticker}`);
    
    const response = await fetch(`${API_BASE_URL}/analyze/${ticker}`, {
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
export const scanEarningsToday = async (): Promise<OptionsAnalysisResult[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/scan/earnings`);
    
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
export const scanEarningsByDate = async (date: string): Promise<OptionsAnalysisResult[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/scan/earnings?date=${date}`);
    
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
    const response = await fetch(`${API_BASE_URL}/calendar/today`);
    
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
    const response = await fetch(`${API_BASE_URL}/calendar/${date}`);
    
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
    const response = await fetch(`${API_BASE_URL}/stock/${ticker}`);
    
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
    const response = await fetch(`${API_BASE_URL}/earnings-history/${ticker}?years=${years}`);
    
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