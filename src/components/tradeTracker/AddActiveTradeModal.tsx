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
  Select,
  Textarea,
  VStack,
  HStack,
  Box,
  Flex,
  Text,
  useToast,
  FormErrorMessage,
  InputGroup,
  InputRightElement,
  Tag,
  TagLabel,
  TagCloseButton,
  useColorModeValue,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon
} from '@chakra-ui/react';
import { AddIcon, CheckIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { StrategyType, OptionLeg, OptionType, AnyTradeEntry } from '../../types/tradeTracker';

interface AddActiveTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AddActiveTradeModal Component
 * 
 * This component provides a modal form for adding a new active trade directly.
 */
const AddActiveTradeModal: React.FC<AddActiveTradeModalProps> = ({ isOpen, onClose }) => {
  const { dispatch } = useData();
  const toast = useToast();
  
  // Form state
  const [ticker, setTicker] = useState('');
  const [strategy, setStrategy] = useState<StrategyType>('calendar_spread');
  const [entryDate, setEntryDate] = useState(getCurrentDateString());
  const [entryPrice, setEntryPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  // Option-specific state
  const [underlyingPrice, setUnderlyingPrice] = useState(0);
  const [legs, setLegs] = useState<OptionLeg[]>([]);
  
  // Calendar spread metadata state
  const [ivRvRatio, setIvRvRatio] = useState<number>(0);
  const [tsSlope, setTsSlope] = useState<number>(0);
  
  // Form validation
  const [errors, setErrors] = useState<{
    ticker?: string;
    entryDate?: string;
    entryPrice?: string;
    quantity?: string;
  }>({});
  
  // Colors
  const tagBg = useColorModeValue('gray.100', 'gray.700');
  
  // Get current date string
  function getCurrentDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
  
  // Reset form
  const resetForm = () => {
    setTicker('');
    setStrategy('calendar_spread');
    setEntryDate(getCurrentDateString());
    setEntryPrice(0);
    setQuantity(1);
    setNotes('');
    setTags([]);
    setCurrentTag('');
    setUnderlyingPrice(0);
    setLegs([]);
    setIvRvRatio(0);
    setTsSlope(0);
    setErrors({});
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      ticker?: string;
      entryDate?: string;
      entryPrice?: string;
      quantity?: string;
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
    
    if (quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    try {
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Create new trade object with proper typing
      let newTrade: AnyTradeEntry;
      
      if (strategy === 'stock') {
        newTrade = {
          id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ticker: ticker.toUpperCase(),
          strategy: 'stock',
          direction: 'long' as const,
          entryDate,
          entryPrice,
          quantity,
          status: 'open' as const,
          fees: 0,
          notes,
          tags,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      } else {
        // Create metadata object for calendar spreads
        let metadata = undefined;
        if (strategy === 'calendar_spread') {
          metadata = {
            ivRvRatioAtEntry: ivRvRatio || undefined,
            tsSlopeAtEntry: tsSlope || undefined
          };
        }
        
        newTrade = {
          id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ticker: ticker.toUpperCase(),
          strategy,
          direction: 'long' as const,
          entryDate,
          entryPrice,
          quantity,
          status: 'open' as const,
          fees: 0,
          notes,
          tags,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          underlyingPrice,
          legs,
          metadata
        };
      }
      
      // Dispatch action to create trade
      dispatch({
        type: ActionType.CREATE_TRADE_START,
        payload: newTrade
      });
      
      // Create trade in database
      await tradeTrackerDB.createTrade(newTrade);
      
      // Dispatch success action
      dispatch({
        type: ActionType.CREATE_TRADE_SUCCESS,
        payload: newTrade
      });
      
      // Recalculate statistics
      const allTrades = await tradeTrackerDB.getAllTrades();
      const statistics = await tradeTrackerDB.calculateStatistics(allTrades);
      dispatch({
        type: ActionType.CALCULATE_TRADE_STATISTICS,
        payload: statistics
      });
      
      // Show success toast
      toast({
        title: 'Active trade added',
        description: `${ticker.toUpperCase()} trade has been added successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reset form and close modal
      resetForm();
      onClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.CREATE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to add trade'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to add trade',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Handle tag input
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };
  
  // Add tag
  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };
  
  // Remove tag
  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };
  
  // Add option leg
  const addLeg = () => {
    const newLeg: OptionLeg = {
      optionType: 'call',
      strike: 0,
      expiration: '',
      premium: 0,
      quantity: 1,
      isLong: true
    };
    setLegs([...legs, newLeg]);
  };
  
  // Update option leg
  const updateLeg = (index: number, field: keyof OptionLeg, value: any) => {
    const updatedLegs = [...legs];
    updatedLegs[index] = { ...updatedLegs[index], [field]: value };
    setLegs(updatedLegs);
  };
  
  // Remove option leg
  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add New Active Trade</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.ticker}>
                <FormLabel>Ticker</FormLabel>
                <Input
                  placeholder="AAPL"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                />
                {errors.ticker && <FormErrorMessage>{errors.ticker}</FormErrorMessage>}
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Strategy</FormLabel>
                <Select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as StrategyType)}
                >
                  <option value="stock">Stock</option>
                  <option value="single_option">Single Option</option>
                  <option value="vertical_spread">Vertical Spread</option>
                  <option value="iron_condor">Iron Condor</option>
                  <option value="calendar_spread">Calendar Spread</option>
                  <option value="diagonal_spread">Diagonal Spread</option>
                  <option value="covered_call">Covered Call</option>
                  <option value="protective_put">Protective Put</option>
                  <option value="straddle">Straddle</option>
                  <option value="strangle">Strangle</option>
                  <option value="butterfly">Butterfly</option>
                  <option value="custom">Custom</option>
                </Select>
              </FormControl>
            </HStack>
            
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
              
              <FormControl isRequired isInvalid={!!errors.quantity}>
                <FormLabel>Quantity</FormLabel>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  placeholder="1"
                />
                {errors.quantity && <FormErrorMessage>{errors.quantity}</FormErrorMessage>}
              </FormControl>
            </HStack>
            
            {strategy !== 'stock' && (
              <>
                <Divider my={2} />
                
                <FormControl>
                  <FormLabel>Underlying Price</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={underlyingPrice}
                    onChange={(e) => setUnderlyingPrice(parseFloat(e.target.value) || 0)}
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
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={leg.strike}
                                  onChange={(e) => updateLeg(index, 'strike', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                />
                              </FormControl>
                              
                              <FormControl>
                                <FormLabel>Expiration</FormLabel>
                                <Input
                                  type="date"
                                  value={leg.expiration}
                                  onChange={(e) => updateLeg(index, 'expiration', e.target.value)}
                                />
                              </FormControl>
                            </HStack>
                            
                            <HStack spacing={4}>
                              <FormControl>
                                <FormLabel>Premium</FormLabel>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={leg.premium}
                                  onChange={(e) => updateLeg(index, 'premium', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                />
                              </FormControl>
                              
                              <FormControl>
                                <FormLabel>Quantity</FormLabel>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={leg.quantity}
                                  onChange={(e) => updateLeg(index, 'quantity', parseInt(e.target.value) || 1)}
                                  placeholder="1"
                                />
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
            
            {/* Calendar Spread Metadata */}
            {strategy === 'calendar_spread' && (
              <>
                <Divider my={2} />
                <Text fontSize="md" fontWeight="semibold" color="gray.600">Calendar Spread Metrics</Text>
                
                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel>IV/RV Ratio at Entry</FormLabel>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ivRvRatio || ''}
                      onChange={(e) => setIvRvRatio(parseFloat(e.target.value) || 0)}
                      placeholder="1.25"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>TS Slope at Entry</FormLabel>
                    <Input
                      type="number"
                      step="0.001"
                      value={tsSlope || ''}
                      onChange={(e) => setTsSlope(parseFloat(e.target.value) || 0)}
                      placeholder="0.025"
                    />
                  </FormControl>
                </HStack>
              </>
            )}
            
            <FormControl>
              <FormLabel>Notes</FormLabel>
              <Textarea
                placeholder="Add your analysis, reasons for the trade, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </FormControl>
            
            <FormControl>
              <FormLabel>Tags</FormLabel>
              <InputGroup>
                <Input
                  placeholder="Add tags (press Enter to add)"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                />
                <InputRightElement>
                  <Button size="sm" onClick={addTag} h="1.75rem" w="1.75rem">
                    <AddIcon boxSize={3} />
                  </Button>
                </InputRightElement>
              </InputGroup>
              
              {tags.length > 0 && (
                <Box mt={2}>
                  <HStack spacing={2} flexWrap="wrap">
                    {tags.map((tag, index) => (
                      <Tag
                        size="md"
                        key={index}
                        borderRadius="full"
                        variant="solid"
                        bg={tagBg}
                      >
                        <TagLabel>{tag}</TagLabel>
                        <TagCloseButton onClick={() => removeTag(index)} />
                      </Tag>
                    ))}
                  </HStack>
                </Box>
              )}
            </FormControl>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="brand" onClick={handleSubmit}>
            Add Active Trade
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddActiveTradeModal;