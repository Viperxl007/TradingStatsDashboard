/**
 * Trade Tracker Types
 * 
 * This file contains all type definitions for the Trade Tracker functionality.
 */

/**
 * Trade entry status
 */
export type TradeStatus = 'open' | 'closed' | 'cancelled';

/**
 * Trade direction
 */
export type TradeDirection = 'long' | 'short';

/**
 * Option type
 */
export type OptionType = 'call' | 'put';

/**
 * Strategy type
 */
export type StrategyType = 
  | 'stock' 
  | 'single_option' 
  | 'vertical_spread' 
  | 'iron_condor' 
  | 'calendar_spread' 
  | 'diagonal_spread' 
  | 'covered_call' 
  | 'protective_put'
  | 'straddle'
  | 'strangle'
  | 'butterfly'
  | 'custom';

/**
 * Base trade entry interface
 */
export interface TradeEntry {
  id: string;                      // Unique identifier for the trade
  ticker: string;                  // Stock/ETF ticker symbol
  entryDate: string;               // ISO date string of entry
  entryPrice: number;              // Entry price per share/contract
  quantity: number;                // Number of shares/contracts
  direction: TradeDirection;       // Long or short
  status: TradeStatus;             // Open, closed, or cancelled
  strategy: StrategyType;          // Trading strategy used
  exitDate?: string;               // ISO date string of exit (if closed)
  exitPrice?: number;              // Exit price per share/contract (if closed)
  stopLoss?: number;               // Stop loss price
  takeProfit?: number;             // Take profit price
  profitLoss?: number;             // Realized profit/loss (if closed)
  fees: number;                    // Transaction fees
  notes: string;                   // Notes about the trade
  tags: string[];                  // Custom tags for filtering
  createdAt: number;               // Unix timestamp of creation
  updatedAt: number;               // Unix timestamp of last update
  metadata?: Record<string, any>;  // Additional metadata (company name, etc.)
}

/**
 * Stock trade entry
 */
export interface StockTradeEntry extends TradeEntry {
  strategy: 'stock';
}

/**
 * Option leg in a trade
 */
export interface OptionLeg {
  optionType: OptionType;          // Call or put
  strike: number;                  // Strike price
  expiration: string;              // ISO date string of expiration
  premium: number;                 // Premium paid/received per contract
  quantity: number;                // Number of contracts
  isLong: boolean;                 // Whether the leg is long (true) or short (false)
  expirationOutcome?: {            // Outcome when leg expires (for tracking expired legs)
    priceAtExpiration: number;     // Price paid/received at expiration ($0 if expired worthless)
    loggedAt: number;              // Unix timestamp when outcome was logged
    wasForced: boolean;            // Whether broker forced buy-to-close (true) or expired worthless (false)
  };
}

/**
 * Calendar spread specific data stored in metadata
 */
export interface CalendarSpreadData {
  strikePrice: number;            // Strike price for the spread
  shortMonthCredit: number;       // Credit received from short month
  longMonthDebit: number;         // Debit paid for long month
  totalDebit: number;             // Net debit for the spread
  shortExpiration: string;        // Short month expiration date
  longExpiration: string;         // Long month expiration date
  ivRvRatioAtEntry: number;       // IV/RV ratio when trade was opened
  tsSlopeAtEntry: number;         // TS Slope when trade was opened
  brokerFees: number;             // Broker fees for the trade
}

/**
 * Option trade entry
 */
export interface OptionTradeEntry extends TradeEntry {
  strategy: 'single_option' | 'vertical_spread' | 'iron_condor' | 'calendar_spread' |
            'diagonal_spread' | 'covered_call' | 'protective_put' | 'straddle' |
            'strangle' | 'butterfly' | 'custom';
  legs: OptionLeg[];              // Option legs in the trade
  underlyingPrice: number;        // Price of the underlying at entry
}

/**
 * Trade entry union type
 */
export type AnyTradeEntry = StockTradeEntry | OptionTradeEntry;

/**
 * Trade filter options
 */
export interface TradeFilterOptions {
  tickers?: string[];              // Filter by ticker symbols
  dateRange?: [Date | null, Date | null]; // Filter by date range
  status?: TradeStatus[];          // Filter by status
  strategies?: StrategyType[];     // Filter by strategy
  tags?: string[];                 // Filter by tags
  profitableOnly?: boolean;        // Filter only profitable trades
  searchText?: string;             // Search in ticker, notes, tags
}

/**
 * Trade statistics for analysis
 */
export interface TradeStatistics {
  totalTrades: number;             // Total number of trades
  openTrades: number;              // Number of open trades
  closedTrades: number;            // Number of closed trades
  winningTrades: number;           // Number of winning trades
  losingTrades: number;            // Number of losing trades
  winRate: number;                 // Win rate percentage
  totalProfit: number;             // Total profit across all trades
  totalLoss: number;               // Total loss across all trades
  netProfitLoss: number;           // Net profit/loss
  averageProfit: number;           // Average profit per winning trade
  averageLoss: number;             // Average loss per losing trade
  largestProfit: number;           // Largest single profit
  largestLoss: number;             // Largest single loss
  profitFactor: number;            // Profit factor (total profit / total loss)
  expectancy: number;              // Average expected profit/loss per trade
  sharpeRatio: number;             // Sharpe ratio (risk-adjusted return)
  averageDuration: number;         // Average trade duration in days
  byStrategy: Record<StrategyType, {
    count: number;                 // Number of trades with this strategy
    winRate: number;               // Win rate for this strategy
    netProfitLoss: number;         // Net profit/loss for this strategy
  }>;
  byTicker: Record<string, {
    count: number;                 // Number of trades with this ticker
    winRate: number;               // Win rate for this ticker
    netProfitLoss: number;         // Net profit/loss for this ticker
  }>;
  byIvRvRatio: {
    high: { count: number; winRate: number; netProfitLoss: number; }; // IV/RV > 1.2
    medium: { count: number; winRate: number; netProfitLoss: number; }; // IV/RV 0.8-1.2
    low: { count: number; winRate: number; netProfitLoss: number; }; // IV/RV < 0.8
  };
  byTsSlope: {
    positive: { count: number; winRate: number; netProfitLoss: number; }; // TS Slope > 0
    neutral: { count: number; winRate: number; netProfitLoss: number; }; // TS Slope -0.1 to 0.1
    negative: { count: number; winRate: number; netProfitLoss: number; }; // TS Slope < -0.1
  };
}

/**
 * Database schema version information
 */
export interface SchemaInfo {
  version: number;                 // Current schema version
  lastUpdated: number;             // Timestamp of last schema update
}