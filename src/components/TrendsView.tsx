import React, { useMemo, useState } from 'react';
import {
  Box,
  Heading,
  Card,
  CardBody,
  SimpleGrid,
  Flex,
  Text,
  Select,
  HStack,
  Button,
  ButtonGroup,
  Icon,
  useColorModeValue,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Badge,
  VStack,
  Progress,
  Divider
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiTarget,
  FiAlertTriangle,
  FiCheckCircle,
  FiBarChart2,
  FiZap
} from 'react-icons/fi';
import { useHyperliquid } from '../context/HyperliquidContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  format,
  subDays,
  isAfter
} from 'date-fns';

// Types for the redesigned trends analysis
interface TokenTrend {
  coin: string;
  recentWinRate: number;
  historicalWinRate: number;
  recentPnL: number;
  historicalAvgPnL: number;
  trendDirection: 'hot' | 'cold' | 'stable';
  momentumScore: number; // -100 to +100
  recentTradeCount: number;
  historicalTradeCount: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  recentVolume: number;
  historicalAvgVolume: number;
  improvementPercentage: number;
}

interface RecentPerformanceMetrics {
  recentWinRate: number;
  historicalWinRate: number;
  recentPnL: number;
  historicalAvgPnL: number;
  recentTradesPerDay: number;
  historicalTradesPerDay: number;
  performanceChange: number;
  momentumDirection: 'improving' | 'declining' | 'stable';
}

interface ActionableInsight {
  type: 'recommendation' | 'alert' | 'warning';
  title: string;
  description: string;
  tokens?: string[];
  priority: 'high' | 'medium' | 'low';
}

// Helper function to filter data based on selected timeframe
const filterDataByTimeframe = (data: any[], timeframe: string) => {
  const now = new Date();
  
  switch (timeframe) {
    case '24h':
      return data.filter(item => isAfter(new Date(item.time), subDays(now, 1)));
    case '3d':
      return data.filter(item => isAfter(new Date(item.time), subDays(now, 3)));
    case '7d':
      return data.filter(item => isAfter(new Date(item.time), subDays(now, 7)));
    case '14d':
      return data.filter(item => isAfter(new Date(item.time), subDays(now, 14)));
    default:
      return data.filter(item => isAfter(new Date(item.time), subDays(now, 7)));
  }
};

// Helper function to get historical baseline (excluding recent period)
const getHistoricalBaseline = (data: any[], recentDays: number) => {
  const cutoffDate = subDays(new Date(), recentDays);
  return data.filter(item => !isAfter(new Date(item.time), cutoffDate));
};

