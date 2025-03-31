import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  SimpleGrid,
  useColorMode,
  Button,
  Flex
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { getEarningsHistory } from '../services/optionsService';

interface EarningsHistoryChartProps {
  ticker: string;
  years?: number;
}

interface PerformanceData {
  earnings_date: string;
  next_trading_day: string;
  percent_change: number;
  is_inferred: boolean;
}

interface PerformanceStats {
  count: number;
  avg_percent_change: number;
  median_percent_change: number;
  min_percent_change: number;
  max_percent_change: number;
  positive_count: number;
  negative_count: number;
  positive_percentage: number;
}

/**
 * EarningsHistoryChart Component
 * 
 * This component displays a chart showing how a stock has performed the day after
 * earnings announcements for the past several years.
 */
const EarningsHistoryChart: React.FC<EarningsHistoryChartProps> = ({ ticker, years = 7 }) => {
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isEstimatedData, setIsEstimatedData] = useState<boolean>(false);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format percentage for display
  const formatPercent = (value: number): string => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Load earnings history data
  useEffect(() => {
    const fetchEarningsHistory = async () => {
      setIsLoading(true);
      setError(null);
      setIsEstimatedData(false);
      
      try {
        const data = await getEarningsHistory(ticker, years);
        
        if (data && data.performance_data) {
          setPerformanceData(data.performance_data);
          setStats(data.stats);
          
          // Check if we're using inferred data
          if (data.note && data.note.includes('inferred')) {
            setIsEstimatedData(true);
          }
          
          // Prepare data for chart
          const chartData = data.performance_data.map((item: PerformanceData) => ({
            date: formatDate(item.earnings_date),
            change: item.percent_change,
            tooltipDate: item.earnings_date,
            nextDay: item.next_trading_day,
            isInferred: item.is_inferred
          }));
          
          setChartData(chartData);
        } else {
          setError('No earnings history data available');
        }
      } catch (err) {
        setError(`Failed to load earnings history: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (ticker) {
      fetchEarningsHistory();
    }
  }, [ticker, years]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box 
          bg={colorMode === 'dark' ? 'gray.700' : 'white'} 
          p={3} 
          borderRadius="md" 
          borderWidth="1px"
          boxShadow="md"
        >
          <Text fontWeight="bold">Earnings Date: {data.tooltipDate}</Text>
          <Text>Next Trading Day: {data.nextDay}</Text>
          <Text color={data.change >= 0 ? 'green.500' : 'red.500'} fontWeight="bold">
            Change: {formatPercent(data.change)}
          </Text>
          <Text fontSize="sm" color={data.isInferred ? 'orange.500' : 'blue.500'} fontStyle="italic">
            {data.isInferred ? 'Inferred from price data' : 'Confirmed earnings date'}
          </Text>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box>
      <Box mb={4}>
        <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
          Shows how {ticker} has performed the day after earnings announcements for the past {years} years
        </Text>
      </Box>
      
      {isLoading && (
        <Center height="400px">
          <Spinner size="xl" color="brand.500" />
        </Center>
      )}
      
      {error && (
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          <Box>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {!isLoading && !error && stats && (
        <>
          {isEstimatedData && (
            <Alert status="warning" borderRadius="md" mb={4}>
              <AlertIcon />
              <Box>
                <AlertTitle>Using Inferred Data</AlertTitle>
                <AlertDescription>
                  Some earnings dates for {ticker} were inferred from historical price and volume data.
                  These dates represent periods of high volatility that likely correspond to earnings announcements.
                </AlertDescription>
              </Box>
            </Alert>
          )}
          
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
            <Stat>
              <StatLabel>Average Change</StatLabel>
              <StatNumber color={stats.avg_percent_change >= 0 ? 'green.500' : 'red.500'}>
                <StatArrow type={stats.avg_percent_change >= 0 ? 'increase' : 'decrease'} />
                {formatPercent(stats.avg_percent_change)}
              </StatNumber>
              <StatHelpText>After {stats.count} earnings reports</StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Max Gain</StatLabel>
              <StatNumber color="green.500">
                <StatArrow type="increase" />
                {formatPercent(stats.max_percent_change)}
              </StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel>Max Loss</StatLabel>
              <StatNumber color="red.500">
                <StatArrow type="decrease" />
                {formatPercent(stats.min_percent_change)}
              </StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel>Positive Reactions</StatLabel>
              <StatNumber>{stats.positive_percentage}%</StatNumber>
              <StatHelpText>{stats.positive_count} of {stats.count} reports</StatHelpText>
            </Stat>
          </SimpleGrid>
          
          <Box height="400px" mb={4}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: colorMode === 'dark' ? '#CBD5E0' : '#4A5568' }}
                />
                <YAxis 
                  tickFormatter={(value) => `${value}%`}
                  domain={['auto', 'auto']}
                  tick={{ fill: colorMode === 'dark' ? '#CBD5E0' : '#4A5568' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#718096" />
                <Line
                  type="monotone"
                  dataKey="change"
                  name="Price Change %"
                  stroke="#3182CE"
                  activeDot={{ r: 8 }}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={payload.isInferred ? "#F6AD55" : "#3182CE"}
                        stroke={colorMode === 'dark' ? '#1A202C' : 'white'}
                        strokeWidth={1}
                      />
                    );
                  }}
                  strokeWidth={2}
                />
                <Legend
                  content={() => (
                    <Box
                      textAlign="center"
                      mt={2}
                      p={2}
                      borderWidth="1px"
                      borderRadius="md"
                      bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                    >
                      <Flex justify="center" align="center" gap={4}>
                        <Flex align="center">
                          <Box w="10px" h="10px" borderRadius="full" bg="#3182CE" mr={2} />
                          <Text fontSize="sm">Confirmed Earnings Date</Text>
                        </Flex>
                        <Flex align="center">
                          <Box w="10px" h="10px" borderRadius="full" bg="#F6AD55" mr={2} />
                          <Text fontSize="sm">Inferred Earnings Date</Text>
                        </Flex>
                      </Flex>
                    </Box>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} mb={4}>
            This chart shows the percentage change in {ticker}'s stock price on the trading day following each earnings announcement.
            Positive values indicate the stock went up after earnings, while negative values indicate it went down.
          </Text>
        </>
      )}
    </Box>
  );
};

export default EarningsHistoryChart;