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
  Box,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Select,
  Flex
} from '@chakra-ui/react';
import { CheckIcon, AddIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { AnyTradeEntry, OptionLeg, OptionType } from '../../types/tradeTracker';
import { getCurrentDateString, dateToString } from '../../utils/dateUtils';

interface ConvertToTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeIdea: AnyTradeEntry;
}

/**
 * ConvertToTradeModal Component
 * 
 * This component provides a modal form for converting a trade idea to an active trade.
 */
const ConvertToTradeModal: React.FC<ConvertToTradeModalProps> = ({ isOpen, onClose, tradeIdea }) => {
  const { dispatch } = useData();
  const toast = useToast();
  
  // Form state
  const [entryDate, setEntryDate] = useState(getCurrentDateString());
  const [entryPrice, setEntryPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [fees, setFees] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Option-specific state
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [legs, setLegs] = useState<OptionLeg[]>(
    'legs' in tradeIdea ? tradeIdea.legs : []
  );
  
  // Form validation
  const [errors, setErrors] = useState<{
    entryDate?: string;
    entryPrice?: string;
    quantity?: string;
  }>({});
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      entryDate?: string;
      entryPrice?: string;
      quantity?: string;
    } = {};
    
    if (!entryDate) {
      newErrors.entryDate = 'Entry date is required';
    }
    
    if (entryPrice <= 0) {
      newErrors.entryPrice = 'Entry price must be greater than 0';
    }
    
    if (quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Create active trade from trade idea
    let activeTrade: AnyTradeEntry;
    
    if (tradeIdea.strategy === 'stock') {
      activeTrade = {
        ...tradeIdea,
        entryDate,
        entryPrice,
        quantity,
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        fees,
        notes: tradeIdea.notes + (notes ? `\n\nEntry notes: ${notes}` : ''),
        tags: [...tradeIdea.tags, 'active'],
        updatedAt: Date.now()
      };
    } else {
      activeTrade = {
        ...tradeIdea,
        entryDate,
        entryPrice,
        quantity,
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        fees,
        notes: tradeIdea.notes + (notes ? `\n\nEntry notes: ${notes}` : ''),
        tags: [...tradeIdea.tags, 'active'],
        updatedAt: Date.now(),
        underlyingPrice,
        legs
      };
    }
    
    try {
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Dispatch action to update trade
      dispatch({
        type: ActionType.UPDATE_TRADE_START,
        payload: activeTrade
      });
      
      // Update trade in database
      await tradeTrackerDB.updateTrade(activeTrade);
      
      // Dispatch success action
      dispatch({
        type: ActionType.UPDATE_TRADE_SUCCESS,
        payload: activeTrade
      });
      
      // Show success toast
      toast({
        title: 'Trade idea converted',
        description: `${tradeIdea.ticker} is now an active trade`,
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
        payload: error instanceof Error ? error.message : 'Failed to convert trade idea'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to convert trade idea',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Handle adding an option leg
  const addLeg = () => {
    const newLeg: OptionLeg = {
      optionType: 'call',
      strike: underlyingPrice,
      expiration: dateToString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      premium: 0,
      quantity: 1,
      isLong: true
    };
    
    setLegs([...legs, newLeg]);
  };
  
  // Handle removing an option leg
  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };
  
  // Handle updating an option leg
  const updateLeg = (index: number, field: keyof OptionLeg, value: any) => {
    const updatedLegs = [...legs];
    updatedLegs[index] = {
      ...updatedLegs[index],
      [field]: value
    };
    setLegs(updatedLegs);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Convert to Active Trade: {tradeIdea.ticker}</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box p={3} bg="blue.50" borderRadius="md">
              <Text fontWeight="medium">
                Converting trade idea to active trade. Please enter execution details.
              </Text>
            </Box>
            
            <FormControl isRequired isInvalid={!!errors.entryDate}>
              <FormLabel>Entry Date</FormLabel>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
              {errors.entryDate && <FormErrorMessage>{errors.entryDate}</FormErrorMessage>}
            </FormControl>
            
            <HStack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.entryPrice}>
                <FormLabel>Entry Price</FormLabel>
                <NumberInput
                  value={entryPrice}
                  onChange={(_, value) => setEntryPrice(value)}
                  min={0}
                  precision={2}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                {errors.entryPrice && <FormErrorMessage>{errors.entryPrice}</FormErrorMessage>}
              </FormControl>
              
              <FormControl isRequired isInvalid={!!errors.quantity}>
                <FormLabel>Quantity</FormLabel>
                <NumberInput
                  value={quantity}
                  onChange={(_, value) => setQuantity(value)}
                  min={1}
                  precision={0}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                {errors.quantity && <FormErrorMessage>{errors.quantity}</FormErrorMessage>}
              </FormControl>
            </HStack>
            
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>Stop Loss</FormLabel>
                <NumberInput
                  value={stopLoss}
                  onChange={(_, value) => setStopLoss(value)}
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
                <FormLabel>Take Profit</FormLabel>
                <NumberInput
                  value={takeProfit}
                  onChange={(_, value) => setTakeProfit(value)}
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
            </HStack>
            
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
            
            {tradeIdea.strategy !== 'stock' && (
              <>
                <Divider my={2} />
                
                <FormControl>
                  <FormLabel>Underlying Price</FormLabel>
                  <NumberInput
                    value={underlyingPrice}
                    onChange={(_, value) => setUnderlyingPrice(value)}
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
                
                <Box>
                  <Flex justifyContent="space-between" alignItems="center" mb={2}>
                    <FormLabel mb={0}>Option Legs</FormLabel>
                    <Button size="xs" leftIcon={<AddIcon />} onClick={addLeg}>
                      Add Leg
                    </Button>
                  </Flex>
                  
                  <Accordion allowMultiple defaultIndex={legs.map((_, i) => i)}>
                    {legs.map((leg, index) => (
                      <AccordionItem key={index}>
                        <h2>
                          <AccordionButton>
                            <Box flex="1" textAlign="left">
                              Leg {index + 1}: {leg.isLong ? 'Long' : 'Short'} {leg.optionType.toUpperCase()} @ ${leg.strike}
                            </Box>
                            <AccordionIcon />
                          </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4}>
                          <VStack spacing={3} align="stretch">
                            <HStack spacing={4}>
                              <FormControl>
                                <FormLabel>Option Type</FormLabel>
                                <Select
                                  value={leg.optionType}
                                  onChange={(e) => updateLeg(index, 'optionType', e.target.value as OptionType)}
                                >
                                  <option value="call">Call</option>
                                  <option value="put">Put</option>
                                </Select>
                              </FormControl>
                              
                              <FormControl>
                                <FormLabel>Position</FormLabel>
                                <Select
                                  value={leg.isLong ? 'long' : 'short'}
                                  onChange={(e) => updateLeg(index, 'isLong', e.target.value === 'long')}
                                >
                                  <option value="long">Long</option>
                                  <option value="short">Short</option>
                                </Select>
                              </FormControl>
                            </HStack>
                            
                            <HStack spacing={4}>
                              <FormControl>
                                <FormLabel>Strike Price</FormLabel>
                                <NumberInput
                                  value={leg.strike}
                                  onChange={(_, value) => updateLeg(index, 'strike', value)}
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
                                <FormLabel>Premium</FormLabel>
                                <NumberInput
                                  value={leg.premium}
                                  onChange={(_, value) => updateLeg(index, 'premium', value)}
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
                            </HStack>
                            
                            <HStack spacing={4}>
                              <FormControl>
                                <FormLabel>Expiration</FormLabel>
                                <Input
                                  type="date"
                                  value={leg.expiration}
                                  onChange={(e) => updateLeg(index, 'expiration', e.target.value)}
                                />
                              </FormControl>
                              
                              <FormControl>
                                <FormLabel>Quantity</FormLabel>
                                <NumberInput
                                  value={leg.quantity}
                                  onChange={(_, value) => updateLeg(index, 'quantity', value)}
                                  min={1}
                                  precision={0}
                                >
                                  <NumberInputField />
                                  <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                  </NumberInputStepper>
                                </NumberInput>
                              </FormControl>
                            </HStack>
                            
                            <Button
                              size="sm"
                              colorScheme="red"
                              variant="outline"
                              onClick={() => removeLeg(index)}
                            >
                              Remove Leg
                            </Button>
                          </VStack>
                        </AccordionPanel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Box>
              </>
            )}
            
            <FormControl>
              <FormLabel>Entry Notes</FormLabel>
              <Textarea
                placeholder="Add notes about the trade execution..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </FormControl>
            
            <Divider />
            
            <Box>
              <Text fontWeight="medium" mb={2}>Trade Idea Details:</Text>
              <HStack>
                <Text fontWeight="medium">Ticker:</Text>
                <Text>{tradeIdea.ticker}</Text>
              </HStack>
              <HStack>
                <Text fontWeight="medium">Strategy:</Text>
                <Text>{tradeIdea.strategy}</Text>
              </HStack>
              <HStack>
                <Text fontWeight="medium">Direction:</Text>
                <Text>{tradeIdea.direction === 'long' ? 'Long' : 'Short'}</Text>
              </HStack>
              {tradeIdea.notes && (
                <Box mt={2}>
                  <Text fontWeight="medium">Original Notes:</Text>
                  <Text fontSize="sm">{tradeIdea.notes}</Text>
                </Box>
              )}
            </Box>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="brand" onClick={handleSubmit} leftIcon={<CheckIcon />}>
            Convert to Active Trade
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConvertToTradeModal;