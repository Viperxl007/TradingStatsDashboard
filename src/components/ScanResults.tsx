import React, { useState } from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  HStack,
  VStack,
  useColorMode,
  useToast,
  RadioGroup,
  Radio,
  Stack,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { FiSearch, FiFilter, FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertCircle, FiBarChart } from 'react-icons/fi';
import { useData, scanEarningsStart, scanEarningsSuccess, scanEarningsError } from '../context/DataContext';
import { scanEarningsToday, scanEarningsByDate, analyzeOptions, calculateCalendarLiquidityScore } from '../services/optionsService';
import { OptionsAnalysisResult } from '../types';
import NakedOptionsDisplay from './NakedOptionsDisplay';
import IronCondorDisplay from './IronCondorDisplay';
import CalendarSpreadDisplay from './CalendarSpreadDisplay';
import PinTradeButton from './tradeTracker/PinTradeButton';
import LiquidityThermometer from './LiquidityThermometer';
import SimulationProbabilityDisplay from './SimulationProbabilityDisplay';
import MonteCarloChartModal from './MonteCarloChartModal';
import { calculateSimulationProbability } from '../services/monteCarloSimulation';

/**
 * ScanResults Component
 *
 * This component allows users to scan stocks with earnings announcements
 * and view options analysis results for all of them.
 *
 * It supports three strategy types:
 * 1. calendar - For calendar spread opportunities
 * 2. naked - For naked options selling opportunities
 * 3. ironCondor - For short iron condor opportunities
 */
interface ScanResultsProps {
  scanType?: 'calendar' | 'naked' | 'ironCondor';
}

