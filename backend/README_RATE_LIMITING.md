# Rate Limiting Implementation

This document explains the rate limiting implementation for the Trading Stats Dashboard backend, specifically focusing on how API rate limits are handled during parallel processing of tickers.

## Overview

The backend uses Yahoo Finance (yfinance) API to fetch stock and options data. Since Yahoo Finance has undocumented rate limits, we've implemented a rate limiting mechanism to prevent hitting these limits while still maintaining good performance through parallel processing.

## Rate Limiting Mechanism

### Token Bucket Algorithm

We use a token bucket algorithm for rate limiting:

1. A bucket holds tokens that represent allowed API calls
2. Tokens are added to the bucket at a constant rate (refill rate)
3. When making an API call, a token is consumed from the bucket
4. If the bucket is empty, the request waits until a token becomes available
5. The bucket has a maximum capacity to allow for bursts of requests

### Implementation

The rate limiter is implemented in the `RateLimiter` class in `run_direct.py`. It provides:

- Thread-safe token acquisition
- Configurable rate, period, and burst size
- Timeout mechanism to prevent indefinite waiting
- Function decorator capability for rate-limiting any function

## Parallel Processing

The scan feature processes multiple tickers in parallel using `ThreadPoolExecutor`. To balance performance and rate limiting:

1. A two-phase filtering approach quickly eliminates tickers that don't meet basic criteria
2. The number of worker threads is dynamically calculated based on:
   - Current rate limit settings
   - Number of tickers to process
   - Estimated API calls per ticker
   - Target completion time

## Configuration

Rate limiting and parallel processing parameters can be configured in `config.py`:

```python
# Rate limiting configuration for Yahoo Finance API calls
YF_RATE_LIMIT = {
    # Number of requests allowed per time period
    "rate": 5,
    
    # Time period in seconds
    "per": 1.0,
    
    # Maximum burst size (token bucket capacity)
    "burst": 10
}

# Parallel processing configuration
PARALLEL_PROCESSING = {
    # Minimum number of worker threads
    "min_workers": 2,
    
    # Maximum number of worker threads
    "max_workers": 16,
    
    # Estimated API calls per ticker analysis
    "api_calls_per_ticker": 8,
    
    # Target completion time range in seconds (min, max)
    "target_completion_time": (30, 60)
}
```

## Adjusting Rate Limits

If you're experiencing rate limit errors or want to optimize performance:

1. **Decrease rate limits** if you're getting HTTP 429 errors or connection failures:
   - Reduce `rate` or increase `per` in `YF_RATE_LIMIT`
   - Decrease `max_workers` in `PARALLEL_PROCESSING`

2. **Increase rate limits** if performance is too slow and you're not hitting limits:
   - Increase `rate` or decrease `per` in `YF_RATE_LIMIT`
   - Increase `max_workers` in `PARALLEL_PROCESSING`

## Testing

You can test the rate limiting implementation using the provided test script:

```bash
cd backend
python test_parallel_scan.py
```

The test will report:
- Total execution time
- Number of tickers processed
- Processing rate (tickers per second)
- Current rate limit settings

## Monitoring

The application logs rate limiting information during execution:
- Worker thread count calculation
- Rate limit parameters
- Progress updates during scanning
- Rate limit timeouts if they occur