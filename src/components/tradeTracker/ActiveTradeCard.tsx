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
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button
} from '@chakra-ui/react';
import {
  ChevronRightIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  InfoIcon,
  CloseIcon,
  AddIcon
} from '@chakra-ui/icons';
import { AnyTradeEntry, StrategyType } from '../../types/tradeTracker';
import TradeDetailsModal from './TradeDetailsModal';
import CloseTradeModal from './CloseTradeModal';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { daysBetween, formatDisplayDate } from '../../utils/dateUtils';

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

interface ActiveTradeCardProps {
  trade: AnyTradeEntry;
}

/**
 * ActiveTradeCard Component
 * 
 * This component displays a single active trade in a card format.
 */
const ActiveTradeCard: React.FC<ActiveTradeCardProps> = ({ trade }) => {
  const {
    id,
    ticker,
    strategy,
    direction,
    notes,
    tags,
    entryDate,
    entryPrice,
    quantity,
    stopLoss,
    takeProfit
  } = trade;
  
  const detailsModal = useDisclosure();
  const closeTradeModal = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const toast = useToast();
  const { dispatch } = useData();
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const statBgColor = useColorModeValue('gray.50', 'gray.700');
  
  // Format date for display
  // Format date for display
  const formatDate = (dateString: string) => {
    return formatDisplayDate(dateString);
  };

  // Calculate days in trade
  const daysInTrade = () => {
    return daysBetween(entryDate);
  };

  // Handle delete trade
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
          title: 'Trade deleted',
          description: `${ticker} trade has been removed`,
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
        throw new Error('Trade not found');
      }
      
      onDeleteClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.DELETE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to delete trade'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to delete trade',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Calculate current P&L (this would be more sophisticated in a real app)
  const calculatePnL = () => {
    // This is a placeholder. In a real app, you would:
    // 1. Get the current price from an API
    // 2. Calculate P&L based on position type, entry price, and current price
    // For now, we'll just use a random value for demonstration
    const randomPnL = (Math.random() * 2 - 1) * entryPrice * quantity * 0.1;
    return randomPnL;
  };
  
  const currentPnL = calculatePnL();
  const pnlPercentage = (currentPnL / (entryPrice * quantity)) * 100;
  
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
      <Flex p={4} direction={{ base: 'column', md: 'row' }} alignItems="flex-start">
        <VStack align="flex-start" flex="1" spacing={2} mr={{ base: 0, md: 4 }} mb={{ base: 4, md: 0 }}>
          <Flex width="100%" justifyContent="space-between" alignItems="center">
            <HStack>
              <Text fontSize="xl" fontWeight="bold" color={textColor}>
                {ticker}
              </Text>
              <Badge colorScheme={direction === 'long' ? 'green' : 'red'} ml={2}>
                {direction === 'long' ? 'LONG' : 'SHORT'}
              </Badge>
            </HStack>
            
            <Menu>
              <MenuButton
                as={IconButton}
                aria-label="Options"
                icon={<ChevronRightIcon />}
                variant="ghost"
                size="sm"
              />
              <MenuList>
                <MenuItem icon={<EditIcon />} onClick={detailsModal.onOpen}>Edit Trade</MenuItem>
                <MenuItem icon={<AddIcon />}>Add Adjustment</MenuItem>
                <MenuItem icon={<CloseIcon />} onClick={closeTradeModal.onOpen}>Close Trade</MenuItem>
                <MenuItem icon={<DeleteIcon />} color="red.500" onClick={onDeleteOpen}>Delete</MenuItem>
              </MenuList>
            </Menu>
          </Flex>
          
          <Badge colorScheme={strategyColors[strategy]}>
            {strategyNames[strategy]}
          </Badge>
          
          <HStack spacing={4} mt={1}>
            <Tooltip label="Entry Date" placement="top">
              <HStack>
                <InfoIcon boxSize={3} color="gray.500" />
                <Text fontSize="sm" color={mutedColor}>
                  {formatDate(entryDate)}
                </Text>
              </HStack>
            </Tooltip>
            
            <Tooltip label="Days in Trade" placement="top">
              <HStack>
                <InfoIcon boxSize={3} color="gray.500" />
                <Text fontSize="sm" color={mutedColor}>
                  {daysInTrade()} days
                </Text>
              </HStack>
            </Tooltip>
          </HStack>
          
          <Text fontSize="sm" color={mutedColor} noOfLines={2}>
            {notes || 'No notes provided'}
          </Text>
          
          {tags.length > 0 && (
            <HStack spacing={2} mt={1} flexWrap="wrap">
              {tags.map((tag, index) => (
                <Tag size="sm" key={index} colorScheme="gray" borderRadius="full">
                  <TagLabel>{tag}</TagLabel>
                </Tag>
              ))}
            </HStack>
          )}
        </VStack>
        
        <VStack
          align="stretch"
          spacing={2}
          minW={{ base: '100%', md: '200px' }}
          borderTop={{ base: '1px solid', md: 'none' }}
          borderColor={{ base: borderColor, md: 'transparent' }}
          pt={{ base: 3, md: 0 }}
        >
          <Stat
            bg={statBgColor}
            p={2}
            borderRadius="md"
            size="sm"
          >
            <StatLabel fontSize="xs">Current P&L</StatLabel>
            <StatNumber fontSize="md" color={currentPnL >= 0 ? 'green.500' : 'red.500'}>
              ${currentPnL.toFixed(2)}
            </StatNumber>
            <StatHelpText mb={0}>
              <StatArrow type={currentPnL >= 0 ? 'increase' : 'decrease'} />
              {Math.abs(pnlPercentage).toFixed(2)}%
            </StatHelpText>
          </Stat>
          
          <HStack justify="space-between" fontSize="sm">
            <Text fontWeight="medium">Entry:</Text>
            <Text>${entryPrice.toFixed(2)}</Text>
          </HStack>
          
          <HStack justify="space-between" fontSize="sm">
            <Text fontWeight="medium">Quantity:</Text>
            <Text>{quantity}</Text>
          </HStack>
          
          {stopLoss && (
            <HStack justify="space-between" fontSize="sm">
              <Text fontWeight="medium">Stop Loss:</Text>
              <Text color="red.500">${stopLoss.toFixed(2)}</Text>
            </HStack>
          )}
          
          {takeProfit && (
            <HStack justify="space-between" fontSize="sm">
              <Text fontWeight="medium">Take Profit:</Text>
              <Text color="green.500">${takeProfit.toFixed(2)}</Text>
            </HStack>
          )}
          
          <HStack mt={2} justify="flex-end">
            <IconButton
              aria-label="Edit trade"
              icon={<EditIcon />}
              size="sm"
              variant="ghost"
              onClick={detailsModal.onOpen}
            />
            <IconButton
              aria-label="Close trade"
              icon={<CloseIcon />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={closeTradeModal.onOpen}
            />
          </HStack>
        </VStack>
      </Flex>
      
      {/* Trade Details Modal */}
      <TradeDetailsModal 
        isOpen={detailsModal.isOpen} 
        onClose={detailsModal.onClose} 
        trade={trade} 
      />
      
      {/* Close Trade Modal */}
      <CloseTradeModal
        isOpen={closeTradeModal.isOpen}
        onClose={closeTradeModal.onClose}
        trade={trade}
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
              Delete Active Trade
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this active trade for {ticker}? This action cannot be undone.
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
                Delete Trade
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ActiveTradeCard;