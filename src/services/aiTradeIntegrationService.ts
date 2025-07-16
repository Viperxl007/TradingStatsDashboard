/**
 * AI Trade Integration Service
 *
 * Handles the integration between chart analysis results and trade management.
 * Processes AI recommendations for closing existing positions and creating new trades.
 * Enhanced with MAINTAIN status detection and context synchronization.
 *
 * CRITICAL PRODUCTION FIX (v2.1.0):
 * - Fixed AI trade cancellation detection for patterns like "TRADE CANCELLATION: Canceling BUY setup at $106,000"
 * - Added case-insensitive pattern matching for all closure indicators
 * - Fixed order of operations: cancellation check now takes precedence over maintain check
 * - Enhanced cleanup process with validation, retry logic, and rollback mechanisms
 * - Added safety guards to prevent new trade creation until cleanup is complete
 * - Added comprehensive logging for debugging and monitoring
 */

import { ChartAnalysisResult } from '../types/chartAnalysis';
import { AITradeEntry, CreateAITradeRequest, UpdateAITradeRequest } from '../types/aiTradeTracker';
import { closeActiveTradeInProduction, fetchActiveTradeFromProduction } from './productionActiveTradesService';
import { aiTradeService } from './aiTradeService';
import { deactivateRecommendationsForTicker } from './tradingRecommendationService';

