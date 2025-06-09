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
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Spinner
} from '@chakra-ui/react';
import {
  ChevronRightIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  InfoIcon,
  CloseIcon,
  AddIcon,
  RepeatIcon
} from '@chakra-ui/icons';
import { AnyTradeEntry, StrategyType, OptionLeg } from '../../types/tradeTracker';
import TradeDetailsModal from './TradeDetailsModal';
import CloseTradeModal from './CloseTradeModal';
import ExpirationOutcomeModal from './ExpirationOutcomeModal';
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
  
  // Function to determine spread type for calendar spreads
  const getSpreadType = () => {
    if (strategy === 'calendar_spread' && 'legs' in trade && trade.legs && trade.legs.length > 0) {
      // For calendar spreads, show the option type (CALL or PUT)
      const firstLeg = trade.legs[0];
      return firstLeg.optionType.toUpperCase();
    }
    // For other strategies, show direction
    return direction === 'long' ? 'LONG' : 'SHORT';
  };
  
  const spreadType = getSpreadType();
  
  const detailsModal = useDisclosure();
  const closeTradeModal = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isExpirationModalOpen, onOpen: onExpirationModalOpen, onClose: onExpirationModalClose } = useDisclosure();
  const toast = useToast();
  const { dispatch } = useData();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [lastPriceFetch, setLastPriceFetch] = useState<Date | null>(
    trade.metadata?.lastPriceFetch ? new Date(trade.metadata.lastPriceFetch) : null
  );
  const [currentLegPrices, setCurrentLegPrices] = useState<{[key: string]: number}>(
    trade.metadata?.currentLegPrices || {}
  );
  const [expiredLegNeedingOutcome, setExpiredLegNeedingOutcome] = useState<OptionLeg | null>(null);
  
  // Sync local state with trade prop changes (for "Fetch All" updates)
  React.useEffect(() => {
    if (trade.metadata?.currentLegPrices) {
      setCurrentLegPrices(trade.metadata.currentLegPrices);
    }
    if (trade.metadata?.lastPriceFetch) {
      setLastPriceFetch(new Date(trade.metadata.lastPriceFetch));
    }
  }, [trade.metadata?.currentLegPrices, trade.metadata?.lastPriceFetch]);
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
  
  // Fetch latest option prices from dedicated API endpoint
  const fetchLatestPrices = async () => {
    if (!('legs' in trade) || !trade.legs || trade.legs.length === 0) {
      toast({
        title: 'No option legs found',
        description: 'This trade does not have option legs to fetch prices for',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsFetchingPrices(true);
    try {
      // Check for expired legs that need outcome logging
      const currentDate = new Date();
      const expiredLegsNeedingOutcome = trade.legs.filter((leg: OptionLeg) => {
        const expirationDate = new Date(leg.expiration);
        const isExpired = expirationDate < currentDate;
        const hasOutcome = leg.expirationOutcome !== undefined;
        return isExpired && !hasOutcome;
      });

      // If there are expired legs needing outcomes, prompt for the first one
      if (expiredLegsNeedingOutcome.length > 0) {
        setExpiredLegNeedingOutcome(expiredLegsNeedingOutcome[0]);
        onExpirationModalOpen();
        setIsFetchingPrices(false);
        return;
      }

      // Prepare contract specifications for the dedicated API
      const contracts = trade.legs.map(leg => ({
        optionType: leg.optionType,
        strike: leg.strike,
        expiration: leg.expiration,
        quantity: leg.quantity,
        isLong: leg.isLong
      }));

      // Call the dedicated option price fetching endpoint
      const response = await fetch(`http://localhost:5000/api/fetch-option-prices/${ticker}`, {
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
      
      // Validate that we got prices for all legs
      const expectedLegs = trade.legs.length;
      const receivedPrices = Object.keys(newPrices).length;
      
      if (receivedPrices === 0) {
        throw new Error('No option prices were retrieved');
      }
      
      setCurrentLegPrices(newPrices);
      setLastPriceFetch(new Date());
      
      // Update the trade in the database with current prices
      try {
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
        
        const updatedLegs = Object.keys(newPrices).filter(key => {
          const legIndex = parseInt(key.split('_')[1]);
          return newPrices[key] !== trade.legs[legIndex].premium;
        });
        
        let toastDescription = `Fetched live option prices for ${ticker}`;
        if (priceData.errors && priceData.errors.length > 0) {
          toastDescription += ` (${updatedLegs.length} legs updated, ${priceData.errors.length} warnings)`;
        } else {
          toastDescription += ` (${updatedLegs.length} legs updated)`;
        }
        
        toast({
          title: 'Real-time prices updated & saved',
          description: toastDescription,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (dbError) {
        console.error('Error saving price update to database:', dbError);
        
        const updatedLegs = Object.keys(newPrices).filter(key => {
          const legIndex = parseInt(key.split('_')[1]);
          return newPrices[key] !== trade.legs[legIndex].premium;
        });
        
        toast({
          title: 'Prices updated (save failed)',
          description: `Fetched live prices for ${ticker} but failed to save to database`,
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error fetching option prices:', error);
      toast({
        title: 'Failed to fetch prices',
        description: error instanceof Error ? error.message : 'Could not retrieve latest option prices',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsFetchingPrices(false);
    }
  };

  // Handle expiration outcome logging
  const handleExpirationOutcome = async (outcome: { priceAtExpiration: number; wasForced: boolean }) => {
    if (!expiredLegNeedingOutcome || !('legs' in trade)) return;

    try {
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Find the leg index
      const legIndex = trade.legs.findIndex((leg: OptionLeg) =>
        leg.optionType === expiredLegNeedingOutcome.optionType &&
        leg.strike === expiredLegNeedingOutcome.strike &&
        leg.expiration === expiredLegNeedingOutcome.expiration
      );

      if (legIndex === -1) {
        throw new Error('Could not find the expired leg in the trade');
      }

      // Update the leg with expiration outcome
      const updatedLegs = [...trade.legs];
      updatedLegs[legIndex] = {
        ...updatedLegs[legIndex],
        expirationOutcome: {
          priceAtExpiration: outcome.priceAtExpiration,
          loggedAt: Date.now(),
          wasForced: outcome.wasForced
        }
      };

      // Create updated trade
      const updatedTrade = {
        ...trade,
        legs: updatedLegs,
        updatedAt: Date.now()
      } as AnyTradeEntry;

      // Update in database
      await tradeTrackerDB.updateTrade(updatedTrade);
      
      // Dispatch update to context
      dispatch({
        type: ActionType.UPDATE_TRADE_SUCCESS,
        payload: updatedTrade
      });

      // Clear the expired leg state
      setExpiredLegNeedingOutcome(null);

      // Check if there are more expired legs needing outcomes
      const remainingExpiredLegs = updatedLegs.filter((leg: OptionLeg) => {
        const expirationDate = new Date(leg.expiration);
        const isExpired = expirationDate < new Date();
        const hasOutcome = leg.expirationOutcome !== undefined;
        return isExpired && !hasOutcome;
      });

      // If there are more, prompt for the next one
      if (remainingExpiredLegs.length > 0) {
        setTimeout(() => {
          setExpiredLegNeedingOutcome(remainingExpiredLegs[0]);
          onExpirationModalOpen();
        }, 500); // Small delay to let the modal close first
      }

    } catch (error) {
      console.error('Error logging expiration outcome:', error);
      toast({
        title: 'Error',
        description: 'Failed to log expiration outcome',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Calculate real spread P&L based on current vs entry prices
  const calculateSpreadPnL = () => {
    if (!('legs' in trade) || !trade.legs || trade.legs.length === 0) {
      return { pnl: 0, percentage: 0 };
    }

    let totalEntryValue = 0;
    let totalCurrentValue = 0;

    trade.legs.forEach((leg: OptionLeg, index: number) => {
      const legKey = `leg_${index}`;
      
      // Check if leg has expired and has an outcome logged
      const currentDate = new Date();
      const expirationDate = new Date(leg.expiration);
      const isExpired = expirationDate < currentDate;
      const hasExpirationOutcome = leg.expirationOutcome !== undefined;
      
      let currentPrice: number;
      
      if (isExpired && hasExpirationOutcome) {
        // Use the logged expiration outcome price
        currentPrice = leg.expirationOutcome!.priceAtExpiration;
      } else {
        // Use current market price or entry price as fallback
        currentPrice = currentLegPrices[legKey] || leg.premium;
      }
      
      // Calculate leg value (premium * quantity * multiplier)
      const legMultiplier = leg.isLong ? 1 : -1;
      const entryValue = leg.premium * leg.quantity * legMultiplier * 100; // $100 per contract
      const currentValue = currentPrice * leg.quantity * legMultiplier * 100;
      
      totalEntryValue += entryValue;
      totalCurrentValue += currentValue;
    });

    const pnl = totalCurrentValue - totalEntryValue;
    const percentage = totalEntryValue !== 0 ? (pnl / Math.abs(totalEntryValue)) * 100 : 0;

    return { pnl, percentage };
  };

  const { pnl: currentPnL, percentage: pnlPercentage } = calculateSpreadPnL();
  
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
      {/* Header Section */}
      <Flex p={4} justifyContent="space-between" alignItems="center" borderBottom="1px" borderColor={borderColor}>
        <HStack spacing={4}>
          <VStack align="flex-start" spacing={1}>
            <HStack>
              <Text fontSize="xl" fontWeight="bold" color={textColor}>
                {ticker}
              </Text>
              <Badge colorScheme={spreadType === 'CALL' ? 'green' : spreadType === 'PUT' ? 'red' : direction === 'long' ? 'green' : 'red'}>
                {spreadType}
              </Badge>
              <Badge colorScheme={strategyColors[strategy]} variant="outline">
                {strategyNames[strategy]}
              </Badge>
            </HStack>
            <HStack spacing={4} fontSize="sm" color={mutedColor}>
              <Text>Entry: {formatDate(entryDate)}</Text>
              <Text>{daysInTrade()} days</Text>
              {/* Display IV/RV and TS Slope for calendar spreads */}
              {strategy === 'calendar_spread' && trade.metadata && (
                <>
                  {trade.metadata.ivRvRatioAtEntry && (
                    <Text>
                      IV/RV: <Text as="span" fontWeight="medium" color={trade.metadata.ivRvRatioAtEntry > 1.2 ? 'green.500' : 'orange.500'}>
                        {trade.metadata.ivRvRatioAtEntry.toFixed(2)}
                      </Text>
                    </Text>
                  )}
                  {trade.metadata.tsSlopeAtEntry && (
                    <Text>
                      TS: <Text as="span" fontWeight="medium" color={Math.abs(trade.metadata.tsSlopeAtEntry) > 0.02 ? 'green.500' : 'orange.500'}>
                        {trade.metadata.tsSlopeAtEntry.toFixed(3)}
                      </Text>
                    </Text>
                  )}
                </>
              )}
              {lastPriceFetch && (
                <Text>
                  Last updated: {lastPriceFetch.toLocaleTimeString()}
                </Text>
              )}
            </HStack>
          </VStack>
        </HStack>

        <HStack spacing={3}>
          {/* Real-time P&L Display */}
          <VStack align="end" spacing={0}>
            <Text fontSize="lg" fontWeight="bold" color={currentPnL >= 0 ? 'green.500' : 'red.500'}>
              ${currentPnL.toFixed(2)}
            </Text>
            <HStack spacing={1}>
              <Text fontSize="sm" color={currentPnL >= 0 ? 'green.500' : 'red.500'}>
                {currentPnL >= 0 ? '▲' : '▼'} {Math.abs(pnlPercentage).toFixed(2)}%
              </Text>
            </HStack>
          </VStack>

          {/* Fetch Prices Button */}
          <Button
            leftIcon={isFetchingPrices ? <Spinner size="xs" /> : <RepeatIcon />}
            size="sm"
            colorScheme="blue"
            variant="outline"
            onClick={fetchLatestPrices}
            isLoading={isFetchingPrices}
            loadingText="Fetching..."
          >
            Fetch Latest
          </Button>

          {/* Actions Menu */}
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
        </HStack>
      </Flex>

      {/* Option Legs Table */}
      {('legs' in trade) && trade.legs && trade.legs.length > 0 && (
        <TableContainer>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Leg</Th>
                <Th>Type</Th>
                <Th>Position</Th>
                <Th>Strike</Th>
                <Th>Expiration</Th>
                <Th>Qty</Th>
                <Th>Entry Premium</Th>
                <Th>Current Premium</Th>
                <Th>Leg P&L</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {trade.legs.map((leg: OptionLeg, index: number) => {
                const legKey = `leg_${index}`;
                
                // Check if leg has expired and has an outcome logged
                const currentDate = new Date();
                const expirationDate = new Date(leg.expiration);
                const isExpired = expirationDate < currentDate;
                const hasExpirationOutcome = leg.expirationOutcome !== undefined;
                
                let currentPrice: number;
                let priceSource: string;
                
                if (isExpired && hasExpirationOutcome) {
                  // Use the logged expiration outcome price
                  currentPrice = leg.expirationOutcome!.priceAtExpiration;
                  priceSource = leg.expirationOutcome!.wasForced ? 'Forced Close' : 'Expired Worthless';
                } else if (isExpired && !hasExpirationOutcome) {
                  // Expired but no outcome logged - show as needing attention
                  currentPrice = leg.premium;
                  priceSource = 'Needs Outcome';
                } else {
                  // Use current market price or entry price as fallback
                  currentPrice = currentLegPrices[legKey] || leg.premium;
                  priceSource = currentLegPrices[legKey] ? 'Live Price' : 'Entry Price';
                }
                
                const legMultiplier = leg.isLong ? 1 : -1;
                const entryValue = leg.premium * leg.quantity * legMultiplier * 100;
                const currentValue = currentPrice * leg.quantity * legMultiplier * 100;
                const legPnL = currentValue - entryValue;

                return (
                  <Tr key={index} bg={isExpired && !hasExpirationOutcome ? 'orange.50' : 'inherit'}>
                    <Td fontWeight="medium">
                      Leg {index + 1}
                      {isExpired && !hasExpirationOutcome && (
                        <Badge colorScheme="orange" size="sm" ml={1}>!</Badge>
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={leg.optionType === 'call' ? 'green' : 'red'} size="sm">
                        {leg.optionType.toUpperCase()}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={leg.isLong ? 'blue' : 'purple'} size="sm">
                        {leg.isLong ? 'LONG' : 'SHORT'}
                      </Badge>
                    </Td>
                    <Td>${leg.strike.toFixed(2)}</Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm">{formatDate(leg.expiration)}</Text>
                        {isExpired && (
                          <Badge
                            colorScheme={hasExpirationOutcome ? 'gray' : 'orange'}
                            size="xs"
                          >
                            {hasExpirationOutcome ? 'EXPIRED' : 'NEEDS OUTCOME'}
                          </Badge>
                        )}
                      </VStack>
                    </Td>
                    <Td>{leg.quantity}</Td>
                    <Td>${leg.premium.toFixed(2)}</Td>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text
                          color={
                            isExpired && !hasExpirationOutcome ? 'orange.500' :
                            currentPrice !== leg.premium ? (currentPrice > leg.premium ? 'green.500' : 'red.500') : 'inherit'
                          }
                        >
                          ${currentPrice.toFixed(2)}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {priceSource}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Text
                        color={
                          isExpired && !hasExpirationOutcome ? 'orange.500' :
                          legPnL >= 0 ? 'green.500' : 'red.500'
                        }
                        fontWeight="medium"
                      >
                        ${legPnL.toFixed(2)}
                      </Text>
                    </Td>
                    <Td>
                      {isExpired && !hasExpirationOutcome && (
                        <Tooltip label="Log expiration outcome">
                          <IconButton
                            aria-label="Update outcome"
                            icon={<EditIcon />}
                            size="xs"
                            variant="ghost"
                            colorScheme="orange"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpiredLegNeedingOutcome(leg);
                              onExpirationModalOpen();
                            }}
                          />
                        </Tooltip>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {/* Notes and Tags */}
      {(notes || tags.length > 0) && (
        <Box p={4} borderTop="1px" borderColor={borderColor} bg={useColorModeValue('gray.50', 'gray.700')}>
          {notes && (
            <Text fontSize="sm" color={mutedColor} mb={2}>
              <Text as="span" fontWeight="medium">Notes:</Text> {notes}
            </Text>
          )}
          {tags.length > 0 && (
            <HStack spacing={2} flexWrap="wrap">
              {tags.map((tag, index) => (
                <Tag size="sm" key={index} colorScheme="gray" borderRadius="full">
                  <TagLabel>{tag}</TagLabel>
                </Tag>
              ))}
            </HStack>
          )}
        </Box>
      )}
      
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
      
      {/* Expiration Outcome Modal */}
      {expiredLegNeedingOutcome && (
        <ExpirationOutcomeModal
          isOpen={isExpirationModalOpen}
          onClose={onExpirationModalClose}
          expiredLeg={expiredLegNeedingOutcome}
          onOutcomeLogged={handleExpirationOutcome}
        />
      )}
    </Box>
  );
};

export default ActiveTradeCard;