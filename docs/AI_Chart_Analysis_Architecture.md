# AI Chart Analysis - Architecture Overview

## System Architecture

The AI Chart Analysis feature is built as a modular system that integrates seamlessly with the existing Trading Stats Dashboard. The architecture follows a client-server pattern with clear separation of concerns between frontend presentation, backend processing, and external AI services.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  ChartAnalysis  │  │  AnalysisPanel  │  │ AnalysisHistory │  │
│  │   Component     │  │   Component     │  │   Component     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   ChartViewer   │  │AnalysisControls │  │ ChartAnnotations│  │
│  │   Component     │  │   Component     │  │   Component     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Chart Analysis Service                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  API Client (chartAnalysisService.ts)                      │ │
│  │  • Request/Response handling                               │ │
│  │  • Error handling and retry logic                         │ │
│  │  • Image processing utilities                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Flask)                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   API Routes    │  │  Chart Analyzer │  │ Level Detector  │  │
│  │  (routes.py)    │  │(chart_analyzer) │  │(level_detector) │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │Chart Context    │  │Snapshot         │  │Chart Data       │  │
│  │Manager          │  │Processor        │  │Integration      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Data Layer                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    SQLite Database                         │ │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐ │ │
│  │  │chart_analyses │ │  key_levels   │ │analysis_context   │ │ │
│  │  └───────────────┘ └───────────────┘ └───────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API Calls
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Anthropic Claude API                          │ │
│  │  • Vision model for image analysis                         │ │
│  │  • Natural language processing                             │ │
│  │  • Pattern recognition                                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Components

#### Core Components

**ChartAnalysis.tsx**
- Main container component
- Manages overall state and navigation
- Coordinates between child components
- Handles ticker selection and timeframe management

**ChartViewer.tsx**
- Displays stock charts with TradingView integration
- Handles chart screenshot capture
- Manages chart annotations and overlays
- Provides chart interaction controls

**AnalysisPanel.tsx**
- Displays AI analysis results
- Renders technical indicators and patterns
- Shows trading recommendations
- Provides confidence scoring visualization

**AnalysisHistory.tsx**
- Lists historical analyses
- Provides filtering and search capabilities
- Enables comparison between analyses
- Manages pagination and data loading

**AnalysisControls.tsx**
- Analysis configuration interface
- Context input management
- Manual image upload handling
- Analysis trigger controls

#### Data Flow

```
User Input → ChartAnalysis → ChartViewer → Screenshot Capture
     ↓              ↓              ↓              ↓
State Update → Service Call → API Request → Backend Processing
     ↓              ↓              ↓              ↓
UI Update ← Response ← Analysis Result ← AI Processing
```

### Backend Architecture

#### Core Modules

**Chart Analyzer (`app/chart_analyzer.py`)**
```python
class ChartAnalyzer:
    """Main AI analysis orchestrator"""
    
    def __init__(self, api_key: str):
        self.claude_client = Anthropic(api_key=api_key)
        self.model = "claude-3-sonnet-20240229"
    
    def analyze_chart(self, image_data: bytes, ticker: str, context: dict) -> dict:
        """
        Orchestrates the complete analysis process:
        1. Image preprocessing and validation
        2. Context preparation and prompt engineering
        3. Claude API interaction
        4. Response parsing and structuring
        5. Result validation and enhancement
        """
```

**Chart Context Manager (`app/chart_context.py`)**
```python
class ChartContextManager:
    """Manages analysis data persistence"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def store_analysis(self, analysis_data: dict) -> int:
        """Store analysis results with metadata"""
    
    def get_analysis_history(self, ticker: str, limit: int) -> List[dict]:
        """Retrieve historical analyses"""
    
    def store_key_levels(self, ticker: str, levels: List[dict]) -> None:
        """Store identified support/resistance levels"""
```

**Level Detector (`app/level_detector.py`)**
```python
class LevelDetector:
    """Extracts and processes key price levels"""
    
    def extract_levels_from_analysis(self, analysis: dict) -> List[dict]:
        """Parse AI analysis for key levels"""
    
    def combine_with_technical_levels(self, ticker: str, ai_levels: List[dict]) -> List[dict]:
        """Merge AI levels with technical analysis"""
    
    def calculate_level_significance(self, level: dict, price_history: List[float]) -> float:
        """Calculate level strength and significance"""
```

