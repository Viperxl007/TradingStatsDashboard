import * as React from 'react';
import {
  TradeData,
  AccountSummary,
  TokenPerformance,
  DataState,
  FilterOptions,
  OptionsAnalysisResult,
  EarningsCalendarItem,
  TradeTrackerState
} from '../types';
import {
  AnyTradeEntry,
  TradeFilterOptions,
  TradeStatistics
} from '../types/tradeTracker';
import {
  ChartAnalysisState,
  ChartAnalysisResult,
  HistoricalAnalysis,
  AnalysisContext
} from '../types/chartAnalysis';
import {
  calculateAccountSummary,
  analyzeTokenPerformance,
  identifyTrendingTokens,
  identifyUnderperformingTokens,
  filterTrades as filterTradesUtil
} from '../services/dataProcessing';

// Define action types
export enum ActionType {
  IMPORT_DATA_START = 'IMPORT_DATA_START',
  IMPORT_DATA_SUCCESS = 'IMPORT_DATA_SUCCESS',
  IMPORT_DATA_ERROR = 'IMPORT_DATA_ERROR',
  SET_FILTERED_DATA = 'SET_FILTERED_DATA',
  UPDATE_FILTERS = 'UPDATE_FILTERS',
  RESET_FILTERS = 'RESET_FILTERS',
  SET_ACTIVE_TAB = 'SET_ACTIVE_TAB',
  TOGGLE_DARK_MODE = 'TOGGLE_DARK_MODE',
  
  // Options actions
  ANALYZE_OPTIONS_START = 'ANALYZE_OPTIONS_START',
  ANALYZE_OPTIONS_SUCCESS = 'ANALYZE_OPTIONS_SUCCESS',
  ANALYZE_OPTIONS_ERROR = 'ANALYZE_OPTIONS_ERROR',
  SCAN_EARNINGS_START = 'SCAN_EARNINGS_START',
  SCAN_EARNINGS_SUCCESS = 'SCAN_EARNINGS_SUCCESS',
  SCAN_EARNINGS_ERROR = 'SCAN_EARNINGS_ERROR',
  FETCH_EARNINGS_CALENDAR_START = 'FETCH_EARNINGS_CALENDAR_START',
  FETCH_EARNINGS_CALENDAR_SUCCESS = 'FETCH_EARNINGS_CALENDAR_SUCCESS',
  FETCH_EARNINGS_CALENDAR_ERROR = 'FETCH_EARNINGS_CALENDAR_ERROR',
  CLEAR_OPTIONS_DATA = 'CLEAR_OPTIONS_DATA',
  
  // Trade Tracker actions
  LOAD_TRADES_START = 'LOAD_TRADES_START',
  LOAD_TRADES_SUCCESS = 'LOAD_TRADES_SUCCESS',
  LOAD_TRADES_ERROR = 'LOAD_TRADES_ERROR',
  CREATE_TRADE_START = 'CREATE_TRADE_START',
  CREATE_TRADE_SUCCESS = 'CREATE_TRADE_SUCCESS',
  CREATE_TRADE_ERROR = 'CREATE_TRADE_ERROR',
  UPDATE_TRADE_START = 'UPDATE_TRADE_START',
  UPDATE_TRADE_SUCCESS = 'UPDATE_TRADE_SUCCESS',
  UPDATE_TRADE_ERROR = 'UPDATE_TRADE_ERROR',
  DELETE_TRADE_START = 'DELETE_TRADE_START',
  DELETE_TRADE_SUCCESS = 'DELETE_TRADE_SUCCESS',
  DELETE_TRADE_ERROR = 'DELETE_TRADE_ERROR',
  FILTER_TRADES = 'FILTER_TRADES',
  SELECT_TRADE = 'SELECT_TRADE',
  CALCULATE_TRADE_STATISTICS = 'CALCULATE_TRADE_STATISTICS',
  IMPORT_TRADES_START = 'IMPORT_TRADES_START',
  IMPORT_TRADES_SUCCESS = 'IMPORT_TRADES_SUCCESS',
  IMPORT_TRADES_ERROR = 'IMPORT_TRADES_ERROR',
  EXPORT_TRADES_START = 'EXPORT_TRADES_START',
  EXPORT_TRADES_SUCCESS = 'EXPORT_TRADES_SUCCESS',
  EXPORT_TRADES_ERROR = 'EXPORT_TRADES_ERROR',
  CLEAR_TRADE_TRACKER_DATA = 'CLEAR_TRADE_TRACKER_DATA',
  
