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
  AlertDialogOverlay
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
    const now = new Date();
    const earnings = new Date(earningsDate);
    return earnings < now;
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
  
  // Function to refresh core metrics
  const refreshMetrics = async () => {
    setIsRefreshingMetrics(true);
    try {
      const response = await fetch(`http://localhost:5000/api/refresh-metrics/${ticker}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update local state for immediate UI feedback
          setLastRefreshTime(new Date());
          
          // Update the trade idea record in the database with refreshed metrics
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
      <Flex p={4} direction="column" alignItems="flex-start">
        {/* Header section with ticker, company name, and menu */}
        <Flex width="100%" justifyContent="space-between" alignItems="center" mb={3}>
          <HStack>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="xl" fontWeight="bold" color={textColor}>
                {ticker}
              </Text>
              {companyName && (
                <Text fontSize="xs" color={mutedColor} mt={0}>
                  {companyName}
                </Text>
              )}
            </VStack>
          </HStack>
          
          <HStack spacing={3}>
            {/* Earnings Date in Header */}
            {earningsDate && (
              <VStack align="flex-end" spacing={0}>
                <Text fontSize="sm" fontWeight="medium" color={textColor}>
                  {formatDisplayDate(earningsDate)}
                </Text>
                {earningsTime && (
                  <Badge
                    colorScheme={earningsTime === 'BMO' ? 'orange' : 'purple'}
                    variant="solid"
                    fontSize="xs"
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
        
        {/* Strategy badge and earnings info */}
        <HStack mb={3} spacing={3} flexWrap="wrap">
          <Badge colorScheme={strategyColors[strategy]}>
            {strategyNames[strategy]}
          </Badge>
          
          {hasEarningsPassed() && (
            <Badge colorScheme="orange" variant="outline">
              Earnings Over
            </Badge>
          )}
        </HStack>
        
        {/* Main content grid - conditionally rendered based on compact view */}
        {!isCompactView && (
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} width="100%" mb={3}>
            {/* Left column - Trade details */}
            <GridItem>
              <VStack align="flex-start" spacing={3}>
                {/* Current price */}
                {currentPrice > 0 && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Current Price</StatLabel>
                    <StatNumber fontSize="md">${currentPrice.toFixed(2)}</StatNumber>
                  </Stat>
                )}
                
                {/* Expected move */}
                {expectedMove && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Expected Move</StatLabel>
                    <StatNumber fontSize="md">{expectedMove}</StatNumber>
                  </Stat>
                )}
                
                {/* Earnings Date and Time */}
                {earningsDate && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Earnings Date</StatLabel>
                    <StatNumber fontSize="md">
                      <HStack spacing={2}>
                        <Text>
                          {formatDisplayDate(earningsDate)}
                        </Text>
                        {earningsTime && (
                          <Badge
                            colorScheme={earningsTime === 'BMO' ? 'orange' : 'purple'}
                            variant="solid"
                            fontSize="xs"
                          >
                            {earningsTime === 'BMO' ? '☀️ BMO' : earningsTime === 'AMC' ? '🌙 AMC' : earningsTime}
                          </Badge>
                        )}
                      </HStack>
                    </StatNumber>
                  </Stat>
                )}
                
                {/* Estimated spread cost */}
                {estimatedSpreadCost > 0 && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Est. Spread Cost</StatLabel>
                    <StatNumber fontSize="md">${estimatedSpreadCost.toFixed(2)}</StatNumber>
                  </Stat>
                )}
                
                {/* Closest strikes */}
                {closestStrikes && closestStrikes.length > 0 && (
                  <Box>
                    <Text fontSize="xs" fontWeight="medium">Closest Strikes:</Text>
                    <HStack spacing={2} mt={1}>
                      {closestStrikes.map((strike: number | string, idx: number) => (
                        <Badge key={idx} variant="outline" colorScheme="blue">
                          ${typeof strike === 'number' ? strike.toFixed(2) : strike}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                )}
              </VStack>
            </GridItem>
            
            {/* Right column - Metrics */}
            <GridItem>
              <VStack align="flex-start" spacing={3}>
                {/* Metrics Header with Refresh Button */}
                <HStack justify="space-between" width="100%">
                  <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                    Core Metrics
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
                
                {/* Last refresh timestamp */}
                {(lastRefreshTime || lastMetricsRefresh) && (
                  <Text fontSize="xs" color="gray.500">
                    Updated: {lastRefreshTime ?
                      lastRefreshTime.toLocaleTimeString() :
                      new Date(lastMetricsRefresh).toLocaleTimeString()
                    }
                  </Text>
                )}
                
                {/* Volume */}
                {displayMetrics.avgVolume > 0 && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">Volume</StatLabel>
                    <StatNumber
                      fontSize="md"
                      color={getMetricColor('volume', displayMetrics.avgVolume)}
                      fontWeight="bold"
                    >
                      {displayMetrics.avgVolume.toLocaleString()}
                    </StatNumber>
                    <StatHelpText fontSize="xs" mt={0}>
                      {displayMetrics.avgVolume >= 1500000 ? '✓ Above 1.5M' : '✗ Below 1.5M'}
                    </StatHelpText>
                  </Stat>
                )}
                
                {/* IV/RV */}
                {displayMetrics.iv30Rv30 > 0 && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">IV/RV</StatLabel>
                    <StatNumber
                      fontSize="md"
                      color={getMetricColor('iv', displayMetrics.iv30Rv30)}
                      fontWeight="bold"
                    >
                      {displayMetrics.iv30Rv30.toFixed(2)}
                    </StatNumber>
                    <StatHelpText fontSize="xs" mt={0}>
                      {displayMetrics.iv30Rv30 >= 1.25 ? '✓ Above 1.25' : '✗ Below 1.25'}
                    </StatHelpText>
                  </Stat>
                )}
                
                {/* TS Slope */}
                {displayMetrics.tsSlope !== 0 && (
                  <Stat size="sm">
                    <StatLabel fontSize="xs">TS Slope</StatLabel>
                    <StatNumber
                      fontSize="md"
                      color={getMetricColor('slope', displayMetrics.tsSlope)}
                      fontWeight="bold"
                    >
                      {displayMetrics.tsSlope.toFixed(5)}
                    </StatNumber>
                    <StatHelpText fontSize="xs" mt={0}>
                      {displayMetrics.tsSlope <= -0.00406 ? '✓ Below -0.00406' : '✗ Above -0.00406'}
                    </StatHelpText>
                  </Stat>
                )}
              </VStack>
            </GridItem>
          </Grid>
        )}
        
        {/* Notes section - conditionally rendered */}
        {!isCompactView && (
          <Box width="100%" mb={3}>
            <Text fontSize="xs" fontWeight="medium" mb={1}>Notes:</Text>
            <Text fontSize="sm" color={mutedColor} noOfLines={3}>
              {notes || 'No notes provided'}
            </Text>
          </Box>
        )}
        
        {/* Tags - conditionally rendered */}
        {!isCompactView && tags.length > 0 && (
          <HStack spacing={2} mt={1} mb={3} flexWrap="wrap">
            {tags.map((tag, index) => (
              <Tag size="sm" key={index} colorScheme="gray" borderRadius="full">
                <TagLabel>{tag}</TagLabel>
              </Tag>
            ))}
          </HStack>
        )}
        
        {!isCompactView && <Divider my={3} />}
        
        {/* Footer with dates and action buttons - conditionally rendered */}
        {!isCompactView && (
          <Flex width="100%" justifyContent="space-between" alignItems="center">
          <VStack align="flex-start" spacing={1}>
            <Tooltip label="Target entry date" placement="top">
              <HStack>
                <InfoIcon boxSize={3} color="gray.500" />
                <Text fontSize="xs" color={mutedColor}>
                  {formatDate(entryDate)}
                </Text>
              </HStack>
            </Tooltip>
            
            <Tooltip label="Days since creation" placement="top">
              <HStack>
                <WarningIcon
                  boxSize={3}
                  color={daysSinceCreation() > 14 ? 'orange.500' : 'gray.500'}
                />
                <Text
                  fontSize="xs"
                  color={daysSinceCreation() > 14 ? 'orange.500' : mutedColor}
                >
                  {daysSinceCreation()} days old
                </Text>
              </HStack>
            </Tooltip>
          </VStack>
          
          <HStack spacing={2}>
            {hasEarningsPassed() ? (
              // Show "Remove Trade Idea" button for expired earnings
              <Button
                size="sm"
                leftIcon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={handleDelete}
              >
                Remove Trade Idea
              </Button>
            ) : (
              // Show normal buttons for active trade ideas
              <>
                <Button
                  size="sm"
                  leftIcon={showDeeperAnalysis ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleDeeperAnalysis}
                  isLoading={isLoadingAnalysis && !existingAnalysis}
                  loadingText="Loading..."
                >
                  {showDeeperAnalysis ? 'Hide Analysis' : existingAnalysis ? 'Show Analysis' : 'Deeper Analysis'}
                </Button>
                
                {existingAnalysis && (
                  <Button
                    size="sm"
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
                
                <Button
                  size="sm"
                  leftIcon={<CheckIcon />}
                  colorScheme="green"
                  onClick={onOpen}
                >
                  Open Trade
                </Button>
              </>
            )}
          </HStack>
        </Flex>
        )}
        
        {/* Deeper Analysis Section - conditionally rendered */}
        {!isCompactView && (
          <Collapse in={showDeeperAnalysis} animateOpacity>
          <Box mt={4} p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            {isLoadingAnalysis ? (
              <Flex justify="center" align="center" py={8}>
                <Spinner size="lg" />
                <Text ml={3}>Loading calendar spread analysis...</Text>
              </Flex>
            ) : existingAnalysis ? (
              <Box>
                <Text fontSize="md" fontWeight="bold" mb={3} color="blue.500">
                  📊 Calendar Spread Analysis
                </Text>
                
                {existingAnalysis.optimalCalendarSpread ? (
                  <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                    {/* Column 1: Strategy Overview */}
                    <GridItem>
                      <VStack align="flex-start" spacing={3}>
                        <Text fontSize="sm" fontWeight="bold" color="blue.400">Strategy Overview</Text>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Strategy Score</Text>
                          <Text fontSize="lg" fontWeight="bold" color="green.400">
                            {existingAnalysis.optimalCalendarSpread.score?.toFixed(0) || 'N/A'}/100
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Option Type</Text>
                          <Badge colorScheme={existingAnalysis.optimalCalendarSpread.optionType === 'call' ? 'green' : 'red'}>
                            {existingAnalysis.optimalCalendarSpread.optionType?.toUpperCase() || 'N/A'}
                          </Badge>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Strike Price</Text>
                          <Text fontSize="md" fontWeight="semibold">
                            ${existingAnalysis.optimalCalendarSpread.strike}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">IV Differential</Text>
                          <Text fontSize="md" fontWeight="semibold" color="green.400">
                            {(existingAnalysis.optimalCalendarSpread.ivDifferential * 100).toFixed(1)}%
                          </Text>
                        </Box>
                      </VStack>
                    </GridItem>

                    {/* Column 2: Risk/Reward */}
                    <GridItem>
                      <VStack align="flex-start" spacing={3}>
                        <Text fontSize="sm" fontWeight="bold" color="blue.400">Risk/Reward</Text>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Spread Cost</Text>
                          <Text fontSize="md" fontWeight="semibold">
                            ${existingAnalysis.optimalCalendarSpread.spreadCost?.toFixed(2) || 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Est. Max Profit</Text>
                          <Text fontSize="md" fontWeight="semibold" color="green.400">
                            ${existingAnalysis.optimalCalendarSpread.estimatedMaxProfit?.toFixed(2) || 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Return on Risk</Text>
                          <Text fontSize="md" fontWeight="semibold" color="green.400">
                            {existingAnalysis.optimalCalendarSpread.returnOnRisk ?
                              `${(existingAnalysis.optimalCalendarSpread.returnOnRisk * 100).toFixed(0)}%` : 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Probability of Profit</Text>
                          <Text fontSize="md" fontWeight="semibold" color="blue.400">
                            {existingAnalysis.optimalCalendarSpread.monteCarloResults?.probabilityOfProfit ?
                              `${(existingAnalysis.optimalCalendarSpread.monteCarloResults.probabilityOfProfit * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </Box>
                      </VStack>
                    </GridItem>

                    {/* Column 3: Expiration Details */}
                    <GridItem>
                      <VStack align="flex-start" spacing={3}>
                        <Text fontSize="sm" fontWeight="bold" color="blue.400">Expiration Details</Text>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Front Month</Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {existingAnalysis.optimalCalendarSpread.frontMonth ?
                              formatShortDate(existingAnalysis.optimalCalendarSpread.frontMonth) : 'N/A'}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            IV: {existingAnalysis.optimalCalendarSpread.frontIv ?
                              `${(existingAnalysis.optimalCalendarSpread.frontIv * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Back Month</Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {existingAnalysis.optimalCalendarSpread.backMonth ?
                              formatShortDate(existingAnalysis.optimalCalendarSpread.backMonth) : 'N/A'}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            IV: {existingAnalysis.optimalCalendarSpread.backIv ?
                              `${(existingAnalysis.optimalCalendarSpread.backIv * 100).toFixed(1)}%` : 'N/A'}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Liquidity Score</Text>
                          <Text fontSize="md" fontWeight="semibold" color="orange.400">
                            {existingAnalysis.optimalCalendarSpread.combinedLiquidity?.score?.toFixed(1) || 'N/A'}/10
                          </Text>
                        </Box>
                      </VStack>
                    </GridItem>
                  </Grid>
                ) : (
                  <Alert status="info">
                    <AlertIcon />
                    No viable calendar spreads found for this ticker.
                  </Alert>
                )}
              </Box>
            ) : (
              <Alert status="warning">
                <AlertIcon />
                Analysis data not available. Click "Deeper Analysis" to load.
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
    </Box>
  );
};

export default TradeIdeaCard;