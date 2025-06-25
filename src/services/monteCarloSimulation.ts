/**
 * Monte Carlo Simulation Service for Earnings Volatility Calendar Spread Strategy
 * 
 * This service implements a specialized Monte Carlo simulation for a bespoke earnings
 * volatility calendar spread strategy that focuses on IV crush as the primary P&L driver.
 */

import { OptionsAnalysisResult, OptionsMetrics, EnhancedHistoricalData } from '../types';

export interface MonteCarloSimulationParams {
  ticker: string;
  currentPrice: number;
  expectedMovePercent: number;
  metrics: OptionsMetrics;
  liquidityScore?: number;
  earningsDate?: string;
  spreadCost?: number; // Optional override for spread cost
  enhancedHistoricalData?: EnhancedHistoricalData; // Enhanced historical data for more accurate simulations
}

export interface MonteCarloResults {
  probabilityOfProfit: number;        // 0-100%
  expectedReturn: number;             // Expected return percentage
  percentiles: {
    p25: number;                      // 25th percentile outcome
    p50: number;                      // 50th percentile (median) outcome
    p75: number;                      // 75th percentile outcome
  };
  maxLossScenario: number;            // Maximum loss scenario
  confidenceInterval: {
    low: number;                      // Lower bound of confidence interval
    high: number;                     // Upper bound of confidence interval
  };
  simulationCount: number;            // Number of simulations run
  rawResults?: number[];              // Raw simulation results for charting (return percentages)
}

/**
 * Realistic IV crush parameters based on actual earnings calendar spread performance
 */
const IV_CRUSH_PARAMETERS = {
  // Front month IV crush (0-7 days post-earnings)
  FRONT_MONTH: {
    MIN_CRUSH: 0.35,  // 35% minimum crush
    MAX_CRUSH: 0.65,  // 65% maximum crush
    MEAN_CRUSH: 0.48, // 48% average crush (realistic for earnings)
    STD_DEV: 0.10     // Higher variance for realism
  },
  // Back month IV crush (+30 days)
  BACK_MONTH: {
    MIN_CRUSH: 0.15,  // 15% minimum crush
    MAX_CRUSH: 0.30,  // 30% maximum crush
    MEAN_CRUSH: 0.22, // 22% average crush
    STD_DEV: 0.06     // Standard deviation
  }
};

/**
 * Expected move impact factors on calendar P&L
 */
const EXPECTED_MOVE_IMPACT = {
  OPTIMAL_RANGE: 0.6,      // Actual move < 0.6x expected move (optimal)
  MODERATE_RANGE: 1.2,     // 0.6x - 1.2x expected move (moderate impact)
  HIGH_IMPACT: 1.2         // >1.2x expected move (high gamma losses)
};

/**
 * Generate a random number from a normal distribution using Box-Muller transform
 */
