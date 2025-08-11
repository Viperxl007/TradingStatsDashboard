/**
 * TypeScript interfaces for Macro Market Sentiment system
 */

// Core sentiment data interface
export interface MacroSentimentData {
  analysis_timestamp: number;
  data_period_start: number;
  data_period_end: number;
  overall_confidence: number; // 0-100
  btc_trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  btc_trend_strength: number; // 0-100
  alt_trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  alt_trend_strength: number; // 0-100
  trade_permission: 'NO_TRADE' | 'SELECTIVE' | 'ACTIVE' | 'AGGRESSIVE';
  market_regime: 'BTC_SEASON' | 'ALT_SEASON' | 'TRANSITION' | 'BEAR_MARKET';
  ai_reasoning: string;
  chart_data_hash: string;
  processing_time_ms: number;
  model_used: string;
  prompt_version: string;
  created_at: number;
  // Chart images (base64 encoded)
  btc_chart_image?: string | null;
  dominance_chart_image?: string | null;
  alt_strength_chart_image?: string | null;
  combined_chart_image?: string | null;
}

// Historical sentiment data
export interface MacroSentimentHistory {
  history: Array<{
    analysis_timestamp: number;
    overall_confidence: number;
    trade_permission: string;
    market_regime: string;
  }>;
  days_requested: number;
  data_points: number;
  timestamp: string;
}

// System health information
export interface MacroSystemHealth {
  health_score: number; // 0.0-1.0
  health_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  health_issues: string[];
  system_state: {
    bootstrap_completed: boolean;
    bootstrap_completed_at?: number;
    bootstrap_data_points: number;
    last_successful_scan?: number;
    last_failed_scan?: number;
    consecutive_failures: number;
    total_scans_completed: number;
    last_analysis_id?: number;
    last_analysis_timestamp?: number;
    consecutive_analysis_failures: number;
    total_analyses_completed: number;
    system_status: string;
    health_score: number;
    avg_scan_duration_ms: number;
    avg_analysis_duration_ms: number;
    data_quality_trend: number;
    scan_interval_hours: number;
    max_consecutive_failures: number;
    updated_at: number;
  };
  scanner_status: {
    is_running: boolean;
    scan_interval_hours: number;
    max_consecutive_failures: number;
    system_status: string;
    last_successful_scan?: number;
    last_failed_scan?: number;
    consecutive_failures: number;
    total_scans_completed: number;
    bootstrap_completed: boolean;
    next_scan_timestamp?: number;
    seconds_to_next_scan?: number;
  };
  bootstrap_status: {
    completed: boolean;
    completed_at?: number;
    data_points: number;
    errors: string[];
  };
  data_quality: {
    recent_points: number;
    average_quality: number;
  };
  timestamp: string;
}

// Chart summary data
export interface MacroChartSummary {
  data_points: number;
  date_range: {
    start: string;
    end: string;
  };
  btc_price: {
    current: number;
    min: number;
    max: number;
    change_percent: number;
  };
  btc_dominance: {
    current: number;
    min: number;
    max: number;
    change_percent: number;
  };
  alt_strength_ratio: {
    current: number;
    min: number;
    max: number;
    change_percent: number;
  };
  timestamp: string;
}

// Bootstrap result
export interface BootstrapResult {
  success: boolean;
  message: string;
  data_points: number;
  duration_seconds?: number;
  errors: string[];
  progress_log?: Array<{
    message: string;
    progress?: number;
    timestamp: string;
  }>;
  timestamp: string;
}

// Scan result
export interface ScanResult {
  success: boolean;
  timestamp: number;
  data_quality: number;
  scan_duration_ms: number;
  triggered_analysis: boolean;
  analysis_result?: any;
  analysis_error?: string;
  error?: string;
  error_type?: string;
}

// Analysis result
export interface AnalysisResult {
  analysis_timestamp: number;
  data_period_start: number;
  data_period_end: number;
  overall_confidence: number;
  btc_trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  btc_trend_strength: number;
  alt_trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  alt_trend_strength: number;
  trade_permission: 'NO_TRADE' | 'SELECTIVE' | 'ACTIVE' | 'AGGRESSIVE';
  market_regime: 'BTC_SEASON' | 'ALT_SEASON' | 'TRANSITION' | 'BEAR_MARKET';
  ai_reasoning: string;
  chart_data_hash: string;
  processing_time_ms: number;
  model_used: string;
  prompt_version: string;
  analysis_id: string;
  total_processing_time_ms: number;
  timestamp: string;
}

// UI component props interfaces
export interface MacroSentimentPanelProps {
  data: MacroSentimentData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export interface ConfidenceGaugeProps {
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export interface TrendIndicatorProps {
  type: 'BTC' | 'ALT';
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  strength: number;
  size?: 'sm' | 'md' | 'lg';
}

export interface TradePermissionCardProps {
  permission: 'NO_TRADE' | 'SELECTIVE' | 'ACTIVE' | 'AGGRESSIVE';
  size?: 'sm' | 'md' | 'lg';
}

export interface MiniConfidenceChartProps {
  data: Array<{
    analysis_timestamp: number;
    overall_confidence: number;
  }>;
  width?: number;
  height?: number;
}

export interface UpdateStatusProps {
  lastUpdated: string;
  nextUpdate: string | null;
}

// Utility types
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';
export type TradePermission = 'NO_TRADE' | 'SELECTIVE' | 'ACTIVE' | 'AGGRESSIVE';
export type MarketRegime = 'BTC_SEASON' | 'ALT_SEASON' | 'TRANSITION' | 'BEAR_MARKET';
export type SystemStatus = 'INITIALIZING' | 'ACTIVE' | 'ERROR' | 'MAINTENANCE';
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

// Color scheme mappings
export interface ColorSchemes {
  confidence: {
    [key: number]: string; // 0-25: red, 26-50: orange, 51-75: yellow, 76-100: green
  };
  trend: {
    UP: string;
    DOWN: string;
    SIDEWAYS: string;
  };
  permission: {
    NO_TRADE: string;
    SELECTIVE: string;
    ACTIVE: string;
    AGGRESSIVE: string;
  };
  regime: {
    BTC_SEASON: string;
    ALT_SEASON: string;
    TRANSITION: string;
    BEAR_MARKET: string;
  };
}

// API response wrapper
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Hook return types
export interface UseMacroSentimentReturn {
  data: MacroSentimentData | null;
  history: MacroSentimentHistory | null;
  systemHealth: MacroSystemHealth | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  nextUpdate: string | null;
  refresh: () => Promise<void>;
  triggerScan: () => Promise<void>;
  triggerAnalysis: () => Promise<void>;
}

export interface UseMacroSentimentHistoryReturn {
  history: MacroSentimentHistory | null;
  isLoading: boolean;
  error: string | null;
  refresh: (days?: number) => Promise<void>;
}

export interface UseSystemHealthReturn {
  health: MacroSystemHealth | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startScanner: () => Promise<void>;
  stopScanner: () => Promise<void>;
  triggerBootstrap: (force?: boolean) => Promise<void>;
}