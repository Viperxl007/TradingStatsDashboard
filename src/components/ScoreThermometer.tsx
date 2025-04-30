import React from 'react';
import { Box, Tooltip, Flex, Text } from '@chakra-ui/react';

interface ScoreThermometerProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * ScoreThermometer Component
 * 
 * Displays a thermometer visualization for a score value with a color gradient
 * from blue (cold/low score) to red (hot/high score).
 * 
 * Score ranges:
 * - Below 1.0: Poor (blue)
 * - 1.0-2.0: Moderate (green to yellow)
 * - 2.0-3.0: Strong (orange)
 * - Above 3.0: Exceptional (red)
 */
const ScoreThermometer: React.FC<ScoreThermometerProps> = ({ score, size = 'md' }) => {
  // Determine dimensions based on size
  const getSize = () => {
    switch (size) {
      case 'sm':
        return { width: '60px', height: '12px', fontSize: 'xs', indicatorSize: '10px' };
      case 'lg':
        return { width: '100px', height: '20px', fontSize: 'md', indicatorSize: '16px' };
      case 'md':
      default:
        return { width: '80px', height: '16px', fontSize: 'sm', indicatorSize: '14px' };
    }
  };

  const { width, height, fontSize, indicatorSize } = getSize();

  // Calculate position and color based on score
  const getPositionAndColor = () => {
    // Clamp score between 0 and 4 for positioning
    const clampedScore = Math.max(0, Math.min(4, score));
    
    // Position as percentage (0 to 100%)
    const position = (clampedScore / 4) * 100;
    
    // Color based on score ranges
    let color;
    if (score < 1.0) {
      color = 'blue.500'; // Poor
    } else if (score < 2.0) {
      color = score < 1.5 ? 'green.500' : 'yellow.500'; // Moderate
    } else if (score < 3.0) {
      color = 'orange.500'; // Strong
    } else {
      color = 'red.500'; // Exceptional
    }
    
    return { position, color };
  };

  const { position, color } = getPositionAndColor();

  return (
    <Tooltip 
      label={`Score: ${score.toFixed(2)} - ${
        score < 1.0 ? 'Poor opportunity' :
        score < 2.0 ? 'Moderate opportunity' :
        score < 3.0 ? 'Strong opportunity' :
        'Exceptional opportunity'
      }`}
      placement="top"
    >
      <Flex direction="column" alignItems="center">
        <Box
          position="relative"
          width={width}
          height={height}
          bg="gray.200"
          borderRadius="full"
          overflow="hidden"
        >
          {/* Gradient background */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bgGradient="linear(to-r, blue.500, green.500, yellow.500, orange.500, red.500)"
          />
          
          {/* Score indicator */}
          <Box
            position="absolute"
            top="50%"
            left={`${position}%`}
            transform="translate(-50%, -50%)"
            width={indicatorSize}
            height={indicatorSize}
            borderRadius="full"
            bg={color}
            border="2px solid white"
            boxShadow="0 0 4px rgba(0, 0, 0, 0.3)"
          />
        </Box>
        <Text fontSize={fontSize} mt="1" fontWeight="bold">
          {score.toFixed(2)}
        </Text>
      </Flex>
    </Tooltip>
  );
};

export default ScoreThermometer;