  // Chart Analysis actions
  ANALYZE_CHART_START = 'ANALYZE_CHART_START',
  ANALYZE_CHART_SUCCESS = 'ANALYZE_CHART_SUCCESS',
  ANALYZE_CHART_ERROR = 'ANALYZE_CHART_ERROR',
  LOAD_ANALYSIS_HISTORY_START = 'LOAD_ANALYSIS_HISTORY_START',
  LOAD_ANALYSIS_HISTORY_SUCCESS = 'LOAD_ANALYSIS_HISTORY_SUCCESS',
  LOAD_ANALYSIS_HISTORY_ERROR = 'LOAD_ANALYSIS_HISTORY_ERROR',
  SET_SELECTED_TICKER = 'SET_SELECTED_TICKER',
  SET_CHART_SCREENSHOT = 'SET_CHART_SCREENSHOT',
  SET_ANALYSIS_CONTEXT = 'SET_ANALYSIS_CONTEXT',
  CAPTURE_CHART_START = 'CAPTURE_CHART_START',
  CAPTURE_CHART_SUCCESS = 'CAPTURE_CHART_SUCCESS',
  CAPTURE_CHART_ERROR = 'CAPTURE_CHART_ERROR',
  CLEAR_CHART_ANALYSIS_DATA = 'CLEAR_CHART_ANALYSIS_DATA',
  CLEAR_CHART_OVERLAYS = 'CLEAR_CHART_OVERLAYS',
  UPDATE_CHART_ANALYSIS_SETTINGS = 'UPDATE_CHART_ANALYSIS_SETTINGS',
  UPDATE_TRADING_RECOMMENDATIONS = 'UPDATE_TRADING_RECOMMENDATIONS'
}

// Define action interfaces
interface ImportDataStartAction {
  type: ActionType.IMPORT_DATA_START;
}

interface ImportDataSuccessAction {
  type: ActionType.IMPORT_DATA_SUCCESS;
  payload: TradeData[];
}

interface ImportDataErrorAction {
  type: ActionType.IMPORT_DATA_ERROR;
  payload: string;
}

interface SetFilteredDataAction {
  type: ActionType.SET_FILTERED_DATA;
  payload: TradeData[];
}

interface UpdateFiltersAction {
  type: ActionType.UPDATE_FILTERS;
  payload: Partial<FilterOptions>;
}

interface ResetFiltersAction {
  type: ActionType.RESET_FILTERS;
}

interface SetActiveTabAction {
  type: ActionType.SET_ACTIVE_TAB;
  payload: string;
}

interface ToggleDarkModeAction {
  type: ActionType.TOGGLE_DARK_MODE;
}

// Options action interfaces
interface AnalyzeOptionsStartAction {
  type: ActionType.ANALYZE_OPTIONS_START;
  payload: string; // ticker
}

interface AnalyzeOptionsSuccessAction {
  type: ActionType.ANALYZE_OPTIONS_SUCCESS;
  payload: OptionsAnalysisResult;
}

interface AnalyzeOptionsErrorAction {
  type: ActionType.ANALYZE_OPTIONS_ERROR;
  payload: string; // error message
}

interface ScanEarningsStartAction {
  type: ActionType.SCAN_EARNINGS_START;
  payload?: string; // optional date
}

interface ScanEarningsSuccessAction {
  type: ActionType.SCAN_EARNINGS_SUCCESS;
  payload: OptionsAnalysisResult[];
}

interface ScanEarningsErrorAction {
  type: ActionType.SCAN_EARNINGS_ERROR;
  payload: string; // error message
}

interface FetchEarningsCalendarStartAction {
  type: ActionType.FETCH_EARNINGS_CALENDAR_START;
  payload?: string; // optional date
}

interface FetchEarningsCalendarSuccessAction {
  type: ActionType.FETCH_EARNINGS_CALENDAR_SUCCESS;
  payload: EarningsCalendarItem[];
}

interface FetchEarningsCalendarErrorAction {
  type: ActionType.FETCH_EARNINGS_CALENDAR_ERROR;
  payload: string; // error message
}

interface ClearOptionsDataAction {
  type: ActionType.CLEAR_OPTIONS_DATA;
}

// Trade Tracker action interfaces
interface LoadTradesStartAction {
  type: ActionType.LOAD_TRADES_START;
}

interface LoadTradesSuccessAction {
  type: ActionType.LOAD_TRADES_SUCCESS;
  payload: AnyTradeEntry[];
}

interface LoadTradesErrorAction {
  type: ActionType.LOAD_TRADES_ERROR;
  payload: string;
}

interface CreateTradeStartAction {
  type: ActionType.CREATE_TRADE_START;
  payload: AnyTradeEntry;
}

interface CreateTradeSuccessAction {
  type: ActionType.CREATE_TRADE_SUCCESS;
  payload: AnyTradeEntry;
}

