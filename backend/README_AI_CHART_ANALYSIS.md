# AI-Powered Chart Analysis Feature

This document describes the AI-powered chart analysis feature that has been added to the options trading Flask application.

## Overview

The AI chart analysis feature uses Claude Vision API to analyze stock chart images and provide technical analysis insights, support/resistance levels, and trading recommendations. The feature is fully integrated with the existing backend infrastructure and follows established patterns for data handling, rate limiting, and error management.

## Architecture

### Core Components

1. **Chart Analyzer** (`app/chart_analyzer.py`)
   - Integrates with Claude Vision API
   - Processes chart images and generates AI analysis
   - Handles API authentication and error management
   - Provides structured analysis output

2. **Chart Context Manager** (`app/chart_context.py`)
   - Manages historical analysis storage using SQLite
   - Stores analysis results, key levels, and context data
   - Provides data persistence and retrieval functionality
   - Handles database schema and migrations

3. **Level Detector** (`app/level_detector.py`)
   - Extracts key levels from AI analysis
   - Combines AI insights with technical analysis
   - Provides level-based trading insights
   - Calculates level strength and significance

4. **Snapshot Processor** (`app/snapshot_processor.py`)
   - Handles image validation and preprocessing
   - Optimizes images for AI analysis
   - Provides image metadata and thumbnails
   - Ensures image quality and format compliance

5. **Chart Data Integration** (`app/chart_data_integration.py`)
   - Extends existing data sources for chart context
   - Provides OHLCV data and market metrics
   - Integrates with existing rate limiting
   - Follows established data fetching patterns

## API Endpoints

### POST /api/chart-analysis/analyze
Analyze a chart image using AI.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Parameters:
  - `image`: Chart image file (PNG, JPEG, WEBP)
  - `ticker`: Stock ticker symbol
  - `context`: Optional JSON context data

**Response:**
```json
{
  "ticker": "AAPL",
  "analysis_timestamp": "2024-01-15T10:30:00",
  "trend_analysis": {
    "primary_trend": "bullish",
    "trend_strength": "moderate",
    "trend_description": "..."
  },
  "support_resistance": {
    "key_support_levels": [150.00, 145.50],
    "key_resistance_levels": [160.00, 165.25]
  },
  "technical_indicators": {
    "moving_averages": "...",
    "volume_analysis": "...",
    "momentum_indicators": "..."
  },
  "trading_insights": {
    "entry_points": [152.00, 148.50],
    "exit_points": [158.00, 162.00],
    "stop_loss_levels": [147.00],
    "risk_assessment": "medium"
  },
  "confidence_score": 0.85,
  "summary": "...",
  "analysis_id": 123
}
```

### GET /api/chart-analysis/history/{ticker}
Get historical chart analyses for a ticker.

**Parameters:**
- `limit`: Maximum analyses to return (default: 10, max: 100)
- `days_back`: Days to look back (default: 30, max: 365)

### POST /api/chart-analysis/context/{ticker}
Store analysis context for a ticker.

**Request Body:**
```json
{
  "type": "earnings",
  "valid_hours": 24,
  "earnings_date": "2024-01-20",
  "iv_rank": 75.5
}
```

### GET /api/chart-analysis/levels/{ticker}
Get key support/resistance levels for a ticker.

**Parameters:**
- `level_type`: Filter by type (support, resistance, entry, exit)
- `near_price`: Get levels near this price
- `distance_pct`: Distance percentage (default: 0.05)
- `include_technical`: Include technical levels (default: true)

## Configuration

### Environment Variables

Add the following environment variable to enable AI chart analysis:

```bash
CLAUDE_API_KEY=your_claude_api_key_here
```

### API Key Setup

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account and obtain an API key
3. Set the `CLAUDE_API_KEY` environment variable
4. Restart the Flask application

### Local Configuration

Alternatively, add to `local_config.py`:

```python
CLAUDE_API_KEY = "your_claude_api_key_here"
```

## Database Schema

The feature creates three new SQLite tables:

### chart_analyses
Stores AI analysis results.

```sql
CREATE TABLE chart_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    analysis_timestamp DATETIME NOT NULL,
    analysis_data TEXT NOT NULL,
    confidence_score REAL,
    image_hash TEXT,
    context_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### key_levels
Stores identified support/resistance levels.

```sql
CREATE TABLE key_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    level_type TEXT NOT NULL,
    price_level REAL NOT NULL,
    significance REAL DEFAULT 1.0,
    identified_at DATETIME NOT NULL,
    last_tested DATETIME,
    test_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### analysis_context