// SAFETY: Feature flags for gradual rollout
const FEATURE_FLAGS = {
  ENHANCED_CANCELLATION_DETECTION: true, // Set to false to disable new cancellation logic
  ENHANCED_CLEANUP_VALIDATION: true,     // Set to false to use legacy cleanup
  SAFETY_GUARDS_ENABLED: true,           // Set to false to disable safety checks
  COMPREHENSIVE_LOGGING: true,           // Set to false to reduce logging
  EMERGENCY_FRESH_ANALYSIS_PROTECTION: true // EMERGENCY: Set to false to disable fresh analysis protection
};

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
  conflictDetected?: boolean; // NEW: Flag for conflict detection
  circuitBreakerTriggered?: boolean; // NEW: Flag for circuit breaker activation
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
    actionType: 'no_action',
    conflictDetected: false,
    circuitBreakerTriggered: false
  };

  try {
    console.log(`🔄 [AITradeIntegration] Processing analysis for ${analysis.ticker} - checking for trade actions`);

    // Enhanced context assessment
    const contextAssessment = analyzeContextAssessment(analysis);
    console.log(`🧠 [AITradeIntegration] Context assessment for ${analysis.ticker}:`, contextAssessment);
    console.log(`📝 [AITradeIntegration] Raw context_assessment: "${analysis.context_assessment?.substring(0, 200)}..."`);

    // CRITICAL VALIDATION: Log exactly what context_assessment contains for debugging
    if (FEATURE_FLAGS.COMPREHENSIVE_LOGGING) {
      console.log(`🔍 [EMERGENCY DEBUG] Full context_assessment for ${analysis.ticker}:`, analysis.context_assessment);
      console.log(`🔍 [EMERGENCY DEBUG] Analysis recommendations:`, analysis.recommendations);
      console.log(`🔍 [EMERGENCY DEBUG] Analysis has context_assessment: ${!!analysis.context_assessment}`);
      console.log(`🔍 [EMERGENCY DEBUG] Context length: ${analysis.context_assessment?.length || 0}`);
    }

    // CRITICAL FIX: Check for closure recommendations FIRST (before maintain check)
    // This ensures cancellation takes absolute precedence over maintain status
    // CACHE the closure check result to prevent recursive calls and race conditions
    const closureCheckResult = checkForClosureRecommendation(analysis);
    let shouldClosePosition = closureCheckResult;
    const hasNewRecommendation = analysis.recommendations && analysis.recommendations.action !== 'hold';
    
    // ENHANCED LOGGING: Track decision flow for debugging
    if (FEATURE_FLAGS.COMPREHENSIVE_LOGGING) {
      console.log(`🔍 [DECISION FLOW] ${analysis.ticker} - Closure check result: ${closureCheckResult}`);
      console.log(`🔍 [DECISION FLOW] ${analysis.ticker} - Has new recommendation: ${hasNewRecommendation}`);
      console.log(`🔍 [DECISION FLOW] ${analysis.ticker} - Context preview: "${analysis.context_assessment?.substring(0, 150)}..."`);
    }
    
    // CRITICAL VALIDATION: Add safeguard to prevent closure on fresh analysis
    if (shouldClosePosition) {
      console.log(`🚨 [EMERGENCY VALIDATION] Closure recommendation detected for ${analysis.ticker}`);
      console.log(`🚨 [EMERGENCY VALIDATION] Context assessment exists: ${!!analysis.context_assessment}`);
      console.log(`🚨 [EMERGENCY VALIDATION] Context preview: "${analysis.context_assessment?.substring(0, 300)}"`);
      
      // Double-check that this is not a fresh analysis being incorrectly flagged for closure
      const freshAnalysisCheck = !analysis.context_assessment ||
        analysis.context_assessment.toLowerCase().includes('fresh analysis') ||
        analysis.context_assessment.toLowerCase().includes('no previous position context') ||
        analysis.context_assessment.toLowerCase().includes('no position context');
        
      if (freshAnalysisCheck) {
        console.log(`🛡️ [EMERGENCY OVERRIDE] BLOCKING closure for ${analysis.ticker} - detected fresh analysis being incorrectly flagged for closure`);
        console.log(`🛡️ [EMERGENCY OVERRIDE] This would have caused immediate trade closure on fresh analysis - CRITICAL BUG PREVENTED`);
        // Override the closure recommendation
        shouldClosePosition = false;
      }
    }
    
    // Check for MAINTAIN status (only if no closure recommendation)
    // PASS the cached closure result to prevent recursive calls
    const shouldMaintainPosition = !shouldClosePosition && checkForMaintainRecommendation(analysis, closureCheckResult);
    
    // SMART CIRCUIT BREAKER: Detect conflicts between maintain and closure recommendations
    const conflictDetected = detectRecommendationConflict(analysis, closureCheckResult, shouldMaintainPosition);
    if (conflictDetected) {
      result.conflictDetected = true;
      result.circuitBreakerTriggered = true;
      console.log(`🚨 [CIRCUIT BREAKER] Conflict detected for ${analysis.ticker} - blocking closure to preserve maintain recommendation`);
      console.log(`🚨 [CIRCUIT BREAKER] Closure result: ${closureCheckResult}, Maintain result: ${shouldMaintainPosition}`);
      console.log(`🚨 [CIRCUIT BREAKER] Context: "${analysis.context_assessment?.substring(0, 200)}..."`);
      
      // Override closure decision when maintain context conflicts with closure detection
      if (shouldMaintainPosition && closureCheckResult) {
        shouldClosePosition = false;
        console.log(`🛡️ [CIRCUIT BREAKER] Overriding closure decision - preserving maintain recommendation`);
      }
    }
    
    // ENHANCED LOGGING: Track final decision flow
    if (FEATURE_FLAGS.COMPREHENSIVE_LOGGING) {
      console.log(`🔍 [DECISION FLOW] ${analysis.ticker} - Final decisions:`);
      console.log(`   - Should close: ${shouldClosePosition}`);
      console.log(`   - Should maintain: ${shouldMaintainPosition}`);
      console.log(`   - Conflict detected: ${conflictDetected}`);
      console.log(`   - Circuit breaker triggered: ${result.circuitBreakerTriggered}`);
    }

    // CRITICAL: Cancellation takes absolute precedence
    if (shouldClosePosition) {
      console.log(`🚨 [AITradeIntegration] CRITICAL: AI recommends CLOSING/CANCELING position for ${analysis.ticker}`);
      console.log(`📋 [AITradeIntegration] Closure context: ${analysis.context_assessment?.substring(0, 300)}...`);
      
      // Enhanced cleanup process with validation
      // CRITICAL FIX: Detect if this is a MODIFY scenario to handle DELETE vs CLOSE logic
      const isModifyScenario = checkForModifyScenario(analysis);
      const closeResult = await closeExistingPosition(analysis.ticker, analysis.currentPrice, isModifyScenario);
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
        // SAFETY: Don't proceed with new trades if cleanup failed
        return result;
      }
    } else if (shouldMaintainPosition) {
      console.log(`🔄 [AITradeIntegration] AI recommends MAINTAINING position for ${analysis.ticker}`);
      result.actionType = 'maintain';
      result.shouldPreserveExistingTargets = true;
      result.message = `AI recommends maintaining current position for ${analysis.ticker}. Existing targets preserved.`;
      
      // Don't create new trade recommendations when maintaining
      console.log(`✅ [AITradeIntegration] MAINTAIN status detected - preserving existing targets for ${analysis.ticker}`);
      return result;
    }

    // CRITICAL FIX: Remove duplicate closure logic that was causing immediate trade closures
    // The closure logic above (lines 119-142) already handles position closure when shouldClosePosition is true
    // This duplicate logic was incorrectly closing trades even when shouldClosePosition was false
    console.log(`🛡️ [CRITICAL FIX] Removed duplicate closure logic that was causing immediate trade closures`);

    // SAFETY: Only proceed with new trade creation if no closure was needed OR closure was successful
    if (hasNewRecommendation && !shouldMaintainPosition) {
      console.log(`📈 [AITradeIntegration] Preparing to create new AI trade recommendation for ${analysis.ticker}`);
      
      // CRITICAL VALIDATION: Ensure no active trades remain before creating new ones
      console.log(`🔍 [AITradeIntegration] SAFETY CHECK: Validating no active trades remain before creating new trade...`);
      const preCreateValidation = await getActiveTradesSummary(analysis.ticker);
      
      if (preCreateValidation.hasActiveTrades) {
        const validationError = `SAFETY VIOLATION: Cannot create new trade for ${analysis.ticker} - ${preCreateValidation.aiTrades.length} AI trades and ${preCreateValidation.productionTrade ? '1' : '0'} production trades still active`;
        console.error(`🚨 [AITradeIntegration] ${validationError}`);
        result.errors?.push(validationError);
        return result;
      }
      
      console.log(`✅ [AITradeIntegration] SAFETY CHECK PASSED: No active trades found, proceeding with new trade creation`);
      console.log(`📊 [AITradeIntegration] New recommendation: ${analysis.recommendations.action} at $${analysis.recommendations.entryPrice || analysis.currentPrice}`);
      
      // CRITICAL FIX: Add protection flag to prevent immediate deletion of newly created trades
      const tradeCreationTimestamp = Date.now();
      
      // Create new AI trade entry with timeout protection
      const createTradePromise = createAITradeFromAnalysis(analysis);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Trade creation timeout after 30 seconds')), 30000)
      );
      
      try {
        const newTradeResult = await Promise.race([createTradePromise, timeoutPromise]) as any;
        
        if (newTradeResult.success) {
          result.newTrades = newTradeResult.newTrades;
          result.message += `Created new ${analysis.recommendations.action} recommendation for ${analysis.ticker}.`;
          
          if (result.actionType === 'no_action') {
            result.actionType = 'create_new';
          }
          
          console.log(`✅ [AITradeIntegration] New trade created successfully: ${newTradeResult.newTrades?.join(', ')}`);
          
          // CRITICAL FIX: Add newly created trade IDs to protection list to prevent immediate deletion
          if (newTradeResult.newTrades && newTradeResult.newTrades.length > 0) {
            for (const tradeId of newTradeResult.newTrades) {
              addTradeToProtectionList(tradeId, tradeCreationTimestamp);
            }
          }
        } else {
          result.errors?.push(`Failed to create new trade: ${newTradeResult.message}`);
          console.error(`❌ [AITradeIntegration] New trade creation failed for ${analysis.ticker}: ${newTradeResult.message}`);
        }
      } catch (error) {
        const timeoutError = `New trade creation failed or timed out: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors?.push(timeoutError);
        console.error(`❌ [AITradeIntegration] ${timeoutError}`);
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
 * Check if this is a MODIFY scenario
 * CRITICAL FIX: Helper function to detect MODIFY scenarios for proper DELETE handling
 */
const checkForModifyScenario = (analysis: ChartAnalysisResult): boolean => {
  if (!analysis.context_assessment) {
    return false;
  }

  const contextAssessment = analysis.context_assessment.toLowerCase();
  
  const modifyIndicators = [
    'previous position status: modify',
    'previous position status: replace',
    'position status: modify',
    'position status: replace',
    'modify position',
    'modify the position',
    'modify current position',
    'position modification',
    'trade modification',
    'invalidate and create new',
    'replace position',
    'update position',
    'replace the position',
    'position replacement',
    'trade replacement'
  ];
  
  const hasModifyRecommendation = modifyIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  
  if (hasModifyRecommendation) {
    console.log(`🔄 [AITradeIntegration] MODIFY SCENARIO DETECTED for ${analysis.ticker}`);
    console.log(`   - Modify indicators found: ${modifyIndicators.filter(indicator => contextAssessment.includes(indicator.toLowerCase())).join(', ')}`);
  }
  
  return hasModifyRecommendation;
};

/**
 * Smart conflict detection for maintain vs closure recommendations
 * Only blocks closures when maintain context genuinely conflicts with closure detection
 */
const detectRecommendationConflict = (
  analysis: ChartAnalysisResult,
  closureResult: boolean,
  maintainResult: boolean
): boolean => {
  // No conflict if only one recommendation is true
  if (!closureResult || !maintainResult) {
    return false;
  }
  
  const contextText = analysis.context_assessment?.toLowerCase() || '';
  
  // Check for explicit maintain indicators that should override closure
  const strongMaintainIndicators = [
    'maintain existing position',
    'maintain current position',
    'position remains valid',
    'continue holding',
    'keep position',
    'almost at profit target',
    'target almost reached',
    'performing well'
  ];
  
  const hasStrongMaintainContext = strongMaintainIndicators.some(indicator =>
    contextText.includes(indicator)
  );
  
  // Check for weak closure indicators that might be false positives
  const weakClosureIndicators = [
    'previous position',
    'existing position',
    'position context'
  ];
  
  const hasOnlyWeakClosureContext = weakClosureIndicators.some(indicator =>
    contextText.includes(indicator)
  ) && !contextText.includes('close') && !contextText.includes('cancel');
  
  // Conflict detected if we have strong maintain context with weak closure indicators
  const conflictDetected = hasStrongMaintainContext && hasOnlyWeakClosureContext;
  
  if (conflictDetected) {
    console.log(`🔍 [CONFLICT DETECTION] Strong maintain context detected with weak closure indicators`);
    console.log(`   - Strong maintain indicators: ${strongMaintainIndicators.filter(i => contextText.includes(i)).join(', ')}`);
    console.log(`   - Weak closure indicators: ${weakClosureIndicators.filter(i => contextText.includes(i)).join(', ')}`);
  }
  
  return conflictDetected;
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
 * CRITICAL FIX: Added cached closure result parameter to prevent recursive calls
 */
export const checkForMaintainRecommendation = (
  analysis: ChartAnalysisResult,
  cachedClosureResult?: boolean
): boolean => {
  if (!analysis.context_assessment) {
    return false;
  }

  const contextAssessment = analysis.context_assessment.toLowerCase();
  const reasoning = analysis.recommendations?.reasoning?.toLowerCase() || '';
  
  // 🔄 CRITICAL FIX: Check for MODIFY scenarios FIRST - these should NOT be processed as MAINTAIN
  const modifyIndicators = [
    'previous position status: modify',
    'previous position status: replace',
    'position status: modify',
    'position status: replace',
    'modify position',
    'modify the position',
    'modify current position',
    'position modification',
    'trade modification',
    'invalidate and create new',
    'replace position',
    'update position',
    'replace the position',
    'position replacement',
    'trade replacement'
  ];
  
  const hasModifyRecommendation = modifyIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  
  if (hasModifyRecommendation) {
    console.log(`🔄 [AITradeIntegration] MODIFY DETECTED in maintain check for ${analysis.ticker} - excluding from maintain logic`);
    console.log(`   - Modify indicators found: ${modifyIndicators.filter(indicator => contextAssessment.includes(indicator.toLowerCase())).join(', ')}`);
    return false; // MODIFY scenarios should NOT be processed as MAINTAIN
  }

  //  CRITICAL FIX: Check for explicit indicators that there's an EXISTING position to maintain
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
  // CRITICAL FIX: Use cached closure result to prevent recursive calls and race conditions
  const closureResult = cachedClosureResult !== undefined ? cachedClosureResult : checkForClosureRecommendation(analysis);
  const shouldMaintainExistingPosition = hasExistingPosition && (
    hasMaintainKeyword ||
    (!closureResult &&
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
 * EMERGENCY HOTFIX: Added critical safeguards to prevent closure on fresh analysis
 * EXPORTED FOR TESTING: This function is exported to allow Jest tests to verify the fix
 */
export const checkForClosureRecommendation = (analysis: ChartAnalysisResult): boolean => {
  // EMERGENCY SAFEGUARD 1: If feature flag is disabled, return false immediately
  if (!FEATURE_FLAGS.EMERGENCY_FRESH_ANALYSIS_PROTECTION) {
    console.log(`🚨 [EMERGENCY] Fresh analysis protection disabled via feature flag for ${analysis.ticker}`);
    return false;
  }

  // EMERGENCY SAFEGUARD 2: If no context_assessment exists, return false immediately
  if (!analysis.context_assessment) {
    console.log(`🛡️ [EMERGENCY] No context_assessment found for ${analysis.ticker} - preventing closure on fresh analysis`);
    return false;
  }

  const contextAssessment = analysis.context_assessment.toLowerCase();
  
  // CRITICAL FIX: Check for MODIFY recommendations FIRST - these should trigger closure/deletion
  const modifyIndicators = [
    'previous position status: modify',
    'previous position status: replace',
    'position status: modify',
    'position status: replace',
    'modify position',
    'modify the position',
    'modify current position',
    'position modification',
    'trade modification',
    'invalidate and create new',
    'replace position',
    'update position',
    'replace the position',
    'position replacement',
    'trade replacement'
  ];
  
  const hasModifyRecommendation = modifyIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  
  if (hasModifyRecommendation) {
    console.log(`🔄 [AITradeIntegration] MODIFY DETECTED: Position modification recommendation found for ${analysis.ticker} - triggering deletion of old trade`);
    console.log(`   - Modify indicators found: ${modifyIndicators.filter(indicator => contextAssessment.includes(indicator.toLowerCase())).join(', ')}`);
    console.log(`   - Context: ${contextAssessment.substring(0, 300)}...`);
    return true; // MODIFY should trigger deletion of old trade
  }
  
  // CRITICAL FIX: Check for explicit MAINTAIN recommendations - these override any closure patterns (but NOT modify)
  const explicitMaintainIndicators = [
    'previous position status: maintain',
    'position status: maintain',
    'maintain position',
    'maintain the position',
    'maintain current position',
    'hold position',
    'hold the position',
    'keep position',
    'keep the position',
    'continue holding',
    'stay in position',
    'remain in position'
  ];
  
  const hasExplicitMaintain = explicitMaintainIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  
  if (hasExplicitMaintain) {
    console.log(`✅ [AITradeIntegration] MAINTAIN OVERRIDE: Explicit maintain recommendation found for ${analysis.ticker} - preventing closure`);
    console.log(`   - Maintain indicators found: ${explicitMaintainIndicators.filter(indicator => contextAssessment.includes(indicator.toLowerCase())).join(', ')}`);
    console.log(`   - Context: ${contextAssessment.substring(0, 300)}...`);
    return false;
  }
  
  // EMERGENCY SAFEGUARD 3: If context contains "fresh analysis" or "no previous position context", return false immediately
  const freshAnalysisIndicators = [
    'fresh analysis',
    'no previous position context',
    'no position context',
    'initial analysis',
    'no context was provided',
    'no previous context',
    'fresh market analysis'
  ];
  
  const isFreshAnalysis = freshAnalysisIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  
  if (isFreshAnalysis) {
    console.log(`🛡️ [EMERGENCY] Fresh analysis detected for ${analysis.ticker} - preventing closure. Indicators found: ${freshAnalysisIndicators.filter(indicator => contextAssessment.includes(indicator.toLowerCase())).join(', ')}`);
    return false;
  }
  
  // EMERGENCY SAFEGUARD 4: Only trigger closure if there's evidence of an EXISTING position to close
  const existingPositionIndicators = [
    'previous position',
    'existing position',
    'current position',
    'open position',
    'active position',
    'position context was provided',
    'previous trade',
    'existing trade',
    'position status:',
    'position assessment:',
    'previous bullish position',
    'previous bearish position',
    'canceling buy setup',
    'canceling sell setup',
    'cancelling buy setup',
    'cancelling sell setup'
  ];
  
  const hasExistingPosition = existingPositionIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  
  if (!hasExistingPosition) {
    console.log(`🛡️ [EMERGENCY] No existing position evidence found for ${analysis.ticker} - preventing closure on fresh analysis`);
    return false;
  }
  
  // CRITICAL FIX: Use SPECIFIC closure patterns instead of broad word matching to prevent false positives
  const specificClosureIndicators = [
    'previous position status: close',
    'position status: close',
    'position closure:',
    'should be closed',
    'close the position',
    'exit the position',
    'previous bullish position should be closed',
    'previous bearish position should be closed',
    'position should be closed',
    'recommend closing existing position',
    'recommend closing the position',
    'recommend closing position',
    'recommend close position',
    'recommend exit position',
    'recommend exiting position',
    'position assessment: close',
    'position assessment: exit'
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
    'position continuity: completely reversing',
    'trade cancellation',
    'canceling buy setup',
    'canceling sell setup',
    'position assessment: replace',
    'cancelling buy setup',
    'cancelling sell setup',
    'cancel trade',
    'cancel position',
    'trade cancel',
    'setup cancellation'
  ];

  // CRITICAL FIX: Use specific pattern matching instead of broad word searches
  const hasSpecificClosureIndicator = specificClosureIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );
  const hasInvalidationIndicator = invalidationIndicators.some(indicator =>
    contextAssessment.includes(indicator.toLowerCase())
  );

  if (hasSpecificClosureIndicator || hasInvalidationIndicator) {
    console.log(`🚨 [AITradeIntegration] CRITICAL: Closure/Cancellation recommendation detected for ${analysis.ticker}:`);
    console.log(`   - Specific closure indicators: ${hasSpecificClosureIndicator}`);
    console.log(`   - Invalidation indicators: ${hasInvalidationIndicator}`);
    console.log(`   - Matched patterns: ${[...specificClosureIndicators, ...invalidationIndicators].filter(indicator => contextAssessment.includes(indicator.toLowerCase())).join(', ')}`);
    console.log(`   - Context: ${contextAssessment.substring(0, 300)}...`);
    return true;
  }

  console.log(`✅ [AITradeIntegration] No closure recommendation detected for ${analysis.ticker} - position should be maintained`);
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
 * Enhanced with comprehensive validation and cleanup verification
 * CRITICAL FIX: Added isModifyScenario parameter to handle DELETE vs CLOSE logic
 */
const closeExistingPosition = async (
  ticker: string,
  currentPrice: number,
  isModifyScenario: boolean = false
): Promise<{ success: boolean; message: string; closedTrades?: string[] }> => {
  const closedTrades: string[] = [];
  const errors: string[] = [];
  let cleanupAttempts = 0;
  const maxCleanupAttempts = 3;

  try {
    console.log(`🚨 [AITradeIntegration] CRITICAL: Starting enhanced position closure for ${ticker} at price $${currentPrice}`);
    console.log(`🔍 [AITradeIntegration] Pre-cleanup validation: Checking existing positions...`);

    // ENHANCED: Pre-cleanup validation
    const preCleanupSummary = await getActiveTradesSummary(ticker);
    console.log(`📊 [AITradeIntegration] Pre-cleanup state:`, {
      productionTrade: !!preCleanupSummary.productionTrade,
      aiTrades: preCleanupSummary.aiTrades.length,
      hasActiveTrades: preCleanupSummary.hasActiveTrades
    });

    if (!preCleanupSummary.hasActiveTrades) {
      console.log(`ℹ️ [AITradeIntegration] No active trades found for ${ticker} - cleanup not needed`);
      return {
        success: true,
        message: `No active trades found to close for ${ticker}`,
        closedTrades: []
      };
    }

    // ENHANCED: Systematic cleanup with retry logic
    while (cleanupAttempts < maxCleanupAttempts) {
      cleanupAttempts++;
      console.log(`🔄 [AITradeIntegration] Cleanup attempt ${cleanupAttempts}/${maxCleanupAttempts} for ${ticker}`);

      // 1. Close production active trade (SKIP in MODIFY scenarios to prevent race condition)
      if (!isModifyScenario) {
        try {
          const productionCloseResult = await closeActiveTradeInProduction(
            ticker,
            currentPrice,
            'CRITICAL: Closed due to AI trade cancellation - position invalidated'
          );

          if (productionCloseResult) {
            console.log(`✅ [AITradeIntegration] Closed production trade for ${ticker}`);
            closedTrades.push(`production-${ticker}`);
          } else {
            console.warn(`⚠️ [AITradeIntegration] No production trade found to close for ${ticker}`);
          }
        } catch (error) {
          console.error(`❌ [AITradeIntegration] Production trade closure failed:`, error);
          errors.push(`Production closure failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        console.log(`⏭️ [AITradeIntegration] Skipping production trade closure for ${ticker} - MODIFY scenario (prevents race condition with newly created trades)`);
      }

      // 2. Close AI Trade Tracker entries with enhanced validation
      try {
        await aiTradeService.init();
        const aiTrades = await aiTradeService.getTradesByTicker(ticker);
        const activeTrades = aiTrades.filter(trade => trade.status === 'waiting' || trade.status === 'open');

        console.log(`🔍 [AITradeIntegration] Found ${activeTrades.length} active AI trades for ${ticker} (attempt ${cleanupAttempts})`);

        for (const trade of activeTrades) {
          try {
            // CRITICAL FIX: DELETE waiting trades in MODIFY scenarios, CLOSE others
            if (isModifyScenario && trade.status === 'waiting') {
              // DELETE waiting trades in MODIFY scenarios - they were never hit and are no longer viable
              await aiTradeService.deleteTrade(trade.id);
              console.log(`🗑️ [AITradeIntegration] DELETED waiting AI trade ${trade.id} for ${ticker} - MODIFY scenario (trade was never hit and no longer viable)`);
              closedTrades.push(`deleted-${trade.id}`);
            } else {
              // CLOSE other trades (open trades or non-MODIFY scenarios)
              const entryPrice = trade.entryPrice;
              const pnlPercentage = trade.action === 'buy'
                ? ((currentPrice - entryPrice) / entryPrice) * 100
                : ((entryPrice - currentPrice) / entryPrice) * 100;

              const updateRequest: UpdateAITradeRequest = {
                id: trade.id,
                status: 'closed',
                exitDate: Date.now(),
                exitPrice: currentPrice,
                closeReason: isModifyScenario ? 'ai_recommendation' : 'ai_invalidation',
                notes: `CRITICAL: ${isModifyScenario ? 'Closed due to AI trade modification' : 'Closed due to AI trade cancellation'}. PnL: ${pnlPercentage.toFixed(2)}%. Cleanup attempt: ${cleanupAttempts}`
              };

              await aiTradeService.updateTrade(updateRequest);
              console.log(`✅ [AITradeIntegration] Closed AI trade ${trade.id} for ${ticker} - PnL: ${pnlPercentage.toFixed(2)}%`);
              closedTrades.push(trade.id);
            }
          } catch (error) {
            console.error(`❌ [AITradeIntegration] Failed to ${isModifyScenario && trade.status === 'waiting' ? 'delete' : 'close'} AI trade ${trade.id}:`, error);
            errors.push(`Failed to ${isModifyScenario && trade.status === 'waiting' ? 'delete' : 'close'} AI trade ${trade.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error(`❌ [AITradeIntegration] AI trades cleanup failed:`, error);
        errors.push(`AI trades cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // ENHANCED: Post-cleanup validation
      console.log(`🔍 [AITradeIntegration] Post-cleanup validation (attempt ${cleanupAttempts})...`);
      const postCleanupSummary = await getActiveTradesSummary(ticker);
      console.log(`📊 [AITradeIntegration] Post-cleanup state:`, {
        productionTrade: !!postCleanupSummary.productionTrade,
        aiTrades: postCleanupSummary.aiTrades.length,
        hasActiveTrades: postCleanupSummary.hasActiveTrades
      });

      if (!postCleanupSummary.hasActiveTrades) {
        console.log(`✅ [AITradeIntegration] CLEANUP SUCCESSFUL: All trades cleared for ${ticker} after ${cleanupAttempts} attempts`);
        break;
      } else {
        console.warn(`⚠️ [AITradeIntegration] Cleanup incomplete after attempt ${cleanupAttempts}. Remaining: ${postCleanupSummary.aiTrades.length} AI trades, Production: ${!!postCleanupSummary.productionTrade}`);
        
        if (cleanupAttempts < maxCleanupAttempts) {
          console.log(`🔄 [AITradeIntegration] Retrying cleanup in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // ENHANCED: Final validation and rollback mechanism
    const finalValidation = await getActiveTradesSummary(ticker);
    if (finalValidation.hasActiveTrades && cleanupAttempts >= maxCleanupAttempts) {
      const rollbackError = `CRITICAL: Cleanup failed after ${maxCleanupAttempts} attempts. ${finalValidation.aiTrades.length} AI trades and ${finalValidation.productionTrade ? '1' : '0'} production trades remain active.`;
      console.error(`🚨 [AITradeIntegration] ${rollbackError}`);
      errors.push(rollbackError);
      
      return {
        success: false,
        message: `Partial cleanup failure: ${rollbackError}`,
        closedTrades
      };
    }

    const successMessage = closedTrades.length > 0
      ? `Successfully closed ${closedTrades.length} trades for ${ticker} after ${cleanupAttempts} attempts`
      : `No active trades found to close for ${ticker}`;

    console.log(`🏁 [AITradeIntegration] Position closure complete for ${ticker}: ${successMessage}`);

    return {
      success: errors.length === 0,
      message: errors.length > 0 ? `Partial success with errors: ${errors.join('; ')}` : successMessage,
      closedTrades
    };

  } catch (error) {
    console.error(`❌ [AITradeIntegration] Critical error during position closure for ${ticker}:`, error);
    return {
      success: false,
      message: `Critical error during position closure: ${error instanceof Error ? error.message : 'Unknown error'}`
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

/**
 * CRITICAL FIX: Trade Protection System
 *
 * This system prevents newly created trades from being immediately deleted
 * by maintaining a protection list of recently created trade IDs.
 */

interface ProtectedTrade {
  tradeId: string;
  createdAt: number;
  protectedUntil: number;
}

// Protection list for newly created trades
const protectedTrades: Map<string, ProtectedTrade> = new Map();

// Protection duration: 30 seconds after creation
const PROTECTION_DURATION_MS = 30 * 1000;

/**
 * Add a trade to the protection list
 */
export const addTradeToProtectionList = (tradeId: string, creationTimestamp: number): void => {
  const protectedTrade: ProtectedTrade = {
    tradeId,
    createdAt: creationTimestamp,
    protectedUntil: creationTimestamp + PROTECTION_DURATION_MS
  };
  
  protectedTrades.set(tradeId, protectedTrade);
  
  console.log(`🛡️ [TRADE PROTECTION] Added trade ${tradeId} to protection list until ${new Date(protectedTrade.protectedUntil).toISOString()}`);
  
  // Auto-remove from protection list after duration
  setTimeout(() => {
    protectedTrades.delete(tradeId);
    console.log(`🛡️ [TRADE PROTECTION] Removed trade ${tradeId} from protection list (expired)`);
  }, PROTECTION_DURATION_MS);
};

/**
 * Check if a trade is currently protected from deletion
 */
export const isTradeProtected = (tradeId: string): boolean => {
  const protectedTrade = protectedTrades.get(tradeId);
  
  if (!protectedTrade) {
    return false;
  }
  
  const now = Date.now();
  const isStillProtected = now < protectedTrade.protectedUntil;
  
  if (!isStillProtected) {
    // Clean up expired protection
    protectedTrades.delete(tradeId);
    console.log(`🛡️ [TRADE PROTECTION] Removed expired protection for trade ${tradeId}`);
  }
  
  return isStillProtected;
};

/**
 * Remove a trade from protection list (for manual cleanup)
 */
export const removeTradeFromProtectionList = (tradeId: string): void => {
  const removed = protectedTrades.delete(tradeId);
  if (removed) {
    console.log(`🛡️ [TRADE PROTECTION] Manually removed trade ${tradeId} from protection list`);
  }
};

/**
 * Get all currently protected trades (for debugging)
 */
export const getProtectedTrades = (): ProtectedTrade[] => {
  return Array.from(protectedTrades.values());
};

/**
 * Clear all protected trades (for testing/debugging)
 */
export const clearProtectionList = (): void => {
  const count = protectedTrades.size;
  protectedTrades.clear();
  console.log(`🛡️ [TRADE PROTECTION] Cleared protection list (${count} trades removed)`);
};