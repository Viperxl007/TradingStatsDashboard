import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Select,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  useColorMode,
  Badge,
  Tooltip,
  Icon,
  Collapse,
  useDisclosure,
  Alert,
  AlertIcon,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Heading
} from '@chakra-ui/react';
import { FiClock, FiInfo, FiSettings, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import {
  TIMEFRAME_CONFIGS,
  getTimeframeConfig,
  getRecommendedPeriods,
  validateCustomPeriod,
  formatPeriod,
  periodToDataPoints,
  getTimeframesByCategory
} from '../utils/timeframeConfig';

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  customPeriod?: string;
  onCustomPeriodChange?: (period: string) => void;
  showAdvanced?: boolean;
}

const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  selectedTimeframe,
  onTimeframeChange,
  customPeriod,
  onCustomPeriodChange,
  showAdvanced = true
}) => {
  const { colorMode } = useColorMode();
  const { isOpen: isAdvancedOpen, onToggle: onAdvancedToggle } = useDisclosure();
  
  const [tempCustomPeriod, setTempCustomPeriod] = useState(customPeriod || '');
  const [periodError, setPeriodError] = useState<string>('');

  const currentConfig = getTimeframeConfig(selectedTimeframe);
  const recommendedPeriods = getRecommendedPeriods(selectedTimeframe);

  // Handle custom period change
  const handleCustomPeriodChange = (period: string) => {
    setTempCustomPeriod(period);
    
    if (period) {
      const validation = validateCustomPeriod(period, selectedTimeframe);
      if (!validation.valid) {
        setPeriodError(validation.message || 'Invalid period');
        return;
      }
    }
    
    setPeriodError('');
    if (onCustomPeriodChange) {
      onCustomPeriodChange(period);
    }
  };

  // Apply recommended period
  const applyRecommendedPeriod = (period: string) => {
    setTempCustomPeriod(period);
    handleCustomPeriodChange(period);
  };

  const currentPeriod = customPeriod || currentConfig.standardPeriod;
  const dataPoints = periodToDataPoints(currentPeriod, selectedTimeframe);

  // Only render advanced settings when showAdvanced is true
  if (!showAdvanced) {
    return null;
  }

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <HStack spacing={2}>
          <Icon as={FiSettings} size="sm" />
          <Text fontWeight="semibold" fontSize="sm">Advanced Settings</Text>
        </HStack>
        <Button
          size="xs"
          variant="ghost"
          onClick={onAdvancedToggle}
          rightIcon={<Icon as={isAdvancedOpen ? FiCheck : FiSettings} />}
        >
          {isAdvancedOpen ? 'Hide' : 'Show'}
        </Button>
      </HStack>
      
      <Collapse in={isAdvancedOpen}>
        <VStack spacing={3} align="stretch">
          {/* Custom Period Input */}
          <FormControl isInvalid={!!periodError}>
            <FormLabel fontSize="xs">Custom Historical Period</FormLabel>
            <Input
              value={tempCustomPeriod}
              onChange={(e) => setTempCustomPeriod(e.target.value)}
              onBlur={() => handleCustomPeriodChange(tempCustomPeriod)}
              placeholder="e.g., 1w, 2mo, 6mo"
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
              size="sm"
            />
            {periodError ? (
              <FormErrorMessage fontSize="xs">{periodError}</FormErrorMessage>
            ) : (
              <FormHelperText fontSize="xs">
                Format: number + unit (d/w/m/y). Range: {formatPeriod(currentConfig.minPeriod)} to {formatPeriod(currentConfig.maxPeriod)}
              </FormHelperText>
            )}
          </FormControl>

          {/* Recommended Periods */}
          <Box>
            <Text fontSize="xs" fontWeight="semibold" mb={1}>
              Recommended for {currentConfig.label}
            </Text>
            <HStack spacing={1} flexWrap="wrap">
              {recommendedPeriods.map((period) => (
                <Button
                  key={period}
                  size="xs"
                  variant={currentPeriod === period ? "solid" : "outline"}
                  colorScheme={currentPeriod === period ? "blue" : "gray"}
                  onClick={() => applyRecommendedPeriod(period)}
                >
                  {formatPeriod(period)}
                </Button>
              ))}
            </HStack>
          </Box>

          {/* Data Points Warning */}
          {dataPoints > 500 && (
            <Alert status="warning" variant="left-accent" py={2}>
              <AlertIcon />
              <Box>
                <Text fontSize="xs" fontWeight="semibold">Large Dataset Warning</Text>
                <Text fontSize="xs" mt={1}>
                  {dataPoints} data points may slow loading. Consider a shorter period.
                </Text>
              </Box>
            </Alert>
          )}
        </VStack>
      </Collapse>
    </Box>
  );
};

export default TimeframeSelector;