import * as React from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  Select,
  HStack,
  Button,
  Text,
  Flex,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  MenuOptionGroup,
  MenuItemOption,
  Icon
} from '@chakra-ui/react';
import { FiFilter, FiChevronDown, FiCalendar } from 'react-icons/fi';
import { useData, updateFilters, resetFilters } from '../context/DataContext';
import { format } from 'date-fns';

const TokenFilter: React.FC = () => {
  const { state, dispatch } = useData();
  const { rawData, selectedTokens, dateRange, tradeType } = state;
  
  // Get unique tokens from raw data
  const uniqueTokens = [...new Set(rawData.map(trade => trade.token))].sort();
  
  // Handle token selection
  const handleTokenSelect = (token: string) => {
    const newSelectedTokens = selectedTokens.includes(token)
      ? selectedTokens.filter(t => t !== token)
      : [...selectedTokens, token];
    
    dispatch(updateFilters({ selectedTokens: newSelectedTokens }));
  };
  
  // Handle trade type selection
  const handleTradeTypeSelect = (type: 'all' | 'buy' | 'sell') => {
    dispatch(updateFilters({ tradeType: type }));
  };
  
  // Handle reset filters
  const handleResetFilters = () => {
    dispatch(resetFilters());
  };
  
  // Colors
  const tagBg = useColorModeValue('brand.50', 'brand.900');
  const tagColor = useColorModeValue('brand.800', 'brand.100');
  
  return (
    <Box>
      <HStack spacing={4} mb={4} wrap="wrap">
        {/* Token filter */}
        <Menu closeOnSelect={false}>
          <MenuButton 
            as={Button} 
            rightIcon={<Icon as={FiChevronDown} />}
            leftIcon={<Icon as={FiFilter} />}
            variant="outline"
          >
            Tokens {selectedTokens.length > 0 && `(${selectedTokens.length})`}
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto">
            <MenuOptionGroup title="Select Tokens" type="checkbox">
              {uniqueTokens.map(token => (
                <MenuItemOption 
                  key={token} 
                  value={token}
                  isChecked={selectedTokens.includes(token)}
                  onClick={() => handleTokenSelect(token)}
                >
                  {token}
                </MenuItemOption>
              ))}
            </MenuOptionGroup>
          </MenuList>
        </Menu>
        
        {/* Date range filter - placeholder for now */}
        <Button 
          leftIcon={<Icon as={FiCalendar} />} 
          variant="outline"
        >
          Date Range
        </Button>
        
        {/* Trade type filter */}
        <Menu>
          <MenuButton 
            as={Button} 
            rightIcon={<Icon as={FiChevronDown} />}
            variant="outline"
          >
            {tradeType === 'all' ? 'All Types' : tradeType === 'buy' ? 'Buy Only' : 'Sell Only'}
          </MenuButton>
          <MenuList>
            <MenuItem onClick={() => handleTradeTypeSelect('all')}>
              All Types
            </MenuItem>
            <MenuItem onClick={() => handleTradeTypeSelect('buy')}>
              Buy Only
            </MenuItem>
            <MenuItem onClick={() => handleTradeTypeSelect('sell')}>
              Sell Only
            </MenuItem>
          </MenuList>
        </Menu>
        
        {/* Reset filters */}
        {(selectedTokens.length > 0 || tradeType !== 'all' || dateRange[0] !== null) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleResetFilters}
          >
            Reset Filters
          </Button>
        )}
      </HStack>
      
      {/* Selected token tags */}
      {selectedTokens.length > 0 && (
        <Wrap spacing={2} mb={4}>
          {selectedTokens.map(token => (
            <WrapItem key={token}>
              <Tag 
                size="md" 
                borderRadius="full" 
                variant="solid" 
                bg={tagBg} 
                color={tagColor}
              >
                <TagLabel>{token}</TagLabel>
                <TagCloseButton onClick={() => handleTokenSelect(token)} />
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
      )}
    </Box>
  );
};

export default TokenFilter;