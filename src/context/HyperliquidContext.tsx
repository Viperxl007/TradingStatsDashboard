import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Types for Hyperliquid data
export interface HyperliquidAccount {
  wallet_address: string;
  account_type: 'personal_wallet' | 'trading_vault';
  display_name: string;
}

export interface HyperliquidTrade {
  id: string;
  account_type: string;
  wallet_address: string;
  trade_id: string;
  coin: string;
  side: string;
  px: number;
  sz: number;
  time: number;
  start_position?: number;
  dir?: string;
  closed_pnl?: number;
  hash?: string;
  oid?: number;
  crossed?: boolean;
  fee?: number;
  liquidation_markup?: number;
  raw_data?: any;
  created_at: number;
  updated_at: number;
}

export interface HyperliquidPortfolioSnapshot {
  id: string;
  account_type: string;
  wallet_address: string;
  snapshot_time: number;
  account_value: number;
  total_ntl_pos?: number;
  total_raw_usd?: number;
  margin_summary?: any;
  positions?: any;
  raw_data?: any;
  created_at: number;
}

export interface HyperliquidStatistics {
  total_trades: number;
  unique_coins: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  total_fees: number;
  net_pnl: number;
  avg_pnl: number;
}

export interface HyperliquidSummary {
  account_info: {
    wallet_address: string;
    account_type: string;
    display_name: string;
  };
  trade_statistics: HyperliquidStatistics;
  current_portfolio: {
    account_value: number;
    snapshot_time?: number;
  };
  recent_activity: {
    recent_trades_count: number;
    last_trade_time?: number;
  };
}

export interface HyperliquidPerformanceData {
  trades_over_time: Array<{
    date: string;
    count: number;
    pnl: number;
  }>;
  pnl_over_time: Array<{
    date: string;
    cumulative_pnl: number;
  }>;
  account_value_over_time: Array<{
    date: string;
    value: number;
  }>;
  coin_performance: Record<string, {
    total_trades: number;
    total_pnl: number;
    total_volume: number;
  }>;
}

export interface HyperliquidState {
  // Account management
  accounts: HyperliquidAccount[];
  selectedAccount: HyperliquidAccount | null;
  
  // Data
  trades: HyperliquidTrade[];
  portfolioSnapshots: HyperliquidPortfolioSnapshot[];
  summary: HyperliquidSummary | null;
  performanceData: HyperliquidPerformanceData | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  lastSyncTime: number | null;
  
  // Sync status
  syncInProgress: boolean;
  syncError: string | null;
}

// Action types
export enum HyperliquidActionType {
  // Account actions
  SET_ACCOUNTS = 'SET_ACCOUNTS',
  SELECT_ACCOUNT = 'SELECT_ACCOUNT',
  
  // Data loading actions
  LOAD_DATA_START = 'LOAD_DATA_START',
  LOAD_DATA_SUCCESS = 'LOAD_DATA_SUCCESS',
  LOAD_DATA_ERROR = 'LOAD_DATA_ERROR',
  
  // Specific data actions
  SET_TRADES = 'SET_TRADES',
  SET_PORTFOLIO_SNAPSHOTS = 'SET_PORTFOLIO_SNAPSHOTS',
  SET_SUMMARY = 'SET_SUMMARY',
  SET_PERFORMANCE_DATA = 'SET_PERFORMANCE_DATA',
  
  // Sync actions
  SYNC_START = 'SYNC_START',
  SYNC_SUCCESS = 'SYNC_SUCCESS',
  SYNC_ERROR = 'SYNC_ERROR',
  
  // UI actions
  CLEAR_ERROR = 'CLEAR_ERROR',
  SET_LAST_SYNC_TIME = 'SET_LAST_SYNC_TIME'
}

// Action interfaces
interface SetAccountsAction {
  type: HyperliquidActionType.SET_ACCOUNTS;
  payload: HyperliquidAccount[];
}

interface SelectAccountAction {
  type: HyperliquidActionType.SELECT_ACCOUNT;
  payload: HyperliquidAccount | null;
}

interface LoadDataStartAction {
  type: HyperliquidActionType.LOAD_DATA_START;
}

interface LoadDataSuccessAction {
  type: HyperliquidActionType.LOAD_DATA_SUCCESS;
}

interface LoadDataErrorAction {
  type: HyperliquidActionType.LOAD_DATA_ERROR;
  payload: string;
}

interface SetTradesAction {
  type: HyperliquidActionType.SET_TRADES;
  payload: HyperliquidTrade[];
}

interface SetPortfolioSnapshotsAction {
  type: HyperliquidActionType.SET_PORTFOLIO_SNAPSHOTS;
  payload: HyperliquidPortfolioSnapshot[];
}

interface SetSummaryAction {
  type: HyperliquidActionType.SET_SUMMARY;
  payload: HyperliquidSummary;
}

interface SetPerformanceDataAction {
  type: HyperliquidActionType.SET_PERFORMANCE_DATA;
  payload: HyperliquidPerformanceData;
}

