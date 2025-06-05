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
import { FiSearch, FiCheckCircle, FiXCircle, FiAlertCircle, FiPlusCircle } from 'react-icons/fi';
import { HStack } from '@chakra-ui/react';
import { useData, analyzeOptionsStart, analyzeOptionsSuccess, analyzeOptionsError } from '../context/DataContext';
import { analyzeOptions } from '../services/optionsService';
import { OptionsAnalysisResult } from '../types';
import TradingViewWidget from './TradingViewWidget';
import EarningsHistoryChart from './EarningsHistoryChart';
import NakedOptionsDisplay from './NakedOptionsDisplay';
import IronCondorDisplay from './IronCondorDisplay';
import CalendarSpreadDisplay from './CalendarSpreadDisplay';
import PinTradeButton from './tradeTracker/PinTradeButton';
import { getCurrentDateString } from '../utils/dateUtils';

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
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
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
      setAnalysisStartTime(Date.now());
      
      // Add debug logging
      console.log(`DirectSearch: Calling analyzeOptions for ${ticker} with runFullAnalysis=true`);
      
      const result = await analyzeOptions(ticker, true); // Set runFullAnalysis to true
      
      // Add debug logging for the result
      console.log(`DirectSearch: Received result for ${ticker}`, {
        hasMonteCarloResults: !!result.optimalCalendarSpread?.monteCarloResults,
        numSimulations: result.optimalCalendarSpread?.monteCarloResults?.numSimulations
      });
      
      dispatch(analyzeOptionsSuccess(result));
      setAnalysisStartTime(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch(analyzeOptionsError(errorMessage));
      setAnalysisStartTime(null);
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
        <Flex justify="center" align="center" direction="column" my={10}>
          <Flex align="center" mb={4}>
            <Spinner size="xl" color="brand.500" mr={4} />
            <Text fontSize="lg">Analyzing options data...</Text>
          </Flex>
          
          {analysisStartTime && (
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.500">
                Elapsed time: {Math.floor((Date.now() - analysisStartTime) / 1000)} seconds
              </Text>
              {Date.now() - analysisStartTime > 15000 && (
                <Alert status="info" mt={2} borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Analysis in progress</AlertTitle>
                    <AlertDescription>
                      Iron condor analysis may take some time to complete, especially for complex calculations. Please be patient.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </Box>
          )}
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
                borderColor={getRecommendationColor(optionsData.analysisResult!.recommendation) + '.500'}
                boxShadow="md"
              >
                <CardHeader
                  bg={getRecommendationColor(optionsData.analysisResult!.recommendation) + '.500'}
                  color="white"
                >
                  <Flex alignItems="center">
                    <Heading size="md">
                      {optionsData.analysisResult!.ticker} - {optionsData.analysisResult!.recommendation}
                    </Heading>
                    <Box ml="auto">
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          leftIcon={<FiPlusCircle />}
                          colorScheme="green"
                          onClick={() => {
                            // Check if analysisResult exists
                            if (!optionsData.analysisResult) return;
                            
                            // Import the ConvertToTradeModal component dynamically
                            import('./tradeTracker/ConvertToTradeModal').then(({ default: ConvertToTradeModal }) => {
                              // Create a temporary trade idea
                              const tradeIdea = {
                                id: `temp-${Date.now()}`,
                                ticker: optionsData.analysisResult!.ticker,
                                entryDate: getCurrentDateString(),
                                entryPrice: 0,
                                quantity: 0,
                                direction: 'long',
                                status: 'open',
                                strategy: optionsData.analysisResult!.optimalCalendarSpread ? 'calendar_spread' :
                                         optionsData.analysisResult!.optimalIronCondors ? 'iron_condor' :
                                         optionsData.analysisResult!.optimalNakedOptions ? 'single_option' : 'stock',
                                fees: 0,
                                notes: `Analysis from Direct Search: ${optionsData.analysisResult!.recommendation}`,
                                tags: ['from_direct_search'],
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                metadata: {
                                  companyName: optionsData.analysisResult!.companyName || '',
                                  currentPrice: optionsData.analysisResult!.currentPrice,
                                  metrics: optionsData.analysisResult!.metrics,
                                  expectedMove: optionsData.analysisResult!.expectedMove,
                                  reportTime: optionsData.analysisResult!.reportTime
                                }
                              };
                              
                              // Create a modal element
                              const modalContainer = document.createElement('div');
                              document.body.appendChild(modalContainer);
                              
                              // Render the modal
                              // Note: This is a simplified approach. In a real app, you'd use React's createPortal or a modal context
                              const openTradeModal = () => {
                                // Show a toast message instead
                                const toast = document.createElement('div');
                                toast.textContent = 'Opening trade modal...';
                                toast.style.position = 'fixed';
                                toast.style.bottom = '20px';
                                toast.style.right = '20px';
                                toast.style.padding = '10px 20px';
                                toast.style.backgroundColor = '#38A169';
                                toast.style.color = 'white';
                                toast.style.borderRadius = '4px';
                                toast.style.zIndex = '9999';
                                document.body.appendChild(toast);
                                
                                setTimeout(() => {
                                  document.body.removeChild(toast);
                                }, 3000);
                              };
                              
                              openTradeModal();
                            });
                          }}
                        >
                          Open Trade
                        </Button>
                        <PinTradeButton
                          ticker={optionsData.analysisResult!.ticker}
                          price={optionsData.analysisResult!.currentPrice}
                          strategy={optionsData.analysisResult!.optimalCalendarSpread ? 'calendar_spread' :
                                   optionsData.analysisResult!.optimalIronCondors ? 'iron_condor' :
                                   optionsData.analysisResult!.optimalNakedOptions ? 'single_option' : 'stock'}
                          tooltipPlacement="left"
                          companyName={optionsData.analysisResult!.companyName || ''}
                          reportTime={optionsData.analysisResult!.reportTime || ''}
                          earningsDate={optionsData.analysisResult!.earningsDate || ''}
                        />
                      </HStack>
                    </Box>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                    <GridItem>
                      <Stat>
                        <StatLabel>Current Price</StatLabel>
                        <StatNumber>${optionsData.analysisResult!.currentPrice.toFixed(2)}</StatNumber>
                      </Stat>
                    </GridItem>
                    <GridItem>
                      <Stat>
                        <StatLabel>Expected Move</StatLabel>
                        <StatNumber>{optionsData.analysisResult!.expectedMove}</StatNumber>
                        <StatHelpText>Based on ATM straddle</StatHelpText>
                      </Stat>
                    </GridItem>
                  </Grid>
                  
                  <Divider my={4} />
                  
                  <Heading size="sm" mb={3}>Analysis Metrics</Heading>
                  <Stack spacing={3}>
                    <Flex align="center">
                      <Icon
                        as={optionsData.analysisResult!.metrics.avgVolumePass === "true" ? FiCheckCircle : FiXCircle}
                        color={optionsData.analysisResult!.metrics.avgVolumePass === "true" ? 'green.500' : 'red.500'}
                        mr={2}
                      />
                      <Text fontWeight="medium">Average Volume:</Text>
                      <Text ml={2}>{optionsData.analysisResult!.metrics.avgVolume.toLocaleString()}</Text>
                      <Badge
                        ml={2}
                        colorScheme={optionsData.analysisResult!.metrics.avgVolumePass === "true" ? 'green' : 'red'}
                      >
                        {optionsData.analysisResult!.metrics.avgVolumePass === "true" ? 'PASS' : 'FAIL'}
                      </Badge>
                    </Flex>
                    
                    <Flex align="center">
                      <Icon
                        as={optionsData.analysisResult!.metrics.iv30Rv30Pass === "true" ? FiCheckCircle : FiXCircle}
                        color={optionsData.analysisResult!.metrics.iv30Rv30Pass === "true" ? 'green.500' : 'red.500'}
                        mr={2}
                      />
                      <Text fontWeight="medium">IV30/RV30 Ratio:</Text>
                      <Text ml={2}>{optionsData.analysisResult!.metrics.iv30Rv30.toFixed(2)}</Text>
                      <Badge
                        ml={2}
                        colorScheme={optionsData.analysisResult!.metrics.iv30Rv30Pass === "true" ? 'green' : 'red'}
                      >
                        {optionsData.analysisResult!.metrics.iv30Rv30Pass === "true" ? 'PASS' : 'FAIL'}
                      </Badge>
                    </Flex>
                    
                    <Flex align="center">
                      <Icon
                        as={optionsData.analysisResult!.metrics.tsSlopePass === "true" ? FiCheckCircle : FiXCircle}
                        color={optionsData.analysisResult!.metrics.tsSlopePass === "true" ? 'green.500' : 'red.500'}
                        mr={2}
                      />
                      <Text fontWeight="medium">Term Structure Slope:</Text>
                      <Text ml={2}>{optionsData.analysisResult!.metrics.tsSlope.toFixed(5)}</Text>
                      <Badge
                        ml={2}
                        colorScheme={optionsData.analysisResult!.metrics.tsSlopePass === "true" ? 'green' : 'red'}
                      >
                        {optionsData.analysisResult!.metrics.tsSlopePass === "true" ? 'PASS' : 'FAIL'}
                      </Badge>
                    </Flex>
                  </Stack>
                  
                  {/* Calendar Spread Section - Always show, with message if no viable spreads found */}
                  <Divider my={4} />
                  <Box mt={4}>
                    {optionsData.analysisResult!.optimalCalendarSpread ? (
                      <>
                        <CalendarSpreadDisplay
                          ticker={optionsData.analysisResult!.ticker}
                          calendarSpread={optionsData.analysisResult!.optimalCalendarSpread}
                          expectedMove={{
                            percent: parseFloat(optionsData.analysisResult!.expectedMove.replace('%', '')) / 100,
                            dollars: parseFloat(optionsData.analysisResult!.expectedMove.replace('%', '')) * optionsData.analysisResult!.currentPrice / 100
                          }}
                          daysToExpiration={30} // Approximate, would be provided by backend in real implementation
                          compact={true}
                        />
                        {optionsData.analysisResult!.optimalCalendarSpread.metricsPass === "false" && (
                          <Alert status="warning" mt={2} size="sm">
                            <AlertIcon />
                            <Text fontSize="sm">
                              Note: This ticker does not meet all the recommended metrics for a calendar spread.
                            </Text>
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Box
                        borderWidth="2px"
                        borderRadius="lg"
                        borderColor="brand.500"
                        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                        boxShadow="lg"
                        overflow="hidden"
                        p={4}
                      >
                        <Heading
                          size="sm"
                          mb={4}
                          color="white"
                          textAlign="center"
                          borderBottom="2px solid"
                          borderColor="brand.500"
                          pb={2}
                        >
                          {optionsData.analysisResult!.ticker} Calendar Spread Strategy
                        </Heading>
                        
                        <Divider mb={4} />
                        
                        <Flex direction="column" align="center" justify="center" py={6}>
                          <Heading as="h4" size="md" color="red.500" mb={2}>
                            No Suitable Calendar Spreads Found
                          </Heading>
                          
                          <Text align="center" maxWidth="500px">
                            No calendar spreads met the minimum criteria for spread cost, liquidity, or overall quality score.
                            Common reasons include insufficient spread cost (minimum $0.15) or low liquidity.
                          </Text>
                        </Flex>
                      </Box>
                    )}
                  </Box>
                  
                  {/* Strategy Sections - Always show both Naked Options and Iron Condors */}
                  <Divider my={4} />
                  
                  {/* Display strategies in a grid layout */}
                  <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                    {/* Naked Options Section */}
                    <GridItem>
                      <Box
                        borderWidth="2px"
                        borderRadius="lg"
                        borderColor="brand.500"
                        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                        boxShadow="lg"
                        height="100%"
                        overflow="hidden"
                        p={1} // Add padding to ensure border is visible
                      >
                        <NakedOptionsDisplay
                          ticker={optionsData.analysisResult!.ticker}
                          nakedOptions={optionsData.analysisResult!.optimalNakedOptions || {
                            expectedMove: { percent: 0, dollars: 0 },
                            daysToExpiration: 0,
                            topOptions: []
                          }}
                          compact={true}
                        />
                      </Box>
                    </GridItem>
                    
                    {/* Iron Condor Section */}
                    <GridItem>
                      <Box
                        borderWidth="2px"
                        borderRadius="lg"
                        borderColor="brand.500"
                        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                        boxShadow="lg"
                        height="100%"
                        overflow="hidden"
                        p={1} // Add padding to ensure border is visible
                      >
                        <IronCondorDisplay
                          ticker={optionsData.analysisResult!.ticker}
                          ironCondors={optionsData.analysisResult!.optimalIronCondors || {
                            expectedMove: { percent: 0, dollars: 0 },
                            daysToExpiration: 0,
                            topIronCondors: [],
                            nextBestPlay: null
                          }}
                          compact={true}
                        />
                      </Box>
                    </GridItem>
                  </Grid>
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
                    ticker={optionsData.analysisResult!.ticker}
                    years={7}
                  />
                </Box>
              </Box>
            </GridItem>
          </Grid>
          
          {/* TradingView Chart */}
          <Box mt={8} mb={8}>
            <TradingViewWidget
              symbol={optionsData.analysisResult!.ticker}
              height="1000px"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DirectSearch;