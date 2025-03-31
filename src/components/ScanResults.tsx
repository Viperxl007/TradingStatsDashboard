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
  useToast
} from '@chakra-ui/react';
import { FiSearch, FiFilter, FiRefreshCw, FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { useData, scanEarningsStart, scanEarningsSuccess, scanEarningsError } from '../context/DataContext';
import { scanEarningsToday, scanEarningsByDate } from '../services/optionsService';
import { OptionsAnalysisResult } from '../types';

/**
 * ScanResults Component
 * 
 * This component allows users to scan stocks with earnings announcements
 * and view options analysis results for all of them.
 */
const ScanResults: React.FC = () => {
  const { colorMode } = useColorMode();
  const { state, dispatch } = useData();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRecommendation, setFilterRecommendation] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('ticker');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [customDate, setCustomDate] = useState<string>('');
  const toast = useToast();
  
  const { optionsData } = state;

  const handleScanToday = async () => {
    try {
      dispatch(scanEarningsStart());
      const results = await scanEarningsToday();
      dispatch(scanEarningsSuccess(results));
      
      toast({
        title: 'Scan Complete',
        description: `Analyzed ${results.length} stocks with earnings today`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch(scanEarningsError(errorMessage));
      
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
      const results = await scanEarningsByDate(customDate);
      dispatch(scanEarningsSuccess(results));
      
      toast({
        title: 'Scan Complete',
        description: `Analyzed ${results.length} stocks with earnings on ${customDate}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch(scanEarningsError(errorMessage));
      
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

  // Filter and sort results
  const filteredResults = optionsData.scanResults
    .filter(result => {
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
        <Heading size="md" mb={4}>Scan Stocks with Earnings</Heading>
        <Text mb={4}>
          Scan all stocks with earnings announcements and analyze their options data to find potential plays.
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

      {optionsData.isLoading && (
        <Flex justify="center" align="center" my={10}>
          <Spinner size="xl" color="brand.500" mr={4} />
          <Text>Scanning earnings and analyzing options data...</Text>
        </Flex>
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
          
          <TableContainer>
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
                </Tr>
              </Thead>
              <Tbody>
                {filteredResults.map((result) => (
                  <Tr key={result.ticker}>
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