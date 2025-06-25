import React, { useEffect, useRef, useState } from 'react';
import { Box, useColorMode, Spinner, Center, Text } from '@chakra-ui/react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import { fetchMarketData } from '../services/marketDataService';

interface TradingViewLightweightChartProps {
  symbol: string;
  timeframe?: string;
  period?: string;
  height?: string;
  width?: string;
  onChartReady?: (chart: IChartApi) => void;
}

/**
 * TradingView Lightweight Chart Component
 * 
 * This component renders a chart using TradingView's Lightweight Charts library
 * which renders to canvas and can be captured for AI analysis.
 */
const TradingViewLightweightChart: React.FC<TradingViewLightweightChartProps> = ({
  symbol,
  timeframe = '1D',
  period,
  height = '400px',
  width = '100%',
  onChartReady
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch REAL market data with proper timeframe periods
  const loadMarketData = async (symbol: string, timeframe: string, period?: string): Promise<CandlestickData[]> => {
    try {
      const actualPeriod = period || '6mo';
      console.log(`📊 [LightweightChart] Loading REAL market data for ${symbol}`);
      console.log(`⚙️ [LightweightChart] Timeframe: ${timeframe}, Period: ${actualPeriod}`);
      
      // Debug the timeframe mapping
      const { debugMarketDataCall } = await import('../utils/timeframeDebug');
      debugMarketDataCall(symbol, timeframe, actualPeriod);
      
      const data = await fetchMarketData(symbol, timeframe, actualPeriod);
      
      if (!data || data.length === 0) {
        throw new Error('No real market data available - this is a production trading tool that requires real data');
      }
      
      console.log(`✅ [LightweightChart] Loaded ${data.length} REAL data points for ${symbol}`);
      console.log(`📈 [LightweightChart] First data point:`, data[0]);
      console.log(`📈 [LightweightChart] Last data point:`, data[data.length - 1]);
      return data;
    } catch (error) {
      console.error('❌ [LightweightChart] CRITICAL: Cannot load real market data:', error);
      throw new Error(`PRODUCTION ERROR: Cannot load real market data for ${symbol}. This trading tool requires real data. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (!containerRef.current) {
      console.log('⚠️ [LightweightChart] Container ref not ready');
      return;
    }

    console.log(`🚀 [LightweightChart] Initializing chart for ${symbol} (${timeframe})`);

    const initializeChart = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('📊 [LightweightChart] Creating chart instance...');
        // Create chart with WHITE background for screenshot capture
        const chart = createChart(containerRef.current!, {
          width: containerRef.current!.clientWidth,
          height: parseInt(height.replace('px', '')),
          layout: {
            background: { color: '#ffffff' }, // Always white for clear screenshots
            textColor: '#000000', // Black text for visibility
          },
          grid: {
            vertLines: { color: '#e0e0e0' },
            horzLines: { color: '#e0e0e0' },
          },
          crosshair: {
            mode: 1,
          },
          rightPriceScale: {
            borderColor: '#cccccc',
          },
          timeScale: {
            borderColor: '#cccccc',
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
        });

        console.log('📈 [LightweightChart] Adding candlestick series...');
        // Add candlestick series with high contrast colors
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#00C851',      // Bright green for up candles
          downColor: '#FF4444',    // Bright red for down candles
          borderVisible: true,     // Show borders for better visibility
          borderUpColor: '#00C851',
          borderDownColor: '#FF4444',
          wickUpColor: '#00C851',
          wickDownColor: '#FF4444',
          wickVisible: true,
        });

        console.log('📊 [LightweightChart] Loading market data...');
        // Load and set real market data
        const data = await loadMarketData(symbol, timeframe, period);
        
        console.log('📈 [LightweightChart] Setting data on series...');
        candlestickSeries.setData(data);

        console.log('🎯 [LightweightChart] Fitting content...');
        // Fit content
        chart.timeScale().fitContent();

        // Store references
        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        console.log('✅ [LightweightChart] Chart initialization complete');

        // Call onChartReady callback
        if (onChartReady) {
          console.log('🔄 [LightweightChart] Calling onChartReady callback');
          onChartReady(chart);
        }

        setIsLoading(false);

        // Handle resize
        const handleResize = () => {
          if (containerRef.current && chart) {
            chart.applyOptions({
              width: containerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          chart.remove();
        };

      } catch (err) {
        console.error('Error creating chart:', err);
        setError(`Error loading chart data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initializeChart();
  }, [symbol, timeframe, period, colorMode, height, onChartReady]);

  if (error) {
    return (
      <Box height={height} width={width} position="relative" borderWidth="1px" borderRadius="lg" overflow="hidden">
        <Center height="100%" bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}>
          <Box textAlign="center" p={4}>
            <Text color="red.500" mb={2} fontWeight="bold">Error loading chart:</Text>
            <Text>{error}</Text>
          </Box>
        </Center>
      </Box>
    );
  }

  return (
    <Box height={height} width={width} position="relative" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Box p={4} borderBottomWidth="1px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}>
        <Text fontWeight="bold">Chart - {symbol}</Text>
      </Box>
      
      {isLoading && (
        <Center position="absolute" top="53px" left="0" right="0" bottom="0" bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'} zIndex="1">
          <Box textAlign="center">
            <Spinner size="xl" color="brand.500" mb={4} />
            <Text mb={4}>Loading chart for {symbol}...</Text>
          </Box>
        </Center>
      )}
      
      <Box 
        ref={containerRef} 
        height="calc(100% - 53px)" 
        width="100%"
        opacity={isLoading ? 0.3 : 1}
      />
    </Box>
  );
};

export default TradingViewLightweightChart;