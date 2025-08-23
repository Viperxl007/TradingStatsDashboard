import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useColorModeValue,
  Icon,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Progress,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Flex
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiBarChart,
  FiClock,
  FiDollarSign,
  FiActivity,
  FiShield
} from 'react-icons/fi';
import { AITradeStatistics, AITradeEntry } from '../../types/aiTradeTracker';

interface AITradeViewerPerformanceProps {
  statistics: AITradeStatistics | null;
  trades: AITradeEntry[];
  onRefresh: () => void;
  onError: (error: string) => void;
}

const AITradeViewerPerformance: React.FC<AITradeViewerPerformanceProps> = ({
  statistics,
  trades,
  onRefresh,
  onError
}) => {
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  if (!statistics || trades.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={FiBarChart} boxSize={12} color="gray.400" mb={4} />
        <Heading size="md" color="gray.500" mb={2}>
          No Performance Data
        </Heading>
        <Text color={textColor}>
          Performance metrics will appear here as trades are completed and analyzed.
        </Text>
      </Box>
    );
  }

  /**
   * Get performance color based on value
   */
  const getPerformanceColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'gray.500';
  };

  /**
   * Get confidence level display
   */
  const getConfidenceLevelDisplay = (level: keyof AITradeStatistics['byConfidence']) => {
    const displayNames = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      very_high: 'Very High'
    };
    return displayNames[level] || level;
  };

  return (
    <Box>
      {/* Overall Performance Summary */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Stat>
          <StatLabel>Win Rate</StatLabel>
          <StatNumber color={getPerformanceColor(statistics.winRate - 50)}>
            {statistics.winRate.toFixed(1)}%
          </StatNumber>
          <StatHelpText>
            <Icon as={FiTarget} mr={1} />
            {statistics.winningTrades} of {statistics.totalRecommendations}
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Total Return</StatLabel>
          <StatNumber color={getPerformanceColor(statistics.totalReturn)}>
            {statistics.totalReturn >= 0 ? '+' : ''}{statistics.totalReturn.toFixed(2)}%
          </StatNumber>
          <StatHelpText>
            <Icon as={FiDollarSign} mr={1} />
            Overall performance
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Average Return</StatLabel>
          <StatNumber color={getPerformanceColor(statistics.averageReturn)}>
            {statistics.averageReturn >= 0 ? '+' : ''}{statistics.averageReturn.toFixed(2)}%
          </StatNumber>
          <StatHelpText>
            <Icon as={FiTrendingUp} mr={1} />
            Per trade average
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Best Trade</StatLabel>
          <StatNumber color="green.500">
            +{statistics.bestTrade.toFixed(2)}%
          </StatNumber>
          <StatHelpText>
            <Icon as={FiBarChart} mr={1} />
            Highest return
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Performance Cards */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
        {/* Win Rate Breakdown */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardHeader>
            <Heading size="md">Win Rate Breakdown</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm">Overall Win Rate</Text>
                  <Text fontSize="sm" fontWeight="bold">{statistics.winRate.toFixed(1)}%</Text>
                </HStack>
                <Progress
                  value={statistics.winRate}
                  colorScheme={statistics.winRate >= 50 ? 'green' : 'red'}
                  size="lg"
                />
              </Box>

              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={3}>By Confidence Level</Text>
                <VStack spacing={2} align="stretch">
                  {Object.entries(statistics.byConfidence).map(([level, data]) => (
                    <Box key={level}>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="xs">{getConfidenceLevelDisplay(level as keyof AITradeStatistics['byConfidence'])}</Text>
                        <Text fontSize="xs" fontWeight="bold">{data.winRate.toFixed(1)}%</Text>
                      </HStack>
                      <Progress
                        value={data.winRate}
                        colorScheme={data.winRate >= 50 ? 'green' : 'red'}
                        size="sm"
                      />
                      <Text fontSize="xs" color={textColor}>
                        {data.count} trades • {data.totalReturn >= 0 ? '+' : ''}{data.totalReturn.toFixed(2)}% total
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        {/* Performance Metrics */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardHeader>
            <Heading size="md">Performance Metrics</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={2} spacing={4}>
              <Box>
                <Text fontSize="sm" color={textColor} mb={1}>Profit Factor</Text>
                <Text fontSize="lg" fontWeight="bold" color={statistics.profitFactor >= 1 ? 'green.500' : 'red.500'}>
                  {statistics.profitFactor.toFixed(2)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="sm" color={textColor} mb={1}>Sharpe Ratio</Text>
                <Text fontSize="lg" fontWeight="bold">
                  {statistics.sharpeRatio.toFixed(2)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="sm" color={textColor} mb={1}>Max Drawdown</Text>
                <Text fontSize="lg" fontWeight="bold" color="red.500">
                  -{statistics.maxDrawdown.toFixed(2)}%
                </Text>
              </Box>
              <Box>
                <Text fontSize="sm" color={textColor} mb={1}>Avg Risk/Reward</Text>
                <Text fontSize="lg" fontWeight="bold">
                  {statistics.averageRiskReward.toFixed(2)}
                </Text>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Recent Trends */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" mb={6}>
        <CardHeader>
          <Heading size="md">Recent Performance Trends</Heading>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Box textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color={getPerformanceColor(statistics.recentTrends.last7Days.totalReturn)}>
                {statistics.recentTrends.last7Days.totalReturn >= 0 ? '+' : ''}{statistics.recentTrends.last7Days.totalReturn.toFixed(2)}%
              </Text>
              <Text fontSize="sm" color={textColor}>Last 7 Days</Text>
              <Text fontSize="xs" color={textColor}>
                {statistics.recentTrends.last7Days.trades} trades • {statistics.recentTrends.last7Days.winRate.toFixed(1)}% win rate
              </Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color={getPerformanceColor(statistics.recentTrends.last30Days.totalReturn)}>
                {statistics.recentTrends.last30Days.totalReturn >= 0 ? '+' : ''}{statistics.recentTrends.last30Days.totalReturn.toFixed(2)}%
              </Text>
              <Text fontSize="sm" color={textColor}>Last 30 Days</Text>
              <Text fontSize="xs" color={textColor}>
                {statistics.recentTrends.last30Days.trades} trades • {statistics.recentTrends.last30Days.winRate.toFixed(1)}% win rate
              </Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="2xl" fontWeight="bold" color={getPerformanceColor(statistics.recentTrends.last90Days.totalReturn)}>
                {statistics.recentTrends.last90Days.totalReturn >= 0 ? '+' : ''}{statistics.recentTrends.last90Days.totalReturn.toFixed(2)}%
              </Text>
              <Text fontSize="sm" color={textColor}>Last 90 Days</Text>
              <Text fontSize="xs" color={textColor}>
                {statistics.recentTrends.last90Days.trades} trades • {statistics.recentTrends.last90Days.winRate.toFixed(1)}% win rate
              </Text>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* By Model Performance */}
      {Object.keys(statistics.byModel).length > 0 && (
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" mb={6}>
          <CardHeader>
            <Heading size="md">Performance by AI Model</Heading>
          </CardHeader>
          <CardBody>
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Model</Th>
                    <Th>Trades</Th>
                    <Th>Win Rate</Th>
                    <Th>Avg Return</Th>
                    <Th>Total Return</Th>
                    <Th>Best Trade</Th>
                    <Th>Worst Trade</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {Object.entries(statistics.byModel).map(([modelId, model]) => (
                    <Tr key={modelId}>
                      <Td fontWeight="bold">{model.modelName}</Td>
                      <Td>{model.totalRecommendations}</Td>
                      <Td>
                        <Badge colorScheme={model.winRate >= 50 ? 'green' : 'red'}>
                          {model.winRate.toFixed(1)}%
                        </Badge>
                      </Td>
                      <Td color={getPerformanceColor(model.averageReturn)}>
                        {model.averageReturn >= 0 ? '+' : ''}{model.averageReturn.toFixed(2)}%
                      </Td>
                      <Td color={getPerformanceColor(model.totalReturn)}>
                        {model.totalReturn >= 0 ? '+' : ''}{model.totalReturn.toFixed(2)}%
                      </Td>
                      <Td color="green.500">+{model.bestTrade.toFixed(2)}%</Td>
                      <Td color="red.500">{model.worstTrade.toFixed(2)}%</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      )}

      {/* By Ticker Performance */}
      {Object.keys(statistics.byTicker).length > 0 && (
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardHeader>
            <Heading size="md">Performance by Ticker</Heading>
          </CardHeader>
          <CardBody>
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Ticker</Th>
                    <Th>Trades</Th>
                    <Th>Win Rate</Th>
                    <Th>Avg Return</Th>
                    <Th>Total Return</Th>
                    <Th>Best Trade</Th>
                    <Th>Worst Trade</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {Object.entries(statistics.byTicker).map(([ticker, data]) => (
                    <Tr key={ticker}>
                      <Td fontWeight="bold">{ticker}</Td>
                      <Td>{data.totalTrades}</Td>
                      <Td>
                        <Badge colorScheme={data.winRate >= 50 ? 'green' : 'red'}>
                          {data.winRate.toFixed(1)}%
                        </Badge>
                      </Td>
                      <Td color={getPerformanceColor(data.averageReturn)}>
                        {data.averageReturn >= 0 ? '+' : ''}{data.averageReturn.toFixed(2)}%
                      </Td>
                      <Td color={getPerformanceColor(data.totalReturn)}>
                        {data.totalReturn >= 0 ? '+' : ''}{data.totalReturn.toFixed(2)}%
                      </Td>
                      <Td color="green.500">
                        {data.bestTrade !== null ? `+${data.bestTrade.toFixed(2)}%` : 'N/A'}
                      </Td>
                      <Td color="red.500">
                        {data.worstTrade !== null ? `${data.worstTrade.toFixed(2)}%` : 'N/A'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      )}
    </Box>
  );
};

export default AITradeViewerPerformance;