interface CreateTradeErrorAction {
  type: ActionType.CREATE_TRADE_ERROR;
  payload: string;
}

interface UpdateTradeStartAction {
  type: ActionType.UPDATE_TRADE_START;
  payload: AnyTradeEntry;
}

interface UpdateTradeSuccessAction {
  type: ActionType.UPDATE_TRADE_SUCCESS;
  payload: AnyTradeEntry;
}

interface UpdateTradeErrorAction {
  type: ActionType.UPDATE_TRADE_ERROR;
  payload: string;
}

interface DeleteTradeStartAction {
  type: ActionType.DELETE_TRADE_START;
  payload: string; // trade ID
}

interface DeleteTradeSuccessAction {
  type: ActionType.DELETE_TRADE_SUCCESS;
  payload: string; // trade ID
}

interface DeleteTradeErrorAction {
  type: ActionType.DELETE_TRADE_ERROR;
  payload: string;
}

interface FilterTradesAction {
  type: ActionType.FILTER_TRADES;
  payload: TradeFilterOptions;
}

interface SelectTradeAction {
  type: ActionType.SELECT_TRADE;
  payload: string | null; // trade ID
}

interface CalculateTradeStatisticsAction {
  type: ActionType.CALCULATE_TRADE_STATISTICS;
  payload: TradeStatistics;
}

interface ImportTradesStartAction {
  type: ActionType.IMPORT_TRADES_START;
  payload: AnyTradeEntry[];
}

interface ImportTradesSuccessAction {
  type: ActionType.IMPORT_TRADES_SUCCESS;
  payload: number; // number of trades imported
}

interface ImportTradesErrorAction {
  type: ActionType.IMPORT_TRADES_ERROR;
  payload: string;
}

interface ExportTradesStartAction {
  type: ActionType.EXPORT_TRADES_START;
}

interface ExportTradesSuccessAction {
  type: ActionType.EXPORT_TRADES_SUCCESS;
  payload: AnyTradeEntry[];
}

interface ExportTradesErrorAction {
  type: ActionType.EXPORT_TRADES_ERROR;
  payload: string;
}

interface ClearTradeTrackerDataAction {
  type: ActionType.CLEAR_TRADE_TRACKER_DATA;
}

// Chart Analysis action interfaces
interface AnalyzeChartStartAction {
  type: ActionType.ANALYZE_CHART_START;
  payload: string; // ticker
}

interface AnalyzeChartSuccessAction {
  type: ActionType.ANALYZE_CHART_SUCCESS;
  payload: ChartAnalysisResult;
}

interface AnalyzeChartErrorAction {
  type: ActionType.ANALYZE_CHART_ERROR;
  payload: string; // error message
}

interface LoadAnalysisHistoryStartAction {
  type: ActionType.LOAD_ANALYSIS_HISTORY_START;
  payload: string; // ticker
}

interface LoadAnalysisHistorySuccessAction {
  type: ActionType.LOAD_ANALYSIS_HISTORY_SUCCESS;
  payload: HistoricalAnalysis[];
}

interface LoadAnalysisHistoryErrorAction {
  type: ActionType.LOAD_ANALYSIS_HISTORY_ERROR;
  payload: string; // error message
}

interface SetSelectedTickerAction {
  type: ActionType.SET_SELECTED_TICKER;
  payload: string; // ticker
}

interface SetChartScreenshotAction {
  type: ActionType.SET_CHART_SCREENSHOT;
  payload: string | null; // base64 image data
}

interface SetAnalysisContextAction {
  type: ActionType.SET_ANALYSIS_CONTEXT;
  payload: AnalysisContext | null;
}

interface CaptureChartStartAction {
  type: ActionType.CAPTURE_CHART_START;
}

interface CaptureChartSuccessAction {
  type: ActionType.CAPTURE_CHART_SUCCESS;
  payload: string; // base64 image data
}

interface CaptureChartErrorAction {
  type: ActionType.CAPTURE_CHART_ERROR;
  payload: string; // error message
}

interface ClearChartAnalysisDataAction {
  type: ActionType.CLEAR_CHART_ANALYSIS_DATA;
}

interface ClearChartOverlaysAction {
  type: ActionType.CLEAR_CHART_OVERLAYS;
}

interface UpdateChartAnalysisSettingsAction {
  type: ActionType.UPDATE_CHART_ANALYSIS_SETTINGS;
  payload: Partial<Pick<ChartAnalysisState, 'autoAnalysis' | 'analysisInterval'>>;
}

interface UpdateTradingRecommendationsAction {
  type: ActionType.UPDATE_TRADING_RECOMMENDATIONS;
  payload: Map<string, import('../types/chartAnalysis').TradingRecommendationOverlay>;
}

