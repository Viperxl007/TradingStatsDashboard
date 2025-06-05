import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  HStack,
  VStack,
  Spacer,
  IconButton,
  useColorModeValue,
  Tooltip,
  Collapse,
  useDisclosure,
  Divider,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  useToast
} from '@chakra-ui/react';
import { ChevronDownIcon, InfoIcon, DeleteIcon } from '@chakra-ui/icons';
import { AnyTradeEntry, OptionTradeEntry } from '../../types/tradeTracker';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { formatDisplayDate } from '../../utils/dateUtils';

interface TradeHistoryEntryProps {
  trade: AnyTradeEntry;
}

/**
 * TradeHistoryEntry Component
 * 
 * This component displays a single trade history entry with detailed information.
 */
const TradeHistoryEntry: React.FC<TradeHistoryEntryProps> = ({ trade }) => {
  const { isOpen, onToggle } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { dispatch } = useData();
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.700');
  
  // Format currency
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return formatDisplayDate(dateString);
  };
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'green';
      case 'closed':
        return 'blue';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };
  
  // Get P&L color
  const getPnLColor = (pnl: number | undefined) => {
    if (pnl === undefined) return 'gray.500';
    return pnl >= 0 ? 'green.500' : 'red.500';
  };
  
  // Handle selecting the trade
  const handleSelectTrade = () => {
    dispatch({
      type: ActionType.SELECT_TRADE,
      payload: trade.id
    });
  };
  
  // Handle delete trade
  const handleDeleteTrade = async () => {
    try {
      setIsDeleting(true);
      
      // Dispatch delete start action
      dispatch({
        type: ActionType.DELETE_TRADE_START,
        payload: trade.id
      });
      
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Delete trade from database
      const success = await tradeTrackerDB.deleteTrade(trade.id);
      
      if (success) {
        // Dispatch delete success action
        dispatch({
          type: ActionType.DELETE_TRADE_SUCCESS,
          payload: trade.id
        });
        
        // Show success toast
        toast({
          title: 'Trade deleted',
          description: `Trade ${trade.ticker} has been removed`,
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
      // Dispatch delete error action
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
  
  // Check if trade is an option trade
  const isOptionTrade = (trade: AnyTradeEntry): trade is OptionTradeEntry => {
    return trade.strategy !== 'stock';
  };
  
  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      bg={bgColor}
      borderColor={borderColor}
      _hover={{ borderColor: 'brand.500' }}
      transition="all 0.2s"
    >
      <Flex
        p={4}
        alignItems="center"
        onClick={onToggle}
        cursor="pointer"
        _hover={{ bg: hoverBgColor }}
      >
        <VStack align="start" spacing={1}>
          <HStack>
            <Text fontWeight="bold" fontSize="lg">{trade.ticker}</Text>
            <Badge colorScheme={getStatusColor(trade.status)}>{trade.status}</Badge>
            <Badge variant="outline">{trade.strategy.replace('_', ' ')}</Badge>
            <Badge colorScheme={trade.direction === 'long' ? 'blue' : 'purple'}>
              {trade.direction}
            </Badge>
          </HStack>
          
          <Text fontSize="sm" color="gray.500">
            Entry: {formatDate(trade.entryDate)} | 
            {trade.exitDate ? ` Exit: ${formatDate(trade.exitDate)} |` : ''} 
            {trade.quantity} {trade.quantity === 1 ? 'unit' : 'units'}
          </Text>
        </VStack>
        
        <Spacer />
        
        <VStack align="end" spacing={1}>
          {trade.profitLoss !== undefined && (
            <Text fontWeight="bold" color={getPnLColor(trade.profitLoss)}>
              {formatCurrency(trade.profitLoss)}
            </Text>
          )}
          
          <HStack>
            <Text fontSize="sm" color="gray.500">
              Entry: {formatCurrency(trade.entryPrice)}
            </Text>
            {trade.exitPrice && (
              <Text fontSize="sm" color="gray.500">
                Exit: {formatCurrency(trade.exitPrice)}
              </Text>
            )}
          </HStack>
        </VStack>
        
        <Box ml={4}>
          <ChevronDownIcon
            transform={isOpen ? 'rotate(180deg)' : undefined}
            transition="transform 0.2s"
            w={6}
            h={6}
          />
        </Box>
      </Flex>
      
      <Collapse in={isOpen} animateOpacity>
        <Divider />
        <Box p={4}>
          <VStack align="stretch" spacing={3}>
            {/* Trade Details */}
            <Flex wrap="wrap" gap={4}>
              <Box minW="200px">
                <Text fontSize="sm" color="gray.500">Entry Date</Text>
                <Text>{formatDate(trade.entryDate)}</Text>
              </Box>
              
              <Box minW="200px">
                <Text fontSize="sm" color="gray.500">Entry Price</Text>
                <Text>{formatCurrency(trade.entryPrice)}</Text>
              </Box>
              
              {trade.exitDate && (
                <Box minW="200px">
                  <Text fontSize="sm" color="gray.500">Exit Date</Text>
                  <Text>{formatDate(trade.exitDate)}</Text>
                </Box>
              )}
              
              {trade.exitPrice !== undefined && (
                <Box minW="200px">
                  <Text fontSize="sm" color="gray.500">Exit Price</Text>
                  <Text>{formatCurrency(trade.exitPrice)}</Text>
                </Box>
              )}
              
              <Box minW="200px">
                <Text fontSize="sm" color="gray.500">Quantity</Text>
                <Text>{trade.quantity}</Text>
              </Box>
              
              {trade.profitLoss !== undefined && (
                <Box minW="200px">
                  <Text fontSize="sm" color="gray.500">Profit/Loss</Text>
                  <Text fontWeight="bold" color={getPnLColor(trade.profitLoss)}>
                    {formatCurrency(trade.profitLoss)}
                  </Text>
                </Box>
              )}
              
              {trade.fees > 0 && (
                <Box minW="200px">
                  <Text fontSize="sm" color="gray.500">Fees</Text>
                  <Text>{formatCurrency(trade.fees)}</Text>
                </Box>
              )}
            </Flex>
            
            {/* Option Legs (if applicable) */}
            {isOptionTrade(trade) && trade.legs.length > 0 && (
              <Box mt={2}>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Option Legs</Text>
                <VStack align="stretch" spacing={2}>
                  {trade.legs.map((leg, index) => (
                    <Box 
                      key={index} 
                      p={2} 
                      borderWidth="1px" 
                      borderRadius="md" 
                      borderColor={borderColor}
                    >
                      <Flex wrap="wrap" gap={3}>
                        <Badge colorScheme={leg.isLong ? 'blue' : 'purple'}>
                          {leg.isLong ? 'Long' : 'Short'}
                        </Badge>
                        <Badge colorScheme={leg.optionType === 'call' ? 'green' : 'red'}>
                          {leg.optionType.toUpperCase()}
                        </Badge>
                        <Text fontSize="sm">Strike: {formatCurrency(leg.strike)}</Text>
                        <Text fontSize="sm">Exp: {formatDate(leg.expiration)}</Text>
                        <Text fontSize="sm">Premium: {formatCurrency(leg.premium)}</Text>
                        <Text fontSize="sm">Qty: {leg.quantity}</Text>
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}
            
            {/* Notes */}
            {trade.notes && (
              <Box mt={2}>
                <Text fontSize="sm" fontWeight="medium" mb={1}>Notes</Text>
                <Text fontSize="sm">{trade.notes}</Text>
              </Box>
            )}
            
            {/* Tags */}
            {trade.tags.length > 0 && (
              <Box mt={2}>
                <Text fontSize="sm" fontWeight="medium" mb={1}>Tags</Text>
                <HStack spacing={2} mt={1}>
                  {trade.tags.map((tag, index) => (
                    <Badge key={index} colorScheme="brand" variant="subtle">
                      {tag}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            )}
            
            {/* Action Buttons */}
            <Flex justifyContent="flex-end" mt={2} gap={2}>
              <Tooltip label="Delete trade">
                <IconButton
                  aria-label="Delete trade"
                  icon={<DeleteIcon />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOpen();
                  }}
                />
              </Tooltip>
              <Tooltip label="View full trade details">
                <IconButton
                  aria-label="View trade details"
                  icon={<InfoIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={handleSelectTrade}
                />
              </Tooltip>
            </Flex>
          </VStack>
        </Box>
      </Collapse>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Trade
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this trade for {trade.ticker}? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteTrade}
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

export default TradeHistoryEntry;