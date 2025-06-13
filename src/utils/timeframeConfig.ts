/**
 * Timeframe Configuration Utilities
 * 
 * Defines industry-standard historical windows for different timeframes
 * and provides utilities for timeframe management.
 */

export interface TimeframeConfig {
  value: string;
  label: string;
  description: string;
  standardPeriod: string; // Industry standard lookback period
  dataPoints: number; // Number of data points to fetch
  minPeriod: string; // Minimum recommended period
  maxPeriod: string; // Maximum recommended period
  category: 'intraday' | 'daily' | 'weekly' | 'monthly';
}

/**
 * Industry-standard timeframe configurations
 * Based on common trading practices and technical analysis standards
 */
export const TIMEFRAME_CONFIGS: Record<string, TimeframeConfig> = {
  '1m': {
    value: '1m',
    label: '1 Minute',
    description: 'Scalping and very short-term trading',
    standardPeriod: '1d', // 1 day of 1-minute data
    dataPoints: 390, // ~6.5 hours of trading
    minPeriod: '4h',
    maxPeriod: '3d',
    category: 'intraday'
  },
  '5m': {
    value: '5m',
    label: '5 Minutes',
    description: 'Short-term intraday trading',
    standardPeriod: '3d', // 3 days of 5-minute data
    dataPoints: 234, // ~3 days of trading hours
    minPeriod: '1d',
    maxPeriod: '1w',
    category: 'intraday'
  },
  '15m': {
    value: '15m',
    label: '15 Minutes',
    description: 'Intraday swing trading',
    standardPeriod: '1w', // 1 week of 15-minute data
    dataPoints: 156, // ~1 week of trading hours
    minPeriod: '2d',
    maxPeriod: '2w',
    category: 'intraday'
  },
  '1h': {
    value: '1h',
    label: '1 Hour',
    description: 'Short to medium-term trading',
    standardPeriod: '1mo', // 1 month of hourly data
    dataPoints: 168, // ~1 month of trading hours
    minPeriod: '1w',
    maxPeriod: '3mo',
    category: 'intraday'
  },
  '4h': {
    value: '4h',
    label: '4 Hours',
    description: 'Medium-term swing trading',
    standardPeriod: '3mo', // 3 months of 4-hour data
    dataPoints: 180, // ~3 months
    minPeriod: '2w',
    maxPeriod: '6mo',
    category: 'daily'
  },
  '1D': {
    value: '1D',
    label: '1 Day',
    description: 'Daily analysis and position trading',
    standardPeriod: '6mo', // 6 months of daily data
    dataPoints: 126, // ~6 months of trading days
    minPeriod: '1mo',
    maxPeriod: '2y',
    category: 'daily'
  },
  '1W': {
    value: '1W',
    label: '1 Week',
    description: 'Long-term trend analysis',
    standardPeriod: '2y', // 2 years of weekly data
    dataPoints: 104, // ~2 years
    minPeriod: '6mo',
    maxPeriod: '5y',
    category: 'weekly'
  },
  '1M': {
    value: '1M',
    label: '1 Month',
    description: 'Very long-term analysis',
    standardPeriod: '5y', // 5 years of monthly data
    dataPoints: 60, // ~5 years
    minPeriod: '2y',
    maxPeriod: '10y',
    category: 'monthly'
  }
};

/**
 * Get timeframe configuration
 */
export const getTimeframeConfig = (timeframe: string): TimeframeConfig => {
  return TIMEFRAME_CONFIGS[timeframe] || TIMEFRAME_CONFIGS['1D'];
};

/**
 * Get all available timeframes grouped by category
 */
export const getTimeframesByCategory = () => {
  const categories = {
    intraday: [] as TimeframeConfig[],
    daily: [] as TimeframeConfig[],
    weekly: [] as TimeframeConfig[],
    monthly: [] as TimeframeConfig[]
  };

  Object.values(TIMEFRAME_CONFIGS).forEach(config => {
    categories[config.category].push(config);
  });

  return categories;
};

/**
 * Convert period string to data points for API calls
 */