// Union of all action types
type DataAction =
  | ImportDataStartAction
  | ImportDataSuccessAction
  | ImportDataErrorAction
  | SetFilteredDataAction
  | UpdateFiltersAction
  | ResetFiltersAction
  | SetActiveTabAction
  | ToggleDarkModeAction
  | AnalyzeOptionsStartAction
  | AnalyzeOptionsSuccessAction
  | AnalyzeOptionsErrorAction
  | ScanEarningsStartAction
  | ScanEarningsSuccessAction
  | ScanEarningsErrorAction
  | FetchEarningsCalendarStartAction
  | FetchEarningsCalendarSuccessAction
  | FetchEarningsCalendarErrorAction
  | ClearOptionsDataAction
  // Trade Tracker actions
  | LoadTradesStartAction
  | LoadTradesSuccessAction
  | LoadTradesErrorAction
  | CreateTradeStartAction
  | CreateTradeSuccessAction
  | CreateTradeErrorAction
  | UpdateTradeStartAction
  | UpdateTradeSuccessAction
  | UpdateTradeErrorAction
  | DeleteTradeStartAction
  | DeleteTradeSuccessAction
  | DeleteTradeErrorAction
  | FilterTradesAction
  | SelectTradeAction
  | CalculateTradeStatisticsAction
  | ImportTradesStartAction
  | ImportTradesSuccessAction
  | ImportTradesErrorAction
  | ExportTradesStartAction
  | ExportTradesSuccessAction
  | ExportTradesErrorAction
  | ClearTradeTrackerDataAction
  // Chart Analysis actions
  | AnalyzeChartStartAction
  | AnalyzeChartSuccessAction
  | AnalyzeChartErrorAction
  | LoadAnalysisHistoryStartAction
  | LoadAnalysisHistorySuccessAction
  | LoadAnalysisHistoryErrorAction
  | SetSelectedTickerAction
  | SetChartScreenshotAction
  | SetAnalysisContextAction
  | CaptureChartStartAction
  | CaptureChartSuccessAction
  | CaptureChartErrorAction
  | ClearChartAnalysisDataAction
  | ClearChartOverlaysAction
  | UpdateChartAnalysisSettingsAction
  | UpdateTradingRecommendationsAction;

// Initial state
const initialState: DataState = {
  rawData: [],
  filteredData: [],
  accountSummary: {
    totalTrades: 0,
    uniqueTokens: 0,
    totalProfitLoss: 0,
    averageProfitLoss: 0,
    winRate: 0,
    bestPerformingToken: '',
    worstPerformingToken: '',
    mostTradedToken: '',
    averageTradesPerDay: 0,
    totalFees: 0,
    netProfitLoss: 0,
    monthlyPerformance: []
  },
  tokenPerformance: [],
  trendingTokens: [],
  underperformingTokens: [],
  selectedTokens: [],
  dateRange: [null, null],
  tradeType: 'all',
  timeframe: 'all',
  
  // Options data
  optionsData: {
    analysisResult: null,
    scanResults: [],
    earningsCalendar: [],
    isLoading: false,
    error: null
  },
  
  // Trade Tracker data
  tradeTrackerData: {
    trades: [],
    filteredTrades: [],
    statistics: {
      totalTrades: 0,
      openTrades: 0,
      closedTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfitLoss: 0,
      averageProfit: 0,
      averageLoss: 0,
      largestProfit: 0,
      largestLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      sharpeRatio: 0,
      averageDuration: 0,
      byStrategy: {
        stock: { count: 0, winRate: 0, netProfitLoss: 0 },
        single_option: { count: 0, winRate: 0, netProfitLoss: 0 },
        vertical_spread: { count: 0, winRate: 0, netProfitLoss: 0 },
        iron_condor: { count: 0, winRate: 0, netProfitLoss: 0 },
        calendar_spread: { count: 0, winRate: 0, netProfitLoss: 0 },
        diagonal_spread: { count: 0, winRate: 0, netProfitLoss: 0 },
        covered_call: { count: 0, winRate: 0, netProfitLoss: 0 },
        protective_put: { count: 0, winRate: 0, netProfitLoss: 0 },
        straddle: { count: 0, winRate: 0, netProfitLoss: 0 },
        strangle: { count: 0, winRate: 0, netProfitLoss: 0 },
        butterfly: { count: 0, winRate: 0, netProfitLoss: 0 },
        custom: { count: 0, winRate: 0, netProfitLoss: 0 }
      },
      byTicker: {},
      byIvRvRatio: {
        high: { count: 0, winRate: 0, netProfitLoss: 0 },
        medium: { count: 0, winRate: 0, netProfitLoss: 0 },
        low: { count: 0, winRate: 0, netProfitLoss: 0 }
      },
      byTsSlope: {
        positive: { count: 0, winRate: 0, netProfitLoss: 0 },
        neutral: { count: 0, winRate: 0, netProfitLoss: 0 },
        negative: { count: 0, winRate: 0, netProfitLoss: 0 }
      }
    },
    filters: {
      tickers: [],
      dateRange: [null, null],
      status: [],
      strategies: [],
      tags: [],
      profitableOnly: false,
      searchText: ''
    },
    selectedTradeId: null,
    isLoading: false,
    error: null
  },
  
  // Chart Analysis data
  chartAnalysisData: {
    currentAnalysis: null,
    analysisHistory: [],
    selectedTicker: '',
    chartScreenshot: null,
    analysisContext: null,
    activeTradingRecommendations: new Map(),
    isAnalyzing: false,
    isLoadingHistory: false,
    isCapturingChart: false,
    error: null,
    autoAnalysis: false,
    analysisInterval: 30,
    showTradingOverlays: true
  },
  
  isLoading: false,
  error: null,
  activeTab: 'summary',
  isDarkMode: false
};

