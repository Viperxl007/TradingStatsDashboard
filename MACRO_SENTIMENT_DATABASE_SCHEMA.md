# Macro Sentiment Database Schema Design

## Overview

This document details the database schema for the macro market sentiment analysis system. The design follows existing patterns from the project's SQLite-based architecture and ensures optimal performance for both real-time queries and historical analysis.

## Database Location

Following existing patterns:
- **Database File**: `backend/instance/chart_analysis.db` (shared with existing chart analysis)
- **Connection Pattern**: Direct SQLite with connection pooling and thread safety
- **Migration Strategy**: `CREATE TABLE IF NOT EXISTS` with proper indexing

## Core Tables

### 1. macro_market_data

Stores raw and calculated market data points collected every 4 hours.

```sql
CREATE TABLE macro_market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,                 -- Unix timestamp (UTC)
    data_source TEXT NOT NULL DEFAULT 'coingecko',
    
    -- Raw market data (all values in USD)
    total_market_cap REAL NOT NULL,            -- Total crypto market cap
    btc_market_cap REAL NOT NULL,              -- Bitcoin market cap
    eth_market_cap REAL NOT NULL,              -- Ethereum market cap
    btc_price REAL NOT NULL,                   -- Bitcoin price in USD
    
    -- Calculated derived metrics
    alt_market_cap REAL NOT NULL,              -- total_market_cap - btc_market_cap - eth_market_cap
    alt_strength_ratio REAL NOT NULL,          -- alt_market_cap / btc_price
    btc_dominance REAL NOT NULL,               -- btc_market_cap / total_market_cap * 100
    
    -- Data quality and metadata
    data_quality_score REAL DEFAULT 1.0,       -- 0.0-1.0 quality indicator
    collection_latency_ms INTEGER,             -- Time taken to collect data
    created_at INTEGER NOT NULL,               -- Record creation timestamp
    
    -- Constraints
    UNIQUE(timestamp),
    CHECK(total_market_cap > 0),
    CHECK(btc_market_cap > 0),
    CHECK(eth_market_cap > 0),
    CHECK(btc_price > 0),
    CHECK(btc_dominance >= 0 AND btc_dominance <= 100),
    CHECK(data_quality_score >= 0 AND data_quality_score <= 1)
);
```

**Key Design Decisions:**
- `timestamp` as INTEGER (Unix timestamp) for efficient sorting and range queries
- All monetary values as REAL for precision
- Calculated fields stored for performance (alt_market_cap, alt_strength_ratio, btc_dominance)
- Data quality tracking for monitoring and alerting
- CHECK constraints for data integrity

### 2. macro_sentiment_analysis

Stores AI analysis results and trading recommendations.

```sql
CREATE TABLE macro_sentiment_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_timestamp INTEGER NOT NULL,       -- When analysis was performed
    data_period_start INTEGER NOT NULL,        -- Start of analyzed data period
    data_period_end INTEGER NOT NULL,          -- End of analyzed data period
    
    -- Core confidence and trend analysis
    overall_confidence INTEGER NOT NULL,       -- 0-100 overall market confidence
    btc_trend_direction TEXT NOT NULL,         -- 'UP', 'DOWN', 'SIDEWAYS'
    btc_trend_strength INTEGER NOT NULL,       -- 0-100 strength of BTC trend
    alt_trend_direction TEXT NOT NULL,         -- 'UP', 'DOWN', 'SIDEWAYS'
    alt_trend_strength INTEGER NOT NULL,       -- 0-100 strength of ALT trend
    
    -- Trading recommendations
    trade_permission TEXT NOT NULL,            -- 'NO_TRADE', 'SELECTIVE', 'ACTIVE', 'AGGRESSIVE'
    market_regime TEXT NOT NULL,               -- 'BTC_SEASON', 'ALT_SEASON', 'TRANSITION', 'BEAR_MARKET'
    
    -- AI analysis metadata
    ai_reasoning TEXT NOT NULL,                -- Full AI reasoning and analysis
    chart_data_hash TEXT NOT NULL,             -- Hash of input data for cache validation
    processing_time_ms INTEGER NOT NULL,       -- Analysis processing time
    model_used TEXT NOT NULL,                  -- Claude model used for analysis
    prompt_version TEXT DEFAULT 'v1.0',        -- Prompt version for tracking
    
    -- Chart images (base64 encoded)
    btc_chart_image TEXT,                      -- BTC price chart
    dominance_chart_image TEXT,                -- BTC dominance chart
    alt_strength_chart_image TEXT,             -- Alt strength ratio chart
    combined_chart_image TEXT,                 -- Combined visualization
    
    -- System metadata
    created_at INTEGER NOT NULL,
    
    -- Constraints
    UNIQUE(analysis_timestamp),
    CHECK(overall_confidence >= 0 AND overall_confidence <= 100),
    CHECK(btc_trend_strength >= 0 AND btc_trend_strength <= 100),
    CHECK(alt_trend_strength >= 0 AND alt_trend_strength <= 100),
    CHECK(btc_trend_direction IN ('UP', 'DOWN', 'SIDEWAYS')),
    CHECK(alt_trend_direction IN ('UP', 'DOWN', 'SIDEWAYS')),
    CHECK(trade_permission IN ('NO_TRADE', 'SELECTIVE', 'ACTIVE', 'AGGRESSIVE')),
    CHECK(market_regime IN ('BTC_SEASON', 'ALT_SEASON', 'TRANSITION', 'BEAR_MARKET')),
    CHECK(data_period_start <= data_period_end),
    CHECK(processing_time_ms >= 0)
);
```

