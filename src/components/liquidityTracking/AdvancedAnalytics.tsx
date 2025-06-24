import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Select,
  Button,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  Badge,
  Divider,
  SimpleGrid,
  Progress,
  Tooltip,
  IconButton,
  useToast
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiBarChart,
  FiPieChart,
  FiRefreshCw,
  FiDownload,
  FiInfo
} from 'react-icons/fi';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { CLPosition, CLAnalytics, CLPriceHistory } from '../../types/liquidityTracking';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface AdvancedAnalyticsProps {
  positions: CLPosition[];
  selectedPosition?: CLPosition | null;
  onPositionSelect?: (position: CLPosition) => void;
}

interface BacktestResult {
  strategy_name: string;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  equity_curve: Array<{ date: string; value: number }>;
}

interface PerformanceAttribution {
  fees_contribution: number;
  il_impact: number;
  price_appreciation: number;
  rebalancing_impact: number;
}

interface MarketRegime {
  regime: 'bull' | 'bear' | 'sideways' | 'volatile';
  confidence: number;
  start_date: string;
  characteristics: string[];
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({
  positions,
  selectedPosition,
  onPositionSelect
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('30d');
  const [analytics, setAnalytics] = useState<CLAnalytics | null>(null);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [performanceAttribution, setPerformanceAttribution] = useState<PerformanceAttribution | null>(null);
  const [marketRegime, setMarketRegime] = useState<MarketRegime | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  // Load analytics data
  useEffect(() => {
    if (selectedPosition) {
      loadAnalyticsData();
    }
  }, [selectedPosition, selectedTimeframe]);

  const loadAnalyticsData = async (): Promise<void> => {
    if (!selectedPosition) return;

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API calls - replace with actual service calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock analytics data
      const mockAnalytics: CLAnalytics = {
        position_id: selectedPosition.id,
        daily_returns: generateMockDailyReturns(),
        performance_metrics: {
          total_return: 15.67,
          annualized_return: 23.45,
          sharpe_ratio: 1.85,
          max_drawdown: -8.32,
          volatility: 12.67,
          fees_apy: 18.90,
          il_impact: -3.21
        },
        range_efficiency: {
          time_in_range: 78.5,
          time_out_of_range: 21.5,
          range_utilization: 85.3
        }
      };

      const mockBacktestResults: BacktestResult[] = [
        {
          strategy_name: 'Conservative Range',
          total_return: 12.34,
          sharpe_ratio: 1.67,
          max_drawdown: -5.21,
          win_rate: 68.5,
          profit_factor: 1.45,
          equity_curve: generateMockEquityCurve()
        },
        {
          strategy_name: 'Aggressive Range',
          total_return: 18.92,
          sharpe_ratio: 1.23,
          max_drawdown: -12.45,
          win_rate: 58.3,
          profit_factor: 1.78,
          equity_curve: generateMockEquityCurve()
        }
      ];

      const mockPerformanceAttribution: PerformanceAttribution = {
        fees_contribution: 8.45,
        il_impact: -2.13,
        price_appreciation: 7.89,
        rebalancing_impact: 1.46
      };

      const mockMarketRegime: MarketRegime = {
        regime: 'bull',
        confidence: 0.78,
        start_date: '2024-01-15',
        characteristics: ['Rising prices', 'Low volatility', 'High volume']
      };

      setAnalytics(mockAnalytics);
      setBacktestResults(mockBacktestResults);
      setPerformanceAttribution(mockPerformanceAttribution);
      setMarketRegime(mockMarketRegime);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics data';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockDailyReturns = () => {
    const returns = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      returns.push({
        date: date.toISOString().split('T')[0],
        return_percentage: (Math.random() - 0.5) * 4,
        fees_earned: Math.random() * 100,
        il_percentage: (Math.random() - 0.7) * 2
      });
    }
    return returns;
  };

  const generateMockEquityCurve = () => {
    const curve = [];
    let value = 10000;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    for (let i = 0; i < 90; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      value *= (1 + (Math.random() - 0.48) * 0.02);
      curve.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value)
      });
    }
    return curve;
  };

  const handleTabChange = (index: number): void => {
    setActiveTab(index);
  };

  const handleTimeframeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeframe(e.target.value);
  };

  const handleRefresh = (): void => {
    loadAnalyticsData();
  };

  const handleExport = (): void => {
    toast({
      title: 'Export Started',
      description: 'Analytics data export has been initiated',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const createPerformanceChart = () => {
    if (!analytics) return null;

    const data = {
      labels: analytics.daily_returns.map(r => r.date),
      datasets: [
        {
          label: 'Daily Returns (%)',
          data: analytics.daily_returns.map(r => r.return_percentage),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.1
        },
        {
          label: 'Fees Earned ($)',
          data: analytics.daily_returns.map(r => r.fees_earned),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1'
        }
      ]
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Performance Over Time'
        }
      },
      scales: {
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false,
          },
        }
      }
    };

    return <Line data={data} options={options} />;
  };

  const createAttributionChart = () => {
    if (!performanceAttribution) return null;

    const data = {
      labels: ['Fees', 'IL Impact', 'Price Appreciation', 'Rebalancing'],
      datasets: [
        {
          data: [
            performanceAttribution.fees_contribution,
            Math.abs(performanceAttribution.il_impact),
            performanceAttribution.price_appreciation,
            performanceAttribution.rebalancing_impact
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)'
          ],
          borderWidth: 1
        }
      ]
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom' as const,
        },
        title: {
          display: true,
          text: 'Performance Attribution'
        }
      }
    };

    return <Pie data={data} options={options} />;
  };

  if (!selectedPosition) {
    return (
      <Card bg={bgColor} borderColor={borderColor}>
        <CardBody>
          <VStack spacing={4} py={8}>
            <FiBarChart size={48} color={mutedColor} />
            <Text color={mutedColor} textAlign="center">
              Select a position to view advanced analytics
            </Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Box>
      <Card bg={bgColor} borderColor={borderColor} mb={6}>
        <CardHeader>
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Heading size="lg" color={textColor}>Advanced Analytics</Heading>
              <Text color={mutedColor}>
                {selectedPosition.token0_symbol}/{selectedPosition.token1_symbol} - {selectedPosition.fee_tier / 10000}%
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Select
                value={selectedTimeframe}
                onChange={handleTimeframeChange}
                size="sm"
                w="120px"
              >
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
                <option value="90d">90 Days</option>
                <option value="1y">1 Year</option>
              </Select>
              <IconButton
                aria-label="Refresh data"
                icon={<FiRefreshCw />}
                size="sm"
                onClick={handleRefresh}
                isLoading={isLoading}
              />
              <IconButton
                aria-label="Export data"
                icon={<FiDownload />}
                size="sm"
                onClick={handleExport}
              />
            </HStack>
          </HStack>
        </CardHeader>
      </Card>

      {error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card bg={bgColor} borderColor={borderColor}>
          <CardBody>
            <VStack spacing={4} py={8}>
              <Spinner size="xl" />
              <Text color={mutedColor}>Loading analytics data...</Text>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Tabs index={activeTab} onChange={handleTabChange} variant="enclosed">
          <TabList>
            <Tab>Performance Metrics</Tab>
            <Tab>Backtesting</Tab>
            <Tab>Attribution Analysis</Tab>
            <Tab>Market Regime</Tab>
            <Tab>Predictive Models</Tab>
          </TabList>

          <TabPanels>
            {/* Performance Metrics Tab */}
            <TabPanel px={0}>
              <VStack spacing={6}>
                {analytics && (
                  <>
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
                      <Stat>
                        <StatLabel>Total Return</StatLabel>
                        <StatNumber>{analytics.performance_metrics.total_return.toFixed(2)}%</StatNumber>
                        <StatHelpText>
                          <StatArrow type={analytics.performance_metrics.total_return >= 0 ? 'increase' : 'decrease'} />
                          Annualized: {analytics.performance_metrics.annualized_return.toFixed(2)}%
                        </StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Sharpe Ratio</StatLabel>
                        <StatNumber>{analytics.performance_metrics.sharpe_ratio.toFixed(2)}</StatNumber>
                        <StatHelpText>Risk-adjusted return</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Max Drawdown</StatLabel>
                        <StatNumber color="red.500">{analytics.performance_metrics.max_drawdown.toFixed(2)}%</StatNumber>
                        <StatHelpText>Worst decline</StatHelpText>
                      </Stat>
                      <Stat>
                        <StatLabel>Fees APY</StatLabel>
                        <StatNumber color="green.500">{analytics.performance_metrics.fees_apy.toFixed(2)}%</StatNumber>
                        <StatHelpText>Fee earnings rate</StatHelpText>
                      </Stat>
                    </SimpleGrid>

                    <Card bg={bgColor} borderColor={borderColor} w="full">
                      <CardHeader>
                        <Heading size="md">Performance Chart</Heading>
                      </CardHeader>
                      <CardBody>
                        <Box h="400px">
                          {createPerformanceChart()}
                        </Box>
                      </CardBody>
                    </Card>

                    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6} w="full">
                      <Card bg={bgColor} borderColor={borderColor}>
                        <CardHeader>
                          <Heading size="md">Range Efficiency</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack spacing={4}>
                            <Box w="full">
                              <HStack justify="space-between" mb={2}>
                                <Text>Time in Range</Text>
                                <Text fontWeight="bold">{analytics.range_efficiency.time_in_range.toFixed(1)}%</Text>
                              </HStack>
                              <Progress value={analytics.range_efficiency.time_in_range} colorScheme="green" />
                            </Box>
                            <Box w="full">
                              <HStack justify="space-between" mb={2}>
                                <Text>Range Utilization</Text>
                                <Text fontWeight="bold">{analytics.range_efficiency.range_utilization.toFixed(1)}%</Text>
                              </HStack>
                              <Progress value={analytics.range_efficiency.range_utilization} colorScheme="blue" />
                            </Box>
                          </VStack>
                        </CardBody>
                      </Card>

                      <Card bg={bgColor} borderColor={borderColor}>
                        <CardHeader>
                          <Heading size="md">Risk Metrics</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack spacing={3} align="stretch">
                            <HStack justify="space-between">
                              <Text>Volatility</Text>
                              <Badge colorScheme="orange">{analytics.performance_metrics.volatility.toFixed(2)}%</Badge>
                            </HStack>
                            <HStack justify="space-between">
                              <Text>IL Impact</Text>
                              <Badge colorScheme="red">{analytics.performance_metrics.il_impact.toFixed(2)}%</Badge>
                            </HStack>
                            <Divider />
                            <HStack justify="space-between">
                              <Text fontWeight="bold">Risk Score</Text>
                              <Badge colorScheme="yellow">Medium</Badge>
                            </HStack>
                          </VStack>
                        </CardBody>
                      </Card>
                    </Grid>
                  </>
                )}
              </VStack>
            </TabPanel>

            {/* Backtesting Tab */}
            <TabPanel px={0}>
              <VStack spacing={6}>
                <Card bg={bgColor} borderColor={borderColor} w="full">
                  <CardHeader>
                    <Heading size="md">Strategy Comparison</Heading>
                  </CardHeader>
                  <CardBody>
                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                      {backtestResults.map((result, index) => (
                        <Card key={index} variant="outline">
                          <CardHeader>
                            <Heading size="sm">{result.strategy_name}</Heading>
                          </CardHeader>
                          <CardBody>
                            <VStack spacing={3} align="stretch">
                              <HStack justify="space-between">
                                <Text>Total Return</Text>
                                <Text fontWeight="bold" color={result.total_return >= 0 ? 'green.500' : 'red.500'}>
                                  {result.total_return.toFixed(2)}%
                                </Text>
                              </HStack>
                              <HStack justify="space-between">
                                <Text>Sharpe Ratio</Text>
                                <Text fontWeight="bold">{result.sharpe_ratio.toFixed(2)}</Text>
                              </HStack>
                              <HStack justify="space-between">
                                <Text>Max Drawdown</Text>
                                <Text fontWeight="bold" color="red.500">{result.max_drawdown.toFixed(2)}%</Text>
                              </HStack>
                              <HStack justify="space-between">
                                <Text>Win Rate</Text>
                                <Text fontWeight="bold">{result.win_rate.toFixed(1)}%</Text>
                              </HStack>
                            </VStack>
                          </CardBody>
                        </Card>
                      ))}
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Attribution Analysis Tab */}
            <TabPanel px={0}>
              <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
                <Card bg={bgColor} borderColor={borderColor}>
                  <CardHeader>
                    <Heading size="md">Performance Attribution</Heading>
                  </CardHeader>
                  <CardBody>
                    <Box h="300px">
                      {createAttributionChart()}
                    </Box>
                  </CardBody>
                </Card>

                {performanceAttribution && (
                  <Card bg={bgColor} borderColor={borderColor}>
                    <CardHeader>
                      <Heading size="md">Contribution Breakdown</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4} align="stretch">
                        <HStack justify="space-between">
                          <HStack>
                            <Box w={3} h={3} bg="teal.500" borderRadius="full" />
                            <Text>Fee Earnings</Text>
                          </HStack>
                          <Text fontWeight="bold" color="green.500">
                            +{performanceAttribution.fees_contribution.toFixed(2)}%
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <HStack>
                            <Box w={3} h={3} bg="blue.500" borderRadius="full" />
                            <Text>Price Appreciation</Text>
                          </HStack>
                          <Text fontWeight="bold" color="green.500">
                            +{performanceAttribution.price_appreciation.toFixed(2)}%
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <HStack>
                            <Box w={3} h={3} bg="yellow.500" borderRadius="full" />
                            <Text>Rebalancing</Text>
                          </HStack>
                          <Text fontWeight="bold" color="green.500">
                            +{performanceAttribution.rebalancing_impact.toFixed(2)}%
                          </Text>
                        </HStack>
                        <HStack justify="space-between">
                          <HStack>
                            <Box w={3} h={3} bg="red.500" borderRadius="full" />
                            <Text>Impermanent Loss</Text>
                          </HStack>
                          <Text fontWeight="bold" color="red.500">
                            {performanceAttribution.il_impact.toFixed(2)}%
                          </Text>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>
                )}
              </Grid>
            </TabPanel>

            {/* Market Regime Tab */}
            <TabPanel px={0}>
              {marketRegime && (
                <Card bg={bgColor} borderColor={borderColor}>
                  <CardHeader>
                    <Heading size="md">Current Market Regime</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={6} align="stretch">
                      <HStack spacing={4}>
                        <Badge 
                          colorScheme={
                            marketRegime.regime === 'bull' ? 'green' :
                            marketRegime.regime === 'bear' ? 'red' :
                            marketRegime.regime === 'volatile' ? 'orange' : 'blue'
                          }
                          fontSize="lg"
                          px={3}
                          py={1}
                        >
                          {marketRegime.regime.toUpperCase()} MARKET
                        </Badge>
                        <Text color={mutedColor}>
                          Confidence: {(marketRegime.confidence * 100).toFixed(1)}%
                        </Text>
                      </HStack>

                      <Box>
                        <Text fontWeight="bold" mb={2}>Market Characteristics:</Text>
                        <VStack align="start" spacing={1}>
                          {marketRegime.characteristics.map((char, index) => (
                            <HStack key={index}>
                              <Box w={2} h={2} bg="blue.500" borderRadius="full" />
                              <Text>{char}</Text>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>

                      <Alert status="info">
                        <AlertIcon />
                        <Box>
                          <Text fontWeight="bold">Regime Analysis</Text>
                          <Text fontSize="sm">
                            Current market conditions suggest {marketRegime.regime} behavior since {marketRegime.start_date}.
                            Consider adjusting position ranges accordingly.
                          </Text>
                        </Box>
                      </Alert>
                    </VStack>
                  </CardBody>
                </Card>
              )}
            </TabPanel>

            {/* Predictive Models Tab */}
            <TabPanel px={0}>
              <VStack spacing={6}>
                <Alert status="warning">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">Predictive Models</Text>
                    <Text fontSize="sm">
                      Advanced predictive analytics are currently in development. 
                      This feature will provide ML-based forecasts for IL, fees, and optimal rebalancing timing.
                    </Text>
                  </Box>
                </Alert>

                <Card bg={bgColor} borderColor={borderColor} w="full">
                  <CardHeader>
                    <Heading size="md">Coming Soon</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="stretch">
                      <HStack>
                        <FiTrendingUp />
                        <Text>Price Movement Predictions</Text>
                      </HStack>
                      <HStack>
                        <FiPieChart />
                        <Text>Impermanent Loss Forecasting</Text>
                      </HStack>
                      <HStack>
                        <FiBarChart />
                        <Text>Fee Earning Projections</Text>
                      </HStack>
                      <HStack>
                        <FiRefreshCw />
                        <Text>Optimal Rebalancing Timing</Text>
                      </HStack>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </Box>
  );
};

export default AdvancedAnalytics;