# CoinMarketCap Historical Data Collection Setup

This guide explains how to set up and use the CoinMarketCap service to collect real historical market data with accurate dominance ratios for your regime indicator.

## Why CoinMarketCap Instead of CoinGecko?

**The Problem with CoinGecko:**
- Uses **fixed current dominance ratios** applied to all historical data
- Creates **synthetic historical relationships** that never existed
- **Poisons regime indicator data** with inaccurate dominance calculations
- No access to real historical total market cap data on free tier

**The CoinMarketCap Solution:**
- Provides **REAL historical total market cap** data
- Includes **REAL historical BTC dominance** percentages
- No synthetic calculations or data poisoning
- Accurate historical relationships for regime analysis

## Setup Instructions

### 1. Get CoinMarketCap API Key

1. Go to [CoinMarketCap API](https://coinmarketcap.com/api/)
2. Sign up for the **Hobbyist tier** ($29/month)
3. Get your API key from the dashboard

**Hobbyist Tier Benefits:**
- 10,000 API calls per month
- Access to historical endpoints
- 3+ months of historical data
- Real-time and historical global metrics

### 2. Set Environment Variable

```bash
# Windows
set CMC_API_KEY=your-api-key-here

# Linux/Mac
export CMC_API_KEY=your-api-key-here

# Or add to .env file
echo "CMC_API_KEY=your-api-key-here" >> .env
```

### 3. Install Dependencies

```bash
cd backend
pip install aiohttp
```

## Usage

### Test API Connection

```bash
cd backend
python services/coinmarketcap_service.py
```

This will test your API key and show current market data.

### Collect Historical Data

```bash
cd backend
python collect_historical_data_cmc.py
```

This will:
1. Test your API connection
2. Collect 3 months of REAL historical data
3. Store it in the database
4. Verify data quality

### Expected Output

```
🚀 CoinMarketCap Historical Market Data Collection Script
======================================================================
🔧 Testing API connection...
✅ API connection successful!
   Current total market cap: $2,500,000,000,000
   Current BTC dominance: 58.45%
📅 Collecting 3 months (90 days) of REAL historical market data...
🔍 Fetching REAL historical data from CoinMarketCap API...
📊 Fetching real global market metrics...
₿ Fetching real BTC historical data...
Ξ Fetching real ETH historical data...
✅ Retrieved 90 REAL data points from CoinMarketCap
💾 Storing data in database...
📈 Progress: 10/90 (11.1%) - Date: 2024-11-07, BTC Dom: 58.23%
📈 Progress: 20/90 (22.2%) - Date: 2024-11-17, BTC Dom: 59.12%
...
✅ Database storage complete: 90 successful, 0 failed
📊 COLLECTION STATISTICS:
   Total data points: 90
   Successful inserts: 90
   Success rate: 100.0%
✅ Historical data collection completed successfully!
🎯 REAL historical data is ready for regime indicator analysis!
💡 You can now use the regime indicator with accurate historical dominance ratios
🚫 No synthetic data poisoning - all ratios are historically accurate
```

## Data Quality Verification

The script automatically verifies data quality and reports:

- **Data Points**: Number of historical records collected
- **Date Range**: Time period covered
- **Data Gaps**: Missing data periods
- **CoinMarketCap Data Percentage**: How much data comes from CMC vs other sources
- **Data Source Quality**: REAL vs MIXED vs SYNTHETIC

## API Endpoints Used

### Global Metrics Historical
- **Endpoint**: `/v1/global-metrics/quotes/historical`
- **Purpose**: Get real historical total market cap and BTC dominance
- **Data**: Total market cap, BTC dominance, ETH dominance, volume

### Cryptocurrency Quotes Historical
- **Endpoint**: `/v1/cryptocurrency/quotes/historical`
- **Purpose**: Get real historical data for individual cryptocurrencies
- **Data**: Price, market cap, volume, percent change

## Rate Limiting

The service includes intelligent rate limiting:
- **Hobbyist Tier**: 10,000 calls/month ≈ 333/day
- **Burst Protection**: Up to 5 rapid calls
- **Auto-retry**: Handles temporary failures
- **Backoff Strategy**: Exponential delay on errors

## Error Handling

Common errors and solutions:

### Invalid API Key
```
❌ CoinMarketCap API error: Invalid API key or insufficient permissions
```
**Solution**: Check your API key and ensure it's for the hobbyist tier.

### Credit Limit Exceeded
```
❌ CoinMarketCap API error: API credit limit exceeded or subscription required
```
**Solution**: Check your monthly usage or upgrade your plan.

### Rate Limited
```
⚠️ Rate limited. Waiting 60 seconds
```
**Solution**: The script will automatically wait and retry.

## Database Integration

The collected data is stored in the `macro_market_data` table with:

- **Real Total Market Cap**: From CMC global metrics
- **Real BTC Dominance**: From CMC global metrics  
- **Real BTC/ETH Data**: From CMC cryptocurrency quotes
- **Calculated Alt Metrics**: Derived from real data
- **Data Quality Score**: 1.0 for all real CMC data
- **Data Source**: `coinmarketcap_real_historical`

## Comparison: Before vs After

### Before (CoinGecko - BROKEN)
```python
# Uses current dominance applied to all historical data
current_btc_dominance = 58.45%  # Today's value
historical_total_mcap = btc_market_cap / 0.5845  # WRONG!
# This creates fake historical relationships
```

### After (CoinMarketCap - CORRECT)
```python
# Uses real historical dominance for each date
2024-01-01: btc_dominance = 52.3%  # Real historical value
2024-02-01: btc_dominance = 54.1%  # Real historical value  
2024-03-01: btc_dominance = 58.7%  # Real historical value
# This preserves real historical relationships
```

## Next Steps

Once you have collected the historical data:

1. **Verify Data Quality**: Check the quality report
2. **Test Regime Indicator**: Run your regime analysis
3. **Monitor Data**: Set up regular updates
4. **Optimize Usage**: Monitor API call usage

## Cost Analysis

**CoinMarketCap Hobbyist Tier**: $29/month
- 10,000 API calls
- Real historical data
- No data poisoning
- Professional-grade accuracy

**Value Proposition**: 
- Eliminates regime indicator data poisoning
- Provides historically accurate dominance ratios
- Enables reliable macro market analysis
- Professional data quality for trading decisions

## Support

If you encounter issues:

1. Check the logs in `historical_data_collection_cmc.log`
2. Verify your API key and subscription status
3. Test with smaller date ranges first
4. Monitor your API usage on the CMC dashboard

The investment in accurate historical data is essential for reliable regime indicator analysis.