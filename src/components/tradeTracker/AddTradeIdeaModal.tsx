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
  NumberInput,
  NumberInputField,
  Tag,
  TagLabel,
  TagCloseButton,
  useColorModeValue
} from '@chakra-ui/react';
import { AddIcon, CheckIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { v4 as uuidv4 } from 'uuid';
import { AnyTradeEntry, StrategyType, TradeDirection } from '../../types/tradeTracker';

interface AddTradeIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AddTradeIdeaModal Component
 * 
 * This component provides a modal form for adding new trade ideas.
 */
const AddTradeIdeaModal: React.FC<AddTradeIdeaModalProps> = ({ isOpen, onClose }) => {
  const { dispatch } = useData();
  const toast = useToast();
  
  // Form state
  const [ticker, setTicker] = useState('');
  const [strategy, setStrategy] = useState<StrategyType>('stock');
  const [direction, setDirection] = useState<TradeDirection>('long');
  const [entryDate, setEntryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  // Form validation
  const [errors, setErrors] = useState<{
    ticker?: string;
    entryDate?: string;
  }>({});
  
  // Colors
  const tagBg = useColorModeValue('gray.100', 'gray.700');
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      ticker?: string;
      entryDate?: string;
    } = {};
    
    if (!ticker.trim()) {
      newErrors.ticker = 'Ticker is required';
    }
    
    if (!entryDate) {
      newErrors.entryDate = 'Target entry date is required';
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Create new trade idea
    let newTradeIdea: AnyTradeEntry;
    
    if (strategy === 'stock') {
      newTradeIdea = {
        id: uuidv4(),
        ticker: ticker.toUpperCase(),
        entryDate,
        entryPrice: 0, // Will be set when converted to actual trade
        quantity: 0, // Will be set when converted to actual trade
        direction,
        status: 'open',
        strategy: 'stock',
        exitDate: undefined,
        exitPrice: undefined,
        stopLoss: undefined,
        takeProfit: undefined,
        profitLoss: undefined,
        fees: 0,
        notes,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    } else {
      newTradeIdea = {
        id: uuidv4(),
        ticker: ticker.toUpperCase(),
        entryDate,
        entryPrice: 0, // Will be set when converted to actual trade
        quantity: 0, // Will be set when converted to actual trade
        direction,
        status: 'open',
        strategy,
        exitDate: undefined,
        exitPrice: undefined,
        stopLoss: undefined,
        takeProfit: undefined,
        profitLoss: undefined,
        fees: 0,
        notes,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        legs: [],
        underlyingPrice: 0
      };
    }
    
    try {
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../../services/tradeTrackerDB');
      
      // Dispatch action to create trade idea
      dispatch({
        type: ActionType.CREATE_TRADE_START,
        payload: newTradeIdea
      });
      
      // Save to database
      await tradeTrackerDB.createTrade(newTradeIdea);
      
      // Dispatch success action
      dispatch({
        type: ActionType.CREATE_TRADE_SUCCESS,
        payload: newTradeIdea
      });
      
      // Show success toast
      toast({
        title: 'Trade idea created',
        description: `${ticker.toUpperCase()} trade idea has been added`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      resetForm();
      onClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.CREATE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to create trade idea'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to create trade idea',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Reset form
  const resetForm = () => {
    setTicker('');
    setStrategy('stock');
    setDirection('long');
    setEntryDate('');
    setNotes('');
    setTags([]);
    setCurrentTag('');
    setErrors({});
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
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add New Trade Idea</ModalHeader>
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
            
            <HStack spacing={4}>
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
              
              <FormControl>
                <FormLabel>Direction</FormLabel>
                <Select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as TradeDirection)}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </Select>
              </FormControl>
            </HStack>
            
            <FormControl isRequired isInvalid={!!errors.entryDate}>
              <FormLabel>Target Entry Date</FormLabel>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
              {errors.entryDate && <FormErrorMessage>{errors.entryDate}</FormErrorMessage>}
            </FormControl>
            
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
            Save Trade Idea
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddTradeIdeaModal;