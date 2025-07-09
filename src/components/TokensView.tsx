import React, { useMemo, useState } from 'react';
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
  useColorModeValue,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  SimpleGrid
} from '@chakra-ui/react';
import { FiSearch, FiTrendingUp, FiTrendingDown, FiMinus, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { useHyperliquid } from '../context/HyperliquidContext';
import { format } from 'date-fns';

const TokensView: React.FC = () => {
  const { state } = useHyperliquid();
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('totalProfitLoss');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Colors
  const tableBg = useColorModeValue('white', 'gray.800');
  const tableBorderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  
  // Calculate token performance from real Hyperliquid data
  const tokenPerformance = useMemo(() => {
    if (!state.trades || state.trades.length === 0) {
      return [];
    }

    const trades = state.trades;
    
    // Group trades by coin
    const coinStats = trades.reduce((acc, trade) => {
      const coin = trade.coin;
      if (!acc[coin]) {
        acc[coin] = {
          coin,
          totalTrades: 0,
          totalProfitLoss: 0,
          totalFees: 0,
          totalVolume: 0,
          winningTrades: 0,
          losingTrades: 0,
          maxWin: 0,
          maxLoss: 0,
          firstTradeTime: trade.time,
          lastTradeTime: trade.time,
          buyTrades: 0,
          sellTrades: 0,
          totalBuyVolume: 0,
          totalSellVolume: 0
        };
      }
      
      const pnl = trade.closed_pnl || 0;
      const volume = (trade.px * trade.sz) || 0;
      
      acc[coin].totalTrades += 1;
      acc[coin].totalProfitLoss += pnl;
      acc[coin].totalFees += trade.fee || 0;
      acc[coin].totalVolume += volume;
      
      // Track first and last trade times
      if (trade.time < acc[coin].firstTradeTime) {
        acc[coin].firstTradeTime = trade.time;
      }
      if (trade.time > acc[coin].lastTradeTime) {
        acc[coin].lastTradeTime = trade.time;
      }
      
      // Track buy/sell statistics
      if (trade.side === 'B') {
        acc[coin].buyTrades += 1;
        acc[coin].totalBuyVolume += volume;
      } else if (trade.side === 'A') {
        acc[coin].sellTrades += 1;
        acc[coin].totalSellVolume += volume;
      }
      
      if (pnl > 0) {
        acc[coin].winningTrades += 1;
        acc[coin].maxWin = Math.max(acc[coin].maxWin, pnl);
      } else if (pnl < 0) {
        acc[coin].losingTrades += 1;
        acc[coin].maxLoss = Math.min(acc[coin].maxLoss, pnl);
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate derived metrics
    return Object.values(coinStats).map((coin: any) => ({
      ...coin,
      winRate: coin.totalTrades > 0 ? (coin.winningTrades / coin.totalTrades) * 100 : 0,
      averageProfitLoss: coin.totalTrades > 0 ? coin.totalProfitLoss / coin.totalTrades : 0,
      netProfitLoss: coin.totalProfitLoss - coin.totalFees,
      profitFactor: coin.maxLoss !== 0 ? Math.abs(coin.maxWin / coin.maxLoss) : 0,
      averageTradeSize: coin.totalTrades > 0 ? coin.totalVolume / coin.totalTrades : 0,
      trend: coin.totalProfitLoss > 0 ? 'up' : coin.totalProfitLoss < 0 ? 'down' : 'neutral'
    }));
  }, [state.trades]);
  
  // Filter tokens based on search term
  const filteredTokens = useMemo(() => {
    return tokenPerformance.filter(token =>
      token.coin.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tokenPerformance, searchTerm]);
  
  // Sort tokens based on selected field and direction
  const sortedTokens = useMemo(() => {
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
  
  // Render sort icon
  const renderSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return (
      <Icon 
        as={sortDirection === 'asc' ? FiArrowUp : FiArrowDown} 
        ml={1} 
        boxSize={3}
      />
    );
  };
  
  // Loading state
  if (state.isLoading) {
    return (
      <Box>
        <Skeleton height="40px" mb={4} />
        <Skeleton height="60px" mb={6} />
        <Skeleton height="400px" />
      </Box>
    );
  }
  
  // Error state
  if (state.error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Error loading Hyperliquid data!</AlertTitle>
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  
  // No account selected state
  if (!state.selectedAccount) {
    return (
      <Alert status="info">
        <AlertIcon />
        <AlertTitle>No account selected</AlertTitle>
        <AlertDescription>Please select a Hyperliquid account to view token performance.</AlertDescription>
      </Alert>
    );
  }
  
  // No trades state
  if (!state.trades || state.trades.length === 0) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>No trading data available</AlertTitle>
        <AlertDescription>
          No trades found for {state.selectedAccount.display_name} to analyze token performance.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate summary stats
  const totalCoins = tokenPerformance.length;
  const profitableCoins = tokenPerformance.filter(t => t.totalProfitLoss > 0).length;
  const totalVolume = tokenPerformance.reduce((sum, t) => sum + t.totalVolume, 0);
  const totalPnL = tokenPerformance.reduce((sum, t) => sum + t.totalProfitLoss, 0);
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Token Performance - {state.selectedAccount.display_name}</Heading>
        {state.lastSyncTime && (
          <Text fontSize="sm" color="gray.500">
            Last updated: {format(new Date(state.lastSyncTime), 'PPpp')}
          </Text>
        )}
      </Flex>
      
      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6} mb={6}>
        <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Total Coins</StatLabel>
              <StatNumber>{totalCoins}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Profitable Coins</StatLabel>
              <StatNumber color="green.500">{profitableCoins}</StatNumber>
              <StatHelpText>
                {totalCoins > 0 ? `${((profitableCoins / totalCoins) * 100).toFixed(1)}%` : '0%'}
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Total Volume</StatLabel>
              <StatNumber>${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Total P&L</StatLabel>
              <StatNumber color={totalPnL >= 0 ? "green.500" : "red.500"}>
                ${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </StatNumber>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
      
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
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              maxW="200px"
            >
              <option value="totalProfitLoss">Total P&L</option>
              <option value="winRate">Win Rate</option>
              <option value="totalTrades">Total Trades</option>
              <option value="totalVolume">Total Volume</option>
              <option value="averageProfitLoss">Avg P&L</option>
              <option value="profitFactor">Profit Factor</option>
              <option value="coin">Coin Name</option>
            </Select>
          </HStack>
          
          <Text fontSize="sm" color="gray.500">
            Showing {sortedTokens.length} of {tokenPerformance.length} tokens
          </Text>
        </CardBody>
      </Card>
      
      {/* Tokens Table */}
      <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor} borderRadius="lg" overflow="hidden">
        <Table variant="simple">
          <Thead bg={headerBg}>
            <Tr>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('coin')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
              >
                <Flex align="center">
                  Coin
                  {renderSortIcon('coin')}
                </Flex>
              </Th>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('totalProfitLoss')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                isNumeric
              >
                <Flex align="center" justify="flex-end">
                  Total P&L
                  {renderSortIcon('totalProfitLoss')}
                </Flex>
              </Th>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('winRate')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                isNumeric
              >
                <Flex align="center" justify="flex-end">
                  Win Rate
                  {renderSortIcon('winRate')}
                </Flex>
              </Th>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('totalTrades')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                isNumeric
              >
                <Flex align="center" justify="flex-end">
                  Trades
                  {renderSortIcon('totalTrades')}
                </Flex>
              </Th>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('totalVolume')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                isNumeric
              >
                <Flex align="center" justify="flex-end">
                  Volume
                  {renderSortIcon('totalVolume')}
                </Flex>
              </Th>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('averageProfitLoss')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                isNumeric
              >
                <Flex align="center" justify="flex-end">
                  Avg P&L
                  {renderSortIcon('averageProfitLoss')}
                </Flex>
              </Th>
              <Th 
                cursor="pointer" 
                onClick={() => handleSort('profitFactor')}
                _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                isNumeric
              >
                <Flex align="center" justify="flex-end">
                  Profit Factor
                  {renderSortIcon('profitFactor')}
                </Flex>
              </Th>
              <Th>Trend</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sortedTokens.map((token) => (
              <Tr key={token.coin} _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}>
                <Td>
                  <Flex align="center">
                    <Text fontWeight="bold" mr={2}>
                      {token.coin}
                    </Text>
                    <Badge
                      colorScheme={token.totalProfitLoss >= 0 ? 'green' : 'red'}
                      variant="subtle"
                      size="sm"
                    >
                      {token.totalProfitLoss >= 0 ? 'Profit' : 'Loss'}
                    </Badge>
                  </Flex>
                </Td>
                <Td isNumeric>
                  <Text
                    fontWeight="semibold"
                    color={token.totalProfitLoss >= 0 ? 'green.500' : 'red.500'}
                  >
                    ${token.totalProfitLoss.toLocaleString(undefined, { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text
                    color={token.winRate >= 50 ? 'green.500' : 'red.500'}
                  >
                    {token.winRate.toFixed(1)}%
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text>{token.totalTrades}</Text>
                  <Text fontSize="xs" color="gray.500">
                    {token.winningTrades}W / {token.losingTrades}L
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text>
                    ${token.totalVolume.toLocaleString(undefined, { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 0 
                    })}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text
                    color={token.averageProfitLoss >= 0 ? 'green.500' : 'red.500'}
                  >
                    ${token.averageProfitLoss.toFixed(2)}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Text
                    color={token.profitFactor >= 1 ? 'green.500' : 'red.500'}
                  >
                    {token.profitFactor.toFixed(2)}
                  </Text>
                </Td>
                <Td>
                  {renderTrendIcon(token.trend)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        
        {sortedTokens.length === 0 && (
          <Box p={8} textAlign="center">
            <Text color="gray.500">
              {searchTerm ? `No tokens found matching "${searchTerm}"` : 'No tokens available'}
            </Text>
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default TokensView;