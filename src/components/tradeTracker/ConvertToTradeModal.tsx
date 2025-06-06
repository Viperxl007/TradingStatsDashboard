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
  
  // Calendar spread specific state
  const [strikePrice, setStrikePrice] = useState(0);
  const [shortMonthCredit, setShortMonthCredit] = useState(0);
  const [longMonthDebit, setLongMonthDebit] = useState(0);
  const [shortExpiration, setShortExpiration] = useState('');
  const [longExpiration, setLongExpiration] = useState('');
  const [ivRvRatio, setIvRvRatio] = useState(0);
  const [tsSlope, setTsSlope] = useState(0);
  
  // Calculate total debit for calendar spread
  const totalDebit = longMonthDebit - shortMonthCredit;
  
  // Pre-populate broker fees for calendar spreads ($4 per contract = $8 per spread)
  const [brokerFees, setBrokerFees] = useState(
    tradeIdea.strategy === 'calendar_spread' ? quantity * 8 : fees
  );
  
  // Pre-populate data from trade idea metadata
  useEffect(() => {
    if (tradeIdea.metadata) {
      // Pre-populate IV/RV ratio and TS Slope from trade idea
      if (tradeIdea.metadata.metrics) {
        setIvRvRatio(tradeIdea.metadata.metrics.iv30Rv30 || 0);
        setTsSlope(tradeIdea.metadata.metrics.tsSlope || 0);
      }
      
      // Pre-populate strike price from closest strikes
      if (tradeIdea.metadata.closestStrikes && tradeIdea.metadata.closestStrikes.length > 0) {
        setStrikePrice(tradeIdea.metadata.closestStrikes[0]);
      }
      
      // Pre-populate underlying price
      if (tradeIdea.metadata.currentPrice) {
        setUnderlyingPrice(tradeIdea.metadata.currentPrice);
      }
    }
  }, [tradeIdea]);
  
  // Update broker fees when quantity changes for calendar spreads
  useEffect(() => {
    if (tradeIdea.strategy === 'calendar_spread') {
      setBrokerFees(quantity * 8); // $8 per spread ($4 per contract)
    }
  }, [quantity, tradeIdea.strategy]);
  
  // Form validation
  const [errors, setErrors] = useState<{
    entryDate?: string;
    entryPrice?: string;
    quantity?: string;
    shortMonthCredit?: string;
    longMonthDebit?: string;
    strikePrice?: string;
    shortExpiration?: string;
    longExpiration?: string;
  }>({});
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      entryDate?: string;
      entryPrice?: string;
      quantity?: string;
      shortMonthCredit?: string;
      longMonthDebit?: string;
      strikePrice?: string;
      shortExpiration?: string;
      longExpiration?: string;
    } = {};
    
    if (!entryDate) {
      newErrors.entryDate = 'Entry date is required';
    }
    
    if (tradeIdea.strategy === 'calendar_spread') {
      // For calendar spreads, validate specific fields
      if (longMonthDebit <= 0) {
        newErrors.longMonthDebit = 'Long month debit must be greater than 0';
      }
      
      if (shortMonthCredit < 0) {
        newErrors.shortMonthCredit = 'Short month credit cannot be negative';
      }
      
      if (strikePrice <= 0) {
        newErrors.strikePrice = 'Strike price must be greater than 0';
      }
      
      if (!shortExpiration) {
        newErrors.shortExpiration = 'Short expiration date is required';
      }
      
      if (!longExpiration) {
        newErrors.longExpiration = 'Long expiration date is required';
      }
      
      if (shortExpiration && longExpiration && shortExpiration >= longExpiration) {
        newErrors.longExpiration = 'Long expiration must be after short expiration';
      }
    } else {
      // For other strategies, validate entry price
      if (entryPrice <= 0) {
        newErrors.entryPrice = 'Entry price must be greater than 0';
      }
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
      // For calendar spreads, store specific data in metadata
      const updatedMetadata = tradeIdea.strategy === 'calendar_spread' ? {
        ...tradeIdea.metadata,
        calendarSpreadData: {
          strikePrice,
          shortMonthCredit,
          longMonthDebit,
          totalDebit,
          shortExpiration,
          longExpiration,
          ivRvRatioAtEntry: ivRvRatio,
          tsSlopeAtEntry: tsSlope,
          brokerFees
        }
      } : tradeIdea.metadata;
      
      activeTrade = {
        ...tradeIdea,
        entryDate,
        entryPrice: tradeIdea.strategy === 'calendar_spread' ? totalDebit : entryPrice,
        quantity,
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        fees: tradeIdea.strategy === 'calendar_spread' ? brokerFees : fees,
        notes: tradeIdea.notes + (notes ? `\n\nEntry notes: ${notes}` : ''),
        tags: [...tradeIdea.tags, 'active'],
        updatedAt: Date.now(),
        underlyingPrice,
        legs,
        metadata: updatedMetadata
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
            <Box p={3} bg="blue.50" _dark={{ bg: "blue.800", borderColor: "blue.600" }} borderRadius="md" borderWidth="1px" borderColor="blue.200">
              <Text fontWeight="medium" color="blue.800" _dark={{ color: "blue.100" }}>
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
            
            {tradeIdea.strategy === 'calendar_spread' ? (
              <>
                <HStack spacing={4}>
                  <FormControl isRequired isInvalid={!!errors.strikePrice}>
                    <FormLabel>Strike Price</FormLabel>
                    <Input
                      type="number"
                      value={strikePrice}
                      onChange={(e) => setStrikePrice(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                    {errors.strikePrice && <FormErrorMessage>{errors.strikePrice}</FormErrorMessage>}
                  </FormControl>
                  
                  <FormControl isRequired isInvalid={!!errors.quantity}>
                    <FormLabel>Number of Contracts</FormLabel>
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
                  <FormControl isRequired isInvalid={!!errors.shortExpiration}>
                    <FormLabel>Short Month Expiration</FormLabel>
                    <Input
                      type="date"
                      value={shortExpiration}
                      onChange={(e) => setShortExpiration(e.target.value)}
                    />
                    {errors.shortExpiration && <FormErrorMessage>{errors.shortExpiration}</FormErrorMessage>}
                  </FormControl>
                  
                  <FormControl isRequired isInvalid={!!errors.longExpiration}>
                    <FormLabel>Long Month Expiration</FormLabel>
                    <Input
                      type="date"
                      value={longExpiration}
                      onChange={(e) => setLongExpiration(e.target.value)}
                    />
                    {errors.longExpiration && <FormErrorMessage>{errors.longExpiration}</FormErrorMessage>}
                  </FormControl>
                </HStack>
                
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>Credit Received (Short Month)</FormLabel>
                    <Input
                      type="number"
                      value={shortMonthCredit}
                      onChange={(e) => setShortMonthCredit(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </FormControl>
                  
                  <FormControl isRequired isInvalid={!!errors.longMonthDebit}>
                    <FormLabel>Debit Paid (Long Month)</FormLabel>
                    <Input
                      type="number"
                      value={longMonthDebit}
                      onChange={(e) => setLongMonthDebit(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                    {errors.longMonthDebit && <FormErrorMessage>{errors.longMonthDebit}</FormErrorMessage>}
                  </FormControl>
                </HStack>
                
                <Box
                  p={4}
                  bg="blue.50"
                  _dark={{ bg: "blue.800", borderColor: "blue.600" }}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="blue.200"
                >
                  <Text fontWeight="semibold" color="blue.800" _dark={{ color: "blue.100" }}>
                    Total Debit for Spread: ${totalDebit.toFixed(2)} per contract
                  </Text>
                  <Text fontSize="sm" color="blue.600" _dark={{ color: "blue.200" }} mt={1}>
                    Total Cost: ${(totalDebit * quantity + brokerFees).toFixed(2)} (including ${brokerFees.toFixed(2)} broker fees)
                  </Text>
                </Box>
                
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>IV/RV Ratio at Entry</FormLabel>
                    <Input
                      type="number"
                      value={ivRvRatio}
                      onChange={(e) => setIvRvRatio(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>TS Slope at Entry</FormLabel>
                    <Input
                      type="number"
                      value={tsSlope}
                      onChange={(e) => setTsSlope(parseFloat(e.target.value) || 0)}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </FormControl>
                </HStack>
                
                <FormControl>
                  <FormLabel>Broker Fees</FormLabel>
                  <Input
                    type="number"
                    value={brokerFees}
                    onChange={(e) => setBrokerFees(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Default: $8 per spread ($4 per contract)
                  </Text>
                </FormControl>
              </>
            ) : (
              <HStack spacing={4}>
                <FormControl isRequired isInvalid={!!errors.entryPrice}>
                  <FormLabel>Entry Price</FormLabel>
                  <Input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
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
            )}
            
            {tradeIdea.strategy !== 'calendar_spread' && (
              <>
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>Stop Loss</FormLabel>
                    <Input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Take Profit</FormLabel>
                    <Input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </FormControl>
                </HStack>
                
                <FormControl>
                  <FormLabel>Fees</FormLabel>
                  <Input
                    type="number"
                    value={fees}
                    onChange={(e) => setFees(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
                </FormControl>
              </>
            )}
            
            {tradeIdea.strategy !== 'stock' && tradeIdea.strategy !== 'calendar_spread' && (
              <>
                <Divider my={2} />
                
                <FormControl>
                  <FormLabel>Underlying Price</FormLabel>
                  <Input
                    type="number"
                    value={underlyingPrice}
                    onChange={(e) => setUnderlyingPrice(parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
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