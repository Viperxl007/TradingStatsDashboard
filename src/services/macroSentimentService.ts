/**
 * Macro Market Sentiment Service
 *
 * This service handles API calls to the macro sentiment backend endpoints.
 */

import { 
  MacroSentimentData, 
  MacroSentimentHistory, 
  MacroSystemHealth,
  MacroChartSummary,
  BootstrapResult,
  ScanResult,
  AnalysisResult
} from '../types/macroSentiment';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api/macro-sentiment';

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
 * Get current macro sentiment status
 * @returns Promise with current sentiment data and system status
 */
export const getMacroSentimentStatus = async (): Promise<{
  sentiment: MacroSentimentData | null;
  systemStatus: any;
  nextUpdate: string | null;
}> => {
  try {
    console.log('Fetching macro sentiment status...');
    
    const response = await fetchWithRetry(`${API_BASE_URL}/status`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get macro sentiment status');
    }

    console.log('✅ Successfully fetched macro sentiment status');
    return result.data;
  } catch (error) {
    console.error('Error fetching macro sentiment status:', error);
    throw error;
  }
};

/**
 * Get macro sentiment history
 * @param days Number of days of history (default: 7, max: 30)
 * @returns Promise with historical sentiment data
 */
export const getMacroSentimentHistory = async (days: number = 7): Promise<MacroSentimentHistory> => {
  try {
    console.log(`Fetching macro sentiment history for ${days} days...`);
    
    const response = await fetchWithRetry(`${API_BASE_URL}/history?days=${days}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get macro sentiment history');
    }

    console.log(`✅ Successfully fetched ${result.data.data_points} historical data points`);
    return result.data;
  } catch (error) {
    console.error('Error fetching macro sentiment history:', error);
    throw error;
  }
};

/**
 * Get system health information
 * @returns Promise with system health data
 */
export const getSystemHealth = async (): Promise<MacroSystemHealth> => {
  try {
    console.log('Fetching system health...');
    
    const response = await fetchWithRetry(`${API_BASE_URL}/system-health`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get system health');
    }

    console.log('✅ Successfully fetched system health');
    return result.data;
  } catch (error) {
    console.error('Error fetching system health:', error);
    throw error;
  }
};

/**
 * Get chart summary data
 * @param days Number of days (default: 30, max: 90)
 * @returns Promise with chart summary
 */
export const getChartSummary = async (days: number = 30): Promise<MacroChartSummary> => {
  try {
    console.log(`Fetching chart summary for ${days} days...`);
    
    const response = await fetchWithRetry(`${API_BASE_URL}/charts/summary?days=${days}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get chart summary');
    }

    console.log('✅ Successfully fetched chart summary');
    return result.data;
  } catch (error) {
    console.error('Error fetching chart summary:', error);
    throw error;
  }
};

/**
 * Trigger bootstrap process
 * @param force Force bootstrap even if already completed
 * @returns Promise with bootstrap results
 */
export const triggerBootstrap = async (force: boolean = false): Promise<BootstrapResult> => {
  try {
    console.log(`Triggering bootstrap (force: ${force})...`);
    
    const response = await fetchWithRetry(`${API_BASE_URL}/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log(`✅ Bootstrap completed: ${result.success}`);
    return result.data;
  } catch (error) {
    console.error('Error triggering bootstrap:', error);
    throw error;
  }
};

/**
 * Trigger manual scan
 * @returns Promise with scan results
 */
export const triggerManualScan = async (): Promise<ScanResult> => {
  try {
    console.log('Triggering manual scan...');
    
    const response = await fetchWithRetry(`${API_BASE_URL}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to trigger manual scan');
    }

    console.log('✅ Manual scan completed successfully');
    return result.data;
  } catch (error) {
    console.error('Error triggering manual scan:', error);
    throw error;
  }
};

/**
 * Trigger manual analysis
 * @param model Claude model to use (optional)
 * @param days Days of data to analyze (default: 90)
 * @returns Promise with analysis results
 */
export const triggerManualAnalysis = async (model?: string, days: number = 90): Promise<AnalysisResult> => {
  try {
    console.log(`Triggering manual analysis (model: ${model || 'default'}, days: ${days})...`);
    
    const response = await fetchWithRetry(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, days }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to trigger manual analysis');
    }

    console.log('✅ Manual analysis completed successfully');
    return result.data;
  } catch (error) {
    console.error('Error triggering manual analysis:', error);
    throw error;
  }
};

/**
 * Start the scanner service
 * @returns Promise with start result
 */
export const startScanner = async (): Promise<any> => {
  try {
    console.log('Starting scanner...');
    
    const response = await fetchWithRetry(`${API_BASE_URL}/scanner/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log(`✅ Scanner start result: ${result.success}`);
    return result.data;
  } catch (error) {
    console.error('Error starting scanner:', error);
    throw error;
  }
};

/**
 * Stop the scanner service
 * @returns Promise with stop result
 */
export const stopScanner = async (): Promise<any> => {
  try {
    console.log('Stopping scanner...');
    
    const response = await fetchWithRetry(`${API_BASE_URL}/scanner/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log(`✅ Scanner stop result: ${result.success}`);
    return result.data;
  } catch (error) {
    console.error('Error stopping scanner:', error);
    throw error;
  }
};

/**
 * Ping the macro sentiment API
 * @returns Promise with ping result
 */
export const pingMacroSentimentAPI = async (): Promise<boolean> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/ping`);
    
    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error pinging macro sentiment API:', error);
    return false;
  }
};

/**
 * Format time ago string
 * @param timestamp ISO timestamp string
 * @returns Human readable time ago string
 */
export const formatTimeAgo = (timestamp: string): string => {
  try {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch (error) {
    return 'unknown';
  }
};

/**
 * Format next update time
 * @param timestamp ISO timestamp string
 * @returns Human readable time until string
 */
export const formatTimeUntil = (timestamp: string): string => {
  try {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = time.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'now';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffDays}d ${diffHours % 24}h`;
  } catch (error) {
    return 'unknown';
  }
};