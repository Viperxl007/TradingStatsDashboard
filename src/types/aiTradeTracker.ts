/**
 * AI Trade Tracker Types
 * 
 * Type definitions for tracking AI-generated trade recommendations and their performance
 */

import { TradingRecommendationOverlay } from './chartAnalysis';

/**
 * AI Trade status
 */
export type AITradeStatus = 'waiting' | 'open' | 'closed' | 'cancelled' | 'expired';

/**
 * AI Trade close reason
 */
export type AITradeCloseReason = 'manual' | 'stop_loss' | 'take_profit' | 'ai_recommendation' | 'expiration';

/**
 * AI Trade confidence level
 */
export type AITradeConfidence = 'low' | 'medium' | 'high' | 'very_high';

/**
 * AI Model performance metrics
 */
export interface AIModelPerformance {
  modelId: string;
  modelName: string;
  totalRecommendations: number;
  successfulTrades: number;
  failedTrades: number;
  winRate: number;
  averageReturn: number;
  totalReturn: number;
  averageConfidence: number;
  averageHoldTime: number; // in hours
  bestTrade: number;
  worstTrade: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

/**
 * Token performance in AI trades
 */
export interface AITokenPerformance {
  ticker: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  averageReturn: number;
  bestTrade: number;
  worstTrade: number;
  averageConfidence: number;
  averageHoldTime: number;
  lastTradeDate: number;
  profitFactor: number;
}

/**
 * AI Trade entry based on chart analysis
 */
export interface AITradeEntry {
  id: string;
  analysisId: string; // Reference to the chart analysis that generated this trade
  ticker: string;
  timeframe: string;
  
  // AI Analysis Data
  aiModel: string; // Claude model used for analysis
  confidence: number; // 0-1 scale from AI analysis
  confidenceLevel: AITradeConfidence; // Categorized confidence
  sentiment: 'bullish' | 'bearish' | 'neutral';
  
  // Trade Recommendation
  action: 'buy' | 'sell';
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  riskReward?: number;
  reasoning: string; // AI's reasoning for the trade
  
  // Trade Execution
  status: AITradeStatus;
  entryDate: number; // Unix timestamp when recommendation was made
  actualEntryDate?: number; // When trade was actually entered (if different)
  actualEntryPrice?: number; // Actual entry price (if different from recommended)
  exitDate?: number; // When trade was closed
  exitPrice?: number; // Actual exit price
  closeReason?: AITradeCloseReason;
  
  // Performance Metrics
  profitLoss?: number; // Actual P&L
  profitLossPercentage?: number; // P&L as percentage
  holdTime?: number; // Time held in hours
  maxDrawdown?: number; // Maximum drawdown during trade
  maxProfit?: number; // Maximum profit reached during trade
  
  // Context Data
  chartImageBase64?: string; // Original chart image
  markedUpChartImageBase64?: string; // Chart with AI annotations
  marketConditions?: string; // Market conditions at time of recommendation
  volumeProfile?: 'high' | 'normal' | 'low';
  
  // Key Levels from Analysis
  keyLevels?: {
    support: number[];
    resistance: number[];
  };
  
  // Technical Indicators at Entry
  technicalIndicators?: {
    rsi?: number;
    macd?: number;
    volume?: number;
    volatility?: number;
  };
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  notes?: string; // User notes
  tags?: string[]; // Custom tags
  
  // Validation Data
  priceAtRecommendation: number; // Actual price when recommendation was made
  priceValidation?: {
    oneHour?: number;
    fourHours?: number;
    oneDay?: number;
    threeDays?: number;
    oneWeek?: number;
  };
}

/**
 * AI Trade filter options
 */
export interface AITradeFilterOptions {
  tickers?: string[];
  timeframes?: string[];
  status?: AITradeStatus[];
  confidence?: AITradeConfidence[];
  aiModels?: string[];
  dateRange?: [Date | null, Date | null];
  profitableOnly?: boolean;
  minConfidence?: number;
  maxConfidence?: number;
  searchText?: string;
}

/**
 * AI Trade statistics
 */
export interface AITradeStatistics {
  totalRecommendations: number;
  activeTrades: number;
  closedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  averageReturn: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldTime: number;
  averageConfidence: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  
  // Performance by confidence level
  byConfidence: Record<AITradeConfidence, {
    count: number;
    winRate: number;
    averageReturn: number;
    totalReturn: number;
  }>;
  
  // Performance by timeframe
  byTimeframe: Record<string, {
    count: number;
    winRate: number;
    averageReturn: number;
    totalReturn: number;
  }>;
  
  // Performance by AI model
  byModel: Record<string, AIModelPerformance>;
  
  // Performance by ticker
  byTicker: Record<string, AITokenPerformance>;
  
  // Monthly performance
  monthlyPerformance: Array<{
    month: string; // YYYY-MM format
    trades: number;
    winRate: number;
    totalReturn: number;
    averageReturn: number;
    bestTrade: number;
    worstTrade: number;
  }>;
  
  // Recent performance trends
  recentTrends: {
    last7Days: { trades: number; winRate: number; totalReturn: number; };
    last30Days: { trades: number; winRate: number; totalReturn: number; };
    last90Days: { trades: number; winRate: number; totalReturn: number; };
  };
}

/**
 * AI Trade Tracker state for DataContext
 */
export interface AITradeTrackerState {
  // Trade data
  trades: AITradeEntry[];
  filteredTrades: AITradeEntry[];
  selectedTrade: AITradeEntry | null;
  
  // Statistics
  statistics: AITradeStatistics | null;
  
  // Filters
  filters: AITradeFilterOptions;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Active monitoring
  activeMonitoring: boolean; // Whether to actively monitor AI recommendations
  autoEntry: boolean; // Whether to automatically enter trades (future feature)
}

/**
 * AI Trade creation request
 */
export interface CreateAITradeRequest {
  analysisId: string;
  ticker: string;
  timeframe: string;
  aiModel: string;
  confidence: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  action: 'buy' | 'sell';
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  riskReward?: number;
  reasoning: string;
  chartImageBase64?: string;
  markedUpChartImageBase64?: string;
  keyLevels?: { support: number[]; resistance: number[]; };
  technicalIndicators?: Record<string, number>;
  marketConditions?: string;
  volumeProfile?: 'high' | 'normal' | 'low';
  priceAtRecommendation: number;
}

/**
 * AI Trade update request
 */
export interface UpdateAITradeRequest {
  id: string;
  status?: AITradeStatus;
  actualEntryDate?: number;
  actualEntryPrice?: number;
  exitDate?: number;
  exitPrice?: number;
  closeReason?: AITradeCloseReason;
  notes?: string;
  tags?: string[];
}

/**
 * AI Trade performance report
 */
export interface AITradePerformanceReport {
  period: string; // e.g., "2024-01", "2024-Q1", "2024"
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  averageReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  bestPerformingModel: string;
  bestPerformingTimeframe: string;
  bestPerformingToken: string;
  recommendations: string[]; // AI-generated insights about performance
}