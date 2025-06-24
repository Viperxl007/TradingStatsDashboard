/**
 * Concentrated Liquidity Position Tracking Types
 * Interfaces for managing CL positions, price history, and analytics
 */

/**
 * Core CL Position interface matching backend model
 */
export interface CLPosition {
  id: string;
  user_id: string;
  pool_address: string;
  token0_address: string;
  token1_address: string;
  token0_symbol: string;
  token1_symbol: string;
  pair_symbol?: string; // Backend compatibility field
  fee_tier: number;
  tick_lower: number;
  tick_upper: number;
  price_lower: number;
  price_upper: number;
  liquidity: string;
  token0_amount: number;
  token1_amount: number;
  initial_token0_amount: number;
  initial_token1_amount: number;
  initial_usd_value: number;
  current_usd_value: number;
  fees_earned_token0: number;
  fees_earned_token1: number;
  fees_earned_usd: number;
  impermanent_loss: number;
  impermanent_loss_percentage: number;
  total_return: number;
  total_return_percentage: number;
  is_in_range: boolean;
  created_at: string;
  updated_at: string;
  status: 'active' | 'closed' | 'out_of_range';
}

/**
 * Price history data for CL positions
 */
export interface CLPriceHistory {
  id: string;
  position_id: string;
  timestamp: string;
  price: number;
  token0_price: number;
  token1_price: number;
  liquidity: string;
  tick: number;
  is_in_range: boolean;
  usd_value: number;
  fees_earned_usd: number;
  impermanent_loss: number;
  total_return: number;
}

/**
 * Fee collection history for CL positions
 */
export interface CLFeeHistory {
  id: string;
  position_id: string;
  timestamp: string;
  token0_fees: number;
  token1_fees: number;
  usd_value: number;
  transaction_hash?: string;
}

/**
 * Alert configuration and status
 */
export interface CLAlert {
  id: string;
  position_id: string;
  alert_type: 'range_breach' | 'low_fees' | 'high_il' | 'price_target';
  threshold_value: number;
  is_active: boolean;
  triggered_at?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Analytics response from backend
 */
export interface CLAnalytics {
  position_id: string;
  daily_returns: Array<{
    date: string;
    return_percentage: number;
    fees_earned: number;
    il_percentage: number;
  }>;
  performance_metrics: {
    total_return: number;
    annualized_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    volatility: number;
    fees_apy: number;
    il_impact: number;
  };
  range_efficiency: {
    time_in_range: number;
    time_out_of_range: number;
    range_utilization: number;
  };
}

/**
 * Portfolio summary metrics
 */
export interface CLPortfolioSummary {
  total_positions: number;
  active_positions: number;
  total_usd_value: number;
  total_fees_earned: number;
  total_impermanent_loss: number;
  total_return: number;
  total_return_percentage: number;
  average_return_percentage: number;
  best_performing_position: string;
  worst_performing_position: string;
  positions_in_range: number;
  positions_out_of_range: number;
  total_alerts: number;
  active_alerts: number;
}

/**
 * Form data for creating new positions
 */
export interface CreatePositionFormData {
  trade_name: string; // Added required field for backend
  pool_address: string;
  token0_address: string;
  token1_address: string;
  token0_symbol: string;
  token1_symbol: string;
  fee_tier: number;
  price_lower: number;
  price_upper: number;
  token0_amount: number;
  token1_amount: number;
  initial_usd_value: number;
}

/**
 * Form validation errors
 */
export interface PositionFormErrors {
  trade_name?: string;
  pool_address?: string;
  token0_address?: string;
  token1_address?: string;
  token0_symbol?: string;
  token1_symbol?: string;
  fee_tier?: string;
  price_lower?: string;
  price_upper?: string;
  token0_amount?: string;
  token1_amount?: string;
  initial_usd_value?: string;
}

/**
 * Chart data configuration
 */
export interface CLChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill?: boolean;
    tension?: number;
  }>;
}

/**
 * Price range visualization data
 */
export interface PriceRangeData {
  current_price: number;
  price_lower: number;
  price_upper: number;
  price_history: Array<{
    timestamp: string;
    price: number;
    is_in_range: boolean;
  }>;
}

/**
 * Filter options for CL positions
 */
export interface CLFilterOptions {
  status: 'all' | 'active' | 'closed' | 'out_of_range';
  fee_tiers: number[];
  tokens: string[];
  date_range: [Date | null, Date | null];
  min_usd_value?: number;
  max_usd_value?: number;
  sort_by: 'created_at' | 'usd_value' | 'total_return' | 'fees_earned';
  sort_order: 'asc' | 'desc';
}

/**
 * API response wrapper
 */
export interface CLApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Real-time update data
 */
export interface CLRealTimeUpdate {
  position_id: string;
  current_price: number;
  usd_value: number;
  fees_earned_usd: number;
  impermanent_loss: number;
  total_return: number;
  is_in_range: boolean;
  timestamp: string;
}

/**
 * Export data format
 */
