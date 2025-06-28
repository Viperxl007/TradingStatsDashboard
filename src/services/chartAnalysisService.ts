/**
 * Chart Analysis Service
 *
 * This service handles API calls to the chart analysis backend endpoints.
 */

import html2canvas from 'html2canvas';
import {
  ChartAnalysisRequest,
  ChartAnalysisResult,
  HistoricalAnalysis,
  AnalysisContext,
  AvailableModelsResponse
} from '../types/chartAnalysis';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api/chart-analysis';

/**
 * Update an existing analysis with marked-up chart image
 * @param analysisId Analysis ID to update
 * @param markedUpChartImageBase64 Base64 encoded marked-up chart image
 * @returns Promise with success status
 */
export const updateAnalysisMarkup = async (analysisId: string, markedUpChartImageBase64: string): Promise<boolean> => {
  try {
    console.log(`Updating analysis ${analysisId} with marked-up chart...`);
    
    const response = await fetchWithRetry(`${API_BASE_URL}/update-markup/${analysisId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        markedUpChartImageBase64
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Successfully updated analysis ${analysisId} with marked-up chart`);
    return result.success;
  } catch (error) {
    console.error('Error updating analysis markup:', error);
    throw error;
  }
};

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
 * Analyze a chart image using AI
 * 
 * @param request Chart analysis request payload
 * @returns Promise with analysis result
 */
export const analyzeChart = async (request: ChartAnalysisRequest): Promise<ChartAnalysisResult> => {
  try {
    console.log(`Analyzing chart for ticker: ${request.ticker}`);
    
    // Convert base64 image to blob
    const base64Data = request.chartImage;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: 'image/png' });
    
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    formData.append('image', imageBlob, 'chart.png');
    formData.append('ticker', request.ticker);
    console.log(`🔍 [ChartAnalysisService] Sending timeframe to backend: ${request.timeframe || '1D'}`);
    formData.append('timeframe', request.timeframe || '1D');
    
    // Add current price for forward-looking validation
    if (request.currentPrice) {
      formData.append('currentPrice', request.currentPrice.toString());
      console.log(`💰 Current price: $${request.currentPrice}`);
    }
    
    // Add selected model if provided
    if (request.model) {
      formData.append('model', request.model);
    }
    
    // Prepare context data including synchronization information
    const contextData: any = {
      timeframe: request.timeframe
    };
    
    if (request.additionalContext) {
      contextData.additionalContext = request.additionalContext;
    }
    
    // Include context synchronization data if present
    if ((request as any).contextSync) {
      contextData.contextSync = (request as any).contextSync;
      console.log(`🔄 [ChartAnalysisService] Including context sync data:`, (request as any).contextSync);
    }
    
    formData.append('context', JSON.stringify(contextData));
    
    const response = await fetchWithRetry(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
        // Don't set Content-Type - let browser set it with boundary for multipart/form-data
      },
      body: formData
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to analyze chart: ${response.status} ${response.statusText}`);
      } catch (jsonError) {
        throw new Error(`Failed to analyze chart: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error analyzing chart:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Get analysis history for a ticker
 * 
 * @param ticker Stock ticker symbol
 * @param limit Maximum number of historical analyses to retrieve
 * @returns Promise with historical analyses
 */