const ScanResults: React.FC<ScanResultsProps> = ({ scanType: initialScanType }) => {
  const { colorMode } = useColorMode();
  const { state, dispatch } = useData();
  const [strategyType, setStrategyType] = useState<'calendar' | 'naked' | 'ironCondor'>(initialScanType || 'calendar');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRecommendation, setFilterRecommendation] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [simulationsInProgress, setSimulationsInProgress] = useState<Set<string>>(new Set());
  const [completedSimulations, setCompletedSimulations] = useState<Set<string>>(new Set());
  const [simulationResultsCache, setSimulationResultsCache] = useState<Map<string, any>>(new Map());
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [selectedChartTicker, setSelectedChartTicker] = useState<string>('');
  const [selectedChartResults, setSelectedChartResults] = useState<any>(null);
  const toast = useToast();
  
  const { optionsData } = state;

  // State for tracking scan progress
  const [scanProgress, setScanProgress] = useState<{
    completed: number;
    total: number;
    percent: number;
    filtered_out: number;
    no_data: number;
  } | null>(null);
  
  const handleScanToday = async () => {
    try {
      dispatch(scanEarningsStart());
      setScanProgress(null);
      // Reset simulation caches for new scan
      setCompletedSimulations(new Set());
      setSimulationsInProgress(new Set());
      setSimulationResultsCache(new Map());
      
      // Use EventSource for server-sent events
      const eventSource = new EventSource('http://localhost:5000/api/scan/earnings');
      
      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("SSE data received:", data);
          
          if (data.status === 'in_progress') {
            // Update progress information
            setScanProgress(data.progress);
            
            // STREAMING MODE: Process results with simulations as they come in
            if (data.results && data.results.length > 0) {
              console.log(`📊 STREAMING MODE: Processing ${data.results.length} results with simulations...`);
              
              // Process simulations for new results only
              const processedResults = await processStreamingResults(data.results);
              dispatch(scanEarningsSuccess(processedResults));
            }
          } else if (data.status === 'complete') {
            // Close the event source first
            eventSource.close();
            
            console.log(`🏁 STREAMING MODE: Scan complete! Final results displayed.`);
            
            // IMPORTANT: Always dispatch final results to clear loading state, even if empty
            if (data.results && data.results.length > 0) {
              // Process final results if any
              const processedResults = await processStreamingResults(data.results);
              dispatch(scanEarningsSuccess(processedResults));
            } else {
              // No results - dispatch empty array to clear loading state
              console.log(`📊 STREAMING MODE: No results found, clearing loading state`);
              dispatch(scanEarningsSuccess([]));
            }
            
            // Clear progress after a moment
            setTimeout(() => {
              setScanProgress(null);
            }, 2000);
            
            // Show completion toast
            const resultCount = data.count || 0;
            toast({
              title: 'Scan Complete',
              description: resultCount > 0
                ? `Analyzed ${resultCount} stocks with earnings for today`
                : `No stocks found that meet the criteria for today`,
              status: resultCount > 0 ? 'success' : 'info',
              duration: 5000,
              isClosable: true,
            });
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error, "Raw data:", event.data);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        
        const errorMessage = 'Connection to server lost. Please try again.';
        dispatch(scanEarningsError(errorMessage));
        setScanProgress(null);
        
        toast({
          title: 'Scan Failed',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      };
      
      // Add event listener for open event
      eventSource.onopen = () => {
        console.log('EventSource connection opened');
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch(scanEarningsError(errorMessage));
      setScanProgress(null);
      
      toast({
        title: 'Scan Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleScanCustomDate = async () => {
    if (!customDate) {
      toast({
        title: 'Date Required',
        description: 'Please select a date to scan',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    try {
      dispatch(scanEarningsStart(customDate));
      setScanProgress(null);
      // Reset simulation caches for new scan
      setCompletedSimulations(new Set());
      setSimulationsInProgress(new Set());
      setSimulationResultsCache(new Map());
      
      // Use EventSource for server-sent events
      const eventSource = new EventSource(`http://localhost:5000/api/scan/earnings?date=${customDate}`);
      
      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("SSE data received:", data);
          
          if (data.status === 'in_progress') {
            // Update progress information
            setScanProgress(data.progress);
            
            // STREAMING MODE: Process results with simulations as they come in
            if (data.results && data.results.length > 0) {
              console.log(`📊 STREAMING MODE: Processing ${data.results.length} results for custom date with simulations...`);
              
              // Process simulations for new results only
              const processedResults = await processStreamingResults(data.results);
              dispatch(scanEarningsSuccess(processedResults));
            }
          } else if (data.status === 'complete') {
            // Close the event source first
            eventSource.close();
            
            console.log(`🏁 STREAMING MODE: Scan complete! Final results displayed.`);
            
            // IMPORTANT: Always dispatch final results to clear loading state, even if empty
            if (data.results && data.results.length > 0) {
              // Process final results if any
              const processedResults = await processStreamingResults(data.results);
              dispatch(scanEarningsSuccess(processedResults));
            } else {
              // No results - dispatch empty array to clear loading state
              console.log(`📊 STREAMING MODE: No results found, clearing loading state`);
              dispatch(scanEarningsSuccess([]));
            }
            
            // Clear progress after a moment
            setTimeout(() => {
              setScanProgress(null);
            }, 2000);
            
            // Show completion toast
            const resultCount = data.count || 0;
            toast({
              title: 'Scan Complete',
              description: resultCount > 0
                ? `Analyzed ${resultCount} stocks with earnings on ${customDate}`
                : `No stocks found that meet the criteria for ${customDate}`,
              status: resultCount > 0 ? 'success' : 'info',
              duration: 5000,
              isClosable: true,
            });
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error, "Raw data:", event.data);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        
        const errorMessage = 'Connection to server lost. Please try again.';
        dispatch(scanEarningsError(errorMessage));
        setScanProgress(null);
        
        toast({
          title: 'Scan Failed',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      };
      
      // Add event listener for open event
      eventSource.onopen = () => {
        console.log('EventSource connection opened');
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch(scanEarningsError(errorMessage));
      setScanProgress(null);
      
      toast({
        title: 'Scan Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = async (ticker: string) => {
    // Toggle selection if clicking the same ticker
    const newSelectedTicker = selectedTicker === ticker ? null : ticker;
    setSelectedTicker(newSelectedTicker);
    
    // If a ticker is selected, run full analysis for the selected strategy
    if (newSelectedTicker) {
      try {
        // Show loading state
        dispatch(scanEarningsStart());
        
        // Run full analysis for the selected strategy
        const result = await analyzeOptions(newSelectedTicker, true, strategyType);
        
        // Find the original item to preserve company name if it's missing in the result
        const originalItem = optionsData.scanResults.find(item => item.ticker === newSelectedTicker);
        
        // Ensure company name is preserved
        if (originalItem && !result.companyName && originalItem.companyName) {
          result.companyName = originalItem.companyName;
        }
        
        // Calculate calendar liquidity score if this is a calendar strategy
        if (strategyType === 'calendar' && result.earningsDate) {
          try {
            const liquidityScore = await calculateCalendarLiquidityScore(
              newSelectedTicker,
              result.currentPrice,
              result.earningsDate
            );
            result.calendarLiquidityScore = liquidityScore;
          } catch (error) {
            console.warn(`Failed to calculate liquidity score for ${newSelectedTicker}:`, error);
          }
        }
        
        // Calculate simulation results if not already present
        if (result.metrics && result.expectedMove && !result.simulationResults &&
            !simulationsInProgress.has(newSelectedTicker) && !completedSimulations.has(newSelectedTicker)) {
          try {
            // Mark simulation as in progress
            setSimulationsInProgress(prev => new Set(prev).add(newSelectedTicker));
            
            console.log(`🎲 Calculating detailed simulation for ${newSelectedTicker}...`);
            const simulationResults = await calculateSimulationProbability(result);
            if (simulationResults) {
              result.simulationResults = simulationResults;
              console.log(`✅ Detailed simulation completed for ${newSelectedTicker}: ${simulationResults.probabilityOfProfit}%`);
              
              // Mark as completed and cache the results
              setCompletedSimulations(prev => new Set(prev).add(newSelectedTicker));
              setSimulationResultsCache(prev => new Map(prev).set(newSelectedTicker, simulationResults));
              console.log(`💾 Cached detailed simulation results for ${newSelectedTicker}`);
            }
            
            // Remove from progress tracking
            setSimulationsInProgress(prev => {
              const newSet = new Set(prev);
              newSet.delete(newSelectedTicker);
              return newSet;
            });
          } catch (error) {
            console.error(`❌ Failed to calculate simulation results for ${newSelectedTicker}:`, error);
            // Remove from progress tracking even on error
            setSimulationsInProgress(prev => {
              const newSet = new Set(prev);
              newSet.delete(newSelectedTicker);
              return newSet;
            });
          }
        }
        
        // Update the result in the scan results
        dispatch(scanEarningsSuccess(
          optionsData.scanResults.map(item =>
            item.ticker === newSelectedTicker ? result : item
          )
        ));
        
        // Scroll to the options display
        setTimeout(() => {
          let elementId = '';
          if (strategyType === 'naked') {
            elementId = `naked-options-${newSelectedTicker}`;
          } else if (strategyType === 'ironCondor') {
            elementId = `iron-condor-${newSelectedTicker}`;
          } else if (strategyType === 'calendar') {
            elementId = `calendar-spread-${newSelectedTicker}`;
          }
          
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        dispatch(scanEarningsError(errorMessage));
        
        toast({
          title: 'Analysis Failed',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  // STREAMING PROCESSING: Calculate simulations and liquidity for new results as they come in
  const processStreamingResults = async (newResults: OptionsAnalysisResult[]): Promise<OptionsAnalysisResult[]> => {
    console.log(`🚀 STREAMING MODE: Processing ${newResults.length} new results...`);
    
    const processedResults = [...newResults];
    
    // Process both simulations and liquidity calculations for results that need them
    for (let i = 0; i < processedResults.length; i++) {
      const result = processedResults[i];
      const ticker = result.ticker;
      
      // Skip if filtered out
      if (result.recommendation === 'FILTERED OUT') {
        continue;
      }
      
      // 1. Calculate liquidity scores for calendar spreads if needed
      if (strategyType === 'calendar' &&
          result.strategyAvailability?.calendar_available &&
          result.earningsDate &&
          result.calendarLiquidityScore === undefined) {
        try {
          console.log(`📊 STREAMING MODE: Calculating liquidity score for ${ticker}...`);
          const liquidityScore = await calculateCalendarLiquidityScore(
            ticker,
            result.currentPrice,
            result.earningsDate
          );
          processedResults[i] = {
            ...processedResults[i],
            calendarLiquidityScore: liquidityScore
          };
          console.log(`✅ STREAMING MODE: Liquidity score calculated for ${ticker}: ${liquidityScore}`);
        } catch (error) {
          console.warn(`❌ STREAMING MODE: Failed to calculate liquidity score for ${ticker}:`, error);
        }
      }
      
      // 2. Calculate simulations if needed and not already processed
      if (!completedSimulations.has(ticker) &&
          !simulationsInProgress.has(ticker) &&
          result.metrics &&
          result.expectedMove &&
          !result.simulationResults) {
        try {
          // Mark as in progress
          setSimulationsInProgress(prev => new Set(prev).add(ticker));
          
          console.log(`🎲 STREAMING MODE: Calculating simulation for ${ticker}...`);
          
          const simulationResults = await calculateSimulationProbability(result);
          if (simulationResults) {
            processedResults[i] = {
              ...processedResults[i],
              simulationResults
            };
            
            // Cache the results
            setSimulationResultsCache(prev => new Map(prev).set(ticker, simulationResults));
            setCompletedSimulations(prev => new Set(prev).add(ticker));
            
            console.log(`✅ STREAMING MODE: Simulation completed for ${ticker}: ${simulationResults.probabilityOfProfit}%`);
          }
          
          // Remove from progress tracking
          setSimulationsInProgress(prev => {
            const newSet = new Set(prev);
            newSet.delete(ticker);
            return newSet;
          });
        } catch (error) {
          console.error(`❌ STREAMING MODE: Failed to calculate simulation for ${ticker}:`, error);
          
          // Remove from progress tracking even on error
          setSimulationsInProgress(prev => {
            const newSet = new Set(prev);
            newSet.delete(ticker);
            return newSet;
          });
        }
      }
    }
    
    console.log(`🏁 STREAMING MODE: Processed ${processedResults.length} results`);
    return processedResults;
  };

  // Function to handle opening the chart modal
  const handleShowChart = (ticker: string, simulationResults: any) => {
    if (!simulationResults) {
      console.warn('No simulation results available for chart');
      return;
    }
    setSelectedChartTicker(ticker);
    setSelectedChartResults(simulationResults);
    setChartModalOpen(true);
  };

  // NOTE: Removed calculateLiquidityScores function - liquidity scores are now calculated in streaming mode

  // NOTE: Removed calculateSimulationResults function - simulations are now handled in streaming mode

  // Add console logging to debug naked options
  React.useEffect(() => {
    if ((strategyType === 'naked' || strategyType === 'ironCondor') && optionsData.scanResults.length > 0) {
      console.log('Recommended stocks:', optionsData.scanResults.filter(r => r.recommendation === 'Recommended'));
      
      if (strategyType === 'naked') {
        console.log('Stocks with naked options:', optionsData.scanResults.filter(r => r.optimalNakedOptions));
      } else if (strategyType === 'ironCondor') {
        console.log('Stocks with iron condors:', optionsData.scanResults.filter(r => r.optimalIronCondors));
      }
    }
  }, [strategyType, optionsData.scanResults]);

  // NOTE: Removed liquidity calculation useEffect - liquidity scores are now calculated in streaming mode

  // NOTE: Removed duplicate simulation calculation useEffect - simulations are now handled in streaming mode

  // Filter and sort results
  const filteredResults = optionsData.scanResults
    .filter(result => {
      // Skip filtered out tickers completely or those with missing metrics
      if (String(result.recommendation) === 'FILTERED OUT' || !result.metrics) {
        return false;
      }
      
      // Filter by search query
      const matchesSearch =
        !searchQuery ||
        result.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (result.companyName && result.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Filter by recommendation
      const matchesRecommendation =
        filterRecommendation === 'all' ||
        result.recommendation === filterRecommendation;
      
      // Check if strategy is available for the current strategy type
      let strategyAvailable = true;
      if (result.strategyAvailability) {
        if (strategyType === 'calendar' && !result.strategyAvailability.calendar_available) {
          strategyAvailable = false;
        } else if (strategyType === 'naked' && !result.strategyAvailability.naked_available) {
          strategyAvailable = false;
        } else if (strategyType === 'ironCondor' && !result.strategyAvailability.iron_condor_available) {
          strategyAvailable = false;
        }
      }
      
      return matchesSearch && matchesRecommendation && strategyAvailable;
    })
    .sort((a, b) => {
      // Sort by selected field
      let comparison = 0;
      
      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'price':
          comparison = a.currentPrice - b.currentPrice;
          break;
        case 'avgVolume':
          // Handle undefined metrics
          if (!a.metrics || !b.metrics) return 0;
          comparison = (a.metrics.avgVolume || 0) - (b.metrics.avgVolume || 0);
          break;
        case 'iv30Rv30':
          // Handle undefined metrics
          if (!a.metrics || !b.metrics) return 0;
          comparison = (a.metrics.iv30Rv30 || 0) - (b.metrics.iv30Rv30 || 0);
          break;
        case 'tsSlope':
          // Handle undefined metrics
          if (!a.metrics || !b.metrics) return 0;
          comparison = (a.metrics.tsSlope || 0) - (b.metrics.tsSlope || 0);
          break;
        case 'calendarLiquidityScore':
          // Sort by calendar liquidity score
          comparison = (a.calendarLiquidityScore || 0) - (b.calendarLiquidityScore || 0);
          break;
        case 'simulationProbability':
          // Sort by simulation probability of profit
          const aProbability = a.simulationResults?.probabilityOfProfit || 0;
          const bProbability = b.simulationResults?.probabilityOfProfit || 0;
          comparison = aProbability - bProbability;
          break;
        case 'recommendation':
          // Custom sort order: Recommended > Consider > Avoid
          const order = { 'Recommended': 0, 'Consider': 1, 'Avoid': 2 };
          comparison = (order[a.recommendation as keyof typeof order] || 3) -
                      (order[b.recommendation as keyof typeof order] || 3);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  return (
    <Box>
      <Box mb={6}>
        <Heading size="md" mb={4}>
          Options Strategies Scanner
        </Heading>
        
        <RadioGroup
          onChange={(value) => {
            setStrategyType(value as 'calendar' | 'naked');
            setSelectedTicker(null); // Reset selected ticker when changing strategy
          }}
          value={strategyType}
          mb={4}
        >
          <Stack direction="row" spacing={5}>
            <Radio value="calendar" colorScheme="brand">Calendar Spreads</Radio>
            <Radio value="naked" colorScheme="brand">Naked Options</Radio>
            <Radio value="ironCondor" colorScheme="brand">Iron Condors</Radio>
          </Stack>
        </RadioGroup>
        
        <Text mb={4}>
          {strategyType === 'calendar'
            ? 'Scan stocks with earnings announcements to find potential calendar spread opportunities.'
            : strategyType === 'naked'
              ? 'Scan stocks with earnings announcements to find potential naked options selling opportunities.'
              : 'Scan stocks with earnings announcements to find potential short iron condor opportunities.'}
        </Text>
        
        <Flex direction={{ base: 'column', md: 'row' }} mb={6} gap={4}>
          <Button
            colorScheme="brand"
            onClick={handleScanToday}
            isLoading={optionsData.isLoading}
            loadingText="Scanning"
            leftIcon={<Icon as={FiRefreshCw} />}
            flex={{ base: '1', md: 'initial' }}
          >
            Scan Today's Earnings
          </Button>
          
          <HStack spacing={2}>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              width={{ base: 'full', md: '200px' }}
            />
            <Button
              colorScheme="brand"
              variant="outline"
              onClick={handleScanCustomDate}
              isLoading={optionsData.isLoading}
              loadingText="Scanning"
              isDisabled={!customDate}
            >
              Scan Date
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Always show scan progress when it exists, regardless of loading state */}
      {scanProgress && (
        <Box my={4} p={4} borderWidth="1px" borderRadius="md" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
          <Flex justify="space-between" mb={2}>
            <Text fontWeight="medium">
              Processing tickers: {scanProgress.completed} of {scanProgress.total} ({scanProgress.percent}%)
            </Text>
            <Text color="gray.500">
              Filtered: {scanProgress.filtered_out} | No data: {scanProgress.no_data}
            </Text>
          </Flex>
          
          <Box position="relative" pt={1}>
            <Box
              w="100%"
              h="8px"
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
              borderRadius="full"
            >
              <Box
                h="100%"
                bg="brand.500"
                borderRadius="full"
                transition="width 0.3s ease-in-out"
                w={`${scanProgress.percent}%`}
              />
            </Box>
            
            {/* Animated pulse effect at the end of the progress bar */}
            {scanProgress.percent < 100 && (
              <Box
                position="absolute"
                top="1px"
                left={`${scanProgress.percent}%`}
                transform="translateX(-50%)"
                w="16px"
                h="8px"
                borderRadius="full"
                bg="brand.400"
                opacity="0.8"
                animation="pulse 1.5s infinite"
              />
            )}
          </Box>
          
          <Flex justify="space-between" mt={2}>
            <Text fontSize="sm" color="gray.500">
              {scanProgress.completed < scanProgress.total
                ? "Analyzing options data... Results will update as they become available."
                : "Finalizing results..."}
            </Text>
            {scanProgress.filtered_out > 0 && (
              <Text fontSize="sm" color="gray.500">
                Skipped {scanProgress.filtered_out} tickers (price &lt; $2.50 or volume &lt; 1.5M)
              </Text>
            )}
          </Flex>
        </Box>
      )}

      {/* Show loading spinner only when no progress data is available */}
      {optionsData.isLoading && !scanProgress && (
        <Box my={10}>
          <Flex justify="center" align="center">
            <Spinner size="xl" color="brand.500" mr={4} />
            <Text>Scanning earnings and analyzing options data...</Text>
          </Flex>
        </Box>
      )}

      {optionsData.error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <AlertTitle mr={2}>Error!</AlertTitle>
          <AlertDescription>{optionsData.error}</AlertDescription>
        </Alert>
      )}

      {optionsData.scanResults.length > 0 && !optionsData.isLoading && (
        <Box>
          <Flex 
            direction={{ base: 'column', md: 'row' }} 
            justify="space-between" 
            align={{ base: 'flex-start', md: 'center' }} 
            mb={4}
            gap={4}
          >
            <Text fontWeight="medium">
              {filteredResults.length} of {optionsData.scanResults.length} results
            </Text>
            
            <HStack spacing={4}>
              <InputGroup maxW="250px">
                <InputLeftElement pointerEvents="none">
                  <Icon as={FiSearch} color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="Search by ticker or name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
              
              <Select
                value={filterRecommendation}
                onChange={(e) => setFilterRecommendation(e.target.value)}
                maxW="200px"
                icon={<FiFilter />}
              >
                <option value="all">All Recommendations</option>
                <option value="Recommended">Recommended</option>
                <option value="Consider">Consider</option>
                <option value="Avoid">Avoid</option>
              </Select>
            </HStack>
          </Flex>
          
          {/* Display calendar spread details for selected ticker */}
          {strategyType === 'calendar' && selectedTicker && (
            <Box
              borderWidth="2px"
              borderRadius="lg"
              borderColor="brand.500"
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              boxShadow="lg"
              mb={6}
              overflow="hidden"
            >
              {filteredResults
                .filter(result => result.ticker === selectedTicker && result.optimalCalendarSpread)
                .map(result => (
                  <CalendarSpreadDisplay
                    key={result.ticker}
                    ticker={result.ticker}
                    calendarSpread={result.optimalCalendarSpread!}
                    expectedMove={{
                      percent: parseFloat(result.expectedMove.replace('%', '')) / 100,
                      dollars: parseFloat(result.expectedMove.replace('%', '')) * result.currentPrice / 100
                    }}
                    daysToExpiration={30} // Approximate, would be provided by backend in real implementation
                    compact={true}
                  />
                ))
              }
            </Box>
          )}
          
          {/* Display naked options details for selected ticker */}
          {strategyType === 'naked' && selectedTicker && (
            <Box
              borderWidth="2px"
              borderRadius="lg"
              borderColor="brand.500"
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              boxShadow="lg"
              mb={6}
              overflow="hidden"
            >
              {filteredResults
                .filter(result => result.ticker === selectedTicker && result.optimalNakedOptions)
                .map(result => (
                  <NakedOptionsDisplay
                    key={result.ticker}
                    ticker={result.ticker}
                    nakedOptions={result.optimalNakedOptions!}
                    compact={true}
                  />
                ))
              }
            </Box>
          )}
          
          {/* Display iron condor details for selected ticker */}
          {strategyType === 'ironCondor' && selectedTicker && (
            <Box
              borderWidth="2px"
              borderRadius="lg"
              borderColor="brand.500"
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              boxShadow="lg"
              mb={6}
              overflow="hidden"
            >
              {filteredResults
                .filter(result => result.ticker === selectedTicker && result.optimalIronCondors)
                .map(result => (
                  <IronCondorDisplay
                    key={result.ticker}
                    ticker={result.ticker}
                    ironCondors={result.optimalIronCondors!}
                    compact={true}
                  />
                ))
              }
            </Box>
          )}
          
          <TableContainer mt={4}>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('ticker')}
                    color={sortField === 'ticker' ? 'brand.500' : undefined}
                  >
                    Ticker
                    {sortField === 'ticker' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  <Th>Company</Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('price')}
                    color={sortField === 'price' ? 'brand.500' : undefined}
                    isNumeric
                  >
                    Price
                    {sortField === 'price' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('avgVolume')}
                    color={sortField === 'avgVolume' ? 'brand.500' : undefined}
                    isNumeric
                  >
                    Avg Volume
                    {sortField === 'avgVolume' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('iv30Rv30')}
                    color={sortField === 'iv30Rv30' ? 'brand.500' : undefined}
                    isNumeric
                  >
                    IV/RV
                    {sortField === 'iv30Rv30' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('tsSlope')}
                    color={sortField === 'tsSlope' ? 'brand.500' : undefined}
                    isNumeric
                  >
                    TS Slope
                    {sortField === 'tsSlope' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  <Th>Expected Move</Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('simulationProbability')}
                    color={sortField === 'simulationProbability' ? 'brand.500' : undefined}
                  >
                    Sim Probability
                    {sortField === 'simulationProbability' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  {strategyType === 'calendar' && (
                    <Th
                      cursor="pointer"
                      onClick={() => handleSort('calendarLiquidityScore')}
                      color={sortField === 'calendarLiquidityScore' ? 'brand.500' : undefined}
                    >
                      Liquidity
                      {sortField === 'calendarLiquidityScore' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </Th>
                  )}
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('recommendation')}
                    color={sortField === 'recommendation' ? 'brand.500' : undefined}
                  >
                    Recommendation
                    {sortField === 'recommendation' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </Th>
                  {strategyType === 'naked' && (
                    <Th>Naked Options</Th>
                  )}
                  {strategyType === 'calendar' && (
                    <Th>Calendar Spreads</Th>
                  )}
                  {strategyType === 'ironCondor' && (
                    <Th>Iron Condors</Th>
                  )}
                </Tr>
              </Thead>
              <Tbody>
                {filteredResults.map((result) => (
                  <Tr
                    key={result.ticker}
                    onClick={() => {
                      // Log for debugging
                      console.log(`Row clicked for ${result.ticker}, company name: ${result.companyName || 'N/A'}`);
                      handleRowClick(result.ticker);
                    }}
                    cursor={
                      (strategyType === 'calendar' && result.optimalCalendarSpread) ||
                      (strategyType === 'naked' && result.optimalNakedOptions) ||
                      (strategyType === 'ironCondor' && result.optimalIronCondors)
                        ? 'pointer'
                        : 'default'
                    }
                    bg={selectedTicker === result.ticker
                      ? (colorMode === 'dark' ? 'brand.900' : 'brand.50')
                      : undefined}
                    _hover={
                      (strategyType === 'calendar' && result.strategyAvailability?.calendar_available) ||
                      (strategyType === 'naked' && result.strategyAvailability?.naked_available) ||
                      (strategyType === 'ironCondor' && result.strategyAvailability?.iron_condor_available)
                        ? { bg: colorMode === 'dark' ? 'brand.800' : 'brand.50' }
                        : undefined
                    }
                  >
                    <Td fontWeight="bold">
                      <Flex alignItems="center">
                        {result.ticker}
                        {/* Earnings time indicator */}
                        {result.reportTime && (
                          <Text as="span" ml={1} fontSize="sm" title={`Report Time: ${result.reportTime}`}>
                            {result.reportTime === 'BMO' ? '☀️' :
                             result.reportTime === 'AMC' ? '🌙' :
                             `(${result.reportTime})`}
                          </Text>
                        )}
                        <Box ml={2}>
                          <PinTradeButton
                            ticker={result.ticker}
                            price={result.currentPrice}
                            strategy={strategyType === 'calendar' ? 'calendar_spread' :
                                     strategyType === 'ironCondor' ? 'iron_condor' :
                                     strategyType === 'naked' ? 'single_option' : 'stock'}
                            size="sm"
                            tooltipPlacement="right"
                            companyName={result.companyName || ''}
                            reportTime={result.reportTime || ''}
                            earningsDate={result.earningsDate || ''}
                          />
                          {/* Add a tooltip to explain the pin button */}
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Pin to Trade Ideas
                          </Text>
                        </Box>
                      </Flex>
                    </Td>
                    <Td>{result.companyName || '-'}</Td>
                    <Td isNumeric>${result.currentPrice !== undefined && result.currentPrice !== null ? result.currentPrice.toFixed(2) : 'N/A'}</Td>
                    <Td isNumeric>
                      {result.metrics ? (
                        <Flex justify="flex-end" align="center">
                          <Icon
                            as={result.metrics.avgVolumePass === "true" ? FiCheckCircle : FiXCircle}
                            color={result.metrics.avgVolumePass === "true" ? 'green.500' : 'red.500'}
                            mr={2}
                          />
                          {result.metrics.avgVolume !== undefined && result.metrics.avgVolume !== null
                            ? result.metrics.avgVolume.toLocaleString()
                            : 'N/A'}
                        </Flex>
                      ) : (
                        <Text>N/A</Text>
                      )}
                    </Td>
                    <Td isNumeric>
                      {result.metrics ? (
                        <Flex justify="flex-end" align="center">
                          <Icon
                            as={result.metrics.iv30Rv30Pass === "true" ? FiCheckCircle : FiXCircle}
                            color={result.metrics.iv30Rv30Pass === "true" ? 'green.500' : 'red.500'}
                            mr={2}
                          />
                          {result.metrics.iv30Rv30 !== undefined && result.metrics.iv30Rv30 !== null
                            ? result.metrics.iv30Rv30.toFixed(2)
                            : 'N/A'}
                        </Flex>
                      ) : (
                        <Text>N/A</Text>
                      )}
                    </Td>
                    <Td isNumeric>
                      {result.metrics ? (
                        <Flex justify="flex-end" align="center">
                          <Icon
                            as={result.metrics.tsSlopePass === "true" ? FiCheckCircle : FiXCircle}
                            color={result.metrics.tsSlopePass === "true" ? 'green.500' : 'red.500'}
                            mr={2}
                          />
                          {result.metrics.tsSlope !== undefined && result.metrics.tsSlope !== null
                            ? result.metrics.tsSlope.toFixed(5)
                            : 'N/A'}
                        </Flex>
                      ) : (
                        <Text>N/A</Text>
                      )}
                    </Td>
                    <Td>{result.expectedMove}</Td>
                    <Td>
                      {simulationsInProgress.has(result.ticker) ? (
                        <Flex align="center" justify="center">
                          <Spinner size="sm" color="brand.500" mr={2} />
                          <Text fontSize="xs" color="gray.500">Calculating...</Text>
                        </Flex>
                      ) : result.simulationResults ? (
                        <VStack spacing={2} align="stretch">
                          <SimulationProbabilityDisplay
                            simulationResults={result.simulationResults}
                            size="sm"
                          />
                          <Tooltip label="Show Monte Carlo risk profile chart" placement="top">
                            <Button
                              size="xs"
                              variant="outline"
                              colorScheme="blue"
                              leftIcon={<Icon as={FiBarChart} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowChart(result.ticker, result.simulationResults);
                              }}
                              width="full"
                            >
                              Show Chart
                            </Button>
                          </Tooltip>
                        </VStack>
                      ) : (
                        <Text fontSize="sm" color="gray.500">N/A</Text>
                      )}
                    </Td>
                    {strategyType === 'calendar' && (
                      <Td>
                        {result.calendarLiquidityScore !== undefined ? (
                          <LiquidityThermometer
                            liquidityScore={result.calendarLiquidityScore}
                            size="sm"
                          />
                        ) : (
                          <Text fontSize="sm" color="gray.500">N/A</Text>
                        )}
                      </Td>
                    )}
                    <Td>
                      <Badge colorScheme={getRecommendationColor(result.recommendation)}>
                        {result.recommendation}
                      </Badge>
                    </Td>
                    {strategyType === 'naked' && (
                      <Td>
                        {result.optimalNakedOptions ? (
                          <Badge colorScheme="green" fontSize="sm" px={2} py={1}>Available</Badge>
                        ) : (
                          <Badge colorScheme="gray" fontSize="sm" px={2} py={1}>None</Badge>
                        )}
                      </Td>
                    )}
                    {strategyType === 'calendar' && (
                      <Td>
                        {result.optimalCalendarSpread ? (
                          <Badge colorScheme="green" fontSize="sm" px={2} py={1}>Available</Badge>
                        ) : (
                          <Badge colorScheme="gray" fontSize="sm" px={2} py={1}>None</Badge>
                        )}
                      </Td>
                    )}
                    {strategyType === 'ironCondor' && (
                      <Td>
                        {result.optimalIronCondors ? (
                          <Badge colorScheme="green" fontSize="sm" px={2} py={1}>Available</Badge>
                        ) : (
                          <Badge colorScheme="gray" fontSize="sm" px={2} py={1}>None</Badge>
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
                
                {filteredResults.length === 0 && (
                  <Tr>
                    <Td colSpan={strategyType === 'calendar' ? 10 : 9} textAlign="center" py={4}>
                      No results match your filters
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {optionsData.scanResults.length === 0 && !optionsData.isLoading && !optionsData.error && (
        <Flex 
          direction="column" 
          align="center" 
          justify="center" 
          py={10} 
          px={4} 
          borderWidth="1px" 
          borderRadius="lg"
          borderStyle="dashed"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
        >
          <Icon as={FiAlertCircle} boxSize={10} color="gray.400" mb={4} />
          <Heading size="md" mb={2} textAlign="center">No Scan Results</Heading>
          <Text textAlign="center" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
            Click "Scan Today's Earnings" to analyze stocks with earnings announcements today.
          </Text>
        </Flex>
      )}

      {/* Monte Carlo Chart Modal */}
      {chartModalOpen && selectedChartResults && (
        <MonteCarloChartModal
          isOpen={chartModalOpen}
          onClose={() => setChartModalOpen(false)}
          ticker={selectedChartTicker}
          simulationResults={selectedChartResults}
          rawSimulationData={selectedChartResults?.rawResults}
        />
      )}
    </Box>
  );
};

export default ScanResults;