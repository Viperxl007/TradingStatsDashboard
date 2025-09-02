import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, useColorMode, Spinner, Center, Text, VStack, HStack, Badge, Icon } from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiActivity } from 'react-icons/fi';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries, LineStyle, LineSeries, HistogramSeries } from 'lightweight-charts';
import { fetchMarketData } from '../services/marketDataService';
import { KeyLevel, TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';
import { calculateSMA, calculateVWAP, prepareVolumeData, hasVolumeData, filterValidIndicatorData } from '../utils/technicalIndicators';
import SupportResistanceZones from './SupportResistanceZones';
import EnhancedTradingOverlay from './EnhancedTradingOverlay';
import TradingLegend from './TradingLegend';
import ChartIndicatorLegend from './ChartIndicatorLegend';
import ActiveTradeAlert from './ActiveTradeAlert';
import ManualTradeCloseButtons from './ManualTradeCloseButtons';
import './ModernChart.css';

interface ModernCandlestickChartProps {
  symbol: string;
  timeframe?: string;
  period?: string;
  height?: string;
  width?: string;
  onChartReady?: (chart: IChartApi) => void;
  onTimeframeChange?: (timeframe: string) => void;
  keyLevels?: KeyLevel[];
  showHeader?: boolean;
  tradingRecommendation?: TradingRecommendationType | null;
  showTradingOverlays?: boolean;
  currentAnalysis?: any; // Analysis result for HOLD message display
  // Technical Indicators
  showVolume?: boolean;
  showSMA20?: boolean;
  showSMA50?: boolean;
  showSMA200?: boolean;
  showVWAP?: boolean;
  onDataLoaded?: (data: CandlestickData[]) => void;
  onCapturingStateChange?: (isCapturing: boolean) => void;
  onCurrentPriceUpdate?: (currentPrice: number) => void;
  onTradeClose?: () => void;
  onClearOverlays?: () => void;
}

/**
 * Modern Candlestick Chart Component
 * 
 * A high-resolution, modern chart with appealing design elements that serves
 * both user interaction and AI analysis. Features gradient backgrounds,
 * smooth animations, and responsive design.
 */
const ModernCandlestickChart: React.FC<ModernCandlestickChartProps> = ({
  symbol,
  timeframe = '1D',
  period,
  height = '1200px',
  width = '100%',
  onChartReady,
  onTimeframeChange,
  keyLevels = [],
  showHeader = true,
  tradingRecommendation = null,
  showTradingOverlays = true,
  currentAnalysis = null,
  // Technical Indicators
  showVolume = false,
  showSMA20 = false,
  showSMA50 = false,
  showSMA200 = false,
  showVWAP = false,
  onDataLoaded,
  onCapturingStateChange,
  onCurrentPriceUpdate,
  onTradeClose,
  onClearOverlays
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  
  // Technical Indicator Series References
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<CandlestickData[]>([]);
  const [priceChange, setPriceChange] = useState<{ value: number; percentage: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [forceRecreation, setForceRecreation] = useState(0); // Force recreation counter

  // Notify parent when capturing state changes
  useEffect(() => {
    console.log('🔍 [DIAGNOSTIC] Capturing state changed to:', isCapturing);
    console.log('🔍 [DIAGNOSTIC] Chart exists:', !!chartRef.current);
    console.log('🔍 [DIAGNOSTIC] Loading state:', isLoading);
    
    if (onCapturingStateChange) {
      onCapturingStateChange(isCapturing);
    }
    
    // Auto-reset capturing state after 30 seconds to prevent permanent blocking
    if (isCapturing) {
      const timeoutId = setTimeout(() => {
        console.warn('🚨 [CRITICAL FIX] Capturing state stuck for 30 seconds - auto-resetting');
        console.log('🔧 [CRITICAL FIX] This prevents permanent chart loading issues');
        setIsCapturing(false);
      }, 30000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isCapturing, onCapturingStateChange, isLoading]);

  // Listen for chart overlay clearing events (triggered when trades are closed)
  useEffect(() => {
    const handleClearOverlays = (event: CustomEvent) => {
      console.log('🧹 [ModernChart] Received clear overlays event:', event.detail);
      
      // Force chart to refresh by triggering recreation
      if (chartRef.current && symbol) {
        console.log('🔄 [ModernChart] Clearing chart overlays by forcing recreation...');
        
        // Clear the chart first
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) {
            console.warn('⚠️ [ModernChart] Error removing chart during overlay clear:', e);
          }
          chartRef.current = null;
          seriesRef.current = null;
        }
        
        // Trigger recreation by setting loading state
        setIsLoading(true);
        setError(null);
        
        // Force chart recreation after clearing overlays
        setTimeout(() => {
          console.log('🔧 [SIMPLE FIX] Forcing chart recreation after overlay clear');
          setForceRecreation(prev => prev + 1); // This will trigger the main useEffect
        }, 200);
      }
    };

    const handleForceRefresh = (event: CustomEvent) => {
      console.log('🔄 [ModernChart] Received force refresh event:', event.detail);
      
      // Force complete chart recreation
      if (containerRef.current && symbol) {
        console.log('🔄 [ModernChart] Force recreating chart...');
        
        // Clear the chart first
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (e) {
            console.warn('⚠️ [ModernChart] Error removing chart during force refresh:', e);
          }
          chartRef.current = null;
          seriesRef.current = null;
        }
        
        // Trigger recreation by setting loading state
        setIsLoading(true);
        setError(null);
        
        // Small delay to ensure DOM is clean, then force recreation
        setTimeout(() => {
          console.log('🎯 [SIMPLE FIX] Chart recreation triggered - forcing initialization');
          setForceRecreation(prev => prev + 1); // This will trigger the main useEffect
        }, 100);
      }
    };

    // Add event listeners
    window.addEventListener('clearChartOverlays', handleClearOverlays as unknown as EventListener);
    window.addEventListener('forceChartRefresh', handleForceRefresh as unknown as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('clearChartOverlays', handleClearOverlays as unknown as EventListener);
      window.removeEventListener('forceChartRefresh', handleForceRefresh as unknown as EventListener);
    };
  }, [symbol, timeframe, period]);

  // Expose capturing control methods
  const startCapturing = useCallback(() => {
    console.log('🎯 [ModernChart] Starting capture mode');
    console.log('🔍 [DIAGNOSTIC] Previous capturing state:', isCapturing);
    setIsCapturing(true);
  }, [isCapturing]);

  const stopCapturing = useCallback(() => {
    console.log('🎯 [ModernChart] Stopping capture mode');
    console.log('🔍 [DIAGNOSTIC] Previous capturing state:', isCapturing);
    setIsCapturing(false);
  }, [isCapturing]);

  // Modern color palette with flair
  const colors = {
    light: {
      background: '#ffffff',
      backgroundGradient: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
      text: '#1a202c',
      textSecondary: '#4a5568',
      grid: '#e2e8f0',
      border: '#cbd5e0',
      upColor: '#10b981', // Emerald green
      downColor: '#ef4444', // Red
      upColorBright: '#059669',
      downColorBright: '#dc2626',
      accent: '#3b82f6', // Blue accent
      accentGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      volume: '#94a3b8',
      // Technical Indicators
      sma20: '#ff6b35', // Orange
      sma50: '#4ecdc4', // Teal
      sma200: '#9333ea', // Purple - more contrasting from teal
      vwap: '#96ceb4'   // Light green
    },
    dark: {
      background: '#1a202c',
      backgroundGradient: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
      text: '#f7fafc',
      textSecondary: '#a0aec0',
      grid: '#4a5568',
      border: '#718096',
      upColor: '#10b981', // Emerald green
      downColor: '#f56565', // Softer red for dark mode
      upColorBright: '#34d399',
      downColorBright: '#fca5a5',
      accent: '#60a5fa', // Lighter blue for dark mode
      accentGradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
      volume: '#718096',
      // Technical Indicators (slightly brighter for dark mode)
      sma20: '#ff8c69', // Lighter orange
      sma50: '#5fd3ca', // Lighter teal
      sma200: '#a855f7', // Lighter purple - more contrasting from teal
      vwap: '#a8d8c2'   // Lighter green
    }
  };

  const currentColors = colors[colorMode];

  // Load market data with enhanced error handling and timeframe-appropriate periods
  const loadMarketData = useCallback(async (symbol: string, timeframe: string, period?: string): Promise<CandlestickData[]> => {
    try {
      // Use provided period or get the standard period for this timeframe
      let actualPeriod = period;
      if (!actualPeriod) {
        // Import timeframe config to get the standard period
        const { getTimeframeConfig } = await import('../utils/timeframeConfig');
        const config = getTimeframeConfig(timeframe);
        actualPeriod = config.standardPeriod;
        console.log(`📋 [ModernChart] Using standard period for ${timeframe}: ${actualPeriod}`);
      }
      
      console.log(`🔄 [ModernChart] FETCH REQUEST - ${symbol} (${timeframe}) Period: ${actualPeriod}`);
      console.log(`🔍 [ModernChart] This will fetch ${timeframe} candles over ${actualPeriod} period`);
      console.log(`🔍 [ModernChart] Current loading state: ${isLoading}`);
      
      const data = await fetchMarketData(symbol, timeframe, actualPeriod);
      
      if (!data || data.length === 0) {
        throw new Error('No market data available');
      }
      
      console.log(`✅ [ModernChart] FETCH SUCCESS - ${data.length} ${timeframe} candles over ${actualPeriod} for ${symbol}`);
      console.log(`📊 [ModernChart] Date range: ${new Date((data[0].time as number) * 1000).toLocaleDateString()} to ${new Date((data[data.length - 1].time as number) * 1000).toLocaleDateString()}`);
      
      // Calculate price change
      if (data.length >= 2) {
        const firstPrice = data[0].close;
        const lastPrice = data[data.length - 1].close;
        const change = lastPrice - firstPrice;
        const percentage = (change / firstPrice) * 100;
        setPriceChange({ value: change, percentage });
        console.log(`📈 [ModernChart] Price change calculated: ${percentage.toFixed(2)}% over ${actualPeriod}`);
      }
      
      setMarketData(data);
      
      // Call current price callback if provided
      if (onCurrentPriceUpdate && data.length > 0) {
        const currentPrice = data[data.length - 1].close;
        onCurrentPriceUpdate(currentPrice);
      }
      
      return data;
    } catch (error) {
      console.error('❌ [ModernChart] FETCH ERROR:', error);
      throw error;
    }
  }, [isLoading]); // Include isLoading to ensure function updates when needed

  // Add technical indicators to the chart
  const addTechnicalIndicators = useCallback(async (chart: IChartApi, data: CandlestickData[]) => {
    try {
      console.log('📊 [ModernChart] Adding technical indicators...');
      
      // Clean up existing indicator series - only if they exist and are valid
      try {
        if (volumeSeriesRef.current && chart) {
          chart.removeSeries(volumeSeriesRef.current);
        }
      } catch (e) {
        console.log('🧹 [ModernChart] Volume series already removed or invalid');
      }
      volumeSeriesRef.current = null;
      
      try {
        if (sma20SeriesRef.current && chart) {
          chart.removeSeries(sma20SeriesRef.current);
        }
      } catch (e) {
        console.log('🧹 [ModernChart] SMA20 series already removed or invalid');
      }
      sma20SeriesRef.current = null;
      
      try {
        if (sma50SeriesRef.current && chart) {
          chart.removeSeries(sma50SeriesRef.current);
        }
      } catch (e) {
        console.log('🧹 [ModernChart] SMA50 series already removed or invalid');
      }
      sma50SeriesRef.current = null;
      
      try {
        if (sma200SeriesRef.current && chart) {
          chart.removeSeries(sma200SeriesRef.current);
        }
      } catch (e) {
        console.log('🧹 [ModernChart] SMA200 series already removed or invalid');
      }
      sma200SeriesRef.current = null;
      
      try {
        if (vwapSeriesRef.current && chart) {
          chart.removeSeries(vwapSeriesRef.current);
        }
      } catch (e) {
        console.log('🧹 [ModernChart] VWAP series already removed or invalid');
      }
      vwapSeriesRef.current = null;

      // Add Volume Series
      if (showVolume && hasVolumeData(data)) {
        console.log('📊 [ModernChart] Adding volume series...');
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '', // Set as overlay
          color: currentColors.volume,
        });

        // Position volume in bottom 30% of chart
        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.7, // 70% from top
            bottom: 0,
          },
        });

        const volumeData = prepareVolumeData(data, currentColors.upColor, currentColors.downColor);
        volumeSeries.setData(volumeData);
        volumeSeriesRef.current = volumeSeries;
        console.log('✅ [ModernChart] Volume series added');
      }

      // Add SMA 20
      if (showSMA20) {
        console.log('📊 [ModernChart] Adding SMA 20...');
        const sma20Data = calculateSMA(data, 20);
        const validSMA20Data = filterValidIndicatorData(sma20Data);
        
        if (validSMA20Data.length > 0) {
          const sma20Series = chart.addSeries(LineSeries, {
            color: currentColors.sma20,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sma20Series.setData(validSMA20Data);
          sma20SeriesRef.current = sma20Series;
          console.log('✅ [ModernChart] SMA 20 added');
        }
      }

      // Add SMA 50
      if (showSMA50) {
        console.log('📊 [ModernChart] Adding SMA 50...');
        const sma50Data = calculateSMA(data, 50);
        const validSMA50Data = filterValidIndicatorData(sma50Data);
        
        if (validSMA50Data.length > 0) {
          const sma50Series = chart.addSeries(LineSeries, {
            color: currentColors.sma50,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sma50Series.setData(validSMA50Data);
          sma50SeriesRef.current = sma50Series;
          console.log('✅ [ModernChart] SMA 50 added');
        }
      }

      // Add SMA 200
      if (showSMA200) {
        console.log('📊 [ModernChart] Adding SMA 200...');
        const sma200Data = calculateSMA(data, 200);
        const validSMA200Data = filterValidIndicatorData(sma200Data);
        
        if (validSMA200Data.length > 0) {
          const sma200Series = chart.addSeries(LineSeries, {
            color: currentColors.sma200,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sma200Series.setData(validSMA200Data);
          sma200SeriesRef.current = sma200Series;
          console.log('✅ [ModernChart] SMA 200 added');
        }
      }

      // Add VWAP
      if (showVWAP && hasVolumeData(data)) {
        console.log('📊 [ModernChart] Adding VWAP...');
        const vwapData = calculateVWAP(data);
        const validVWAPData = filterValidIndicatorData(vwapData);
        
        if (validVWAPData.length > 0) {
          const vwapSeries = chart.addSeries(LineSeries, {
            color: currentColors.vwap,
            lineWidth: 2,
            lineStyle: 1, // Dotted line
            priceLineVisible: false,
            lastValueVisible: false,
          });
          vwapSeries.setData(validVWAPData);
          vwapSeriesRef.current = vwapSeries;
          console.log('✅ [ModernChart] VWAP added');
        }
      }

      console.log('✅ [ModernChart] Technical indicators setup complete');
    } catch (error) {
      console.error('❌ [ModernChart] Error adding technical indicators:', error);
    }
  }, [showVolume, showSMA20, showSMA50, showSMA200, showVWAP, currentColors]);

  // Single useEffect to handle both chart creation and data loading
  useEffect(() => {
    if (!containerRef.current) {
      console.log('⚠️ [ModernChart] Container ref not ready, skipping initialization');
      return;
    }

    console.log(`🚀 [ModernChart] INITIALIZING CHART - ${symbol} (${timeframe}) Period: ${period}`);

    const initializeChart = async () => {
      try {
        // Skip initialization if we're currently capturing
        if (isCapturing) {
          console.log('🚫 [ModernChart] Skipping chart initialization during capture');
          console.log('🔍 [DIAGNOSTIC] Chart stuck in capturing state - this may cause loading issues');
          console.log('🔍 [DIAGNOSTIC] isCapturing state:', isCapturing);
          console.log('🔍 [DIAGNOSTIC] Chart exists:', !!chartRef.current);
          console.log('🔍 [DIAGNOSTIC] Loading state:', isLoading);
          return;
        }
        
        // Clean up existing chart if it exists
        if (chartRef.current) {
          console.log('🧹 [ModernChart] Cleaning up existing chart');
          try {
            // Clean up indicator series first
            if (volumeSeriesRef.current) {
              try { chartRef.current.removeSeries(volumeSeriesRef.current); } catch (e) {}
            }
            if (sma20SeriesRef.current) {
              try { chartRef.current.removeSeries(sma20SeriesRef.current); } catch (e) {}
            }
            if (sma50SeriesRef.current) {
              try { chartRef.current.removeSeries(sma50SeriesRef.current); } catch (e) {}
            }
            if (sma200SeriesRef.current) {
              try { chartRef.current.removeSeries(sma200SeriesRef.current); } catch (e) {}
            }
            if (vwapSeriesRef.current) {
              try { chartRef.current.removeSeries(vwapSeriesRef.current); } catch (e) {}
            }
            // Remove the chart itself
            chartRef.current.remove();
          } catch (e) {
            console.log('🧹 [ModernChart] Error during chart cleanup:', e);
          }
          
          // Reset all references
          chartRef.current = null;
          seriesRef.current = null;
          volumeSeriesRef.current = null;
          sma20SeriesRef.current = null;
          sma50SeriesRef.current = null;
          sma200SeriesRef.current = null;
          vwapSeriesRef.current = null;
        }

        // Reset state for new chart
        setIsLoading(true);
        setError(null);
        setMarketData([]); // Clear old market data
        setPriceChange(null); // Clear old price change

        console.log('🎨 [ModernChart] Creating modern chart instance...');
        
        // Create chart with high-resolution settings
        // Always reserve space for technical indicators legend to prevent dynamic layout shifts
        const indicatorLegendHeight = 30; // Permanent space for indicator legend
        
        const chart = createChart(containerRef.current!, {
          width: containerRef.current!.clientWidth,
          height: parseInt(height.replace('px', '')) - (showHeader ? 100 + indicatorLegendHeight : 20), // Account for header + indicators + bottom spacing
          layout: {
            background: { color: currentColors.background },
            textColor: currentColors.text,
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          },
          grid: {
            vertLines: { 
              color: currentColors.grid,
              style: LineStyle.Dotted,
              visible: true,
            },
            horzLines: { 
              color: currentColors.grid,
              style: LineStyle.Dotted,
              visible: true,
            },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: currentColors.accent,
              width: 1,
              style: LineStyle.Solid,
              labelBackgroundColor: currentColors.accent,
            },
            horzLine: {
              color: currentColors.accent,
              width: 1,
              style: LineStyle.Solid,
              labelBackgroundColor: currentColors.accent,
            },
          },
          rightPriceScale: {
            borderColor: currentColors.border,
            textColor: currentColors.textSecondary,
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
          timeScale: {
            borderColor: currentColors.border,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 6,
            minBarSpacing: 0.5,  // Allow much more zoom out
            fixLeftEdge: false,   // Allow scrolling to see all historical data
            fixRightEdge: false,  // Allow scrolling past current time
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            shiftVisibleRangeOnNewBar: true,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
        });

        console.log('📈 [ModernChart] Adding enhanced candlestick series...');
        
        // Add candlestick series with modern styling
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: currentColors.upColor,
          downColor: currentColors.downColor,
          borderVisible: true,
          borderUpColor: currentColors.upColorBright,
          borderDownColor: currentColors.downColorBright,
          wickUpColor: currentColors.upColorBright,
          wickDownColor: currentColors.downColorBright,
          wickVisible: true,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });

        // Store references
        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        console.log('✅ [ModernChart] Chart container created, now loading data...');

        // Load market data immediately after chart creation
        console.log(`🔄 [ModernChart] LOADING DATA - ${symbol} (${timeframe}) Period: ${period}`);
        const data = await loadMarketData(symbol, timeframe, period);
        
        console.log(`📈 [ModernChart] RECEIVED ${data.length} DATA POINTS - Setting on chart series...`);
        candlestickSeries.setData(data);

        // Notify parent component about data loading
        if (onDataLoaded) {
          onDataLoaded(data);
        }

        // Add technical indicators if enabled
        console.log('📊 [ModernChart] Adding technical indicators...');
        await addTechnicalIndicators(chart, data);

        // Key levels and trading overlays are now handled by separate components
        // This prevents chart recreation when switching tabs
        console.log(`📍 [ModernChart] Key levels and trading overlays will be handled by separate components`);

        // Fit content with padding
        chart.timeScale().fitContent();

        console.log('✅ [ModernChart] Chart initialization and data loading complete');

        // Call onChartReady callback with capturing control methods
        if (onChartReady) {
          console.log('🔄 [ModernChart] Calling onChartReady callback');
          // Extend chart with capturing control methods
          const chartWithCapturing = Object.assign(chart, {
            startCapturing,
            stopCapturing,
            isCapturing: () => isCapturing
          });
          onChartReady(chartWithCapturing);
        }

        setIsLoading(false);

        // Chart initialization complete
        console.log('✅ [ModernChart] Chart initialization complete');

      } catch (err) {
        console.error('❌ [ModernChart] Error creating chart:', err);
        setError(`Error creating chart: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initializeChart();

    // Handle resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (containerRef.current && chartRef.current) {
          try {
            chartRef.current.applyOptions({
              width: containerRef.current.clientWidth,
            });
          } catch (error) {
            console.warn('Chart resize failed - chart may be disposed:', error);
          }
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      
      if (chartRef.current) {
        console.log('🧹 [ModernChart] Cleaning up chart on unmount');
        try {
          // Clean up indicator series first
          if (volumeSeriesRef.current) {
            try { chartRef.current.removeSeries(volumeSeriesRef.current); } catch (e) {}
          }
          if (sma20SeriesRef.current) {
            try { chartRef.current.removeSeries(sma20SeriesRef.current); } catch (e) {}
          }
          if (sma50SeriesRef.current) {
            try { chartRef.current.removeSeries(sma50SeriesRef.current); } catch (e) {}
          }
          if (sma200SeriesRef.current) {
            try { chartRef.current.removeSeries(sma200SeriesRef.current); } catch (e) {}
          }
          if (vwapSeriesRef.current) {
            try { chartRef.current.removeSeries(vwapSeriesRef.current); } catch (e) {}
          }
          // Remove the chart itself
          chartRef.current.remove();
        } catch (e) {
          console.log('🧹 [ModernChart] Error during unmount cleanup:', e);
        }
        
        // Reset all references
        chartRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
        sma20SeriesRef.current = null;
        sma50SeriesRef.current = null;
        sma200SeriesRef.current = null;
        vwapSeriesRef.current = null;
      }
    };
  }, [symbol, timeframe, period, colorMode, forceRecreation]);

  // Separate effect for handling key levels and trading overlays without recreating the chart
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    console.log('🎯 [ModernChart] Updating overlays without recreating chart');
    
    // Note: Key levels and trading overlays are now handled by separate components
    // This prevents unnecessary chart recreation when switching tabs
    
  }, [keyLevels, tradingRecommendation, showTradingOverlays]);

  // Debug effect to log props data
  useEffect(() => {
    console.log(`📊 [ModernCandlestickChart] DEBUG - Rendering overlays with:`, {
      chartExists: !!chartRef.current,
      keyLevelsCount: keyLevels.length,
      keyLevelsData: keyLevels,
      timeframe: timeframe,
      tradingRecommendationExists: !!tradingRecommendation,
      tradingRecommendationData: tradingRecommendation,
      showTradingOverlays: showTradingOverlays
    });
  }, [keyLevels, tradingRecommendation, timeframe, showTradingOverlays]);

  // Debug effect for trading recommendation
  useEffect(() => {
    console.log('🎯 [ModernChart] Trading recommendation debug:', {
      tradingRecommendation,
      showTradingOverlays,
      timeframe,
      hasRecommendation: !!tradingRecommendation,
      isActive: tradingRecommendation?.isActive,
      recommendationTimeframe: tradingRecommendation?.timeframe
    });
  }, [tradingRecommendation, showTradingOverlays, timeframe]);

  // Effect to handle technical indicator updates without recreating the chart
  useEffect(() => {
    if (!chartRef.current || !marketData || marketData.length === 0) return;

    console.log('📊 [ModernChart] Updating technical indicators...');
    addTechnicalIndicators(chartRef.current, marketData);
  }, [showVolume, showSMA20, showSMA50, showSMA200, showVWAP, marketData]);

  if (error) {
    return (
      <Box
        height={height}
        width={width}
        position="relative"
        borderRadius="xl"
        overflow="hidden"
        bg={currentColors.background}
        border="1px solid"
        borderColor={currentColors.border}
      >
        <Center height="100%">
          <VStack spacing={4}>
            <Icon as={FiActivity} boxSize={12} color="red.400" />
            <VStack spacing={2} textAlign="center">
              <Text color="red.500" fontWeight="bold" fontSize="lg">
                Chart Error
              </Text>
              <Text color={currentColors.textSecondary} fontSize="sm" maxW="md">
                {error}
              </Text>
            </VStack>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box
      height={height}
      width={width}
      position="relative"
      borderRadius="xl"
      overflow="hidden"
      bg={currentColors.background}
      border="1px solid"
      borderColor={currentColors.border}
      boxShadow={colorMode === 'dark' ? 'xl' : '2xl'}
      className="chart-container chart-theme-transition chart-hover-lift"
      data-testid="modern-chart-container"
      _hover={{
        boxShadow: colorMode === 'dark' ? '2xl' : '3xl',
        transform: 'translateY(-1px)',
      }}
      transition="all 0.2s ease-in-out"
    >
      {/* Modern Header */}
      {showHeader && (
        <Box
          p={4}
          borderBottomWidth="1px"
          borderColor={currentColors.border}
          background={currentColors.backgroundGradient}
          className="chart-header"
        >
          <VStack spacing={2} align="stretch">
            <HStack justify="space-between" align="center">
              <HStack spacing={3}>
                <Text fontWeight="bold" fontSize="lg" color={currentColors.text}>
                  {symbol}
                </Text>
                <Badge
                  colorScheme={timeframe.includes('m') ? 'blue' : timeframe.includes('h') ? 'purple' : 'green'}
                  variant="subtle"
                  borderRadius="full"
                  px={3}
                  py={1}
                >
                  {timeframe}
                </Badge>
                {period && (
                  <Badge
                    colorScheme="gray"
                    variant="outline"
                    borderRadius="full"
                    px={3}
                    py={1}
                  >
                    {period}
                  </Badge>
                )}
                
                {/* Active Trade Alert */}
                <ActiveTradeAlert ticker={symbol} />
              </HStack>
              
              <HStack spacing={2}>
                {/* Manual Trade Close Buttons - Moved to right side */}
                <ManualTradeCloseButtons
                  ticker={symbol}
                  onTradeClose={onTradeClose}
                  onClearOverlays={onClearOverlays}
                />
                
                {priceChange && (
                  <>
                    <Icon
                      as={priceChange.value >= 0 ? FiTrendingUp : FiTrendingDown}
                      color={priceChange.value >= 0 ? currentColors.upColor : currentColors.downColor}
                    />
                    <Text
                      fontWeight="semibold"
                      color={priceChange.value >= 0 ? currentColors.upColor : currentColors.downColor}
                      fontSize="sm"
                    >
                      {priceChange.value >= 0 ? '+' : ''}{priceChange.percentage.toFixed(2)}%
                    </Text>
                  </>
                )}
              </HStack>
            </HStack>
            
            {/* Indicator Legend */}
            <ChartIndicatorLegend
              showVolume={showVolume}
              showSMA20={showSMA20}
              showSMA50={showSMA50}
              showSMA200={showSMA200}
              showVWAP={showVWAP}
              hasVolumeData={hasVolumeData(marketData)}
            />
          </VStack>
        </Box>
      )}
      
      {/* Loading State */}
      {isLoading && (
        <Center
          position="absolute"
          top={showHeader ? "81px" : "0"}
          left="0"
          right="0"
          bottom="0"
          bg={colorMode === 'dark' ? 'rgba(26, 32, 44, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
          backdropFilter="blur(4px)"
          zIndex="10"
        >
          <VStack spacing={4}>
            <Box position="relative">
              <Spinner
                size="xl"
                color={currentColors.accent}
                thickness="3px"
                speed="0.8s"
              />
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                w="8"
                h="8"
                borderRadius="full"
                bg={currentColors.accent}
                opacity="0.2"
                animation="ping 1s cubic-bezier(0, 0, 0.2, 1) infinite"
              />
            </Box>
            <VStack spacing={1}>
              <Text fontWeight="semibold" color={currentColors.text}>
                Loading Chart
              </Text>
              <Text fontSize="sm" color={currentColors.textSecondary}>
                Fetching market data for {symbol}...
              </Text>
            </VStack>
          </VStack>
        </Center>
      )}
      
      {/* Chart Container */}
      <Box
        ref={containerRef}
        height={showHeader ? "calc(100% - 81px)" : "100%"}
        width="100%"
        opacity={isLoading ? 0.3 : 1}
        transition="opacity 0.3s ease-in-out"
      />
      
      {/* Support/Resistance Zones */}
      <SupportResistanceZones
        chart={chartRef.current}
        keyLevels={keyLevels}
        currentTimeframe={timeframe}
      />
      
      
      {/* Enhanced Trading Overlay */}
      {showTradingOverlays && (
        <EnhancedTradingOverlay
          chart={chartRef.current}
          recommendation={tradingRecommendation}
          currentTimeframe={timeframe}
        />
      )}
      
      {/* HOLD Message Overlay */}
      {currentAnalysis && currentAnalysis.recommendations && currentAnalysis.recommendations.action === 'hold' && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          bg={colorMode === 'dark' ? 'rgba(26, 32, 44, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
          borderRadius="xl"
          px={6}
          py={4}
          border="2px solid"
          borderColor="gray.500"
          boxShadow="xl"
          zIndex={10}
          backdropFilter="blur(8px)"
        >
          <VStack spacing={2}>
            <Text
              fontSize="xl"
              fontWeight="bold"
              color="gray.500"
              textAlign="center"
            >
              NO TRADE RECOMMENDED
            </Text>
            <Badge
              colorScheme="gray"
              variant="solid"
              fontSize="md"
              px={3}
              py={1}
              borderRadius="full"
            >
              HOLD
            </Badge>
            <Text
              fontSize="sm"
              color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
              textAlign="center"
              maxW="200px"
            >
              Current market conditions do not present a clear trading opportunity
            </Text>
          </VStack>
        </Box>
      )}
      
      {/* Trading Legend */}
      <TradingLegend
        recommendation={tradingRecommendation}
        currentTimeframe={timeframe}
        show={showTradingOverlays}
      />
      
    </Box>
  );
};

export default ModernCandlestickChart;