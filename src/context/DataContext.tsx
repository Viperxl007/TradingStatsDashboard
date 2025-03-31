import * as React from 'react';
import {
  TradeData,
  AccountSummary,
  TokenPerformance,
  DataState,
  FilterOptions,
  OptionsAnalysisResult,
  EarningsCalendarItem
} from '../types';
import { 
  calculateAccountSummary, 
  analyzeTokenPerformance, 
  identifyTrendingTokens, 
  identifyUnderperformingTokens,
  filterTrades
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
  CLEAR_OPTIONS_DATA = 'CLEAR_OPTIONS_DATA'
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
  | ClearOptionsDataAction;

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
      
      const filteredData = filterTrades(
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