// Reducer function
const dataReducer = (state: DataState, action: DataAction): DataState => {
  switch (action.type) {
    case ActionType.IMPORT_DATA_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };
    
    case ActionType.IMPORT_DATA_SUCCESS: {
      const rawData = action.payload;
      const accountSummary = calculateAccountSummary(rawData);
      const tokenPerformance = analyzeTokenPerformance(rawData);
      const trendingTokens = identifyTrendingTokens(tokenPerformance);
      const underperformingTokens = identifyUnderperformingTokens(tokenPerformance);
      
      return {
        ...state,
        rawData,
        filteredData: rawData,
        accountSummary,
        tokenPerformance,
        trendingTokens,
        underperformingTokens,
        isLoading: false,
        error: null
      };
    }
    
    case ActionType.IMPORT_DATA_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };
    
    case ActionType.SET_FILTERED_DATA:
      return {
        ...state,
        filteredData: action.payload
      };
    
    case ActionType.UPDATE_FILTERS: {
      const newFilters = {
        selectedTokens: action.payload.selectedTokens !== undefined
          ? action.payload.selectedTokens
          : state.selectedTokens,
        dateRange: action.payload.dateRange !== undefined
          ? action.payload.dateRange
          : state.dateRange,
        tradeType: action.payload.tradeType !== undefined
          ? action.payload.tradeType
          : state.tradeType,
        timeframe: action.payload.timeframe !== undefined
          ? action.payload.timeframe
          : state.timeframe
      };
      
      const filteredData = filterTradesUtil(
        state.rawData,
        newFilters.selectedTokens,
        newFilters.dateRange,
        newFilters.tradeType
      );
      
      return {
        ...state,
        ...newFilters,
        filteredData
      };
    }
    case ActionType.RESET_FILTERS:
      return {
        ...state,
        selectedTokens: [],
        dateRange: [null, null],
        tradeType: 'all',
        timeframe: 'all',
        filteredData: state.rawData
      };
    
    case ActionType.SET_ACTIVE_TAB:
      return {
        ...state,
        activeTab: action.payload
      };
    
    case ActionType.TOGGLE_DARK_MODE:
      return {
        ...state,
        isDarkMode: !state.isDarkMode
      };
    
    // Options actions
    case ActionType.ANALYZE_OPTIONS_START:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.ANALYZE_OPTIONS_SUCCESS:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          analysisResult: action.payload,
          isLoading: false,
          error: null
        }
      };
    
    case ActionType.ANALYZE_OPTIONS_ERROR:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.SCAN_EARNINGS_START:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.SCAN_EARNINGS_SUCCESS:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          scanResults: action.payload,
          isLoading: false,
          error: null
        }
      };
    
    case ActionType.SCAN_EARNINGS_ERROR:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.FETCH_EARNINGS_CALENDAR_START:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.FETCH_EARNINGS_CALENDAR_SUCCESS:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          earningsCalendar: action.payload,
          isLoading: false,
          error: null
        }
      };
    
    case ActionType.FETCH_EARNINGS_CALENDAR_ERROR:
      return {
        ...state,
        optionsData: {
          ...state.optionsData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.CLEAR_OPTIONS_DATA:
      return {
        ...state,
        optionsData: {
          analysisResult: null,
          scanResults: [],
          earningsCalendar: [],
          isLoading: false,
          error: null
        }
      };
    
    // Trade Tracker actions
    case ActionType.LOAD_TRADES_START:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.LOAD_TRADES_SUCCESS:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          trades: action.payload,
          filteredTrades: action.payload,
          isLoading: false,
          error: null
        }
      };
    
    case ActionType.LOAD_TRADES_ERROR:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.CREATE_TRADE_START:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.CREATE_TRADE_SUCCESS:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          trades: [...state.tradeTrackerData.trades, action.payload],
          filteredTrades: [...state.tradeTrackerData.filteredTrades, action.payload],
          isLoading: false,
          error: null
        }
      };
    
    case ActionType.CREATE_TRADE_ERROR:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.UPDATE_TRADE_START:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.UPDATE_TRADE_SUCCESS: {
      const updatedTrades = state.tradeTrackerData.trades.map(trade => 
        trade.id === action.payload.id ? action.payload : trade
      );
      
      const updatedFilteredTrades = state.tradeTrackerData.filteredTrades.map(trade => 
        trade.id === action.payload.id ? action.payload : trade
      );
      
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          trades: updatedTrades,
          filteredTrades: updatedFilteredTrades,
          isLoading: false,
          error: null
        }
      };
    }
    
    case ActionType.UPDATE_TRADE_ERROR:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.DELETE_TRADE_START:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: true,
          error: null
        }
      };
    
    case ActionType.DELETE_TRADE_SUCCESS: {
      const filteredTrades = state.tradeTrackerData.trades.filter(trade => 
        trade.id !== action.payload
      );
      
      const filteredFilteredTrades = state.tradeTrackerData.filteredTrades.filter(trade => 
        trade.id !== action.payload
      );
      
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          trades: filteredTrades,
          filteredTrades: filteredFilteredTrades,
          selectedTradeId: state.tradeTrackerData.selectedTradeId === action.payload ? null : state.tradeTrackerData.selectedTradeId,
          isLoading: false,
          error: null
        }
      };
    }
    
    case ActionType.DELETE_TRADE_ERROR:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          isLoading: false,
          error: action.payload
        }
      };
    
    case ActionType.FILTER_TRADES: {
      const filters = action.payload;
      
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          filters,
          isLoading: false,
          error: null
        }
      };
    }
    
    case ActionType.SELECT_TRADE:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          selectedTradeId: action.payload
        }
      };
    
    case ActionType.CALCULATE_TRADE_STATISTICS:
      return {
        ...state,
        tradeTrackerData: {
          ...state.tradeTrackerData,
          statistics: action.payload
        }
      };
    
    case ActionType.CLEAR_TRADE_TRACKER_DATA:
      return {
        ...state,
        tradeTrackerData: {
          ...initialState.tradeTrackerData
        }
      };
    
    // Chart Analysis actions
    case ActionType.ANALYZE_CHART_START:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          isAnalyzing: true,
          error: null
        }
      };
    
    case ActionType.ANALYZE_CHART_SUCCESS:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          currentAnalysis: action.payload,
          isAnalyzing: false,
          error: null
        }
      };
    
    case ActionType.ANALYZE_CHART_ERROR:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          isAnalyzing: false,
          error: action.payload
        }
      };
    
    case ActionType.LOAD_ANALYSIS_HISTORY_START:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          isLoadingHistory: true,
          error: null
        }
      };
    
    case ActionType.LOAD_ANALYSIS_HISTORY_SUCCESS:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          analysisHistory: action.payload,
          isLoadingHistory: false,
          error: null
        }
      };
    
    case ActionType.LOAD_ANALYSIS_HISTORY_ERROR:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          isLoadingHistory: false,
          error: action.payload
        }
      };
    
    case ActionType.SET_SELECTED_TICKER:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          selectedTicker: action.payload
        }
      };
    
    case ActionType.SET_CHART_SCREENSHOT:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          chartScreenshot: action.payload
        }
      };
    
    case ActionType.SET_ANALYSIS_CONTEXT:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          analysisContext: action.payload
        }
      };
    
    case ActionType.CAPTURE_CHART_START:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          isCapturingChart: true,
          error: null
        }
      };
    
    case ActionType.CAPTURE_CHART_SUCCESS:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          chartScreenshot: action.payload,
          isCapturingChart: false,
          error: null
        }
      };
    
    case ActionType.CAPTURE_CHART_ERROR:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          isCapturingChart: false,
          error: action.payload
        }
      };
    
    case ActionType.CLEAR_CHART_ANALYSIS_DATA:
      return {
        ...state,
        chartAnalysisData: {
          ...initialState.chartAnalysisData
        }
      };
    
    case ActionType.CLEAR_CHART_OVERLAYS:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          currentAnalysis: null,
          chartScreenshot: null,
          analysisContext: null,
          activeTradingRecommendations: new Map(),
          error: null
          // Keep selectedTicker, analysisHistory, and other settings intact
        }
      };
    
    case ActionType.UPDATE_CHART_ANALYSIS_SETTINGS:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          ...action.payload
        }
      };
    
    case ActionType.UPDATE_TRADING_RECOMMENDATIONS:
      return {
        ...state,
        chartAnalysisData: {
          ...state.chartAnalysisData,
          activeTradingRecommendations: action.payload
        }
      };
    
    default:
      return state;
  }
};

