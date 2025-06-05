import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  useToast,
  FormErrorMessage
} from '@chakra-ui/react';
import { StarIcon } from '@chakra-ui/icons';
import { useData } from '../../context/DataContext';
import { ActionType } from '../../context/DataContext';
import { v4 as uuidv4 } from 'uuid';
import { StrategyType, TradeDirection, TradeStatus, AnyTradeEntry, StockTradeEntry, OptionTradeEntry } from '../../types/tradeTracker';

interface PinTradeButtonProps {
  ticker: string;
  strategy?: StrategyType;
  direction?: TradeDirection;
  price?: number;
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: string;
  tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
  companyName?: string; // Add company name prop
  earningsDate?: string; // Add earnings date prop
  reportTime?: string; // Add report time prop (BMO/AMC)
}

/**
 * PinTradeButton Component
 * 
 * This component provides a button to quickly pin a trade idea from other tabs.
 * It can be used in DirectSearch and Options Strategies tabs.
 */
const PinTradeButton: React.FC<PinTradeButtonProps> = ({
  ticker,
  strategy = 'stock',
  direction = 'long',
  price,
  size = 'md',
  colorScheme = 'brand',
  tooltipPlacement = 'top',
  companyName = '', // Default to empty string
  earningsDate = '',
  reportTime = ''
}) => {
  const { dispatch } = useData();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  // Form state
  const [entryDate, setEntryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>(strategy);
  const [selectedDirection, setSelectedDirection] = useState<TradeDirection>(direction);
  
  // Form validation
  const [errors, setErrors] = useState<{
    entryDate?: string;
  }>({});
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const newErrors: {
      entryDate?: string;
    } = {};
    
    if (!entryDate) {
      newErrors.entryDate = 'Target entry date is required';
    }
    
    setErrors(newErrors);
    
    // If there are errors, don't submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    // Log for debugging
    console.log(`Creating trade idea for ${ticker} with company name: ${companyName}`);
    
    // Create new trade idea
    let newTradeIdea: AnyTradeEntry;
    
    // Create metadata object to store additional information
    const metadata: Record<string, any> = {
      companyName: companyName || '',
      currentPrice: price || 0,
      metrics: {
        avgVolume: 0,
        iv30Rv30: 0,
        tsSlope: 0
      },
      expectedMove: '',
      earningsDate: '',
      earningsTime: '', // 'BMO' (pre-market) or 'AMC' (after-hours)
      closestStrikes: [],
      estimatedSpreadCost: 0
    };
    
    if (selectedStrategy === 'stock') {
      const stockTradeIdea: StockTradeEntry = {
        id: uuidv4(),
        ticker: ticker.toUpperCase(),
        entryDate,
        entryPrice: 0, // Trade ideas should have no entry price
        quantity: 0, // Will be set when converted to actual trade
        direction: selectedDirection,
        status: 'open' as TradeStatus,
        strategy: 'stock',
        exitDate: undefined,
        exitPrice: undefined,
        stopLoss: undefined,
        takeProfit: undefined,
        profitLoss: undefined,
        fees: 0,
        notes,
        tags: ['pinned'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata // Add metadata with company name
      };
      newTradeIdea = stockTradeIdea;
    } else {
      const optionTradeIdea: OptionTradeEntry = {
        id: uuidv4(),
        ticker: ticker.toUpperCase(),
        entryDate,
        entryPrice: 0, // Trade ideas should have no entry price
        quantity: 0, // Will be set when converted to actual trade
        direction: selectedDirection,
        status: 'open' as TradeStatus,
        strategy: selectedStrategy as 'single_option' | 'vertical_spread' | 'iron_condor' | 'calendar_spread' |
                  'diagonal_spread' | 'covered_call' | 'protective_put' | 'straddle' |
                  'strangle' | 'butterfly' | 'custom',
        exitDate: undefined,
        exitPrice: undefined,
        stopLoss: undefined,
        takeProfit: undefined,
        profitLoss: undefined,
        fees: 0,
        notes,
        tags: ['pinned'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        legs: [],
        underlyingPrice: price || 0,
        metadata // Add metadata with company name
      };
      newTradeIdea = optionTradeIdea;
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
        title: 'Trade idea pinned',
        description: `${ticker.toUpperCase()} has been added to your trade ideas`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Try to fetch additional data for the trade idea
      try {
        const { analyzeOptions } = await import('../../services/optionsService');
        const result = await analyzeOptions(ticker, false);
        
        if (result) {
          // Update the trade with additional information
          const updatedMetadata = {
            ...newTradeIdea.metadata,
            currentPrice: result.currentPrice,
            metrics: {
              avgVolume: result.metrics.avgVolume,
              iv30Rv30: result.metrics.iv30Rv30,
              tsSlope: result.metrics.tsSlope
            },
            expectedMove: result.expectedMove,
            earningsDate: earningsDate || '', // Use passed earnings date
            earningsTime: reportTime || result.reportTime || '', // Use passed report time or fallback to result
            closestStrikes: result.optimalCalendarSpread ? [result.optimalCalendarSpread.strike] : [],
            estimatedSpreadCost: result.optimalCalendarSpread ? result.optimalCalendarSpread.spreadCost : 0
          };
          
          const updatedTrade = {
            ...newTradeIdea,
            metadata: updatedMetadata
          };
          
          // Update the trade in the database
          await tradeTrackerDB.updateTrade(updatedTrade);
          
          // Update the trade in the state
          dispatch({
            type: ActionType.UPDATE_TRADE_SUCCESS,
            payload: updatedTrade
          });
        }
      } catch (error) {
        console.error('Error fetching additional data for trade idea:', error);
        // Don't show an error toast since the trade was already created successfully
      }
      
      // Reset form and close modal
      resetForm();
      onClose();
    } catch (error) {
      // Dispatch error action
      dispatch({
        type: ActionType.CREATE_TRADE_ERROR,
        payload: error instanceof Error ? error.message : 'Failed to pin trade idea'
      });
      
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to pin trade idea',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Reset form
  const resetForm = () => {
    setEntryDate('');
    setNotes('');
    setSelectedStrategy(strategy);
    setSelectedDirection(direction);
    setErrors({});
  };
  
  return (
    <>
      <Tooltip label="Pin as trade idea" placement={tooltipPlacement}>
        <IconButton
          aria-label="Pin as trade idea"
          icon={<StarIcon />}
          size={size}
          colorScheme={colorScheme}
          variant="ghost"
          onClick={(e) => {
            // Stop event propagation to prevent row click
            e.stopPropagation();
            onOpen();
          }}
        />
      </Tooltip>
      
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Pin {ticker} as Trade Idea</ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            <VStack spacing={4} align="stretch">
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
                <FormLabel>Strategy</FormLabel>
                <Select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value as StrategyType)}
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
                  value={selectedDirection}
                  onChange={(e) => setSelectedDirection(e.target.value as TradeDirection)}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </Select>
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
            </VStack>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="brand" onClick={handleSubmit}>
              Pin Trade Idea
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PinTradeButton;