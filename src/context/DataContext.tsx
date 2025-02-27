import * as React from 'react';
import { 
  TradeData, 
  AccountSummary, 
  TokenPerformance, 
  DataState,
  FilterOptions
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
  TOGGLE_DARK_MODE = 'TOGGLE_DARK_MODE'
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

// Union of all action types
type DataAction = 
  | ImportDataStartAction
  | ImportDataSuccessAction
  | ImportDataErrorAction
  | SetFilteredDataAction
  | UpdateFiltersAction
  | ResetFiltersAction
  | SetActiveTabAction
  | ToggleDarkModeAction;

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
          : state.tradeType
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