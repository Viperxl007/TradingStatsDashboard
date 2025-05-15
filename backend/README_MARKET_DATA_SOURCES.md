# Market Data Sources

This document describes how to configure and use different market data sources in the Trading Stats Dashboard application.

## Overview

The application now supports multiple market data sources:

1. **yfinance** (default) - Yahoo Finance API
2. **AlphaVantage** - Alpha Vantage API

The market data source is configured using an environment variable, and the application will use the specified source for all market data requests.

## Configuration

There are three ways to configure the market data source:

### 1. Using local_config.py (Recommended)

The easiest way to configure the market data source is to create a `local_config.py` file in the backend directory. This file is not tracked by version control, so you can make changes without affecting the main codebase.

1. Copy the `local_config.example.py` file to `local_config.py`:
   ```bash
   cp backend/local_config.example.py backend/local_config.py
   ```

2. Edit `local_config.py` to set your preferred market data source:
   ```python
   # Options: 'yfinance' or 'alphavantage'
   MARKET_DATA_SOURCE = 'alphavantage'  # Change to 'yfinance' if you want to use Yahoo Finance
   
   # AlphaVantage API key (only used if MARKET_DATA_SOURCE is 'alphavantage')
   ALPHAVANTAGE_API_KEY = 'your-api-key-here'  # Replace with your own API key
   ```

3. Run the application as usual:
   ```bash
   npm start
   ```

### 2. Using Environment Variables

The market data source can also be configured using environment variables. This can be set in your environment before running the application.

```bash
# On Windows
set MARKET_DATA_SOURCE=alphavantage
npm start

# On Linux/Mac
export MARKET_DATA_SOURCE=alphavantage
npm start
```

### 3. Modifying config.py (Not Recommended)

You can also modify the `config.py` file directly, but this is not recommended as it will affect version control.

```python
# Options: 'yfinance' or 'alphavantage'
MARKET_DATA_SOURCE = os.environ.get('MARKET_DATA_SOURCE', 'yfinance')
```

By default, the application uses `yfinance` as the market data source.

### AlphaVantage API Key

If you choose to use AlphaVantage as your market data source, you need to provide an API key. This can be set in `local_config.py`, using the `ALPHAVANTAGE_API_KEY` environment variable, or directly in the `config.py` file.

```python
ALPHAVANTAGE_API_KEY = 'your-api-key-here'
```

A premium AlphaVantage API key is already configured in the application, but you can replace it with your own key if needed.

## Usage

### Running with Default Settings (yfinance)

No additional configuration is needed to use the default yfinance data source. Simply run the application as usual:

```bash
python run.py
```

### Running with AlphaVantage

To use AlphaVantage as the market data source, set the `MARKET_DATA_SOURCE` environment variable before running the application:

```bash
# On Windows
set MARKET_DATA_SOURCE=alphavantage
python run.py

# On Linux/Mac
export MARKET_DATA_SOURCE=alphavantage
python run.py
```

### Testing the Market Data Sources

A test script is provided to verify that both market data sources are working correctly:

```bash
python test_market_data.py
```

This script tests both yfinance and AlphaVantage providers and reports the results.

## Implementation Details

The market data abstraction is implemented in the `app/market_data.py` module. This module provides a factory class `MarketDataProvider` that creates the appropriate provider based on the configuration.

Each provider implements the `BaseMarketDataProvider` interface, which defines the following methods:

- `get_current_price(ticker)` - Get the current price for a ticker
- `get_historical_prices(ticker, start_date, end_date)` - Get historical daily price data for a stock
- `get_historical_earnings_dates(ticker, start_date)` - Get historical earnings announcement dates for a stock
- `get_earnings_calendar(date)` - Get earnings calendar for a specific date

The application code uses the market data provider through this interface, without needing to know which specific provider is being used.

## Limitations

### AlphaVantage Limitations

- AlphaVantage does not provide an earnings calendar API, so the `get_earnings_calendar` method returns an empty list when using the AlphaVantage provider.
- AlphaVantage has stricter rate limits than yfinance, so the application may need to wait longer between API calls.
- Some AlphaVantage endpoints require a premium API key, which is already configured in the application.

## Troubleshooting

If you encounter issues with the market data sources, check the following:

1. Verify that the `MARKET_DATA_SOURCE` environment variable is set correctly.
2. If using AlphaVantage, verify that the `ALPHAVANTAGE_API_KEY` is valid.
3. Check the application logs for error messages related to the market data provider.
4. Run the `test_market_data.py` script to verify that the providers are working correctly.

If you continue to experience issues, try switching to the other market data source to see if the problem persists.