**Key Design Decisions:**
- Separate timestamp for analysis vs. data period for flexibility
- Confidence scores as INTEGER (0-100) for consistent UI representation
- Enum-like constraints using CHECK for data integrity
- Chart images stored as TEXT (base64) for historical reference
- Comprehensive metadata for debugging and optimization

### 3. macro_system_state

Tracks system health, bootstrap status, and operational metrics.

```sql
CREATE TABLE macro_system_state (
    id INTEGER PRIMARY KEY DEFAULT 1,          -- Singleton table
    
    -- Bootstrap status
    bootstrap_completed BOOLEAN DEFAULT FALSE,
    bootstrap_completed_at INTEGER NULL,
    bootstrap_data_points INTEGER DEFAULT 0,
    bootstrap_errors TEXT NULL,                 -- JSON array of bootstrap errors
    
    -- Scanning system status
    last_successful_scan INTEGER NULL,         -- Timestamp of last successful scan
    last_failed_scan INTEGER NULL,             -- Timestamp of last failed scan
    consecutive_failures INTEGER DEFAULT 0,
    total_scans_completed INTEGER DEFAULT 0,
    
    -- Analysis system status
    last_analysis_id INTEGER NULL,             -- Reference to last analysis
    last_analysis_timestamp INTEGER NULL,
    consecutive_analysis_failures INTEGER DEFAULT 0,
    total_analyses_completed INTEGER DEFAULT 0,
    
    -- System health
    system_status TEXT DEFAULT 'INITIALIZING', -- 'INITIALIZING', 'ACTIVE', 'ERROR', 'MAINTENANCE'
    health_score REAL DEFAULT 1.0,             -- 0.0-1.0 overall health indicator
    
    -- Performance metrics
    avg_scan_duration_ms INTEGER DEFAULT 0,
    avg_analysis_duration_ms INTEGER DEFAULT 0,
    data_quality_trend REAL DEFAULT 1.0,       -- Recent data quality trend
    
    -- Configuration
    scan_interval_hours INTEGER DEFAULT 4,
    max_consecutive_failures INTEGER DEFAULT 3,
    
    -- Metadata
    updated_at INTEGER NOT NULL,
    
    -- Constraints
    CHECK (id = 1),                            -- Ensure singleton
    CHECK(consecutive_failures >= 0),
    CHECK(health_score >= 0 AND health_score <= 1),
    CHECK(data_quality_trend >= 0 AND data_quality_trend <= 1),
    CHECK(scan_interval_hours > 0),
    CHECK(system_status IN ('INITIALIZING', 'ACTIVE', 'ERROR', 'MAINTENANCE'))
);
```

**Key Design Decisions:**
- Singleton pattern (id=1) for system-wide state
- Comprehensive health tracking for monitoring
- Performance metrics for optimization
- Configurable parameters for operational flexibility
- Error tracking for debugging

## Performance Indexes

Optimized for common query patterns:

```sql
-- Primary performance indexes
CREATE INDEX idx_macro_market_data_timestamp ON macro_market_data(timestamp DESC);
CREATE INDEX idx_macro_market_data_source_timestamp ON macro_market_data(data_source, timestamp DESC);

CREATE INDEX idx_macro_sentiment_analysis_timestamp ON macro_sentiment_analysis(analysis_timestamp DESC);
CREATE INDEX idx_macro_sentiment_confidence ON macro_sentiment_analysis(overall_confidence);
CREATE INDEX idx_macro_sentiment_permission ON macro_sentiment_analysis(trade_permission);
CREATE INDEX idx_macro_sentiment_regime ON macro_sentiment_analysis(market_regime);

-- Composite indexes for common queries
CREATE INDEX idx_macro_market_data_timerange ON macro_market_data(timestamp, btc_price, btc_dominance);
CREATE INDEX idx_macro_sentiment_recent ON macro_sentiment_analysis(analysis_timestamp DESC, overall_confidence, trade_permission);

-- Data quality and monitoring indexes
CREATE INDEX idx_macro_market_data_quality ON macro_market_data(data_quality_score, timestamp);
CREATE INDEX idx_macro_sentiment_performance ON macro_sentiment_analysis(processing_time_ms, analysis_timestamp);
```

