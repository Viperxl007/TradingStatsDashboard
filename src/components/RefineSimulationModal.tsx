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
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Text,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tooltip,
  Icon,
  Box,
  Divider,
  useColorModeValue
} from '@chakra-ui/react';
import { FiInfo, FiTrendingDown, FiBarChart, FiTarget } from 'react-icons/fi';
import { EnhancedHistoricalData } from '../types';

interface RefineSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefine: (enhancedData: EnhancedHistoricalData) => void;
  ticker: string;
  isLoading?: boolean;
}

/**
 * RefineSimulationModal Component
 * 
 * Allows users to input optional enhanced historical data to improve Monte Carlo simulation accuracy.
 * All fields are optional - the simulation will use default behavior for any missing data.
 */
const RefineSimulationModal: React.FC<RefineSimulationModalProps> = ({
  isOpen,
  onClose,
  onRefine,
  ticker,
  isLoading = false
}) => {
  const [avgHistoricalIvCrushPostEarnings, setAvgHistoricalIvCrushPostEarnings] = useState<number | undefined>(undefined);
  const [avgEarningsMoveHistorically, setAvgEarningsMoveHistorically] = useState<number | undefined>(undefined);
  const [historicalImpliedMoveAccuracy, setHistoricalImpliedMoveAccuracy] = useState<number | undefined>(undefined);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleSubmit = () => {
    const enhancedData: EnhancedHistoricalData = {};
    
    // Only include values that were actually entered
    if (avgHistoricalIvCrushPostEarnings !== undefined) {
      // Convert positive input to negative (IV crush is always negative)
      enhancedData.avgHistoricalIvCrushPostEarnings = avgHistoricalIvCrushPostEarnings > 0 
        ? -avgHistoricalIvCrushPostEarnings / 100 
        : avgHistoricalIvCrushPostEarnings / 100;
    }
    
    if (avgEarningsMoveHistorically !== undefined) {
      enhancedData.avgEarningsMoveHistorically = avgEarningsMoveHistorically;
    }
    
    if (historicalImpliedMoveAccuracy !== undefined) {
      enhancedData.historicalImpliedMoveAccuracy = historicalImpliedMoveAccuracy;
    }

    onRefine(enhancedData);
  };

  const handleClose = () => {
    // Reset form
    setAvgHistoricalIvCrushPostEarnings(undefined);
    setAvgEarningsMoveHistorically(undefined);
    setHistoricalImpliedMoveAccuracy(undefined);
    onClose();
  };

  const hasAnyData = avgHistoricalIvCrushPostEarnings !== undefined || 
                     avgEarningsMoveHistorically !== undefined || 
                     historicalImpliedMoveAccuracy !== undefined;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader>
          <HStack>
            <Icon as={FiBarChart} color="blue.500" />
            <Text>Refine Simulation for {ticker}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Optional Enhancement Data</AlertTitle>
                <AlertDescription>
                  Provide any historical data you have for {ticker} to improve simulation accuracy. 
                  All fields are optional - leave blank to use default market behavior.
                </AlertDescription>
              </Box>
            </Alert>

            <VStack spacing={4} align="stretch">
              {/* IV Crush Input */}
              <Box p={4} borderWidth="1px" borderColor={borderColor} borderRadius="md">
                <FormControl>
                  <FormLabel>
                    <HStack>
                      <Icon as={FiTrendingDown} color="red.500" />
                      <Text>Average Historical IV Crush Post Earnings</Text>
                      <Tooltip label="The average percentage drop in implied volatility after earnings announcements for this ticker. Enter as positive percentage (e.g., 45 for 45% crush).">
                        <span><Icon as={FiInfo} color="gray.400" /></span>
                      </Tooltip>
                    </HStack>
                  </FormLabel>
                  <NumberInput
                    value={avgHistoricalIvCrushPostEarnings || ''}
                    onChange={(_, value) => setAvgHistoricalIvCrushPostEarnings(isNaN(value) ? undefined : value)}
                    min={0}
                    max={80}
                    precision={1}
                    step={0.5}
                  >
                    <NumberInputField placeholder="e.g., 45.0 (for 45% crush)" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Typical range: 25% - 65%. Higher values indicate more severe IV crush.
                  </Text>
                </FormControl>
              </Box>

              {/* Historical Earnings Move Input */}
              <Box p={4} borderWidth="1px" borderColor={borderColor} borderRadius="md">
                <FormControl>
                  <FormLabel>
                    <HStack>
                      <Icon as={FiBarChart} color="green.500" />
                      <Text>Average Earnings Move Historically</Text>
                      <Tooltip label="The average percentage price movement (up or down) that this ticker experiences on earnings announcements. Enter as positive percentage.">
                        <span><Icon as={FiInfo} color="gray.400" /></span>
                      </Tooltip>
                    </HStack>
                  </FormLabel>
                  <NumberInput
                    value={avgEarningsMoveHistorically || ''}
                    onChange={(_, value) => setAvgEarningsMoveHistorically(isNaN(value) ? undefined : value)}
                    min={0}
                    max={50}
                    precision={1}
                    step={0.1}
                  >
                    <NumberInputField placeholder="e.g., 8.5 (for 8.5% average move)" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Typical range: 3% - 20%. This is the actual move regardless of direction.
                  </Text>
                </FormControl>
              </Box>

              {/* Implied Move Accuracy Input */}
              <Box p={4} borderWidth="1px" borderColor={borderColor} borderRadius="md">
                <FormControl>
                  <FormLabel>
                    <HStack>
                      <Icon as={FiTarget} color="purple.500" />
                      <Text>Historical Implied Move Accuracy</Text>
                      <Tooltip label="The percentage of time that the actual earnings move stayed within the implied move range for this ticker. Higher values indicate more predictable earnings moves.">
                        <span><Icon as={FiInfo} color="gray.400" /></span>
                      </Tooltip>
                    </HStack>
                  </FormLabel>
                  <NumberInput
                    value={historicalImpliedMoveAccuracy || ''}
                    onChange={(_, value) => setHistoricalImpliedMoveAccuracy(isNaN(value) ? undefined : value)}
                    min={0}
                    max={100}
                    precision={0}
                    step={1}
                  >
                    <NumberInputField placeholder="e.g., 68 (for 68% accuracy)" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Typical range: 50% - 85%. Higher values indicate more reliable implied moves.
                  </Text>
                </FormControl>
              </Box>
            </VStack>

            <Divider />

            {hasAnyData && (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                <AlertDescription>
                  Enhanced data will be used to improve simulation accuracy for {ticker}. 
                  The Monte Carlo simulation will factor in your historical data alongside market conditions.
                </AlertDescription>
              </Alert>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleSubmit}
            isLoading={isLoading}
            loadingText="Refining..."
          >
            {hasAnyData ? 'Refine Simulation' : 'Run Default Simulation'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RefineSimulationModal;