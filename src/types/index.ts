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
 * Options analysis result
 */
export interface OptionsAnalysisResult {
  ticker: string;                // Stock ticker symbol
  companyName?: string;          // Company name (optional)
  currentPrice: number;          // Current stock price
  metrics: OptionsMetrics;       // Analysis metrics
  expectedMove: string;          // Expected move percentage
  recommendation: 'Recommended' | 'Consider' | 'Avoid'; // Analysis recommendation
  reportTime?: 'BMO' | 'AMC' | 'DMH'; // Earnings report time (optional)
  timestamp: number;             // Timestamp of the analysis
  error?: string;                // Error message if analysis failed
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
  
  // UI State
  isLoading: boolean;            // Loading state for async operations
  error: string | null;          // Error message if any
  activeTab: string;             // Currently active dashboard tab
  isDarkMode: boolean;           // Dark mode toggle state
}