const TrendsView: React.FC = () => {
  const { state } = useHyperliquid();
  
  // Local state
  const [timeframe, setTimeframe] = useState('7d');
  
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');
  const greenColor = useColorModeValue('green.500', 'green.300');
  const redColor = useColorModeValue('red.500', 'red.300');
  
  // Calculate recent vs historical performance analysis
  const performanceAnalysis = useMemo(() => {
    if (!state.trades || state.trades.length === 0) {
      return {
        recentMetrics: {
          recentWinRate: 0,
          historicalWinRate: 0,
          recentPnL: 0,
          historicalAvgPnL: 0,
          recentTradesPerDay: 0,
          historicalTradesPerDay: 0,
          performanceChange: 0,
          momentumDirection: 'stable' as const
        },
        tokenTrends: [],
        comparisonData: [],
        actionableInsights: []
      };
    }

    const trades = state.trades;
    const recentDays = timeframe === '24h' ? 1 : timeframe === '3d' ? 3 : timeframe === '7d' ? 7 : 14;
    
    // Split data into recent and historical
    const recentTrades = filterDataByTimeframe(trades, timeframe);
    const historicalTrades = getHistoricalBaseline(trades, recentDays);
    
    // Calculate recent performance metrics
    const recentWinningTrades = recentTrades.filter(t => (t.closed_pnl || 0) > 0).length;
    const recentWinRate = recentTrades.length > 0 ? (recentWinningTrades / recentTrades.length) * 100 : 0;
    const recentPnL = recentTrades.reduce((sum, t) => sum + (t.closed_pnl || 0), 0);
    const recentTradesPerDay = recentTrades.length / recentDays;
    
    // Calculate historical performance metrics
    const historicalWinningTrades = historicalTrades.filter(t => (t.closed_pnl || 0) > 0).length;
    const historicalWinRate = historicalTrades.length > 0 ? (historicalWinningTrades / historicalTrades.length) * 100 : 0;
    const historicalTotalPnL = historicalTrades.reduce((sum, t) => sum + (t.closed_pnl || 0), 0);
    const historicalAvgPnL = historicalTrades.length > 0 ? historicalTotalPnL / historicalTrades.length : 0;
    const historicalDays = Math.max(1, Math.ceil((new Date().getTime() - subDays(new Date(), recentDays).getTime()) / (1000 * 60 * 60 * 24)));
    const historicalTradesPerDay = historicalTrades.length / historicalDays;
    
    // Calculate performance change
    const winRateChange = recentWinRate - historicalWinRate;
    const recentAvgPnL = recentTrades.length > 0 ? recentPnL / recentTrades.length : 0;
    const pnlChange = recentAvgPnL - historicalAvgPnL;
    const performanceChange = (winRateChange + (pnlChange > 0 ? 10 : pnlChange < 0 ? -10 : 0)) / 2;
    
    const momentumDirection = performanceChange > 5 ? 'improving' : performanceChange < -5 ? 'declining' : 'stable';
    
    // Analyze token trends
    const tokenStats: Record<string, any> = {};
    
    // Process recent trades by token
    recentTrades.forEach(trade => {
      if (!tokenStats[trade.coin]) {
        tokenStats[trade.coin] = {
          recentTrades: 0,
          recentWins: 0,
          recentPnL: 0,
          recentVolume: 0,
          historicalTrades: 0,
          historicalWins: 0,
          historicalPnL: 0,
          historicalVolume: 0
        };
      }
      
      tokenStats[trade.coin].recentTrades += 1;
      if ((trade.closed_pnl || 0) > 0) tokenStats[trade.coin].recentWins += 1;
      tokenStats[trade.coin].recentPnL += trade.closed_pnl || 0;
      tokenStats[trade.coin].recentVolume += (trade.px * trade.sz) || 0;
    });
    
    // Process historical trades by token
    historicalTrades.forEach(trade => {
      if (!tokenStats[trade.coin]) {
        tokenStats[trade.coin] = {
          recentTrades: 0,
          recentWins: 0,
          recentPnL: 0,
          recentVolume: 0,
          historicalTrades: 0,
          historicalWins: 0,
          historicalPnL: 0,
          historicalVolume: 0
        };
      }
      
      tokenStats[trade.coin].historicalTrades += 1;
      if ((trade.closed_pnl || 0) > 0) tokenStats[trade.coin].historicalWins += 1;
      tokenStats[trade.coin].historicalPnL += trade.closed_pnl || 0;
      tokenStats[trade.coin].historicalVolume += (trade.px * trade.sz) || 0;
    });
    
    // Calculate token trends
    const tokenTrends: TokenTrend[] = Object.entries(tokenStats)
      .map(([coin, stats]) => {
        const recentWinRate = stats.recentTrades > 0 ? (stats.recentWins / stats.recentTrades) * 100 : 0;
        const historicalWinRate = stats.historicalTrades > 0 ? (stats.historicalWins / stats.historicalTrades) * 100 : 0;
        const recentAvgPnL = stats.recentTrades > 0 ? stats.recentPnL / stats.recentTrades : 0;
        const historicalAvgPnL = stats.historicalTrades > 0 ? stats.historicalPnL / stats.historicalTrades : 0;
        
        const winRateImprovement = recentWinRate - historicalWinRate;
        const pnlImprovement = recentAvgPnL - historicalAvgPnL;
        const momentumScore = Math.min(100, Math.max(-100, winRateImprovement * 2 + (pnlImprovement > 0 ? 20 : pnlImprovement < 0 ? -20 : 0)));
        
        let trendDirection: 'hot' | 'cold' | 'stable' = 'stable';
        if (momentumScore > 15) trendDirection = 'hot';
        else if (momentumScore < -15) trendDirection = 'cold';
        
        const totalTrades = stats.recentTrades + stats.historicalTrades;
        const confidenceLevel: 'high' | 'medium' | 'low' = totalTrades >= 10 ? 'high' : totalTrades >= 5 ? 'medium' : 'low';
        
        const improvementPercentage = historicalWinRate > 0 ? ((recentWinRate - historicalWinRate) / historicalWinRate) * 100 : 0;
        
        return {
          coin,
          recentWinRate,
          historicalWinRate,
          recentPnL: stats.recentPnL,
          historicalAvgPnL,
          trendDirection,
          momentumScore,
          recentTradeCount: stats.recentTrades,
          historicalTradeCount: stats.historicalTrades,
          confidenceLevel,
          recentVolume: stats.recentVolume,
          historicalAvgVolume: stats.historicalVolume / Math.max(1, stats.historicalTrades),
          improvementPercentage
        };
      })
      .filter(trend => trend.recentTradeCount > 0 || trend.historicalTradeCount > 0)
      .sort((a, b) => Math.abs(b.momentumScore) - Math.abs(a.momentumScore));
    
    // Generate comparison data for charts
    const comparisonData = [
      {
        metric: 'Win Rate',
        recent: recentWinRate,
        historical: historicalWinRate,
        change: winRateChange
      },
      {
        metric: 'Avg P&L',
        recent: recentAvgPnL,
        historical: historicalAvgPnL,
        change: recentAvgPnL - historicalAvgPnL
      },
      {
        metric: 'Trades/Day',
        recent: recentTradesPerDay,
        historical: historicalTradesPerDay,
        change: recentTradesPerDay - historicalTradesPerDay
      }
    ];
    
    // Generate actionable insights
    const insights: ActionableInsight[] = [];
    
    // Hot tokens recommendation
    const hotTokens = tokenTrends.filter(t => t.trendDirection === 'hot' && t.confidenceLevel !== 'low').slice(0, 3);
    if (hotTokens.length > 0) {
      insights.push({
        type: 'recommendation',
        title: 'Consider Increasing Exposure',
        description: `${hotTokens.map(t => t.coin).join(', ')} showing strong recent performance vs historical average`,
        tokens: hotTokens.map(t => t.coin),
        priority: 'high'
      });
    }
    
    // Cold tokens warning
    const coldTokens = tokenTrends.filter(t => t.trendDirection === 'cold' && t.confidenceLevel !== 'low').slice(0, 3);
    if (coldTokens.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Review Strategy',
        description: `${coldTokens.map(t => t.coin).join(', ')} showing declining performance - consider strategy adjustment`,
        tokens: coldTokens.map(t => t.coin),
        priority: 'high'
      });
    }
    
    // Overall performance insight
    if (Math.abs(performanceChange) > 10) {
      insights.push({
        type: performanceChange > 0 ? 'recommendation' : 'alert',
        title: `Recent Performance ${performanceChange > 0 ? 'Improvement' : 'Decline'}`,
        description: `Your recent trading is ${Math.abs(performanceChange).toFixed(1)}% ${performanceChange > 0 ? 'above' : 'below'} historical average`,
        priority: 'medium'
      });
    }
    
    return {
      recentMetrics: {
        recentWinRate,
        historicalWinRate,
        recentPnL,
        historicalAvgPnL,
        recentTradesPerDay,
        historicalTradesPerDay,
        performanceChange,
        momentumDirection
      },
      tokenTrends,
      comparisonData,
      actionableInsights: insights
    };
  }, [state.trades, timeframe]);

  // Loading state
  if (state.isLoading) {
    return (
      <Box>
        <Skeleton height="40px" mb={4} />
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={6}>
          <Skeleton height="120px" />
          <Skeleton height="120px" />
          <Skeleton height="120px" />
          <Skeleton height="120px" />
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
        <AlertDescription>Please select a Hyperliquid account to view recent trading trends.</AlertDescription>
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
          No trades found for {state.selectedAccount.display_name} to analyze recent trends.
        </AlertDescription>
      </Alert>
    );
  }

  const { recentMetrics, tokenTrends, comparisonData, actionableInsights } = performanceAnalysis;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Recent Trading Performance - {state.selectedAccount.display_name}</Heading>
        {state.lastSyncTime && (
          <Text fontSize="sm" color="gray.500">
            Last updated: {format(new Date(state.lastSyncTime), 'PPpp')}
          </Text>
        )}
      </Flex>
      
      {/* Time-focused filters */}
      <HStack mb={6} spacing={4} wrap="wrap">
        <Text fontWeight="medium" color="gray.600">Recent Period:</Text>
        <ButtonGroup size="sm" isAttached variant="outline">
          <Button
            onClick={() => setTimeframe('24h')}
            colorScheme={timeframe === '24h' ? 'blue' : 'gray'}
          >
            24 Hours
          </Button>
          <Button
            onClick={() => setTimeframe('3d')}
            colorScheme={timeframe === '3d' ? 'blue' : 'gray'}
          >
            3 Days
          </Button>
          <Button
            onClick={() => setTimeframe('7d')}
            colorScheme={timeframe === '7d' ? 'blue' : 'gray'}
          >
            7 Days
          </Button>
          <Button
            onClick={() => setTimeframe('14d')}
            colorScheme={timeframe === '14d' ? 'blue' : 'gray'}
          >
            14 Days
          </Button>
        </ButtonGroup>
      </HStack>
      
      {/* Recent Performance Overview */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={8}>
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Recent Win Rate</StatLabel>
              <StatNumber>{recentMetrics.recentWinRate.toFixed(1)}%</StatNumber>
              <StatHelpText>
                <StatArrow type={recentMetrics.recentWinRate > recentMetrics.historicalWinRate ? 'increase' : 'decrease'} />
                vs {recentMetrics.historicalWinRate.toFixed(1)}% historical
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Recent P&L Trend</StatLabel>
              <StatNumber color={recentMetrics.recentPnL >= 0 ? greenColor : redColor}>
                ${recentMetrics.recentPnL.toFixed(2)}
              </StatNumber>
              <StatHelpText>
                <StatArrow type={recentMetrics.performanceChange > 0 ? 'increase' : 'decrease'} />
                {Math.abs(recentMetrics.performanceChange).toFixed(1)}% vs historical
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Stat>
              <StatLabel>Trading Momentum</StatLabel>
              <StatNumber>{recentMetrics.recentTradesPerDay.toFixed(1)}/day</StatNumber>
              <StatHelpText>
                <StatArrow type={recentMetrics.recentTradesPerDay > recentMetrics.historicalTradesPerDay ? 'increase' : 'decrease'} />
                vs {recentMetrics.historicalTradesPerDay.toFixed(1)} historical
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Flex align="center" mb={2}>
              <Icon as={FiActivity} color="purple.500" mr={2} />
              <Text fontWeight="medium">Performance Status</Text>
            </Flex>
            <Badge
              size="lg"
              colorScheme={
                recentMetrics.momentumDirection === 'improving' ? 'green' :
                recentMetrics.momentumDirection === 'declining' ? 'red' : 'gray'
              }
            >
              {recentMetrics.momentumDirection.toUpperCase()}
            </Badge>
            <Text fontSize="sm" color="gray.500" mt={2}>
              Recent vs historical trend
            </Text>
          </CardBody>
        </Card>
      </SimpleGrid>
      
      {/* Token Trending Analysis */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={8}>
        {/* Hot Tokens */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Flex align="center" mb={4}>
              <Icon as={FiTrendingUp} color={greenColor} mr={2} />
              <Heading size="md">Hot Tokens (Trending Positive)</Heading>
            </Flex>
            
            <VStack spacing={3} align="stretch">
              {tokenTrends.filter(t => t.trendDirection === 'hot').slice(0, 5).map((token, index) => (
                <Box key={token.coin} p={3} bg={useColorModeValue('green.50', 'green.900')} borderRadius="md">
                  <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="bold">{token.coin}</Text>
                      <Text fontSize="sm" color="gray.600">
                        {token.recentTradeCount} recent trades
                      </Text>
                    </VStack>
                    <VStack align="end" spacing={1}>
                      <Badge colorScheme="green">
                        +{token.improvementPercentage.toFixed(1)}%
                      </Badge>
                      <Text fontSize="sm" color={greenColor}>
                        {token.recentWinRate.toFixed(1)}% win rate
                      </Text>
                    </VStack>
                  </Flex>
                  <Progress
                    value={Math.min(100, Math.max(0, token.momentumScore + 50))}
                    colorScheme="green"
                    size="sm"
                    mt={2}
                  />
                </Box>
              ))}
              {tokenTrends.filter(t => t.trendDirection === 'hot').length === 0 && (
                <Text color="gray.500" textAlign="center" py={4}>
                  No hot tokens detected in recent period
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Cold Tokens */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Flex align="center" mb={4}>
              <Icon as={FiTrendingDown} color={redColor} mr={2} />
              <Heading size="md">Cold Tokens (Trending Negative)</Heading>
            </Flex>
            
            <VStack spacing={3} align="stretch">
              {tokenTrends.filter(t => t.trendDirection === 'cold').slice(0, 5).map((token, index) => (
                <Box key={token.coin} p={3} bg={useColorModeValue('red.50', 'red.900')} borderRadius="md">
                  <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="bold">{token.coin}</Text>
                      <Text fontSize="sm" color="gray.600">
                        {token.recentTradeCount} recent trades
                      </Text>
                    </VStack>
                    <VStack align="end" spacing={1}>
                      <Badge colorScheme="red">
                        {token.improvementPercentage.toFixed(1)}%
                      </Badge>
                      <Text fontSize="sm" color={redColor}>
                        {token.recentWinRate.toFixed(1)}% win rate
                      </Text>
                    </VStack>
                  </Flex>
                  <Progress
                    value={Math.min(100, Math.max(0, 50 - Math.abs(token.momentumScore)))}
                    colorScheme="red"
                    size="sm"
                    mt={2}
                  />
                </Box>
              ))}
              {tokenTrends.filter(t => t.trendDirection === 'cold').length === 0 && (
                <Text color="gray.500" textAlign="center" py={4}>
                  No declining tokens detected in recent period
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Recent vs Historical Comparison Chart */}
      <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} mb={8}>
        <CardBody>
          <Heading size="md" mb={4}>Recent vs Historical Performance Comparison</Heading>
          
          <Box h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={useColorModeValue('gray.200', 'gray.700')} />
                <XAxis
                  dataKey="metric"
                  tick={{ fill: useColorModeValue('gray.700', 'white'), fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: useColorModeValue('gray.700', 'white'), fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: useColorModeValue('white', '#1A202C'),
                    borderColor: useColorModeValue('gray.200', 'gray.600'),
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="recent" fill="#3182CE" name="Recent" />
                <Bar dataKey="historical" fill="#A0AEC0" name="Historical" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>

      {/* Actionable Insights Panel */}
      {actionableInsights.length > 0 && (
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor}>
          <CardBody>
            <Flex align="center" mb={4}>
              <Icon as={FiZap} color="orange.500" mr={2} />
              <Heading size="md">Actionable Insights</Heading>
            </Flex>
            
            <VStack spacing={4} align="stretch">
              {actionableInsights.map((insight, index) => (
                <Alert
                  key={index}
                  status={insight.type === 'recommendation' ? 'success' : insight.type === 'warning' ? 'warning' : 'info'}
                  borderRadius="md"
                >
                  <AlertIcon />
                  <Box>
                    <AlertTitle>{insight.title}</AlertTitle>
                    <AlertDescription>{insight.description}</AlertDescription>
                  </Box>
                </Alert>
              ))}
            </VStack>
          </CardBody>
        </Card>
      )}
    </Box>
  );
};

export default TrendsView;