**Snapshot Processor (`app/snapshot_processor.py`)**
```python
class SnapshotProcessor:
    """Handles image processing and optimization"""
    
    def validate_image(self, image_data: bytes) -> bool:
        """Validate image format and size"""
    
    def optimize_for_analysis(self, image_data: bytes) -> bytes:
        """Optimize image for AI processing"""
    
    def generate_thumbnail(self, image_data: bytes) -> bytes:
        """Create thumbnail for storage"""
```

#### API Layer

**Route Structure (`app/routes.py`)**
```python
# Analysis endpoints
@app.route('/api/chart-analysis/analyze', methods=['POST'])
def analyze_chart():
    """Main analysis endpoint"""

@app.route('/api/chart-analysis/history/<ticker>', methods=['GET'])
def get_analysis_history(ticker):
    """Historical analysis retrieval"""

@app.route('/api/chart-analysis/levels/<ticker>', methods=['GET'])
def get_key_levels(ticker):
    """Key levels endpoint"""

@app.route('/api/chart-analysis/context/<ticker>', methods=['POST'])
def store_context(ticker):
    """Context storage endpoint"""

@app.route('/api/chart-analysis/health', methods=['GET'])
def health_check():
    """Service health monitoring"""
```

### Data Architecture

#### Database Schema

**chart_analyses Table**
```sql
CREATE TABLE chart_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    analysis_timestamp DATETIME NOT NULL,
    analysis_data TEXT NOT NULL,        -- JSON analysis results
    confidence_score REAL,
    image_hash TEXT,                    -- For duplicate detection
    context_data TEXT,                  -- Additional context
    processing_time_ms INTEGER,         -- Performance tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_ticker_timestamp (ticker, analysis_timestamp DESC),
    INDEX idx_confidence (confidence_score DESC),
    INDEX idx_image_hash (image_hash)
);
```

**key_levels Table**
```sql
CREATE TABLE key_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    level_type TEXT NOT NULL,           -- support, resistance, pivot
    price_level REAL NOT NULL,
    significance REAL DEFAULT 1.0,     -- 0-1 strength score
    identified_at DATETIME NOT NULL,
    last_tested DATETIME,
    test_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    source TEXT DEFAULT 'ai',          -- ai, technical, manual
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_ticker_active (ticker, is_active, price_level),
    INDEX idx_level_type (level_type, significance DESC)
);
```

**analysis_context Table**
```sql
CREATE TABLE analysis_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    context_type TEXT NOT NULL,        -- earnings, news, technical
    context_data TEXT NOT NULL,        -- JSON context information
    valid_until DATETIME,              -- Context expiration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_ticker_valid (ticker, valid_until DESC),
    INDEX idx_context_type (context_type, created_at DESC)
);
```

#### Data Relationships

```
chart_analyses (1) ←→ (N) key_levels
       ↓
   ticker (FK)
       ↓
analysis_context (N) ←→ (1) ticker
```

### Integration Architecture

#### External Service Integration

**Claude API Integration**
```python
class ClaudeIntegration:
    """Handles Claude API communication"""
    
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        self.client = Anthropic(api_key=api_key)
        self.model = model
        self.max_tokens = 4000
        self.timeout = 30
    
    def analyze_image(self, image_data: bytes, prompt: str) -> dict:
        """Send image to Claude for analysis"""
        
        # Prepare message with image
        message = {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64.b64encode(image_data).decode()
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }
        
        # Make API call with retry logic
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            messages=[message]
        )
        
        return self.parse_response(response)
```

**Market Data Integration**
```python
class MarketDataIntegration:
    """Integrates with existing market data sources"""
    
    def get_current_price(self, ticker: str) -> float:
        """Get current stock price"""
        # Integrate with existing yfinance or AlphaVantage
    
    def get_price_history(self, ticker: str, days: int = 30) -> List[dict]:
        """Get historical price data"""
        # Use existing data sources
    
    def get_volume_profile(self, ticker: str) -> dict:
        """Get volume analysis data"""
        # Leverage existing volume analysis
```

### Security Architecture

#### Authentication and Authorization

**API Key Management**
```python
class SecurityManager:
    """Handles security aspects"""
    
    def validate_api_key(self) -> bool:
        """Validate Claude API key"""
        
    def sanitize_input(self, user_input: str) -> str:
        """Sanitize user inputs"""
        
    def validate_image(self, image_data: bytes) -> bool:
        """Validate uploaded images"""
        
    def rate_limit_check(self, client_ip: str) -> bool:
        """Check rate limiting"""
```

