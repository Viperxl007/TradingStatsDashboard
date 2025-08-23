# Macro Market Sentiment System - Implementation Plan

## Executive Summary

This document outlines the implementation plan for a sophisticated macro market sentiment analysis system that will be integrated into the existing AI Chart Analysis tab. The system will provide real-time "trade permission" signals based on BTC and altcoin trend analysis, helping traders identify when market conditions are favorable for active trading versus when capital preservation is recommended.

## Architecture Analysis - Existing Patterns

Based on analysis of the existing codebase, the following patterns will be followed:

### Database Architecture
- **Primary Database**: SQLite (`chart_analysis.db` in `backend/instance/`)
- **Model Pattern**: Direct SQLite operations with connection pooling (following `hyperliquid_models.py`)
- **Schema Pattern**: Proper indexing, UNIQUE constraints, and timestamp tracking
- **Migration Pattern**: Table creation with `IF NOT EXISTS` and index management

### Service Architecture
- **Service Location**: `backend/services/` directory
- **Scheduler Pattern**: Background threading similar to `hyperliquid_scheduler.py`
- **API Integration**: Rate-limited external API calls with retry logic
- **Error Handling**: Comprehensive logging and graceful degradation

### API Architecture
- **Route Pattern**: Blueprint-based routes in `backend/app/routes.py`
- **Endpoint Structure**: `/api/macro-sentiment/*` following existing patterns
- **Response Format**: JSON with consistent error handling
- **Authentication**: No auth required (following existing pattern)

### Frontend Architecture
- **Integration Point**: Direct integration into `ChartAnalysis.tsx` component
- **State Management**: React hooks and context (following existing patterns)
- **UI Framework**: Chakra UI components for consistency
- **Service Pattern**: TypeScript services in `src/services/`

## System Components

### 1. Database Schema

```sql
-- Core market data storage
CREATE TABLE macro_market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    data_source TEXT NOT NULL DEFAULT 'coingecko',
    
    -- Raw market data (USD values)
    total_market_cap REAL NOT NULL,
    btc_market_cap REAL NOT NULL,
    eth_market_cap REAL NOT NULL,
    btc_price REAL NOT NULL,
    
    -- Calculated metrics
    alt_market_cap REAL NOT NULL,           -- total - btc - eth
    alt_strength_ratio REAL NOT NULL,       -- alt_market_cap / btc_price
    btc_dominance REAL NOT NULL,            -- btc_market_cap / total_market_cap
    
    -- System metadata
    created_at INTEGER NOT NULL,
    
    UNIQUE(timestamp)
);

-- AI sentiment analysis results
CREATE TABLE macro_sentiment_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_timestamp INTEGER NOT NULL,
    data_period_start INTEGER NOT NULL,
    data_period_end INTEGER NOT NULL,
    
    -- Core analysis results
    overall_confidence INTEGER NOT NULL,    -- 0-100
    btc_trend_direction TEXT NOT NULL,      -- 'UP', 'DOWN', 'SIDEWAYS'
    btc_trend_strength INTEGER NOT NULL,    -- 0-100
    alt_trend_direction TEXT NOT NULL,      -- 'UP', 'DOWN', 'SIDEWAYS'
    alt_trend_strength INTEGER NOT NULL,    -- 0-100
    
    -- Trading permission levels
    trade_permission TEXT NOT NULL,         -- 'NO_TRADE', 'SELECTIVE', 'ACTIVE', 'AGGRESSIVE'
    market_regime TEXT NOT NULL,            -- 'BTC_SEASON', 'ALT_SEASON', 'TRANSITION', 'BEAR_MARKET'
    
    -- AI analysis metadata
    ai_reasoning TEXT NOT NULL,
    chart_data_hash TEXT NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    model_used TEXT NOT NULL,
    
    created_at INTEGER NOT NULL,
    
    UNIQUE(analysis_timestamp)
);

-- System state and health tracking
CREATE TABLE macro_system_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    bootstrap_completed BOOLEAN DEFAULT FALSE,
    bootstrap_completed_at INTEGER NULL,
    last_successful_scan INTEGER NULL,
    last_failed_scan INTEGER NULL,
    consecutive_failures INTEGER DEFAULT 0,
    system_status TEXT DEFAULT 'INITIALIZING',  -- 'INITIALIZING', 'ACTIVE', 'ERROR', 'MAINTENANCE'
    last_analysis_id INTEGER NULL,
    
    updated_at INTEGER NOT NULL,
    
    CHECK (id = 1)  -- Ensure single row
);

-- Performance indexes
CREATE INDEX idx_macro_market_data_timestamp ON macro_market_data(timestamp DESC);
CREATE INDEX idx_macro_sentiment_analysis_timestamp ON macro_sentiment_analysis(analysis_timestamp DESC);
CREATE INDEX idx_macro_sentiment_confidence ON macro_sentiment_analysis(overall_confidence);
CREATE INDEX idx_macro_sentiment_permission ON macro_sentiment_analysis(trade_permission);
```

