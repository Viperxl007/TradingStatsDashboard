import React, { useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Heading,
  Badge,
  Progress,
  Icon,
  useColorMode
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { FiTarget, FiAlertTriangle } from 'react-icons/fi';
import {
  CLPosition,
  CLPriceHistory
} from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface PriceRangeChartProps {
  position: CLPosition;
  priceHistory: CLPriceHistory[];
  currentPriceData?: any; // Real-time price data from API
  isLoadingPrice?: boolean;
  priceError?: string | null;
}

const PriceRangeChart: React.FC<PriceRangeChartProps> = ({
  position,
  priceHistory,
  currentPriceData,
  isLoadingPrice = false,
  priceError
}) => {
  const { colorMode } = useColorMode();

  // Prepare chart data
  const chartData = useMemo(() => {
    return priceHistory
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(item => ({
        timestamp: new Date(item.timestamp).toLocaleDateString(),
        price: item.price,
        lowerBound: position.price_lower,
        upperBound: position.price_upper,
        inRange: item.is_in_range,
        usdValue: item.usd_value
      }));
  }, [priceHistory, position]);

  // Calculate current price position within range
  // Enhanced fallback hierarchy for better price estimation
  const getCurrentPrice = () => {
    // 1. Real-time price data (highest priority)
    if (currentPriceData?.token0?.price_data?.price_usd && currentPriceData?.token1?.price_data?.price_usd) {
      return currentPriceData.token0.price_data.price_usd / currentPriceData.token1.price_data.price_usd;
    }
    
    // 2. Latest price from price history (preferred fallback)
    if (chartData.length > 0) {
      return chartData[chartData.length - 1].price;
    }
    
    // 3. Last known position price (if available and reasonable)
    if (position.current_usd_value && position.initial_usd_value &&
        position.token0_amount > 0 && position.token1_amount > 0) {
      // Try to derive price from current position value
      const totalTokenValue = position.token0_amount + position.token1_amount;
      if (totalTokenValue > 0) {
        const estimatedPrice = position.current_usd_value / totalTokenValue;
        if (estimatedPrice > 0 && estimatedPrice >= position.price_lower * 0.1 &&
            estimatedPrice <= position.price_upper * 10) {
          return estimatedPrice;
        }
      }
    }
    
    // 4. Intelligent fallback based on range status
    if (position.price_lower > 0 && position.price_upper > position.price_lower) {
      if (position.is_in_range) {
        return (position.price_lower + position.price_upper) / 2;
      } else {
        // For out of range positions, use conservative estimate
        const rangeWidth = position.price_upper - position.price_lower;
        return position.price_lower + (rangeWidth * 0.2);
      }
    }
    
    // Last resort
    return position.price_lower || 0.0001;
  };

  const currentPrice = getCurrentPrice();
  const priceRangeProgress = position.price_upper > position.price_lower
    ? Math.max(0, Math.min(100,
        ((currentPrice - position.price_lower) / (position.price_upper - position.price_lower)) * 100
      ))
    : 50;

  // Determine if current price is in range
  const isCurrentlyInRange = currentPrice >= position.price_lower && currentPrice <= position.price_upper;

  // Calculate time in range
  const timeInRange = liquidityTrackingService.utils.calculateTimeInRange(priceHistory);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          p={3}
          borderRadius="md"
          boxShadow="lg"
          border="1px solid"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <VStack align="flex-start" spacing={1}>
            <Text fontSize="sm" fontWeight="bold">{label}</Text>
            <Text fontSize="sm">
              Price: {liquidityTrackingService.utils.formatCurrency(data.price, 10)}
            </Text>
            <Text fontSize="sm">
              USD Value: {liquidityTrackingService.utils.formatCurrency(data.usdValue)}
            </Text>
            <Badge colorScheme={data.inRange ? 'green' : 'red'} size="sm">
              {data.inRange ? 'In Range' : 'Out of Range'}
            </Badge>
          </VStack>
        </Box>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Heading size="md">Price Range Chart</Heading>
            <Text color="gray.500">No price history data available</Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <Heading size="md">Price Range Analysis</Heading>
            <HStack spacing={2}>
              <Icon 
                as={position.is_in_range ? FiTarget : FiAlertTriangle} 
                color={position.is_in_range ? 'green.500' : 'orange.500'}
              />
              <Text color={position.is_in_range ? 'green.500' : 'orange.500'}>
                {position.is_in_range ? 'In Range' : 'Out of Range'}
              </Text>
            </HStack>
          </HStack>

          {/* Current Position Indicator */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">Current Price Position</Text>
              <HStack spacing={2}>
                {isLoadingPrice && (
                  <Text fontSize="xs" color="gray.500">Loading...</Text>
                )}
                {priceError && (
                  <Text fontSize="xs" color="red.500">Price Error</Text>
                )}
                <Text fontSize="sm" fontWeight="bold" color={isCurrentlyInRange ? 'green.500' : 'orange.500'}>
                  {currentPrice > 0 ? liquidityTrackingService.utils.formatCurrency(currentPrice, 10) : 'N/A'}
                </Text>
              </HStack>
            </HStack>
            
            {/* Price Range Progress with Enhanced Callout */}
            <Box position="relative" mb={12}>
              {/* Enhanced Price Callout Ticker */}
              <Box
                position="absolute"
                left={`${priceRangeProgress}%`}
                top="-55px"
                transform="translateX(-50%)"
                zIndex={3}
                maxWidth="250px"
              >
                <Box
                  bg={isCurrentlyInRange ? 'green.500' : 'orange.500'}
                  color="white"
                  px={5}
                  py={4}
                  borderRadius="xl"
                  fontSize="sm"
                  fontWeight="bold"
                  whiteSpace="nowrap"
                  position="relative"
                  boxShadow="2xl"
                  border="3px solid"
                  borderColor={isCurrentlyInRange ? 'green.300' : 'orange.300'}
                  _before={{
                    content: '""',
                    position: 'absolute',
                    top: '-2px',
                    left: '-2px',
                    right: '-2px',
                    bottom: '-2px',
                    background: `linear-gradient(135deg, ${isCurrentlyInRange ? 'rgba(104, 211, 145, 0.4), rgba(72, 187, 120, 0.4)' : 'rgba(246, 173, 85, 0.4), rgba(237, 137, 54, 0.4)'})`,
                    borderRadius: 'xl',
                    zIndex: -1,
                  }}
                >
                  <VStack spacing={2} align="center">
                    <Text
                      fontSize="lg"
                      fontWeight="black"
                      letterSpacing="tight"
                      lineHeight="1"
                    >
                      {currentPrice > 0 ? liquidityTrackingService.utils.formatCurrency(currentPrice, 10) : 'N/A'}
                    </Text>
                    {currentPriceData && (
                      <Text
                        fontSize="xs"
                        opacity={0.95}
                        fontWeight="semibold"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        bg="rgba(255,255,255,0.2)"
                        px={2}
                        py={1}
                        borderRadius="md"
                      >
                        Real-time
                      </Text>
                    )}
                  </VStack>
                  {/* Enhanced Arrow pointing down */}
                  <Box
                    position="absolute"
                    bottom="-10px"
                    left="50%"
                    transform="translateX(-50%)"
                    width="0"
                    height="0"
                    borderLeft="10px solid transparent"
                    borderRight="10px solid transparent"
                    borderTop={`10px solid ${isCurrentlyInRange ? '#48BB78' : '#ED8936'}`}
                    filter="drop-shadow(0 3px 6px rgba(0,0,0,0.3))"
                  />
                </Box>
              </Box>
              
              <Progress
                value={priceRangeProgress}
                colorScheme={isCurrentlyInRange ? 'green' : 'orange'}
                size="lg"
                borderRadius="full"
              />
            </Box>
            
            <HStack justify="space-between" mt={2}>
              <VStack align="flex-start" spacing={0}>
                <Text fontSize="xs" color="gray.500">Lower Bound</Text>
                <Text fontSize="sm" fontWeight="medium">
                  {liquidityTrackingService.utils.formatCurrency(position.price_lower, 10)}
                </Text>
              </VStack>
              
              <VStack align="center" spacing={0}>
                <Text fontSize="xs" color="gray.500">Current</Text>
                <Text fontSize="sm" fontWeight="medium" color={isCurrentlyInRange ? 'green.500' : 'orange.500'}>
                  {currentPrice > 0 ? liquidityTrackingService.utils.formatCurrency(currentPrice, 10) : 'N/A'}
                </Text>
                {currentPriceData && (
                  <Text fontSize="xs" color="gray.400">
                    Real-time
                  </Text>
                )}
              </VStack>
              
              <VStack align="flex-end" spacing={0}>
                <Text fontSize="xs" color="gray.500">Upper Bound</Text>
                <Text fontSize="sm" fontWeight="medium">
                  {liquidityTrackingService.utils.formatCurrency(position.price_upper, 10)}
                </Text>
              </VStack>
            </HStack>
          </Box>

          {/* Time in Range Metric */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" fontWeight="medium">Time in Range</Text>
              <Text fontSize="sm" fontWeight="bold" color="green.500">
                {timeInRange.toFixed(1)}%
              </Text>
            </HStack>
            
            <Progress
              value={timeInRange}
              colorScheme={timeInRange >= 70 ? 'green' : timeInRange >= 40 ? 'yellow' : 'red'}
              size="sm"
              borderRadius="full"
            />
          </Box>

          {/* Price History Chart */}
          <Box h="400px">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'} 
                />
                <XAxis 
                  dataKey="timestamp" 
                  stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                  fontSize={12}
                />
                <YAxis
                  stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                  fontSize={12}
                  tickFormatter={(value) => `$${value.toFixed(10)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Price range area */}
                <Area
                  dataKey="upperBound"
                  fill="rgba(72, 187, 120, 0.1)"
                  stroke="none"
                />
                <Area
                  dataKey="lowerBound"
                  fill="rgba(255, 255, 255, 1)"
                  stroke="none"
                />
                
                {/* Reference lines for bounds */}
                <ReferenceLine
                  y={position.price_lower}
                  stroke="#E53E3E"
                  strokeDasharray="5 5"
                  label={{ value: "Lower", position: "left" }}
                />
                <ReferenceLine
                  y={position.price_upper}
                  stroke="#E53E3E"
                  strokeDasharray="5 5"
                  label={{ value: "Upper", position: "left" }}
                />
                
                {/* Current price indicator line */}
                {currentPrice > 0 && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke={isCurrentlyInRange ? "#48BB78" : "#ED8936"}
                    strokeWidth={3}
                    strokeDasharray="2 2"
                    label={{
                      value: `Current: ${liquidityTrackingService.utils.formatCurrency(currentPrice, 10)}`,
                      position: "right",
                      style: { fill: isCurrentlyInRange ? "#48BB78" : "#ED8936" }
                    }}
                  />
                )}
                
                {/* Price line */}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3182CE"
                  strokeWidth={2}
                  dot={{ fill: '#3182CE', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, fill: '#3182CE' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>

          {/* Range Statistics */}
          <HStack justify="space-around" pt={4} borderTop="1px solid" borderTopColor="gray.200">
            <VStack spacing={1}>
              <Text fontSize="xs" color="gray.500">RANGE WIDTH</Text>
              <Text fontSize="sm" fontWeight="bold">
                {liquidityTrackingService.utils.formatCurrency(position.price_upper - position.price_lower, 10)}
              </Text>
            </VStack>
            
            <VStack spacing={1}>
              <Text fontSize="xs" color="gray.500">RANGE %</Text>
              <Text fontSize="sm" fontWeight="bold">
                {position.price_lower > 0 
                  ? (((position.price_upper - position.price_lower) / position.price_lower) * 100).toFixed(1)
                  : '0'
                }%
              </Text>
            </VStack>
            
            <VStack spacing={1}>
              <Text fontSize="xs" color="gray.500">DISTANCE TO BOUNDS</Text>
              <Text fontSize="sm" fontWeight="bold">
                {Math.min(
                  Math.abs(currentPrice - position.price_lower),
                  Math.abs(currentPrice - position.price_upper)
                ).toFixed(4)}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PriceRangeChart;