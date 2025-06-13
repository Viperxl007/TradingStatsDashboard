import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Card,
  CardBody,
  CardHeader,
  useColorMode,
  Icon,
  Flex,
  Divider,
  Tooltip
} from '@chakra-ui/react';
import { FiTarget, FiShield, FiTrendingUp, FiTrendingDown, FiClock } from 'react-icons/fi';
import { TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';
import { formatRecommendationSummary, isRecommendationActive } from '../services/tradingRecommendationService';

interface TradingRecommendationPanelProps {
  recommendations: Map<string, TradingRecommendationType>;
  currentTimeframe: string;
  ticker: string;
}

/**
 * Trading Recommendation Panel Component
 * 
 * Displays active trading recommendations for the current timeframe
 * Shows entry, target, stop loss, and risk/reward information
 */
const TradingRecommendationPanel: React.FC<TradingRecommendationPanelProps> = ({
  recommendations,
  currentTimeframe,
  ticker
}) => {
  const { colorMode } = useColorMode();

  // Get the current recommendation for this ticker and timeframe
  const currentRecommendation = recommendations.get(`${ticker}-${currentTimeframe}`);

  // Check if the recommendation is still active
  const isActive = currentRecommendation ? isRecommendationActive(currentRecommendation) : false;

  if (!currentRecommendation || !isActive) {
    return (
      <Card>
        <CardHeader>
          <HStack spacing={2}>
            <Icon as={FiTarget} color="gray.500" />
            <Text fontWeight="semibold">Trading Recommendations</Text>
          </HStack>
        </CardHeader>
        <CardBody>
          <Text color="gray.500" textAlign="center" py={4}>
            No active trading recommendations for {ticker} on {currentTimeframe} timeframe
          </Text>
        </CardBody>
      </Card>
    );
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy': return 'green';
      case 'sell': return 'red';
      default: return 'gray';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy': return FiTrendingUp;
      case 'sell': return FiTrendingDown;
      default: return FiTarget;
    }
  };

  const formatTimeRemaining = (expiresAt?: number) => {
    if (!expiresAt) return 'No expiration';
    
    const now = Date.now();
    const timeLeft = expiresAt - now;
    
    if (timeLeft <= 0) return 'Expired';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Expires soon';
  };

  return (
    <Card>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <HStack spacing={2}>
            <Icon as={FiTarget} color="blue.500" />
            <Text fontWeight="semibold">Trading Recommendations</Text>
          </HStack>
          
          <HStack spacing={2}>
            <Badge
              colorScheme={getActionColor(currentRecommendation.action)}
              variant="solid"
              px={3}
              py={1}
              borderRadius="full"
            >
              <HStack spacing={1}>
                <Icon as={getActionIcon(currentRecommendation.action)} />
                <Text>{currentRecommendation.action.toUpperCase()}</Text>
              </HStack>
            </Badge>
            
            <Tooltip label={`Valid for ${currentTimeframe} timeframe`}>
              <Badge colorScheme="blue" variant="outline">
                {currentTimeframe}
              </Badge>
            </Tooltip>
          </HStack>
        </Flex>
      </CardHeader>
      
      <CardBody>
        <VStack spacing={4} align="stretch">
          {/* Summary */}
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Summary
            </Text>
            <Text fontSize="sm" color="gray.600">
              {formatRecommendationSummary(currentRecommendation)}
            </Text>
          </Box>
          
          <Divider />
          
          {/* Price Levels */}
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium">
              Price Levels
            </Text>
            
            {currentRecommendation.entryPrice && (
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Icon as={FiTarget} color="blue.500" boxSize={4} />
                  <Text fontSize="sm">Entry Price:</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="semibold">
                  ${currentRecommendation.entryPrice.toFixed(2)}
                </Text>
              </HStack>
            )}
            
            {currentRecommendation.targetPrice && (
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Icon as={FiTrendingUp} color="green.500" boxSize={4} />
                  <Text fontSize="sm">Target Price:</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="semibold" color="green.500">
                  ${currentRecommendation.targetPrice.toFixed(2)}
                </Text>
              </HStack>
            )}
            
            {currentRecommendation.stopLoss && (
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Icon as={FiShield} color="red.500" boxSize={4} />
                  <Text fontSize="sm">Stop Loss:</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="semibold" color="red.500">
                  ${currentRecommendation.stopLoss.toFixed(2)}
                </Text>
              </HStack>
            )}
            
            {currentRecommendation.riskReward && (
              <HStack justify="space-between">
                <Text fontSize="sm">Risk/Reward:</Text>
                <Text fontSize="sm" fontWeight="semibold">
                  1:{currentRecommendation.riskReward.toFixed(2)}
                </Text>
              </HStack>
            )}
          </VStack>
          
          <Divider />
          
          {/* Reasoning */}
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              AI Reasoning
            </Text>
            <Text fontSize="sm" color="gray.600">
              {currentRecommendation.reasoning}
            </Text>
          </Box>
          
          {/* Metadata */}
          <Box>
            <HStack justify="space-between" fontSize="xs" color="gray.500">
              <HStack spacing={1}>
                <Icon as={FiClock} />
                <Text>
                  Created: {new Date(currentRecommendation.timestamp * 1000).toLocaleString()}
                </Text>
              </HStack>
              <Text>
                {formatTimeRemaining(currentRecommendation.expiresAt)}
              </Text>
            </HStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default TradingRecommendationPanel;