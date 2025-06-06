import React, { useState, useEffect } from 'react';
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
  Textarea,
  Select,
  Divider,
  Box,
  Badge,
  Flex,
  IconButton
} from '@chakra-ui/react';
import { CheckIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { AnyTradeEntry, TradeStatus, OptionLeg } from '../../types/tradeTracker';
import { getCurrentDateString, parseLocalDate } from '../../utils/dateUtils';

interface EditTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: AnyTradeEntry;
}

/**
 * EditTradeModal Component
 * 
 * This component provides a modal form for editing any field in a trade record.
 */
const EditTradeModal: React.FC<EditTradeModalProps> = ({ isOpen, onClose, trade }) => {
  const { dispatch } = useData();
  const toast = useToast();
  
  // Form state - initialize with current trade values
  const [ticker, setTicker] = useState(trade.ticker);
  const [strategy, setStrategy] = useState(trade.strategy);
  const [direction, setDirection] = useState(trade.direction);
  const [quantity, setQuantity] = useState(trade.quantity);
  const [entryDate, setEntryDate] = useState(trade.entryDate);
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice);
  const [exitDate, setExitDate] = useState(trade.exitDate || '');
  const [exitPrice, setExitPrice] = useState(trade.exitPrice || 0);
  const [fees, setFees] = useState(trade.fees || 0);
  const [profitLoss, setProfitLoss] = useState(trade.profitLoss || 0);
  const [status, setStatus] = useState(trade.status);
  const [notes, setNotes] = useState(trade.notes || '');
  const [tags, setTags] = useState(trade.tags.join(', '));
  const [stopLoss, setStopLoss] = useState(trade.stopLoss || 0);
  
  // Option legs for option trades
  const [legs, setLegs] = useState<OptionLeg[]>(
    'legs' in trade && trade.legs ? trade.legs : []
  );
  
  // Form validation
  const [errors, setErrors] = useState<{
    ticker?: string;
    entryDate?: string;
    entryPrice?: string;
    exitDate?: string;
  }>({});
  
  // Reset form when trade changes
  useEffect(() => {
    setTicker(trade.ticker);
    setStrategy(trade.strategy);
    setDirection(trade.direction);
    setQuantity(trade.quantity);
    setEntryDate(trade.entryDate);
    setEntryPrice(trade.entryPrice);
    setExitDate(trade.exitDate || '');
    setExitPrice(trade.exitPrice || 0);
    setFees(trade.fees || 0);
    setProfitLoss(trade.profitLoss || 0);
    setStatus(trade.status);
    setNotes(trade.notes || '');
    setTags(trade.tags.join(', '));
    setStopLoss(trade.stopLoss || 0);
    setLegs('legs' in trade && trade.legs ? trade.legs : []);
  }, [trade]);
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      ticker?: string;
      entryDate?: string;
      entryPrice?: string;
      exitDate?: string;
    } = {};
    
    if (!ticker.trim()) {
      newErrors.ticker = 'Ticker is required';
    }
    
    if (!entryDate) {
      newErrors.entryDate = 'Entry date is required';
    }
    
    if (entryPrice <= 0) {
      newErrors.entryPrice = 'Entry price must be greater than 0';
    }
    
    if (exitDate && entryDate) {
      const exitDateObj = parseLocalDate(exitDate);
      const entryDateObj = parseLocalDate(entryDate);
      
      if (exitDateObj < entryDateObj) {
        newErrors.exitDate = 'Exit date cannot be before entry date';
      }
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Create updated trade object
    const updatedTrade = {
      ...trade,
      ticker: ticker.toUpperCase(),
      strategy,
      direction,
      quantity,
      entryDate,
      entryPrice,
      exitDate: exitDate || undefined,
      exitPrice: exitPrice || undefined,
      fees,
      profitLoss,
      status,
      notes,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      stopLoss: stopLoss || undefined,
      updatedAt: Date.now()
    } as AnyTradeEntry;
    
    // Add legs for option trades
    if (strategy !== 'stock' && legs.length > 0) {
      (updatedTrade as any).legs = legs;
    }
    
    try {
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Dispatch action to update trade
      dispatch({
        type: ActionType.UPDATE_TRADE_START,
        payload: updatedTrade
      });
      
      // Update trade in database
      await tradeTrackerDB.updateTrade(updatedTrade);
      
      // Dispatch success action
      dispatch({
        type: ActionType.UPDATE_TRADE_SUCCESS,
        payload: updatedTrade
      });
      
      // Show success toast
      toast({
        title: 'Trade updated',
        description: `${ticker} trade has been updated successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Close modal
      onClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.UPDATE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to update trade'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to update trade',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Add new option leg
  const addLeg = () => {
    const newLeg: OptionLeg = {
      optionType: 'call',
      strike: 0,
      expiration: getCurrentDateString(),
      premium: 0,
      quantity: 1,
      isLong: true
    };
    setLegs([...legs, newLeg]);
  };
  
  // Remove option leg
  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };
  
  // Update option leg
  const updateLeg = (index: number, field: keyof OptionLeg, value: any) => {
    const updatedLegs = [...legs];
    updatedLegs[index] = { ...updatedLegs[index], [field]: value };
    setLegs(updatedLegs);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Trade: {trade.ticker}</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Basic Trade Information */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={3}>Basic Information</Text>
              
              <VStack spacing={3} align="stretch">
                <HStack spacing={3}>
                  <FormControl isRequired isInvalid={!!errors.ticker}>
                    <FormLabel>Ticker</FormLabel>
                    <Input
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      placeholder="AAPL"
                    />
                    {errors.ticker && <FormErrorMessage>{errors.ticker}</FormErrorMessage>}
                  </FormControl>
                  
                  <FormControl isRequired>
                    <FormLabel>Strategy</FormLabel>
                    <Select value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
                      <option value="stock">Stock</option>
                      <option value="option">Option</option>
                      <option value="calendar_spread">Calendar Spread</option>
                      <option value="iron_condor">Iron Condor</option>
                      <option value="butterfly">Butterfly</option>
                      <option value="straddle">Straddle</option>
                      <option value="strangle">Strangle</option>
                    </Select>
                  </FormControl>
                </HStack>
                
                <HStack spacing={3}>
                  <FormControl isRequired>
                    <FormLabel>Direction</FormLabel>
                    <Select value={direction} onChange={(e) => setDirection(e.target.value as any)}>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </Select>
                  </FormControl>
                  
                  <FormControl isRequired>
                    <FormLabel>Quantity</FormLabel>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      placeholder="1"
                    />
                  </FormControl>
                  
                  <FormControl isRequired>
                    <FormLabel>Status</FormLabel>
                    <Select value={status} onChange={(e) => setStatus(e.target.value as TradeStatus)}>
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  </FormControl>
                </HStack>
              </VStack>
            </Box>
            
            <Divider />
            
            {/* Entry Information */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={3}>Entry Information</Text>
              
              <HStack spacing={3}>
                <FormControl isRequired isInvalid={!!errors.entryDate}>
                  <FormLabel>Entry Date</FormLabel>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                  {errors.entryDate && <FormErrorMessage>{errors.entryDate}</FormErrorMessage>}
                </FormControl>
                
                <FormControl isRequired isInvalid={!!errors.entryPrice}>
                  <FormLabel>Entry Price</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                  {errors.entryPrice && <FormErrorMessage>{errors.entryPrice}</FormErrorMessage>}
                </FormControl>
              </HStack>
            </Box>
            
            <Divider />
            
            {/* Exit Information */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={3}>Exit Information</Text>
              
              <HStack spacing={3}>
                <FormControl isInvalid={!!errors.exitDate}>
                  <FormLabel>Exit Date</FormLabel>
                  <Input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                  />
                  {errors.exitDate && <FormErrorMessage>{errors.exitDate}</FormErrorMessage>}
                </FormControl>
                
                <FormControl>
                  <FormLabel>Exit Price</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </FormControl>
              </HStack>
              
              <HStack spacing={3} mt={3}>
                <FormControl>
                  <FormLabel>Fees</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fees}
                    onChange={(e) => setFees(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Profit/Loss</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={profitLoss}
                    onChange={(e) => setProfitLoss(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </FormControl>
              </HStack>
            </Box>
            
            <Divider />
            
            {/* Risk Management */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={3}>Risk Management</Text>
              
              <FormControl>
                <FormLabel>Stop Loss</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </FormControl>
            </Box>
            
            {/* Option Legs (for option strategies) */}
            {strategy !== 'stock' && (
              <>
                <Divider />
                <Box>
                  <Flex justify="space-between" align="center" mb={3}>
                    <Text fontSize="lg" fontWeight="bold">Option Legs</Text>
                    <Button size="sm" leftIcon={<AddIcon />} onClick={addLeg}>
                      Add Leg
                    </Button>
                  </Flex>
                  
                  <VStack spacing={3} align="stretch">
                    {legs.map((leg, index) => (
                      <Box key={index} p={3} borderWidth="1px" borderRadius="md">
                        <Flex justify="space-between" align="center" mb={2}>
                          <Badge colorScheme="blue">Leg {index + 1}</Badge>
                          <IconButton
                            aria-label="Remove leg"
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => removeLeg(index)}
                          />
                        </Flex>
                        
                        <VStack spacing={2} align="stretch">
                          <HStack spacing={2}>
                            <FormControl>
                              <FormLabel fontSize="sm">Type</FormLabel>
                              <Select 
                                size="sm" 
                                value={leg.optionType} 
                                onChange={(e) => updateLeg(index, 'optionType', e.target.value)}
                              >
                                <option value="call">Call</option>
                                <option value="put">Put</option>
                              </Select>
                            </FormControl>
                            
                            <FormControl>
                              <FormLabel fontSize="sm">Position</FormLabel>
                              <Select 
                                size="sm" 
                                value={leg.isLong ? 'long' : 'short'} 
                                onChange={(e) => updateLeg(index, 'isLong', e.target.value === 'long')}
                              >
                                <option value="long">Long</option>
                                <option value="short">Short</option>
                              </Select>
                            </FormControl>
                          </HStack>
                          
                          <HStack spacing={2}>
                            <FormControl>
                              <FormLabel fontSize="sm">Strike</FormLabel>
                              <Input
                                size="sm"
                                type="number"
                                step="0.01"
                                min="0"
                                value={leg.strike}
                                onChange={(e) => updateLeg(index, 'strike', parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            
                            <FormControl>
                              <FormLabel fontSize="sm">Premium</FormLabel>
                              <Input
                                size="sm"
                                type="number"
                                step="0.01"
                                min="0"
                                value={leg.premium}
                                onChange={(e) => updateLeg(index, 'premium', parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            
                            <FormControl>
                              <FormLabel fontSize="sm">Quantity</FormLabel>
                              <Input
                                size="sm"
                                type="number"
                                step="1"
                                min="1"
                                value={leg.quantity}
                                onChange={(e) => updateLeg(index, 'quantity', parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                          </HStack>
                          
                          <FormControl>
                            <FormLabel fontSize="sm">Expiration</FormLabel>
                            <Input
                              size="sm"
                              type="date"
                              value={leg.expiration}
                              onChange={(e) => updateLeg(index, 'expiration', e.target.value)}
                            />
                          </FormControl>
                        </VStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              </>
            )}
            
            <Divider />
            
            {/* Notes and Tags */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={3}>Additional Information</Text>
              
              <VStack spacing={3} align="stretch">
                <FormControl>
                  <FormLabel>Tags (comma-separated)</FormLabel>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="earnings, high-iv, momentum"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Notes</FormLabel>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this trade..."
                    rows={4}
                  />
                </FormControl>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleSubmit} 
            leftIcon={<CheckIcon />}
          >
            Update Trade
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditTradeModal;