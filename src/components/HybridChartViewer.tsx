import React, { useRef, useState, useCallback } from 'react';
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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Switch,
  FormControl,
  FormLabel
} from '@chakra-ui/react';
import { FiCamera, FiDownload, FiEye, FiLayers } from 'react-icons/fi';
import TradingViewWidget from './TradingViewWidget';
import TradingViewLightweightChart from './TradingViewLightweightChart';
import ChartAnnotations from './ChartAnnotations';
import { KeyLevel } from '../types/chartAnalysis';
import { captureChartScreenshot } from '../services/chartAnalysisService';

interface HybridChartViewerProps {
  ticker: string;
  timeframe: string;
  onAnalyzeChart: (chartImage: string, additionalContext?: string) => void;
  isAnalyzing: boolean;
  keyLevels?: KeyLevel[];
}

/**
 * Hybrid Chart Viewer Component
 * 
 * This component provides the best of both worlds:
 * 1. TradingView widget for user interaction and navigation
 * 2. Lightweight chart with real data for screenshot capture
 */
const HybridChartViewer: React.FC<HybridChartViewerProps> = ({
  ticker,
  timeframe,
  onAnalyzeChart,
  isAnalyzing,
  keyLevels = []
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  // Refs for chart containers
  const tradingViewRef = useRef<HTMLDivElement>(null);
  const lightweightChartRef = useRef<HTMLDivElement>(null);
  
  // State
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [activeTab, setActiveTab] = useState(0); // 0 = TradingView, 1 = Lightweight
  const [useRealDataCapture, setUseRealDataCapture] = useState(true); // Default to real data capture

  // Handle chart screenshot capture
  const handleCaptureScreenshot = useCallback(async () => {
    try {
      setIsCapturing(true);
      
      // Always try real data capture first, regardless of current tab
      if (useRealDataCapture) {
        // Switch to lightweight chart tab if not already there
        if (activeTab !== 1) {
          setActiveTab(1);
          // Wait for tab switch and chart render
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Wait for chart to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!lightweightChartRef.current) {
          throw new Error('Real data chart container not found');
        }
        
        const screenshot = await captureChartScreenshot(lightweightChartRef.current);
        setLastScreenshot(screenshot);
        
        toast({
          title: 'Screenshot Captured',
          description: 'Chart screenshot captured successfully using real market data',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        return screenshot;
      } else {
        // Fallback to TradingView widget capture (will likely fail)
        if (!tradingViewRef.current) {
          throw new Error('TradingView chart container not found');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        const screenshot = await captureChartScreenshot(tradingViewRef.current);
        setLastScreenshot(screenshot);
        
        toast({
          title: 'Screenshot Captured',
          description: 'Chart screenshot captured from TradingView widget',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        return screenshot;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture screenshot';
      
      // Check if this is a capture issue and we can try real data mode
      const isCaptureIssue = errorMessage.includes('cross-origin') ||
                            errorMessage.includes('blank') ||
                            errorMessage.includes('empty') ||
                            errorMessage.includes('chart may not be fully loaded');
      
      if (isCaptureIssue && !useRealDataCapture) {
        // Automatically switch to real data capture and retry
        toast({
          title: 'Switching to Real Data Capture',
          description: 'TradingView capture failed. Automatically switching to real data mode...',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        
        setUseRealDataCapture(true);
        
        // Retry with real data capture
        try {
          setActiveTab(1);
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (!lightweightChartRef.current) {
            throw new Error('Real data chart container not found after switch');
          }
          
          const screenshot = await captureChartScreenshot(lightweightChartRef.current);
          setLastScreenshot(screenshot);
          
          toast({
            title: 'Screenshot Captured',
            description: 'Successfully captured using real market data after automatic switch',
            status: 'success',
            duration: 4000,
            isClosable: true,
          });
          
          return screenshot;
        } catch (retryError) {
          toast({
            title: 'Capture Failed',
            description: 'Both capture methods failed. Please try manual upload or wait for charts to load completely.',
            status: 'error',
            duration: 8000,
            isClosable: true,
          });
          throw retryError;
        }
      } else {
        toast({
          title: 'Screenshot Failed',
          description: errorMessage,
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
        throw error;
      }
    } finally {
      setIsCapturing(false);
    }
  }, [toast, useRealDataCapture, activeTab]);

  // Handle analyze chart with screenshot
  const handleAnalyzeWithScreenshot = useCallback(async () => {
    try {
      let screenshot = lastScreenshot;
      
      // If no recent screenshot, capture one
      if (!screenshot) {
        const capturedScreenshot = await handleCaptureScreenshot();
        screenshot = capturedScreenshot || null;
      }
      
      if (screenshot) {
        onAnalyzeChart(screenshot, `Timeframe: ${timeframe} | Data Source: ${useRealDataCapture ? 'Real Market Data' : 'TradingView Widget'}`);
      }
    } catch (error) {
      // Error already handled in handleCaptureScreenshot
    }
  }, [lastScreenshot, handleCaptureScreenshot, onAnalyzeChart, timeframe, useRealDataCapture]);

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
        // Remove data URL prefix to get base64 data
        const imageData = result.split(',')[1];
        setLastScreenshot(imageData);
        onAnalyzeChart(imageData, `Manual upload - Timeframe: ${timeframe}`);
      }
    };
    reader.readAsDataURL(file);
  }, [onAnalyzeChart, timeframe, toast]);

  return (
    <VStack spacing={4} align="stretch">
      {/* Chart Controls */}
      <Box
        p={4}
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      >
        <HStack justify="space-between" align="center" mb={4}>
          <Text fontWeight="semibold">
            {ticker} Chart ({timeframe})
          </Text>
          
          <HStack spacing={3}>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="real-data-capture" mb="0" fontSize="sm">
                Real Data Capture
              </FormLabel>
              <Switch
                id="real-data-capture"
                isChecked={useRealDataCapture}
                onChange={(e) => setUseRealDataCapture(e.target.checked)}
                colorScheme="blue"
                size="sm"
              />
            </FormControl>
            
            <Button
              leftIcon={<Icon as={FiCamera} />}
              onClick={handleCaptureScreenshot}
              isLoading={isCapturing}
              loadingText="Capturing..."
              size="sm"
              colorScheme="blue"
              variant="outline"
            >
              Capture
            </Button>
            
            <Button
              leftIcon={<Icon as={FiEye} />}
              onClick={handleAnalyzeWithScreenshot}
              isLoading={isAnalyzing}
              loadingText="Analyzing..."
              size="sm"
              colorScheme="green"
              isDisabled={!lastScreenshot && !isCapturing}
            >
              Analyze Chart
            </Button>
          </HStack>
        </HStack>
        
        <Text fontSize="xs" color="gray.500">
          {useRealDataCapture 
            ? "📊 Real data capture mode: Uses actual market data for accurate AI analysis"
            : "🌐 Widget capture mode: Attempts to capture TradingView widget (may have limitations)"
          }
        </Text>
      </Box>

      {/* Chart Tabs */}
      <Tabs 
        index={activeTab} 
        onChange={setActiveTab}
        variant="enclosed"
        colorScheme="blue"
      >
        <TabList>
          <Tab>
            <HStack spacing={2}>
              <Icon as={FiLayers} />
              <Text>Interactive Chart (TradingView)</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Icon as={FiCamera} />
              <Text>Capture Chart (Real Data)</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          {/* TradingView Widget Tab */}
          <TabPanel p={0} pt={4}>
            <Box position="relative">
              <Box ref={tradingViewRef}>
                <TradingViewWidget
                  symbol={ticker}
                  height="600px"
                  width="100%"
                />
              </Box>
              
              {/* Chart Annotations Overlay */}
              {showAnnotations && keyLevels.length > 0 && (
                <ChartAnnotations
                  keyLevels={keyLevels}
                  chartHeight={600}
                  ticker={ticker}
                />
              )}
            </Box>
          </TabPanel>

          {/* Lightweight Chart Tab */}
          <TabPanel p={0} pt={4}>
            <Box position="relative">
              <Box ref={lightweightChartRef}>
                <TradingViewLightweightChart
                  symbol={ticker}
                  timeframe={timeframe}
                  height="600px"
                  width="100%"
                />
              </Box>
              
              {/* Chart Annotations Overlay */}
              {showAnnotations && keyLevels.length > 0 && (
                <ChartAnnotations
                  keyLevels={keyLevels}
                  chartHeight={600}
                  ticker={ticker}
                />
              )}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Manual Upload Option */}
      <Box
        p={4}
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      >
        <VStack spacing={3}>
          <Text fontSize="sm" fontWeight="medium" color="blue.400">
            📸 Manual Chart Upload
          </Text>
          <Text fontSize="xs" color="gray.500" textAlign="center">
            Alternative option: Upload your own chart screenshot for AI analysis
          </Text>
          
          <Button
            as="label"
            htmlFor="chart-upload"
            size="sm"
            variant="outline"
            colorScheme="gray"
            cursor="pointer"
            leftIcon={<Icon as={FiDownload} />}
          >
            Upload Chart Image
            <input
              id="chart-upload"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </Button>
        </VStack>
      </Box>

      {/* Screenshot Ready Alert */}
      {lastScreenshot && (
        <Alert status="info" borderRadius="lg">
          <AlertIcon />
          Chart screenshot ready for analysis
        </Alert>
      )}
    </VStack>
  );
};

export default HybridChartViewer;