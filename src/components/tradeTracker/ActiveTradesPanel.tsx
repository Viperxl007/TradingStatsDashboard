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
  IconButton,
  Badge,
  useToast,
  Spinner
} from '@chakra-ui/react';
import { SearchIcon, ChevronDownIcon, SettingsIcon, AddIcon, RepeatIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { AnyTradeEntry, OptionTradeEntry, OptionLeg } from '../../types/tradeTracker';
import { ActionType } from '../../context/DataContext';
import ActiveTradeCard from './ActiveTradeCard';
import ConvertToTradeModal from './ConvertToTradeModal';
import { useDisclosure } from '@chakra-ui/react';

/**
 * ActiveTradesPanel Component
 * 
 * This component displays a list of active trades with filtering and sorting options.
 */
const ActiveTradesPanel: React.FC = () => {
  const { state, dispatch } = useData();
  const { tradeTrackerData } = state;
  const { filteredTrades } = tradeTrackerData;
  
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTradeIdea, setSelectedTradeIdea] = useState<AnyTradeEntry | null>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Filter active trades (status === 'open' and has entryPrice)
  const activeTrades = filteredTrades.filter(trade => 
    trade.status === 'open' && trade.entryPrice > 0
  );
  
  // Get trade ideas that can be converted to active trades
  const tradeIdeas = filteredTrades.filter(trade => 
    trade.status === 'open' && !trade.entryPrice
  );
  
  // Apply search filter
  const filteredActiveTrades = activeTrades.filter(trade => {
    if (!searchText) return true;
    
    const searchLower = searchText.toLowerCase();
    return (
      trade.ticker.toLowerCase().includes(searchLower) ||
      trade.notes.toLowerCase().includes(searchLower) ||
      trade.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });
  
  // Sort trades
  const sortedTrades = [...filteredActiveTrades].sort((a, b) => {
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
        // Calculate current P&L if available
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
  
  // Handle convert trade idea to active trade
  const handleConvertTradeIdea = (tradeIdea: AnyTradeEntry) => {
    setSelectedTradeIdea(tradeIdea);
    onOpen();
  };
  
  // Fetch all prices for active trades
  const fetchAllPrices = async () => {
    const optionTrades = activeTrades.filter(trade =>
      'legs' in trade && trade.legs && trade.legs.length > 0
    ) as OptionTradeEntry[];
    
    if (optionTrades.length === 0) {
      toast({
        title: 'No option trades found',
        description: 'There are no active option trades to update prices for',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsFetchingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Process trades sequentially to avoid overwhelming the API
      for (const trade of optionTrades) {
        try {
          // Prepare contract specifications for the dedicated API
          const contracts = trade.legs.map((leg: OptionLeg) => ({
            optionType: leg.optionType,
            strike: leg.strike,
            expiration: leg.expiration,
            quantity: leg.quantity,
            isLong: leg.isLong
          }));

          // Call the dedicated option price fetching endpoint
          const response = await fetch(`http://localhost:5000/api/fetch-option-prices/${trade.ticker}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contracts: contracts
            })
          });
          
          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }
          
          const priceData = await response.json();
          
          if (!priceData.success) {
            throw new Error(priceData.error || 'Failed to fetch option prices');
          }
          
          // Extract prices from the response
          const newPrices: {[key: string]: number} = priceData.prices || {};
          
          if (Object.keys(newPrices).length > 0) {
            // Update the trade in the database with current prices
            const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
            
            // Create updated trade with current prices stored in metadata
            const updatedTrade = {
              ...trade,
              metadata: {
                ...trade.metadata,
                currentLegPrices: newPrices,
                lastPriceFetch: new Date().toISOString(),
                priceUpdateHistory: [
                  ...(trade.metadata?.priceUpdateHistory || []),
                  {
                    timestamp: new Date().toISOString(),
                    prices: newPrices
                  }
                ].slice(-10) // Keep only last 10 price updates
              },
              updatedAt: Date.now()
            };
            
            // Update in database
            await tradeTrackerDB.updateTrade(updatedTrade);
            
            // Dispatch update to context for immediate UI update
            dispatch({
              type: ActionType.UPDATE_TRADE_SUCCESS,
              payload: updatedTrade
            });
            
            successCount++;
          }
          
          // Add a small delay between requests to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`Error fetching prices for ${trade.ticker}:`, error);
          errorCount++;
        }
      }
      
      // Show summary toast
      if (successCount > 0) {
        toast({
          title: 'Bulk price update completed',
          description: `Updated prices for ${successCount} trades${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
          status: successCount === optionTrades.length ? 'success' : 'warning',
          duration: 4000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Price update failed',
          description: 'Could not update prices for any trades',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
      
    } catch (error) {
      console.error('Error in bulk price fetch:', error);
      toast({
        title: 'Bulk update failed',
        description: 'An error occurred during the bulk price update',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsFetchingAll(false);
    }
  };
  
  return (
    <Box>
      <Flex mb={4} direction={{ base: 'column', md: 'row' }} gap={4}>
        <InputGroup maxW={{ base: '100%', md: '300px' }}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search active trades..."
            value={searchText}
            onChange={handleSearchChange}
            borderRadius="md"
          />
        </InputGroup>
        
        <Spacer />
        
        <HStack spacing={2}>
          {/* Fetch All Button */}
          {activeTrades.length > 0 && (
            <Button
              leftIcon={isFetchingAll ? <Spinner size="xs" /> : <RepeatIcon />}
              size="sm"
              colorScheme="green"
              variant="outline"
              onClick={fetchAllPrices}
              isLoading={isFetchingAll}
              loadingText="Updating..."
              isDisabled={isFetchingAll}
            >
              Fetch All
            </Button>
          )}
          
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
          
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="Filter options"
              icon={<SettingsIcon />}
              variant="outline"
            />
            <MenuList>
              <MenuItem>Show All</MenuItem>
              <MenuItem>Show Profitable Only</MenuItem>
              <MenuItem>Show Losing Only</MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
      
      {tradeIdeas.length > 0 && (
        <Flex 
          p={3} 
          mb={4} 
          borderWidth="1px" 
          borderRadius="md" 
          borderStyle="dashed"
          borderColor={borderColor}
          bg={useColorModeValue('gray.50', 'gray.700')}
          alignItems="center"
        >
          <Text fontSize="sm" fontWeight="medium">
            You have <Badge colorScheme="brand">{tradeIdeas.length}</Badge> trade ideas that can be converted to active trades
          </Text>
          <Spacer />
          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              leftIcon={<AddIcon />}
              colorScheme="brand"
              variant="outline"
            >
              Convert Idea
            </MenuButton>
            <MenuList>
              {tradeIdeas.map(idea => (
                <MenuItem key={idea.id} onClick={() => handleConvertTradeIdea(idea)}>
                  {idea.ticker} - {idea.strategy}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
        </Flex>
      )}
      
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
              No active trades found
            </Text>
            {tradeIdeas.length > 0 ? (
              <Button 
                colorScheme="brand" 
                size="sm" 
                leftIcon={<AddIcon />}
                onClick={() => handleConvertTradeIdea(tradeIdeas[0])}
              >
                Convert Trade Idea to Active Trade
              </Button>
            ) : (
              <Button colorScheme="brand" size="sm" leftIcon={<AddIcon />}>
                Add Your First Trade
              </Button>
            )}
          </VStack>
        </Center>
      ) : (
        <VStack spacing={4} align="stretch">
          {sortedTrades.map((trade) => (
            <ActiveTradeCard key={trade.id} trade={trade} />
          ))}
        </VStack>
      )}
      
      {/* Convert to Trade Modal */}
      {selectedTradeIdea && (
        <ConvertToTradeModal 
          isOpen={isOpen} 
          onClose={() => {
            onClose();
            setSelectedTradeIdea(null);
          }} 
          tradeIdea={selectedTradeIdea}
        />
      )}
    </Box>
  );
};

export default ActiveTradesPanel;