import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  HStack,
  VStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Tooltip,
  Divider,
  Tag,
  TagLabel,
  useDisclosure,
  Button,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useToast,
  Collapse,
  Spinner,
  Alert,
  AlertIcon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Icon
} from '@chakra-ui/react';
import {
  ChevronRightIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  StarIcon,
  WarningIcon,
  InfoIcon,
  SearchIcon,
  MoonIcon,
  SunIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RepeatIcon
} from '@chakra-ui/icons';
import { AnyTradeEntry, StrategyType } from '../../types/tradeTracker';
import ConvertToTradeModal from './ConvertToTradeModal';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import CalendarSpreadDisplay from '../CalendarSpreadDisplay';
import { tradeTrackerDB } from '../../services/tradeTrackerDB';
import { parseLocalDate, formatDisplayDate, formatShortDate, daysBetween, isDateInPast } from '../../utils/dateUtils';
import { runMonteCarloSimulation } from '../../services/monteCarloSimulation';
import SimulationProbabilityDisplay from '../SimulationProbabilityDisplay';
import RefineSimulationModal from '../RefineSimulationModal';
import MonteCarloChartModal from '../MonteCarloChartModal';
import { FiBarChart, FiSettings } from 'react-icons/fi';

// Strategy display names
const strategyNames: Record<StrategyType, string> = {
  stock: 'Stock',
  single_option: 'Single Option',
  vertical_spread: 'Vertical Spread',
  iron_condor: 'Iron Condor',
  calendar_spread: 'Calendar Spread',
  diagonal_spread: 'Diagonal Spread',
  covered_call: 'Covered Call',
  protective_put: 'Protective Put',
  straddle: 'Straddle',
  strangle: 'Strangle',
  butterfly: 'Butterfly',
  custom: 'Custom'
};

// Strategy colors
const strategyColors: Record<StrategyType, string> = {
  stock: 'blue',
  single_option: 'green',
  vertical_spread: 'purple',
  iron_condor: 'orange',
  calendar_spread: 'teal',
  diagonal_spread: 'cyan',
  covered_call: 'pink',
  protective_put: 'red',
  straddle: 'yellow',
  strangle: 'gray',
  butterfly: 'linkedin',
  custom: 'messenger'
};

interface TradeIdeaCardProps {
  tradeIdea: AnyTradeEntry;
  isCompactView?: boolean;
}

/**
 * TradeIdeaCard Component
 * 
 * This component displays a single trade idea in a card format.
 */