**Input Validation**
```python
# Image validation
ALLOWED_FORMATS = {'PNG', 'JPEG', 'WEBP'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DIMENSIONS = (2048, 2048)
MIN_DIMENSIONS = (200, 200)

# Ticker validation
TICKER_PATTERN = re.compile(r'^[A-Z]{1,5}$')

# Context validation
MAX_CONTEXT_LENGTH = 1000
ALLOWED_CONTEXT_TYPES = {'earnings', 'news', 'technical', 'market'}
```

### Performance Architecture

#### Caching Strategy

**Multi-Level Caching**
```python
class CacheManager:
    """Manages multiple cache layers"""
    
    def __init__(self):
        self.memory_cache = {}  # In-memory cache
        self.redis_cache = None  # Optional Redis cache
        self.db_cache = {}      # Database query cache
    
    def get_cached_analysis(self, cache_key: str) -> dict:
        """Check all cache levels"""
        
    def cache_analysis(self, cache_key: str, data: dict, ttl: int = 3600):
        """Store in appropriate cache level"""
```

**Database Optimization**
```sql
-- Performance indexes
CREATE INDEX idx_analyses_recent ON chart_analyses(created_at DESC);
CREATE INDEX idx_levels_ticker_price ON key_levels(ticker, price_level);
CREATE INDEX idx_context_valid ON analysis_context(valid_until DESC);

-- Database configuration
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA temp_store = MEMORY;
```

#### Async Processing

**Background Tasks**
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncProcessor:
    """Handles async processing tasks"""
    
    def __init__(self, max_workers: int = 4):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
    
    async def process_analysis_async(self, image_data: bytes, ticker: str) -> dict:
        """Process analysis in background"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, 
            self.analyze_chart_sync, 
            image_data, 
            ticker
        )
```

### Monitoring Architecture

#### Health Monitoring

**Health Check System**
```python
class HealthMonitor:
    """Comprehensive health monitoring"""
    
    def check_claude_api(self) -> dict:
        """Check Claude API connectivity"""
        
    def check_database(self) -> dict:
        """Check database health"""
        
    def check_performance(self) -> dict:
        """Check system performance metrics"""
        
    def get_overall_health(self) -> dict:
        """Aggregate health status"""
```

**Metrics Collection**
```python
class MetricsCollector:
    """Collects and stores performance metrics"""
    
    def record_analysis_time(self, duration_ms: int):
        """Record analysis processing time"""
        
    def record_api_call(self, success: bool, response_time: int):
        """Record API call metrics"""
        
    def record_error(self, error_type: str, details: str):
        """Record error occurrences"""
```

### Deployment Architecture

#### Production Deployment

**Container Architecture**
```dockerfile
# Backend container
FROM python:3.9-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . /app
WORKDIR /app
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "run:app"]
```

**Load Balancing**
```nginx
upstream chart_analysis_backend {
    server backend1:5000;
    server backend2:5000;
    server backend3:5000;
}

server {
    listen 80;
    location /api/chart-analysis/ {
        proxy_pass http://chart_analysis_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_timeout 60s;
    }
}
```

#### Scalability Considerations

**Horizontal Scaling**
- Stateless backend design enables multiple instances
- Database connection pooling for concurrent access
- Redis for shared caching across instances
- Load balancer for request distribution

**Vertical Scaling**
- Memory optimization for image processing
- CPU optimization for AI analysis
- Database query optimization
- Efficient resource utilization

### Error Handling Architecture

#### Error Classification

```python
class ErrorHandler:
    """Centralized error handling"""
    
    ERROR_TYPES = {
        'API_ERROR': 'External API failures',
        'VALIDATION_ERROR': 'Input validation failures',
        'PROCESSING_ERROR': 'Image processing failures',
        'DATABASE_ERROR': 'Database operation failures',
        'TIMEOUT_ERROR': 'Request timeout failures'
    }
    
    def handle_error(self, error: Exception, context: dict) -> dict:
        """Process and categorize errors"""
        
    def log_error(self, error_type: str, details: dict):
        """Log errors for monitoring"""
        
    def create_error_response(self, error_type: str, message: str) -> dict:
        """Create standardized error responses"""
```

#### Recovery Mechanisms

**Retry Logic**
```python
class RetryManager:
    """Handles retry logic for failed operations"""
    
    def __init__(self, max_retries: int = 3, backoff_factor: float = 2.0):
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
    
    async def retry_with_backoff(self, func, *args, **kwargs):
        """Execute function with exponential backoff"""
```

**Circuit Breaker**
```python
class CircuitBreaker:
    """Prevents cascade failures"""
    
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
```

This architecture provides a robust, scalable, and maintainable foundation for the AI Chart Analysis feature while integrating seamlessly with the existing Trading Stats Dashboard infrastructure.