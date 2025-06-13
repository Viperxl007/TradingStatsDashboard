import React from 'react';
import {
  Box,
  Text,
  Badge,
  VStack,
  HStack,
  useColorMode,
  Tooltip
} from '@chakra-ui/react';
import { KeyLevel } from '../types/chartAnalysis';

interface ChartAnnotationsProps {
  keyLevels: KeyLevel[];
  chartHeight: number;
  ticker: string;
  currentPrice?: number;
}

const ChartAnnotations: React.FC<ChartAnnotationsProps> = ({
  keyLevels,
  chartHeight,
  ticker,
  currentPrice
}) => {
  const { colorMode } = useColorMode();

  // Calculate position for each level based on price
  const calculatePosition = (price: number): number => {
    if (!currentPrice) return 50; // Default to middle if no current price
    
    // Simple calculation - in a real implementation, you'd need the chart's price range
    // This is a placeholder that positions levels relative to current price
    const priceRange = currentPrice * 0.2; // Assume 20% range around current price
    const minPrice = currentPrice - priceRange;
    const maxPrice = currentPrice + priceRange;
    
    // Clamp price to visible range
    const clampedPrice = Math.max(minPrice, Math.min(maxPrice, price));
    
    // Convert to percentage position (inverted because chart coordinates are top-down)
    const percentage = ((maxPrice - clampedPrice) / (maxPrice - minPrice)) * 100;
    
    return Math.max(5, Math.min(95, percentage)); // Keep within 5-95% range
  };

  // Get color for level type
  const getLevelColor = (type: string, strength: string) => {
    const baseColors = {
      support: 'green',
      resistance: 'red',
      pivot: 'blue'
    };
    
    const opacity = strength === 'strong' ? '0.8' : strength === 'moderate' ? '0.6' : '0.4';
    return `${baseColors[type as keyof typeof baseColors]}.500`;
  };

  // Get line style based on strength
  const getLineStyle = (strength: string) => {
    switch (strength) {
      case 'strong':
        return { borderWidth: '2px', borderStyle: 'solid' };
      case 'moderate':
        return { borderWidth: '1px', borderStyle: 'solid' };
      case 'weak':
        return { borderWidth: '1px', borderStyle: 'dashed' };
      default:
        return { borderWidth: '1px', borderStyle: 'dotted' };
    }
  };

  if (keyLevels.length === 0) {
    return null;
  }

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
      zIndex={10}
    >
      {keyLevels.map((level, index) => {
        const position = calculatePosition(level.price);
        const color = getLevelColor(level.type, level.strength);
        const lineStyle = getLineStyle(level.strength);
        
        return (
          <Box
            key={index}
            position="absolute"
            left={0}
            right={0}
            top={`${position}%`}
            transform="translateY(-50%)"
          >
            {/* Horizontal Line */}
            <Box
              width="100%"
              height="0"
              borderTop={`${lineStyle.borderWidth} ${lineStyle.borderStyle}`}
              borderColor={color}
              opacity={0.7}
            />
            
            {/* Level Label */}
            <Box
              position="absolute"
              right={2}
              top="50%"
              transform="translateY(-50%)"
              pointerEvents="auto"
            >
              <Tooltip
                label={
                  <VStack spacing={1} align="start">
                    <Text fontSize="xs" fontWeight="bold">
                      {level.type.toUpperCase()} - ${level.price.toFixed(2)}
                    </Text>
                    <Text fontSize="xs">{level.description}</Text>
                    <Text fontSize="xs">
                      Strength: {level.strength} | Confidence: {Math.round(level.confidence * 100)}%
                    </Text>
                  </VStack>
                }
                placement="left"
                hasArrow
              >
                <Badge
                  colorScheme={level.type === 'support' ? 'green' : level.type === 'resistance' ? 'red' : 'blue'}
                  variant="solid"
                  size="sm"
                  cursor="pointer"
                  opacity={0.9}
                  _hover={{ opacity: 1 }}
                >
                  <VStack spacing={0}>
                    <Text fontSize="xs" lineHeight="1">
                      {level.type.charAt(0).toUpperCase()}
                    </Text>
                    <Text fontSize="xs" lineHeight="1">
                      ${level.price.toFixed(2)}
                    </Text>
                  </VStack>
                </Badge>
              </Tooltip>
            </Box>
            
            {/* Price Label on Left */}
            <Box
              position="absolute"
              left={2}
              top="50%"
              transform="translateY(-50%)"
              pointerEvents="auto"
            >
              <Badge
                variant="outline"
                colorScheme={level.type === 'support' ? 'green' : level.type === 'resistance' ? 'red' : 'blue'}
                size="sm"
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                opacity={0.9}
              >
                <Text fontSize="xs">
                  ${level.price.toFixed(2)}
                </Text>
              </Badge>
            </Box>
          </Box>
        );
      })}
      
      {/* Legend */}
      <Box
        position="absolute"
        top={4}
        left={4}
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        p={2}
        borderRadius="md"
        boxShadow="sm"
        opacity={0.9}
        pointerEvents="auto"
      >
        <VStack spacing={1} align="start">
          <Text fontSize="xs" fontWeight="bold" mb={1}>
            Key Levels ({keyLevels.length})
          </Text>
          
          <HStack spacing={2}>
            <Box w={3} h={0} borderTop="2px solid" borderColor="green.500" />
            <Text fontSize="xs">Support</Text>
          </HStack>
          
          <HStack spacing={2}>
            <Box w={3} h={0} borderTop="2px solid" borderColor="red.500" />
            <Text fontSize="xs">Resistance</Text>
          </HStack>
          
          <HStack spacing={2}>
            <Box w={3} h={0} borderTop="2px solid" borderColor="blue.500" />
            <Text fontSize="xs">Pivot</Text>
          </HStack>
          
          <Text fontSize="xs" color="gray.500" mt={1}>
            Hover for details
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default ChartAnnotations;