### 2. CoinGecko API Integration Service

**File**: `backend/services/coingecko_service.py`

Key features:
- Rate limiting (30 calls/minute for free tier)
- Retry logic with exponential backoff
- Data validation and normalization
- Fallback error handling

```python
class CoinGeckoService:
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
        self.rate_limiter = RateLimiter(calls=30, period=60)  # Free tier limits
    
    async def get_global_market_data(self) -> Dict[str, Any]:
        """Get current global market data"""
        
    async def get_historical_market_data(self, days: int = 365) -> List[Dict[str, Any]]:
        """Get historical market data for bootstrap"""
        
    async def get_btc_dominance_data(self, days: int = 365) -> List[Dict[str, Any]]:
        """Get BTC dominance historical data"""
```

### 3. Bootstrap System

**File**: `backend/services/macro_bootstrap_service.py`

One-time historical data collection:
- Fetch maximum available data from CoinGecko (365 days)
- Calculate derived metrics (alt strength ratio, dominance)
- Bulk insert with progress tracking
- Data integrity validation
- Safeguards against re-running

### 4. 4-Hour Scanning System

**File**: `backend/services/macro_scanner_service.py`

Automated data collection:
- Cron-based execution every 4 hours
- Incremental data collection since last scan
- Real-time market snapshot capture
- Database updates with conflict resolution
- Error recovery and retry logic

### 5. AI Analysis Engine

**File**: `backend/services/macro_ai_service.py`

Following existing Claude API patterns from `enhanced_chart_analyzer.py`:
- Chart generation for 3 synchronized visualizations
- Historical context analysis
- Confidence scoring (0-100 range with full utilization)
- Trade permission determination
- Market regime classification

### 6. Chart Generation Service

**File**: `backend/services/macro_chart_service.py`

Creates synchronized visualizations:
- BTC Price chart (candlestick/line)
- BTC Dominance percentage chart
- Alt Strength Ratio chart
- Time-aligned data points
- Export to base64 for AI analysis

### 7. Frontend Integration

**Integration Point**: `src/components/ChartAnalysis.tsx`

New section added to the Chart Analysis tab:
- Prominent placement at the top of the tab
- Modern confidence gauge (0-100)
- Traffic light system (Red/Yellow/Green)
- Trend indicators with directional arrows
- Last update timestamp and countdown
- Mini historical confidence chart

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
1. Database schema creation and migration
2. CoinGecko API service implementation
3. Bootstrap service development
4. Basic data collection testing

### Phase 2: Core Services (Days 4-6)
1. 4-hour scanning system implementation
2. Chart generation service
3. AI analysis engine development
4. Backend API endpoints

### Phase 3: Frontend Integration (Days 7-9)
1. UI component development
2. Service integration
3. Chart Analysis tab integration
4. Responsive design implementation

### Phase 4: Production Readiness (Days 10-12)
1. Comprehensive error handling
2. Performance optimization
3. Monitoring and alerting
4. End-to-end testing

## API Endpoints

Following existing patterns in `backend/app/routes.py`:

```python
# Macro sentiment endpoints
@api_bp.route('/macro-sentiment/status', methods=['GET'])
def get_macro_sentiment_status():
    """Get current macro sentiment analysis"""

@api_bp.route('/macro-sentiment/history', methods=['GET'])
def get_macro_sentiment_history():
    """Get historical sentiment analysis"""

@api_bp.route('/macro-sentiment/bootstrap', methods=['POST'])
def trigger_bootstrap():
    """Trigger one-time bootstrap (admin only)"""

@api_bp.route('/macro-sentiment/scan', methods=['POST'])
def trigger_manual_scan():
    """Trigger manual scan for testing"""

@api_bp.route('/macro-sentiment/system-health', methods=['GET'])
def get_system_health():
    """Get system health and statistics"""
```

## Frontend Service

**File**: `src/services/macroSentimentService.ts`

