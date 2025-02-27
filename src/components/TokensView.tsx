import * as React from 'react';
import {
  Box,
  Heading,
  Text,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  HStack,
  Select,
  Card,
  CardBody,
  useColorModeValue
} from '@chakra-ui/react';
import { FiSearch, FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import { useData } from '../context/DataContext';

const TokensView: React.FC = () => {
  const { state } = useData();
  const { tokenPerformance } = state;
  
  // Local state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState('totalProfitLoss');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  
  // Colors
  const tableBg = useColorModeValue('white', 'gray.800');
  const tableBorderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Filter tokens based on search term
  const filteredTokens = React.useMemo(() => {
    return tokenPerformance.filter(token =>
      token.token.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tokenPerformance, searchTerm]);
  
  // Sort tokens based on selected field and direction
  const sortedTokens = React.useMemo(() => {
    return [...filteredTokens].sort((a, b) => {
      const aValue = a[sortField as keyof typeof a];
      const bValue = b[sortField as keyof typeof b];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  }, [filteredTokens, sortField, sortDirection]);
  
  // Handle sort change
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Render trend icon
  const renderTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') {
      return <Icon as={FiTrendingUp} color="green.500" />;
    } else if (trend === 'down') {
      return <Icon as={FiTrendingDown} color="red.500" />;
    } else {
      return <Icon as={FiMinus} color="gray.500" />;
    }
  };
  
  return (
    <Box>
      <Heading size="lg" mb={6}>Token Performance</Heading>
      
      {/* Filters */}
      <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor} borderRadius="lg" mb={6}>
        <CardBody>
          <HStack spacing={4} mb={4}>
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search tokens..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
            
            <Select
              maxW="200px"
              value={sortField}
              onChange={(e) => handleSort(e.target.value)}
            >
              <option value="token">Token Name</option>
              <option value="totalTrades">Total Trades</option>
              <option value="totalProfitLoss">Total P/L</option>
              <option value="winRate">Win Rate</option>
              <option value="averageHoldingTime">Avg Holding Time</option>
              <option value="volatility">Volatility</option>
            </Select>
          </HStack>
          
          <Text fontSize="sm" color="gray.500">
            Showing {sortedTokens.length} of {tokenPerformance.length} tokens
          </Text>
        </CardBody>
      </Card>
      
      {/* Token performance table */}
      {sortedTokens.length === 0 ? (
        <Flex
          justify="center"
          align="center"
          h="400px"
          borderWidth="1px"
          borderRadius="lg"
          borderColor={tableBorderColor}
          bg={tableBg}
        >
          <Text>No tokens found matching your search criteria</Text>
        </Flex>
      ) : (
        <Box
          borderWidth="1px"
          borderRadius="lg"
          overflow="hidden"
          borderColor={tableBorderColor}
          bg={tableBg}
        >
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('token')}
                  >
                    Token
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('totalTrades')}
                    isNumeric
                  >
                    Trades
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('totalVolume')}
                    isNumeric
                  >
                    Volume
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('totalProfitLoss')}
                    isNumeric
                  >
                    Total P/L
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('winRate')}
                    isNumeric
                  >
                    Win Rate
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('averageHoldingTime')}
                    isNumeric
                  >
                    Avg Hold Time
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('trend')}
                  >
                    Trend
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {sortedTokens.map((token) => (
                  <Tr key={token.token}>
                    <Td fontWeight="medium">{token.token}</Td>
                    <Td isNumeric>{token.totalTrades}</Td>
                    <Td isNumeric>${token.totalVolume.toLocaleString()}</Td>
                    <Td isNumeric>
                      <Text
                        color={token.totalProfitLoss >= 0 ? 'green.500' : 'red.500'}
                        fontWeight="medium"
                      >
                        ${token.totalProfitLoss.toLocaleString()}
                      </Text>
                    </Td>
                    <Td isNumeric>{token.winRate.toFixed(1)}%</Td>
                    <Td isNumeric>{token.averageHoldingTime.toFixed(1)} days</Td>
                    <Td>
                      <HStack>
                        {renderTrendIcon(token.trend)}
                        <Badge
                          colorScheme={
                            token.trend === 'up' ? 'green' :
                            token.trend === 'down' ? 'red' :
                            'gray'
                          }
                        >
                          {token.trend.toUpperCase()}
                        </Badge>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default TokensView;