// Create context
interface DataContextType {
  state: DataState;
  dispatch: React.Dispatch<DataAction>;
}

const DataContext = React.createContext<DataContextType | undefined>(undefined);

// Provider component
interface DataProviderProps {
  children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [state, dispatch] = React.useReducer(dataReducer, initialState);
  
  return (
    <DataContext.Provider value={{ state, dispatch }}>
      {children}
    </DataContext.Provider>
  );
};

// Custom hook for using the context
export const useData = (): DataContextType => {
  const context = React.useContext(DataContext);
  
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  
  return context;
};

// Action creators
export const importDataStart = (): ImportDataStartAction => ({
  type: ActionType.IMPORT_DATA_START
});

export const importDataSuccess = (data: TradeData[]): ImportDataSuccessAction => ({
  type: ActionType.IMPORT_DATA_SUCCESS,
  payload: data
});

export const importDataError = (error: string): ImportDataErrorAction => ({
  type: ActionType.IMPORT_DATA_ERROR,
  payload: error
});

export const updateFilters = (filters: Partial<FilterOptions>): UpdateFiltersAction => ({
  type: ActionType.UPDATE_FILTERS,
  payload: filters
});

export const resetFilters = (): ResetFiltersAction => ({
  type: ActionType.RESET_FILTERS
});