export interface CLExportData {
  positions: CLPosition[];
  price_history: CLPriceHistory[];
  fee_history: CLFeeHistory[];
  analytics: CLAnalytics[];
  export_timestamp: string;
}

/**
 * State management interfaces
 */
export interface CLState {
  positions: CLPosition[];
  selectedPosition: CLPosition | null;
  priceHistory: Record<string, CLPriceHistory[]>;
  feeHistory: Record<string, CLFeeHistory[]>;
  analytics: Record<string, CLAnalytics>;
  alerts: CLAlert[];
  portfolioSummary: CLPortfolioSummary | null;
  filters: CLFilterOptions;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * Action types for state management
 */
export enum CLActionType {
  // Position actions
  LOAD_POSITIONS_START = 'CL_LOAD_POSITIONS_START',
  LOAD_POSITIONS_SUCCESS = 'CL_LOAD_POSITIONS_SUCCESS',
  LOAD_POSITIONS_ERROR = 'CL_LOAD_POSITIONS_ERROR',
  CREATE_POSITION_START = 'CL_CREATE_POSITION_START',
  CREATE_POSITION_SUCCESS = 'CL_CREATE_POSITION_SUCCESS',
  CREATE_POSITION_ERROR = 'CL_CREATE_POSITION_ERROR',
  UPDATE_POSITION_START = 'CL_UPDATE_POSITION_START',
  UPDATE_POSITION_SUCCESS = 'CL_UPDATE_POSITION_SUCCESS',
  UPDATE_POSITION_ERROR = 'CL_UPDATE_POSITION_ERROR',
  DELETE_POSITION_START = 'CL_DELETE_POSITION_START',
  DELETE_POSITION_SUCCESS = 'CL_DELETE_POSITION_SUCCESS',
  DELETE_POSITION_ERROR = 'CL_DELETE_POSITION_ERROR',
  SELECT_POSITION = 'CL_SELECT_POSITION',
  
  // Data actions
  LOAD_PRICE_HISTORY_START = 'CL_LOAD_PRICE_HISTORY_START',
  LOAD_PRICE_HISTORY_SUCCESS = 'CL_LOAD_PRICE_HISTORY_SUCCESS',
  LOAD_PRICE_HISTORY_ERROR = 'CL_LOAD_PRICE_HISTORY_ERROR',
  LOAD_FEE_HISTORY_START = 'CL_LOAD_FEE_HISTORY_START',
  LOAD_FEE_HISTORY_SUCCESS = 'CL_LOAD_FEE_HISTORY_SUCCESS',
  LOAD_FEE_HISTORY_ERROR = 'CL_LOAD_FEE_HISTORY_ERROR',
  LOAD_ANALYTICS_START = 'CL_LOAD_ANALYTICS_START',
  LOAD_ANALYTICS_SUCCESS = 'CL_LOAD_ANALYTICS_SUCCESS',
  LOAD_ANALYTICS_ERROR = 'CL_LOAD_ANALYTICS_ERROR',
  
  // Portfolio actions
  LOAD_PORTFOLIO_SUMMARY_START = 'CL_LOAD_PORTFOLIO_SUMMARY_START',
  LOAD_PORTFOLIO_SUMMARY_SUCCESS = 'CL_LOAD_PORTFOLIO_SUMMARY_SUCCESS',
  LOAD_PORTFOLIO_SUMMARY_ERROR = 'CL_LOAD_PORTFOLIO_SUMMARY_ERROR',
  
  // Alert actions
  LOAD_ALERTS_START = 'CL_LOAD_ALERTS_START',
  LOAD_ALERTS_SUCCESS = 'CL_LOAD_ALERTS_SUCCESS',
  LOAD_ALERTS_ERROR = 'CL_LOAD_ALERTS_ERROR',
  CREATE_ALERT_START = 'CL_CREATE_ALERT_START',
  CREATE_ALERT_SUCCESS = 'CL_CREATE_ALERT_SUCCESS',
  CREATE_ALERT_ERROR = 'CL_CREATE_ALERT_ERROR',
  UPDATE_ALERT_START = 'CL_UPDATE_ALERT_START',
  UPDATE_ALERT_SUCCESS = 'CL_UPDATE_ALERT_SUCCESS',
  UPDATE_ALERT_ERROR = 'CL_UPDATE_ALERT_ERROR',
  DELETE_ALERT_START = 'CL_DELETE_ALERT_START',
  DELETE_ALERT_SUCCESS = 'CL_DELETE_ALERT_SUCCESS',
  DELETE_ALERT_ERROR = 'CL_DELETE_ALERT_ERROR',
  
  // Real-time updates
  REAL_TIME_UPDATE = 'CL_REAL_TIME_UPDATE',
  
  // Filter actions
  UPDATE_FILTERS = 'CL_UPDATE_FILTERS',
  RESET_FILTERS = 'CL_RESET_FILTERS',
  
  // Utility actions
  CLEAR_ERROR = 'CL_CLEAR_ERROR',
  CLEAR_DATA = 'CL_CLEAR_DATA'
}