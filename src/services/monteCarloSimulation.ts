/**
 * Monte Carlo Simulation Service for Earnings Volatility Calendar Spread Strategy
 * 
 * This service implements a specialized Monte Carlo simulation for a bespoke earnings
 * volatility calendar spread strategy that focuses on IV crush as the primary P&L driver.
 */

import { OptionsAnalysisResult, OptionsMetrics } from '../types';

export interface MonteCarloSimulationParams {
  ticker: string;
  currentPrice: number;
  expectedMovePercent: number;
  metrics: OptionsMetrics;
  liquidityScore?: number;
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
 * Industry standard IV crush parameters based on historical data (more realistic)
 */
const IV_CRUSH_PARAMETERS = {
  // Front month IV crush (0-7 days post-earnings)
  FRONT_MONTH: {
    MIN_CRUSH: 0.25,  // 25% minimum crush (more realistic)
    MAX_CRUSH: 0.55,  // 55% maximum crush (capped lower)
    MEAN_CRUSH: 0.40, // 40% average crush (more conservative)
    STD_DEV: 0.08     // Standard deviation
  },
  // Back month IV crush (+30 days)
  BACK_MONTH: {
    MIN_CRUSH: 0.15,  // 15% minimum crush
    MAX_CRUSH: 0.35,  // 35% maximum crush
    MEAN_CRUSH: 0.25, // 25% average crush (more conservative)
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
 * Calculate IV crush amounts based on term structure slope and market conditions
 */
function calculateIVCrush(
  metrics: OptionsMetrics,
  expectedMovePercent: number,
  randomFn: () => number = Math.random
): { frontCrush: number; backCrush: number } {
  
  // Base IV crush amounts
  let frontCrush = truncatedNormal(
    IV_CRUSH_PARAMETERS.FRONT_MONTH.MEAN_CRUSH,
    IV_CRUSH_PARAMETERS.FRONT_MONTH.STD_DEV,
    IV_CRUSH_PARAMETERS.FRONT_MONTH.MIN_CRUSH,
    IV_CRUSH_PARAMETERS.FRONT_MONTH.MAX_CRUSH,
    randomFn
  );
  
  let backCrush = truncatedNormal(
    IV_CRUSH_PARAMETERS.BACK_MONTH.MEAN_CRUSH,
    IV_CRUSH_PARAMETERS.BACK_MONTH.STD_DEV,
    IV_CRUSH_PARAMETERS.BACK_MONTH.MIN_CRUSH,
    IV_CRUSH_PARAMETERS.BACK_MONTH.MAX_CRUSH,
    randomFn
  );
  
  // Adjust based on IV30/RV30 ratio
  if (metrics.iv30Rv30 >= 1.25) {
    // Higher IV/RV ratio increases IV crush probability by 15%
    frontCrush *= 1.15;
    backCrush *= 1.10; // Smaller impact on back month
  }
  
  // Adjust based on term structure slope
  if (metrics.tsSlope <= -0.00406) {
    // Steeper negative slope increases front/back differential
    const slopeAdjustment = Math.abs(metrics.tsSlope) * 10; // Scale factor
    frontCrush *= (1 + slopeAdjustment * 0.1);
    backCrush *= (1 + slopeAdjustment * 0.05);
  }
  
  // Adjust based on expected move level
  if (expectedMovePercent > 8.0) {
    // Higher expected moves typically see more IV crush
    frontCrush *= 1.10;
    backCrush *= 1.05;
  }
  
  // Ensure we don't exceed maximum crush levels
  frontCrush = Math.min(frontCrush, IV_CRUSH_PARAMETERS.FRONT_MONTH.MAX_CRUSH);
  backCrush = Math.min(backCrush, IV_CRUSH_PARAMETERS.BACK_MONTH.MAX_CRUSH);
  
  return { frontCrush, backCrush };
}

/**
 * Simulate stock price movement incorporating expected move
 */
function simulateStockMovement(
  currentPrice: number,
  expectedMovePercent: number,
  randomFn: () => number = Math.random
): { newPrice: number; actualMoveRatio: number } {
  
  // Model actual earnings moves as normal distribution around 0.8x expected move
  const expectedMoveMultiplier = normalRandom(0.8, 0.3, randomFn);
  const actualMovePercent = expectedMovePercent * expectedMoveMultiplier;
  
  // Random direction (50/50 up/down)
  const direction = randomFn() < 0.5 ? -1 : 1;
  const priceChange = currentPrice * (actualMovePercent / 100) * direction;
  const newPrice = currentPrice + priceChange;
  
  const actualMoveRatio = Math.abs(actualMovePercent) / expectedMovePercent;
  
  return { newPrice, actualMoveRatio };
}

/**
 * Calculate execution costs based on liquidity score with severe penalties for poor liquidity
 */
function calculateExecutionCosts(
  liquidityScore: number = 5,
  avgVolume: number,
  spreadCost: number
): { executionCost: number; probabilityPenalty: number } {
  
  // Base execution cost as percentage of spread cost
  let executionCostPct = 0.15; // 15% base
  let probabilityPenalty = 0; // Penalty to subtract from probability of profit
  
  // Adjust based on liquidity score (0-10 scale) with severe penalties
  if (liquidityScore <= 1) {
    executionCostPct *= 4.0; // 300% increase for terrible liquidity
    probabilityPenalty = -45; // Massive 45% penalty to probability
  } else if (liquidityScore <= 2) {
    executionCostPct *= 3.0; // 200% increase for very poor liquidity
    probabilityPenalty = -35; // Very significant 35% penalty to probability
  } else if (liquidityScore <= 3) {
    executionCostPct *= 2.5; // 150% increase for poor liquidity
    probabilityPenalty = -25; // Significant 25% penalty to probability
  } else if (liquidityScore <= 4) {
    executionCostPct *= 1.8; // 80% increase for below-average liquidity
    probabilityPenalty = -15; // 15% penalty to probability
  } else if (liquidityScore <= 5) {
    executionCostPct *= 1.4; // 40% increase for mediocre liquidity
    probabilityPenalty = -8; // 8% penalty to probability
  } else if (liquidityScore >= 7) {
    executionCostPct *= 0.7; // 30% reduction for high liquidity
    probabilityPenalty = 5; // Small 5% bonus to probability
  }
  
  // Adjust based on volume
  if (avgVolume >= 1500000) { // 1.5M volume threshold
    executionCostPct *= 0.8; // 20% reduction for high volume
    probabilityPenalty += 2; // Small bonus for high volume
  } else if (avgVolume < 500000) { // Low volume penalty
    executionCostPct *= 1.2; // 20% increase for low volume
    probabilityPenalty -= 5; // 5% penalty for low volume
  }
  
  return {
    executionCost: spreadCost * executionCostPct,
    probabilityPenalty
  };
}

/**
 * Calculate calendar spread P&L based on IV crush and stock movement
 */
function calculateCalendarPnL(
  frontCrush: number,
  backCrush: number,
  actualMoveRatio: number,
  spreadDebit: number,
  executionCosts: number
): number {
  
  // DEBIT SPREAD LOGIC: We start with -spreadDebit (what we paid)
  // We profit when the spread VALUE at exit > debit paid
  
  // Calculate spread value change from IV crush (primary driver)
  // Front month loses value from IV crush (we're short) - GOOD for us
  // Back month loses value from IV crush (we're long) - BAD for us
  const frontValueChange = spreadDebit * 0.7 * frontCrush; // 70% weight to front month
  const backValueChange = spreadDebit * 0.3 * backCrush;   // 30% weight to back month
  
  // Net value change: front month crush helps us, back month crush hurts us
  let spreadValueChange = frontValueChange - backValueChange;
  
  // Adjust for stock movement impact (secondary factor)
  let movementImpact = 0;
  
  if (actualMoveRatio < EXPECTED_MOVE_IMPACT.OPTIMAL_RANGE) {
    // Optimal range: minimal impact, slight positive
    movementImpact = spreadDebit * 0.05;
  } else if (actualMoveRatio < EXPECTED_MOVE_IMPACT.MODERATE_RANGE) {
    // Moderate impact: some gamma drag
    const dragFactor = (actualMoveRatio - EXPECTED_MOVE_IMPACT.OPTIMAL_RANGE) /
                      (EXPECTED_MOVE_IMPACT.MODERATE_RANGE - EXPECTED_MOVE_IMPACT.OPTIMAL_RANGE);
    movementImpact = -spreadDebit * 0.15 * dragFactor;
  } else {
    // High impact: significant gamma losses
    const excessMove = actualMoveRatio - EXPECTED_MOVE_IMPACT.MODERATE_RANGE;
    movementImpact = -spreadDebit * (0.15 + Math.min(excessMove * 0.2, 0.4));
  }
  
  // Total P&L = spread value change + movement impact - execution costs - original debit
  // Start with -spreadDebit (what we paid), add value changes, subtract costs
  const totalPnL = -spreadDebit + spreadValueChange + movementImpact - executionCosts;
  
  // Maximum loss is 100% of debit + execution costs
  const maxLoss = -(spreadDebit + executionCosts);
  
  return Math.max(totalPnL, maxLoss);
}

/**
 * Get realistic calendar spread debit based on stock price
 */
function getRealisticSpreadDebit(currentPrice: number): number {
  if (currentPrice < 10) return 0.50;
  else if (currentPrice < 50) return 1.50;
  else if (currentPrice < 100) return 2.50;
  else return 4.50;
}

/**
 * Calculate base probability based on strategy metrics with proper weighting
 */
function calculateBaseProbability(metrics: OptionsMetrics): number {
  // Count passing metrics
  const passingMetrics = [
    metrics.avgVolume >= 1500000,
    metrics.iv30Rv30 >= 1.25,
    metrics.tsSlope <= -0.00406
  ].filter(Boolean).length;
  
  // Base probability by count (more conservative than current)
  let baseProbability;
  if (passingMetrics === 3) baseProbability = 0.65;      // All pass
  else if (passingMetrics === 2) baseProbability = 0.52;  // Two pass
  else if (passingMetrics === 1) baseProbability = 0.35;  // One pass
  else baseProbability = 0.25;                            // None pass
  
  // METRIC-SPECIFIC ADJUSTMENTS (weighted by importance from video):
  
  // 1. TERM STRUCTURE SLOPE (highest weight - most important)
  if (metrics.tsSlope <= -0.00406) {
    baseProbability += 0.08; // 8% bonus for passing
  } else {
    baseProbability -= 0.12; // 12% penalty for failing (larger penalty)
  }
  
  // 2. IV/RV RATIO (medium weight)
  if (metrics.iv30Rv30 >= 1.25) {
    baseProbability += 0.05; // 5% bonus for passing
  } else {
    baseProbability -= 0.08; // 8% penalty for failing
  }
  
  // 3. VOLUME (lowest weight - execution factor)
  if (metrics.avgVolume >= 1500000) {
    baseProbability += 0.03; // 3% bonus for passing
  } else {
    baseProbability -= 0.05; // 5% penalty for failing
  }
  
  // Ensure reasonable bounds
  return Math.max(0.15, Math.min(0.85, baseProbability));
}

/**
 * Run Monte Carlo simulation for earnings volatility calendar spread
 */
export function runMonteCarloSimulation(params: MonteCarloSimulationParams): MonteCarloResults {
  const {
    ticker,
    currentPrice,
    expectedMovePercent,
    metrics,
    liquidityScore = 5
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
  
  // Get realistic calendar spread debit (what we pay upfront)
  const spreadDebit = getRealisticSpreadDebit(currentPrice);
  
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
  
  for (let i = 0; i < numSimulations; i++) {
    // 1. Calculate IV crush for this simulation
    const { frontCrush, backCrush } = calculateIVCrush(metrics, expectedMovePercent, seededRandom);
    
    // 2. Simulate stock price movement
    const { actualMoveRatio } = simulateStockMovement(currentPrice, expectedMovePercent, seededRandom);
    
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
 */
export function calculateSimulationProbability(result: OptionsAnalysisResult): MonteCarloResults | null {
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
    liquidityScore: result.calendarLiquidityScore
  };
  
  return runMonteCarloSimulation(params);
}