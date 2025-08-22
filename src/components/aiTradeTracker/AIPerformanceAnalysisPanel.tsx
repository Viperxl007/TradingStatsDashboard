import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Select,
  Grid,
  GridItem,
  Badge,
  Progress,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useColorModeValue,
  SimpleGrid
} from '@chakra-ui/react';
import { getAllTradesHistoryForAITracker } from '../../services/productionActiveTradesService';
import { AITradeEntry, AITradeStatistics } from '../../types/aiTradeTracker';
import { AITradeStatisticsCalculator } from '../../services/aiTradeStatisticsCalculator';

interface AIPerformanceAnalysisPanelProps {
  onError: (error: string) => void;
}

const AIPerformanceAnalysisPanel: React.FC<AIPerformanceAnalysisPanelProps> = ({ onError }) => {
  const [trades, setTrades] = useState<AITradeEntry[]>([]);
  const [statistics, setStatistics] = useState<AITradeStatistics | null>(null);
  const [analysisType, setAnalysisType] = useState<'confidence' | 'timeframe' | 'model' | 'monthly'>('confidence');
  const [loading, setLoading] = useState(true);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const positiveColor = useColorModeValue('green.500', 'green.300');
  const negativeColor = useColorModeValue('red.500', 'red.300');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const allTrades = await getAllTradesHistoryForAITracker();
      
      // Use centralized statistics calculator for accurate percentage-based metrics
      const stats = AITradeStatisticsCalculator.calculateStatistics(allTrades);
      
      setTrades(allTrades);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading performance data:', error);
      onError('Failed to load performance analysis');
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
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? positiveColor : negativeColor;
  };

  if (loading || !statistics) {
    return (
      <Box p={6}>
        <Text>Loading performance analysis...</Text>
      </Box>
    );
  }

  const renderConfidenceAnalysis = () => {
    const confidenceLevels = Object.entries(statistics.byConfidence);
    
    return (
      <VStack spacing={4} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">Performance by Confidence Level</Text>
        {confidenceLevels.map(([level, data]) => (
          <Card key={level} bg={cardBg} borderColor={borderColor}>
            <CardBody>
              <HStack justify="space-between" mb={3}>
                <HStack>
                  <Text fontWeight="medium" textTransform="capitalize">{level.replace('_', ' ')}</Text>
                  <Badge colorScheme={getConfidenceColor(level === 'very_high' ? 0.9 : level === 'high' ? 0.75 : level === 'medium' ? 0.6 : 0.4)}>
                    {data.count} trades
                  </Badge>
                </HStack>
                <Badge colorScheme={data.totalReturn >= 0 ? 'green' : 'red'}>
                  {formatPercentage(data.totalReturn)}
                </Badge>
              </HStack>
              
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat size="sm">
                  <StatLabel>Win Rate</StatLabel>
                  <StatNumber fontSize="md">{formatPercentage(data.winRate)}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Avg Return</StatLabel>
                  <StatNumber fontSize="md" color={getPerformanceColor(data.averageReturn)}>
                    {formatPercentage(data.averageReturn)}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Total Return</StatLabel>
                  <StatNumber fontSize="md" color={getPerformanceColor(data.totalReturn)}>
                    {formatPercentage(data.totalReturn)}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Performance</StatLabel>
                  <Progress
                    value={Math.max(0, Math.min(100, data.winRate))}
                    colorScheme={data.winRate >= 60 ? 'green' : data.winRate >= 40 ? 'yellow' : 'red'}
                    size="sm"
                  />
                </Stat>
              </SimpleGrid>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  const renderTimeframeAnalysis = () => {
    const timeframes = Object.entries(statistics.byTimeframe);
    
    return (
      <VStack spacing={4} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">Performance by Timeframe</Text>
        {timeframes.map(([timeframe, data]) => (
          <Card key={timeframe} bg={cardBg} borderColor={borderColor}>
            <CardBody>
              <HStack justify="space-between" mb={3}>
                <HStack>
                  <Text fontWeight="medium">{timeframe}</Text>
                  <Badge variant="outline">{data.count} trades</Badge>
                </HStack>
                <Badge colorScheme={data.totalReturn >= 0 ? 'green' : 'red'}>
                  {formatPercentage(data.totalReturn)}
                </Badge>
              </HStack>
              
              <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4}>
                <Stat size="sm">
                  <StatLabel>Win Rate</StatLabel>
                  <StatNumber fontSize="md">{formatPercentage(data.winRate)}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Avg Return</StatLabel>
                  <StatNumber fontSize="md" color={getPerformanceColor(data.averageReturn)}>
                    {formatPercentage(data.averageReturn)}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Total Return</StatLabel>
                  <StatNumber fontSize="md" color={getPerformanceColor(data.totalReturn)}>
                    {formatPercentage(data.totalReturn)}
                  </StatNumber>
                </Stat>
              </SimpleGrid>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  const renderModelAnalysis = () => {
    const models = Object.entries(statistics.byModel);
    
    return (
      <VStack spacing={4} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">Performance by AI Model</Text>
        {models.map(([modelName, data]) => (
          <Card key={modelName} bg={cardBg} borderColor={borderColor}>
            <CardBody>
              <HStack justify="space-between" mb={3}>
                <HStack>
                  <Text fontWeight="medium">{data.modelName}</Text>
                  <Badge variant="outline">{data.totalRecommendations} recommendations</Badge>
                </HStack>
                <Badge colorScheme={data.totalReturn >= 0 ? 'green' : 'red'}>
                  {formatPercentage(data.totalReturn)}
                </Badge>
              </HStack>
              
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat size="sm">
                  <StatLabel>Win Rate</StatLabel>
                  <StatNumber fontSize="md">{formatPercentage(data.winRate)}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Avg Confidence</StatLabel>
                  <StatNumber fontSize="md">{formatPercentage(data.averageConfidence)}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Avg Return</StatLabel>
                  <StatNumber fontSize="md" color={getPerformanceColor(data.averageReturn)}>
                    {formatPercentage(data.averageReturn)}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Best Trade</StatLabel>
                  <StatNumber fontSize="md" color={positiveColor}>
                    {formatPercentage(data.bestTrade)}
                  </StatNumber>
                </Stat>
              </SimpleGrid>
              
              <Box mt={3}>
                <Text fontSize="sm" color="gray.500" mb={1}>Success Rate</Text>
                <Progress
                  value={data.winRate}
                  colorScheme={data.winRate >= 60 ? 'green' : data.winRate >= 40 ? 'yellow' : 'red'}
                  size="sm"
                />
              </Box>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  const renderMonthlyAnalysis = () => {
    const monthlyData = statistics.monthlyPerformance.slice(-12); // Last 12 months
    
    return (
      <VStack spacing={4} align="stretch">
        <Text fontSize="lg" fontWeight="semibold">Monthly Performance Trends</Text>
        {monthlyData.map((month) => (
          <Card key={month.month} bg={cardBg} borderColor={borderColor}>
            <CardBody>
              <HStack justify="space-between" mb={3}>
                <HStack>
                  <Text fontWeight="medium">{month.month}</Text>
                  <Badge variant="outline">{month.trades} trades</Badge>
                </HStack>
                <Badge colorScheme={month.totalReturn >= 0 ? 'green' : 'red'}>
                  {formatPercentage(month.totalReturn)}
                </Badge>
              </HStack>
              
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat size="sm">
                  <StatLabel>Win Rate</StatLabel>
                  <StatNumber fontSize="md">{formatPercentage(month.winRate)}</StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Avg Return</StatLabel>
                  <StatNumber fontSize="md" color={getPerformanceColor(month.averageReturn)}>
                    {formatPercentage(month.averageReturn)}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Best Trade</StatLabel>
                  <StatNumber fontSize="md" color={positiveColor}>
                    {formatPercentage(month.bestTrade)}
                  </StatNumber>
                </Stat>
                <Stat size="sm">
                  <StatLabel>Worst Trade</StatLabel>
                  <StatNumber fontSize="md" color={negativeColor}>
                    {formatPercentage(month.worstTrade)}
                  </StatNumber>
                </Stat>
              </SimpleGrid>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  const renderAnalysis = () => {
    switch (analysisType) {
      case 'confidence':
        return renderConfidenceAnalysis();
      case 'timeframe':
        return renderTimeframeAnalysis();
      case 'model':
        return renderModelAnalysis();
      case 'monthly':
        return renderMonthlyAnalysis();
      default:
        return renderConfidenceAnalysis();
    }
  };

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header with Analysis Type Selector */}
        <HStack justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold">Performance Analysis</Text>
          <Select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as any)}
            width="250px"
          >
            <option value="confidence">By Confidence Level</option>
            <option value="timeframe">By Timeframe</option>
            <option value="model">By AI Model</option>
            <option value="monthly">Monthly Trends</option>
          </Select>
        </HStack>

        {/* Key Performance Indicators */}
        <Card bg={cardBg} borderColor={borderColor}>
          <CardBody>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>Key Performance Indicators</Text>
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
              <Stat>
                <StatLabel>Total Trades</StatLabel>
                <StatNumber>{statistics.totalRecommendations}</StatNumber>
                <StatHelpText>
                  {statistics.activeTrades} active
                </StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel>Overall Win Rate</StatLabel>
                <StatNumber>{formatPercentage(statistics.winRate)}</StatNumber>
                <StatHelpText>
                  <StatArrow type={statistics.winRate >= 50 ? 'increase' : 'decrease'} />
                  {statistics.winningTrades}/{statistics.closedTrades}
                </StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel>Total Return</StatLabel>
                <StatNumber color={getPerformanceColor(statistics.totalReturn)}>
                  {formatPercentage(statistics.totalReturn)}
                </StatNumber>
                <StatHelpText>
                  <StatArrow type={statistics.totalReturn >= 0 ? 'increase' : 'decrease'} />
                  Avg: {formatPercentage(statistics.averageReturn)}
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
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Dynamic Analysis Content */}
        {renderAnalysis()}
      </VStack>
    </Box>
  );
};

export default AIPerformanceAnalysisPanel;