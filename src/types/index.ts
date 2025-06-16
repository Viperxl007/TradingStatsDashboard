import {
  AnyTradeEntry,
  TradeFilterOptions,
  TradeStatistics
} from './tradeTracker';
import {
  ChartAnalysisState
} from './chartAnalysis';

/**
 * Trade data model representing an individual trade
 */
export interface TradeData {
  id: string;                    // Unique identifier for the trade
  token: string;                 // Token/cryptocurrency symbol
  date: string;                  // ISO date string of the trade
  timestamp: number;             // Unix timestamp for sorting and calculations
  type: 'buy' | 'sell';          // Trade type
  amount: number;                // Quantity of tokens traded
  price: number;                 // Price per token in USD
  totalValue: number;            // Total value of the trade (amount * price)
  profitLoss: number;            // Profit/loss for this trade (if applicable)
  fees: number;                  // Transaction fees
  exchange: string;              // Exchange where the trade occurred
  notes: string;                 // Optional notes about the trade
}

/**
 * Performance metrics for a specific token
 */
export interface TokenPerformance {
  token: string;                 // Token symbol
  totalTrades: number;           // Total number of trades for this token
  buyTrades: number;             // Number of buy trades
  sellTrades: number;            // Number of sell trades
  totalVolume: number;           // Total volume traded
  totalProfitLoss: number;       // Total profit/loss for this token
  averageProfitLoss: number;     // Average profit/loss per trade
  winRate: number;               // Percentage of profitable trades
  averageHoldingTime: number;    // Average time between buy and sell (in days)
  trend: 'up' | 'down' | 'neutral'; // Current trend based on recent performance
  volatility: number;            // Measure of price volatility
  recentPerformance: number;     // Performance in the last 30 days
  priceChange: number;           // Percentage price change since first trade
}

/**
 * Monthly performance metrics
 */
export interface MonthlyPerformance {
  month: string;                 // Month in YYYY-MM format
  trades: number;                // Number of trades in this month
  profitLoss: number;            // Profit/loss for this month
  winRate: number;               // Win rate for this month
}

/**
 * Performance metrics for a specific timeframe
 */
export interface TimeframePerformance {
  timeframe: string;             // Timeframe label (e.g., "Last 7 days")
  startDate: string;             // Start date of the timeframe
  endDate: string;               // End date of the timeframe
  trades: number;                // Number of trades in this timeframe
  profitLoss: number;            // Profit/loss for this timeframe
  winRate: number;               // Win rate for this timeframe
  topToken: string;              // Best performing token in this timeframe
}

/**
 * Account-level summary metrics
 */
export interface AccountSummary {
  totalTrades: number;           // Total number of trades
  uniqueTokens: number;          // Number of unique tokens traded
  totalProfitLoss: number;       // Total profit/loss across all trades
  averageProfitLoss: number;     // Average profit/loss per trade
  winRate: number;               // Percentage of profitable trades
  bestPerformingToken: string;   // Token with highest profit
  worstPerformingToken: string;  // Token with highest loss
  mostTradedToken: string;       // Token with most trades
  averageTradesPerDay: number;   // Average number of trades per day
  totalFees: number;             // Total fees paid
  netProfitLoss: number;         // Total profit/loss minus fees
  monthlyPerformance: MonthlyPerformance[]; // Performance broken down by month
}

/**
 * Filter options for the dashboard
 */
export interface FilterOptions {
  selectedTokens: string[];
  dateRange: [Date | null, Date | null];
  tradeType: 'all' | 'buy' | 'sell';
  timeframe: string;
}

/**
 * Options analysis metrics
 */
export interface OptionsMetrics {
  avgVolume: number;             // Average trading volume
  avgVolumePass: string;         // Whether average volume passes threshold ("true" or "false")
  iv30Rv30: number;              // Implied volatility to realized volatility ratio
  iv30Rv30Pass: string;          // Whether IV/RV ratio passes threshold ("true" or "false")
  tsSlope: number;               // Term structure slope
  tsSlopePass: string;           // Whether term structure slope passes threshold ("true" or "false")
}

