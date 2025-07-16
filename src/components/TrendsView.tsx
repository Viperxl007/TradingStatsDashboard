import * as React from 'react';
import {
  Box,
  Heading,
  Text,
  Flex,
  SimpleGrid,
  Card,
  CardBody,
  HStack,
  VStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Badge,
  Icon,
  Progress,
  Divider,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Skeleton
} from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiActivity, FiClock } from 'react-icons/fi';
import { useHyperliquid } from '../context/HyperliquidContext';
import { adaptHyperliquidToTrends, TokenTrendData, formatCurrency, formatPercentage, getTrendColor } from '../utils/hyperliquidTrendsAdapter';
import { format } from 'date-fns';

const TrendsView: React.FC = () => {
  const { state } = useHyperliquid();

  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');

  // Transform Hyperliquid data using our adapter
  const trendsData = React.useMemo(() => {
    return adaptHyperliquidToTrends(state.trades);
  }, [state.trades]);

  const { trendingTokens, underperformingTokens } = trendsData;

  // Render a token card with performance metrics (original design)
  const renderTokenCard = (token: TokenTrendData, trend: 'up' | 'down') => {
    const trendColor = trend === 'up' ? 'green.500' : 'red.500';
    const trendBg = trend === 'up' ? 'green.50' : 'red.50';
    const trendIcon = trend === 'up' ? FiTrendingUp : FiTrendingDown;

    return (
      <Card
        key={token.token}
        bg={cardBg}
        borderWidth="1px"
        borderColor={cardBorderColor}
        borderRadius="lg"
        overflow="hidden"
        mb={4}
      >
        <CardBody>
          <HStack justify="space-between" mb={2}>
            <Heading size="md">{token.token}</Heading>
            <Badge colorScheme={trend === 'up' ? 'green' : 'red'} fontSize="sm">
              {trend === 'up' ? 'BULLISH' : 'BEARISH'}
            </Badge>
          </HStack>

          <HStack mb={4}>
            <Flex
              w="36px"
              h="36px"
              align="center"
              justify="center"
              borderRadius="lg"
              bg={trendBg}
              color={trendColor}
              mr={2}
            >
              <Icon as={trendIcon} boxSize={5} />
            </Flex>
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" color="gray.500">Recent Performance</Text>
              <Text fontWeight="bold" color={trendColor}>
                {formatCurrency(token.recentPerformance)}
              </Text>
            </VStack>
          </HStack>

          <SimpleGrid columns={2} spacing={4} mb={4}>
            <Stat size="sm">
              <StatLabel>Total P/L</StatLabel>
              <StatNumber color={token.totalProfitLoss >= 0 ? 'green.500' : 'red.500'}>
                {formatCurrency(token.totalProfitLoss)}
              </StatNumber>
              <StatHelpText>
                <StatArrow type={token.priceChange >= 0 ? 'increase' : 'decrease'} />
                {formatPercentage(Math.abs(token.priceChange))}
              </StatHelpText>
            </Stat>

            <Stat size="sm">
              <StatLabel>Win Rate</StatLabel>
              <StatNumber>{token.winRate.toFixed(1)}%</StatNumber>
              <StatHelpText>
                <HStack>
                  <Icon as={FiActivity} />
                  <Text>{token.totalTrades} trades</Text>
                </HStack>
              </StatHelpText>
            </Stat>
          </SimpleGrid>

          <Divider mb={4} />

          <HStack justify="space-between" mb={2}>
            <HStack>
              <Icon as={FiDollarSign} color="gray.500" />
              <Text fontSize="sm">Volume: {formatCurrency(token.totalVolume)}</Text>
            </HStack>
            <HStack>
              <Icon as={FiClock} color="gray.500" />
              <Text fontSize="sm">Avg Hold: {token.averageHoldingTime.toFixed(1)} days</Text>
            </HStack>
          </HStack>

          <Text fontSize="sm" mb={2}>Volatility</Text>
          <Progress
            value={Math.min(token.volatility * 10, 100)}
            colorScheme={token.volatility < 5 ? 'green' : token.volatility < 15 ? 'yellow' : 'red'}
            size="sm"
            borderRadius="full"
          />
        </CardBody>
      </Card>
    );
  };

  // Loading state
  if (state.isLoading) {
    return (
      <Box>
        <Skeleton height="40px" mb={4} />
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
          <Skeleton height="200px" />
          <Skeleton height="200px" />
        </SimpleGrid>
        <Skeleton height="400px" />
      </Box>
    );
  }
  
  // Error state
  if (state.error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Error loading Hyperliquid data!</AlertTitle>
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  
  // No account selected state
  if (!state.selectedAccount) {
    return (
      <Alert status="info">
        <AlertIcon />
        <AlertTitle>No account selected</AlertTitle>
        <AlertDescription>Please select a Hyperliquid account to view trading trends.</AlertDescription>
      </Alert>
    );
  }
  
  // No trades state
  if (!state.trades || state.trades.length === 0) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>No trading data available</AlertTitle>
        <AlertDescription>
          No trades found for {state.selectedAccount.display_name} to analyze trends.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Market Trends - {state.selectedAccount.display_name}</Heading>
        {state.lastSyncTime && (
          <Text fontSize="sm" color="gray.500">
            Last updated: {format(new Date(state.lastSyncTime), 'PPpp')}
          </Text>
        )}
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
        {/* Trending Up Section */}
        <Box>
          <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden" mb={4}>
            <CardBody>
              <HStack mb={2}>
                <Icon as={FiTrendingUp} color="green.500" />
                <Heading size="md">Trending Up</Heading>
              </HStack>
              <Text fontSize="sm" color="gray.500">Tokens with positive performance trends</Text>
            </CardBody>
          </Card>

          {trendingTokens.length === 0 ? (
            <Flex
              justify="center"
              align="center"
              h="200px"
              borderWidth="1px"
              borderRadius="lg"
              borderColor={cardBorderColor}
              bg={cardBg}
            >
              <Text>No trending tokens found</Text>
            </Flex>
          ) : (
            trendingTokens.slice(0, 3).map(token => renderTokenCard(token, 'up'))
          )}
        </Box>

        {/* Trending Down Section */}
        <Box>
          <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden" mb={4}>
            <CardBody>
              <HStack mb={2}>
                <Icon as={FiTrendingDown} color="red.500" />
                <Heading size="md">Trending Down</Heading>
              </HStack>
              <Text fontSize="sm" color="gray.500">Tokens with negative performance trends</Text>
            </CardBody>
          </Card>

          {underperformingTokens.length === 0 ? (
            <Flex
              justify="center"
              align="center"
              h="200px"
              borderWidth="1px"
              borderRadius="lg"
              borderColor={cardBorderColor}
              bg={cardBg}
            >
              <Text>No underperforming tokens found</Text>
            </Flex>
          ) : (
            underperformingTokens.slice(0, 3).map(token => renderTokenCard(token, 'down'))
          )}
        </Box>
      </SimpleGrid>
    </Box>
  );
};

export default TrendsView;