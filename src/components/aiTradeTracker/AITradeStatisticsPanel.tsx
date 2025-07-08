import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Grid,
  GridItem,
  Card,
  CardBody,
  Badge,
  Progress,
  Divider,
  Select,
  useColorModeValue
} from '@chakra-ui/react';
import { getAllTradesHistoryForAITracker } from '../../services/productionActiveTradesService';
import { AITradeStatistics, AIModelPerformance, AITokenPerformance } from '../../types/aiTradeTracker';
import { AITradeStatisticsCalculator } from '../../services/aiTradeStatisticsCalculator';

interface AITradeStatisticsPanelProps {
  onError: (error: string) => void;
}

const AITradeStatisticsPanel: React.FC<AITradeStatisticsPanelProps> = ({ onError }) => {
  const [statistics, setStatistics] = useState<AITradeStatistics | null>(null);
  const [modelPerformance, setModelPerformance] = useState<AIModelPerformance[]>([]);
  const [tokenPerformance, setTokenPerformance] = useState<AITokenPerformance[]>([]);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const positiveColor = useColorModeValue('green.500', 'green.300');
  const negativeColor = useColorModeValue('red.500', 'red.300');

  useEffect(() => {
    loadStatistics();
  }, [timeframe]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      
      // Get all trades from production (including closed ones for statistics)
      let trades = await getAllTradesHistoryForAITracker();
      
      // Filter by timeframe if not 'all'
      if (timeframe !== 'all') {
        const endDate = new Date();
        let startDate: Date;
        
        switch (timeframe) {
          case '7d':
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        
        trades = trades.filter(trade => trade.entryDate >= startDate.getTime());
      }

      // Use centralized statistics calculator for accurate percentage-based metrics
      const stats = AITradeStatisticsCalculator.calculateStatistics(trades);
      
      // Extract model and token performance from statistics
      const modelPerf = Object.values(stats.byModel);
      const tokenPerf = Object.values(stats.byTicker);

      setStatistics(stats);
      setModelPerformance(modelPerf);
      setTokenPerformance(tokenPerf);
    } catch (error) {
      console.error('Error loading statistics:', error);
      onError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatPercentageFromDecimal = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  if (loading || !statistics) {
    return (
      <Box p={6}>
        <Text>Loading statistics...</Text>
      </Box>
    );
  }

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header with Timeframe Selector */}
        <HStack justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold">AI Trade Statistics</Text>
          <Select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            width="200px"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </Select>
        </HStack>

        {/* Overall Performance Metrics */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>Overall Performance</Text>
            <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
              <Stat>
                <StatLabel>Total Return</StatLabel>
                <StatNumber color={statistics.totalReturn >= 0 ? positiveColor : negativeColor}>
                  {formatPercentage(statistics.totalReturn)}
                </StatNumber>
                <StatHelpText>
                  <StatArrow type={statistics.totalReturn >= 0 ? 'increase' : 'decrease'} />
                  Cumulative percentage return
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Win Rate</StatLabel>
                <StatNumber>{formatPercentage(statistics.winRate)}</StatNumber>
                <StatHelpText>
                  {statistics.closedTrades} closed trades
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Profit Factor</StatLabel>
                <StatNumber color={statistics.profitFactor >= 1 ? positiveColor : negativeColor}>
                  {statistics.profitFactor.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  Gross Profit / Gross Loss
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Average R/R</StatLabel>
                <StatNumber color={statistics.averageRiskReward >= 1 ? positiveColor : negativeColor}>
                  {statistics.averageRiskReward.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  Setup quality (theoretical)
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Sharpe Ratio</StatLabel>
                <StatNumber color={statistics.sharpeRatio >= 1 ? positiveColor : negativeColor}>
                  {statistics.sharpeRatio.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  Risk-adjusted return
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Average Return</StatLabel>
                <StatNumber color={statistics.averageReturn >= 0 ? positiveColor : negativeColor}>
                  {formatPercentage(statistics.averageReturn)}
                </StatNumber>
                <StatHelpText>
                  Per trade average
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel>Max Drawdown</StatLabel>
                <StatNumber color={negativeColor}>
                  {formatPercentage(statistics.maxDrawdown)}
                </StatNumber>
                <StatHelpText>
                  Peak to trough decline
                </StatHelpText>
              </Stat>
            </Grid>
          </CardBody>
        </Card>

        {/* Model Performance */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>AI Model Performance</Text>
            <VStack spacing={4} align="stretch">
              {modelPerformance.map((model) => (
                <Box key={model.modelName} p={4} borderWidth={1} borderRadius="md" borderColor={borderColor}>
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="medium">{model.modelName}</Text>
                    <Badge colorScheme={model.totalReturn >= 0 ? 'green' : 'red'}>
                      {formatPercentage(model.totalReturn)}
                    </Badge>
                  </HStack>
                  
                  <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={3}>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Win Rate</Text>
                      <Text fontWeight="medium">{formatPercentage(model.winRate)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Trades</Text>
                      <Text fontWeight="medium">{model.totalRecommendations}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Avg Confidence</Text>
                      <Text fontWeight="medium">{formatPercentageFromDecimal(model.averageConfidence)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Avg Return</Text>
                      <Text fontWeight="medium">{formatPercentage(model.averageReturn)}</Text>
                    </Box>
                  </Grid>
                  
                  <Box mt={3}>
                    <Text fontSize="sm" color="gray.500" mb={1}>Performance</Text>
                    <Progress
                      value={Math.max(0, Math.min(100, (model.winRate * 100)))}
                      colorScheme={model.winRate >= 0.6 ? 'green' : model.winRate >= 0.4 ? 'yellow' : 'red'}
                      size="sm"
                    />
                  </Box>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Token Performance */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>Token Performance</Text>
            <VStack spacing={4} align="stretch">
              {tokenPerformance.slice(0, 10).map((token) => (
                <Box key={token.ticker} p={4} borderWidth={1} borderRadius="md" borderColor={borderColor}>
                  <HStack justify="space-between" mb={2}>
                    <HStack>
                      <Text fontWeight="medium">{token.ticker}</Text>
                      <Badge colorScheme={getConfidenceColor(token.averageConfidence)}>
                        {formatPercentageFromDecimal(token.averageConfidence)} confidence
                      </Badge>
                    </HStack>
                    <Badge colorScheme={token.totalReturn >= 0 ? 'green' : 'red'}>
                      {formatPercentage(token.totalReturn)}
                    </Badge>
                  </HStack>
                  
                  <Grid templateColumns="repeat(auto-fit, minmax(120px, 1fr))" gap={3}>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Win Rate</Text>
                      <Text fontWeight="medium">{formatPercentage(token.winRate)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Trades</Text>
                      <Text fontWeight="medium">{token.totalTrades}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Avg Return</Text>
                      <Text fontWeight="medium" color={token.averageReturn >= 0 ? positiveColor : negativeColor}>
                        {formatPercentage(token.averageReturn)}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Best Win</Text>
                      <Text fontWeight="medium" color={token.bestTrade !== null ? positiveColor : 'gray.500'}>
                        {token.bestTrade !== null ? formatPercentage(token.bestTrade) : 'No Wins'}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.500">Worst Loss</Text>
                      <Text fontWeight="medium" color={token.worstTrade !== null ? negativeColor : 'gray.500'}>
                        {token.worstTrade !== null ? formatPercentage(token.worstTrade) : 'No Losses'}
                      </Text>
                    </Box>
                  </Grid>
                  
                  <Box mt={3}>
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="sm" color="gray.500">Win Rate Progress</Text>
                      <Text fontSize="sm" color="gray.500">{token.winningTrades}/{token.totalTrades}</Text>
                    </HStack>
                    <Progress
                      value={token.winRate * 100}
                      colorScheme={token.winRate >= 0.6 ? 'green' : token.winRate >= 0.4 ? 'yellow' : 'red'}
                      size="sm"
                    />
                  </Box>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Additional Insights */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>Key Insights</Text>
            <VStack spacing={3} align="stretch">
              <HStack justify="space-between">
                <Text>Best Performing Model:</Text>
                <Text fontWeight="medium">
                  {modelPerformance.length > 0
                    ? modelPerformance.reduce((best, current) =>
                        current.totalReturn > best.totalReturn ? current : best
                      ).modelName
                    : 'N/A'
                  }
                </Text>
              </HStack>
              
              <Divider />
              
              <HStack justify="space-between">
                <Text>Most Traded Token:</Text>
                <Text fontWeight="medium">
                  {tokenPerformance.length > 0
                    ? tokenPerformance.reduce((most, current) =>
                        current.totalTrades > most.totalTrades ? current : most
                      ).ticker
                    : 'N/A'
                  }
                </Text>
              </HStack>
              
              <Divider />
              
              <HStack justify="space-between">
                <Text>Highest Win Rate Token:</Text>
                <Text fontWeight="medium">
                  {tokenPerformance.length > 0
                    ? tokenPerformance.reduce((best, current) =>
                        current.winRate > best.winRate ? current : best
                      ).ticker
                    : 'N/A'
                  }
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default AITradeStatisticsPanel;