/**
 * Optimal calendar spread details
 */
export interface CalendarSpreadLiquidity {
  score: number;                 // Overall liquidity score (0-10)
  front_liquidity: LiquidityDetails; // Liquidity details for front month option
  back_liquidity: LiquidityDetails;  // Liquidity details for back month option
  spread_impact: number;         // How much of spread cost is consumed by bid-ask spreads
  has_zero_bids: boolean;        // Whether either leg has zero bids
}

export interface OptimalCalendarSpread {
  strike: number;                // Strike price for the spread
  frontMonth: string;            // Front month expiration date
  backMonth: string;             // Back month expiration date
  spreadCost: number;            // Cost of the spread
  ivDifferential: number;        // IV differential between months
  ivQuality?: string;            // IV differential quality rating (Excellent, Good, Below threshold)
  score: number;                 // Algorithmic score of the spread
  frontIv?: number;              // Front month implied volatility
  backIv?: number;               // Back month implied volatility
  metricsPass?: string;          // Whether all metrics pass thresholds ("true" or "false")
  frontLiquidity: LiquidityDetails; // Liquidity details for front month option
  backLiquidity: LiquidityDetails;  // Liquidity details for back month option
  combinedLiquidity?: CalendarSpreadLiquidity; // Combined liquidity details for the spread
  optionType?: 'call' | 'put';   // Type of option used in the spread
  // New fields from backend calculations
  estimatedMaxProfit?: number;   // Estimated maximum profit
  returnOnRisk?: number;         // Return on risk (profit / cost)
  probabilityOfProfit?: number;  // Probability of profit
  enhancedProbability?: number;  // Enhanced probability with volatility crush
  realisticReturnOnRisk?: number; // More realistic return on risk calculation
  spreadImpact?: number;         // Impact of bid-ask spreads on profitability
  // Monte Carlo simulation results
  monteCarloResults?: {
    probabilityOfProfit: number; // Monte Carlo probability of profit (adjusted)
    raw_probability: number;     // Raw probability before adjustments
    expectedProfit: number;      // Expected profit from simulation
    maxProfit: number;           // Maximum profit from simulation
    returnOnRisk: number;        // Return on risk from simulation
    maxReturn: number;           // Maximum return from simulation
    numSimulations: number;      // Number of simulations run
    percentiles: {              // Percentile values for profit distribution
      [key: string]: number;
    };
  };
  // IV crush model
  ivCrushModel?: {
    preEarningsFrontIv: number;  // Front month IV before earnings
    preEarningsBackIv: number;   // Back month IV before earnings
    postEarningsFrontIv: number; // Front month IV after earnings
    postEarningsBackIv: number;  // Back month IV after earnings
    ivCrushAmount: {
      front: number;             // Amount of IV crush in front month
      back: number;              // Amount of IV crush in back month
    };
  };
  // Liquidity warning information
  liquidityWarnings?: {
    frontMonth: {
      level: 'safe' | 'caution' | 'high_risk';
      color: 'green' | 'yellow' | 'red';
      description: string;
    };
    backMonth: {
      level: 'safe' | 'caution' | 'high_risk';
      color: 'green' | 'yellow' | 'red';
      description: string;
    };
    threshold: number;
    thresholdInfo: {
      tier: string;
      market_cap: number;
      description: string;
    };
  };
}

/**
 * Naked option details
 */
