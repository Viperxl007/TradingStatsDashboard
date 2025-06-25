import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  useColorMode,
  useToast,
  Alert,
  AlertIcon,
  Icon,
  Flex
} from '@chakra-ui/react';
import { FiEye, FiDownload, FiCamera } from 'react-icons/fi';
import ModernCandlestickChart from './ModernCandlestickChart';
import { KeyLevel, TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';
import { captureChartScreenshot, captureChartScreenshotNative } from '../services/chartAnalysisService';

interface SimpleChartViewerProps {
  ticker: string;
  timeframe: string;
  period?: string;
  onAnalyzeChart: (chartImage: string, additionalContext?: string) => void;
  isAnalyzing: boolean;
  keyLevels?: KeyLevel[];
  tradingRecommendation?: TradingRecommendationType | null;
  showTradingOverlays?: boolean;
}

/**
 * Modern Chart Viewer Component
 *
 * Shows a single modern candlestick chart that serves both user interaction
 * and AI analysis - what you see is exactly what gets analyzed
 */
const SimpleChartViewer: React.FC<SimpleChartViewerProps> = ({
  ticker,
  timeframe,
  period,
  onAnalyzeChart,
  isAnalyzing,
  keyLevels = [],
  tradingRecommendation = null,
  showTradingOverlays = true
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  
  // State
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);

  // Reset chart ready state when ticker, timeframe, or period changes
  useEffect(() => {
    console.log('🔄 [SimpleChartViewer] Ticker, timeframe, or period changed, resetting chart ready state');
    setIsChartReady(false);
    setLastScreenshot(null); // Clear previous screenshot
  }, [ticker, timeframe, period]);

  // Handle chart ready callback
  const handleChartReady = useCallback((chartInstance: any) => {
    console.log('📊 [SimpleChartViewer] Hidden chart is ready for capture');
    chartInstanceRef.current = chartInstance;
    setIsChartReady(true);
  }, []);

  // Handle analyze chart - captures from the modern chart
  const handleAnalyzeChart = useCallback(async () => {
    console.log('🎯 Starting chart analysis for', ticker, timeframe);
    
    try {
      setIsCapturing(true);
      
      console.log('📊 Checking chart container...');
      if (!chartContainerRef.current) {
        console.error('❌ Chart container ref is null');
        throw new Error('Chart container not found');
      }
      
      if (!isChartReady) {
        console.log('⏳ Chart not ready yet, waiting...');
        // Wait for chart to be ready with timeout
        let attempts = 0;
        const maxAttempts = 30; // 15 seconds max wait
        while (!isChartReady && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (!isChartReady) {
          throw new Error('Chart failed to load within timeout period');
        }
      }
      
      console.log('✅ Chart is ready, waiting additional time for rendering...');
      // Additional wait for visual rendering to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('📸 Attempting to capture screenshot...');
      let screenshot: string;
      
      // Try native screenshot first if chart instance is available
      if (chartInstanceRef.current) {
        try {
          console.log('🎯 Trying native chart screenshot method...');
          screenshot = await captureChartScreenshotNative(chartInstanceRef.current);
          console.log('✅ Native screenshot successful!');
        } catch (nativeError) {
          console.warn('⚠️ Native screenshot failed, falling back to html2canvas:', nativeError);
          screenshot = await captureChartScreenshot(chartContainerRef.current);
        }
      } else {
        console.log('📸 Using html2canvas method...');
        screenshot = await captureChartScreenshot(chartContainerRef.current);
      }
      
      console.log('✅ Screenshot captured successfully, length:', screenshot.length);
      setLastScreenshot(screenshot);
      
      console.log('🤖 Sending to AI for analysis...');
      // Immediately analyze
      onAnalyzeChart(screenshot, `Timeframe: ${timeframe} | Modern Chart Analysis`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture chart';
      console.error('❌ Chart analysis failed:', errorMessage);
      
      toast({
        title: 'Analysis Failed',
        description: `${errorMessage}. Please try manual upload below.`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCapturing(false);
    }
  }, [onAnalyzeChart, timeframe, toast, ticker, isChartReady]);

  // Handle manual file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        const imageData = result.split(',')[1];
        setLastScreenshot(imageData);
        onAnalyzeChart(imageData, `Manual upload - Timeframe: ${timeframe}`);
      }
    };
    reader.readAsDataURL(file);
  }, [onAnalyzeChart, timeframe, toast]);

  return (
    <VStack spacing={6} align="stretch">
      {/* Enhanced Chart Controls */}
      <Flex
        justify="space-between"
        align="center"
        p={5}
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        boxShadow="sm"
      >
        <VStack align="start" spacing={1}>
          <Text fontWeight="bold" fontSize="xl" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
            {ticker} Analysis Chart
          </Text>
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
            What you see is exactly what gets analyzed by AI
          </Text>
        </VStack>
        
        <HStack spacing={3}>
          <Button
            leftIcon={<Icon as={FiCamera} />}
            onClick={handleAnalyzeChart}
            isLoading={isAnalyzing || isCapturing}
            loadingText={isCapturing ? "Capturing..." : "Analyzing..."}
            size="lg"
            colorScheme="blue"
            borderRadius="xl"
            px={6}
            _hover={{
              transform: 'translateY(-1px)',
              boxShadow: 'lg',
            }}
            transition="all 0.2s ease-in-out"
          >
            Analyze Chart
          </Button>
        </HStack>
      </Flex>

      {/* Modern Chart - Single source of truth */}
      <Box ref={chartContainerRef} position="relative">
        <ModernCandlestickChart
          symbol={ticker}
          timeframe={timeframe}
          period={period}
          height="650px"
          width="100%"
          onChartReady={handleChartReady}
          keyLevels={keyLevels}
          showHeader={true}
          tradingRecommendation={tradingRecommendation}
          showTradingOverlays={showTradingOverlays}
          showVolume={false}
          showSMA20={false}
          showSMA50={false}
          showSMA200={false}
          showVWAP={false}
        />
      </Box>

      {/* Manual Upload Fallback */}
      <Box
        p={4}
        bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.300'}
      >
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={1}>
            <Text fontSize="sm" fontWeight="medium" color={colorMode === 'dark' ? 'gray.300' : 'gray.700'}>
              Manual Upload Fallback
            </Text>
            <Text fontSize="xs" color="gray.500">
              If automatic analysis fails, upload a chart screenshot manually
            </Text>
          </VStack>
          
          <Button
            as="label"
            htmlFor="chart-upload"
            size="sm"
            variant="outline"
            colorScheme="gray"
            cursor="pointer"
            leftIcon={<Icon as={FiDownload} />}
            borderRadius="lg"
          >
            Upload Image
            <input
              id="chart-upload"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </Button>
        </HStack>
      </Box>

      {/* Enhanced Status Alert */}
      {(isCapturing || isAnalyzing) && (
        <Alert
          status="info"
          borderRadius="xl"
          bg={colorMode === 'dark' ? 'blue.900' : 'blue.50'}
          borderColor={colorMode === 'dark' ? 'blue.700' : 'blue.200'}
          borderWidth="1px"
        >
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="semibold">
              {isCapturing ? 'Capturing Chart' : 'AI Analysis in Progress'}
            </Text>
            <Text fontSize="sm" opacity={0.8}>
              {isCapturing ? 'Taking high-resolution screenshot of your chart...' : 'AI is analyzing your chart for patterns and insights...'}
            </Text>
          </VStack>
        </Alert>
      )}
    </VStack>
  );
};

export default SimpleChartViewer;