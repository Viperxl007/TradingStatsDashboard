import React from 'react';
import {
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Badge,
  Progress,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Box,
  Flex,
  Icon,
  useColorMode,
  Tooltip
} from '@chakra-ui/react';
import {
  FiMoreVertical,
  FiEdit,
  FiTrash2,
  FiExternalLink,
  FiTarget,
  FiTrendingUp,
  FiTrendingDown,
  FiAlertTriangle,
  FiDollarSign,
  FiPercent
} from 'react-icons/fi';
import { CLPosition } from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface PositionCardProps {
  position: CLPosition;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  currentPriceData?: any; // Real-time price data from API
  isLoadingPrice?: boolean;
  priceError?: string | null;
}

const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onClick,
  onEdit,
  onDelete,
  currentPriceData,
  isLoadingPrice = false,
  priceError
}) => {
  const { colorMode } = useColorMode();

  const getStatusColor = (status: string, isInRange: boolean) => {
    if (status === 'closed') return 'gray';
    if (!isInRange) return 'orange';
    return 'green';
  };

  const getStatusText = (status: string, isInRange: boolean) => {
    if (status === 'closed') return 'Closed';
    if (!isInRange) return 'Out of Range';
    return 'Active';
  };

  const getReturnColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'gray.500';
  };

  const getReturnIcon = (value: number) => {
    if (value > 0) return FiTrendingUp;
    if (value < 0) return FiTrendingDown;
    return FiDollarSign;
  };

  const healthScore = liquidityTrackingService.utils.calculateHealthScore(position);
  const healthColor = healthScore >= 70 ? 'green' : healthScore >= 40 ? 'yellow' : 'red';

  // Calculate current price and USD value with real-time data
  const getCurrentPrice = () => {
    // 1. Real-time price data (highest priority)
    if (currentPriceData?.token0?.price_data?.price_usd && currentPriceData?.token1?.price_data?.price_usd) {
      return currentPriceData.token0.price_data.price_usd / currentPriceData.token1.price_data.price_usd;
    }
    
    // 2. Latest price from price history (if available)
    // Note: This would require price history to be passed as a prop
    // For now, we'll use the position's current price if it exists
    
    // 3. Last known position price (if available and reasonable)
    if (position.current_usd_value && position.initial_usd_value &&
        position.token0_amount > 0 && position.token1_amount > 0) {
      // Try to derive price from current position value
      const totalTokenValue = position.token0_amount + position.token1_amount;
      if (totalTokenValue > 0) {
        // This is an approximation - in a real scenario we'd need token prices
        const estimatedPrice = position.current_usd_value / totalTokenValue;
        if (estimatedPrice > 0 && estimatedPrice >= position.price_lower * 0.1 &&
            estimatedPrice <= position.price_upper * 10) {
          return estimatedPrice;
        }
      }
    }
    
    // 4. Intelligent fallback based on range status
    if (position.price_lower > 0 && position.price_upper > position.price_lower) {
      // If position is marked as in range, use middle of range
      if (position.is_in_range) {
        return (position.price_lower + position.price_upper) / 2;
      } else {
        // If out of range, make educated guess based on status
        // For out of range positions, price is likely closer to bounds
        const rangeWidth = position.price_upper - position.price_lower;
        const lowerBias = position.price_lower + (rangeWidth * 0.2); // 20% from lower
        const upperBias = position.price_upper - (rangeWidth * 0.2); // 20% from upper
        
        // Use lower bias as default for out-of-range (more conservative)
        return lowerBias;
      }
    }
    
    // Last resort: use lower bound
    return position.price_lower || 0.0001;
  };

  const getCurrentUsdValue = () => {
    if (currentPriceData?.position_value?.current_usd_value) {
      return currentPriceData.position_value.current_usd_value;
    }
    return position.current_usd_value || position.initial_usd_value;
  };

  const getPnlData = () => {
    if (currentPriceData?.position_value) {
      return {
        pnl: currentPriceData.position_value.pnl || 0,
        pnl_percentage: currentPriceData.position_value.pnl_percentage || 0
      };
    }
    return {
      pnl: position.total_return || 0,
      pnl_percentage: position.total_return_percentage || 0
    };
  };

  // Check if position has token addresses for price data
  const hasTokenAddresses = position.token0_address && position.token1_address;
  const showPriceWarning = !hasTokenAddresses && !priceError;

  const currentPrice = getCurrentPrice();
  const currentUsdValue = getCurrentUsdValue();
  const pnlData = getPnlData();
  
  const priceRangeProgress = position.price_upper > position.price_lower
    ? Math.max(0, Math.min(100,
        ((currentPrice - position.price_lower) / (position.price_upper - position.price_lower)) * 100
      ))
    : 50;

  // Determine if current price is in range
  const isCurrentlyInRange = currentPrice >= position.price_lower && currentPrice <= position.price_upper;

  return (
    <Card
      cursor="pointer"
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: 'lg'
      }}
      onClick={onClick}
      position="relative"
    >
      <CardBody>
        <VStack spacing={4} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="flex-start">
            <VStack align="flex-start" spacing={1}>
              <HStack spacing={2}>
                <Text fontSize="lg" fontWeight="bold">
                  {position.token0_symbol}/{position.token1_symbol}
                </Text>
                <Badge colorScheme={getStatusColor(position.status, isCurrentlyInRange)}>
                  {getStatusText(position.status, isCurrentlyInRange)}
                </Badge>
              </HStack>
              
              <HStack spacing={2}>
                <Badge variant="outline" fontSize="xs">
                  {(position.fee_tier / 10000).toFixed(2)}%
                </Badge>
                <Text fontSize="xs" color="gray.500">
                  Fee Tier
                </Text>
              </HStack>
            </VStack>

            <Menu>
              <MenuButton
                as={IconButton}
                icon={<FiMoreVertical />}
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
              />
              <MenuList>
                <MenuItem icon={<FiEdit />} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  Edit Position
                </MenuItem>
                <MenuItem icon={<FiExternalLink />}>
                  View on Explorer
                </MenuItem>
                <MenuItem 
                  icon={<FiTrash2 />} 
                  color="red.500"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  Delete Position
                </MenuItem>
              </MenuList>
            </Menu>
          </Flex>

          {/* Price Range Indicator */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">Price Range</Text>
              <HStack spacing={1}>
                <Icon
                  as={isCurrentlyInRange ? FiTarget : FiAlertTriangle}
                  color={isCurrentlyInRange ? 'green.500' : 'orange.500'}
                  boxSize={4}
                />
                <Text fontSize="sm" color={isCurrentlyInRange ? 'green.500' : 'orange.500'}>
                  {isCurrentlyInRange ? 'In Range' : 'Out of Range'}
                </Text>
              </HStack>
            </HStack>
            
            {/* Price Range Progress with Enhanced Callout */}
            <Box position="relative" mb={8}>
              {/* Enhanced Price Callout Ticker */}
              <Box
                position="absolute"
                left={`${priceRangeProgress}%`}
                top="-50px"
                transform="translateX(-50%)"
                zIndex={3}
                maxWidth="220px"
              >
                <Box
                  bg={isCurrentlyInRange ? 'green.500' : 'orange.500'}
                  color="white"
                  px={4}
                  py={3}
                  borderRadius="xl"
                  fontSize="sm"
                  fontWeight="bold"
                  whiteSpace="nowrap"
                  position="relative"
                  boxShadow="xl"
                  border="2px solid"
                  borderColor={isCurrentlyInRange ? 'green.300' : 'orange.300'}
                  _before={{
                    content: '""',
                    position: 'absolute',
                    top: '-1px',
                    left: '-1px',
                    right: '-1px',
                    bottom: '-1px',
                    background: `linear-gradient(135deg, ${isCurrentlyInRange ? 'rgba(104, 211, 145, 0.3), rgba(72, 187, 120, 0.3)' : 'rgba(246, 173, 85, 0.3), rgba(237, 137, 54, 0.3)'})`,
                    borderRadius: 'xl',
                    zIndex: -1,
                  }}
                >
                  <VStack spacing={1} align="center">
                    <Text
                      fontSize="md"
                      fontWeight="extrabold"
                      letterSpacing="tight"
                      lineHeight="1.1"
                    >
                      {liquidityTrackingService.utils.formatCurrency(currentPrice, 10)}
                    </Text>
                    {currentPriceData && (
                      <Text
                        fontSize="xs"
                        opacity={0.9}
                        fontWeight="medium"
                        textTransform="uppercase"
                        letterSpacing="wide"
                      >
                        Real-time
                      </Text>
                    )}
                  </VStack>
                  {/* Enhanced Arrow pointing down */}
                  <Box
                    position="absolute"
                    bottom="-8px"
                    left="50%"
                    transform="translateX(-50%)"
                    width="0"
                    height="0"
                    borderLeft="8px solid transparent"
                    borderRight="8px solid transparent"
                    borderTop={`8px solid ${isCurrentlyInRange ? '#48BB78' : '#ED8936'}`}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
                  />
                </Box>
              </Box>
              
              <Progress
                value={priceRangeProgress}
                colorScheme={isCurrentlyInRange ? 'green' : 'orange'}
                size="sm"
                borderRadius="full"
              />
            </Box>
            
            <HStack justify="space-between" mt={1}>
              <Text fontSize="xs" color="gray.500">
                {liquidityTrackingService.utils.formatCurrency(position.price_lower, 10)}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {liquidityTrackingService.utils.formatCurrency(position.price_upper, 10)}
              </Text>
            </HStack>
          </Box>

          {/* Key Metrics */}
          <HStack spacing={4}>
            <Stat flex="1">
              <StatLabel fontSize="xs">
                USD Value
                {isLoadingPrice && <Text as="span" color="gray.400" ml={1}>(Loading...)</Text>}
                {priceError && <Text as="span" color="red.400" ml={1}>(Error)</Text>}
                {showPriceWarning && (
                  <Tooltip label="Token addresses needed for real-time pricing" placement="top">
                    <Text as="span" color="orange.400" ml={1}>(No Price Data)</Text>
                  </Tooltip>
                )}
              </StatLabel>
              <StatNumber fontSize="md" color={hasTokenAddresses ? "brand.500" : "gray.500"}>
                {liquidityTrackingService.utils.formatCurrency(currentUsdValue)}
              </StatNumber>
              {currentPriceData && (
                <StatHelpText fontSize="xs" color="green.500">
                  Real-time
                </StatHelpText>
              )}
              {!hasTokenAddresses && !currentPriceData && (
                <StatHelpText fontSize="xs" color="gray.500">
                  Estimated
                </StatHelpText>
              )}
            </Stat>

            <Stat flex="1">
              <StatLabel fontSize="xs">Total Return</StatLabel>
              <StatNumber fontSize="md" color={getReturnColor(pnlData.pnl)}>
                <HStack spacing={1}>
                  <Icon as={getReturnIcon(pnlData.pnl)} boxSize={3} />
                  <Text>{liquidityTrackingService.utils.formatCurrency(pnlData.pnl)}</Text>
                </HStack>
              </StatNumber>
              <StatHelpText fontSize="xs">
                <StatArrow type={pnlData.pnl_percentage >= 0 ? 'increase' : 'decrease'} />
                {liquidityTrackingService.utils.formatPercentage(pnlData.pnl_percentage)}
              </StatHelpText>
            </Stat>
          </HStack>

          {/* Secondary Metrics */}
          <HStack spacing={4}>
            <Stat flex="1">
              <StatLabel fontSize="xs">Fees Earned</StatLabel>
              <StatNumber fontSize="sm" color="green.500">
                {liquidityTrackingService.utils.formatCurrency(position.fees_earned_usd)}
              </StatNumber>
            </Stat>

            <Stat flex="1">
              <StatLabel fontSize="xs">Impermanent Loss</StatLabel>
              <StatNumber fontSize="sm" color={position.impermanent_loss < 0 ? 'red.500' : 'gray.500'}>
                {liquidityTrackingService.utils.formatPercentage(position.impermanent_loss_percentage)}
              </StatNumber>
            </Stat>
          </HStack>

          {/* Health Score */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">Position Health</Text>
              <Badge colorScheme={healthColor} variant="subtle">
                {Math.round(healthScore)}/100
              </Badge>
            </HStack>
            
            <Progress
              value={healthScore}
              colorScheme={healthColor}
              size="sm"
              borderRadius="full"
            />
          </Box>

          {/* Token Composition */}
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>Token Composition</Text>
            <VStack spacing={2}>
              <HStack justify="space-between" w="100%">
                <HStack spacing={2}>
                  <Text fontSize="sm">{position.token0_symbol}</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="medium">
                  {position.token0_amount.toFixed(4)}
                </Text>
              </HStack>
              
              <HStack justify="space-between" w="100%">
                <HStack spacing={2}>
                  <Text fontSize="sm">{position.token1_symbol}</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="medium">
                  {position.token1_amount.toFixed(4)}
                </Text>
              </HStack>
            </VStack>
          </Box>

          {/* Footer */}
          <HStack justify="space-between" pt={2} borderTop="1px solid" borderTopColor="gray.200">
            <Text fontSize="xs" color="gray.500">
              Created {new Date(position.created_at).toLocaleDateString()}
            </Text>
            <Text fontSize="xs" color="gray.500">
              Updated {new Date(position.updated_at).toLocaleTimeString()}
            </Text>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PositionCard;