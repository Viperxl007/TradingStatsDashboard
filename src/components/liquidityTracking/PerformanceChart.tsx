import React, { useMemo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Grid,
  GridItem,
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';
import {
  CLPosition,
  CLPriceHistory,
  CLAnalytics
} from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface PerformanceChartProps {
  position: CLPosition;
  priceHistory: CLPriceHistory[];
  analytics: CLAnalytics | null;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  position,
  priceHistory,
  analytics
}) => {
  const { colorMode } = useColorMode();

  // Prepare performance data
  const performanceData = useMemo(() => {
    return priceHistory
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(item => ({
        date: new Date(item.timestamp).toLocaleDateString(),
        totalReturn: item.total_return,
        totalReturnPercent: ((item.total_return / position.initial_usd_value) * 100),
        feesEarned: item.fees_earned_usd,
        impermanentLoss: Math.abs(item.impermanent_loss),
        impermanentLossPercent: Math.abs((item.impermanent_loss / position.initial_usd_value) * 100),
        usdValue: item.usd_value,
        price: item.price
      }));
  }, [priceHistory, position]);

  // Prepare daily returns data from analytics
  const dailyReturnsData = useMemo(() => {
    if (!analytics?.daily_returns) return [];
    
    return analytics.daily_returns.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      returnPercent: item.return_percentage,
      feesEarned: item.fees_earned,
      ilPercent: item.il_percentage
    }));
  }, [analytics]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
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
            {payload.map((entry: any, index: number) => (
              <Text key={index} fontSize="sm" color={entry.color}>
                {entry.name}: {
                  entry.name.includes('%') 
                    ? `${entry.value.toFixed(2)}%`
                    : liquidityTrackingService.utils.formatCurrency(entry.value)
                }
              </Text>
            ))}
          </VStack>
        </Box>
      );
    }
    return null;
  };

  const getReturnColor = (value: number) => {
    if (value > 0) return '#48BB78';
    if (value < 0) return '#F56565';
    return '#A0AEC0';
  };

  if (performanceData.length === 0) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Heading size="md">Performance Analysis</Heading>
            <Text color="gray.500">No performance data available</Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <VStack spacing={6} align="stretch">
          {/* Header with Key Metrics */}
          <VStack spacing={4} align="stretch">
            <Heading size="md">Performance Analysis</Heading>
            
            <Grid templateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={4}>
              <Stat>
                <StatLabel fontSize="xs">Total Return</StatLabel>
                <StatNumber fontSize="md" color={getReturnColor(position.total_return)}>
                  {liquidityTrackingService.utils.formatCurrency(position.total_return)}
                </StatNumber>
                <StatHelpText fontSize="xs">
                  <StatArrow type={position.total_return_percentage >= 0 ? 'increase' : 'decrease'} />
                  {liquidityTrackingService.utils.formatPercentage(position.total_return_percentage)}
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel fontSize="xs">Fees Earned</StatLabel>
                <StatNumber fontSize="md" color="green.500">
                  {liquidityTrackingService.utils.formatCurrency(position.fees_earned_usd)}
                </StatNumber>
                <StatHelpText fontSize="xs">
                  APY: {analytics?.performance_metrics.fees_apy 
                    ? liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.fees_apy)
                    : 'N/A'
                  }
                </StatHelpText>
              </Stat>

              <Stat>
                <StatLabel fontSize="xs">Impermanent Loss</StatLabel>
                <StatNumber fontSize="md" color="red.500">
                  {liquidityTrackingService.utils.formatPercentage(position.impermanent_loss_percentage)}
                </StatNumber>
                <StatHelpText fontSize="xs">
                  {liquidityTrackingService.utils.formatCurrency(Math.abs(position.impermanent_loss))}
                </StatHelpText>
              </Stat>

              {analytics && (
                <Stat>
                  <StatLabel fontSize="xs">Sharpe Ratio</StatLabel>
                  <StatNumber fontSize="md">
                    {analytics.performance_metrics.sharpe_ratio.toFixed(2)}
                  </StatNumber>
                  <StatHelpText fontSize="xs">
                    Risk-adjusted return
                  </StatHelpText>
                </Stat>
              )}
            </Grid>
          </VStack>

          {/* Performance Charts */}
          <Tabs variant="line" colorScheme="brand">
            <TabList>
              <Tab>Total Return</Tab>
              <Tab>Fees vs IL</Tab>
              <Tab>Value Over Time</Tab>
              {analytics && <Tab>Daily Returns</Tab>}
            </TabList>

            <TabPanels>
              {/* Total Return Chart */}
              <TabPanel px={0}>
                <Box h="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'} 
                      />
                      <XAxis 
                        dataKey="date" 
                        stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                        fontSize={12}
                      />
                      <YAxis 
                        stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                        fontSize={12}
                        tickFormatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="totalReturnPercent"
                        stroke="#3182CE"
                        fill="url(#colorReturn)"
                        strokeWidth={2}
                        name="Total Return %"
                      />
                      <defs>
                        <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3182CE" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3182CE" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </TabPanel>

              {/* Fees vs IL Chart */}
              <TabPanel px={0}>
                <Box h="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={performanceData}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'} 
                      />
                      <XAxis 
                        dataKey="date" 
                        stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                        fontSize={12}
                      />
                      <YAxis 
                        stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="feesEarned"
                        stackId="1"
                        stroke="#48BB78"
                        fill="#48BB78"
                        fillOpacity={0.6}
                        name="Fees Earned"
                      />
                      <Area
                        type="monotone"
                        dataKey="impermanentLoss"
                        stackId="2"
                        stroke="#F56565"
                        fill="#F56565"
                        fillOpacity={0.6}
                        name="Impermanent Loss"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </TabPanel>

              {/* Value Over Time Chart */}
              <TabPanel px={0}>
                <Box h="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'} 
                      />
                      <XAxis 
                        dataKey="date" 
                        stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                        fontSize={12}
                      />
                      <YAxis 
                        stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="usdValue"
                        stroke="#805AD5"
                        strokeWidth={2}
                        dot={{ fill: '#805AD5', strokeWidth: 2, r: 3 }}
                        name="USD Value"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </TabPanel>

              {/* Daily Returns Chart */}
              {analytics && (
                <TabPanel px={0}>
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyReturnsData}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'} 
                        />
                        <XAxis 
                          dataKey="date" 
                          stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                          fontSize={12}
                        />
                        <YAxis 
                          stroke={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                          fontSize={12}
                          tickFormatter={(value) => `${value.toFixed(1)}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="returnPercent"
                          fill="#3182CE"
                          name="Daily Return %"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>

          {/* Performance Summary */}
          {analytics && (
            <Box pt={4} borderTop="1px solid" borderTopColor="gray.200">
              <Heading size="sm" mb={3}>Performance Summary</Heading>
              <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="xs" color="gray.500">ANNUALIZED RETURN</Text>
                  <Text fontSize="sm" fontWeight="bold" color={getReturnColor(analytics.performance_metrics.annualized_return)}>
                    {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.annualized_return)}
                  </Text>
                </VStack>
                
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="xs" color="gray.500">MAX DRAWDOWN</Text>
                  <Text fontSize="sm" fontWeight="bold" color="red.500">
                    {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.max_drawdown)}
                  </Text>
                </VStack>
                
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="xs" color="gray.500">VOLATILITY</Text>
                  <Text fontSize="sm" fontWeight="bold">
                    {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.volatility)}
                  </Text>
                </VStack>
                
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="xs" color="gray.500">RANGE EFFICIENCY</Text>
                  <Text fontSize="sm" fontWeight="bold" color="blue.500">
                    {liquidityTrackingService.utils.formatPercentage(analytics.range_efficiency.range_utilization)}
                  </Text>
                </VStack>
              </Grid>
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PerformanceChart;