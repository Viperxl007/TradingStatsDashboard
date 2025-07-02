/**
 * Context Synchronization Service
 * 
 * Handles synchronization between frontend and backend for AI trade context.
 * Addresses datetime format issues and improves context retrieval for triggered trades.
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';

export interface ContextSyncRequest {
  ticker: string;
  timeframe: string;
  currentPrice: number;
  analysisType: 'fresh' | 'continuation' | 'trigger_activation';
  previousAnalysisId?: string;
  triggerInfo?: {
    originalEntryPrice: number;
    triggerPrice: number;
    waitingDuration: number; // hours
  };
}

export interface ContextSyncResult {
  success: boolean;
  contextFound: boolean;
  contextAge: number; // hours
  triggerActivated: boolean;
  recommendedAction: 'fresh_analysis' | 'continue_with_context' | 'acknowledge_trigger';
  contextData?: any;
  error?: string;
}

/**
 * Prepare context synchronization request before analysis
 */
export const prepareContextSync = async (
  ticker: string,
  timeframe: string,
  currentPrice: number
): Promise<ContextSyncRequest> => {
  try {
    // Check for active trades that might be transitioning from WAITING to ACTIVE
    const activeTradeUrl = `http://localhost:5000/api/active-trades/${ticker}`;
    console.log(`🔍 [ContextSync] Fetching active trade from: ${activeTradeUrl}`);
    const activeTradeResponse = await fetch(activeTradeUrl);
    
    console.log(`📡 [ContextSync] Response status: ${activeTradeResponse.status}`);
    if (activeTradeResponse.ok) {
      const activeTradeData = await activeTradeResponse.json();
      
      if (activeTradeData && activeTradeData.status === 'waiting') {
        // This is a waiting trade that might have triggered
        return {
          ticker,
          timeframe,
          currentPrice,
          analysisType: 'trigger_activation',
          triggerInfo: {
            originalEntryPrice: activeTradeData.entry_price,
            triggerPrice: activeTradeData.entry_price,
            waitingDuration: calculateWaitingDuration(activeTradeData.created_at)
          }
        };
      } else if (activeTradeData && activeTradeData.status === 'open') {
        // This is an active trade - continuation analysis
        return {
          ticker,
          timeframe,
          currentPrice,
          analysisType: 'continuation',
          previousAnalysisId: activeTradeData.analysis_id
        };
      }
    }

    // No active trade found - fresh analysis
    return {
      ticker,
      timeframe,
      currentPrice,
      analysisType: 'fresh'
    };

  } catch (error) {
    console.warn(`⚠️ [ContextSync] Error preparing context sync for ${ticker}:`, error);
    
    // Fallback to fresh analysis
    return {
      ticker,
      timeframe,
      currentPrice,
      analysisType: 'fresh'
    };
  }
};

/**
 * Enhance analysis request with context synchronization data
 */
export const enhanceAnalysisRequest = (
  baseRequest: any,
  contextSync: ContextSyncRequest
): any => {
  const enhancedRequest = {
    ...baseRequest,
    contextSync: {
      analysisType: contextSync.analysisType,
      previousAnalysisId: contextSync.previousAnalysisId,
      triggerInfo: contextSync.triggerInfo
    }
  };

  // Add specific context hints based on analysis type
  let contextHint = '';
  
  switch (contextSync.analysisType) {
    case 'trigger_activation':
      contextHint = `IMPORTANT: This analysis is for a WAITING trade that may have triggered. ` +
        `Original entry target was $${contextSync.triggerInfo?.originalEntryPrice}. ` +
        `Please acknowledge if the trigger was hit and provide continuation analysis rather than fresh recommendations.`;
      break;
      
    case 'continuation':
      contextHint = `IMPORTANT: This is a continuation analysis for an ACTIVE trade. ` +
        `Please assess current market conditions and recommend MAINTAIN, ADJUST, or CLOSE based on significant market changes only.`;
      break;
      
    case 'fresh':
      contextHint = `This is a fresh analysis with no previous trade context.`;
      break;
  }

  if (baseRequest.additionalContext) {
    enhancedRequest.additionalContext = `${baseRequest.additionalContext}\n\n${contextHint}`;
  } else {
    enhancedRequest.additionalContext = contextHint;
  }

  return enhancedRequest;
};

