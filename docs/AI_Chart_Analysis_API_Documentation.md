# AI Chart Analysis - API Documentation

## Overview

This document provides comprehensive technical documentation for the AI Chart Analysis API endpoints, data structures, and integration patterns. The API enables developers to integrate AI-powered chart analysis capabilities into their applications.

## Base URL

```
http://localhost:5000/api/chart-analysis
```

## Authentication

The API uses server-side Claude API key authentication. No client-side authentication is required, but ensure the backend is properly configured with a valid `CLAUDE_API_KEY`.

## Content Types

- **Request**: `application/json` or `multipart/form-data` (for image uploads)
- **Response**: `application/json`

## Rate Limiting

- **Default Limit**: 100 requests per hour per IP
- **Burst Limit**: 10 requests per minute
- **Headers**: Rate limit information is included in response headers

## API Endpoints

### 1. Analyze Chart

Analyze a chart image using AI to extract technical insights.

#### Endpoint
```http
POST /api/chart-analysis/analyze
```

#### Request Format

**Option 1: JSON with Base64 Image**
```http
Content-Type: application/json

{
  "ticker": "AAPL",
  "chartImage": "iVBORw0KGgoAAAANSUhEUgAA...", // Base64 encoded image
  "timeframe": "1D",
  "additionalContext": "Earnings announcement expected next week"
}
```

**Option 2: Multipart Form Data**
```http
Content-Type: multipart/form-data

ticker: AAPL
image: [binary image file]
context: {"earnings_date": "2024-01-20", "iv_rank": 75.5}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Stock ticker symbol (e.g., "AAPL") |
| `chartImage` | string | Yes | Base64 encoded image data |
| `timeframe` | string | No | Chart timeframe (default: "1D") |
| `additionalContext` | string | No | Additional context for analysis |

#### Response Format

```json
{
  "ticker": "AAPL",
  "analysis_timestamp": "2024-01-15T10:30:00Z",
  "trend_analysis": {
    "primary_trend": "bullish",
    "trend_strength": "moderate",
    "trend_description": "Stock is in a clear uptrend with higher highs and higher lows. Recent pullback appears to be a healthy correction."
  },
  "support_resistance": {
    "key_support_levels": [
      {
        "price": 150.00,
        "strength": "strong",
        "description": "Major support from previous resistance level"
      },
      {
        "price": 145.50,
        "strength": "moderate",
        "description": "50-day moving average support"
      }
    ],
    "key_resistance_levels": [
      {
        "price": 160.00,
        "strength": "strong",
        "description": "Psychological resistance level"
      },
      {
        "price": 165.25,
        "strength": "moderate",
        "description": "Previous high resistance"
      }
    ]
  },
  "technical_indicators": {
    "moving_averages": "Price above 20, 50, and 200-day moving averages indicating bullish momentum",
    "volume_analysis": "Above-average volume on recent green days suggests institutional buying",
    "momentum_indicators": "RSI at 65 shows strong momentum without being overbought"
  },
  "trading_insights": {
    "entry_points": [152.00, 148.50],
    "exit_points": [158.00, 162.00],
    "stop_loss_levels": [147.00],
    "risk_assessment": "medium",
    "risk_reward_ratio": 2.5
  },
  "patterns": [
    {
      "name": "Ascending Triangle",
      "type": "bullish",
      "confidence": 0.85,
      "description": "Clear ascending triangle pattern with higher lows and flat resistance",
      "target_price": 165.00,
      "stop_loss": 148.00
    }
  ],
  "confidence_score": 0.85,
  "summary": "AAPL shows strong bullish momentum with clear technical support levels. The ascending triangle pattern suggests potential breakout above $160 resistance.",
  "analysis_id": 123,
  "image_hash": "a1b2c3d4e5f6...",
  "processing_time_ms": 2500
}
```

#### Error Responses

```json
// Missing API Key
{
  "error": "Claude API key not configured",
  "code": "API_KEY_MISSING",
  "status": 500
}

// Invalid Image
{
  "error": "Image processing failed: Unsupported format",
  "code": "INVALID_IMAGE",
  "status": 400
}

