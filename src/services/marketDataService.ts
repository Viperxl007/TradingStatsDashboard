/**
 * Market Data Service
 * 
 * This service fetches real market data for chart rendering and analysis.
 * It provides OHLCV data that can be used with TradingView Lightweight Charts.
 */

import { CandlestickData, Time } from 'lightweight-charts';

// API configuration
const ALPHA_VANTAGE_API_KEY = 'ZB4OJAXNSXX8PAV6'; // Your premium AlphaVantage API key
const POLYGON_API_KEY = 'demo'; // Replace with actual API key

export interface MarketDataPoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Fetch real market data for a symbol with proper timeframe windows
 * @param symbol Stock symbol (e.g., 'AAPL', 'TSLA')
 * @param timeframe Timeframe ('1D', '1H', '5m', etc.)
 * @param period Historical period (e.g., '1w', '1mo', '6mo') - overrides limit
 * @param limit Number of data points to fetch (used if period not provided)
 * @returns Promise with market data
 */
export const fetchMarketData = async (
  symbol: string,
  timeframe: string = '1D',
  periodOrLimit: string | number = 100
): Promise<CandlestickData[]> => {
  // Handle period vs limit parameter
  let period: string;
  let limit: number;
  
  if (typeof periodOrLimit === 'string') {
    period = periodOrLimit;
    // Import timeframe utilities
    const { getTimeframeConfig, periodToDataPoints } = await import('../utils/timeframeConfig');
    const config = getTimeframeConfig(timeframe);
    limit = periodToDataPoints(period, timeframe);
    console.log(`🔍 [MarketData] Fetching REAL market data for ${symbol}`);
    console.log(`📊 [MarketData] Timeframe: ${timeframe}, Period: ${period}, Data Points: ${limit}`);
    console.log(`⚙️ [MarketData] Yahoo Interval: ${getYahooInterval(timeframe)}`);
  } else {
    limit = periodOrLimit;
    period = 'custom';
    console.log(`🔍 [MarketData] Fetching REAL market data for ${symbol} (${timeframe}) - Custom limit: ${limit}`);
  }
  
  try {
    // Skip AlphaVantage for crypto intraday data since it only supports daily
    const isCrypto = isCryptoSymbol(symbol);
    const isIntraday = ['1m', '5m', '15m', '1h', '4h'].includes(timeframe);
    
    if (!isCrypto || !isIntraday) {
      // Try AlphaVantage first (premium API) for stocks or crypto daily data
      console.log(`🔍 [MarketData] Trying AlphaVantage for ${symbol}...`);
      const alphaData = await fetchFromAlphaVantage(symbol, timeframe, limit, period);
      if (alphaData && alphaData.length > 0) {
        console.log(`✅ [MarketData] Successfully fetched ${alphaData.length} data points from AlphaVantage`);
        return alphaData;
      }
    } else {
      console.log(`⚠️ [MarketData] Skipping AlphaVantage for crypto intraday data (${symbol} ${timeframe}) - only supports daily`);
    }
  } catch (error) {
    console.log('🔄 [MarketData] AlphaVantage failed, trying Hyperliquid for crypto...', error);
  }
  
  // Try Hyperliquid for crypto tokens if AlphaVantage failed
  if (isCryptoSymbol(symbol)) {
    try {
      console.log(`🔍 [MarketData] Trying Hyperliquid for crypto ${symbol}...`);
      const hyperliquidData = await fetchFromHyperliquid(symbol, timeframe, limit, period);
      if (hyperliquidData && hyperliquidData.length > 0) {
        console.log(`✅ [MarketData] Successfully fetched ${hyperliquidData.length} data points from Hyperliquid`);
        return hyperliquidData;
      }
    } catch (error) {
      console.log('🔄 [MarketData] Hyperliquid failed, trying backend API...', error);
    }
  }
  
  try {
    // Try backend API (uses yfinance) - pass period directly, not limit
    console.log(`Trying backend API for ${symbol}...`);
    const backendData = await fetchFromBackend(symbol, timeframe, period);
    if (backendData && backendData.length > 0) {
      console.log(`✅ Successfully fetched ${backendData.length} data points from backend`);
      return backendData;
    }
  } catch (error) {
    console.log('Backend API failed, trying CORS proxy...', error);
  }
  
  try {
    // Last resort: CORS proxy for Yahoo Finance
    const yahooSymbol = convertToYahooSymbol(symbol);
    console.log(`Trying CORS proxy for ${yahooSymbol}...`);
    const data = await fetchFromYahooFinanceWithProxy(yahooSymbol, timeframe, limit, period);
    if (data && data.length > 0) {
      console.log(`✅ Successfully fetched ${data.length} data points via CORS proxy`);
      return data;
    }
  } catch (error) {
    console.log('CORS proxy failed:', error);
  }
  
  // If all methods fail, throw error
  console.error('CRITICAL: Cannot get real market data for production trading tool - all sources failed');
  throw new Error(`Failed to fetch real market data for ${symbol}: All data sources failed`);
};

