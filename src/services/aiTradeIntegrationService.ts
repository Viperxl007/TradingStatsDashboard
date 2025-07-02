/**
 * AI Trade Integration Service
 *
 * Handles the integration between chart analysis results and trade management.
 * Processes AI recommendations for closing existing positions and creating new trades.
 * Enhanced with MAINTAIN status detection and context synchronization.
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';
import { AITradeEntry, CreateAITradeRequest, UpdateAITradeRequest } from '../types/aiTradeTracker';
import { closeActiveTradeInProduction, fetchActiveTradeFromProduction } from './productionActiveTradesService';
import { aiTradeService } from './aiTradeService';
import { deactivateRecommendationsForTicker } from './tradingRecommendationService';

export interface TradeActionResult {
  success: boolean;
  message: string;
  closedTrades?: string[];
  newTrades?: string[];
  errors?: string[];
  shouldDeactivateRecommendations?: boolean;
  shouldPreserveExistingTargets?: boolean; // NEW: Flag for MAINTAIN status
  ticker?: string;
  actionType?: 'close_and_create' | 'close_only' | 'maintain' | 'create_new' | 'no_action'; // NEW: Action classification
}

/**
 * Enhanced context assessment for better AI synchronization
 */
export interface ContextAssessment {
  hasContext: boolean;
  positionStatus: 'maintain' | 'close' | 'none';
  triggerActivated: boolean;
  marketConditionChange: 'major' | 'minor' | 'none';
  recommendationValidity: 'preserve' | 'update' | 'replace';
}

/**
 * Process chart analysis results and handle trade actions
 * Enhanced with MAINTAIN status detection and context synchronization
 */
