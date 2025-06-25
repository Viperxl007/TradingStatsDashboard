/**
 * Technical Indicators Utility Functions
 * 
 * This module provides calculation functions for various technical indicators
 * used in chart analysis, including SMA, VWAP, and volume processing.
 */

import { CandlestickData, Time } from 'lightweight-charts';

export interface IndicatorData {
  time: Time;
  value: number;
}

export interface VolumeData {
  time: Time;
  value: number;
  color?: string;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param data Candlestick data array
 * @param period Number of periods for the moving average
 * @returns Array of SMA data points
 */
export function calculateSMA(data: CandlestickData[], period: number): IndicatorData[] {
  if (!data || data.length === 0 || period <= 0) {
    return [];
  }

  const smaData: IndicatorData[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      // Not enough data points for SMA calculation
      smaData.push({
        time: data[i].time,
        value: NaN
      });
      continue;
    }

    // Calculate sum of closing prices for the period
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }

    smaData.push({
      time: data[i].time,
      value: Number((sum / period).toFixed(4))
    });
  }

  return smaData;
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 * @param data Candlestick data array with volume
 * @returns Array of VWAP data points
 */
export function calculateVWAP(data: CandlestickData[]): IndicatorData[] {
  if (!data || data.length === 0) {
    return [];
  }

  const vwapData: IndicatorData[] = [];
  let cumulativeVolumePrice = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i] as any; // Cast to access volume property
    
    // Skip if no volume data available
    if (!candle.volume || candle.volume <= 0) {
      vwapData.push({
        time: candle.time,
        value: NaN
      });
      continue;
    }

    // Calculate typical price (HLC/3)
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    
    // Update cumulative values
    cumulativeVolumePrice += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    // Calculate VWAP
    const vwap = cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : NaN;

    vwapData.push({
      time: candle.time,
      value: Number(vwap.toFixed(4))
    });
  }

  return vwapData;
}

/**
 * Prepare volume data for histogram display
 * @param data Candlestick data array with volume
 * @param upColor Color for up volume bars
 * @param downColor Color for down volume bars
 * @returns Array of volume data points with colors
 */
export function prepareVolumeData(
  data: CandlestickData[], 
  upColor: string = '#26a69a', 
  downColor: string = '#ef5350'
): VolumeData[] {
  if (!data || data.length === 0) {
    return [];
  }

  return data.map((candle: any) => {
    // Determine color based on price movement
    const isUp = candle.close >= candle.open;
    const color = isUp ? upColor : downColor;

    return {
      time: candle.time,
      value: candle.volume || 0,
      color: color
    };
  }).filter(item => item.value > 0); // Filter out zero volume bars
}

/**
 * Check if data contains volume information
 * @param data Candlestick data array
 * @returns True if volume data is available
 */
export function hasVolumeData(data: CandlestickData[]): boolean {
  if (!data || data.length === 0) {
    return false;
  }

  // Check if any candle has volume data
  return data.some((candle: any) => candle.volume != null && candle.volume > 0);
}

/**
 * Filter out NaN values from indicator data
 * @param data Indicator data array
 * @returns Filtered array without NaN values
 */
export function filterValidIndicatorData(data: IndicatorData[]): IndicatorData[] {
  return data.filter(item => !isNaN(item.value) && isFinite(item.value));
}