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
  Text,
  useToast,
  RadioGroup,
  Radio,
  Stack,
  Alert,
  AlertIcon,
  Box,
  Badge,
  useColorModeValue
} from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';
import { OptionLeg } from '../../types/tradeTracker';

interface ExpirationOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  expiredLeg: OptionLeg;
  onOutcomeLogged: (outcome: { priceAtExpiration: number; wasForced: boolean }) => void;
}

/**
 * ExpirationOutcomeModal Component
 * 
 * This component prompts the user to log the outcome of an expired option leg.
 */
const ExpirationOutcomeModal: React.FC<ExpirationOutcomeModalProps> = ({ 
  isOpen, 
  onClose, 
  expiredLeg, 
  onOutcomeLogged 
}) => {
  const toast = useToast();
  
  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const cardBgColor = useColorModeValue('gray.50', 'gray.700');
  const impactBgColor = useColorModeValue('green.50', 'green.900');
  const impactBgColorForced = useColorModeValue('orange.50', 'orange.900');
  
  // Form state
  const [outcomeType, setOutcomeType] = useState<'worthless' | 'forced'>('worthless');
  const [priceAtExpiration, setPriceAtExpiration] = useState(0);
  
  // Handle form submission
  const handleSubmit = () => {
    const finalPrice = outcomeType === 'worthless' ? 0 : priceAtExpiration;
    
    // Validate forced close price
    if (outcomeType === 'forced' && finalPrice <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter the price paid for the forced buy-to-close',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // Log the outcome
    onOutcomeLogged({
      priceAtExpiration: finalPrice,
      wasForced: outcomeType === 'forced'
    });
    
    // Show success toast
    toast({
      title: 'Expiration Outcome Logged',
      description: outcomeType === 'worthless' 
        ? 'Leg expired worthless - full premium captured'
        : `Forced buy-to-close at $${finalPrice.toFixed(2)}`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
    
    // Close modal
    onClose();
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Log Expiration Outcome</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="info">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">Expired Option Leg Detected</Text>
                <Text fontSize="sm">
                  Please log what happened to this leg at expiration for accurate P&L tracking.
                </Text>
              </Box>
            </Alert>
            
            {/* Leg Details */}
            <Box p={3} borderWidth="1px" borderRadius="md" bg={cardBgColor}>
              <VStack align="stretch" spacing={2}>
                <Text fontWeight="bold">Expired Leg Details:</Text>
                <Text fontSize="sm">
                  <Badge colorScheme={expiredLeg.optionType === 'call' ? 'green' : 'red'} mr={2}>
                    {expiredLeg.optionType.toUpperCase()}
                  </Badge>
                  <Badge colorScheme={expiredLeg.isLong ? 'blue' : 'purple'} mr={2}>
                    {expiredLeg.isLong ? 'LONG' : 'SHORT'}
                  </Badge>
                  Strike: ${expiredLeg.strike.toFixed(2)}
                </Text>
                <Text fontSize="sm">
                  <strong>Expiration:</strong> {formatDate(expiredLeg.expiration)}
                </Text>
                <Text fontSize="sm">
                  <strong>Entry Premium:</strong> ${expiredLeg.premium.toFixed(2)} per contract
                </Text>
                <Text fontSize="sm">
                  <strong>Quantity:</strong> {expiredLeg.quantity} contract{expiredLeg.quantity !== 1 ? 's' : ''}
                </Text>
              </VStack>
            </Box>
            
            {/* Outcome Selection */}
            <FormControl isRequired>
              <FormLabel>What happened at expiration?</FormLabel>
              <RadioGroup value={outcomeType} onChange={(value) => setOutcomeType(value as 'worthless' | 'forced')}>
                <Stack direction="column" spacing={3}>
                  <Radio value="worthless">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium">Expired Worthless</Text>
                      <Text fontSize="sm" color="gray.600">
                        Option was out-of-the-money and expired with no value.
                        {expiredLeg.isLong ? ' Lost the premium paid.' : ' Kept the full premium received.'}
                      </Text>
                    </VStack>
                  </Radio>
                  <Radio value="forced">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium">Broker Forced Buy-to-Close</Text>
                      <Text fontSize="sm" color="gray.600">
                        Option was in-the-money and broker forced a buy-to-close transaction.
                      </Text>
                    </VStack>
                  </Radio>
                </Stack>
              </RadioGroup>
            </FormControl>
            
            {/* Price Input for Forced Close */}
            {outcomeType === 'forced' && (
              <FormControl isRequired>
                <FormLabel>Price Paid at Forced Close</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceAtExpiration}
                  onChange={(e) => setPriceAtExpiration(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Enter the price per contract that was paid for the forced buy-to-close
                </Text>
              </FormControl>
            )}
            
            {/* P&L Impact Preview */}
            <Box p={3} borderWidth="1px" borderRadius="md" bg={outcomeType === 'worthless' ? impactBgColor : impactBgColorForced}>
              <Text fontWeight="bold" mb={2}>P&L Impact:</Text>
              {outcomeType === 'worthless' ? (
                <Text fontSize="sm">
                  {expiredLeg.isLong 
                    ? `Loss: -$${(expiredLeg.premium * expiredLeg.quantity * 100).toFixed(2)} (premium paid lost)`
                    : `Profit: +$${(expiredLeg.premium * expiredLeg.quantity * 100).toFixed(2)} (full premium captured)`
                  }
                </Text>
              ) : (
                <Text fontSize="sm">
                  {expiredLeg.isLong
                    ? `Additional Loss: -$${(priceAtExpiration * expiredLeg.quantity * 100).toFixed(2)} (forced close cost)`
                    : `Reduced Profit: -$${(priceAtExpiration * expiredLeg.quantity * 100).toFixed(2)} (forced buy-back cost)`
                  }
                </Text>
              )}
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
            Log Outcome
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ExpirationOutcomeModal;