export const setActiveTab = (tab: string): SetActiveTabAction => ({
  type: ActionType.SET_ACTIVE_TAB,
  payload: tab
});

export const toggleDarkMode = (): ToggleDarkModeAction => ({
  type: ActionType.TOGGLE_DARK_MODE
});

// Options action creators
export const analyzeOptionsStart = (ticker: string): AnalyzeOptionsStartAction => ({
  type: ActionType.ANALYZE_OPTIONS_START,
  payload: ticker
});

export const analyzeOptionsSuccess = (result: OptionsAnalysisResult): AnalyzeOptionsSuccessAction => ({
  type: ActionType.ANALYZE_OPTIONS_SUCCESS,
  payload: result
});

export const analyzeOptionsError = (error: string): AnalyzeOptionsErrorAction => ({
  type: ActionType.ANALYZE_OPTIONS_ERROR,
  payload: error
});

export const scanEarningsStart = (date?: string): ScanEarningsStartAction => ({
  type: ActionType.SCAN_EARNINGS_START,
  payload: date
});

export const scanEarningsSuccess = (results: OptionsAnalysisResult[]): ScanEarningsSuccessAction => ({
  type: ActionType.SCAN_EARNINGS_SUCCESS,
  payload: results
});

export const scanEarningsError = (error: string): ScanEarningsErrorAction => ({
  type: ActionType.SCAN_EARNINGS_ERROR,
  payload: error
});

export const fetchEarningsCalendarStart = (date?: string): FetchEarningsCalendarStartAction => ({
  type: ActionType.FETCH_EARNINGS_CALENDAR_START,
  payload: date
});

export const fetchEarningsCalendarSuccess = (calendar: EarningsCalendarItem[]): FetchEarningsCalendarSuccessAction => ({
  type: ActionType.FETCH_EARNINGS_CALENDAR_SUCCESS,
  payload: calendar
});

export const fetchEarningsCalendarError = (error: string): FetchEarningsCalendarErrorAction => ({
  type: ActionType.FETCH_EARNINGS_CALENDAR_ERROR,
  payload: error
});

export const clearOptionsData = (): ClearOptionsDataAction => ({
  type: ActionType.CLEAR_OPTIONS_DATA
});

// Trade Tracker action creators
export const loadTradesStart = (): LoadTradesStartAction => ({
  type: ActionType.LOAD_TRADES_START
});

export const loadTradesSuccess = (trades: AnyTradeEntry[]): LoadTradesSuccessAction => ({
  type: ActionType.LOAD_TRADES_SUCCESS,
  payload: trades
});

export const loadTradesError = (error: string): LoadTradesErrorAction => ({
  type: ActionType.LOAD_TRADES_ERROR,
  payload: error
});

export const createTradeStart = (trade: AnyTradeEntry): CreateTradeStartAction => ({
  type: ActionType.CREATE_TRADE_START,
  payload: trade
});

export const createTradeSuccess = (trade: AnyTradeEntry): CreateTradeSuccessAction => ({
  type: ActionType.CREATE_TRADE_SUCCESS,
  payload: trade
});