Stores context data for analyses.

```sql
CREATE TABLE analysis_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    context_type TEXT NOT NULL,
    context_data TEXT NOT NULL,
    valid_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Integration with Existing Systems

### Data Sources
- Uses existing yfinance integration for market data
- Follows established rate limiting patterns
- Integrates with existing earnings calendar functionality
- Maintains compatibility with AlphaVantage data source

### Error Handling
- Follows existing error response patterns
- Uses established logging configuration
- Maintains consistent API response format
- Provides graceful degradation when API unavailable

### Security
- Uses existing CORS configuration
- Follows established API key management patterns
- Implements proper input validation
- Maintains existing security headers

## Usage Examples

### Basic Chart Analysis

```bash
curl -X POST http://localhost:5000/api/chart-analysis/analyze \
  -F "image=@chart.png" \
  -F "ticker=AAPL"
```

### With Context Data

```bash
curl -X POST http://localhost:5000/api/chart-analysis/analyze \
  -F "image=@chart.png" \
  -F "ticker=AAPL" \
  -F 'context={"earnings_date":"2024-01-20","iv_rank":75.5}'
```

### Get Historical Analyses

```bash
curl "http://localhost:5000/api/chart-analysis/history/AAPL?limit=5&days_back=7"
```

### Get Key Levels

```bash
curl "http://localhost:5000/api/chart-analysis/levels/AAPL?near_price=150.00&distance_pct=0.03"
```

## Image Requirements

### Supported Formats
- PNG (recommended)
- JPEG/JPG
- WEBP

### Size Limits
- Maximum file size: 10MB
- Maximum dimensions: 2048x2048 pixels
- Minimum dimensions: 200x200 pixels

### Quality Guidelines
- Clear, high-contrast charts work best
- Include price axis and time axis labels
- Avoid heavily compressed or blurry images
- Charts with visible volume data provide better analysis

## Performance Considerations

### Rate Limiting
- Claude API calls are not rate-limited by the application
- Existing yfinance rate limiting is maintained
- Image processing is optimized for performance

### Caching
- Analysis results are stored in database
- Image hashes prevent duplicate processing
- Context data is cached with expiration

### Resource Usage
- Images are processed in memory
- Database operations use connection pooling
- Cleanup routines remove old data

## Error Handling

### Common Errors

1. **Missing API Key**
   ```json
   {"error": "Claude API key not configured"}
   ```

2. **Invalid Image**
   ```json
   {"error": "Image processing failed: Unsupported format"}
   ```

3. **API Timeout**
   ```json
   {"error": "Request timeout"}
   ```

4. **Rate Limit Exceeded**
   ```json
   {"error": "API request failed: 429"}
   ```

### Troubleshooting

1. **Feature Not Working**
   - Check CLAUDE_API_KEY environment variable
   - Verify API key validity
   - Check application logs for errors

2. **Poor Analysis Quality**
   - Ensure image is clear and high-contrast
   - Include price and time axis labels
   - Use supported image formats

3. **Database Errors**
   - Check write permissions for instance directory
   - Verify SQLite database creation
   - Review database logs

## Monitoring and Maintenance

### Logging
- All operations are logged with appropriate levels
- API calls and errors are tracked
- Performance metrics are available

### Database Maintenance
- Automatic cleanup of old analyses (90 days)
- Index optimization for query performance
- Regular backup recommendations

### API Usage Monitoring
- Track Claude API usage and costs
- Monitor response times and error rates
- Set up alerts for API failures

## Future Enhancements

### Planned Features
- Batch analysis processing
- Real-time chart monitoring
- Advanced pattern recognition
- Integration with trading signals

### Optimization Opportunities
- Image preprocessing improvements
- Analysis result caching
- Parallel processing capabilities
- Enhanced level detection algorithms

## Security Considerations

### API Key Security
- Store API keys in environment variables
- Use local_config.py for development
- Never commit API keys to version control
- Rotate keys regularly

### Input Validation
- All image uploads are validated
- File size and format restrictions
- SQL injection prevention
- XSS protection maintained

### Data Privacy
- Analysis data is stored locally
- No sensitive data sent to external APIs
- User data handling follows existing patterns
- GDPR compliance maintained