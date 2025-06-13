import React, { useState } from 'react';
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
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from '@chakra-ui/react';
import { SearchIcon, ChevronDownIcon, SettingsIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { AnyTradeEntry } from '../../types/tradeTracker';
import TradeIdeaCard from './TradeIdeaCard';

/**
 * TradeIdeasPanel Component
 * 
 * This component displays a list of trade ideas with filtering and sorting options.
 */
const TradeIdeasPanel: React.FC = () => {
  const { state } = useData();
  const { tradeTrackerData } = state;
  const { filteredTrades } = tradeTrackerData;
  
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isCompactView, setIsCompactView] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Filter trade ideas (status === 'open' and no entry yet)
  const tradeIdeas = filteredTrades.filter(trade => 
    trade.status === 'open' && !trade.entryPrice
  );
  
  // Apply search filter
  const filteredIdeas = tradeIdeas.filter(idea => {
    if (!searchText) return true;
    
    const searchLower = searchText.toLowerCase();
    return (
      idea.ticker.toLowerCase().includes(searchLower) ||
      idea.notes.toLowerCase().includes(searchLower) ||
      idea.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });
  
  // Function to check if earnings have passed
  const hasEarningsPassed = (tradeIdea: AnyTradeEntry) => {
    const metadata = tradeIdea.metadata;
    if (!metadata?.earningsDate) return false;
    
    const earningsTime = metadata.earningsTime; // 'BMO' or 'AMC'
    
    // Get current time in Eastern Time
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    // Parse earnings date in local context (should be YYYY-MM-DD format)
    const [year, month, day] = metadata.earningsDate.split('-').map(Number);
    const earningsDate = new Date(year, month - 1, day); // month is 0-indexed
    
    // Get today's date in Eastern Time
    const todayEastern = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate());
    const earningsDateOnly = new Date(earningsDate.getFullYear(), earningsDate.getMonth(), earningsDate.getDate());
    
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
  
  // Separate active and expired earnings trade ideas
  const activeIdeas = filteredIdeas.filter(idea => !hasEarningsPassed(idea));
  const expiredIdeas = filteredIdeas.filter(idea => hasEarningsPassed(idea));
  
  // Sort both groups
  const sortIdeas = (ideas: AnyTradeEntry[]) => {
    return [...ideas].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          // Sort by earnings date if available, otherwise fall back to entry date
          const aEarningsDate = a.metadata?.earningsDate;
          const bEarningsDate = b.metadata?.earningsDate;
          
          if (aEarningsDate && bEarningsDate) {
            comparison = new Date(aEarningsDate).getTime() - new Date(bEarningsDate).getTime();
          } else if (aEarningsDate && !bEarningsDate) {
            comparison = -1; // Ideas with earnings dates come first
          } else if (!aEarningsDate && bEarningsDate) {
            comparison = 1; // Ideas with earnings dates come first
          } else {
            // Both don't have earnings dates, sort by entry date
            comparison = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
          }
          break;
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'strategy':
          comparison = a.strategy.localeCompare(b.strategy);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };
  
  const sortedActiveIdeas = sortIdeas(activeIdeas);
  const sortedExpiredIdeas = sortIdeas(expiredIdeas);
  
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
  
  // Toggle compact view
  const toggleCompactView = () => {
    setIsCompactView(!isCompactView);
  };
  
  return (
    <Box>
      <Flex mb={4} direction={{ base: 'column', md: 'row' }} gap={4}>
        <InputGroup maxW={{ base: '100%', md: '300px' }}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search trade ideas..."
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
            <option value="date">Earnings Date</option>
            <option value="ticker">Ticker</option>
            <option value="strategy">Strategy</option>
          </Select>
          
          <IconButton
            aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
            icon={<ChevronDownIcon transform={sortOrder === 'asc' ? 'rotate(180deg)' : undefined} />}
            onClick={toggleSortOrder}
            variant="outline"
          />
          
          <IconButton
            aria-label={isCompactView ? 'Show detailed view' : 'Show compact view'}
            icon={isCompactView ? <ViewIcon /> : <ViewOffIcon />}
            onClick={toggleCompactView}
            variant="outline"
            colorScheme={isCompactView ? 'orange' : 'gray'}
          />
          
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="Filter options"
              icon={<SettingsIcon />}
              variant="outline"
            />
            <MenuList>
              <MenuItem>Show All</MenuItem>
              <MenuItem>Show Recent Only</MenuItem>
              <MenuItem>Show High Priority</MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
      
      {sortedActiveIdeas.length === 0 && sortedExpiredIdeas.length === 0 ? (
        <Center
          p={8}
          borderWidth="1px"
          borderRadius="md"
          borderStyle="dashed"
          borderColor={borderColor}
        >
          <VStack spacing={3}>
            <Text fontSize="lg" color="gray.500">
              No trade ideas found
            </Text>
            <Button colorScheme="brand" size="sm">
              Add Your First Trade Idea
            </Button>
          </VStack>
        </Center>
      ) : (
        <VStack spacing={6} align="stretch">
          {/* Active Trade Ideas */}
          {sortedActiveIdeas.length > 0 && (
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={4} color="green.500">
                📈 Active Trade Ideas ({sortedActiveIdeas.length})
              </Text>
              <VStack spacing={4} align="stretch">
                {sortedActiveIdeas.map((idea) => (
                  <TradeIdeaCard key={idea.id} tradeIdea={idea} isCompactView={isCompactView} />
                ))}
              </VStack>
            </Box>
          )}
          
          {/* Expired Earnings Trade Ideas */}
          {sortedExpiredIdeas.length > 0 && (
            <Box opacity={0.6}>
              <Text fontSize="lg" fontWeight="bold" mb={4} color="orange.500">
                📅 Earnings Over ({sortedExpiredIdeas.length})
              </Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                These trade ideas have passed their earnings announcement. Consider removing them to keep your list organized.
              </Text>
              <VStack spacing={4} align="stretch">
                {sortedExpiredIdeas.map((idea) => (
                  <TradeIdeaCard key={idea.id} tradeIdea={idea} isCompactView={isCompactView} />
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
};

export default TradeIdeasPanel;