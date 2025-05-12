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
 * from red (poor score) to yellow (moderate score) to green (high score).
 *
 * Score ranges (normalized to 100):
 * - Below 25: Poor (red)
 * - 25-50: Moderate (yellow)
 * - 50-75: Strong (light green)
 * - Above 75: Exceptional (green)
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
    // Clamp score between 0 and 100 for positioning
    const clampedScore = Math.max(0, Math.min(100, score));
    
    // Position as percentage (0 to 100%)
    const position = clampedScore;
    
    // Color based on score ranges
    let color;
    if (score < 25) {
      color = 'red.500'; // Poor
    } else if (score < 50) {
      color = 'yellow.500'; // Moderate
    } else if (score < 75) {
      color = 'green.300'; // Strong
    } else {
      color = 'green.500'; // Exceptional
    }
    
    return { position, color };
  };

  const { position, color } = getPositionAndColor();

  return (
    <Tooltip
      label={`Strategy Score: ${score.toFixed(2)} - ${
        score < 25 ? 'Poor opportunity' :
        score < 50 ? 'Moderate opportunity' :
        score < 75 ? 'Strong opportunity' :
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
            bgGradient="linear(to-r, red.500, yellow.500, green.500)"
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
        <Text fontSize={fontSize} mt="1" fontWeight="bold" color={color}>
          {score.toFixed(2)}
        </Text>
      </Flex>
    </Tooltip>
  );
};

export default ScoreThermometer;