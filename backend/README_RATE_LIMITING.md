# Rate Limiting Implementation

This document explains the rate limiting implementation for the Trading Stats Dashboard backend, specifically focusing on how API rate limits are handled during sequential processing of tickers.

## Overview

The backend uses Yahoo Finance (yfinance) API to fetch stock and options data. Since Yahoo Finance has undocumented rate limits, we've implemented a rate limiting mechanism to prevent hitting these limits while ensuring reliable data retrieval.

## Rate Limiting Mechanism

### Enhanced Token Bucket Algorithm

We use an enhanced token bucket algorithm for rate limiting:

1. A bucket holds tokens that represent allowed API calls
2. Tokens are added to the bucket at a constant rate (refill rate)
3. When making an API call, a token is consumed from the bucket
4. If the bucket is empty, the request waits until a token becomes available
5. The bucket has a maximum capacity to allow for bursts of requests
6. After a configurable number of consecutive requests, a pause is enforced to avoid triggering rate limits

### Implementation

The rate limiter is implemented in the `RateLimiter` class in `run_direct.py`. It provides:

- Thread-safe token acquisition
- Configurable rate, period, and burst size
- Configurable consecutive request limits and pause duration
- Timeout mechanism to prevent indefinite waiting
- Function decorator capability for rate-limiting any function
- Dynamic configuration updates

## Sequential Processing

The scan feature processes tickers sequentially to ensure reliable API access:

1. A two-phase filtering approach quickly eliminates tickers that don't meet basic criteria
2. Each ticker is processed one at a time with rate limiting applied
3. Progress updates are provided during scanning via server-sent events (SSE)
4. The frontend displays real-time progress with a visual progress bar

### Server-Sent Events (SSE)

The backend uses server-sent events to stream progress updates to the frontend:

1. When a scan is initiated, the backend establishes an SSE connection
2. Progress updates are sent periodically as events during processing
3. Each event includes:
   - Current progress (completed/total tickers)
   - Percentage complete
   - Number of tickers filtered out
   - Number of tickers with no data
   - Partial results as they become available
4. A final event is sent when processing is complete

### Frontend Progress Visualization

The frontend displays scan progress with:

1. A progress bar showing percentage complete
2. Counters for processed tickers, filtered tickers, and no-data tickers
3. Real-time updates of results as they become available
4. Animated indicators to show active processing

## Configuration

Rate limiting and sequential processing parameters can be configured in `config.py`:

```python
# Rate limiting configuration for Yahoo Finance API calls
YF_RATE_LIMIT = {
    # Maximum burst size (token bucket capacity)
    "burst": 10
}

# Sequential processing configuration
SEQUENTIAL_PROCESSING = {
    # Estimated API calls per ticker analysis
    "api_calls_per_ticker": 8,
    
    # Requests per minute limit
    "requests_per_minute": 60,
    
    # Maximum consecutive requests before pause
    "max_consecutive_requests": 10,
    
    # Pause duration in seconds after max consecutive requests
    "pause_duration": 2.0
}
```

## Adjusting Rate Limits

If you're experiencing rate limit errors or want to optimize performance:

1. **Decrease rate limits** if you're getting HTTP 429 errors or connection failures:
   - Reduce `requests_per_minute` in `SEQUENTIAL_PROCESSING`
   - Decrease `max_consecutive_requests` or increase `pause_duration`

2. **Increase rate limits** if performance is too slow and you're not hitting limits:
   - Increase `requests_per_minute` in `SEQUENTIAL_PROCESSING`
   - Increase `max_consecutive_requests` or decrease `pause_duration`

## Testing

You can test the rate limiting implementation using the provided test script:

```bash
cd backend
python test_sequential_scan.py
```

You can also customize the rate limiting parameters when running the test:

```bash
cd backend
python test_sequential_scan.py --rpm 60 --max-consecutive 10 --pause 2.0
```

The test will report:
- Total execution time
- Number of tickers processed
- Processing rate (tickers per second)
- Current rate limit settings

## Monitoring

The application logs rate limiting information during execution:
- Rate limit parameters
- Progress updates during scanning
- Rate limit timeouts if they occur
- Pauses after consecutive requests