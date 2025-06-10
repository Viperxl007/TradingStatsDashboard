import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  FormErrorMessage,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Box,
  Divider,
  RadioGroup,
  Radio,
  Stack,
  useColorModeValue
} from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { AnyTradeEntry, TradeStatus } from '../../types/tradeTracker';
import { getCurrentDateString, parseLocalDate } from '../../utils/dateUtils';

interface CloseTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: AnyTradeEntry;
}

/**
 * CloseTradeModal Component
 * 
 * This component provides a modal form for closing trades and recording results.
 */
const CloseTradeModal: React.FC<CloseTradeModalProps> = ({ isOpen, onClose, trade }) => {
  const { dispatch } = useData();
  const toast = useToast();
  
  // Form state
  const [exitDate, setExitDate] = useState(getCurrentDateString());
  const [exitPrice, setExitPrice] = useState(trade.entryPrice);
  const [fees, setFees] = useState(0); // Initialize fees to 0 for manual entry
  const [notes, setNotes] = useState('');
  const [closeReason, setCloseReason] = useState('target_reached');
  
  // Calendar spread specific state
  const [creditReceived, setCreditReceived] = useState(0);
  
  // Form validation
  const [errors, setErrors] = useState<{
    exitDate?: string;
    exitPrice?: string;
    creditReceived?: string;
  }>({});
  
  // Calculate profit/loss
  const calculateProfitLoss = () => {
    if (trade.strategy === 'calendar_spread') {
      // For calendar spreads: P&L = Credit Received - Total Debit Paid - Fees + Expiration Outcomes
      // Option prices are per-share, so multiply by 100 to get per-contract amounts
      const totalDebitPaid = trade.entryPrice * trade.quantity * 100;
      const totalCreditReceived = creditReceived * trade.quantity * 100;
      
      // Add expiration outcomes for expired legs
      let expirationOutcomeValue = 0;
      if ('legs' in trade && trade.legs) {
        trade.legs.forEach(leg => {
          if (leg.expirationOutcome) {
            const legMultiplier = leg.isLong ? -1 : 1; // For long: cost is negative, for short: cost reduces profit
            expirationOutcomeValue += leg.expirationOutcome.priceAtExpiration * leg.quantity * legMultiplier * 100;
          }
        });
      }
      
      const result = totalCreditReceived - totalDebitPaid - fees + expirationOutcomeValue;
      
      // Debug logging
      console.log('Calendar Spread P&L Calculation:', {
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        totalDebitPaid,
        creditReceived,
        totalCreditReceived,
        fees,
        expirationOutcomeValue,
        result
      });
      
      return result;
    } else {
      // For other strategies, also multiply by 100 for contract amounts
      const entryValue = trade.entryPrice * trade.quantity * 100;
      const exitValue = exitPrice * trade.quantity * 100;
      
      // For long positions, profit = exit - entry
      // For short positions, profit = entry - exit
      let profitLoss = trade.direction === 'long'
        ? exitValue - entryValue
        : entryValue - exitValue;
      
      // Fees are entered as total dollar amount, not per-contract
      profitLoss -= fees;
      
      return profitLoss;
    }
  };
  
  const profitLoss = calculateProfitLoss();
  // Calculate percentage based on actual contract amounts (multiply by 100)
  const profitLossPercentage = (profitLoss / (trade.entryPrice * trade.quantity * 100)) * 100;
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      exitDate?: string;
      exitPrice?: string;
      creditReceived?: string;
    } = {};
    
    if (!exitDate) {
      newErrors.exitDate = 'Exit date is required';
    } else {
      const exitDateObj = parseLocalDate(exitDate);
      const entryDateObj = parseLocalDate(trade.entryDate);
      
      if (exitDateObj < entryDateObj) {
        newErrors.exitDate = 'Exit date cannot be before entry date';
      }
    }
    
    if (trade.strategy === 'calendar_spread') {
      // For calendar spreads, validate credit received
      if (creditReceived < 0) {
        newErrors.creditReceived = 'Credit received cannot be negative';
      }
    } else {
      // For other strategies, validate exit price
      if (exitPrice <= 0) {
        newErrors.exitPrice = 'Exit price must be greater than 0';
      }
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Create updated trade object with closed status
    const closedTrade: AnyTradeEntry = {
      ...trade,
      status: 'closed' as TradeStatus,
      exitDate,
      // For calendar spreads, use creditReceived as exitPrice; for others, use exitPrice
      exitPrice: trade.strategy === 'calendar_spread' ? creditReceived : exitPrice,
      fees,
      profitLoss,
      notes: trade.notes + (notes ? `\n\nClose notes: ${notes}` : ''),
      tags: [...trade.tags, closeReason],
      updatedAt: Date.now()
    };
    
    try {
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Dispatch action to update trade
      dispatch({
        type: ActionType.UPDATE_TRADE_START,
        payload: closedTrade
      });
      
      // Update trade in database
      await tradeTrackerDB.updateTrade(closedTrade);
      
      // Dispatch success action
      dispatch({
        type: ActionType.UPDATE_TRADE_SUCCESS,
        payload: closedTrade
      });
      
      // Show success toast
      toast({
        title: 'Trade closed',
        description: `${trade.ticker} trade has been closed with ${profitLoss >= 0 ? 'profit' : 'loss'} of $${Math.abs(profitLoss).toFixed(2)}`,
        status: profitLoss >= 0 ? 'success' : 'warning',
        duration: 5000,
        isClosable: true,
      });
      
      // Close modal
      onClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.UPDATE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to close trade'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to close trade',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Close Trade: {trade.ticker}</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box
              p={4}
              borderWidth="1px"
              borderRadius="md"
              bg={profitLoss >= 0
                ? useColorModeValue('green.50', 'green.900')
                : useColorModeValue('red.50', 'red.900')
              }
              borderColor={profitLoss >= 0
                ? useColorModeValue('green.200', 'green.600')
                : useColorModeValue('red.200', 'red.600')
              }
            >
              <Stat>
                <StatLabel>Estimated P&L</StatLabel>
                <StatNumber color={profitLoss >= 0 ? 'green.500' : 'red.500'}>
                  ${profitLoss.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  <StatArrow type={profitLoss >= 0 ? 'increase' : 'decrease'} />
                  {Math.abs(profitLossPercentage).toFixed(2)}%
                </StatHelpText>
              </Stat>
            </Box>
            
            <FormControl isRequired isInvalid={!!errors.exitDate}>
              <FormLabel>Exit Date</FormLabel>
              <Input
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
              />
              {errors.exitDate && <FormErrorMessage>{errors.exitDate}</FormErrorMessage>}
            </FormControl>
            
            {trade.strategy === 'calendar_spread' ? (
              <FormControl isInvalid={!!errors.creditReceived}>
                <FormLabel>Credit Received When Closing</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditReceived}
                  onChange={(e) => setCreditReceived(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Enter the total credit received per contract when closing the spread
                </Text>
                {errors.creditReceived && <FormErrorMessage>{errors.creditReceived}</FormErrorMessage>}
              </FormControl>
            ) : (
              <FormControl isRequired isInvalid={!!errors.exitPrice}>
                <FormLabel>Exit Price</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                {errors.exitPrice && <FormErrorMessage>{errors.exitPrice}</FormErrorMessage>}
              </FormControl>
            )}
            
            <FormControl>
              <FormLabel>Fees</FormLabel>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(parseFloat(e.target.value) || 0)}
                placeholder="8.00"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Enter fees in actual dollar amount (e.g., $8.00 for $8 in fees)
              </Text>
            </FormControl>
            
            <FormControl>
              <FormLabel>Reason for Closing</FormLabel>
              <RadioGroup value={closeReason} onChange={setCloseReason}>
                <Stack direction="column">
                  <Radio value="target_reached">Target Price Reached</Radio>
                  <Radio value="stop_loss">Stop Loss Triggered</Radio>
                  <Radio value="technical_exit">Technical Signal</Radio>
                  <Radio value="fundamental_change">Fundamental Change</Radio>
                  <Radio value="risk_management">Risk Management</Radio>
                  <Radio value="expiration">Option Expiration</Radio>
                  <Radio value="other">Other</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>
            
            <FormControl>
              <FormLabel>Notes</FormLabel>
              <Textarea
                placeholder="Add notes about the trade exit..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </FormControl>
            
            <Divider />
            
            <HStack>
              <Text fontWeight="medium">Entry Price:</Text>
              <Text>${trade.entryPrice.toFixed(2)}</Text>
            </HStack>
            
            <HStack>
              <Text fontWeight="medium">Quantity:</Text>
              <Text>{trade.quantity}</Text>
            </HStack>
            
            <HStack>
              <Text fontWeight="medium">Direction:</Text>
              <Text>{trade.direction === 'long' ? 'Long' : 'Short'}</Text>
            </HStack>
            
            {/* Show expiration outcomes if any exist */}
            {'legs' in trade && trade.legs && trade.legs.some(leg => leg.expirationOutcome) && (
              <>
                <Divider />
                <VStack align="stretch" spacing={2}>
                  <Text fontWeight="medium">Expiration Outcomes:</Text>
                  {trade.legs.map((leg, index) => {
                    if (!leg.expirationOutcome) return null;
                    
                    const outcome = leg.expirationOutcome;
                    const outcomeValue = outcome.priceAtExpiration * leg.quantity * 100;
                    const isProfit = leg.isLong ? outcomeValue < 0 : outcomeValue > 0;
                    
                    return (
                      <Box key={index} p={2} borderWidth="1px" borderRadius="md" bg={useColorModeValue('gray.50', 'gray.700')}>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="sm" fontWeight="medium">
                              {leg.optionType.toUpperCase()} ${leg.strike} {new Date(leg.expiration).toLocaleDateString()}
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {outcome.wasForced ? 'Forced buy-to-close' : 'Expired worthless'}
                            </Text>
                          </VStack>
                          <VStack align="end" spacing={0}>
                            <Text fontSize="sm" fontWeight="medium" color={isProfit ? 'green.500' : 'red.500'}>
                              ${outcome.priceAtExpiration.toFixed(2)}
                            </Text>
                            <Text fontSize="xs" color="gray.600">
                              {isProfit ? 'Profit' : 'Loss'}: ${Math.abs(outcomeValue).toFixed(2)}
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>
                    );
                  })}
                </VStack>
              </>
            )}
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme={profitLoss >= 0 ? 'green' : 'red'} 
            onClick={handleSubmit} 
            leftIcon={<CheckIcon />}
          >
            Close Trade
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CloseTradeModal;