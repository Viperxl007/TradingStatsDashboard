import React from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Flex,
  Text,
  Icon,
  Card,
  CardBody,
  Divider,
  useColorModeValue,
  Skeleton
} from '@chakra-ui/react';
import {
  FiDollarSign,
  FiTrendingUp,
  FiBarChart2,
  FiPieChart,
  FiActivity
} from 'react-icons/fi';
import { useData } from '../context/DataContext';
import { format, subMonths, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

const Summary: React.FC = () => {
  const { state } = useData();
  const { accountSummary, tokenPerformance } = state;
  
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Loading state
  if (state.isLoading) {
    return (
      <Box>
        <Skeleton height="40px" mb={4} />
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Skeleton height="150px" />
          <Skeleton height="150px" />
          <Skeleton height="150px" />
        </SimpleGrid>
        <Skeleton height="300px" mt={6} />
      </Box>
    );
  }
  
  // Get current month and previous month for comparison
  const currentMonth = new Date();
  const previousMonth = subMonths(currentMonth, 1);
  const currentMonthStr = format(currentMonth, 'yyyy-MM');
  const previousMonthStr = format(previousMonth, 'yyyy-MM');
  
  // Get monthly performance data
  const currentMonthPerf = accountSummary.monthlyPerformance.find(
    month => month.month === currentMonthStr
  );
  
  const previousMonthPerf = accountSummary.monthlyPerformance.find(
    month => month.month === previousMonthStr
  );
  
  // Calculate month-over-month changes
  const tradesMoM = currentMonthPerf && previousMonthPerf
    ? ((currentMonthPerf.trades - previousMonthPerf.trades) / previousMonthPerf.trades) * 100
    : 0;
    
  const profitMoM = currentMonthPerf && previousMonthPerf && previousMonthPerf.profitLoss !== 0
    ? ((currentMonthPerf.profitLoss - previousMonthPerf.profitLoss) / Math.abs(previousMonthPerf.profitLoss)) * 100
    : 0;
  
  return (
    <Box>
      <Heading size="lg" mb={6}>Trading Account Summary</Heading>
      
      {/* Key metrics */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        {/* Total Trades */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
          <CardBody>
            <Flex align="center" mb={4}>
              <Flex
                w="40px"
                h="40px"
                align="center"
                justify="center"
                borderRadius="lg"
                bg="blue.50"
                color="blue.500"
                mr={4}
              >
                <Icon as={FiBarChart2} boxSize={5} />
              </Flex>
              <Text fontWeight="medium" fontSize="lg">Total Trades</Text>
            </Flex>
            
            <Stat>
              <StatNumber fontSize="3xl">{accountSummary.totalTrades}</StatNumber>
              {tradesMoM !== 0 && (
                <StatHelpText>
                  <StatArrow type={tradesMoM > 0 ? 'increase' : 'decrease'} />
                  {Math.abs(tradesMoM).toFixed(1)}% from last month
                </StatHelpText>
              )}
            </Stat>
          </CardBody>
        </Card>
        
        {/* Total Profit/Loss */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
          <CardBody>
            <Flex align="center" mb={4}>
              <Flex
                w="40px"
                h="40px"
                align="center"
                justify="center"
                borderRadius="lg"
                bg={accountSummary.totalProfitLoss >= 0 ? "green.50" : "red.50"}
                color={accountSummary.totalProfitLoss >= 0 ? "green.500" : "red.500"}
                mr={4}
              >
                <Icon as={FiDollarSign} boxSize={5} />
              </Flex>
              <Text fontWeight="medium" fontSize="lg">Total Profit/Loss</Text>
            </Flex>
            
            <Stat>
              <StatNumber 
                fontSize="3xl" 
                color={accountSummary.totalProfitLoss >= 0 ? "green.500" : "red.500"}
              >
                ${accountSummary.totalProfitLoss.toLocaleString()}
              </StatNumber>
              {profitMoM !== 0 && (
                <StatHelpText>
                  <StatArrow type={profitMoM > 0 ? 'increase' : 'decrease'} />
                  {Math.abs(profitMoM).toFixed(1)}% from last month
                </StatHelpText>
              )}
            </Stat>
          </CardBody>
        </Card>
        
        {/* Win Rate */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
          <CardBody>
            <Flex align="center" mb={4}>
              <Flex
                w="40px"
                h="40px"
                align="center"
                justify="center"
                borderRadius="lg"
                bg="purple.50"
                color="purple.500"
                mr={4}
              >
                <Icon as={FiActivity} boxSize={5} />
              </Flex>
              <Text fontWeight="medium" fontSize="lg">Win Rate</Text>
            </Flex>
            
            <Stat>
              <StatNumber fontSize="3xl">{accountSummary.winRate.toFixed(1)}%</StatNumber>
              {currentMonthPerf && previousMonthPerf && (
                <StatHelpText>
                  <StatArrow 
                    type={currentMonthPerf.winRate >= previousMonthPerf.winRate ? 'increase' : 'decrease'} 
                  />
                  {Math.abs(currentMonthPerf.winRate - previousMonthPerf.winRate).toFixed(1)}% from last month
                </StatHelpText>
              )}
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>
      
      {/* Additional metrics */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
        {/* Token metrics */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
          <CardBody>
            <Flex align="center" mb={4}>
              <Flex
                w="40px"
                h="40px"
                align="center"
                justify="center"
                borderRadius="lg"
                bg="teal.50"
                color="teal.500"
                mr={4}
              >
                <Icon as={FiPieChart} boxSize={5} />
              </Flex>
              <Text fontWeight="medium" fontSize="lg">Token Metrics</Text>
            </Flex>
            
            <SimpleGrid columns={2} spacing={4}>
              <Stat>
                <StatLabel>Unique Tokens</StatLabel>
                <StatNumber>{accountSummary.uniqueTokens}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Most Traded</StatLabel>
                <StatNumber>{accountSummary.mostTradedToken}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Best Performing</StatLabel>
                <StatNumber>{accountSummary.bestPerformingToken}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Worst Performing</StatLabel>
                <StatNumber>{accountSummary.worstPerformingToken}</StatNumber>
              </Stat>
            </SimpleGrid>
          </CardBody>
        </Card>
        
        {/* Financial metrics */}
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
          <CardBody>
            <Flex align="center" mb={4}>
              <Flex
                w="40px"
                h="40px"
                align="center"
                justify="center"
                borderRadius="lg"
                bg="orange.50"
                color="orange.500"
                mr={4}
              >
                <Icon as={FiTrendingUp} boxSize={5} />
              </Flex>
              <Text fontWeight="medium" fontSize="lg">Financial Metrics</Text>
            </Flex>
            
            <SimpleGrid columns={2} spacing={4}>
              <Stat>
                <StatLabel>Avg. Profit/Loss</StatLabel>
                <StatNumber 
                  color={accountSummary.averageProfitLoss >= 0 ? "green.500" : "red.500"}
                >
                  ${accountSummary.averageProfitLoss.toFixed(2)}
                </StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Total Fees</StatLabel>
                <StatNumber>${accountSummary.totalFees.toLocaleString()}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Net Profit/Loss</StatLabel>
                <StatNumber 
                  color={accountSummary.netProfitLoss >= 0 ? "green.500" : "red.500"}
                >
                  ${accountSummary.netProfitLoss.toLocaleString()}
                </StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Avg. Trades/Day</StatLabel>
                <StatNumber>{accountSummary.averageTradesPerDay.toFixed(1)}</StatNumber>
              </Stat>
            </SimpleGrid>
          </CardBody>
        </Card>
      </SimpleGrid>
      
      {/* Monthly performance */}
      <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden" mb={8}>
        <CardBody>
          <Heading size="md" mb={4}>Monthly Performance</Heading>
          
          <Box h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={accountSummary.monthlyPerformance.slice().sort((a, b) => a.month.localeCompare(b.month))}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="colorTrades" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={useColorModeValue('#3182CE', '#63B3ED')} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={useColorModeValue('#3182CE', '#63B3ED')} stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="colorProfitLoss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="colorWinRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={useColorModeValue('#805AD5', '#B794F4')} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={useColorModeValue('#805AD5', '#B794F4')} stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={useColorModeValue('gray.200', 'gray.700')}
                  opacity={0.5}
                />
                <XAxis
                  dataKey="month"
                  tick={{
                    fill: useColorModeValue('gray.700', 'white'),
                    fontSize: 12,
                    fontWeight: 'normal'
                  }}
                  tickFormatter={(value) => {
                    const date = parseISO(`${value}-01`);
                    return format(date, 'MMM yyyy');
                  }}
                  axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  dy={5}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{
                    fill: useColorModeValue('gray.700', 'white'),
                    fontSize: 12,
                    fontWeight: 'normal'
                  }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  label={{
                    value: 'Profit/Loss ($)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: useColorModeValue('gray.700', 'white'),
                    style: {
                      textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)'),
                      fontSize: 12,
                      fontWeight: 'bold'
                    }
                  }}
                  axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  dx={-5}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{
                    fill: useColorModeValue('gray.700', 'white'),
                    fontSize: 12,
                    fontWeight: 'normal'
                  }}
                  label={{
                    value: 'Trades',
                    angle: 90,
                    position: 'insideRight',
                    fill: useColorModeValue('gray.700', 'white'),
                    style: {
                      textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)'),
                      fontSize: 12,
                      fontWeight: 'bold'
                    }
                  }}
                  axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  dx={5}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: useColorModeValue('white', '#1A202C'),
                    borderColor: useColorModeValue('gray.200', 'gray.600'),
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    padding: '10px'
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'profitLoss') {
                      return [`$${Number(value).toLocaleString()}`, 'Profit/Loss'];
                    }
                    if (name === 'trades') {
                      return [value, 'Trades'];
                    }
                    if (name === 'winRate') {
                      return [`${value}%`, 'Win Rate'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => {
                    const date = parseISO(`${label}-01`);
                    return format(date, 'MMMM yyyy');
                  }}
                  cursor={{ stroke: useColorModeValue('gray.400', 'gray.500'), strokeWidth: 1, strokeDasharray: '5 5' }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: '10px',
                    color: useColorModeValue('#2D3748', 'white')
                  }}
                  iconType="circle"
                />
                <Bar
                  yAxisId="right"
                  dataKey="trades"
                  name="Trades"
                  barSize={30}
                  fill="url(#colorTrades)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="profitLoss"
                  stroke={useColorModeValue('#38A169', '#68D391')}
                  strokeWidth={3}
                  name="Profit/Loss"
                  dot={{
                    r: 4,
                    stroke: useColorModeValue('#38A169', '#68D391'),
                    fill: useColorModeValue('white', '#1A202C')
                  }}
                  activeDot={{
                    r: 8,
                    stroke: useColorModeValue('#38A169', '#68D391'),
                    strokeWidth: 2,
                    fill: useColorModeValue('white', '#1A202C')
                  }}
                  animationDuration={1500}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="winRate"
                  stroke={useColorModeValue('#805AD5', '#B794F4')}
                  strokeWidth={3}
                  name="Win Rate (%)"
                  dot={{
                    r: 4,
                    stroke: useColorModeValue('#805AD5', '#B794F4'),
                    fill: useColorModeValue('white', '#1A202C')
                  }}
                  activeDot={{
                    r: 8,
                    stroke: useColorModeValue('#805AD5', '#B794F4'),
                    strokeWidth: 2,
                    fill: useColorModeValue('white', '#1A202C')
                  }}
                  animationDuration={1500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
      
      {/* Top tokens by P/L */}
      <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
        <CardBody>
          <Heading size="md" mb={4}>Top Tokens by Profit/Loss</Heading>
          
          <Box h="300px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tokenPerformance
                  .slice()
                  .sort((a, b) => Math.abs(b.totalProfitLoss) - Math.abs(a.totalProfitLoss))
                  .slice(0, 5)
                  .map(token => ({
                    token: token.token,
                    profitLoss: token.totalProfitLoss,
                    trades: token.totalTrades,
                    winRate: token.winRate
                  }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                layout="vertical"
              >
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={useColorModeValue('#48BB78', '#9AE6B4')} stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorLoss" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={useColorModeValue('#E53E3E', '#FC8181')} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={useColorModeValue('#F56565', '#FEB2B2')} stopOpacity={1}/>
                  </linearGradient>
                  <filter id="shadow" height="200%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)')}/>
                  </filter>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={useColorModeValue('gray.200', 'gray.700')}
                  opacity={0.5}
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  tick={{
                    fill: useColorModeValue('gray.700', 'white'),
                    fontSize: 12,
                    fontWeight: 'normal'
                  }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  domain={['dataMin', 'dataMax']}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis
                  type="category"
                  dataKey="token"
                  tick={{
                    fill: useColorModeValue('gray.700', 'white'),
                    fontSize: 14,
                    fontWeight: 'bold'
                  }}
                  width={70}
                  axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  tickMargin={10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: useColorModeValue('white', '#1A202C'),
                    borderColor: useColorModeValue('gray.200', 'gray.600'),
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 'normal',
                    color: useColorModeValue('gray.800', 'white')
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Profit') {
                      return [`$${Number(value).toLocaleString()}`, 'Profit'];
                    }
                    if (name === 'Loss') {
                      return [`$${Math.abs(Number(value)).toLocaleString()}`, 'Loss'];
                    }
                    if (name === 'trades') {
                      return [value, 'Trades'];
                    }
                    if (name === 'winRate') {
                      return [`${value.toFixed(1)}%`, 'Win Rate'];
                    }
                    return [value, name];
                  }}
                  cursor={{ fill: useColorModeValue('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)') }}
                  wrapperStyle={{ zIndex: 1000 }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: '10px',
                    color: useColorModeValue('#2D3748', 'white')
                  }}
                  iconType="circle"
                />
                {/* Positive values bar */}
                <Bar
                  dataKey={(data) => data.profitLoss >= 0 ? data.profitLoss : 0}
                  name="Profit"
                  fill="url(#colorProfit)"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                  animationBegin={300}
                  filter="url(#shadow)"
                  maxBarSize={30}
                />
                
                {/* Negative values bar */}
                <Bar
                  dataKey={(data) => data.profitLoss < 0 ? data.profitLoss : 0}
                  name="Loss"
                  fill="url(#colorLoss)"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                  animationBegin={300}
                  filter="url(#shadow)"
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
    </Box>
  );
};

export default Summary;