export interface NakedOption {
  type: 'call' | 'put';          // Option type
  strike: number;                // Strike price
  expiration: string;            // Expiration date
  premium: number;               // Option premium
  iv: number;                    // Implied volatility
  delta: number | null;          // Option delta
  probOtm: number;               // Probability of finishing out-of-the-money
  roc: number;                   // Return on capital
  marginRequirement: number;     // Margin requirement
  maxLoss: number | null;        // Maximum possible loss (null for unlimited)
  liquidity: number;             // Liquidity score
  breakEven: number;             // Break-even price (Strike - Premium for puts, Strike + Premium for calls)
  breakEvenPct: number;          // Break-even price as percentage from current price
  outsideExpectedMove: string;   // Whether break-even is outside the expected move range ("true" or "false")
  score: number;                 // Algorithmic score
}

/**
 * Optimal naked options details
 */
export interface OptimalNakedOptions {
  expectedMove: {
    percent: number;             // Expected move as a percentage
    dollars: number;             // Expected move in dollars
  };
  daysToExpiration: number;      // Days to expiration
  topOptions: NakedOption[];     // Top naked option opportunities
}

/**
 * Options analysis result
 */
/**
 * Strategy availability information
 */
export interface StrategyAvailability {
  calendar_available: boolean;   // Whether calendar spreads are available
  naked_available: boolean;      // Whether naked options are available
  iron_condor_available: boolean; // Whether iron condors are available
}

/**
 * Options analysis result
 */
export interface OptionsAnalysisResult {
  ticker: string;                // Stock ticker symbol
  companyName?: string;          // Company name (optional)
  currentPrice: number;          // Current stock price
  metrics: OptionsMetrics;       // Analysis metrics
  expectedMove: string;          // Expected move percentage
  recommendation: 'Recommended' | 'Consider' | 'Avoid' | 'FILTERED OUT'; // Analysis recommendation
  reportTime?: 'BMO' | 'AMC' | 'DMH'; // Earnings report time (optional)
  earningsDate?: string;         // Earnings date (optional)
  timestamp: number;             // Timestamp of the analysis
  error?: string;                // Error message if analysis failed
  strategyAvailability?: StrategyAvailability; // Strategy availability information
  optimalCalendarSpread?: OptimalCalendarSpread; // Optimal calendar spread (if available)
  optimalNakedOptions?: OptimalNakedOptions;    // Optimal naked options (if available)
  optimalIronCondors?: OptimalIronCondors;      // Optimal iron condors (if available)
  calendarLiquidityScore?: number; // Liquidity score for the specific calendar spread (0-10)
  simulationResults?: SimulationResults; // Monte Carlo simulation results for earnings volatility calendar spread
}

/**
 * Earnings calendar item
 */
export interface EarningsCalendarItem {
  ticker: string;                // Stock ticker symbol
  companyName: string;           // Company name
  reportTime: 'BMO' | 'AMC' | 'DMH'; // Before Market Open, After Market Close, During Market Hours
  date: string;                  // Date of earnings report
  estimatedEPS: number | null;   // Estimated earnings per share
  actualEPS: number | null;      // Actual earnings per share
}

/**
 * Options data state
 */
export interface OptionsDataState {
  analysisResult: OptionsAnalysisResult | null; // Current analysis result
  scanResults: OptionsAnalysisResult[];        // Results from earnings scan
  earningsCalendar: EarningsCalendarItem[];    // Earnings calendar data
  isLoading: boolean;                          // Loading state
  error: string | null;                        // Error message if any
}

/**
 * Application state
 */
export interface DataState {
  rawData: TradeData[];          // Original unfiltered trade data
  filteredData: TradeData[];     // Trade data after applying filters
  accountSummary: AccountSummary; // Account-level summary metrics
  tokenPerformance: TokenPerformance[]; // Performance metrics for each token
  trendingTokens: TokenPerformance[]; // Tokens with positive trends
  underperformingTokens: TokenPerformance[]; // Tokens with negative trends
  
  // Filters
  selectedTokens: string[];      // Currently selected tokens for filtering
  dateRange: [Date | null, Date | null]; // Selected date range
  tradeType: 'all' | 'buy' | 'sell'; // Filter by trade type
  timeframe: string;             // Timeframe filter (all, week, month, etc.)
  
