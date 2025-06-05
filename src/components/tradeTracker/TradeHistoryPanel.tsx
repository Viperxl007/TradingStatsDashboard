import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Flex,
  Spacer,
  useColorModeValue,
  Center,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  FormControl,
  FormLabel,
  Stack,
  Heading,
  Divider,
  Badge,
  Button
} from '@chakra-ui/react';
import { SearchIcon, ChevronDownIcon, SettingsIcon, CalendarIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { AnyTradeEntry, TradeStatus } from '../../types/tradeTracker';
import TradeHistoryEntry from './TradeHistoryEntry';

/**
 * TradeHistoryPanel Component
 * 
 * This component displays a chronological list of all trade actions (entries, adjustments, exits)
 * with filtering and sorting options.
 */
const TradeHistoryPanel: React.FC = () => {
  const { state } = useData();
  const { tradeTrackerData } = state;
  const { trades } = tradeTrackerData;
  
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<TradeStatus[]>(['open', 'closed', 'cancelled']);
  const [filterDateRange, setFilterDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [filterTicker, setFilterTicker] = useState<string>('');
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Get all unique tickers for filtering
  const uniqueTickers = Array.from(new Set(trades.map(trade => trade.ticker))).sort();
  
  // Apply filters
  const filteredTrades = trades.filter(trade => {
    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const matchesTicker = trade.ticker.toLowerCase().includes(searchLower);
      const matchesNotes = trade.notes.toLowerCase().includes(searchLower);
      const matchesTags = trade.tags.some(tag => tag.toLowerCase().includes(searchLower));
      
      if (!matchesTicker && !matchesNotes && !matchesTags) {
        return false;
      }
    }
    
    // Filter by status
    if (!filterStatus.includes(trade.status)) {
      return false;
    }
    
    // Filter by ticker
    if (filterTicker && trade.ticker !== filterTicker) {
      return false;
    }
    
    // Filter by date range
    if (filterDateRange[0] || filterDateRange[1]) {
      const tradeDate = new Date(trade.entryDate);
      
      if (filterDateRange[0] && tradeDate < filterDateRange[0]) {
        return false;
      }
      
      if (filterDateRange[1] && tradeDate > filterDateRange[1]) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sort trades
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
        break;
      case 'ticker':
        comparison = a.ticker.localeCompare(b.ticker);
        break;
      case 'strategy':
        comparison = a.strategy.localeCompare(b.strategy);
        break;
      case 'pnl':
        // Calculate P&L if available
        const aPnL = a.profitLoss || 0;
        const bPnL = b.profitLoss || 0;
        comparison = aPnL - bPnL;
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };
  
  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };
  
  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };
  
  // Handle ticker filter change
  const handleTickerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterTicker(e.target.value);
  };
  
  // Handle status filter change
  const handleStatusFilterChange = (status: TradeStatus) => {
    if (filterStatus.includes(status)) {
      setFilterStatus(filterStatus.filter(s => s !== status));
    } else {
      setFilterStatus([...filterStatus, status]);
    }
  };
  
  // Handle date range filter change
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    setFilterDateRange([date, filterDateRange[1]]);
  };
  
  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : null;
    setFilterDateRange([filterDateRange[0], date]);
  };
  
  // Reset all filters
  const resetFilters = () => {
    setSearchText('');
    setFilterStatus(['open', 'closed', 'cancelled']);
    setFilterDateRange([null, null]);
    setFilterTicker('');
  };
  
  // Format date for input
  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };
  
  return (
    <Box>
      <Flex mb={4} direction={{ base: 'column', md: 'row' }} gap={4}>
        <InputGroup maxW={{ base: '100%', md: '300px' }}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search trade history..."
            value={searchText}
            onChange={handleSearchChange}
            borderRadius="md"
          />
        </InputGroup>
        
        <Spacer />
        
        <HStack spacing={2}>
          <Select
            value={sortBy}
            onChange={handleSortChange}
            width="auto"
            borderRadius="md"
          >
            <option value="date">Date</option>
            <option value="ticker">Ticker</option>
            <option value="strategy">Strategy</option>
            <option value="pnl">P&L</option>
          </Select>
          
          <IconButton
            aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
            icon={<ChevronDownIcon transform={sortOrder === 'asc' ? 'rotate(180deg)' : undefined} />}
            onClick={toggleSortOrder}
            variant="outline"
          />
          
          <Menu closeOnSelect={false}>
            <MenuButton
              as={IconButton}
              aria-label="Filter options"
              icon={<SettingsIcon />}
              variant="outline"
            />
            <MenuList p={4} minWidth="320px">
              <VStack align="stretch" spacing={4}>
                <Heading size="sm">Filter Options</Heading>
                <Divider />
                
                <FormControl>
                  <FormLabel fontSize="sm">Ticker</FormLabel>
                  <Select
                    value={filterTicker}
                    onChange={handleTickerChange}
                    placeholder="All Tickers"
                    size="sm"
                  >
                    {uniqueTickers.map(ticker => (
                      <option key={ticker} value={ticker}>{ticker}</option>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel fontSize="sm">Status</FormLabel>
                  <Stack direction="row" spacing={2}>
                    <Badge 
                      colorScheme={filterStatus.includes('open') ? 'green' : 'gray'} 
                      px={2} py={1} 
                      borderRadius="md" 
                      cursor="pointer"
                      onClick={() => handleStatusFilterChange('open')}
                    >
                      Open
                    </Badge>
                    <Badge 
                      colorScheme={filterStatus.includes('closed') ? 'blue' : 'gray'} 
                      px={2} py={1} 
                      borderRadius="md" 
                      cursor="pointer"
                      onClick={() => handleStatusFilterChange('closed')}
                    >
                      Closed
                    </Badge>
                    <Badge 
                      colorScheme={filterStatus.includes('cancelled') ? 'red' : 'gray'} 
                      px={2} py={1} 
                      borderRadius="md" 
                      cursor="pointer"
                      onClick={() => handleStatusFilterChange('cancelled')}
                    >
                      Cancelled
                    </Badge>
                  </Stack>
                </FormControl>
                
                <FormControl>
                  <FormLabel fontSize="sm">Date Range</FormLabel>
                  <Stack direction={{ base: 'column', sm: 'row' }} spacing={2}>
                    <Input
                      type="date"
                      placeholder="Start Date"
                      size="sm"
                      value={formatDateForInput(filterDateRange[0])}
                      onChange={handleStartDateChange}
                    />
                    <Input
                      type="date"
                      placeholder="End Date"
                      size="sm"
                      value={formatDateForInput(filterDateRange[1])}
                      onChange={handleEndDateChange}
                    />
                  </Stack>
                </FormControl>
                
                <Divider />
                <Flex justify="flex-end">
                  <Button
                    size="sm"
                    px={3}
                    py={1}
                    borderRadius="md"
                    borderWidth="1px"
                    onClick={resetFilters}
                    variant="outline"
                    _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                  >
                    Reset Filters
                  </Button>
                </Flex>
              </VStack>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
      
      {sortedTrades.length === 0 ? (
        <Center 
          p={8} 
          borderWidth="1px" 
          borderRadius="md" 
          borderStyle="dashed"
          borderColor={borderColor}
        >
          <VStack spacing={3}>
            <Text fontSize="lg" color="gray.500">
              No trade history found
            </Text>
            <Text fontSize="sm" color="gray.400">
              Try adjusting your filters or add some trades
            </Text>
          </VStack>
        </Center>
      ) : (
        <VStack spacing={4} align="stretch">
          {sortedTrades.map((trade) => (
            <TradeHistoryEntry key={trade.id} trade={trade} />
          ))}
        </VStack>
      )}
    </Box>
  );
};

export default TradeHistoryPanel;