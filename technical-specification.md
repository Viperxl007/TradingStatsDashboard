# Trading Stats Dashboard - Technical Specification

This document provides detailed technical specifications for implementing the Trading Stats Dashboard as outlined in the implementation plan.

## Data Structures

### Trade Data Model

```typescript
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
```

### Performance Metrics

```typescript
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

export interface MonthlyPerformance {
  month: string;                 // Month in YYYY-MM format
  trades: number;                // Number of trades in this month
  profitLoss: number;            // Profit/loss for this month
  winRate: number;               // Win rate for this month
}

export interface TimeframePerformance {
  timeframe: string;             // Timeframe label (e.g., "Last 7 days")
  startDate: string;             // Start date of the timeframe
  endDate: string;               // End date of the timeframe
  trades: number;                // Number of trades in this timeframe
  profitLoss: number;            // Profit/loss for this timeframe
  winRate: number;               // Win rate for this timeframe
  topToken: string;              // Best performing token in this timeframe
}
```

### Application State

```typescript
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
  
  // UI State
  isLoading: boolean;            // Loading state for async operations
  error: string | null;          // Error message if any
  activeTab: string;             // Currently active dashboard tab
  isDarkMode: boolean;           // Dark mode toggle state
}
```

## Component Specifications

### Dashboard Component

The main container component that orchestrates the dashboard layout and manages the overall state.

**Props:**
- None (uses context for state)

**State:**
- activeTab: string

**Methods:**
- handleTabChange(tab: string): void
- handleImportData(file: File): Promise<void>
- handleExportData(): void

### Summary Component

Displays high-level account metrics and key performance indicators.

**Props:**
- summary: AccountSummary
- timeframePerformance: TimeframePerformance[]

**Subcomponents:**
- SummaryCard: Displays a single metric with label, value, and optional trend indicator
- MiniChart: Small sparkline chart showing performance over time
- TimeframeSelector: Allows selecting different timeframes for the summary view

### TokenFilter Component

Provides filtering capabilities for the dashboard.

**Props:**
- tokens: string[]
- selectedTokens: string[]
- dateRange: [Date | null, Date | null]
- tradeType: 'all' | 'buy' | 'sell'
- onFilterChange: (filters: FilterOptions) => void

**State:**
- localFilters: FilterOptions

**Methods:**
- handleTokenChange(tokens: string[]): void
- handleDateRangeChange(range: [Date | null, Date | null]): void
- handleTradeTypeChange(type: 'all' | 'buy' | 'sell'): void
- applyFilters(): void
- resetFilters(): void

### PerformanceAnalysis Component

Provides detailed performance analysis with charts and comparisons.

**Props:**
- tokenPerformance: TokenPerformance[]
- filteredData: TradeData[]

**Subcomponents:**
- PerformanceChart: Line chart showing performance over time
- TokenComparison: Bar chart comparing token performance
- TrendIndicator: Visual indicator of token trends
- TokenDetailView: Detailed view of a single token's performance

## Service Specifications

### Data Import Service

Handles importing and processing trade data from Excel files.

**Methods:**
- importData(file: File): Promise<TradeData[]>
- validateData(data: any[]): { valid: boolean, errors: string[] }
- transformData(data: any[]): TradeData[]
- filterDuplicates(data: TradeData[]): TradeData[]

### Data Processing Service

Processes trade data to calculate performance metrics and identify trends.

**Methods:**
- calculateAccountSummary(data: TradeData[]): AccountSummary
- analyzeTokenPerformance(data: TradeData[]): TokenPerformance[]
- identifyTrendingTokens(data: TradeData[]): TokenPerformance[]
- identifyUnderperformingTokens(data: TradeData[]): TokenPerformance[]
- calculateTimeframePerformance(data: TradeData[], timeframe: string): TimeframePerformance
- calculateMonthlyPerformance(data: TradeData[]): MonthlyPerformance[]
- calculateWinRate(data: TradeData[]): number
- calculateVolatility(data: TradeData[]): number

## Context API Design

### DataContext

Manages the global state for the application.

**Initial State:**
```typescript
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
```

**Actions:**
- IMPORT_DATA_START
- IMPORT_DATA_SUCCESS
- IMPORT_DATA_ERROR
- SET_FILTERED_DATA
- UPDATE_FILTERS
- RESET_FILTERS
- SET_ACTIVE_TAB
- TOGGLE_DARK_MODE

**Reducer:**
Handles state updates based on dispatched actions.

**Context Provider:**
Provides the state and dispatch function to all child components.

## UI/UX Specifications

### Theme Configuration

```typescript
// src/theme/index.ts
import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#e6f7ff',
      100: '#b3e0ff',
      200: '#80caff',
      300: '#4db3ff',
      400: '#1a9dff',
      500: '#0080ff', // Primary brand color
      600: '#0066cc',
      700: '#004d99',
      800: '#003366',
      900: '#001a33',
    },
    profit: {
      50: '#e6fff0',
      500: '#00cc66', // Profit green
    },
    loss: {
      50: '#ffe6e6',
      500: '#ff3333', // Loss red
    },
  },
  fonts: {
    heading: '"Inter", sans-serif',
    body: '"Inter", sans-serif',
  },
  components: {
    // Custom component styles
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
      },
    }),
  },
});

export default theme;
```

### Layout Design

- **Dashboard Layout**: Grid-based layout with responsive breakpoints
- **Card Components**: Consistent card design for all metrics and charts
- **Navigation**: Tab-based navigation for different dashboard views
- **Header**: Fixed header with import/export controls and dark mode toggle
- **Responsive Design**: Mobile-first approach with appropriate breakpoints

### Chart Specifications

- **Color Scheme**: Consistent color scheme for all charts
- **Tooltips**: Interactive tooltips for all chart elements
- **Legends**: Clear legends for multi-series charts
- **Animations**: Smooth animations for chart transitions
- **Responsiveness**: Charts should resize based on container width

## Data Flow

1. User imports Excel file
2. Data is validated and transformed
3. Duplicates are filtered out
4. Performance metrics are calculated
5. State is updated with new data and metrics
6. UI components re-render with new data
7. User can filter and interact with the dashboard

## Error Handling

- **Import Errors**: Display specific error messages for import failures
- **Data Validation**: Validate imported data and show appropriate warnings
- **Empty States**: Show helpful empty states when no data is available
- **Loading States**: Display loading indicators during async operations

## Performance Considerations

- **Large Datasets**: Implement virtualization for tables with large datasets
- **Memoization**: Use React.memo and useMemo for expensive calculations
- **Lazy Loading**: Implement lazy loading for non-critical components
- **Code Splitting**: Split code by routes/features to reduce initial load time

## Accessibility

- **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible
- **Screen Reader Support**: Provide appropriate ARIA labels for all components
- **Color Contrast**: Ensure sufficient color contrast for all text elements
- **Focus Management**: Implement proper focus management for modals and dialogs

## Testing Strategy

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions and data flow
- **End-to-End Tests**: Test critical user flows
- **Performance Tests**: Test performance with large datasets

## Deployment Considerations

- **Build Optimization**: Optimize build for production
- **Environment Variables**: Use environment variables for configuration
- **Error Tracking**: Implement error tracking for production issues
- **Analytics**: Add analytics to track user behavior and feature usage