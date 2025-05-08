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
  useColorMode,
  useToast,
  RadioGroup,
  Radio,
  Stack
} from '@chakra-ui/react';
import { FiSearch, FiFilter, FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { useData, scanEarningsStart, scanEarningsSuccess, scanEarningsError } from '../context/DataContext';
import { scanEarningsToday, scanEarningsByDate } from '../services/optionsService';
import { OptionsAnalysisResult } from '../types';
import NakedOptionsDisplay from './NakedOptionsDisplay';
import IronCondorDisplay from './IronCondorDisplay';
import CalendarSpreadDisplay from './CalendarSpreadDisplay';

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
      
      // Use EventSource for server-sent events
      const eventSource = new EventSource('http://localhost:5000/api/scan/earnings');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.status === 'in_progress') {
          // Update progress information
          setScanProgress(data.progress);
          
          // If we have partial results, update them
          if (data.results && data.results.length > 0) {
            dispatch(scanEarningsSuccess(data.results));
          }
        } else if (data.status === 'complete') {
          // Scan is complete
          dispatch(scanEarningsSuccess(data.results));
          
          // Keep the progress info for a moment before clearing it
          setTimeout(() => {
            setScanProgress(null);
          }, 2000);
          
          // Close the event source
          eventSource.close();
          
          toast({
            title: 'Scan Complete',
            description: `Analyzed ${data.count} stocks with earnings today`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        
        const errorMessage = 'Connection to server lost';
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
      
      // Use EventSource for server-sent events
      const eventSource = new EventSource(`http://localhost:5000/api/scan/earnings?date=${customDate}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.status === 'in_progress') {
          // Update progress information
          setScanProgress(data.progress);
          
          // If we have partial results, update them
          if (data.results && data.results.length > 0) {
            dispatch(scanEarningsSuccess(data.results));
          }
        } else if (data.status === 'complete') {
          // Scan is complete
          dispatch(scanEarningsSuccess(data.results));
          
          // Keep the progress info for a moment before clearing it
          setTimeout(() => {
            setScanProgress(null);
          }, 2000);
          
          // Close the event source
          eventSource.close();
          
          toast({
            title: 'Scan Complete',
            description: `Analyzed ${data.count} stocks with earnings on ${customDate}`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        
        const errorMessage = 'Connection to server lost';
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

  const handleRowClick = (ticker: string) => {
    if (strategyType === 'naked' || strategyType === 'ironCondor') {
      const newSelectedTicker = selectedTicker === ticker ? null : ticker;
      setSelectedTicker(newSelectedTicker);
      
      // Scroll to the options display if a ticker is selected
      if (newSelectedTicker) {
        // Add a small delay to ensure the component is rendered
        setTimeout(() => {
          const elementId = strategyType === 'naked'
            ? `naked-options-${newSelectedTicker}`
            : `iron-condor-${newSelectedTicker}`;
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  };

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

  // Filter and sort results
  const filteredResults = optionsData.scanResults
    .filter(result => {
      // Skip filtered out tickers completely
      // We check for the string representation since TypeScript doesn't know about "FILTERED OUT"
      if (String(result.recommendation) === 'FILTERED OUT') {
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
      
      return matchesSearch && matchesRecommendation;
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
          comparison = a.metrics.avgVolume - b.metrics.avgVolume;
          break;
        case 'iv30Rv30':
          comparison = a.metrics.iv30Rv30 - b.metrics.iv30Rv30;
          break;
        case 'tsSlope':
          comparison = a.metrics.tsSlope - b.metrics.tsSlope;
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
          
          <Text mt={2} fontSize="sm" color="gray.500">
            {scanProgress.completed < scanProgress.total
              ? "Analyzing options data... Results will update as they become available."
              : "Finalizing results..."}
          </Text>
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
                    onClick={() => handleRowClick(result.ticker)}
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
                      (strategyType === 'calendar' && result.optimalCalendarSpread) ||
                      (strategyType === 'naked' && result.optimalNakedOptions) ||
                      (strategyType === 'ironCondor' && result.optimalIronCondors)
                        ? { bg: colorMode === 'dark' ? 'brand.800' : 'brand.50' }
                        : undefined
                    }
                  >
                    <Td fontWeight="bold">{result.ticker}</Td>
                    <Td>{result.companyName || '-'}</Td>
                    <Td isNumeric>${result.currentPrice !== undefined && result.currentPrice !== null ? result.currentPrice.toFixed(2) : 'N/A'}</Td>
                    <Td isNumeric>
                      <Flex justify="flex-end" align="center">
                        <Icon
                          as={result.metrics?.avgVolumePass === "true" ? FiCheckCircle : FiXCircle}
                          color={result.metrics?.avgVolumePass === "true" ? 'green.500' : 'red.500'}
                          mr={2}
                        />
                        {result.metrics?.avgVolume !== undefined && result.metrics?.avgVolume !== null
                          ? result.metrics.avgVolume.toLocaleString()
                          : 'N/A'}
                      </Flex>
                    </Td>
                    <Td isNumeric>
                      <Flex justify="flex-end" align="center">
                        <Icon
                          as={result.metrics?.iv30Rv30Pass === "true" ? FiCheckCircle : FiXCircle}
                          color={result.metrics?.iv30Rv30Pass === "true" ? 'green.500' : 'red.500'}
                          mr={2}
                        />
                        {result.metrics?.iv30Rv30 !== undefined && result.metrics?.iv30Rv30 !== null
                          ? result.metrics.iv30Rv30.toFixed(2)
                          : 'N/A'}
                      </Flex>
                    </Td>
                    <Td isNumeric>
                      <Flex justify="flex-end" align="center">
                        <Icon
                          as={result.metrics?.tsSlopePass === "true" ? FiCheckCircle : FiXCircle}
                          color={result.metrics?.tsSlopePass === "true" ? 'green.500' : 'red.500'}
                          mr={2}
                        />
                        {result.metrics?.tsSlope !== undefined && result.metrics?.tsSlope !== null
                          ? result.metrics.tsSlope.toFixed(5)
                          : 'N/A'}
                      </Flex>
                    </Td>
                    <Td>{result.expectedMove}</Td>
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
                    <Td colSpan={8} textAlign="center" py={4}>
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
    </Box>
  );
};

export default ScanResults;