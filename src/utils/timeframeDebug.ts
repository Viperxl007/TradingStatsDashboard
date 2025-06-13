/**
 * Debug utilities for timeframe testing
 */

export const testTimeframeMapping = () => {
  console.log('🧪 Testing Timeframe Mapping:');
  
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];
  
  timeframes.forEach(tf => {
    // Test Yahoo interval mapping
    const yahooInterval = getYahooInterval(tf);
    console.log(`${tf} -> Yahoo: ${yahooInterval}`);
  });
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

export const debugMarketDataCall = (symbol: string, timeframe: string, period: string) => {
  console.log('🔍 Debug Market Data Call:');
  console.log(`Symbol: ${symbol}`);
  console.log(`Timeframe: ${timeframe}`);
  console.log(`Period: ${period}`);
  console.log(`Yahoo Interval: ${getYahooInterval(timeframe)}`);
  
  // Calculate expected data points
  const { periodToDataPoints } = require('./timeframeConfig');
  const dataPoints = periodToDataPoints(period, timeframe);
  console.log(`Expected Data Points: ${dataPoints}`);
};