export const getAnalysisHistory = async (ticker: string, limit: number = 50): Promise<HistoricalAnalysis[]> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/history/${ticker}?limit=${limit}`);
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get analysis history');
      } catch (jsonError) {
        throw new Error(`Failed to get analysis history: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    const rawAnalyses = data.analyses || []; // Backend returns "analyses" key
    
    // Transform the raw analysis data to HistoricalAnalysis format
    const transformedHistory: HistoricalAnalysis[] = rawAnalyses.map((item: any) => {
      const analysis = item.analysis || {};
      
      // Extract timeframe
      const timeframe = analysis.timeframe || analysis.chart_timeframe || '1D';
      
      // Extract summary from various possible locations
      const summary = analysis.summary ||
                     analysis.trading_insights?.summary ||
                     analysis.chart_overview?.summary ||
                     'Analysis completed';
      
      // Extract sentiment from various possible locations
      let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (analysis.sentiment) {
        sentiment = analysis.sentiment;
      } else if (analysis.trading_insights?.sentiment) {
        sentiment = analysis.trading_insights.sentiment;
      } else if (analysis.recommendations?.action) {
        const action = analysis.recommendations.action;
        sentiment = action === 'buy' ? 'bullish' : action === 'sell' ? 'bearish' : 'neutral';
      }
      
      // Extract confidence score
      const confidence = analysis.confidence || item.confidence_score || 0.5;
      
      // Extract current price
      const currentPrice = analysis.currentPrice || analysis.current_price || analysis.price || 0;
      
      // Extract key levels - try multiple possible data structures
      const supportLevels =
        analysis.detailedAnalysis?.priceLevels?.support_levels ||
        analysis.key_levels?.support ||
        analysis.support_resistance?.key_support_levels ||
        analysis.support_levels ||
        (analysis.keyLevels && Array.isArray(analysis.keyLevels)
          ? analysis.keyLevels.filter((level: any) => level.type === 'support').map((level: any) => level.price || level.level)
          : []) ||
        (analysis.key_levels && Array.isArray(analysis.key_levels)
          ? analysis.key_levels.filter((level: any) => level.type === 'support').map((level: any) => level.price || level.level)
          : []) ||
        [];
        
      const resistanceLevels =
        analysis.detailedAnalysis?.priceLevels?.resistance_levels ||
        analysis.key_levels?.resistance ||
        analysis.support_resistance?.key_resistance_levels ||
        analysis.resistance_levels ||
        (analysis.keyLevels && Array.isArray(analysis.keyLevels)
          ? analysis.keyLevels.filter((level: any) => level.type === 'resistance').map((level: any) => level.price || level.level)
          : []) ||
        (analysis.key_levels && Array.isArray(analysis.key_levels)
          ? analysis.key_levels.filter((level: any) => level.type === 'resistance').map((level: any) => level.price || level.level)
          : []) ||
        [];
        
      const keyLevelsCount = (analysis.keyLevels?.length) || (supportLevels.length + resistanceLevels.length);
      
      // Count patterns
      const patterns = analysis.patterns || analysis.chart_patterns || [];
      const patternsCount = (analysis.patterns?.length) || (Array.isArray(patterns) ? patterns.length : 0);
      
      // Extract trading recommendation
      let tradingRecommendation = undefined;
      if (analysis.recommendations) {
        tradingRecommendation = {
          action: analysis.recommendations.action || 'hold',
          entryPrice: analysis.recommendations.entryPrice || analysis.recommendations.entry_price,
          targetPrice: analysis.recommendations.targetPrice || analysis.recommendations.target_price,
          stopLoss: analysis.recommendations.stopLoss || analysis.recommendations.stop_loss,
          reasoning: analysis.recommendations.reasoning
        };
      }
      
      // Convert timestamp to number if it's a string
      let timestamp = item.timestamp;
      if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp).getTime();
      }
      
      return {
        id: item.id.toString(),
        ticker: ticker.toUpperCase(),
        timestamp,
        timeframe,
        summary,
        sentiment,
        confidence,
        currentPrice,
        keyLevelsCount,
        patternsCount,
        tradingRecommendation,
        keyLevels: {
          support: Array.isArray(supportLevels) ? supportLevels : [],
          resistance: Array.isArray(resistanceLevels) ? resistanceLevels : []
        }
      };
    });
    
    console.log(`📊 [ChartAnalysisService] Transformed ${transformedHistory.length} historical analyses for ${ticker}`);
    return transformedHistory;
  } catch (error) {
    console.error('Error getting analysis history:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Delete a specific chart analysis
 *
 * @param analysisId Analysis ID to delete
 * @returns Promise with success confirmation
 */
export const deleteAnalysis = async (analysisId: string): Promise<{ success: boolean }> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/delete/${analysisId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete analysis');
      } catch (jsonError) {
        throw new Error(`Failed to delete analysis: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error deleting analysis:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Get detailed analysis data for a specific analysis ID
 *
 * @param analysisId Analysis ID to retrieve
 * @returns Promise with complete analysis data
 */
export const getAnalysisDetails = async (analysisId: string): Promise<any> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/details/${analysisId}`);
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get analysis details');
      } catch (jsonError) {
        throw new Error(`Failed to get analysis details: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting analysis details:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Delete multiple chart analyses
 *
 * @param analysisIds Array of analysis IDs to delete
 * @returns Promise with deletion results
 */
export const deleteAnalysesBulk = async (analysisIds: string[]): Promise<{ success: boolean; deleted_count: number; requested_count: number }> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/delete-bulk`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        analysis_ids: analysisIds.map(id => parseInt(id))
      })
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete analyses');
      } catch (jsonError) {
        throw new Error(`Failed to delete analyses: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error bulk deleting analyses:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Store analysis context for better AI understanding
 * 
 * @param context Analysis context data
 * @returns Promise with success confirmation
 */
export const storeAnalysisContext = async (context: AnalysisContext): Promise<{ success: boolean }> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/context/${context.ticker}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(context)
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to store analysis context');
      } catch (jsonError) {
        throw new Error(`Failed to store analysis context: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error storing analysis context:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Get key levels for a ticker from previous analyses
 * 
 * @param ticker Stock ticker symbol
 * @returns Promise with key levels data
 */
export const getKeyLevels = async (ticker: string): Promise<any> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/levels/${ticker}`);
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get key levels');
      } catch (jsonError) {
        throw new Error(`Failed to get key levels: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting key levels:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Get available Claude models for chart analysis
 *
 * @returns Promise with available models
 */
export const getAvailableModels = async (): Promise<AvailableModelsResponse> => {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/models`);
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get available models');
      } catch (jsonError) {
        throw new Error(`Failed to get available models: ${response.status} ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting available models:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to the backend server. Please make sure the backend server is running on http://localhost:5000');
    }
    throw error;
  }
};

/**
 * Capture a screenshot using TradingView Lightweight Chart's native method
 * This is more reliable than html2canvas for canvas-based charts
 *
 * @param chartInstance TradingView chart instance
 * @returns Promise with base64 encoded image data
 */
export const captureChartScreenshotNative = async (chartInstance: any): Promise<string> => {
  try {
    console.log('Starting native chart screenshot capture...');
    
    if (!chartInstance || typeof chartInstance.takeScreenshot !== 'function') {
      throw new Error('Chart instance does not support native screenshot capture');
    }
    
    // Use the chart's native screenshot method
    const canvas = chartInstance.takeScreenshot();
    
    if (!canvas) {
      throw new Error('Failed to capture screenshot from chart');
    }
    
    console.log('Native screenshot captured successfully:', canvas.width, 'x', canvas.height);
    
    // Convert canvas to base64
    const base64Image = canvas.toDataURL('image/png', 0.8);
    
    // Remove the data URL prefix to get just the base64 data
    const base64Data = base64Image.split(',')[1];
    
    // Validate that we have actual image data
    if (!base64Data || base64Data.length < 100) {
      throw new Error('Generated image data is too small or invalid');
    }
    
    console.log('Native screenshot processed successfully, size:', base64Data.length, 'characters');
    return base64Data;
  } catch (error) {
    console.error('Error capturing native chart screenshot:', error);
    throw error;
  }
};

/**
 * Capture chart screenshot from TradingView
 * This is a utility function that can be used by components
 * to capture chart screenshots for analysis
 *
 * @param chartElement HTML element containing the chart
 * @returns Promise with base64 encoded image data
 */
export const captureChartScreenshot = async (chartElement: HTMLElement): Promise<string> => {
  try {
    console.log('Starting chart screenshot capture...');
    
    // First, try to capture the entire chart container
    let canvas;
    try {
      canvas = await html2canvas(chartElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1a202c', // Dark background for charts
        scale: 1,
        logging: false,
        width: chartElement.offsetWidth,
        height: chartElement.offsetHeight,
        foreignObjectRendering: true, // Enable for canvas elements
      });
    } catch (captureError) {
      console.warn('Chart capture failed, trying fallback approach:', captureError);
      
      // Fallback: Try to capture with basic settings
      canvas = await html2canvas(chartElement, {
        useCORS: false,
        allowTaint: false,
        backgroundColor: '#1a202c',
        scale: 1,
        logging: false,
        width: chartElement.offsetWidth,
        height: chartElement.offsetHeight,
      });
    }
    
    console.log('Canvas created successfully:', canvas.width, 'x', canvas.height);
    
    // Check if canvas is valid (not empty)
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Generated canvas is empty');
    }
    
    // Convert canvas to base64
    const base64Image = canvas.toDataURL('image/png', 0.8);
    
    // Remove the data URL prefix to get just the base64 data
    const base64Data = base64Image.split(',')[1];
    
    // Validate that we have actual image data
    if (!base64Data || base64Data.length < 100) {
      throw new Error('Generated image data is too small or invalid');
    }
    
    // Additional validation: Check if the image is mostly blank/empty
    // This can happen when capturing TradingView widgets due to cross-origin restrictions
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let nonTransparentPixels = 0;
      let colorVariation = 0;
      
      // Sample every 10th pixel to check for content
      for (let i = 0; i < data.length; i += 40) { // RGBA = 4 bytes, so every 10th pixel
        const alpha = data[i + 3];
        if (alpha > 0) {
          nonTransparentPixels++;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          colorVariation += Math.abs(r - 128) + Math.abs(g - 128) + Math.abs(b - 128);
        }
      }
      
      const totalSampledPixels = data.length / 40;
      const contentRatio = nonTransparentPixels / totalSampledPixels;
      const avgColorVariation = colorVariation / Math.max(nonTransparentPixels, 1);
      
      // If less than 10% of pixels have content or very low color variation, likely a blank capture
      if (contentRatio < 0.1 || avgColorVariation < 10) {
        throw new Error('Captured image appears to be blank or mostly empty. This often happens with TradingView widgets due to security restrictions. Please use the "Upload Chart Image" button to manually upload a screenshot.');
      }
    }
    
    console.log('Screenshot captured successfully, size:', base64Data.length, 'characters');
    return base64Data;
  } catch (error) {
    console.error('Error capturing chart screenshot:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('cross-origin') || error.message.includes('tainted')) {
        throw new Error('Cannot capture TradingView chart due to security restrictions. Please use the "Upload Chart Image" button to manually upload a screenshot.');
      } else if (error.message.includes('canvas') || error.message.includes('empty')) {
        throw new Error('Chart capture failed - the chart may not be fully loaded. Please wait for the chart to load completely and try again, or use manual upload.');
      }
    }
    
    throw new Error('Failed to capture chart screenshot. Please use the "Upload Chart Image" button to manually upload a screenshot of your chart.');
  }
};

/**
 * Convert chart screenshot to analysis request
 *
 * @param ticker Stock ticker symbol
 * @param chartImage Base64 encoded chart image
 * @param timeframe Chart timeframe
 * @param additionalContext Additional context for analysis
 * @param selectedModel Selected Claude model for analysis
 * @param currentPrice Current price for forward-looking validation
 * @returns Chart analysis request object
 */
export const createAnalysisRequest = (
  ticker: string,
  chartImage: string,
  timeframe: string,
  additionalContext?: string,
  selectedModel?: string,
  currentPrice?: number
): ChartAnalysisRequest => {
  return {
    ticker: ticker.toUpperCase(),
    chartImage,
    timeframe,
    additionalContext,
    model: selectedModel,
    currentPrice
  };
};