# Detailed Implementation Roadmap for Options Earnings Screener

## Phase 1: Backend Service Setup (3-5 days)

### 1.1 Convert calculator.py to API Service
- Create a new directory `trading-stats-dashboard/backend` for the Python service
- Set up a Flask/FastAPI application structure
- Extract core calculation logic from calculator.py into separate modules:
  - `options_analyzer.py` - Core analysis functions
  - `data_fetcher.py` - yfinance integration
  - `earnings_calendar.py` - finance_calendars integration
- Create API endpoints:
  - `/api/analyze/{ticker}` - Single ticker analysis
  - `/api/scan/earnings` - Scan stocks with earnings today
  - `/api/calendar/today` - Get today's earnings calendar

### 1.2 Implement Error Handling and Logging
- Add proper exception handling for API calls
- Implement request validation
- Set up logging for debugging and monitoring
- Add rate limiting for external API calls

### 1.3 Containerize the Service
- Create a Dockerfile for the Python service
- Create a docker-compose.yml for local development
- Document setup and running instructions

## Phase 2: Frontend Integration (2-3 days)

### 2.1 Update Data Context
- Add new state for options data in `DataState` interface:
```typescript
optionsData: {
  analysisResult: OptionsAnalysisResult | null;
  scanResults: OptionsAnalysisResult[];
  isLoading: boolean;
  error: string | null;
}
```
- Create new action types in `ActionType` enum:
```typescript
ANALYZE_OPTIONS_START = 'ANALYZE_OPTIONS_START',
ANALYZE_OPTIONS_SUCCESS = 'ANALYZE_OPTIONS_SUCCESS',
ANALYZE_OPTIONS_ERROR = 'ANALYZE_OPTIONS_ERROR',
SCAN_EARNINGS_START = 'SCAN_EARNINGS_START',
SCAN_EARNINGS_SUCCESS = 'SCAN_EARNINGS_SUCCESS',
SCAN_EARNINGS_ERROR = 'SCAN_EARNINGS_ERROR'
```
- Add corresponding reducers and action creators

### 2.2 Create API Service Functions
- Create a new file `src/services/optionsService.ts` with functions:
  - `analyzeOptions(ticker: string): Promise<OptionsAnalysisResult>`
  - `scanEarningsToday(): Promise<OptionsAnalysisResult[]>`
  - `getEarningsCalendar(): Promise<EarningsCalendarItem[]>`

### 2.3 Create New Components
- Create component files:
  - `src/components/OptionsEarningsScreener.tsx` - Main container component
  - `src/components/DirectSearch.tsx` - Single ticker search
  - `src/components/ScanResults.tsx` - Earnings scan results
  - `src/components/TickerDetails.tsx` - Additional ticker information

### 2.4 Update Dashboard Component
- Add new tab to the TabList in `Dashboard.tsx`:
```tsx
<Tab>Options Earnings</Tab>
```
- Add new TabPanel with the OptionsEarningsScreener component:
```tsx
<TabPanel>
  <OptionsEarningsScreener />
</TabPanel>
```
- Update the tab names array in handleTabChange function

## Phase 3: Direct Search Implementation (2-3 days)

### 3.1 Create Search Interface
- Implement ticker input field with validation
- Add submit button with loading state
- Create error message display component
- Add responsive layout using Chakra UI Grid/Flex

### 3.2 Create Results Display
- Design recommendation card with color-coded status
- Create metrics display with visual indicators
- Implement expected move visualization
- Add collapsible sections for detailed metrics

### 3.3 Add Additional Information (Stretch Goal)
- Implement basic stock information card
- Add TradingView chart widget integration
- Create recent news section with API integration

## Phase 4: Scan Implementation (3-4 days)

### 4.1 Create Scan Interface
- Implement "Scan Today's Earnings" button with loading state
- Add optional date selector for future/past dates
- Create scan status indicator

### 4.2 Create Results Table
- Implement sortable table using Chakra UI Table
- Add columns for ticker, recommendation, metrics, and expected move
- Create visual indicators for pass/fail criteria
- Implement pagination for large result sets

### 4.3 Implement Filtering and Sorting
- Add filter controls for recommendation type
- Implement client-side sorting for all columns
- Create search input for filtering results
- Add export functionality for results

## Phase 5: Testing and Refinement (2-3 days)

### 5.1 Unit Testing
- Write tests for Python API endpoints
- Create tests for React components
- Test state management and reducers

### 5.2 Integration Testing
- Test end-to-end flow from search to results
- Verify error handling and edge cases
- Test performance with large datasets

### 5.3 UI/UX Refinement
- Ensure consistent styling with existing dashboard
- Optimize for mobile responsiveness
- Add helpful tooltips and documentation
- Implement keyboard shortcuts for power users

## Technical Details

### New Types to Add

```typescript
// Options analysis result
interface OptionsAnalysisResult {
  ticker: string;
  currentPrice: number;
  metrics: {
    avgVolume: number;
    avgVolumePass: boolean;
    iv30Rv30: number;
    iv30Rv30Pass: boolean;
    tsSlope: number;
    tsSlopePass: boolean;
  };
  expectedMove: string;
  recommendation: 'Recommended' | 'Consider' | 'Avoid';
  timestamp: number;
}

// Earnings calendar item
interface EarningsCalendarItem {
  ticker: string;
  companyName: string;
  reportTime: 'BMO' | 'AMC' | 'DMH'; // Before Market Open, After Market Close, During Market Hours
  date: string;
  estimatedEPS: number | null;
  actualEPS: number | null;
}
```

### API Endpoints

```
GET /api/analyze/{ticker}
Response: OptionsAnalysisResult

GET /api/scan/earnings?date={YYYY-MM-DD}
Response: OptionsAnalysisResult[]

GET /api/calendar/today
Response: EarningsCalendarItem[]
```

## Implementation Timeline

1. **Phase 1 (Backend Service)**: 3-5 days
   - Day 1-2: Convert calculator.py to API service
   - Day 3-4: Test API endpoints
   - Day 5: Containerize and document

2. **Phase 2 (Frontend Integration)**: 2-3 days
   - Day 1: Update data context
   - Day 2-3: Create component structure

3. **Phase 3 (Direct Search)**: 2-3 days
   - Day 1: Create search interface
   - Day 2-3: Implement results display

4. **Phase 4 (Scan Implementation)**: 3-4 days
   - Day 1-2: Create scan interface
   - Day 3-4: Implement results table

5. **Phase 5 (Testing and Refinement)**: 2-3 days
   - Day 1: Unit testing
   - Day 2: Integration testing
   - Day 3: UI/UX refinement

Total estimated time: 12-18 days