import React from 'react';
import { Box, Tooltip, Flex, Text } from '@chakra-ui/react';

interface LiquidityThermometerProps {
  liquidityScore: number;
  hasZeroBids?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * LiquidityThermometer Component
 * 
 * Displays a thermometer visualization for a liquidity score with a color gradient
 * from red (poor liquidity) to yellow (moderate liquidity) to green (high liquidity).
 * 
 * Liquidity ranges:
 * - Below 3.0: Poor (red) - Wide spreads, low volume, or zero bids
 * - 3.0-7.0: Moderate (yellow) - Acceptable spreads and volume
 * - Above 7.0: High (green) - Tight spreads, high volume
 */
const LiquidityThermometer: React.FC<LiquidityThermometerProps> = ({ 
  liquidityScore, 
  hasZeroBids = false,
  size = 'md' 
}) => {
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

  // Calculate position and color based on liquidity score
  const getPositionAndColor = () => {
    // If there are zero bids, force the lowest score
    const effectiveScore = hasZeroBids ? 0 : liquidityScore;
    
    // Clamp score between 0 and 10 for positioning
    const clampedScore = Math.max(0, Math.min(10, effectiveScore));
    
    // Position as percentage (0 to 100%)
    const position = (clampedScore / 10) * 100;
    
    // Color based on liquidity ranges
    let color;
    if (hasZeroBids || effectiveScore < 3.0) {
      color = 'red.500'; // Poor liquidity
    } else if (effectiveScore < 7.0) {
      color = 'yellow.500'; // Moderate liquidity
    } else {
      color = 'green.500'; // High liquidity
    }
    
    return { position, color };
  };

  const { position, color } = getPositionAndColor();

  // Get liquidity description
  const getLiquidityDescription = () => {
    if (hasZeroBids) {
      return 'Poor liquidity - Contains zero bids';
    } else if (liquidityScore < 3.0) {
      return 'Poor liquidity - Wide spreads, low volume';
    } else if (liquidityScore < 7.0) {
      return 'Moderate liquidity - Acceptable spreads and volume';
    } else {
      return 'High liquidity - Tight spreads, good volume';
    }
  };

  return (
    <Tooltip 
      label={`Liquidity: ${liquidityScore.toFixed(1)} - ${getLiquidityDescription()}`}
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
          
          {/* Liquidity indicator */}
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
          {hasZeroBids ? "Zero Bids" : liquidityScore.toFixed(1)}
        </Text>
      </Flex>
    </Tooltip>
  );
};

export default LiquidityThermometer;