Following patterns from `chartAnalysisService.ts`:

```typescript
export interface MacroSentimentData {
  overall_confidence: number;
  btc_trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  btc_trend_strength: number;
  alt_trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  alt_trend_strength: number;
  trade_permission: 'NO_TRADE' | 'SELECTIVE' | 'ACTIVE' | 'AGGRESSIVE';
  market_regime: 'BTC_SEASON' | 'ALT_SEASON' | 'TRANSITION' | 'BEAR_MARKET';
  last_updated: string;
  next_update: string;
}

export const getMacroSentiment = async (): Promise<MacroSentimentData> => {
  // Implementation following existing patterns
};
```

## UI Component Design

**Integration**: Direct integration into `ChartAnalysis.tsx`

```tsx
// New section at top of Chart Analysis tab
<Box mb={6} p={6} bg={colorMode === 'dark' ? 'gray.700' : 'white'} borderRadius="lg" shadow="md">
  <Heading size="md" mb={4}>Market Macro Sentiment</Heading>
  
  <HStack spacing={6} align="center">
    {/* Confidence Gauge */}
    <MacroConfidenceGauge confidence={macroData.overall_confidence} />
    
    {/* BTC Trend */}
    <TrendIndicator 
      label="BTC Trend"
      direction={macroData.btc_trend_direction}
      strength={macroData.btc_trend_strength}
    />
    
    {/* ALT Trend */}
    <TrendIndicator 
      label="ALT Trend" 
      direction={macroData.alt_trend_direction}
      strength={macroData.alt_trend_strength}
    />
    
    {/* Trade Permission */}
    <TradePermissionIndicator permission={macroData.trade_permission} />
    
    {/* Last Update Info */}
    <UpdateStatus 
      lastUpdated={macroData.last_updated}
      nextUpdate={macroData.next_update}
    />
  </HStack>
</Box>
```

## Performance Considerations

### Caching Strategy
- Chart image caching with content-based hashing
- API response caching with 1-hour TTL
- Database query optimization with proper indexing
- Memory-efficient data processing

### Error Handling
- Graceful degradation when macro analysis unavailable
- Retry logic for API failures with exponential backoff
- Comprehensive logging for debugging
- User-friendly error messages

### Monitoring
- System health endpoints for monitoring
- Performance metrics tracking
- Alert system for consecutive failures
- Database integrity checks

## Security Considerations

- No sensitive data exposure (following existing patterns)
- Rate limiting to prevent API abuse
- Input validation for all endpoints
- SQL injection prevention with parameterized queries

## Testing Strategy

### Unit Tests
- Service layer testing with mocked APIs
- Database operation testing
- Chart generation testing
- AI analysis prompt testing

### Integration Tests
- End-to-end workflow testing
- API endpoint testing
- Frontend component testing
- Error scenario testing

### Performance Tests
- Load testing for 4-hour scanning
- Memory usage monitoring
- Database performance testing
- API rate limit testing

## Deployment Considerations

### Database Migration
- Automated schema creation
- Data integrity validation
- Rollback procedures
- Performance impact assessment

### Service Deployment
- Background service startup
- Health check endpoints
- Graceful shutdown procedures
- Log rotation configuration

### Frontend Deployment
- Component integration testing
- Browser compatibility testing
- Mobile responsiveness testing
- Performance optimization

## Success Metrics

### Technical Metrics
- 99.5% uptime for 4-hour scanning
- <2 seconds chart generation time
- <5 seconds API response time
- <1% data loss over 30 days

### User Experience Metrics
- <3 clicks to access key information
- Intuitive confidence interpretation
- Clear trade permission signals
- Responsive design across devices

## Risk Mitigation

### API Dependencies
- Multiple data source fallbacks
- Graceful degradation strategies
- Rate limit monitoring
- Error recovery procedures

### System Reliability
- Database backup procedures
- Service restart capabilities
- Error alerting systems
- Performance monitoring

### Data Quality
- Input validation procedures
- Data integrity checks
- Anomaly detection
- Manual override capabilities

## Conclusion

This implementation plan provides a comprehensive roadmap for building a production-ready macro market sentiment system that seamlessly integrates with the existing AI Chart Analysis infrastructure. The system will provide traders with sophisticated market regime analysis while maintaining the high standards of reliability and user experience established by the existing platform.

The phased approach ensures systematic development with proper testing and validation at each stage, while the architectural alignment with existing patterns ensures maintainability and consistency with the current codebase.