export const periodToDataPoints = (period: string, timeframe: string): number => {
  const config = getTimeframeConfig(timeframe);
  
  // Parse period (e.g., "1d", "1w", "1mo", "1y")
  const match = period.match(/^(\d+)(d|w|mo|y)$/);
  if (!match) {
    return config.dataPoints; // fallback to standard
  }

  const [, num, unit] = match;
  const value = parseInt(num);

  // Calculate approximate data points based on timeframe and period
  switch (timeframe) {
    case '1m':
      switch (unit) {
        case 'd': return value * 390; // trading minutes per day
        case 'w': return value * 1950; // trading minutes per week
        case 'mo': return value * 8190; // trading minutes per month
        default: return config.dataPoints;
      }
    case '5m':
      switch (unit) {
        case 'd': return value * 78; // 5-min intervals per day
        case 'w': return value * 390; // 5-min intervals per week
        case 'mo': return value * 1638; // 5-min intervals per month
        default: return config.dataPoints;
      }
    case '15m':
      switch (unit) {
        case 'd': return value * 26; // 15-min intervals per day
        case 'w': return value * 130; // 15-min intervals per week
        case 'mo': return value * 546; // 15-min intervals per month
        default: return config.dataPoints;
      }
    case '1h':
      switch (unit) {
        case 'd': return Math.round(value * 6.5); // trading hours per day
        case 'w': return Math.round(value * 32.5); // trading hours per week
        case 'mo': return Math.round(value * 136.5); // trading hours per month
        default: return config.dataPoints;
      }
    case '4h':
      switch (unit) {
        case 'd': return Math.ceil(value * 1.625); // 4-hour intervals per day
        case 'w': return Math.ceil(value * 8.125); // 4-hour intervals per week
        case 'mo': return Math.ceil(value * 34.125); // 4-hour intervals per month
        default: return config.dataPoints;
      }
    case '1D':
      switch (unit) {
        case 'w': return value * 5; // trading days per week
        case 'mo': return value * 21; // trading days per month
        case 'y': return value * 252; // trading days per year
        default: return config.dataPoints;
      }
    case '1W':
      switch (unit) {
        case 'mo': return Math.ceil(value * 4.33); // weeks per month
        case 'y': return value * 52; // weeks per year
        default: return config.dataPoints;
      }
    case '1M':
      switch (unit) {
        case 'y': return value * 12; // months per year
        default: return config.dataPoints;
      }
    default:
      return config.dataPoints;
  }
};

/**
 * Validate if a custom period is within acceptable range for timeframe
 */
export const validateCustomPeriod = (period: string, timeframe: string): { valid: boolean; message?: string } => {
  const config = getTimeframeConfig(timeframe);
  const dataPoints = periodToDataPoints(period, timeframe);
  
  // Check if period is too short
  const minDataPoints = periodToDataPoints(config.minPeriod, timeframe);
  if (dataPoints < minDataPoints) {
    return {
      valid: false,
      message: `Period too short for ${timeframe} timeframe. Minimum: ${config.minPeriod}`
    };
  }
  
  // Check if period is too long (might cause performance issues)
  const maxDataPoints = periodToDataPoints(config.maxPeriod, timeframe);
  if (dataPoints > maxDataPoints) {
    return {
      valid: false,
      message: `Period too long for ${timeframe} timeframe. Maximum: ${config.maxPeriod}`
    };
  }
  
  return { valid: true };
};

/**
 * Get recommended periods for a timeframe
 */
export const getRecommendedPeriods = (timeframe: string): string[] => {
  const config = getTimeframeConfig(timeframe);
  
  switch (config.category) {
    case 'intraday':
      return ['4h', '1d', '3d', '1w'];
    case 'daily':
      return ['1w', '2w', '1mo', '3mo', '6mo'];
    case 'weekly':
      return ['1mo', '3mo', '6mo', '1y', '2y'];
    case 'monthly':
      return ['1y', '2y', '3y', '5y'];
    default:
      return ['1mo', '3mo', '6mo'];
  }
};

/**
 * Format period for display
 */
export const formatPeriod = (period: string): string => {
  const match = period.match(/^(\d+)(d|w|mo|y)$/);
  if (!match) return period;
  
  const [, num, unit] = match;
  const value = parseInt(num);
  
  const unitMap: Record<string, string> = {
    'd': value === 1 ? 'day' : 'days',
    'w': value === 1 ? 'week' : 'weeks',
    'mo': value === 1 ? 'month' : 'months',
    'y': value === 1 ? 'year' : 'years'
  };
  
  return `${value} ${unitMap[unit] || unit}`;
};