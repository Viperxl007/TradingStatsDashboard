import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Input,
  useDisclosure,
  useToast,
  Spinner
} from '@chakra-ui/react';
import {
  closeTradeManually,
  ManualCloseReason
} from '../services/manualTradeCloseService';

interface ManualTradeCloseButtonsProps {
  ticker: string;
  onTradeClose?: () => void;
  onClearOverlays?: () => void;
}

interface ActiveTrade {
  id: number;
  ticker: string;
  action: string;
  entry_price: number;
  current_price?: number;
  target_price?: number;
  stop_loss?: number;
  status: string;
}

/**
 * Manual Trade Close Buttons Component
 * 
 * Shows three action buttons when there's an active trade:
 * - 🎯 PROFIT HIT: Close at target price
 * - 🛡️ STOP LOSS HIT: Close at stop loss price  
 * - ⏰ EARLY CLOSE: Close with custom price
 */
const ManualTradeCloseButtons: React.FC<ManualTradeCloseButtonsProps> = ({
  ticker,
  onTradeClose,
  onClearOverlays
}) => {
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [customClosePrice, setCustomClosePrice] = useState<string>('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Check for active trades
  const checkForActiveTrades = async () => {
    if (!ticker) return;

    try {
      const response = await fetch('http://localhost:5000/api/active-trades/all');
      const data = await response.json();
      
      if (data.active_trades) {
        const trade = data.active_trades.find((t: ActiveTrade) =>
          t.ticker === ticker && (t.status === 'active' || t.status === 'waiting')
        );
        
        if (trade) {
          console.log(`🎯 [ManualTradeCloseButtons] Found active trade for ${ticker}:`, trade);
          setActiveTrade(trade);
        } else {
          setActiveTrade(null);
        }
      } else {
        setActiveTrade(null);
      }
    } catch (error) {
      console.error(`❌ [ManualTradeCloseButtons] Error checking active trades:`, error);
      setActiveTrade(null);
    }
  };

  // Check for active trades when ticker changes
  useEffect(() => {
    checkForActiveTrades();
  }, [ticker]);

  // Handle manual close
  const handleManualClose = async (reason: ManualCloseReason, closePrice?: number) => {
    if (!activeTrade || isClosing) return;

    setIsClosing(true);

    try {
      let finalClosePrice = closePrice;
      
      // Determine close price based on reason
      if (!finalClosePrice) {
        switch (reason) {
          case 'profit_hit':
            finalClosePrice = activeTrade.target_price || activeTrade.current_price || activeTrade.entry_price;
            break;
          case 'stop_hit':
            finalClosePrice = activeTrade.stop_loss || activeTrade.current_price || activeTrade.entry_price;
            break;
          case 'user_closed':
            finalClosePrice = activeTrade.current_price || activeTrade.entry_price;
            break;
        }
      }

      if (!finalClosePrice || finalClosePrice <= 0) {
        toast({
          title: 'Invalid Price',
          description: 'Unable to determine close price',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      console.log(`🎯 [ManualTradeCloseButtons] Closing ${ticker} trade:`, {
        reason,
        closePrice: finalClosePrice
      });

      const result = await closeTradeManually({
        ticker,
        reason,
        closePrice: finalClosePrice,
        notes: `Manual close from chart interface`
      });

      if (result.success) {
        toast({
          title: 'Trade Closed',
          description: result.message,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        // Clear the active trade state
        setActiveTrade(null);
        
        // TEMPORARY FIX: Disable chart clearing to prevent "Object is disposed" error
        // The chart overlays will remain but this prevents the crash
        console.log(`🚫 [ManualTradeCloseButtons] Chart clearing disabled to prevent disposal errors for ${ticker}`);
        // if (onClearOverlays) {
        //   console.log(`🧹 [ManualTradeCloseButtons] Triggering comprehensive chart clearing for ${ticker}`);
        //   onClearOverlays();
        // }
        
        if (onTradeClose) {
          onTradeClose();
        }
      } else {
        toast({
          title: 'Close Failed',
          description: result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error(`❌ [ManualTradeCloseButtons] Error closing trade:`, error);
      toast({
        title: 'Error',
        description: 'Failed to close trade',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsClosing(false);
      onClose();
      setCustomClosePrice('');
    }
  };

  // Handle early close with custom price
  const handleEarlyClose = () => {
    if (!activeTrade) return;
    
    const suggestedPrice = activeTrade.current_price || activeTrade.entry_price;
    setCustomClosePrice(suggestedPrice.toFixed(2));
    onOpen();
  };

  // Handle early close confirmation
  const handleEarlyCloseConfirm = () => {
    const price = parseFloat(customClosePrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid price',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    handleManualClose('user_closed', price);
  };

  // Don't render if no active trade
  if (!activeTrade) {
    return null;
  }

  return (
    <>
      {/* Manual Close Buttons - Header-friendly horizontal layout */}
      <HStack spacing={2}>
        {/* Profit Hit Button */}
        <Button
          size="xs"
          bg="green.600"
          color="white"
          _hover={{ bg: "green.500" }}
          _active={{ bg: "green.700" }}
          onClick={() => handleManualClose('profit_hit')}
          isLoading={isClosing}
          isDisabled={isClosing}
          fontSize="xs"
          fontWeight="medium"
          h="24px"
          px={2}
        >
          🎯 PROFIT
        </Button>

        {/* Stop Loss Hit Button */}
        <Button
          size="xs"
          bg="red.600"
          color="white"
          _hover={{ bg: "red.500" }}
          _active={{ bg: "red.700" }}
          onClick={() => handleManualClose('stop_hit')}
          isLoading={isClosing}
          isDisabled={isClosing}
          fontSize="xs"
          fontWeight="medium"
          h="24px"
          px={2}
        >
          🛡️ STOP
        </Button>

        {/* Early Close Button */}
        <Button
          size="xs"
          bg="blue.600"
          color="white"
          _hover={{ bg: "blue.500" }}
          _active={{ bg: "blue.700" }}
          onClick={handleEarlyClose}
          isLoading={isClosing}
          isDisabled={isClosing}
          fontSize="xs"
          fontWeight="medium"
          h="24px"
          px={2}
        >
          ⏰ CLOSE
        </Button>
      </HStack>

      {/* Early Close Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Early Close Trade</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Close {ticker} trade at custom price:
              </Text>
              <Input
                placeholder="Enter close price"
                value={customClosePrice}
                onChange={(e) => setCustomClosePrice(e.target.value)}
                type="number"
                step="0.01"
              />
              <Text fontSize="sm" color="gray.500">
                Entry: ${activeTrade.entry_price?.toFixed(2)}
                {activeTrade.current_price && (
                  <> | Current: ${activeTrade.current_price.toFixed(2)}</>
                )}
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorScheme="orange"
              onClick={handleEarlyCloseConfirm}
              isLoading={isClosing}
            >
              Close Trade
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ManualTradeCloseButtons;