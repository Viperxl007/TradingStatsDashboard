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
import { AnyTradeEntry, StrategyType, OptionLeg, OptionType } from '../../types/tradeTracker';

interface TradeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: AnyTradeEntry;
}

/**
 * TradeDetailsModal Component
 * 
 * This component provides a modal form for viewing and editing trade details.
 */
const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({ isOpen, onClose, trade }) => {
  const { dispatch } = useData();
  const toast = useToast();
  
  // Form state
  const [ticker, setTicker] = useState(trade.ticker);
  const [strategy, setStrategy] = useState<StrategyType>(trade.strategy);
  const [entryDate, setEntryDate] = useState(trade.entryDate);
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice);
  const [quantity, setQuantity] = useState(trade.quantity);
  const [notes, setNotes] = useState(trade.notes);
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>(trade.tags);
  
  // Option-specific state
  const [underlyingPrice, setUnderlyingPrice] = useState(
    'underlyingPrice' in trade ? trade.underlyingPrice : 0
  );
  const [legs, setLegs] = useState<OptionLeg[]>(
    'legs' in trade ? trade.legs : []
  );
  
  // Calendar spread metadata state
  const [ivRvRatio, setIvRvRatio] = useState<number>(
    trade.metadata?.ivRvRatioAtEntry || 0
  );
  const [tsSlope, setTsSlope] = useState<number>(
    trade.metadata?.tsSlopeAtEntry || 0
  );
  
  // Form validation
  const [errors, setErrors] = useState<{
    ticker?: string;
    entryDate?: string;
    entryPrice?: string;
    quantity?: string;
  }>({});
  
  // Colors
  const tagBg = useColorModeValue('gray.100', 'gray.700');
  
  // Reset form when trade changes
  useEffect(() => {
    setTicker(trade.ticker);
    setStrategy(trade.strategy);
    setEntryDate(trade.entryDate);
    setEntryPrice(trade.entryPrice);
    setQuantity(trade.quantity);
    setNotes(trade.notes);
    setTags(trade.tags);
    
    if ('underlyingPrice' in trade) {
      setUnderlyingPrice(trade.underlyingPrice);
    }
    
    if ('legs' in trade) {
      setLegs(trade.legs);
    }
    
    // Reset calendar spread metadata
    setIvRvRatio(trade.metadata?.ivRvRatioAtEntry || 0);
    setTsSlope(trade.metadata?.tsSlopeAtEntry || 0);
  }, [trade]);
  
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
    
    // Create updated trade object
    let updatedTrade: AnyTradeEntry;
    
    if (strategy === 'stock') {
      updatedTrade = {
        ...trade,
        ticker: ticker.toUpperCase(),
        strategy,
        entryDate,
        entryPrice,
        quantity,
        notes,
        tags,
        updatedAt: Date.now()
      };
    } else {
      // Create metadata object for calendar spreads
      let metadata = { ...trade.metadata };
      
      if (strategy === 'calendar_spread') {
        metadata = {
          ...metadata,
          ivRvRatioAtEntry: ivRvRatio || undefined,
          tsSlopeAtEntry: tsSlope || undefined
        };
      }
      
      updatedTrade = {
        ...trade,
        ticker: ticker.toUpperCase(),
        strategy,
        entryDate,
        entryPrice,
        quantity,
        notes,
        tags,
        updatedAt: Date.now(),
        underlyingPrice,
        legs,
        metadata
      };
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
        description: `${ticker.toUpperCase()} trade has been updated`,
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
  
  // Handle adding a tag
  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };
  
  // Handle removing a tag
  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };
  
  // Handle tag input keydown
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };
  
  // Handle adding an option leg
  const addLeg = () => {
    const newLeg: OptionLeg = {
      optionType: 'call',
      strike: underlyingPrice,
      expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Trade: {trade.ticker}</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired isInvalid={!!errors.ticker}>
              <FormLabel>Ticker Symbol</FormLabel>
              <Input
                placeholder="e.g., AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
              />
              {errors.ticker && <FormErrorMessage>{errors.ticker}</FormErrorMessage>}
            </FormControl>
            
            <FormControl>
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
          <Button colorScheme="brand" onClick={handleSubmit} leftIcon={<CheckIcon />}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TradeDetailsModal;