export const createTradeError = (error: string): CreateTradeErrorAction => ({
  type: ActionType.CREATE_TRADE_ERROR,
  payload: error
});

export const updateTradeStart = (trade: AnyTradeEntry): UpdateTradeStartAction => ({
  type: ActionType.UPDATE_TRADE_START,
  payload: trade
});

export const updateTradeSuccess = (trade: AnyTradeEntry): UpdateTradeSuccessAction => ({
  type: ActionType.UPDATE_TRADE_SUCCESS,
  payload: trade
});

export const updateTradeError = (error: string): UpdateTradeErrorAction => ({
  type: ActionType.UPDATE_TRADE_ERROR,
  payload: error
});

export const deleteTradeStart = (id: string): DeleteTradeStartAction => ({
  type: ActionType.DELETE_TRADE_START,
  payload: id
});

export const deleteTradeSuccess = (id: string): DeleteTradeSuccessAction => ({
  type: ActionType.DELETE_TRADE_SUCCESS,
  payload: id
});

export const deleteTradeError = (error: string): DeleteTradeErrorAction => ({
  type: ActionType.DELETE_TRADE_ERROR,
  payload: error
});

export const filterTradesAction = (filters: TradeFilterOptions): FilterTradesAction => ({
  type: ActionType.FILTER_TRADES,
  payload: filters
});

export const selectTrade = (id: string | null): SelectTradeAction => ({
  type: ActionType.SELECT_TRADE,
  payload: id
});

export const calculateTradeStatistics = (statistics: TradeStatistics): CalculateTradeStatisticsAction => ({
  type: ActionType.CALCULATE_TRADE_STATISTICS,
  payload: statistics
});

export const clearTradeTrackerData = (): ClearTradeTrackerDataAction => ({
  type: ActionType.CLEAR_TRADE_TRACKER_DATA
});

// Chart Analysis action creators
export const analyzeChartStart = (ticker: string): AnalyzeChartStartAction => ({
  type: ActionType.ANALYZE_CHART_START,
  payload: ticker
});

export const analyzeChartSuccess = (result: ChartAnalysisResult): AnalyzeChartSuccessAction => ({
  type: ActionType.ANALYZE_CHART_SUCCESS,
  payload: result
});

export const analyzeChartError = (error: string): AnalyzeChartErrorAction => ({
  type: ActionType.ANALYZE_CHART_ERROR,
  payload: error
});

export const loadAnalysisHistoryStart = (ticker: string): LoadAnalysisHistoryStartAction => ({
  type: ActionType.LOAD_ANALYSIS_HISTORY_START,
  payload: ticker
});

export const loadAnalysisHistorySuccess = (history: HistoricalAnalysis[]): LoadAnalysisHistorySuccessAction => ({
  type: ActionType.LOAD_ANALYSIS_HISTORY_SUCCESS,
  payload: history
});

export const loadAnalysisHistoryError = (error: string): LoadAnalysisHistoryErrorAction => ({
  type: ActionType.LOAD_ANALYSIS_HISTORY_ERROR,
  payload: error
});

export const setSelectedTicker = (ticker: string): SetSelectedTickerAction => ({
  type: ActionType.SET_SELECTED_TICKER,
  payload: ticker
});

export const setChartScreenshot = (screenshot: string | null): SetChartScreenshotAction => ({
  type: ActionType.SET_CHART_SCREENSHOT,
  payload: screenshot
});

export const setAnalysisContext = (context: AnalysisContext | null): SetAnalysisContextAction => ({
  type: ActionType.SET_ANALYSIS_CONTEXT,
  payload: context
});

export const captureChartStart = (): CaptureChartStartAction => ({
  type: ActionType.CAPTURE_CHART_START
});

export const captureChartSuccess = (screenshot: string): CaptureChartSuccessAction => ({
  type: ActionType.CAPTURE_CHART_SUCCESS,
  payload: screenshot
});

export const captureChartError = (error: string): CaptureChartErrorAction => ({
  type: ActionType.CAPTURE_CHART_ERROR,
  payload: error
});

export const clearChartAnalysisData = (): ClearChartAnalysisDataAction => ({
  type: ActionType.CLEAR_CHART_ANALYSIS_DATA
});

export const clearChartOverlays = (): ClearChartOverlaysAction => ({
  type: ActionType.CLEAR_CHART_OVERLAYS
});

export const updateChartAnalysisSettings = (settings: Partial<Pick<ChartAnalysisState, 'autoAnalysis' | 'analysisInterval'>>): UpdateChartAnalysisSettingsAction => ({
  type: ActionType.UPDATE_CHART_ANALYSIS_SETTINGS,
  payload: settings
});