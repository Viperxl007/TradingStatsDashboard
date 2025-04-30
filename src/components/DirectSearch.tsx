import React, { useState, useEffect } from 'react';
import {
  Box,
  Input,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Flex,
  Heading,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Divider,
  Grid,
  GridItem,
  useColorMode,
  Card,
  CardHeader,
  CardBody,
  Stack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Icon
} from '@chakra-ui/react';
import { FiSearch, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { useData, analyzeOptionsStart, analyzeOptionsSuccess, analyzeOptionsError } from '../context/DataContext';
import { analyzeOptions } from '../services/optionsService';
import { OptionsAnalysisResult } from '../types';
import TradingViewWidget from './TradingViewWidget';
import EarningsHistoryChart from './EarningsHistoryChart';
import NakedOptionsDisplay from './NakedOptionsDisplay';

declare global {
  interface Window {
    TradingView: any;
  }
}

/**
 * DirectSearch Component
 * 
 * This component allows users to search for a specific ticker symbol
 * and view options analysis results.
 */
const DirectSearch: React.FC = () => {
  const { colorMode } = useColorMode();
  const { state, dispatch } = useData();
  const [ticker, setTicker] = useState<string>('');
  const [tradingViewLoaded, setTradingViewLoaded] = useState<boolean>(false);
  const { optionsData } = state;
  
  // Check if TradingView script is loaded
  useEffect(() => {
    const checkTradingViewLoaded = () => {
      if (window.TradingView) {
        setTradingViewLoaded(true);
        return true;
      }
      return false;
    };
    
    // Check immediately
    if (!checkTradingViewLoaded()) {
      // If not loaded, check again when the script might be loaded
      const scriptElement = document.getElementById('tradingview-widget-script');
      if (scriptElement) {
        scriptElement.addEventListener('load', checkTradingViewLoaded);
        return () => {
          scriptElement.removeEventListener('load', checkTradingViewLoaded);
        };
      }
    }
  }, []);

  const handleSearch = async () => {
    if (!ticker.trim()) return;
    
    try {
      dispatch(analyzeOptionsStart(ticker));
      const result = await analyzeOptions(ticker);
      dispatch(analyzeOptionsSuccess(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch(analyzeOptionsError(errorMessage));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'Recommended':
        return 'green';
      case 'Consider':
        return 'orange';
      case 'Avoid':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Box>
      <Box mb={6}>
        <Heading size="md" mb={4}>Search Options for a Stock</Heading>
        <Text mb={4}>
          Enter a stock ticker symbol to analyze options data and get a recommendation for earnings plays.
        </Text>
        
        <Flex>
          <FormControl mr={4}>
            <FormLabel htmlFor="ticker">Stock Ticker</FormLabel>
            <Input
              id="ticker"
              placeholder="e.g., AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              maxWidth="300px"
            />
            <FormHelperText>Enter a valid stock ticker symbol</FormHelperText>
          </FormControl>
          
          <Button
            colorScheme="brand"
            onClick={handleSearch}
            isLoading={optionsData.isLoading}
            loadingText="Analyzing"
            leftIcon={<Icon as={FiSearch} />}
            alignSelf="flex-end"
            mb={1}
          >
            Analyze
          </Button>
        </Flex>
      </Box>

      {optionsData.isLoading && (
        <Flex justify="center" align="center" my={10}>
          <Spinner size="xl" color="brand.500" mr={4} />
          <Text>Analyzing options data...</Text>
        </Flex>
      )}

      {optionsData.error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <AlertTitle mr={2}>Error!</AlertTitle>
          <AlertDescription>
            {optionsData.error}
            {optionsData.error.includes('Failed to connect to the backend server') && (
              <Box mt={2}>
                <Text fontWeight="bold">Troubleshooting steps:</Text>
                <Text>1. Make sure the backend server is running:</Text>
                <Box as="pre" p={2} bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'} borderRadius="md" fontSize="sm" mt={1} mb={2}>
                  cd trading-stats-dashboard/backend<br />
                  pip install -r requirements.txt<br />
                  python run.py
                </Box>
                <Text>2. Check that the server is running on port 5000</Text>
                <Text>3. Ensure there are no CORS issues</Text>
              </Box>
            )}
          </AlertDescription>
        </Alert>
      )}

      {optionsData.analysisResult && !optionsData.isLoading && !optionsData.error && (
        <Box>
          {/* Analysis Results and Earnings History in a split view */}
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={6} mb={6}>
            <GridItem>
              <Card
                height="100%"
                variant="outline"
                borderColor={getRecommendationColor(optionsData.analysisResult.recommendation) + '.500'}
                boxShadow="md"
              >
                <CardHeader
                  bg={getRecommendationColor(optionsData.analysisResult.recommendation) + '.500'}
                  color="white"
                >
                  <Heading size="md">
                    {optionsData.analysisResult.ticker} - {optionsData.analysisResult.recommendation}
                  </Heading>
                </CardHeader>
                <CardBody>
                  <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                    <GridItem>
                      <Stat>
                        <StatLabel>Current Price</StatLabel>
                        <StatNumber>${optionsData.analysisResult.currentPrice.toFixed(2)}</StatNumber>
                      </Stat>
                    </GridItem>
                    <GridItem>
                      <Stat>
                        <StatLabel>Expected Move</StatLabel>
                        <StatNumber>{optionsData.analysisResult.expectedMove}</StatNumber>
                        <StatHelpText>Based on ATM straddle</StatHelpText>
                      </Stat>
                    </GridItem>
                  </Grid>
                  
                  <Divider my={4} />
                  
                  <Heading size="sm" mb={3}>Analysis Metrics</Heading>
                  <Stack spacing={3}>
                    <Flex align="center">
                      <Icon
                        as={optionsData.analysisResult.metrics.avgVolumePass === "true" ? FiCheckCircle : FiXCircle}
                        color={optionsData.analysisResult.metrics.avgVolumePass === "true" ? 'green.500' : 'red.500'}
                        mr={2}
                      />
                      <Text fontWeight="medium">Average Volume:</Text>
                      <Text ml={2}>{optionsData.analysisResult.metrics.avgVolume.toLocaleString()}</Text>
                      <Badge
                        ml={2}
                        colorScheme={optionsData.analysisResult.metrics.avgVolumePass === "true" ? 'green' : 'red'}
                      >
                        {optionsData.analysisResult.metrics.avgVolumePass === "true" ? 'PASS' : 'FAIL'}
                      </Badge>
                    </Flex>
                    
                    <Flex align="center">
                      <Icon
                        as={optionsData.analysisResult.metrics.iv30Rv30Pass === "true" ? FiCheckCircle : FiXCircle}
                        color={optionsData.analysisResult.metrics.iv30Rv30Pass === "true" ? 'green.500' : 'red.500'}
                        mr={2}
                      />
                      <Text fontWeight="medium">IV30/RV30 Ratio:</Text>
                      <Text ml={2}>{optionsData.analysisResult.metrics.iv30Rv30.toFixed(2)}</Text>
                      <Badge
                        ml={2}
                        colorScheme={optionsData.analysisResult.metrics.iv30Rv30Pass === "true" ? 'green' : 'red'}
                      >
                        {optionsData.analysisResult.metrics.iv30Rv30Pass === "true" ? 'PASS' : 'FAIL'}
                      </Badge>
                    </Flex>
                    
                    <Flex align="center">
                      <Icon
                        as={optionsData.analysisResult.metrics.tsSlopePass === "true" ? FiCheckCircle : FiXCircle}
                        color={optionsData.analysisResult.metrics.tsSlopePass === "true" ? 'green.500' : 'red.500'}
                        mr={2}
                      />
                      <Text fontWeight="medium">Term Structure Slope:</Text>
                      <Text ml={2}>{optionsData.analysisResult.metrics.tsSlope.toFixed(5)}</Text>
                      <Badge
                        ml={2}
                        colorScheme={optionsData.analysisResult.metrics.tsSlopePass === "true" ? 'green' : 'red'}
                      >
                        {optionsData.analysisResult.metrics.tsSlopePass === "true" ? 'PASS' : 'FAIL'}
                      </Badge>
                    </Flex>
                  </Stack>
                  
                  {/* Optimal Spread Section - Always show if optimalCalendarSpread is available */}
                  {optionsData.analysisResult.optimalCalendarSpread && (
                    <>
                      <Divider my={4} />
                      <Heading size="sm" mb={3}>
                        Optimal Spread
                        {optionsData.analysisResult.optimalCalendarSpread.metricsPass === "false" && (
                          <Badge ml={2} colorScheme="orange">Metrics Not Met</Badge>
                        )}
                      </Heading>
                      <Stack spacing={3}>
                        <Flex align="center">
                          <Text fontWeight="medium">Strike Price:</Text>
                          <Text ml={2}>${optionsData.analysisResult.optimalCalendarSpread.strike.toFixed(2)}</Text>
                        </Flex>
                        <Flex align="center">
                          <Text fontWeight="medium">Front Month:</Text>
                          <Text ml={2}>{new Date(optionsData.analysisResult.optimalCalendarSpread.frontMonth).toLocaleDateString()}</Text>
                        </Flex>
                        <Flex align="center">
                          <Text fontWeight="medium">Back Month:</Text>
                          <Text ml={2}>{new Date(optionsData.analysisResult.optimalCalendarSpread.backMonth).toLocaleDateString()}</Text>
                        </Flex>
                        <Flex align="center">
                          <Text fontWeight="medium">Spread Cost:</Text>
                          <Text ml={2}>${optionsData.analysisResult.optimalCalendarSpread.spreadCost.toFixed(2)}</Text>
                        </Flex>
                        <Flex align="center">
                          <Text fontWeight="medium">IV Differential:</Text>
                          <Text ml={2}>{(optionsData.analysisResult.optimalCalendarSpread.ivDifferential * 100).toFixed(2)}%</Text>
                        </Flex>
                        <Text fontSize="sm" fontStyle="italic" mt={2}>
                          This is the algorithmically identified optimal calendar spread based on liquidity, IV differential, and cost efficiency.
                          {optionsData.analysisResult.optimalCalendarSpread.metricsPass === "false" && (
                            <Text as="span" color="orange.500"> Note: This ticker does not meet all the recommended metrics for a calendar spread.</Text>
                          )}
                        </Text>
                      </Stack>
                    </>
                  )}
                  
                  {/* Naked Options Section - Show if optimalNakedOptions is available */}
                  {optionsData.analysisResult.optimalNakedOptions && (
                    <>
                      <Divider my={4} />
                      <Heading size="sm" mb={3}>
                        Naked Options Opportunities
                      </Heading>
                      <Box
                        borderWidth="2px"
                        borderRadius="lg"
                        borderColor="brand.500"
                        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                        boxShadow="lg"
                        mb={6}
                        overflow="hidden"
                      >
                        <NakedOptionsDisplay
                          ticker={optionsData.analysisResult.ticker}
                          nakedOptions={optionsData.analysisResult.optimalNakedOptions}
                          compact={true}
                        />
                      </Box>
                    </>
                  )}
                </CardBody>
              </Card>
            </GridItem>
            
            <GridItem>
              {/* Earnings History Chart */}
              <Box
                height="100%"
                borderWidth="1px"
                borderRadius="lg"
                overflow="hidden"
                boxShadow="md"
              >
                <Box
                  p={4}
                  borderBottomWidth="1px"
                  bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                >
                  <Heading size="md">Post-Earnings Performance History</Heading>
                </Box>
                <Box p={4}>
                  <EarningsHistoryChart
                    ticker={optionsData.analysisResult.ticker}
                    years={7}
                  />
                </Box>
              </Box>
            </GridItem>
          </Grid>
          
          {/* TradingView Chart */}
          <Box mt={8} mb={8}>
            <TradingViewWidget
              symbol={optionsData.analysisResult.ticker}
              height="1000px"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DirectSearch;