export const processAnalysisForTradeActions = async (
  analysis: ChartAnalysisResult
): Promise<TradeActionResult> => {
  const result: TradeActionResult = {
    success: true,
    message: '',
    closedTrades: [],
    newTrades: [],
    errors: [],
    shouldDeactivateRecommendations: false,
    shouldPreserveExistingTargets: false,
    ticker: analysis.ticker,
    actionType: 'no_action'
  };

  try {
    console.log(`🔄 [AITradeIntegration] Processing analysis for ${analysis.ticker} - checking for trade actions`);

    // Enhanced context assessment
    const contextAssessment = analyzeContextAssessment(analysis);
    console.log(`🧠 [AITradeIntegration] Context assessment for ${analysis.ticker}:`, contextAssessment);
    console.log(`📝 [AITradeIntegration] Raw context_assessment: "${analysis.context_assessment?.substring(0, 200)}..."`);

    // Check for closure recommendations
    const shouldClosePosition = checkForClosureRecommendation(analysis);
    const hasNewRecommendation = analysis.recommendations && analysis.recommendations.action !== 'hold';
    
    // Check for MAINTAIN status
    const shouldMaintainPosition = checkForMaintainRecommendation(analysis);

    if (shouldMaintainPosition) {
      console.log(`🔄 [AITradeIntegration] AI recommends MAINTAINING position for ${analysis.ticker}`);
      result.actionType = 'maintain';
      result.shouldPreserveExistingTargets = true;
      result.message = `AI recommends maintaining current position for ${analysis.ticker}. Existing targets preserved.`;
      
      // Don't create new trade recommendations when maintaining
      console.log(`✅ [AITradeIntegration] MAINTAIN status detected - preserving existing targets for ${analysis.ticker}`);
      return result;
    }

    if (shouldClosePosition) {
      console.log(`🔒 [AITradeIntegration] AI recommends closing position for ${analysis.ticker}`);
      console.log(`📋 [AITradeIntegration] Context assessment: ${analysis.context_assessment?.substring(0, 200)}...`);
      
      // Close existing position
      const closeResult = await closeExistingPosition(analysis.ticker, analysis.currentPrice);
      if (closeResult.success) {
        result.closedTrades = closeResult.closedTrades;
        result.message += `Closed existing position for ${analysis.ticker}. `;
        result.shouldDeactivateRecommendations = true;
        
        if (hasNewRecommendation) {
          result.actionType = 'close_and_create';
          console.log(`🔄 [AITradeIntegration] Invalidation scenario detected - will close old position and create new one`);
        } else {
          result.actionType = 'close_only';
          console.log(`🔒 [AITradeIntegration] Position closure only - no new recommendation`);
        }
      } else {
        result.errors?.push(`Failed to close position: ${closeResult.message}`);
        console.error(`❌ [AITradeIntegration] Position closure failed for ${analysis.ticker}: ${closeResult.message}`);
      }
    }

    if (hasNewRecommendation && !shouldMaintainPosition) {
      console.log(`📈 [AITradeIntegration] Creating new AI trade recommendation for ${analysis.ticker}`);
      console.log(`📊 [AITradeIntegration] New recommendation: ${analysis.recommendations.action} at $${analysis.recommendations.entryPrice || analysis.currentPrice}`);
      
      // Create new AI trade entry
      const newTradeResult = await createAITradeFromAnalysis(analysis);
      if (newTradeResult.success) {
        result.newTrades = newTradeResult.newTrades;
        result.message += `Created new ${analysis.recommendations.action} recommendation for ${analysis.ticker}.`;
        
        if (result.actionType === 'no_action') {
          result.actionType = 'create_new';
        }
        
        console.log(`✅ [AITradeIntegration] New trade created successfully: ${newTradeResult.newTrades?.join(', ')}`);
      } else {
        result.errors?.push(`Failed to create new trade: ${newTradeResult.message}`);
        console.error(`❌ [AITradeIntegration] New trade creation failed for ${analysis.ticker}: ${newTradeResult.message}`);
      }
    }

    if (!shouldClosePosition && !hasNewRecommendation && !shouldMaintainPosition) {
      result.message = 'No trade actions required from this analysis.';
      result.actionType = 'no_action';
    }

    result.success = (result.errors?.length || 0) === 0;
    
    console.log(`✅ [AITradeIntegration] Processing complete for ${analysis.ticker}:`, result);
    return result;

  } catch (error) {
    console.error(`❌ [AITradeIntegration] Error processing analysis for ${analysis.ticker}:`, error);
    result.success = false;
    result.message = `Error processing trade actions: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors?.push(result.message);
    return result;
  }
};

/**
 * Enhanced context assessment analyzer
 */
const analyzeContextAssessment = (analysis: ChartAnalysisResult): ContextAssessment => {
  const contextText = analysis.context_assessment?.toLowerCase() || '';
  
  return {
    hasContext: !!analysis.context_assessment && analysis.context_assessment.length > 0,
    positionStatus: determinePositionStatus(contextText),
    triggerActivated: checkForTriggerActivation(contextText),
    marketConditionChange: assessMarketConditionChange(contextText),
    recommendationValidity: determineRecommendationValidity(contextText)
  };
};

/**
 * Check if the analysis recommends maintaining an existing position
 * Fixed to properly distinguish between fresh analysis context and position management context
 */
const checkForMaintainRecommendation = (analysis: ChartAnalysisResult): boolean => {
  if (!analysis.context_assessment) {
    return false;
  }

  const contextAssessment = analysis.context_assessment.toLowerCase();
  const reasoning = analysis.recommendations?.reasoning?.toLowerCase() || '';
  
  // 🔍 CRITICAL FIX: Check for explicit indicators that there's an EXISTING position to maintain
  const existingPositionIndicators = [
    'previous position',
    'existing position',
    'current position',
    'open position',
    'active position',
    'position context was provided',
    'previous trade',
    'existing trade'
  ];

  // Only proceed if there's evidence of an existing position
  const hasExistingPosition = existingPositionIndicators.some(indicator =>
    contextAssessment.includes(indicator)
  );

  // 🚫 CRITICAL: If AI explicitly says "no previous position context" or "fresh analysis",
  // this is NOT a maintain scenario
  const isFreshAnalysis = contextAssessment.includes('no previous position context') ||
    contextAssessment.includes('fresh analysis') ||
    contextAssessment.includes('initial analysis') ||
    contextAssessment.includes('no position context');

  if (isFreshAnalysis || !hasExistingPosition) {
    console.log(`🆕 [AITradeIntegration] Fresh analysis detected for ${analysis.ticker} - not a maintain scenario`);
    return false;
  }
  
  // Look for explicit maintain indicators in context assessment and reasoning
  const maintainIndicators = [
    'maintain',
    'hold current position',
    'keep position',
    'stay in position',
    'continue holding',
    'position remains valid',
    'no change needed',
    'keep existing',
    'maintain current'
  ];

  // Check if AI explicitly says to maintain
  const hasMaintainKeyword = maintainIndicators.some(indicator =>
    contextAssessment.includes(indicator) || reasoning.includes(indicator)
  );

  // 🔧 FIXED LOGIC: Only check for maintain if there's an existing position AND explicit maintain keywords
  // OR if there's an existing position with no closure recommendation and no major market shift
  const shouldMaintainExistingPosition = hasExistingPosition && (
    hasMaintainKeyword ||
    (!checkForClosureRecommendation(analysis) &&
     !contextAssessment.includes('major') &&
     !contextAssessment.includes('significant change') &&
     !contextAssessment.includes('breakdown') &&
     !contextAssessment.includes('failed'))
  );

  if (shouldMaintainExistingPosition) {
    console.log(`🔄 [AITradeIntegration] Maintain recommendation detected for existing position on ${analysis.ticker}`);
  }

  return shouldMaintainExistingPosition;
};

/**
 * Check if the analysis recommends closing an existing position
 */
const checkForClosureRecommendation = (analysis: ChartAnalysisResult): boolean => {
  if (!analysis.context_assessment) {
    return false;
  }

  const contextAssessment = analysis.context_assessment.toLowerCase();
  
  // Look for closure indicators in the context assessment
  const closureIndicators = [
    'previous position status: close',
    'position closure:',
    'should be closed',
    'close the position',
    'exit the position',
    'previous bullish position should be closed',
    'previous bearish position should be closed',
    'position should be closed',
    'close position',
    'exit position',
    'invalidated',
    'failed breakout',
    'breakdown',
    'reversal',
    'completely reversing'
  ];

  // Enhanced detection for invalidation scenarios
  const invalidationIndicators = [
    'bullish thesis has been invalidated',
    'bearish thesis has been invalidated',
    'thesis has been invalidated',
    'invalidated by the failed',
    'technical setup has fundamentally changed',
    'market structure has shifted',
    'completely reversing from previous',
    'position continuity: completely reversing'
  ];

  const hasClosureIndicator = closureIndicators.some(indicator => contextAssessment.includes(indicator));
  const hasInvalidationIndicator = invalidationIndicators.some(indicator => contextAssessment.includes(indicator));

  if (hasClosureIndicator || hasInvalidationIndicator) {
    console.log(`🔒 [AITradeIntegration] Closure recommendation detected for ${analysis.ticker}:`);
    console.log(`   - Closure indicators: ${hasClosureIndicator}`);
    console.log(`   - Invalidation indicators: ${hasInvalidationIndicator}`);
    console.log(`   - Context: ${contextAssessment.substring(0, 200)}...`);
    return true;
  }

  return false;
};

/**
 * Helper functions for context assessment
 */
const determinePositionStatus = (contextText: string): 'maintain' | 'close' | 'none' => {
  if (contextText.includes('close') || contextText.includes('exit')) return 'close';
  if (contextText.includes('maintain') || contextText.includes('hold')) return 'maintain';
  return 'none';
};

const checkForTriggerActivation = (contextText: string): boolean => {
  const triggerIndicators = [
    'trigger hit',
    'trigger activated',
    'breakout occurred',
    'entry triggered',
    'waiting trade activated',
    'price target reached'
  ];
  return triggerIndicators.some(indicator => contextText.includes(indicator));
};

const assessMarketConditionChange = (contextText: string): 'major' | 'minor' | 'none' => {
  if (contextText.includes('major') || contextText.includes('significant') ||
      contextText.includes('breakdown') || contextText.includes('failed')) return 'major';
  if (contextText.includes('minor') || contextText.includes('slight')) return 'minor';
  return 'none';
};

const determineRecommendationValidity = (contextText: string): 'preserve' | 'update' | 'replace' => {
  if (contextText.includes('maintain') || contextText.includes('valid')) return 'preserve';
  if (contextText.includes('close') || contextText.includes('failed')) return 'replace';
  return 'update';
};

/**
 * Close existing position in both production and AI Trade Tracker
 */
const closeExistingPosition = async (
  ticker: string,
  currentPrice: number
): Promise<{ success: boolean; message: string; closedTrades?: string[] }> => {
  const closedTrades: string[] = [];
  const errors: string[] = [];

  try {
    console.log(`🔒 [AITradeIntegration] Starting position closure for ${ticker} at price $${currentPrice}`);

    // 1. Close production active trade
    const productionCloseResult = await closeActiveTradeInProduction(
      ticker,
      currentPrice,
      'Closed due to AI invalidation - market conditions changed'
    );

    if (productionCloseResult) {
      console.log(`✅ [AITradeIntegration] Closed production trade for ${ticker}`);
      closedTrades.push(`production-${ticker}`);
    } else {
      console.warn(`⚠️ [AITradeIntegration] No production trade found to close for ${ticker}`);
      // Don't treat this as an error - there might not be a production trade
    }

    // 2. Close AI Trade Tracker entries
    await aiTradeService.init();
    const aiTrades = await aiTradeService.getTradesByTicker(ticker);
    const activeTrades = aiTrades.filter(trade => trade.status === 'waiting' || trade.status === 'open');

    console.log(`🔍 [AITradeIntegration] Found ${activeTrades.length} active AI trades for ${ticker}`);

    for (const trade of activeTrades) {
      try {
        // Calculate PnL for historical tracking
        const entryPrice = trade.entryPrice;
        const pnlPercentage = trade.action === 'buy'
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currentPrice) / entryPrice) * 100;

        const updateRequest: UpdateAITradeRequest = {
          id: trade.id,
          status: 'closed',
          exitDate: Date.now(),
          exitPrice: currentPrice,
          closeReason: 'ai_invalidation',
          notes: `Closed due to AI invalidation - market conditions changed. PnL: ${pnlPercentage.toFixed(2)}%`
        };

        await aiTradeService.updateTrade(updateRequest);
        console.log(`✅ [AITradeIntegration] Closed AI trade ${trade.id} for ${ticker} - PnL: ${pnlPercentage.toFixed(2)}%`);
        closedTrades.push(trade.id);
      } catch (error) {
        console.error(`❌ [AITradeIntegration] Failed to close AI trade ${trade.id}:`, error);
        errors.push(`Failed to close AI trade ${trade.id}`);
      }
    }

    const successMessage = closedTrades.length > 0
      ? `Successfully closed ${closedTrades.length} trades for ${ticker}`
      : `No active trades found to close for ${ticker}`;

    console.log(`🏁 [AITradeIntegration] Position closure complete for ${ticker}: ${successMessage}`);

    return {
      success: errors.length === 0,
      message: errors.length > 0 ? errors.join('; ') : successMessage,
      closedTrades
    };

  } catch (error) {
    console.error(`❌ [AITradeIntegration] Error closing position for ${ticker}:`, error);
    return {
      success: false,
      message: `Error closing position: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Create new AI trade entry from analysis results
 */
const createAITradeFromAnalysis = async (
  analysis: ChartAnalysisResult
): Promise<{ success: boolean; message: string; newTrades?: string[] }> => {
  try {
    if (!analysis.recommendations || analysis.recommendations.action === 'hold') {
      return {
        success: false,
        message: 'No actionable trade recommendation found'
      };
    }

    // Calculate risk/reward ratio
    const riskReward = calculateRiskReward(
      analysis.recommendations.entryPrice || analysis.currentPrice,
      analysis.recommendations.targetPrice,
      analysis.recommendations.stopLoss
    );

    // Extract key levels from analysis
    const keyLevels = {
      support: analysis.keyLevels?.filter(level => level.type === 'support').map(level => level.price) || [],
      resistance: analysis.keyLevels?.filter(level => level.type === 'resistance').map(level => level.price) || []
    };

    // Extract technical indicators
    const technicalIndicators: Record<string, number> = {};
    analysis.technicalIndicators?.forEach(indicator => {
      technicalIndicators[indicator.name.toLowerCase()] = indicator.value;
    });

    // Determine market conditions from context assessment
    const marketConditions = extractMarketConditions(analysis.context_assessment);

    const createRequest: CreateAITradeRequest = {
      analysisId: analysis.analysis_id?.toString() || analysis.id,
      ticker: analysis.ticker,
      timeframe: analysis.timeframe,
      aiModel: 'claude-sonnet-3.5', // Default model, could be extracted from analysis
      confidence: analysis.confidence,
      sentiment: analysis.sentiment,
      action: analysis.recommendations.action as 'buy' | 'sell',
      entryPrice: analysis.recommendations.entryPrice || analysis.currentPrice,
      targetPrice: analysis.recommendations.targetPrice,
      stopLoss: analysis.recommendations.stopLoss,
      riskReward,
      reasoning: analysis.recommendations.reasoning,
      chartImageBase64: analysis.chartImageBase64,
      markedUpChartImageBase64: analysis.markedUpChartImageBase64,
      keyLevels,
      technicalIndicators,
      marketConditions,
      volumeProfile: 'normal', // Could be extracted from analysis
      priceAtRecommendation: analysis.currentPrice
    };

    const newTrade = await aiTradeService.createTrade(createRequest);
    
    console.log(`✅ [AITradeIntegration] Created new AI trade ${newTrade.id} for ${analysis.ticker}`);
    
    return {
      success: true,
      message: `Created new ${analysis.recommendations.action} trade for ${analysis.ticker}`,
      newTrades: [newTrade.id]
    };

  } catch (error) {
    console.error(`❌ [AITradeIntegration] Error creating AI trade from analysis:`, error);
    return {
      success: false,
      message: `Error creating trade: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Calculate risk/reward ratio
 */
const calculateRiskReward = (
  entryPrice: number,
  targetPrice?: number,
  stopLoss?: number
): number | undefined => {
  if (!targetPrice || !stopLoss) {
    return undefined;
  }

  const reward = Math.abs(targetPrice - entryPrice);
  const risk = Math.abs(entryPrice - stopLoss);
  
  return risk > 0 ? reward / risk : undefined;
};

/**
 * Extract market conditions from context assessment
 */
const extractMarketConditions = (contextAssessment?: string): string => {
  if (!contextAssessment) {
    return 'Market conditions not specified';
  }

  // Extract key phrases that describe market conditions
  const conditions: string[] = [];
  
  if (contextAssessment.includes('breakout')) {
    conditions.push('breakout scenario');
  }
  if (contextAssessment.includes('resistance')) {
    conditions.push('resistance levels');
  }
  if (contextAssessment.includes('support')) {
    conditions.push('support levels');
  }
  if (contextAssessment.includes('bullish')) {
    conditions.push('bullish bias');
  }
  if (contextAssessment.includes('bearish')) {
    conditions.push('bearish bias');
  }
  if (contextAssessment.includes('failed')) {
    conditions.push('failed pattern');
  }
  if (contextAssessment.includes('rejection')) {
    conditions.push('price rejection');
  }

  return conditions.length > 0 
    ? conditions.join(', ') 
    : 'Standard market conditions';
};

/**
 * Get summary of active trades for a ticker
 */
export const getActiveTradesSummary = async (ticker: string): Promise<{
  productionTrade: any | null;
  aiTrades: AITradeEntry[];
  hasActiveTrades: boolean;
}> => {
  try {
    // Get production active trade
    const productionTrade = await fetchActiveTradeFromProduction(ticker);
    
    // Get AI trades
    await aiTradeService.init();
    const aiTrades = await aiTradeService.getTradesByTicker(ticker);
    const activeAITrades = aiTrades.filter(trade => trade.status === 'waiting' || trade.status === 'open');
    
    return {
      productionTrade,
      aiTrades: activeAITrades,
      hasActiveTrades: !!productionTrade || activeAITrades.length > 0
    };
  } catch (error) {
    console.error(`❌ [AITradeIntegration] Error getting active trades summary for ${ticker}:`, error);
    return {
      productionTrade: null,
      aiTrades: [],
      hasActiveTrades: false
    };
  }
};