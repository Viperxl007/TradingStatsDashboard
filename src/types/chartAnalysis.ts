/**
 * Chart Analysis Types
 * 
 * TypeScript interfaces for the AI-powered chart analysis feature
 */

/**
 * Chart analysis request payload
 */
export interface ChartAnalysisRequest {
  ticker: string;
  chartImage: string; // Base64 encoded image
  timeframe?: string;
  currentPrice?: number; // Current price for forward-looking validation
  additionalContext?: string;
  model?: string; // Selected Claude model
}

/**
 * Claude model information
 */
export interface ClaudeModel {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  cost_per_1k_tokens: number;
}

/**
 * Available models response
 */
export interface AvailableModelsResponse {
  success: boolean;
  models: ClaudeModel[];
  default_model: string;
  timestamp: number;
}

/**
 * Key level detected by AI analysis
 */
export interface KeyLevel {
  price: number;
  type: 'support' | 'resistance' | 'pivot';
  strength: 'weak' | 'moderate' | 'strong';
  description: string;
  confidence: number; // 0-1 scale
}

/**
 * Chart pattern identified by AI
 */
export interface ChartPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1 scale
  description: string;
  targetPrice?: number;
  stopLoss?: number;
}

/**
 * Technical indicator analysis
 */
export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

/**
 * Trading recommendation overlay for chart visualization
 */
export interface TradingRecommendationOverlay {
  id: string;
  timeframe: string;
  timestamp: number;
  action: 'buy' | 'sell' | 'hold';
  entryPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  riskReward?: number;
  reasoning: string;
  confidence: number;
  isActive: boolean; // Whether this recommendation is currently active/valid
  expiresAt?: number; // When this recommendation expires (timestamp)
}

/**
 * Chart annotation for displaying trading recommendations
 */
export interface TradingAnnotation {
  id: string;
  type: 'entry' | 'target' | 'stopLoss' | 'zone';
  price: number;
  color: string;
  label: string;
  description: string;
  visible: boolean;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
  timeframe: string; // Only show for this specific timeframe
}

/**
 * AI chart analysis result
 */
export interface ChartAnalysisResult {
  id: string;
  analysis_id?: string; // Backend analysis ID for updates
  ticker: string;
  timestamp: number;
  currentPrice: number;
  timeframe: string;
  
  // AI Analysis Results
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1 scale
  
  // Key Levels
  keyLevels: KeyLevel[];
  
  // Patterns
  patterns: ChartPattern[];
  
  // Technical Indicators
  technicalIndicators: TechnicalIndicator[];
  
  // Trading Recommendations
  recommendations: {
    action: 'buy' | 'sell' | 'hold';
    entryPrice?: number;
    targetPrice?: number;
    stopLoss?: number;
    riskReward?: number;
    reasoning: string;
  };
  
  // Trading Recommendation Overlay (NEW)
  tradingOverlay?: TradingRecommendationOverlay;
  
  // Trading Annotations for Chart (NEW)
  tradingAnnotations?: TradingAnnotation[];
  
  // Chart Images
  chartImageUrl?: string;
  chartImageBase64?: string; // Base64 encoded original chart image for display
  markedUpChartImageBase64?: string; // Base64 encoded chart with analysis overlays/markups
  
  // Enhanced Analysis Data
  detailedAnalysis?: {
    chartOverview?: any;
    marketStructure?: any;
    technicalIndicators?: any;
    priceLevels?: any;
    tradingAnalysis?: any;
  };
  
  // Analysis metadata
  analysisStages?: {
    stage1_success?: boolean;
    stage2_success?: boolean;
    stage3_success?: boolean;
    stage4_success?: boolean;
  };
  
  // Context data
  contextData?: any;
  
  // Context Assessment (NEW - Accountability Layer)
  context_assessment?: string;
  
  // Processing info
  processing_info?: {
    image_hash?: string;
    original_size?: any;
    processed_size?: any;
    optimizations_applied?: string[];
  };
  
  // Error handling
  error?: string;
  errors?: string[];
}

/**
 * Historical analysis entry
 */
export interface HistoricalAnalysis {
  id: string;
  ticker: string;
  timestamp: number;
  timeframe?: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  currentPrice: number;
  keyLevelsCount: number;
  patternsCount: number;
  tradingRecommendation?: {
    action: 'buy' | 'sell' | 'hold';
    entryPrice?: number;
    targetPrice?: number;
    stopLoss?: number;
    reasoning?: string;
  };
  keyLevels?: {
    support: number[];
    resistance: number[];
  };
}

/**
 * Chart analysis context for better AI understanding
 */
export interface AnalysisContext {
  ticker: string;
  marketConditions?: string;
  recentNews?: string[];
  earningsDate?: string;
  volumeProfile?: 'high' | 'normal' | 'low';
  marketSentiment?: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Chart analysis state for DataContext
 */
export interface ChartAnalysisState {
  // Current analysis
  currentAnalysis: ChartAnalysisResult | null;
  
  // Historical analyses
  analysisHistory: HistoricalAnalysis[];
  
  // Selected ticker for analysis
  selectedTicker: string;
  
  // Chart screenshot data
  chartScreenshot: string | null;
  
  // Analysis context
  analysisContext: AnalysisContext | null;
  
  // Active trading recommendations by timeframe (NEW)
  activeTradingRecommendations: Map<string, TradingRecommendationOverlay>;
  
  // UI State
  isAnalyzing: boolean;
  isLoadingHistory: boolean;
  isCapturingChart: boolean;
  error: string | null;
  
  // Settings
  autoAnalysis: boolean;
  analysisInterval: number; // minutes
  showTradingOverlays: boolean; // NEW - toggle for showing trading overlays
}

/**
 * Chart viewer configuration
 */
export interface ChartViewerConfig {
  ticker: string;
  timeframe: string;
  indicators: string[];
  showAnnotations: boolean;
  annotationLevels: KeyLevel[];
  showTradingOverlays?: boolean; // NEW
  tradingAnnotations?: TradingAnnotation[]; // NEW
}

/**
 * Chart annotation for displaying key levels
 */
export interface ChartAnnotation {
  id: string;
  price: number;
  type: 'support' | 'resistance' | 'pivot';
  color: string;
  label: string;
  visible: boolean;
}