/**
 * Convert symbol to Yahoo Finance format
 */
const convertToYahooSymbol = (symbol: string): string => {
  // Handle crypto pairs
  if (symbol.includes('USD')) {
    const base = symbol.replace('USD', '');
    return `${base}-USD`;
  }
  
  // Handle other common formats
  const symbolMap: { [key: string]: string } = {
    'AVAXUSD': 'AVAX-USD',
    'BTCUSD': 'BTC-USD',
    'ETHUSD': 'ETH-USD',
    'SOLUSD': 'SOL-USD',
    'ADAUSD': 'ADA-USD',
    'DOTUSD': 'DOT-USD',
    'LINKUSD': 'LINK-USD',
    'MATICUSD': 'MATIC-USD',
  };
  
  return symbolMap[symbol] || symbol;
};

/**
 * Fetch data from Yahoo Finance via CORS proxy
 */
const fetchFromYahooFinanceWithProxy = async (
  symbol: string,
  timeframe: string,
  limit: number,
  period?: string
): Promise<CandlestickData[]> => {
  try {
    // Use a CORS proxy service
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    
    // Calculate date range based on timeframe and period
    const endDate = new Date();
    const startDate = new Date();
    
    // For intraday timeframes, calculate more precisely based on period
    if (period && typeof period === 'string') {
      const periodMatch = period.match(/^(\d+)([dwmy])$/);
      if (periodMatch) {
        const [, num, unit] = periodMatch;
        const value = parseInt(num);
        
        switch (unit) {
          case 'd':
            startDate.setDate(endDate.getDate() - value);
            break;
          case 'w':
            startDate.setDate(endDate.getDate() - (value * 7));
            break;
          case 'm':
            startDate.setMonth(endDate.getMonth() - value);
            break;
          case 'y':
            startDate.setFullYear(endDate.getFullYear() - value);
            break;
        }
      } else {
        // Fallback to original calculation
        startDate.setDate(endDate.getDate() - (limit * getDaysMultiplier(timeframe)));
      }
    } else {
      // Use original calculation for other timeframes
      startDate.setDate(endDate.getDate() - (limit * getDaysMultiplier(timeframe)));
    }
    
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    const interval = getYahooInterval(timeframe);
    
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false`;
    const url = proxyUrl + encodeURIComponent(yahooUrl);
    
    console.log(`🌐 [Yahoo Proxy] Fetching ${symbol} with timeframe: ${timeframe}, interval: ${interval}`);
    console.log(`📅 [Yahoo Proxy] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`🔗 [Yahoo Proxy] URL: ${yahooUrl}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error('Invalid Yahoo Finance response - no data available');
    }
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const { open, high, low, close } = quote;
    
    const candlestickData: CandlestickData[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (open[i] != null && high[i] != null && low[i] != null && close[i] != null) {
        candlestickData.push({
          time: timestamps[i] as Time,
          open: Number(open[i].toFixed(2)),
          high: Number(high[i].toFixed(2)),
          low: Number(low[i].toFixed(2)),
          close: Number(close[i].toFixed(2))
        });
      }
    }
    
    if (candlestickData.length === 0) {
      throw new Error('No valid price data found in response');
    }
    
    return candlestickData.slice(-limit);
  } catch (error) {
    console.warn('CORS proxy fetch failed:', error);
    throw error;
  }
};

/**
 * Fetch data from backend API
 */
const fetchFromBackend = async (
  symbol: string,
  timeframe: string,
  period?: string
): Promise<CandlestickData[]> => {
  try {
    console.log(`🔧 [Backend API] Fetching ${symbol} with timeframe: ${timeframe}, period: ${period}`);
    
    // Build URL with period instead of limit
    let url = `http://localhost:5000/api/market-data/${symbol}?timeframe=${timeframe}`;
    if (period) {
      url += `&period=${period}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('No data returned from backend API');
    }
    
    return data.data;
  } catch (error) {
    console.warn('Backend API fetch failed:', error);
    throw error;
  }
};

/**
 * Fetch data from Yahoo Finance API (direct - will fail due to CORS)
 */
const fetchFromYahooFinance = async (
  symbol: string,
  timeframe: string,
  limit: number,
  period?: string
): Promise<CandlestickData[]> => {
  try {
    // Calculate date range based on timeframe and period
    const endDate = new Date();
    const startDate = new Date();
    
    // For intraday timeframes, calculate more precisely based on period
    if (period && typeof period === 'string') {
      const periodMatch = period.match(/^(\d+)([dwmy])$/);
      if (periodMatch) {
        const [, num, unit] = periodMatch;
        const value = parseInt(num);
        
        switch (unit) {
          case 'd':
            startDate.setDate(endDate.getDate() - value);
            break;
          case 'w':
            startDate.setDate(endDate.getDate() - (value * 7));
            break;
          case 'm':
            startDate.setMonth(endDate.getMonth() - value);
            break;
          case 'y':
            startDate.setFullYear(endDate.getFullYear() - value);
            break;
        }
      } else {
        // Fallback to original calculation
        startDate.setDate(endDate.getDate() - (limit * getDaysMultiplier(timeframe)));
      }
    } else {
      // Use original calculation for other timeframes
      startDate.setDate(endDate.getDate() - (limit * getDaysMultiplier(timeframe)));
    }
    
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);
    const interval = getYahooInterval(timeframe);
    
    // Use Yahoo Finance API with CORS handling
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false`;
    
    console.log(`Fetching from Yahoo Finance: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error('Invalid Yahoo Finance response - no data available');
    }
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const { open, high, low, close } = quote;
    
    const candlestickData: CandlestickData[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      if (open[i] != null && high[i] != null && low[i] != null && close[i] != null) {
        candlestickData.push({
          time: timestamps[i] as Time,
          open: Number(open[i].toFixed(2)),
          high: Number(high[i].toFixed(2)),
          low: Number(low[i].toFixed(2)),
          close: Number(close[i].toFixed(2))
        });
      }
    }
    
    if (candlestickData.length === 0) {
      throw new Error('No valid price data found in Yahoo Finance response');
    }
    
    return candlestickData.slice(-limit); // Return last 'limit' data points
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('Yahoo Finance CORS error - this is expected in development');
      throw new Error('Yahoo Finance blocked by CORS policy');
    }
    console.warn('Yahoo Finance fetch failed:', error);
    throw error;
  }
};

/**
 * Fetch data from Alpha Vantage API
 */
const fetchFromAlphaVantage = async (
  symbol: string,
  timeframe: string,
  limit: number,
  period?: string
): Promise<CandlestickData[]> => {
  try {
    // Convert symbol for AlphaVantage (crypto symbols need different format)
    const alphaSymbol = convertToAlphaVantageSymbol(symbol);
    console.log(`Using AlphaVantage symbol: ${alphaSymbol}`);
    
    // For crypto, use digital currency endpoint
    if (isCryptoSymbol(symbol)) {
      return await fetchCryptoFromAlphaVantage(alphaSymbol, timeframe, limit);
    }
    
    // For stocks, use regular time series
    const function_name = getAlphaVantageFunction(timeframe);
    const interval = getAlphaVantageInterval(timeframe);
    
    // Determine output size based on requested data points
    // AlphaVantage compact returns ~100 recent points, full returns up to 20 years of data
    const outputSize = limit > 100 ? 'full' : 'compact';
    console.log(`📊 [AlphaVantage] Using outputsize=${outputSize} for ${limit} requested data points`);
    
    let url = `https://www.alphavantage.co/query?function=${function_name}&symbol=${alphaSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=${outputSize}`;
    
    if (interval) {
      url += `&interval=${interval}`;
    }
    
    console.log(`AlphaVantage URL: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message'] || data['Note']) {
      throw new Error(data['Error Message'] || data['Note']);
    }
    
    // Handle different response formats
    const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
    if (!timeSeriesKey || !data[timeSeriesKey]) {
      console.log('AlphaVantage response:', data);
      throw new Error('Invalid Alpha Vantage response - no time series data');
    }
    
    const timeSeries = data[timeSeriesKey];
    const candlestickData: CandlestickData[] = [];
    
    Object.entries(timeSeries).forEach(([dateStr, values]: [string, any]) => {
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000) as Time;
      candlestickData.push({
        time: timestamp,
        open: Number(parseFloat(values['1. open']).toFixed(2)),
        high: Number(parseFloat(values['2. high']).toFixed(2)),
        low: Number(parseFloat(values['3. low']).toFixed(2)),
        close: Number(parseFloat(values['4. close']).toFixed(2))
      });
    });
    
    // Sort by time and return last 'limit' data points
    return candlestickData
      .sort((a, b) => (a.time as number) - (b.time as number))
      .slice(-limit);
  } catch (error) {
    console.warn('Alpha Vantage fetch failed:', error);
    throw error;
  }
};

/**
 * Fetch crypto data from Alpha Vantage
 */
const fetchCryptoFromAlphaVantage = async (
  symbol: string,
  timeframe: string,
  limit: number
): Promise<CandlestickData[]> => {
  try {
    // Extract base currency (e.g., AVAX from AVAXUSD)
    const baseCurrency = symbol.replace('USD', '');
    
    // Use digital currency daily endpoint for crypto
    const url = `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${baseCurrency}&market=USD&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    console.log(`AlphaVantage Crypto URL: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage Crypto API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message'] || data['Note']) {
      throw new Error(data['Error Message'] || data['Note']);
    }
    
    const timeSeries = data['Time Series (Digital Currency Daily)'];
    if (!timeSeries) {
      console.log('AlphaVantage crypto response:', data);
      throw new Error('Invalid Alpha Vantage crypto response');
    }
    
    // Debug: Log first entry to see the structure
    const firstEntry = Object.entries(timeSeries)[0];
    console.log('First AlphaVantage entry:', firstEntry);
    
    const candlestickData: CandlestickData[] = [];
    
    Object.entries(timeSeries).forEach(([dateStr, values]: [string, any]) => {
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000) as Time;
      
      // Parse values with proper error handling
      const open = parseFloat(values['1. open']);
      const high = parseFloat(values['2. high']);
      const low = parseFloat(values['3. low']);
      const close = parseFloat(values['4. close']);
      
      // Only add valid data points
      if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
        candlestickData.push({
          time: timestamp,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2))
        });
      } else {
        console.warn(`Invalid data for ${dateStr}:`, values);
      }
    });
    
    // Sort by time and return last 'limit' data points
    return candlestickData
      .sort((a, b) => (a.time as number) - (b.time as number))
      .slice(-limit);
  } catch (error) {
    console.warn('Alpha Vantage crypto fetch failed:', error);
    throw error;
  }
};

/**
 * Convert symbol to AlphaVantage format
 */
const convertToAlphaVantageSymbol = (symbol: string): string => {
  // For crypto, keep as is (will be handled in crypto function)
  if (isCryptoSymbol(symbol)) {
    return symbol;
  }
  
  // For stocks, return as is
  return symbol;
};

/**
 * Check if symbol is a crypto symbol
 */
const isCryptoSymbol = (symbol: string): boolean => {
  return symbol.includes('USD') && !['EURUSD', 'GBPUSD', 'JPYUSD'].includes(symbol);
};

// NO SAMPLE DATA - This is a production trading tool that requires REAL market data only

/**
 * Helper functions for API mapping
 */
const getDaysMultiplier = (timeframe: string): number => {
  switch (timeframe) {
    case '1m': return 0.1;
    case '5m': return 0.5;
    case '15m': return 1;
    case '1h': return 2;
    case '4h': return 7;
    case '1D': return 1;
    case '1W': return 7;
    default: return 1;
  }
};

const getYahooInterval = (timeframe: string): string => {
  switch (timeframe) {
    case '1m': return '1m';
    case '5m': return '5m';
    case '15m': return '15m';
    case '1h': return '1h';
    case '4h': return '1h'; // Yahoo doesn't have 4h, use 1h
    case '1D': return '1d';
    case '1W': return '1wk';
    default: return '1d';
  }
};

const getAlphaVantageFunction = (timeframe: string): string => {
  if (['1m', '5m', '15m', '1h'].includes(timeframe)) {
    return 'TIME_SERIES_INTRADAY';
  }
  return 'TIME_SERIES_DAILY';
};

const getAlphaVantageInterval = (timeframe: string): string | null => {
  switch (timeframe) {
    case '1m': return '1min';
    case '5m': return '5min';
    case '15m': return '15min';
    case '1h': return '60min';
    default: return null;
  }
};

/**
 * Fetch data from Hyperliquid Perps Dex Info API
 */
const fetchFromHyperliquid = async (
  symbol: string,
  timeframe: string,
  limit: number,
  period?: string
): Promise<CandlestickData[]> => {
  try {
    // Convert symbol to Hyperliquid format
    const hyperliquidSymbol = convertToHyperliquidSymbol(symbol);
    console.log(`🔍 [Hyperliquid] Using symbol: ${hyperliquidSymbol} for ${symbol}`);
    
    // Convert timeframe to Hyperliquid interval
    const interval = getHyperliquidInterval(timeframe);
    console.log(`📊 [Hyperliquid] Using interval: ${interval} for timeframe: ${timeframe}`);
    
    // Calculate date range
    const endTime = Date.now();
    let startTime = endTime;
    
    if (period && typeof period === 'string') {
      startTime = calculateStartTimeFromPeriod(period, endTime);
    } else {
      // Calculate based on limit and timeframe - use more generous multipliers for better chart analysis
      const intervalMs = getIntervalMilliseconds(timeframe);
      const enhancedLimit = Math.max(limit * 3, 500); // At least 500 data points or 3x requested
      startTime = endTime - (enhancedLimit * intervalMs);
    }
    
    const daysDiff = Math.round((endTime - startTime) / (24 * 60 * 60 * 1000));
    console.log(`📅 [Hyperliquid] Date range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    console.log(`📊 [Hyperliquid] Requesting ~${daysDiff} days of ${interval} data for enhanced chart analysis`);
    
    // Prepare request body
    const requestBody = {
      type: "candleSnapshot",
      req: {
        coin: hyperliquidSymbol,
        interval: interval,
        startTime: startTime,
        endTime: endTime
      }
    };
    
    console.log(`🌐 [Hyperliquid] Request body:`, requestBody);
    
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Hyperliquid API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log('📊 [Hyperliquid] Response:', data);
      throw new Error('No data returned from Hyperliquid API');
    }
    
    console.log(`📊 [Hyperliquid] Received ${data.length} candles`);
    
    // Convert Hyperliquid format to TradingView Lightweight Charts format
    const candlestickData: CandlestickData[] = data.map((candle: any) => ({
      time: Math.floor(candle.t / 1000) as Time, // Convert from milliseconds to seconds
      open: Number(parseFloat(candle.o).toFixed(2)),
      high: Number(parseFloat(candle.h).toFixed(2)),
      low: Number(parseFloat(candle.l).toFixed(2)),
      close: Number(parseFloat(candle.c).toFixed(2))
    }));
    
    // Sort by time and return last 'limit' data points
    const sortedData = candlestickData
      .sort((a, b) => (a.time as number) - (b.time as number))
      .slice(-limit);
    
    console.log(`✅ [Hyperliquid] Processed ${sortedData.length} data points`);
    return sortedData;
    
  } catch (error) {
    console.warn('🔴 [Hyperliquid] Fetch failed:', error);
    throw error;
  }
};

/**
 * Convert symbol to Hyperliquid format
 */
const convertToHyperliquidSymbol = (symbol: string): string => {
  // Remove USD suffix and return base currency
  // Hyperliquid uses just the base currency (e.g., "BTC" not "BTCUSD")
  if (symbol.endsWith('USD')) {
    return symbol.replace('USD', '');
  }
  
  // Handle common symbol mappings
  const symbolMap: { [key: string]: string } = {
    'AVAXUSD': 'AVAX',
    'BTCUSD': 'BTC',
    'ETHUSD': 'ETH',
    'SOLUSD': 'SOL',
    'ADAUSD': 'ADA',
    'DOTUSD': 'DOT',
    'LINKUSD': 'LINK',
    'MATICUSD': 'MATIC',
    'ALGOUSD': 'ALGO',
    'ATOMUSD': 'ATOM',
    'UNIUSD': 'UNI',
    'AAVEUSD': 'AAVE',
    'COMPUSD': 'COMP',
    'MKRUSD': 'MKR',
    'SNXUSD': 'SNX',
    'YFIUSD': 'YFI',
    'SUSHIUSD': 'SUSHI',
    'CRVUSD': 'CRV',
    'BALUSD': 'BAL',
    'RENUSD': 'REN',
    'KNCUSD': 'KNC',
    'ZRXUSD': 'ZRX',
    'BANDUSD': 'BAND',
    'STORJUSD': 'STORJ',
    'MANAUSD': 'MANA',
    'SANDUSD': 'SAND',
    'AXSUSD': 'AXS',
    'ENJUSD': 'ENJ',
    'CHZUSD': 'CHZ',
    'FLOWUSD': 'FLOW',
    'ICPUSD': 'ICP',
    'FILUSD': 'FIL',
    'ARUSD': 'AR',
    'GRTUSD': 'GRT',
    'LRCUSD': 'LRC',
    'SKLUSD': 'SKL',
    'ANKRUSD': 'ANKR',
    'CTSIUSD': 'CTSI',
    'OCEANUSD': 'OCEAN',
    'NMRUSD': 'NMR',
    'FETUSD': 'FET',
    'NUUSD': 'NU',
    'KEEPUSD': 'KEEP',
    'TRBEUSD': 'TRBE'
  };
  
  return symbolMap[symbol] || symbol;
};

/**
 * Convert timeframe to Hyperliquid interval
 */
const getHyperliquidInterval = (timeframe: string): string => {
  // Hyperliquid supported intervals: "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"
  const intervalMap: { [key: string]: string } = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1D': '1d',
    '1W': '1w'
  };
  
  return intervalMap[timeframe] || '1h'; // Default to 1h if not found
};

/**
 * Get interval in milliseconds for timeframe calculations
 */
const getIntervalMilliseconds = (timeframe: string): number => {
  const intervalMap: { [key: string]: number } = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000
  };
  
  return intervalMap[timeframe] || 60 * 60 * 1000; // Default to 1 hour
};

/**
 * Calculate start time from period string
 */
const calculateStartTimeFromPeriod = (period: string, endTime: number): number => {
  const periodMatch = period.match(/^(\d+)([dwmy])$/);
  if (periodMatch) {
    const [, num, unit] = periodMatch;
    const value = parseInt(num);
    
    switch (unit) {
      case 'd':
        return endTime - (value * 24 * 60 * 60 * 1000);
      case 'w':
        return endTime - (value * 7 * 24 * 60 * 60 * 1000);
      case 'm':
        return endTime - (value * 30 * 24 * 60 * 60 * 1000); // Approximate month
      case 'y':
        return endTime - (value * 365 * 24 * 60 * 60 * 1000); // Approximate year
      default:
        return endTime - (30 * 24 * 60 * 60 * 1000); // Default to 30 days for better analysis
    }
  }
  
  // Handle common period formats and provide more generous defaults
  const periodMap: { [key: string]: number } = {
    '1d': 1 * 24 * 60 * 60 * 1000,
    '5d': 5 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '14d': 14 * 24 * 60 * 60 * 1000,
    '1mo': 30 * 24 * 60 * 60 * 1000,
    '3mo': 90 * 24 * 60 * 60 * 1000,
    '6mo': 180 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
    '2y': 730 * 24 * 60 * 60 * 1000,
    '5y': 1825 * 24 * 60 * 60 * 1000,
    'max': 1825 * 24 * 60 * 60 * 1000 // 5 years max for Hyperliquid
  };
  
  if (period in periodMap) {
    return endTime - periodMap[period];
  }
  
  // Fallback to 30 days for better chart analysis
  return endTime - (30 * 24 * 60 * 60 * 1000);
};