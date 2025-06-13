import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, useColorMode, Spinner, Center, Text, VStack, HStack, Badge, Icon } from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiActivity } from 'react-icons/fi';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries, LineStyle, LineSeries } from 'lightweight-charts';
import { fetchMarketData } from '../services/marketDataService';
import { KeyLevel, TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';
import SupportResistanceZones from './SupportResistanceZones';
import EnhancedTradingOverlay from './EnhancedTradingOverlay';
import TradingLegend from './TradingLegend';
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
  height = '600px',
  width = '100%',
  onChartReady,
  onTimeframeChange,
  keyLevels = [],
  showHeader = true,
  tradingRecommendation = null,
  showTradingOverlays = true,
  currentAnalysis = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<CandlestickData[]>([]);
  const [priceChange, setPriceChange] = useState<{ value: number; percentage: number } | null>(null);

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
      volume: '#94a3b8'
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
      volume: '#718096'
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
      return data;
    } catch (error) {
      console.error('❌ [ModernChart] FETCH ERROR:', error);
      throw error;
    }
  }, [isLoading]); // Include isLoading to ensure function updates when needed

  // Single useEffect to handle both chart creation and data loading
  useEffect(() => {
    if (!containerRef.current) {
      console.log('⚠️ [ModernChart] Container ref not ready, skipping initialization');
      return;
    }

    console.log(`🚀 [ModernChart] INITIALIZING CHART - ${symbol} (${timeframe}) Period: ${period}`);

    const initializeChart = async () => {
      try {
        // Clean up existing chart if it exists
        if (chartRef.current) {
          console.log('🧹 [ModernChart] Cleaning up existing chart');
          chartRef.current.remove();
          chartRef.current = null;
          seriesRef.current = null;
        }

        setIsLoading(true);
        setError(null);

        console.log('🎨 [ModernChart] Creating modern chart instance...');
        
        // Create chart with high-resolution settings
        const chart = createChart(containerRef.current!, {
          width: containerRef.current!.clientWidth,
          height: parseInt(height.replace('px', '')) - (showHeader ? 80 : 0),
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
            barSpacing: 8,
            minBarSpacing: 4,
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

        // Key levels and trading overlays are now handled by separate components
        // This prevents chart recreation when switching tabs
        console.log(`📍 [ModernChart] Key levels and trading overlays will be handled by separate components`);

        // Fit content with padding
        chart.timeScale().fitContent();

        console.log('✅ [ModernChart] Chart initialization and data loading complete');

        // Call onChartReady callback
        if (onChartReady) {
          console.log('🔄 [ModernChart] Calling onChartReady callback');
          onChartReady(chart);
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
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [symbol, timeframe, period, colorMode]); // Recreate chart when any of these change

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
            </HStack>
            
            {priceChange && (
              <HStack spacing={2}>
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
              </HStack>
            )}
          </HStack>
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