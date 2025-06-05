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
  Stack
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
  const [fees, setFees] = useState(trade.fees);
  const [notes, setNotes] = useState('');
  const [closeReason, setCloseReason] = useState('target_reached');
  
  // Form validation
  const [errors, setErrors] = useState<{
    exitDate?: string;
    exitPrice?: string;
  }>({});
  
  // Calculate profit/loss
  const calculateProfitLoss = () => {
    const entryValue = trade.entryPrice * trade.quantity;
    const exitValue = exitPrice * trade.quantity;
    
    // For long positions, profit = exit - entry
    // For short positions, profit = entry - exit
    let profitLoss = trade.direction === 'long' 
      ? exitValue - entryValue 
      : entryValue - exitValue;
    
    // Subtract fees
    profitLoss -= fees;
    
    return profitLoss;
  };
  
  const profitLoss = calculateProfitLoss();
  const profitLossPercentage = (profitLoss / (trade.entryPrice * trade.quantity)) * 100;
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      exitDate?: string;
      exitPrice?: string;
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
    
    if (exitPrice <= 0) {
      newErrors.exitPrice = 'Exit price must be greater than 0';
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
      exitPrice,
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
              bg={profitLoss >= 0 ? 'green.50' : 'red.50'}
              borderColor={profitLoss >= 0 ? 'green.200' : 'red.200'}
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
            
            <FormControl isRequired isInvalid={!!errors.exitPrice}>
              <FormLabel>Exit Price</FormLabel>
              <NumberInput
                value={exitPrice}
                onChange={(_, value) => setExitPrice(value)}
                min={0}
                precision={2}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              {errors.exitPrice && <FormErrorMessage>{errors.exitPrice}</FormErrorMessage>}
            </FormControl>
            
            <FormControl>
              <FormLabel>Fees</FormLabel>
              <NumberInput
                value={fees}
                onChange={(_, value) => setFees(value)}
                min={0}
                precision={2}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
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