## Data Retention Strategy

### Historical Data Retention
- **Market Data**: Retain indefinitely (small storage footprint)
- **Sentiment Analysis**: Retain 2 years of detailed analysis
- **Chart Images**: Retain 6 months (largest storage consumer)
- **System Logs**: Retain 90 days

### Cleanup Procedures
```sql
-- Cleanup old chart images (keep analysis data)
UPDATE macro_sentiment_analysis 
SET btc_chart_image = NULL, 
    dominance_chart_image = NULL, 
    alt_strength_chart_image = NULL, 
    combined_chart_image = NULL
WHERE analysis_timestamp < (strftime('%s', 'now') - 15552000); -- 6 months

-- Archive old detailed analysis (keep summary data)
DELETE FROM macro_sentiment_analysis 
WHERE analysis_timestamp < (strftime('%s', 'now') - 63072000) -- 2 years
AND id NOT IN (
    SELECT id FROM macro_sentiment_analysis 
    ORDER BY analysis_timestamp DESC 
    LIMIT 1000  -- Keep at least 1000 most recent
);
```

## Query Patterns

### Common Queries

1. **Get Latest Sentiment**
```sql
SELECT * FROM macro_sentiment_analysis 
ORDER BY analysis_timestamp DESC 
LIMIT 1;
```

2. **Get Recent Market Data**
```sql
SELECT * FROM macro_market_data 
WHERE timestamp > (strftime('%s', 'now') - 86400)  -- Last 24 hours
ORDER BY timestamp DESC;
```

3. **Get Confidence Trend**
```sql
SELECT analysis_timestamp, overall_confidence, trade_permission
FROM macro_sentiment_analysis 
WHERE analysis_timestamp > (strftime('%s', 'now') - 604800)  -- Last week
ORDER BY analysis_timestamp ASC;
```

4. **System Health Check**
```sql
SELECT 
    system_status,
    health_score,
    consecutive_failures,
    (strftime('%s', 'now') - last_successful_scan) as seconds_since_last_scan
FROM macro_system_state 
WHERE id = 1;
```

## Data Validation

### Input Validation
- All timestamps must be valid Unix timestamps
- Market cap values must be positive
- Confidence scores must be 0-100
- Trend directions must be valid enums
- BTC dominance must be 0-100%

### Data Integrity Checks
```sql
-- Check for data gaps
SELECT 
    timestamp,
    LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp,
    (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)) / 3600 as hours_gap
FROM macro_market_data 
WHERE (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)) > 18000  -- > 5 hours
ORDER BY timestamp DESC;

-- Check for anomalous values
SELECT * FROM macro_market_data 
WHERE btc_dominance < 30 OR btc_dominance > 70  -- Unusual dominance
   OR alt_strength_ratio < 0.1 OR alt_strength_ratio > 10  -- Unusual alt strength
ORDER BY timestamp DESC;
```

## Migration Strategy

### Initial Setup
1. Create tables with `IF NOT EXISTS`
2. Create indexes
3. Insert initial system state record
4. Validate schema integrity

### Version Management
```sql
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    component TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    applied_at INTEGER NOT NULL
);

INSERT OR REPLACE INTO schema_versions VALUES 
('macro_sentiment', '1.0.0', strftime('%s', 'now'));
```

## Backup and Recovery

### Backup Strategy
- Daily automated backups of entire database
- Incremental backups of new data every 4 hours
- Cloud storage backup retention (30 days)

### Recovery Procedures
- Point-in-time recovery capability
- Data validation after recovery
- Automatic bootstrap re-run if data corruption detected

## Performance Considerations

### Write Performance
- Batch inserts for historical data
- Prepared statements for repeated operations
- Transaction management for consistency

### Read Performance
- Optimized indexes for common queries
- Query result caching where appropriate
- Connection pooling for concurrent access

### Storage Optimization
- Efficient data types (INTEGER vs TEXT)
- Compressed chart image storage
- Regular VACUUM operations

## Monitoring and Alerting

### Key Metrics
- Data collection success rate
- Analysis processing time
- Database size growth
- Query performance

### Alert Conditions
- Consecutive scan failures > 3
- Analysis processing time > 30 seconds
- Data quality score < 0.8
- Database size growth > 10MB/day

This schema design provides a robust foundation for the macro sentiment analysis system while maintaining consistency with existing project patterns and ensuring optimal performance for both real-time operations and historical analysis.