// Rate Limit Exceeded
{
  "error": "Rate limit exceeded. Try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429,
  "retry_after": 3600
}

// API Timeout
{
  "error": "Request timeout",
  "code": "TIMEOUT",
  "status": 504
}
```

### 2. Get Analysis History

Retrieve historical chart analyses for a specific ticker.

#### Endpoint
```http
GET /api/chart-analysis/history/{ticker}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Stock ticker symbol (URL path) |
| `limit` | integer | No | Maximum analyses to return (default: 10, max: 100) |
| `days_back` | integer | No | Days to look back (default: 30, max: 365) |
| `include_details` | boolean | No | Include full analysis details (default: false) |

#### Example Request
```http
GET /api/chart-analysis/history/AAPL?limit=5&days_back=7&include_details=true
```

#### Response Format

```json
{
  "ticker": "AAPL",
  "total_count": 15,
  "history": [
    {
      "id": 123,
      "analysis_timestamp": "2024-01-15T10:30:00Z",
      "confidence_score": 0.85,
      "primary_trend": "bullish",
      "summary": "Strong bullish momentum with ascending triangle pattern",
      "key_levels_count": 4,
      "patterns_count": 1,
      "current_price": 155.50,
      "analysis_details": {
        // Full analysis object (if include_details=true)
      }
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 5,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

### 3. Store Analysis Context

Store contextual information to improve future analyses.

#### Endpoint
```http
POST /api/chart-analysis/context/{ticker}
```

#### Request Format

```json
{
  "type": "earnings",
  "valid_hours": 24,
  "data": {
    "earnings_date": "2024-01-20",
    "iv_rank": 75.5,
    "analyst_sentiment": "bullish",
    "sector_rotation": "technology_outperforming"
  }
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | Context type (earnings, news, technical, etc.) |
| `valid_hours` | integer | No | Hours the context remains valid (default: 24) |
| `data` | object | Yes | Context-specific data |

#### Response Format

```json
{
  "success": true,
  "context_id": 456,
  "valid_until": "2024-01-16T10:30:00Z",
  "message": "Context stored successfully"
}
```

### 4. Get Key Levels

Retrieve support/resistance levels for a ticker from previous analyses.

#### Endpoint
```http
GET /api/chart-analysis/levels/{ticker}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Stock ticker symbol (URL path) |
| `level_type` | string | No | Filter by type (support, resistance, entry, exit) |
| `near_price` | float | No | Get levels near this price |
| `distance_pct` | float | No | Distance percentage (default: 0.05 = 5%) |
| `include_technical` | boolean | No | Include technical levels (default: true) |
| `min_significance` | float | No | Minimum significance score (0-1) |

#### Example Request
```http
GET /api/chart-analysis/levels/AAPL?near_price=150.00&distance_pct=0.03&level_type=support
```

#### Response Format

```json
{
  "ticker": "AAPL",
  "current_price": 155.50,
  "levels": [
    {
      "id": 789,
      "level_type": "support",
      "price_level": 150.00,
      "significance": 0.85,
      "strength": "strong",
      "identified_at": "2024-01-15T10:30:00Z",
      "last_tested": "2024-01-14T15:45:00Z",
      "test_count": 3,
      "is_active": true,
      "description": "Major support from previous resistance level",
      "distance_from_current": -3.54,
      "distance_pct": -0.0228
    }
  ],
  "technical_levels": [
    {
      "type": "moving_average",
      "period": 50,
      "value": 148.75,
      "trend": "bullish"
    }
  ]
}
```

### 5. Health Check

Check the health and status of the chart analysis service.

#### Endpoint
```http
GET /api/chart-analysis/health
```

#### Response Format

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "claude_api": {
      "status": "connected",
      "model": "claude-3-sonnet-20240229",
      "last_request": "2024-01-15T10:25:00Z"
    },
    "database": {
      "status": "connected",
      "total_analyses": 1250,
      "last_cleanup": "2024-01-15T06:00:00Z"
    },
    "image_processing": {
      "status": "available",
      "supported_formats": ["PNG", "JPEG", "WEBP"]
    }
  },
  "performance": {
    "avg_response_time_ms": 2500,
    "success_rate_24h": 0.95,
    "total_requests_24h": 150
  }
}
```

## Data Models

### ChartAnalysisRequest

```typescript
interface ChartAnalysisRequest {
  ticker: string;                    // Stock ticker symbol
  chartImage: string;                // Base64 encoded image
  timeframe?: string;                // Chart timeframe
  additionalContext?: string;        // Additional context
}
```

### ChartAnalysisResult

```typescript
interface ChartAnalysisResult {
  ticker: string;
  analysis_timestamp: string;        // ISO 8601 format
  trend_analysis: TrendAnalysis;
  support_resistance: SupportResistance;
  technical_indicators: TechnicalIndicators;
  trading_insights: TradingInsights;
  patterns: ChartPattern[];
  confidence_score: number;          // 0-1 scale
  summary: string;
  analysis_id: number;
  image_hash?: string;
  processing_time_ms?: number;
}
```

### TrendAnalysis

```typescript
interface TrendAnalysis {
  primary_trend: 'bullish' | 'bearish' | 'neutral';
  trend_strength: 'weak' | 'moderate' | 'strong';
  trend_description: string;
}
```

### SupportResistance

```typescript
interface SupportResistance {
  key_support_levels: KeyLevel[];
  key_resistance_levels: KeyLevel[];
}

interface KeyLevel {
  price: number;
  strength: 'weak' | 'moderate' | 'strong';
  description: string;
}
```

### TradingInsights

```typescript
interface TradingInsights {
  entry_points: number[];
  exit_points: number[];
  stop_loss_levels: number[];
  risk_assessment: 'low' | 'medium' | 'high';
  risk_reward_ratio?: number;
}
```

### ChartPattern

```typescript
interface ChartPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;                // 0-1 scale
  description: string;
  target_price?: number;
  stop_loss?: number;
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "status": 400,
  "details": {
    "field": "Additional error details",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "retry_after": 3600  // Only for rate limit errors
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `API_KEY_MISSING` | 500 | Claude API key not configured |
| `API_KEY_INVALID` | 401 | Invalid or expired API key |
| `INVALID_IMAGE` | 400 | Image format or size not supported |
| `INVALID_TICKER` | 400 | Invalid ticker symbol format |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `TIMEOUT` | 504 | Request timeout |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Claude API temporarily unavailable |

## Integration Examples

### JavaScript/TypeScript

```typescript
// Chart Analysis Service
class ChartAnalysisService {
  private baseUrl = 'http://localhost:5000/api/chart-analysis';

  async analyzeChart(request: ChartAnalysisRequest): Promise<ChartAnalysisResult> {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    return response.json();
  }

  async getHistory(ticker: string, limit = 10): Promise<HistoricalAnalysis[]> {
    const response = await fetch(
      `${this.baseUrl}/history/${ticker}?limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }
    
    const data = await response.json();
    return data.history;
  }
}

// Usage
const service = new ChartAnalysisService();

try {
  const result = await service.analyzeChart({
    ticker: 'AAPL',
    chartImage: base64Image,
    timeframe: '1D'
  });
  
  console.log('Analysis result:', result);
} catch (error) {
  console.error('Analysis failed:', error.message);
}
```

### Python

```python
import requests
import base64
from typing import Dict, Any, List

class ChartAnalysisClient:
    def __init__(self, base_url: str = "http://localhost:5000/api/chart-analysis"):
        self.base_url = base_url
    
    def analyze_chart(self, ticker: str, image_path: str, 
                     timeframe: str = "1D", context: str = None) -> Dict[str, Any]:
        """Analyze a chart image"""
        
        # Read and encode image
        with open(image_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
        
        payload = {
            'ticker': ticker,
            'chartImage': image_data,
            'timeframe': timeframe
        }
        
        if context:
            payload['additionalContext'] = context
        
        response = requests.post(f"{self.base_url}/analyze", json=payload)
        response.raise_for_status()
        
        return response.json()
    
    def get_history(self, ticker: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get analysis history for a ticker"""
        
        params = {'limit': limit}
        response = requests.get(f"{self.base_url}/history/{ticker}", params=params)
        response.raise_for_status()
        
        return response.json()['history']
    
    def get_key_levels(self, ticker: str, near_price: float = None) -> Dict[str, Any]:
        """Get key support/resistance levels"""
        
        params = {}
        if near_price:
            params['near_price'] = near_price
        
        response = requests.get(f"{self.base_url}/levels/{ticker}", params=params)
        response.raise_for_status()
        
        return response.json()

# Usage
client = ChartAnalysisClient()

try:
    result = client.analyze_chart('AAPL', 'chart.png', '1D')
    print(f"Analysis confidence: {result['confidence_score']}")
    print(f"Summary: {result['summary']}")
    
    # Get historical analyses
    history = client.get_history('AAPL', limit=5)
    print(f"Found {len(history)} historical analyses")
    
except requests.exceptions.RequestException as e:
    print(f"API request failed: {e}")
```

### cURL Examples

```bash
# Analyze chart with file upload
curl -X POST http://localhost:5000/api/chart-analysis/analyze \
  -F "image=@chart.png" \
  -F "ticker=AAPL" \
  -F "timeframe=1D"

# Get analysis history
curl "http://localhost:5000/api/chart-analysis/history/AAPL?limit=5&days_back=7"

# Get key levels near current price
curl "http://localhost:5000/api/chart-analysis/levels/AAPL?near_price=150.00&distance_pct=0.03"

# Store analysis context
curl -X POST http://localhost:5000/api/chart-analysis/context/AAPL \
  -H "Content-Type: application/json" \
  -d '{
    "type": "earnings",
    "valid_hours": 24,
    "data": {
      "earnings_date": "2024-01-20",
      "iv_rank": 75.5
    }
  }'

# Health check
curl http://localhost:5000/api/chart-analysis/health
```

## Performance Considerations

### Request Optimization

1. **Image Size**: Optimize images before upload (recommended max: 2MB)
2. **Batch Requests**: Use history endpoint for multiple analyses
3. **Caching**: Implement client-side caching for repeated requests
4. **Compression**: Use gzip compression for large responses

### Response Times

- **Typical Analysis**: 2-5 seconds
- **Complex Charts**: 5-10 seconds
- **History Queries**: <1 second
- **Key Levels**: <500ms

### Rate Limiting Best Practices

1. **Implement Exponential Backoff**: For retry logic
2. **Monitor Rate Limits**: Check response headers
3. **Queue Requests**: For high-volume applications
4. **Cache Results**: Avoid duplicate analyses

## Security Considerations

### API Security

1. **HTTPS Only**: Use HTTPS in production
2. **Input Validation**: Validate all input parameters
3. **File Upload Security**: Scan uploaded images
4. **Rate Limiting**: Prevent abuse

### Data Privacy

1. **Image Storage**: Images are not permanently stored
2. **Analysis Data**: Stored locally in SQLite
3. **API Keys**: Never expose client-side
4. **Logging**: Avoid logging sensitive data

## Monitoring and Debugging

### Logging

Enable detailed logging for debugging:

```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger('chart_analysis')
```

### Metrics to Monitor

1. **Response Times**: Track API performance
2. **Error Rates**: Monitor failure rates
3. **API Usage**: Track Claude API costs
4. **Database Performance**: Monitor query times
5. **Image Processing**: Track processing times

### Health Monitoring

```bash
# Monitor service health
watch -n 30 'curl -s http://localhost:5000/api/chart-analysis/health | jq .'

# Monitor response times
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:5000/api/chart-analysis/health
```

## Changelog

### Version 1.0.0
- Initial API release
- Basic chart analysis functionality
- Support for PNG, JPEG, WEBP formats
- Historical analysis storage
- Key levels detection

### Future Enhancements
- Batch analysis endpoints
- WebSocket support for real-time analysis
- Advanced pattern recognition
- Custom model training
- Enhanced caching mechanisms

For additional support or feature requests, please refer to the project documentation or contact the development team.