const TradeIdeaCard: React.FC<TradeIdeaCardProps> = ({ tradeIdea, isCompactView = false }) => {
  const {
    id,
    ticker,
    strategy,
    direction,
    notes,
    tags,
    entryDate,
    createdAt,
    metadata
  } = tradeIdea;
  
  // State for deeper analysis
  const [showDeeperAnalysis, setShowDeeperAnalysis] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for metrics refresh
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  
  // State for Monte Carlo simulation
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [refineModalOpen, setRefineModalOpen] = useState(false);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  
  // Function to get color based on metric thresholds
  const getMetricColor = (metric: 'volume' | 'iv' | 'slope', value: number) => {
    switch (metric) {
      case 'volume':
        return value >= 1500000 ? 'green.500' : 'red.500';
      case 'iv':
        return value >= 1.25 ? 'green.500' : 'red.500';
      case 'slope':
        return value <= -0.00406 ? 'green.500' : 'red.500';
      default:
        return 'gray.500';
    }
  };
  
  // Function to check if earnings have passed
  const hasEarningsPassed = () => {
    if (!earningsDate) return false;
    
    // Get current time in Eastern Time
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    // Parse earnings date in local context (should be YYYY-MM-DD format)
    const [year, month, day] = earningsDate.split('-').map(Number);
    const earnings = new Date(year, month - 1, day); // month is 0-indexed
    
    // Get today's date in Eastern Time
    const todayEastern = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate());
    const earningsDateOnly = new Date(earnings.getFullYear(), earnings.getMonth(), earnings.getDate());
    
    // If earnings date is in the future, earnings haven't passed
    if (earningsDateOnly > todayEastern) {
      return false;
    }
    
    // If earnings date is in the past, earnings have passed
    if (earningsDateOnly < todayEastern) {
      return true;
    }
    
    // If earnings date is today, check the time based on earnings timing
    if (earningsDateOnly.getTime() === todayEastern.getTime()) {
      if (earningsTime === 'BMO') {
        // BMO earnings happen before market open (9:30 AM EST)
        // If it's past 9:30 AM EST on earnings day, earnings have passed
        const currentHour = easternTime.getHours();
        const currentMinute = easternTime.getMinutes();
        return currentHour > 9 || (currentHour === 9 && currentMinute >= 30);
      } else if (earningsTime === 'AMC') {
        // AMC earnings happen after market close (4:00 PM EST)
        // If it's past 4:00 PM EST on earnings day, earnings have passed
        const currentHour = easternTime.getHours();
        return currentHour >= 16;
      }
    }
    
    // Default fallback - if no earnings time specified, consider passed if date has passed
    return earningsDateOnly < todayEastern;
  };
  
  // Function to fetch deeper analysis
  const fetchDeeperAnalysis = async () => {
    setIsLoadingAnalysis(true);
    try {
      // Build the API URL with earnings date if available
      let apiUrl = `http://localhost:5000/api/analyze/${ticker}?full_analysis=true`;
      if (earningsDate) {
        apiUrl += `&earnings_date=${encodeURIComponent(earningsDate)}`;
      }
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data);
        
        // Update the trade idea with the analysis data
        const updatedTradeIdea = {
          ...tradeIdea,
          metadata: {
            ...metadata,
            deeperAnalysis: data
          }
        };
        
        // Update in database
        await tradeTrackerDB.updateTrade(updatedTradeIdea);
        
        // Also dispatch to context for immediate UI update
        dispatch({
          type: ActionType.UPDATE_TRADE_SUCCESS,
          payload: updatedTradeIdea
        });
        
        toast({
          title: 'Analysis Complete',
          description: `Deeper analysis loaded for ${ticker}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error('Failed to fetch analysis');
      }
    } catch (error) {
      console.error('Error fetching deeper analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Could not load deeper analysis. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingAnalysis(false);
    }
  };
  
  // Handle deeper analysis toggle
  const handleDeeperAnalysis = () => {
    if (!showDeeperAnalysis && !analysisData && !metadata?.deeperAnalysis) {
      fetchDeeperAnalysis();
    }
    setShowDeeperAnalysis(!showDeeperAnalysis);
  };
  
  const handleRefreshAnalysis = () => {
    fetchDeeperAnalysis();
  };
  
  // Function to refresh core metrics using the same API as the screener
  const refreshMetrics = async () => {
    setIsRefreshingMetrics(true);
    try {
      // Use the same analyze endpoint that the screener uses
      const response = await fetch(`http://localhost:5000/api/analyze/${ticker}${earningsDate ? `?earnings_date=${earningsDate}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        if (data.metrics) {
          // Update local state for immediate UI feedback
          setLastRefreshTime(new Date());
          
          // Run Monte Carlo simulation with refreshed metrics
          let simulationResults = null;
          try {
            const expectedMoveString = metadata?.expectedMove || '0%';
            const expectedMovePercent = parseFloat(expectedMoveString.replace('%', ''));
            
            if (!isNaN(expectedMovePercent) && metadata?.currentPrice) {
              const simulationParams = {
                ticker,
                currentPrice: metadata.currentPrice,
                expectedMovePercent,
                metrics: {
                  avgVolume: data.metrics.avgVolume,
                  avgVolumePass: data.metrics.avgVolume >= 1500000 ? "true" : "false",
                  iv30Rv30: data.metrics.iv30Rv30,
                  iv30Rv30Pass: data.metrics.iv30Rv30 >= 1.25 ? "true" : "false",
                  tsSlope: data.metrics.tsSlope,
                  tsSlopePass: data.metrics.tsSlope <= -0.00406 ? "true" : "false"
                },
                liquidityScore: 5,
                earningsDate: metadata?.earningsDate,
                enhancedHistoricalData: metadata?.enhancedHistoricalData
              };

              simulationResults = await runMonteCarloSimulation(simulationParams);
            }
          } catch (simError) {
            console.warn('Monte Carlo simulation failed during refresh:', simError);
          }

          // Update the trade idea record in the database with refreshed metrics and simulation
          const updatedTradeIdea = {
            ...tradeIdea,
            metadata: {
              ...metadata,
              metrics: {
                ...metadata?.metrics,
                avgVolume: data.metrics.avgVolume,
                iv30Rv30: data.metrics.iv30Rv30,
                tsSlope: data.metrics.tsSlope
              },
              ...(simulationResults && {
                simulationResults: simulationResults,
                lastSimulationRefresh: new Date().toISOString()
              }),
              lastMetricsRefresh: new Date().toISOString()
            }
          };
          
          // Save to database
          await tradeTrackerDB.updateTrade(updatedTradeIdea);
          
          // Update context for immediate UI sync across components
          dispatch({
            type: ActionType.UPDATE_TRADE_SUCCESS,
            payload: updatedTradeIdea
          });
          
          toast({
            title: 'Metrics Updated',
            description: `Core metrics refreshed and saved for ${ticker}`,
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        } else {
          throw new Error(data.error || 'Failed to refresh metrics');
        }
      } else {
        throw new Error('Failed to fetch updated metrics');
      }
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh metrics. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshingMetrics(false);
    }
  };

  // Function to handle opening the refine simulation modal
  const handleRefineSimulation = () => {
    setRefineModalOpen(true);
  };

  // Function to handle showing the Monte Carlo chart
  const handleShowChart = () => {
    setChartModalOpen(true);
  };

  // Function to handle refined simulation with enhanced historical data
  const handleRunRefinedSimulation = async (enhancedData: any) => {
    setIsRunningSimulation(true);
    setRefineModalOpen(false);

    try {
      // Parse expected move percentage from metadata
      const expectedMoveString = metadata?.expectedMove || '0%';
      const expectedMovePercent = parseFloat(expectedMoveString.replace('%', ''));
      
      if (isNaN(expectedMovePercent)) {
        throw new Error('Invalid expected move percentage');
      }

      // Create simulation parameters with enhanced data
      const simulationParams = {
        ticker,
        currentPrice: metadata?.currentPrice || 0,
        expectedMovePercent,
        metrics: metadata?.metrics ? {
          avgVolume: metadata.metrics.avgVolume,
          avgVolumePass: metadata.metrics.avgVolume >= 1500000 ? "true" : "false",
          iv30Rv30: metadata.metrics.iv30Rv30,
          iv30Rv30Pass: metadata.metrics.iv30Rv30 >= 1.25 ? "true" : "false",
          tsSlope: metadata.metrics.tsSlope,
          tsSlopePass: metadata.metrics.tsSlope <= -0.00406 ? "true" : "false"
        } : {
          avgVolume: 0,
          avgVolumePass: "false",
          iv30Rv30: 0,
          iv30Rv30Pass: "false",
          tsSlope: 0,
          tsSlopePass: "false"
        },
        liquidityScore: 5, // Default liquidity score
        earningsDate: metadata?.earningsDate,
        enhancedHistoricalData: enhancedData
      };

      // Run enhanced Monte Carlo simulation
      const simulationResults = await runMonteCarloSimulation(simulationParams);

      // Update the trade idea with new simulation results
      const updatedTradeIdea = {
        ...tradeIdea,
        metadata: {
          ...metadata,
          simulationResults: simulationResults,
          enhancedHistoricalData: enhancedData,
          lastSimulationRefresh: new Date().toISOString()
        }
      };

      // Save to database
      await tradeTrackerDB.updateTrade(updatedTradeIdea);

      // Update context for immediate UI sync
      dispatch({
        type: ActionType.UPDATE_TRADE_SUCCESS,
        payload: updatedTradeIdea
      });

      toast({
        title: 'Simulation Complete',
        description: `Monte Carlo simulation updated for ${ticker}`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error running simulation:', error);
      toast({
        title: 'Simulation Failed',
        description: 'Could not run Monte Carlo simulation. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRunningSimulation(false);
    }
  };
  
  // Get existing analysis data
  const existingAnalysis = metadata?.deeperAnalysis || analysisData;

  // Handle delete trade idea
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Dispatch delete start action
      dispatch({
        type: ActionType.DELETE_TRADE_START,
        payload: id
      });
      
      // Delete from database
      const deleted = await tradeTrackerDB.deleteTrade(id);
      
      if (deleted) {
        // Dispatch success action
        dispatch({
          type: ActionType.DELETE_TRADE_SUCCESS,
          payload: id
        });
        
        // Show success toast
        toast({
          title: 'Trade idea deleted',
          description: `${ticker} trade idea has been removed`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Recalculate statistics
        const allTrades = await tradeTrackerDB.getAllTrades();
        const statistics = await tradeTrackerDB.calculateStatistics(allTrades);
        dispatch({
          type: ActionType.CALCULATE_TRADE_STATISTICS,
          payload: statistics
        });
      } else {
        throw new Error('Trade idea not found');
      }
      
      onDeleteClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.DELETE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to delete trade idea'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to delete trade idea',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };
  const toast = useToast();
  const { dispatch } = useData();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  // Extract metadata if available
  const companyName = metadata?.companyName || '';
  const currentPrice = metadata?.currentPrice || 0;
  const metrics = metadata?.metrics || { avgVolume: 0, iv30Rv30: 0, tsSlope: 0 };
  const expectedMove = metadata?.expectedMove || '';
  const earningsDate = metadata?.earningsDate || '';
  const earningsTime = metadata?.earningsTime || ''; // 'BMO' (pre-market) or 'AMC' (after-hours)
  const closestStrikes = metadata?.closestStrikes || [];
  const estimatedSpreadCost = metadata?.estimatedSpreadCost || 0;
  const lastMetricsRefresh = metadata?.lastMetricsRefresh;
  
  // Use persisted metrics from database if available, otherwise fall back to temporary refresh state
  const displayMetrics = {
    avgVolume: metrics.avgVolume || 0,
    iv30Rv30: metrics.iv30Rv30 || 0,
    tsSlope: metrics.tsSlope || 0
  };
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  
  // Modal state for convert to trade
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Format date for display
  // Format date for display
  const formatDate = (dateString: string) => {
    return formatDisplayDate(dateString);
  };

  // Calculate days since creation
  const daysSinceCreation = () => {
    return daysBetween(new Date(createdAt));
  };
  
  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      bg={bgColor}
      borderColor={borderColor}
      boxShadow="sm"
      _hover={{ boxShadow: 'md', borderColor: 'brand.300' }}
      transition="all 0.2s"
    >
      <Flex p={3} direction="column" alignItems="flex-start">
        {/* Consolidated Header section with ticker, company name, strategy, earnings, and menu */}
        <Flex width="100%" justifyContent="space-between" alignItems="center" mb={1}>
          <HStack spacing={2}>
            <VStack align="flex-start" spacing={0}>
              <HStack spacing={2} align="center">
                <Text fontSize="lg" fontWeight="bold" color={textColor}>
                  {ticker}
                </Text>
                <Badge size="sm" colorScheme={strategyColors[strategy]}>
                  {strategyNames[strategy]}
                </Badge>
                {hasEarningsPassed() && (
                  <Badge size="sm" colorScheme="orange" variant="outline">
                    Earnings Over
                  </Badge>
                )}
              </HStack>
              {companyName && (
                <Text fontSize="xs" color={mutedColor} mt={0}>
                  {companyName}
                </Text>
              )}
            </VStack>
          </HStack>
          
          <HStack spacing={2}>
            {/* Earnings Date in Header */}
            {earningsDate && (
              <VStack align="flex-end" spacing={0}>
                <Text fontSize="xs" fontWeight="medium" color={textColor}>
                  {formatDisplayDate(earningsDate)}
                </Text>
                {earningsTime && (
                  <Badge
                    colorScheme={earningsTime === 'BMO' ? 'orange' : 'purple'}
                    variant="solid"
                    fontSize="xs"
                    size="sm"
                  >
                    {earningsTime === 'BMO' ? '☀️ BMO' : earningsTime === 'AMC' ? '🌙 AMC' : earningsTime}
                  </Badge>
                )}
              </VStack>
            )}
            
            <Menu>
            <MenuButton
              as={IconButton}
              aria-label="Options"
              icon={<ChevronRightIcon />}
              variant="ghost"
              size="sm"
            />
            <MenuList>
              <MenuItem icon={<EditIcon />}>Edit</MenuItem>
              <MenuItem icon={<CheckIcon />} onClick={onOpen}>Convert to Trade</MenuItem>
              <MenuItem icon={<DeleteIcon />} color="red.500" onClick={onDeleteOpen}>Delete</MenuItem>
            </MenuList>
          </Menu>
          </HStack>
        </Flex>
        
        {/* Main content grid - conditionally rendered based on compact view */}
        {!isCompactView && (
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={2} width="100%" mb={1}>
            {/* Column 1: Core trade data */}
            <GridItem>
              <VStack align="flex-start" spacing={1}>
                {/* Current price and expected move inline */}
                {(currentPrice > 0 || expectedMove) && (
                  <HStack spacing={3} width="100%">
                    {currentPrice > 0 && (
                      <Stat size="xs">
                        <StatLabel fontSize="xs">Price</StatLabel>
                        <StatNumber fontSize="sm">${currentPrice.toFixed(2)}</StatNumber>
                      </Stat>
                    )}
                    {expectedMove && (
                      <Stat size="xs">
                        <StatLabel fontSize="xs">Move</StatLabel>
                        <StatNumber fontSize="sm">{expectedMove}</StatNumber>
                      </Stat>
                    )}
                  </HStack>
                )}
                
                {/* Estimated spread cost and closest strikes */}
                {estimatedSpreadCost > 0 && (
                  <Stat size="xs">
                    <StatLabel fontSize="xs">Spread Cost</StatLabel>
                    <StatNumber fontSize="sm">${estimatedSpreadCost.toFixed(2)}</StatNumber>
                  </Stat>
                )}
                
                {/* Closest strikes */}
                {closestStrikes && closestStrikes.length > 0 && (
                  <Box>
                    <Text fontSize="xs" fontWeight="medium" mb={1}>Strikes:</Text>
                    <HStack spacing={1} flexWrap="wrap">
                      {closestStrikes.map((strike: number | string, idx: number) => (
                        <Badge key={idx} variant="outline" colorScheme="blue" size="sm">
                          ${typeof strike === 'number' ? strike.toFixed(2) : strike}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}
              </VStack>
            </GridItem>
            
            {/* Column 2: Metrics */}
            <GridItem>
              <VStack align="flex-start" spacing={1}>
                {/* Metrics Header with Refresh Button */}
                <HStack justify="space-between" width="100%">
                  <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                    Metrics
                  </Text>
                  <Tooltip label="Refresh core metrics" placement="top">
                    <IconButton
                      aria-label="Refresh metrics"
                      icon={isRefreshingMetrics ? <Spinner size="xs" /> : <RepeatIcon />}
                      size="xs"
                      variant="ghost"
                      onClick={refreshMetrics}
                      isLoading={isRefreshingMetrics}
                      colorScheme="blue"
                    />
                  </Tooltip>
                </HStack>
                
                {/* Volume and IV/RV inline */}
                <HStack spacing={2} width="100%">
                  {displayMetrics.avgVolume > 0 && (
                    <Stat size="xs">
                      <StatLabel fontSize="xs">Vol</StatLabel>
                      <StatNumber
                        fontSize="sm"
                        color={getMetricColor('volume', displayMetrics.avgVolume)}
                        fontWeight="bold"
                      >
                        {(displayMetrics.avgVolume / 1000000).toFixed(1)}M
                      </StatNumber>
                    </Stat>
                  )}
                  
                  {displayMetrics.iv30Rv30 > 0 && (
                    <Stat size="xs">
                      <StatLabel fontSize="xs">IV/RV</StatLabel>
                      <StatNumber
                        fontSize="sm"
                        color={getMetricColor('iv', displayMetrics.iv30Rv30)}
                        fontWeight="bold"
                      >
                        {displayMetrics.iv30Rv30.toFixed(2)}
                      </StatNumber>
                    </Stat>
                  )}
                </HStack>
                
                {/* TS Slope */}
                {displayMetrics.tsSlope !== 0 && (
                  <Stat size="xs">
                    <StatLabel fontSize="xs">TS Slope</StatLabel>
                    <StatNumber
                      fontSize="sm"
                      color={getMetricColor('slope', displayMetrics.tsSlope)}
                      fontWeight="bold"
                    >
                      {displayMetrics.tsSlope.toFixed(5)}
                    </StatNumber>
                  </Stat>
                )}
                
                {/* Last refresh timestamp */}
                {(lastRefreshTime || lastMetricsRefresh) && (
                  <Text fontSize="xs" color="gray.500">
                    Updated: {lastRefreshTime ?
                      lastRefreshTime.toLocaleTimeString() :
                      lastMetricsRefresh ? new Date(lastMetricsRefresh).toLocaleTimeString() : 'Never'
                    }
                  </Text>
                )}
              </VStack>
            </GridItem>
            
            {/* Column 3: Monte Carlo simulation + action buttons */}
            <GridItem>
              <VStack align="flex-start" spacing={1}>
                {/* Monte Carlo Simulation Results */}
                {metadata?.simulationResults ? (
                  <Box width="100%">
                    <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                      Monte Carlo
                    </Text>
                    
                    <VStack spacing={1} align="stretch">
                      <SimulationProbabilityDisplay
                        simulationResults={metadata.simulationResults}
                        size="sm"
                        showDetails={false}
                      />
                      <HStack spacing={1}>
                        <Tooltip label="Show chart" placement="top">
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="blue"
                            leftIcon={<Icon as={FiBarChart} />}
                            onClick={handleShowChart}
                            flex={1}
                          >
                            Chart
                          </Button>
                        </Tooltip>
                        <Tooltip label="Refine simulation" placement="top">
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="green"
                            leftIcon={<Icon as={FiSettings} />}
                            onClick={handleRefineSimulation}
                            flex={1}
                            isLoading={isRunningSimulation}
                          >
                            Refine
                          </Button>
                        </Tooltip>
                      </HStack>
                    </VStack>
                  </Box>
                ) : (
                  <Box width="100%">
                    <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={1}>
                      Actions
                    </Text>
                    <VStack spacing={1} align="stretch">
                      <Button
                        size="xs"
                        leftIcon={<RepeatIcon />}
                        colorScheme="teal"
                        variant="outline"
                        onClick={refreshMetrics}
                        isLoading={isRefreshingMetrics || isRunningSimulation}
                        loadingText={isRunningSimulation ? "Sim..." : "Refresh..."}
                      >
                        Refresh
                      </Button>
                      <Button
                        size="xs"
                        leftIcon={<CheckIcon />}
                        colorScheme="green"
                        onClick={onOpen}
                      >
                        Open Trade
                      </Button>
                    </VStack>
                  </Box>
                )}
              </VStack>
            </GridItem>
          </Grid>
        )}
        
        {/* Notes and Tags section - conditionally rendered and inline */}
        {!isCompactView && (notes || tags.length > 0) && (
          <VStack align="flex-start" spacing={1} width="100%" mb={1}>
            {notes && (
              <Box width="100%">
                <Text fontSize="xs" fontWeight="medium" mb={1}>Notes:</Text>
                <Text fontSize="xs" color={mutedColor} noOfLines={2}>
                  {notes}
                </Text>
              </Box>
            )}
            
            {tags.length > 0 && (
              <Box width="100%">
                <HStack spacing={1} flexWrap="wrap">
                  {tags.map((tag, index) => (
                    <Tag size="sm" key={index} colorScheme="gray" borderRadius="full">
                      <TagLabel fontSize="xs">{tag}</TagLabel>
                    </Tag>
                  ))}
                </HStack>
              </Box>
            )}
          </VStack>
        )}
        
        {!isCompactView && <Divider my={1} />}
        
        {/* Footer with dates and action buttons - conditionally rendered */}
        {!isCompactView && (
          <Flex width="100%" justifyContent="space-between" alignItems="center">
          <HStack spacing={3}>
            <Tooltip label="Target entry date" placement="top">
              <HStack spacing={1}>
                <InfoIcon boxSize={3} color="gray.500" />
                <Text fontSize="xs" color={mutedColor}>
                  {formatDate(entryDate)}
                </Text>
              </HStack>
            </Tooltip>
            
            <Tooltip label="Days since creation" placement="top">
              <HStack spacing={1}>
                <WarningIcon
                  boxSize={3}
                  color={daysSinceCreation() > 14 ? 'orange.500' : 'gray.500'}
                />
                <Text
                  fontSize="xs"
                  color={daysSinceCreation() > 14 ? 'orange.500' : mutedColor}
                >
                  {daysSinceCreation()}d old
                </Text>
              </HStack>
            </Tooltip>
          </HStack>
          
          <HStack spacing={1}>
            {hasEarningsPassed() ? (
              // Show "Remove Trade Idea" button for expired earnings
              <Button
                size="xs"
                leftIcon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={handleDelete}
              >
                Remove
              </Button>
            ) : (
              // Show normal buttons for active trade ideas
              <>
                <Button
                  size="xs"
                  leftIcon={showDeeperAnalysis ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleDeeperAnalysis}
                  isLoading={isLoadingAnalysis && !existingAnalysis}
                  loadingText="Loading..."
                >
                  {showDeeperAnalysis ? 'Hide' : existingAnalysis ? 'Show' : 'Analysis'}
                </Button>
                
                {existingAnalysis && (
                  <Button
                    size="xs"
                    leftIcon={<RepeatIcon />}
                    colorScheme="orange"
                    variant="outline"
                    onClick={handleRefreshAnalysis}
                    isLoading={isLoadingAnalysis}
                    loadingText="Refreshing..."
                  >
                    Refresh
                  </Button>
                )}
              </>
            )}
          </HStack>
        </Flex>
        )}
        
        {/* Deeper Analysis Section - conditionally rendered */}
        {!isCompactView && (
          <Collapse in={showDeeperAnalysis} animateOpacity>
          <Box mt={2} p={2} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            {isLoadingAnalysis ? (
              <Flex justify="center" align="center" py={4}>
                <Spinner size="md" />
                <Text ml={2} fontSize="sm">Loading calendar spread analysis...</Text>
              </Flex>
            ) : existingAnalysis ? (
              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={2} color="blue.500">
                  📊 Calendar Spread Analysis
                </Text>
                
                {existingAnalysis.optimalCalendarSpread ? (
                  <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                    {/* Column 1: Strategy Overview */}
                    <GridItem>
                      <VStack align="flex-start" spacing={1}>
                        <Text fontSize="xs" fontWeight="bold" color="blue.400">Strategy Overview</Text>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Score</Text>
                          <Text fontSize="sm" fontWeight="bold" color="green.400">
                            {existingAnalysis.optimalCalendarSpread.score?.toFixed(0) || 'N/A'}/100
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Type</Text>
                          <Badge size="sm" colorScheme={existingAnalysis.optimalCalendarSpread.optionType === 'call' ? 'green' : 'red'}>
                            {existingAnalysis.optimalCalendarSpread.optionType?.toUpperCase() || 'N/A'}
                          </Badge>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Strike</Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            ${existingAnalysis.optimalCalendarSpread.strike}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">IV Diff</Text>
                          <Text fontSize="sm" fontWeight="semibold" color="green.400">
                            {(existingAnalysis.optimalCalendarSpread.ivDifferential * 100).toFixed(1)}%
                          </Text>
                        </Box>
                      </VStack>
                    </GridItem>

                    {/* Column 2: Risk/Reward */}
                    <GridItem>
                      <VStack align="flex-start" spacing={1}>
                        <Text fontSize="xs" fontWeight="bold" color="blue.400">Risk/Reward</Text>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Cost</Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            ${existingAnalysis.optimalCalendarSpread.spreadCost?.toFixed(2) || 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Max Profit</Text>
                          <Text fontSize="sm" fontWeight="semibold" color="green.400">
                            ${existingAnalysis.optimalCalendarSpread.estimatedMaxProfit?.toFixed(2) || 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">RoR</Text>
                          <Text fontSize="sm" fontWeight="semibold" color="green.400">
                            {existingAnalysis.optimalCalendarSpread.returnOnRisk ?
                              `${(existingAnalysis.optimalCalendarSpread.returnOnRisk * 100).toFixed(0)}%` : 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">PoP</Text>
                          <Text fontSize="sm" fontWeight="semibold" color="blue.400">
                            {existingAnalysis.optimalCalendarSpread.monteCarloResults?.probabilityOfProfit ?
                              `${(existingAnalysis.optimalCalendarSpread.monteCarloResults.probabilityOfProfit * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </Box>
                      </VStack>
                    </GridItem>

                    {/* Column 3: Expiration Details */}
                    <GridItem>
                      <VStack align="flex-start" spacing={1}>
                        <Text fontSize="xs" fontWeight="bold" color="blue.400">Expirations</Text>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Front</Text>
                          <Text fontSize="xs" fontWeight="semibold">
                            {existingAnalysis.optimalCalendarSpread.frontMonth ?
                              formatShortDate(existingAnalysis.optimalCalendarSpread.frontMonth) : 'N/A'}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            IV: {existingAnalysis.optimalCalendarSpread.frontIv ?
                              `${(existingAnalysis.optimalCalendarSpread.frontIv * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Back</Text>
                          <Text fontSize="xs" fontWeight="semibold">
                            {existingAnalysis.optimalCalendarSpread.backMonth ?
                              formatShortDate(existingAnalysis.optimalCalendarSpread.backMonth) : 'N/A'}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            IV: {existingAnalysis.optimalCalendarSpread.backIv ?
                              `${(existingAnalysis.optimalCalendarSpread.backIv * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Liquidity</Text>
                          <Text fontSize="sm" fontWeight="semibold" color="orange.400">
                            {existingAnalysis.optimalCalendarSpread.combinedLiquidity?.score?.toFixed(1) || 'N/A'}/10
                          </Text>
                        </Box>
                      </VStack>
                    </GridItem>
                  </Grid>
                ) : (
                  <Alert status="info" size="sm">
                    <AlertIcon />
                    <Text fontSize="xs">No viable calendar spreads found for this ticker.</Text>
                  </Alert>
                )}
              </Box>
            ) : (
              <Alert status="warning" size="sm">
                <AlertIcon />
                <Text fontSize="xs">Analysis data not available. Click "Analysis" to load.</Text>
              </Alert>
            )}
          </Box>
        </Collapse>
        )}
      </Flex>
      
      {/* Convert to Trade Modal */}
      <ConvertToTradeModal
        isOpen={isOpen}
        onClose={onClose}
        tradeIdea={tradeIdea}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Trade Idea
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this trade idea for {ticker}? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                ml={3}
                isLoading={isDeleting}
                loadingText="Deleting..."
              >
                Delete Trade Idea
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Refine Simulation Modal */}
      <RefineSimulationModal
        isOpen={refineModalOpen}
        onClose={() => setRefineModalOpen(false)}
        onRefine={handleRunRefinedSimulation}
        ticker={ticker}
        isLoading={isRunningSimulation}
      />

      {/* Monte Carlo Chart Modal */}
      {metadata?.simulationResults && (
        <MonteCarloChartModal
          isOpen={chartModalOpen}
          onClose={() => setChartModalOpen(false)}
          ticker={ticker}
          simulationResults={metadata.simulationResults}
          rawSimulationData={metadata.simulationResults.rawResults}
        />
      )}
    </Box>
  );
};

export default TradeIdeaCard;