  // Options Data
  optionsData: OptionsDataState; // Options earnings screener data
  
  // Trade Tracker Data
  tradeTrackerData: TradeTrackerState; // Trade Tracker state
  
  // Chart Analysis Data
  chartAnalysisData: ChartAnalysisState; // Chart Analysis state
  
  // UI State
  isLoading: boolean;            // Loading state for async operations
  error: string | null;          // Error message if any
  activeTab: string;             // Currently active dashboard tab
  isDarkMode: boolean;           // Dark mode toggle state
}

/**
 * Trade Tracker state
 */
export interface TradeTrackerState {
  trades: AnyTradeEntry[];       // All trade entries
  filteredTrades: AnyTradeEntry[]; // Filtered trade entries
  statistics: TradeStatistics;   // Trade statistics
  filters: TradeFilterOptions;   // Current filter options
  selectedTradeId: string | null; // Currently selected trade
  isLoading: boolean;            // Loading state for async operations
  error: string | null;          // Error message if any
}

/**
 * Liquidity details for an option
 */
export interface LiquidityDetails {
  score: number;               // Overall liquidity score (0-10)
  spread_pct: number;          // Bid-ask spread as percentage of option price
  volume: number;              // Trading volume
  open_interest: number;       // Open interest
  has_zero_bid: boolean;       // Whether the option has a zero bid
  spread_dollars: number;      // Absolute spread in dollars
}

/**
 * Iron condor spread leg details
 */
export interface IronCondorSpreadLeg {
  shortStrike: number;         // Short strike price
  longStrike: number;          // Long strike price
  shortDelta: number;          // Delta of short option
  shortPremium: number;        // Premium of short option
  longPremium: number;         // Premium of long option
  shortLiquidity: LiquidityDetails; // Liquidity details for short option
  longLiquidity: LiquidityDetails;  // Liquidity details for long option
}

/**
 * Enhanced probability of profit details that account for volatility crush
 */
export interface EnhancedProbability {
  ensemble_probability: number;     // Weighted average of all probability estimates
  confidence_interval: {
    low: number;                    // Lower bound of confidence interval
    high: number;                   // Upper bound of confidence interval
  };
  component_probabilities: {
    iv_based: number;               // Standard delta-based probability
    expected_move_based: number;    // Probability based on expected move
    term_structure_based: number;   // Probability based on term structure
    historical_vol_based: number;   // Probability based on historical volatility
  };
}

/**
 * Iron condor opportunity details
 */
export interface IronCondor {
  callSpread: IronCondorSpreadLeg;  // Call spread leg (short call + long call)
  putSpread: IronCondorSpreadLeg;   // Put spread leg (short put + long put)
  netCredit: number;                // Net credit received
  maxLoss: number;                  // Maximum possible loss
  breakEvenLow: number;             // Lower break-even price
  breakEvenHigh: number;            // Higher break-even price
  probProfit: number;               // Standard probability of profit
  enhancedProbProfit?: EnhancedProbability; // Enhanced probability accounting for volatility crush
  returnOnRisk: number;             // Return on risk (net credit / max loss)
  score: number;                    // Algorithmic score
  liquidityScore: number;           // Overall liquidity score (0-10)
  hasZeroBids: boolean;             // Whether any leg has zero bids
}

/**
 * Optimal iron condors details
 */
export interface OptimalIronCondors {
  expectedMove: {
    percent: number;             // Expected move as a percentage
    dollars: number;             // Expected move in dollars
  };
  daysToExpiration: number;      // Days to expiration
  topIronCondors: IronCondor[];  // Top iron condor opportunities
  nextBestPlay: IronCondor | null; // Alternative play with better liquidity
}

/**
 * Monte Carlo simulation results for earnings volatility calendar spread strategy
 */
export interface SimulationResults {
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
}