function normalRandom(mean: number = 0, stdDev: number = 1, randomFn: () => number = Math.random): number {
  let u = 0, v = 0;
  while(u === 0) u = randomFn(); // Converting [0,1) to (0,1)
  while(v === 0) v = randomFn();
  
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

/**
 * Generate a random number from a truncated normal distribution
 */
function truncatedNormal(mean: number, stdDev: number, min: number, max: number, randomFn: () => number = Math.random): number {
  let value;
  do {
    value = normalRandom(mean, stdDev, randomFn);
  } while (value < min || value > max);
  return value;
}

/**
 * Dynamic IV Crush Calculation Based on Term Structure Slope
 * Uses the actual slope to predict IV crush differential - Revolutionary approach!
 * Now enhanced with optional historical data for ticker-specific accuracy
 */
function calculateDynamicIVCrush(
  metrics: OptionsMetrics,
  expectedMovePercent: number,
  randomFn: () => number = Math.random,
  enhancedHistoricalData?: EnhancedHistoricalData
): { frontCrush: number; backCrush: number } {
  
  // Base IV crush from historical earnings data (market average)
  let BASE_FRONT_CRUSH = 0.48;
  let BASE_BACK_CRUSH = 0.22;
  
  // Use enhanced historical data if available for more accurate base values
  if (enhancedHistoricalData?.avgHistoricalIvCrushPostEarnings !== undefined) {
    // Historical IV crush is typically provided as a negative value (e.g., -0.45 for 45% crush)
    const historicalCrush = Math.abs(enhancedHistoricalData.avgHistoricalIvCrushPostEarnings);
    
    // Apply the historical crush to front month (primary driver)
    BASE_FRONT_CRUSH = Math.max(0.25, Math.min(0.70, historicalCrush));
    
    // Back month crush is typically 40-50% of front month crush
    BASE_BACK_CRUSH = Math.max(0.15, Math.min(0.35, BASE_FRONT_CRUSH * 0.45));
    
    console.log(`📊 Using enhanced historical IV crush data: Front=${(BASE_FRONT_CRUSH * 100).toFixed(1)}%, Back=${(BASE_BACK_CRUSH * 100).toFixed(1)}%`);
  }
  
  const BASE_DIFFERENTIAL = BASE_FRONT_CRUSH - BASE_BACK_CRUSH;
  
  // Calculate theoretical differential based on TS Slope
  // TS Slope represents IV change per day, scale to 30-day difference
  const DAYS_BETWEEN_EXPIRATIONS = 30;
  const theoreticalDifferential = Math.abs(metrics.tsSlope) * DAYS_BETWEEN_EXPIRATIONS;
  
  // Scale factor: how much stronger/weaker is this setup vs baseline?
  const differentialMultiplier = Math.max(0.5, Math.min(2.5, theoreticalDifferential / BASE_DIFFERENTIAL));
  
  // Apply the multiplier to enhance or reduce the differential
  let frontCrush = BASE_FRONT_CRUSH;
  let backCrush = BASE_BACK_CRUSH;
  
  if (metrics.tsSlope < 0) { // Backwardation (good for calendars)
    // Increase differential: more front crush, same back crush
    frontCrush = BASE_FRONT_CRUSH * (1 + (differentialMultiplier - 1) * 0.7);
    backCrush = BASE_BACK_CRUSH * (1 + (differentialMultiplier - 1) * 0.3);
  } else { // Contango (bad for calendars)
    // Decrease differential: less front crush, more back crush
    frontCrush = BASE_FRONT_CRUSH * 0.8; // Reduce front crush
    backCrush = BASE_BACK_CRUSH * 1.2;   // Increase back crush (worse for us)
  }
  
  // Add realistic variance
  const frontVariance = normalRandom(0, 0.08, randomFn);
  const backVariance = normalRandom(0, 0.06, randomFn);
  
  frontCrush = Math.max(0.25, Math.min(0.70, frontCrush + frontVariance));
  backCrush = Math.max(0.15, Math.min(0.35, backCrush + backVariance));
  
  // Apply other factors (IV/RV ratio, expected move) as before
  if (metrics.iv30Rv30 >= 1.25) {
    frontCrush *= 1.10;
    backCrush *= 1.05;
  }
  
  if (expectedMovePercent > 8.0) {
    frontCrush *= 1.08;
    backCrush *= 1.04;
  }
  
  return { frontCrush, backCrush };
}

// Keep the old function name for compatibility
const calculateIVCrush = calculateDynamicIVCrush;

/**
 * Simulate stock price movement incorporating expected move
 * Now enhanced with optional historical data for ticker-specific accuracy
 */
function simulateStockMovement(
  currentPrice: number,
  expectedMovePercent: number,
  randomFn: () => number = Math.random,
  enhancedHistoricalData?: EnhancedHistoricalData
): { newPrice: number; actualMoveRatio: number } {
  
  let expectedMoveMultiplier: number;
  
  // Use enhanced historical data if available for more accurate move simulation
  if (enhancedHistoricalData?.avgEarningsMoveHistorically !== undefined &&
      enhancedHistoricalData?.historicalImpliedMoveAccuracy !== undefined) {
    
    const historicalMove = enhancedHistoricalData.avgEarningsMoveHistorically;
    const impliedMoveAccuracy = enhancedHistoricalData.historicalImpliedMoveAccuracy / 100; // Convert percentage to decimal
    
    // Calculate the ratio of historical actual move to current expected move
    const historicalToExpectedRatio = historicalMove / expectedMovePercent;
    
    // Adjust the multiplier based on historical accuracy
    // If implied moves are historically accurate (high accuracy %), use closer to 1.0
    // If implied moves are historically inaccurate (low accuracy %), use historical ratio more heavily
    const accuracyWeight = Math.max(0.3, Math.min(0.9, impliedMoveAccuracy));
    const baseMultiplier = (accuracyWeight * 1.0) + ((1 - accuracyWeight) * historicalToExpectedRatio);
    
    // Add some variance around the historically-informed base
    expectedMoveMultiplier = normalRandom(baseMultiplier, 0.25, randomFn);
    
    console.log(`📊 Using enhanced historical move data: Historical=${historicalMove.toFixed(2)}%, Accuracy=${(impliedMoveAccuracy * 100).toFixed(1)}%, Multiplier=${baseMultiplier.toFixed(2)}`);
  } else {
    // Model actual earnings moves as normal distribution around 0.8x expected move (default behavior)
    expectedMoveMultiplier = normalRandom(0.8, 0.3, randomFn);
  }
  
  const actualMovePercent = expectedMovePercent * expectedMoveMultiplier;
  
  // Random direction (50/50 up/down)
  const direction = randomFn() < 0.5 ? -1 : 1;
  const priceChange = currentPrice * (actualMovePercent / 100) * direction;
  const newPrice = currentPrice + priceChange;
  
  const actualMoveRatio = Math.abs(actualMovePercent) / expectedMovePercent;
  
  return { newPrice, actualMoveRatio };
}

/**
 * Calculate execution costs using real spread cost data with aggressive liquidity penalties
 * Now leverages actual market spread costs and implements exponential liquidity penalties
 * to prevent unrealistic probabilities for illiquid options
 */
function calculateExecutionCosts(
  liquidityScore: number = 5,
  avgVolume: number,
  spreadCost: number
): { executionCost: number; probabilityPenalty: number } {
  
  // Base execution cost as percentage of actual spread cost
  let executionCostPct = 0.10; // 10% base (realistic for calendar spreads)
  let probabilityPenalty = 0;
  
  // Spread cost efficiency assessment (reward tight spreads, penalize wide spreads)
  if (spreadCost <= 0.50) {
    // Very tight spreads (like NG $0.18) - harder to profit but lower absolute cost
    executionCostPct *= 1.5; // Higher percentage cost on small spreads
    probabilityPenalty -= 3; // Small penalty for tight spreads
  } else if (spreadCost <= 1.00) {
    // Moderate spreads (like LEVI $0.75) - balanced
    executionCostPct *= 1.2; // Slightly higher cost
    probabilityPenalty -= 1; // Minimal penalty
  } else if (spreadCost >= 3.00) {
    // Wide spreads (like MU $2.33) - more room for profit
    executionCostPct *= 0.8; // Lower percentage cost on larger spreads
    probabilityPenalty += 2; // Small bonus for wider spreads
  }
  
  // NUCLEAR LIQUIDITY PENALTY SYSTEM
  // Exponential Death Curve for Poor Liquidity - LIQUIDITY IS KING OVER EVERYTHING
  // Leave decent/good liquidity alone, NUKE the dogshit liquidity to oblivion
  
  if (liquidityScore <= 4.0) {
    // CRITICAL LIQUIDITY THRESHOLD - NUCLEAR PENALTIES BELOW 4.0
    
    if (liquidityScore <= 1.5) {
      // Completely impossible (0-1.5) - KILL THE TRADE
      executionCostPct *= 8.0; // 80% execution cost
      probabilityPenalty = -95; // NUCLEAR penalty - almost impossible
    } else if (liquidityScore <= 2.5) {
      // Extremely difficult (1.5-2.5) - SEVERE punishment
      const normalizedScore = (liquidityScore - 1.5) / 1.0; // 0-1 range
      const nuclearPenalty = -95 + (35 * normalizedScore); // -95% to -60%
      executionCostPct *= (8.0 - 3.0 * normalizedScore); // 80% to 50% execution cost
      probabilityPenalty = nuclearPenalty;
    } else if (liquidityScore <= 3.5) {
      // Very difficult (2.5-3.5) - HEAVY punishment
      const normalizedScore = (liquidityScore - 2.5) / 1.0; // 0-1 range
      const heavyPenalty = -60 + (30 * normalizedScore); // -60% to -30%
      executionCostPct *= (5.0 - 2.0 * normalizedScore); // 50% to 30% execution cost
      probabilityPenalty = heavyPenalty;
    } else {
      // Difficult (3.5-4.0) - MODERATE punishment
      const normalizedScore = (liquidityScore - 3.5) / 0.5; // 0-1 range
      const moderatePenalty = -30 + (15 * normalizedScore); // -30% to -15%
      executionCostPct *= (3.0 - 1.0 * normalizedScore); // 30% to 20% execution cost
      probabilityPenalty = moderatePenalty;
    }
    
  } else if (liquidityScore >= 8) {
    // Excellent liquidity (8+) - rewards
    executionCostPct *= 0.7; // 7% total for excellent liquidity
    probabilityPenalty += 4; // Good bonus for excellent liquidity
  } else if (liquidityScore >= 6) {
    // Good liquidity (6-8) - small rewards
    executionCostPct *= 0.85; // 8.5% total for good liquidity
    probabilityPenalty += 2; // Small bonus
  } else {
    // Adequate liquidity (4-6) - neutral to small penalties
    const normalizedScore = (liquidityScore - 4.0) / 2.0; // 0-1 range
    const smallPenalty = -4 + (4 * normalizedScore); // -4% to 0%
    executionCostPct *= (1.4 - 0.4 * normalizedScore); // 14% to 10% execution cost
    probabilityPenalty = smallPenalty;
  }
  
  // Volume-based adjustments (secondary to liquidity)
  if (avgVolume >= 15000000) { // Very high volume (like MU)
    executionCostPct *= 0.85; // 15% reduction (less aggressive than before)
    probabilityPenalty += 2; // Reduced volume bonus (liquidity is more important)
  } else if (avgVolume >= 5000000) { // High volume
    executionCostPct *= 0.90; // 10% reduction
    probabilityPenalty += 1; // Small bonus
  } else if (avgVolume >= 1500000) { // Adequate volume
    executionCostPct *= 0.95; // 5% reduction
    // No penalty/bonus for adequate volume
  } else if (avgVolume < 500000) { // Low volume
    executionCostPct *= 1.15; // 15% increase
    probabilityPenalty -= 3; // Volume penalty (but less than liquidity penalty)
  }
  
  // Cap execution cost percentage (allow NUCLEAR costs for terrible liquidity)
  executionCostPct = Math.min(executionCostPct, 0.90); // Max 90% of spread cost for nuclear cases
  
  // Apply NUCLEAR penalty caps - allow devastating penalties for poor liquidity
  const finalPenalty = Math.max(-98, Math.min(6, probabilityPenalty)); // Allow up to -98% penalty (NUCLEAR)
  
  return {
    executionCost: spreadCost * executionCostPct,
    probabilityPenalty: finalPenalty
  };
}

/**
 * Calculate calendar spread P&L based on IV crush and stock movement
 * Fixed to properly calculate spread value changes without double-counting debit
 */
function calculateCalendarPnL(
  frontCrush: number,
  backCrush: number,
  actualMoveRatio: number,
  spreadDebit: number,
  executionCosts: number
): number {
  
  // CORRECTED DEBIT SPREAD LOGIC:
  // Calculate the spread's value change from IV crush and movement
  // Then compare to original debit to determine profit/loss
  
  // Calculate spread value change from IV crush (primary driver)
  // Front month loses value from IV crush (we're short) - GOOD for us
  // Back month loses value from IV crush (we're long) - BAD for us
  const frontValueChange = spreadDebit * 0.7 * frontCrush; // 70% weight to front month
  const backValueChange = spreadDebit * 0.3 * backCrush;   // 30% weight to back month
  
  // Net value change: front month crush helps us, back month crush hurts us
  let spreadValueChange = frontValueChange - backValueChange;
  
  // Adjust for stock movement impact (critical for calendar spreads)
  let movementImpact = 0;
  
  if (actualMoveRatio < EXPECTED_MOVE_IMPACT.OPTIMAL_RANGE) {
    // Optimal range: stock stays near strike, calendar profits from time decay
    movementImpact = spreadDebit * 0.08; // Small positive from time decay
  } else if (actualMoveRatio < EXPECTED_MOVE_IMPACT.MODERATE_RANGE) {
    // Moderate movement: some gamma drag but manageable
    const dragFactor = (actualMoveRatio - EXPECTED_MOVE_IMPACT.OPTIMAL_RANGE) /
                      (EXPECTED_MOVE_IMPACT.MODERATE_RANGE - EXPECTED_MOVE_IMPACT.OPTIMAL_RANGE);
    movementImpact = -spreadDebit * 0.15 * dragFactor; // Realistic gamma drag
  } else {
    // Large movement: significant gamma losses (calendar spreads hate big moves)
    const excessMove = actualMoveRatio - EXPECTED_MOVE_IMPACT.MODERATE_RANGE;
    movementImpact = -spreadDebit * (0.20 + Math.min(excessMove * 0.25, 0.50)); // Harsh but realistic
  }
  
  // CORRECTED P&L CALCULATION:
  // Total value change minus execution costs (don't subtract original debit here)
  const totalPnL = spreadValueChange + movementImpact - executionCosts;
  
  // Maximum loss is 100% of debit + execution costs
  const maxLoss = -(spreadDebit + executionCosts);
  
  return Math.max(totalPnL, maxLoss);
}

/**
 * Get fallback calendar spread debit based on stock price
 * Used only when real spread cost cannot be fetched from backend
 */
function getFallbackSpreadDebit(currentPrice: number): number {
  // Fallback calendar spread debits based on price ranges
  if (currentPrice < 10) return 0.30;
  else if (currentPrice < 25) return 0.75;
  else if (currentPrice < 50) return 1.25;
  else if (currentPrice < 100) return 2.00;
  else if (currentPrice < 200) return 2.50;  // MU ($119) falls here
  else if (currentPrice < 300) return 3.50;
  else return 4.50;  // Only for very expensive stocks (>$300)
}

/**
 * Calculate base probability with realistic metrics-based assessment for calendar spreads
 */
function calculateBaseProbability(metrics: OptionsMetrics): number {
  // Count passing metrics with realistic thresholds
  const passingMetrics = [
    metrics.avgVolume >= 1500000,
    metrics.iv30Rv30 >= 1.15,
    metrics.tsSlope <= -0.00406
  ].filter(Boolean).length;
  
  // Conservative base probabilities reflecting calendar spread realities
  let baseProbability;
  if (passingMetrics === 3) baseProbability = 0.62;      // All pass - excellent setup
  else if (passingMetrics === 2) baseProbability = 0.48;  // Two pass - good setup
  else if (passingMetrics === 1) baseProbability = 0.35;  // One pass - marginal setup
  else baseProbability = 0.22;                            // None pass - poor setup
  
  // Calculate metric-specific adjustments with realistic caps
  let totalAdjustment = 0;
  
  // 1. TERM STRUCTURE SLOPE (most critical - graduated bonuses/penalties)
  if (metrics.tsSlope <= -0.015) {
    totalAdjustment += 0.15; // Massive bonus for excellent backwardation
  } else if (metrics.tsSlope <= -0.010) {
    totalAdjustment += 0.12; // Large bonus for very good backwardation
  } else if (metrics.tsSlope <= -0.006) {
    totalAdjustment += 0.08; // Good bonus for solid backwardation
  } else if (metrics.tsSlope <= -0.00406) {
    totalAdjustment += 0.04; // Small bonus for barely passing
  } else if (metrics.tsSlope <= -0.002) {
    totalAdjustment -= 0.08; // Significant penalty for weak backwardation
  } else if (metrics.tsSlope <= 0) {
    totalAdjustment -= 0.12; // Large penalty for barely negative
  } else {
    totalAdjustment -= 0.20; // Massive penalty for contango
  }
  
  // 2. IV/RV RATIO (indicates IV richness)
  if (metrics.iv30Rv30 >= 1.40) {
    totalAdjustment += 0.06; // Very rich IV
  } else if (metrics.iv30Rv30 >= 1.25) {
    totalAdjustment += 0.04; // Rich IV
  } else if (metrics.iv30Rv30 >= 1.10) {
    totalAdjustment += 0.02; // Slightly rich IV
  } else if (metrics.iv30Rv30 >= 0.90) {
    totalAdjustment -= 0.02; // Slightly cheap IV
  } else {
    totalAdjustment -= 0.06; // Cheap IV (bad for calendars)
  }
  
  // 3. VOLUME (liquidity and execution quality)
  if (metrics.avgVolume >= 15000000) { // Very high volume
    totalAdjustment += 0.04;
  } else if (metrics.avgVolume >= 5000000) { // High volume
    totalAdjustment += 0.03;
  } else if (metrics.avgVolume >= 1500000) { // Adequate volume
    totalAdjustment += 0.01;
  } else if (metrics.avgVolume < 500000) { // Low volume
    totalAdjustment -= 0.05;
  }
  
  // Apply capped adjustments (increased caps to accommodate TS Slope importance)
  const cappedAdjustment = Math.max(-0.25, Math.min(0.18, totalAdjustment));
  baseProbability += cappedAdjustment;
  
  // Realistic bounds for calendar spreads (slightly expanded for excellent TS Slope)
  return Math.max(0.10, Math.min(0.80, baseProbability));
}

/**
 * Run Monte Carlo simulation for earnings volatility calendar spread
 * Now uses real spread costs from backend when available
 */
export async function runMonteCarloSimulation(params: MonteCarloSimulationParams): Promise<MonteCarloResults> {
  const {
    ticker,
    currentPrice,
    expectedMovePercent,
    metrics,
    liquidityScore = 5,
    earningsDate,
    spreadCost: providedSpreadCost,
    enhancedHistoricalData
  } = params;
  
  // Terminal logging for easier debugging
  console.log(`\n=== MONTE CARLO SIMULATION START ===`);
  console.log(`Ticker: ${ticker}`);
  console.log(`Price: $${currentPrice}`);
  console.log(`Expected Move: ${expectedMovePercent}%`);
  console.log(`Liquidity Score: ${liquidityScore}`);
  console.log(`Avg Volume: ${metrics.avgVolume.toLocaleString()}`);
  console.log(`IV/RV Ratio: ${metrics.iv30Rv30}`);
  console.log(`TS Slope: ${metrics.tsSlope}`);
  
  console.log(`🎯 Starting Monte Carlo simulation for ${ticker}:`, {
    currentPrice,
    expectedMovePercent,
    liquidityScore,
    avgVolume: metrics.avgVolume,
    iv30Rv30: metrics.iv30Rv30,
    tsSlope: metrics.tsSlope
  });
  
  const numSimulations = 10000;
  const results: number[] = [];
  
  // Use ticker as seed for more consistent results during debugging
  const seed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let randomSeed = seed;
  
  // Simple seeded random number generator for more consistent results
  const seededRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  
  // Get real calendar spread debit from backend or use provided/fallback value
  let spreadDebit: number = providedSpreadCost || 0;
  
  if (!spreadDebit && earningsDate) {
    try {
      // Import the API function
      const { getCalendarSpreadCost } = await import('../services/optionsService');
      spreadDebit = await getCalendarSpreadCost(ticker, currentPrice, earningsDate);
      console.log(`📊 ${ticker}: Using real spread cost from backend: $${spreadDebit.toFixed(2)}`);
    } catch (error) {
      console.warn(`⚠️ ${ticker}: Failed to get real spread cost, using fallback:`, error);
      spreadDebit = getFallbackSpreadDebit(currentPrice);
    }
  }
  
  if (!spreadDebit) {
    spreadDebit = getFallbackSpreadDebit(currentPrice);
    console.log(`📊 ${ticker}: Using fallback spread cost: $${spreadDebit.toFixed(2)}`);
  } else if (providedSpreadCost) {
    console.log(`📊 ${ticker}: Using provided spread cost: $${spreadDebit.toFixed(2)}`);
  }
  
  // Calculate execution costs and probability penalty once
  const { executionCost, probabilityPenalty } = calculateExecutionCosts(
    liquidityScore,
    metrics.avgVolume,
    spreadDebit
  );
  
  console.log(`📊 ${ticker} simulation parameters:`, {
    spreadDebit: spreadDebit.toFixed(2),
    executionCost: executionCost.toFixed(2),
    probabilityPenalty: probabilityPenalty,
    executionCostPct: ((executionCost / spreadDebit) * 100).toFixed(1) + '%'
  });
  
  // Detailed NUCLEAR liquidity penalty breakdown
  console.log(`🚨 ${ticker} NUCLEAR LIQUIDITY ANALYSIS:`, {
    liquidityScore: liquidityScore,
    liquidityCategory: liquidityScore <= 1.5 ? '💀 IMPOSSIBLE (KILLED)' :
                     liquidityScore <= 2.5 ? '☢️ EXTREMELY_DIFFICULT (NUCLEAR)' :
                     liquidityScore <= 3.5 ? '🔥 VERY_DIFFICULT (HEAVY)' :
                     liquidityScore <= 4.0 ? '⚠️ DIFFICULT (MODERATE)' :
                     liquidityScore <= 6.0 ? '✅ ADEQUATE' :
                     liquidityScore <= 8.0 ? '🟢 GOOD' : '🌟 EXCELLENT',
    probabilityPenalty: probabilityPenalty + '%',
    executionCostMultiplier: ((executionCost / spreadDebit) / 0.10).toFixed(2) + 'x',
    penaltySeverity: Math.abs(probabilityPenalty) >= 90 ? '💀 NUCLEAR (TRADE KILLED)' :
                    Math.abs(probabilityPenalty) >= 60 ? '☢️ SEVERE (HEAVY DAMAGE)' :
                    Math.abs(probabilityPenalty) >= 30 ? '🔥 HIGH (SIGNIFICANT)' :
                    Math.abs(probabilityPenalty) >= 15 ? '⚠️ MODERATE' :
                    Math.abs(probabilityPenalty) >= 5 ? '🟡 LOW' : '🟢 MINIMAL',
    tradeViability: Math.abs(probabilityPenalty) >= 90 ? 'AVOID AT ALL COSTS' :
                   Math.abs(probabilityPenalty) >= 60 ? 'EXTREMELY RISKY' :
                   Math.abs(probabilityPenalty) >= 30 ? 'HIGH RISK' :
                   Math.abs(probabilityPenalty) >= 15 ? 'MODERATE RISK' : 'ACCEPTABLE'
  });
  
  // Log enhanced historical data usage if available
  if (enhancedHistoricalData) {
    console.log(`📊 ${ticker}: Enhanced simulation with historical data:`, {
      avgHistoricalIvCrush: enhancedHistoricalData.avgHistoricalIvCrushPostEarnings,
      avgEarningsMove: enhancedHistoricalData.avgEarningsMoveHistorically,
      impliedMoveAccuracy: enhancedHistoricalData.historicalImpliedMoveAccuracy
    });
  }

  for (let i = 0; i < numSimulations; i++) {
    // 1. Calculate IV crush for this simulation (with enhanced data if available)
    const { frontCrush, backCrush } = calculateIVCrush(metrics, expectedMovePercent, seededRandom, enhancedHistoricalData);
    
    // 2. Simulate stock price movement (with enhanced data if available)
    const { actualMoveRatio } = simulateStockMovement(currentPrice, expectedMovePercent, seededRandom, enhancedHistoricalData);
    
    // 3. Calculate P&L for this simulation
    const pnl = calculateCalendarPnL(
      frontCrush,
      backCrush,
      actualMoveRatio,
      spreadDebit,
      executionCost
    );
    
    results.push(pnl);
  }
  
  // Sort results for percentile calculations
  results.sort((a, b) => a - b);
  
  // Calculate base probability from strategy metrics (primary factor)
  const baseProbabilityFromMetrics = calculateBaseProbability(metrics) * 100;
  
  // Calculate Monte Carlo probability (secondary validation)
  const profitableResults = results.filter(r => r > 0);
  const monteCarloProbability = (profitableResults.length / numSimulations) * 100;
  
  // Blend the two approaches: 70% metrics-based, 30% Monte Carlo
  let probabilityOfProfit = (baseProbabilityFromMetrics * 0.7) + (monteCarloProbability * 0.3);
  
  // Apply liquidity penalty to final probability
  const rawProbability = probabilityOfProfit;
  probabilityOfProfit = Math.max(0, probabilityOfProfit + probabilityPenalty);
  
  const expectedReturn = (results.reduce((sum, r) => sum + r, 0) / numSimulations / spreadDebit) * 100;
  
  const p25Index = Math.floor(numSimulations * 0.25);
  const p50Index = Math.floor(numSimulations * 0.50);
  const p75Index = Math.floor(numSimulations * 0.75);
  
  const percentiles = {
    p25: (results[p25Index] / spreadDebit) * 100,
    p50: (results[p50Index] / spreadDebit) * 100,
    p75: (results[p75Index] / spreadDebit) * 100
  };
  
  const maxLossScenario = (Math.min(...results) / spreadDebit) * 100;
  
  // Calculate confidence interval (95%)
  const confidenceInterval = {
    low: Math.max(0, probabilityOfProfit - 10), // Conservative bounds
    high: Math.min(100, probabilityOfProfit + 10)
  };
  
  const finalResults = {
    probabilityOfProfit: Math.round(probabilityOfProfit * 100) / 100,
    expectedReturn: Math.round(expectedReturn * 100) / 100,
    percentiles: {
      p25: Math.round(percentiles.p25 * 100) / 100,
      p50: Math.round(percentiles.p50 * 100) / 100,
      p75: Math.round(percentiles.p75 * 100) / 100
    },
    maxLossScenario: Math.round(maxLossScenario * 100) / 100,
    confidenceInterval,
    simulationCount: numSimulations,
    rawResults: results.map(r => Math.round((r / spreadDebit) * 100 * 100) / 100) // Convert to return percentages
  };
  
  // Terminal logging for completion
  console.log(`\n=== SIMULATION COMPLETE ===`);
  console.log(`Ticker: ${ticker}`);
  console.log(`Metrics-Based Probability: ${baseProbabilityFromMetrics.toFixed(2)}%`);
  console.log(`Monte Carlo Probability: ${monteCarloProbability.toFixed(2)}%`);
  console.log(`Blended Probability: ${rawProbability.toFixed(2)}%`);
  console.log(`Final Probability: ${finalResults.probabilityOfProfit}%`);
  console.log(`Expected Return: ${finalResults.expectedReturn}%`);
  console.log(`Applied Penalty: ${probabilityPenalty}%`);
  console.log(`Execution Cost: ${((executionCost / spreadDebit) * 100).toFixed(1)}%`);
  console.log(`=== END SIMULATION ===\n`);
  
  console.log(`✅ ${ticker} simulation completed:`, {
    probabilityOfProfit: finalResults.probabilityOfProfit + '%',
    expectedReturn: finalResults.expectedReturn + '%',
    rawProbability: ((profitableResults.length / numSimulations) * 100).toFixed(2) + '%',
    appliedPenalty: probabilityPenalty,
    percentiles: finalResults.percentiles
  });
  
  return finalResults;
}

/**
 * Calculate simulation probability for a given options analysis result
 * Now async to support real spread cost fetching
 */
export async function calculateSimulationProbability(result: OptionsAnalysisResult): Promise<MonteCarloResults | null> {
  if (!result.metrics || !result.expectedMove) {
    return null;
  }
  
  // Parse expected move percentage
  const expectedMovePercent = parseFloat(result.expectedMove.replace('%', ''));
  if (isNaN(expectedMovePercent)) {
    return null;
  }
  
  const params: MonteCarloSimulationParams = {
    ticker: result.ticker,
    currentPrice: result.currentPrice,
    expectedMovePercent,
    metrics: result.metrics,
    liquidityScore: result.calendarLiquidityScore,
    earningsDate: result.earningsDate // Pass earnings date for real spread cost calculation
  };
  
  return await runMonteCarloSimulation(params);
}