interface SyncStartAction {
  type: HyperliquidActionType.SYNC_START;
}

interface SyncSuccessAction {
  type: HyperliquidActionType.SYNC_SUCCESS;
}

interface SyncErrorAction {
  type: HyperliquidActionType.SYNC_ERROR;
  payload: string;
}

interface ClearErrorAction {
  type: HyperliquidActionType.CLEAR_ERROR;
}

interface SetLastSyncTimeAction {
  type: HyperliquidActionType.SET_LAST_SYNC_TIME;
  payload: number;
}

type HyperliquidAction =
  | SetAccountsAction
  | SelectAccountAction
  | LoadDataStartAction
  | LoadDataSuccessAction
  | LoadDataErrorAction
  | SetTradesAction
  | SetPortfolioSnapshotsAction
  | SetSummaryAction
  | SetPerformanceDataAction
  | SyncStartAction
  | SyncSuccessAction
  | SyncErrorAction
  | ClearErrorAction
  | SetLastSyncTimeAction;

// Initial state
const initialState: HyperliquidState = {
  accounts: [],
  selectedAccount: null,
  trades: [],
  portfolioSnapshots: [],
  summary: null,
  performanceData: null,
  isLoading: false,
  error: null,
  lastSyncTime: null,
  syncInProgress: false,
  syncError: null
};

// Reducer
const hyperliquidReducer = (state: HyperliquidState, action: HyperliquidAction): HyperliquidState => {
  switch (action.type) {
    case HyperliquidActionType.SET_ACCOUNTS:
      return {
        ...state,
        accounts: action.payload,
        selectedAccount: action.payload.length > 0 ? action.payload[0] : null
      };
    
    case HyperliquidActionType.SELECT_ACCOUNT:
      return {
        ...state,
        selectedAccount: action.payload,
        // Clear data when switching accounts
        trades: [],
        portfolioSnapshots: [],
        summary: null,
        performanceData: null,
        error: null
      };
    
    case HyperliquidActionType.LOAD_DATA_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };
    
    case HyperliquidActionType.LOAD_DATA_SUCCESS:
      return {
        ...state,
        isLoading: false,
        error: null
      };
    
    case HyperliquidActionType.LOAD_DATA_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };
    
    case HyperliquidActionType.SET_TRADES:
      return {
        ...state,
        trades: action.payload
      };
    
    case HyperliquidActionType.SET_PORTFOLIO_SNAPSHOTS:
      return {
        ...state,
        portfolioSnapshots: action.payload
      };
    
    case HyperliquidActionType.SET_SUMMARY:
      return {
        ...state,
        summary: action.payload
      };
    
    case HyperliquidActionType.SET_PERFORMANCE_DATA:
      return {
        ...state,
        performanceData: action.payload
      };
    
    case HyperliquidActionType.SYNC_START:
      return {
        ...state,
        syncInProgress: true,
        syncError: null
      };
    
    case HyperliquidActionType.SYNC_SUCCESS:
      return {
        ...state,
        syncInProgress: false,
        syncError: null,
        lastSyncTime: Date.now()
      };
    
    case HyperliquidActionType.SYNC_ERROR:
      return {
        ...state,
        syncInProgress: false,
        syncError: action.payload
      };
    
    case HyperliquidActionType.CLEAR_ERROR:
      return {
        ...state,
        error: null,
        syncError: null
      };
    
    case HyperliquidActionType.SET_LAST_SYNC_TIME:
      return {
        ...state,
        lastSyncTime: action.payload
      };
    
    default:
      return state;
  }
};

// Context
interface HyperliquidContextType {
  state: HyperliquidState;
  dispatch: React.Dispatch<HyperliquidAction>;
  
  // Helper functions
  selectAccount: (account: HyperliquidAccount) => void;
  loadAccountData: (account: HyperliquidAccount) => Promise<void>;
  triggerSync: () => Promise<void>;
  clearError: () => void;
}

const HyperliquidContext = createContext<HyperliquidContextType | undefined>(undefined);

// Provider component
interface HyperliquidProviderProps {
  children: React.ReactNode;
}

