import React from 'react';
import {
  VStack,
  Text,
  Box,
  CircularProgress,
  CircularProgressLabel,
  Badge,
  useColorMode
} from '@chakra-ui/react';
import { ConfidenceGaugeProps } from '../types/macroSentiment';

const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  confidence,
  size = 'md',
  showLabel = true
}) => {
  const { colorMode } = useColorMode();

  const getConfidenceColor = (value: number): string => {
    if (value <= 25) return '#E53E3E'; // Red
    if (value <= 50) return '#DD6B20'; // Orange
    if (value <= 75) return '#D69E2E'; // Yellow
    return '#38A169'; // Green
  };

  const getConfidenceColorScheme = (value: number): string => {
    if (value <= 25) return 'red';
    if (value <= 50) return 'orange';
    if (value <= 75) return 'yellow';
    return 'green';
  };

  const getConfidenceLabel = (value: number): string => {
    if (value <= 25) return 'Very Low';
    if (value <= 50) return 'Low';
    if (value <= 75) return 'Moderate';
    return 'High';
  };

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return { circularSize: '60px', fontSize: 'md', thickness: '6px' };
      case 'lg':
        return { circularSize: '100px', fontSize: '2xl', thickness: '10px' };
      default:
        return { circularSize: '80px', fontSize: 'xl', thickness: '8px' };
    }
  };

  const sizeConfig = getSizeConfig();

  return (
    <VStack spacing={3} align="center">
      {showLabel && (
        <Text fontSize="sm" fontWeight="500" color="gray.600">
          Overall Confidence
        </Text>
      )}
      
      <Box position="relative">
        <CircularProgress 
          value={confidence} 
          size={sizeConfig.circularSize}
          thickness={sizeConfig.thickness}
          color={getConfidenceColor(confidence)}
          trackColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <CircularProgressLabel>
            <VStack spacing={0}>
              <Text fontSize={sizeConfig.fontSize} fontWeight="bold">
                {confidence}
              </Text>
              <Text fontSize="xs" color="gray.500">
                /100
              </Text>
            </VStack>
          </CircularProgressLabel>
        </CircularProgress>
        
        {/* Confidence level indicator */}
        <Badge 
          position="absolute" 
          bottom="-8px" 
          left="50%" 
          transform="translateX(-50%)"
          colorScheme={getConfidenceColorScheme(confidence)}
          fontSize="xs"
        >
          {getConfidenceLabel(confidence)}
        </Badge>
      </Box>
    </VStack>
  );
};

export default ConfidenceGauge;