/**
 * Validate backend context response
 */
export const validateContextResponse = (
  analysis: ChartAnalysisResult,
  expectedContext: ContextSyncRequest
): ContextSyncResult => {
  const result: ContextSyncResult = {
    success: true,
    contextFound: !!analysis.context_assessment,
    contextAge: 0,
    triggerActivated: false,
    recommendedAction: 'fresh_analysis'
  };

  try {
    // Check if context assessment exists
    if (!analysis.context_assessment) {
      if (expectedContext.analysisType !== 'fresh') {
        result.success = false;
        result.error = `Expected context for ${expectedContext.analysisType} analysis but none found`;
        result.recommendedAction = 'fresh_analysis';
      }
      return result;
    }

    const contextText = analysis.context_assessment.toLowerCase();

    // Validate trigger activation scenarios
    if (expectedContext.analysisType === 'trigger_activation') {
      const triggerKeywords = ['trigger', 'activated', 'hit', 'breakout', 'entry'];
      result.triggerActivated = triggerKeywords.some(keyword => contextText.includes(keyword));
      
      if (result.triggerActivated) {
        result.recommendedAction = 'acknowledge_trigger';
      } else {
        result.success = false;
        result.error = 'Expected trigger activation but not detected in context';
      }
    }

    // Validate continuation scenarios
    if (expectedContext.analysisType === 'continuation') {
      const continuationKeywords = ['maintain', 'continue', 'active', 'position'];
      const hasContinuationContext = continuationKeywords.some(keyword => contextText.includes(keyword));
      
      if (hasContinuationContext) {
        result.recommendedAction = 'continue_with_context';
      } else {
        result.success = false;
        result.error = 'Expected continuation context but not found';
      }
    }

    return result;

  } catch (error) {
    result.success = false;
    result.error = `Error validating context: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return result;
  }
};

/**
 * Helper function to calculate waiting duration
 */
const calculateWaitingDuration = (createdAt: string | number): number => {
  try {
    const createdTime = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
    const currentTime = Date.now();
    return Math.round((currentTime - createdTime) / (1000 * 60 * 60)); // hours
  } catch (error) {
    console.warn('Error calculating waiting duration:', error);
    return 0;
  }
};

/**
 * Create enhanced context prompt for backend
 */
export const createEnhancedContextPrompt = (
  ticker: string,
  contextSync: ContextSyncRequest
): string => {
  let prompt = `Enhanced Context for ${ticker} Analysis:\n\n`;

  switch (contextSync.analysisType) {
    case 'trigger_activation':
      prompt += `🎯 TRIGGER ACTIVATION SCENARIO:\n`;
      prompt += `- This is a WAITING trade that may have triggered\n`;
      prompt += `- Original entry target: $${contextSync.triggerInfo?.originalEntryPrice}\n`;
      prompt += `- Waiting duration: ${contextSync.triggerInfo?.waitingDuration} hours\n`;
      prompt += `- Current price: $${contextSync.currentPrice}\n`;
      prompt += `- Please confirm if trigger was hit and provide position management guidance\n\n`;
      break;

    case 'continuation':
      prompt += `🔄 CONTINUATION ANALYSIS:\n`;
      prompt += `- This is an ACTIVE trade requiring status assessment\n`;
      prompt += `- Current price: $${contextSync.currentPrice}\n`;
      prompt += `- Please assess if position should be MAINTAINED, ADJUSTED, or CLOSED\n`;
      prompt += `- Only recommend changes for SIGNIFICANT market structure shifts\n\n`;
      break;

    case 'fresh':
      prompt += `🆕 FRESH ANALYSIS:\n`;
      prompt += `- No previous trade context\n`;
      prompt += `- Current price: $${contextSync.currentPrice}\n`;
      prompt += `- Provide complete market analysis and recommendations\n\n`;
      break;
  }

  return prompt;
};