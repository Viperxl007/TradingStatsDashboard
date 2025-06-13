import React from 'react';
import { Box, HStack, VStack, Text, useColorMode } from '@chakra-ui/react';
import { TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';

interface TradingLegendProps {
  recommendation: TradingRecommendationType | null;
  currentTimeframe: string;
  show: boolean;
}

/**
 * Trading Legend Component
 * 
 * Displays a compact legend showing the color coding for trading lines:
 * - Blue line: Entry
 * - Green line: Target  
 * - Red line: Stop Loss
 */
const TradingLegend: React.FC<TradingLegendProps> = ({
  recommendation,
  currentTimeframe,
  show
}) => {
  const { colorMode } = useColorMode();

  console.log('🎯 [TradingLegend] Debug:', {
    show,
    recommendation,
    isActive: recommendation?.isActive,
    currentTimeframe,
    recommendationTimeframe: recommendation?.timeframe,
    timeframeMatch: currentTimeframe === recommendation?.timeframe
  });

  if (!show || !recommendation || !recommendation.isActive || currentTimeframe !== recommendation.timeframe) {
    console.log('🎯 [TradingLegend] Not showing legend - conditions not met');
    return null;
  }

  console.log('🎯 [TradingLegend] Showing legend!');

  return (
    <Box
      position="absolute"
      top="12px"
      left="50%"
      transform="translateX(-50%)"
      bg={colorMode === 'dark' ? 'rgba(26, 32, 44, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
      backdropFilter="blur(10px)"
      borderRadius="8px"
      p={3}
      border="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      boxShadow="lg"
      zIndex={1000}
      pointerEvents="none"
    >
      <HStack spacing={6} align="center">
        {/* Entry */}
        {recommendation.entryPrice && (
          <HStack spacing={2}>
            <Box w="12px" h="2px" bg="#3b82f6" borderRadius="1px" />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
              Entry
            </Text>
          </HStack>
        )}
        
        {/* Target */}
        {recommendation.targetPrice && (
          <HStack spacing={2}>
            <Box w="12px" h="2px" bg="#22c55e" borderRadius="1px" />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
              Target
            </Text>
          </HStack>
        )}
        
        {/* Stop Loss */}
        {recommendation.stopLoss && (
          <HStack spacing={2}>
            <Box w="12px" h="2px" bg="#ef4444" borderRadius="1px" />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
              Stop Loss
            </Text>
          </HStack>
        )}
      </HStack>
    </Box>
  );
};

export default TradingLegend;