export const HyperliquidProvider: React.FC<HyperliquidProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(hyperliquidReducer, initialState);

  // Load available accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Load data when account changes
  useEffect(() => {
    if (state.selectedAccount) {
      loadAccountData(state.selectedAccount);
    }
  }, [state.selectedAccount]);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/hyperliquid/accounts');
      
      if (!response.ok) {
        // If accounts endpoint is not available, create default accounts
        console.warn('Accounts endpoint not available, using default configuration');
        const defaultAccounts: HyperliquidAccount[] = [
          {
            wallet_address: 'configured_wallet',
            account_type: 'personal_wallet' as const,
            display_name: 'Personal Wallet'
          }
        ];
        
        dispatch({
          type: HyperliquidActionType.SET_ACCOUNTS,
          payload: defaultAccounts
        });
        
        // Auto-load data for the first default account
        if (defaultAccounts.length > 0) {
          await loadAccountData(defaultAccounts[0]);
        }
        
        // Auto-load data for the first default account
        if (defaultAccounts.length > 0) {
          await loadAccountData(defaultAccounts[0]);
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        dispatch({
          type: HyperliquidActionType.SET_ACCOUNTS,
          payload: data.accounts
        });
      } else {
        throw new Error(data.error || 'Failed to load accounts');
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      
      // Fallback: create default accounts so the UI still works
      const defaultAccounts: HyperliquidAccount[] = [
        {
          wallet_address: 'configured_wallet',
          account_type: 'personal_wallet' as const,
          display_name: 'Personal Wallet'
        }
      ];
      
      dispatch({
        type: HyperliquidActionType.SET_ACCOUNTS,
        payload: defaultAccounts
      });
    }
  };

  const selectAccount = (account: HyperliquidAccount) => {
    dispatch({
      type: HyperliquidActionType.SELECT_ACCOUNT,
      payload: account
    });
  };

  const loadAccountData = async (account: HyperliquidAccount) => {
    try {
      dispatch({ type: HyperliquidActionType.LOAD_DATA_START });

      // Load summary
      const summaryResponse = await fetch(
        `/api/hyperliquid/summary?account_type=${account.account_type}&wallet_address=${account.wallet_address}`
      );
      const summaryData = await summaryResponse.json();
      
      if (summaryData.success) {
        dispatch({
          type: HyperliquidActionType.SET_SUMMARY,
          payload: summaryData.summary
        });
      }

      // Load trades
      const tradesResponse = await fetch(
        `/api/hyperliquid/trades?account_type=${account.account_type}&wallet_address=${account.wallet_address}`
      );
      const tradesData = await tradesResponse.json();
      
      if (tradesData.success) {
        dispatch({
          type: HyperliquidActionType.SET_TRADES,
          payload: tradesData.trades
        });
      }

      // Load portfolio snapshots
      const portfolioResponse = await fetch(
        `/api/hyperliquid/portfolio?account_type=${account.account_type}&wallet_address=${account.wallet_address}&limit=50`
      );
      const portfolioData = await portfolioResponse.json();
      
      if (portfolioData.success) {
        dispatch({
          type: HyperliquidActionType.SET_PORTFOLIO_SNAPSHOTS,
          payload: portfolioData.snapshots
        });
      }

      // Load performance data
      const performanceResponse = await fetch(
        `/api/hyperliquid/performance?account_type=${account.account_type}&wallet_address=${account.wallet_address}&timeframe=monthly`
      );
      const performanceData = await performanceResponse.json();
      
      if (performanceData.success) {
        dispatch({
          type: HyperliquidActionType.SET_PERFORMANCE_DATA,
          payload: performanceData.performance_data
        });
      }

      dispatch({ type: HyperliquidActionType.LOAD_DATA_SUCCESS });
    } catch (error) {
      console.error('Error loading account data:', error);
      dispatch({
        type: HyperliquidActionType.LOAD_DATA_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to load account data'
      });
    }
  };

  const triggerSync = async () => {
    try {
      dispatch({ type: HyperliquidActionType.SYNC_START });

      const response = await fetch('/api/hyperliquid/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        dispatch({ type: HyperliquidActionType.SYNC_SUCCESS });
        
        // Reload data for current account
        if (state.selectedAccount) {
          await loadAccountData(state.selectedAccount);
        }
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      dispatch({
        type: HyperliquidActionType.SYNC_ERROR,
        payload: error instanceof Error ? error.message : 'Sync failed'
      });
    }
  };

  const clearError = () => {
    dispatch({ type: HyperliquidActionType.CLEAR_ERROR });
  };

  const contextValue: HyperliquidContextType = {
    state,
    dispatch,
    selectAccount,
    loadAccountData,
    triggerSync,
    clearError
  };

  return (
    <HyperliquidContext.Provider value={contextValue}>
      {children}
    </HyperliquidContext.Provider>
  );
};

// Hook to use the context
export const useHyperliquid = (): HyperliquidContextType => {
  const context = useContext(HyperliquidContext);
  if (context === undefined) {
    throw new Error('useHyperliquid must be used within a HyperliquidProvider');
  }
  return context;
};

// Action creators
export const setAccounts = (accounts: HyperliquidAccount[]): SetAccountsAction => ({
  type: HyperliquidActionType.SET_ACCOUNTS,
  payload: accounts
});

export const selectAccountAction = (account: HyperliquidAccount | null): SelectAccountAction => ({
  type: HyperliquidActionType.SELECT_ACCOUNT,
  payload: account
});

export const setTrades = (trades: HyperliquidTrade[]): SetTradesAction => ({
  type: HyperliquidActionType.SET_TRADES,
  payload: trades
});

export const setSummary = (summary: HyperliquidSummary): SetSummaryAction => ({
  type: HyperliquidActionType.SET_SUMMARY,
  payload: summary
});

export const setPerformanceData = (data: HyperliquidPerformanceData): SetPerformanceDataAction => ({
  type: HyperliquidActionType.SET_PERFORMANCE_DATA,
  payload: data
});