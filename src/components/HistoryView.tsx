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
  Button,
  ButtonGroup,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from '@chakra-ui/react';
import { 
  FiSearch, 
  FiFilter, 
  FiDownload, 
  FiArrowUp, 
  FiArrowDown,
  FiMoreVertical,
  FiEye,
  FiCopy
} from 'react-icons/fi';
import { useHyperliquid } from '../context/HyperliquidContext';
import { format } from 'date-fns';

const HistoryView: React.FC = () => {
  const { state } = useHyperliquid();
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterCoin, setFilterCoin] = useState('all');
  const [filterSide, setFilterSide] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Colors
  const tableBg = useColorModeValue('white', 'gray.800');
  const tableBorderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  
  // Get unique coins for filter
  const uniqueCoins = useMemo(() => {
    if (!state.trades) return [];
    return [...new Set(state.trades.map(trade => trade.coin))].sort();
  }, [state.trades]);
  
  // Filter and sort trades
  const filteredAndSortedTrades = useMemo(() => {
    if (!state.trades) return [];
    
    let filtered = state.trades.filter(trade => {
      // Search filter
      const searchMatch = searchTerm === '' || 
        trade.coin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.trade_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Coin filter
      const coinMatch = filterCoin === 'all' || trade.coin === filterCoin;
      
      // Side filter
      const sideMatch = filterSide === 'all' || 
        (filterSide === 'buy' && trade.side === 'B') ||
        (filterSide === 'sell' && trade.side === 'A');
      
      return searchMatch && coinMatch && sideMatch;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof typeof a];
      let bValue: any = b[sortField as keyof typeof b];
      
      // Handle special cases
      if (sortField === 'time') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
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
    
    return filtered;
  }, [state.trades, searchTerm, sortField, sortDirection, filterCoin, filterSide]);
  
  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTrades.length / itemsPerPage);
  const paginatedTrades = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedTrades.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedTrades, currentPage, itemsPerPage]);
  
  // Handle sort change
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
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
  
  // Format side
  const formatSide = (side: string) => {
    return side === 'B' ? 'Buy' : side === 'A' ? 'Sell' : side;
  };
  
  // Format currency
  const formatCurrency = (value: number, decimals: number = 2) => {
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };
  
  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
        <AlertDescription>Please select a Hyperliquid account to view trade history.</AlertDescription>
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
          No trades found for {state.selectedAccount.display_name}.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Trade History - {state.selectedAccount.display_name}</Heading>
        {state.lastSyncTime && (
          <Text fontSize="sm" color="gray.500">
            Last updated: {format(new Date(state.lastSyncTime), 'PPpp')}
          </Text>
        )}
      </Flex>
      
      {/* Filters */}
      <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor} borderRadius="lg" mb={6}>
        <CardBody>
          <Flex direction={{ base: 'column', md: 'row' }} gap={4} mb={4}>
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search by coin or trade ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
            
            <Select
              value={filterCoin}
              onChange={(e) => setFilterCoin(e.target.value)}
              maxW="150px"
            >
              <option value="all">All Coins</option>
              {uniqueCoins.map(coin => (
                <option key={coin} value={coin}>{coin}</option>
              ))}
            </Select>
            
            <Select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value)}
              maxW="120px"
            >
              <option value="all">All Sides</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </Select>
            
            <Select
              value={itemsPerPage.toString()}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              maxW="120px"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="200">200 per page</option>
            </Select>
            
            <Button
              leftIcon={<Icon as={FiDownload} />}
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Implement CSV export
                console.log('Export functionality to be implemented');
              }}
            >
              Export
            </Button>
          </Flex>
          
          <Flex justify="space-between" align="center">
            <Text fontSize="sm" color="gray.500">
              Showing {paginatedTrades.length} of {filteredAndSortedTrades.length} trades
              {filteredAndSortedTrades.length !== state.trades.length && 
                ` (filtered from ${state.trades.length} total)`
              }
            </Text>
            
            {totalPages > 1 && (
              <HStack spacing={2}>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  isDisabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Text fontSize="sm">
                  Page {currentPage} of {totalPages}
                </Text>
                <Button
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  isDisabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </HStack>
            )}
          </Flex>
        </CardBody>
      </Card>
      
      {/* Trades Table */}
      <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor} borderRadius="lg" overflow="hidden">
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead bg={headerBg}>
              <Tr>
                <Th 
                  cursor="pointer" 
                  onClick={() => handleSort('time')}
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                >
                  <Flex align="center">
                    Time
                    {renderSortIcon('time')}
                  </Flex>
                </Th>
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
                  onClick={() => handleSort('side')}
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                >
                  <Flex align="center">
                    Side
                    {renderSortIcon('side')}
                  </Flex>
                </Th>
                <Th 
                  cursor="pointer" 
                  onClick={() => handleSort('sz')}
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                  isNumeric
                >
                  <Flex align="center" justify="flex-end">
                    Size
                    {renderSortIcon('sz')}
                  </Flex>
                </Th>
                <Th 
                  cursor="pointer" 
                  onClick={() => handleSort('px')}
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                  isNumeric
                >
                  <Flex align="center" justify="flex-end">
                    Price
                    {renderSortIcon('px')}
                  </Flex>
                </Th>
                <Th isNumeric>Value</Th>
                <Th 
                  cursor="pointer" 
                  onClick={() => handleSort('closed_pnl')}
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                  isNumeric
                >
                  <Flex align="center" justify="flex-end">
                    P&L
                    {renderSortIcon('closed_pnl')}
                  </Flex>
                </Th>
                <Th 
                  cursor="pointer" 
                  onClick={() => handleSort('fee')}
                  _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                  isNumeric
                >
                  <Flex align="center" justify="flex-end">
                    Fee
                    {renderSortIcon('fee')}
                  </Flex>
                </Th>
                <Th>Trade ID</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {paginatedTrades.map((trade) => {
                const tradeValue = trade.px * trade.sz;
                const pnl = trade.closed_pnl || 0;
                const fee = trade.fee || 0;
                
                return (
                  <Tr key={trade.id} _hover={{ bg: hoverBg }}>
                    <Td>
                      <Text fontSize="sm">
                        {format(new Date(trade.time), 'MMM dd, yyyy')}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {format(new Date(trade.time), 'HH:mm:ss')}
                      </Text>
                    </Td>
                    <Td>
                      <Text fontWeight="semibold">{trade.coin}</Text>
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={trade.side === 'B' ? 'green' : 'red'}
                        variant="subtle"
                      >
                        {formatSide(trade.side)}
                      </Badge>
                    </Td>
                    <Td isNumeric>
                      <Text>{formatCurrency(trade.sz, 4)}</Text>
                    </Td>
                    <Td isNumeric>
                      <Text>${formatCurrency(trade.px, 2)}</Text>
                    </Td>
                    <Td isNumeric>
                      <Text>${formatCurrency(tradeValue, 2)}</Text>
                    </Td>
                    <Td isNumeric>
                      <Text
                        color={pnl >= 0 ? 'green.500' : 'red.500'}
                        fontWeight={pnl !== 0 ? 'semibold' : 'normal'}
                      >
                        {pnl !== 0 ? `$${formatCurrency(pnl, 2)}` : '-'}
                      </Text>
                    </Td>
                    <Td isNumeric>
                      <Text color="gray.500">
                        ${formatCurrency(fee, 2)}
                      </Text>
                    </Td>
                    <Td>
                      <Tooltip label="Click to copy">
                        <Text
                          fontSize="xs"
                          fontFamily="mono"
                          cursor="pointer"
                          onClick={() => copyToClipboard(trade.trade_id)}
                          _hover={{ color: 'blue.500' }}
                        >
                          {trade.trade_id.slice(0, 8)}...
                        </Text>
                      </Tooltip>
                    </Td>
                    <Td>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="sm"
                        />
                        <MenuList>
                          <MenuItem
                            icon={<FiCopy />}
                            onClick={() => copyToClipboard(trade.trade_id)}
                          >
                            Copy Trade ID
                          </MenuItem>
                          <MenuItem
                            icon={<FiEye />}
                            onClick={() => {
                              // TODO: Implement trade details view
                              console.log('View trade details:', trade);
                            }}
                          >
                            View Details
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
        
        {paginatedTrades.length === 0 && (
          <Box p={8} textAlign="center">
            <Text color="gray.500">
              {searchTerm || filterCoin !== 'all' || filterSide !== 'all'
                ? 'No trades found matching the current filters'
                : 'No trades available'
              }
            </Text>
          </Box>
        )}
      </Card>
      
      {/* Pagination Footer */}
      {totalPages > 1 && (
        <Flex justify="center" mt={6}>
          <HStack spacing={2}>
            <Button
              onClick={() => setCurrentPage(1)}
              isDisabled={currentPage === 1}
              size="sm"
            >
              First
            </Button>
            <Button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              isDisabled={currentPage === 1}
              size="sm"
            >
              Previous
            </Button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              if (pageNum > totalPages) return null;
              
              return (
                <Button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  colorScheme={currentPage === pageNum ? 'blue' : 'gray'}
                  variant={currentPage === pageNum ? 'solid' : 'outline'}
                  size="sm"
                >
                  {pageNum}
                </Button>
              );
            })}
            
            <Button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              isDisabled={currentPage === totalPages}
              size="sm"
            >
              Next
            </Button>
            <Button
              onClick={() => setCurrentPage(totalPages)}
              isDisabled={currentPage === totalPages}
              size="sm"
            >
              Last
            </Button>
          </HStack>
        </Flex>
      )}
    </Box>
  );
};

export default HistoryView;