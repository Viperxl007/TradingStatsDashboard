import React, { useMemo } from 'react';
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
  useColorModeValue,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react';
import {
  FiDollarSign,
  FiTrendingUp,
  FiBarChart2,
  FiPieChart,
  FiActivity
} from 'react-icons/fi';
import { useHyperliquid } from '../context/HyperliquidContext';
import { format, subMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
  ComposedChart
} from 'recharts';

const Summary: React.FC = () => {
  const { state } = useHyperliquid();
  
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Calculate summary metrics from real Hyperliquid data
  const summaryMetrics = useMemo(() => {
    if (!state.trades || state.trades.length === 0) {
      return {
        totalTrades: 0,
        totalProfitLoss: 0,
        winRate: 0,
        uniqueCoins: 0,
        mostTradedCoin: 'N/A',
        bestPerformingCoin: 'N/A',
        worstPerformingCoin: 'N/A',
        averageProfitLoss: 0,
        totalFees: 0,
        netProfitLoss: 0,
        averageTradesPerDay: 0,
        monthlyPerformance: [],
        coinPerformance: []
      };
    }

    const trades = state.trades;
    const totalTrades = trades.length;
    
    // Calculate total P&L and fees
    const totalProfitLoss = trades.reduce((sum, trade) => sum + (trade.closed_pnl || 0), 0);
    const totalFees = trades.reduce((sum, trade) => sum + (trade.fee || 0), 0);
    const netProfitLoss = totalProfitLoss - totalFees;
    
    // Calculate win rate
    const winningTrades = trades.filter(trade => (trade.closed_pnl || 0) > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    // Calculate average P&L
    const averageProfitLoss = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;
    
    // Get unique coins
    const uniqueCoins = new Set(trades.map(trade => trade.coin)).size;
    
    // Calculate coin performance
    const coinStats = trades.reduce((acc, trade) => {
      const coin = trade.coin;
      if (!acc[coin]) {
        acc[coin] = {
          coin,
          totalTrades: 0,
          totalProfitLoss: 0,
          totalFees: 0,
          winningTrades: 0
        };
      }
      
      acc[coin].totalTrades += 1;
      acc[coin].totalProfitLoss += trade.closed_pnl || 0;
      acc[coin].totalFees += trade.fee || 0;
      if ((trade.closed_pnl || 0) > 0) {
        acc[coin].winningTrades += 1;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    const coinPerformance = Object.values(coinStats).map((coin: any) => ({
      ...coin,
      winRate: coin.totalTrades > 0 ? (coin.winningTrades / coin.totalTrades) * 100 : 0,
      netProfitLoss: coin.totalProfitLoss - coin.totalFees
    }));
    
    // Find most traded, best and worst performing coins
    const mostTradedCoin = coinPerformance.length > 0 
      ? coinPerformance.reduce((max, coin) => coin.totalTrades > max.totalTrades ? coin : max).coin
      : 'N/A';
      
    const bestPerformingCoin = coinPerformance.length > 0
      ? coinPerformance.reduce((max, coin) => coin.totalProfitLoss > max.totalProfitLoss ? coin : max).coin
      : 'N/A';
      
    const worstPerformingCoin = coinPerformance.length > 0
      ? coinPerformance.reduce((min, coin) => coin.totalProfitLoss < min.totalProfitLoss ? coin : min).coin
      : 'N/A';
    
    // Calculate monthly performance
    const monthlyStats = trades.reduce((acc, trade) => {
      const tradeDate = new Date(trade.time);
      const monthKey = format(tradeDate, 'yyyy-MM');
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          trades: 0,
          profitLoss: 0,
          fees: 0,
          winningTrades: 0
        };
      }
      
      acc[monthKey].trades += 1;
      acc[monthKey].profitLoss += trade.closed_pnl || 0;
      acc[monthKey].fees += trade.fee || 0;
      if ((trade.closed_pnl || 0) > 0) {
        acc[monthKey].winningTrades += 1;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    const monthlyPerformance = Object.values(monthlyStats).map((month: any) => ({
      ...month,
      winRate: month.trades > 0 ? (month.winningTrades / month.trades) * 100 : 0,
      netProfitLoss: month.profitLoss - month.fees
    }));
    
    // Calculate average trades per day
    const firstTradeDate = trades.length > 0 ? new Date(Math.min(...trades.map(t => new Date(t.time).getTime()))) : new Date();
    const lastTradeDate = trades.length > 0 ? new Date(Math.max(...trades.map(t => new Date(t.time).getTime()))) : new Date();
    const daysDiff = Math.max(1, Math.ceil((lastTradeDate.getTime() - firstTradeDate.getTime()) / (1000 * 60 * 60 * 24)));
    const averageTradesPerDay = totalTrades / daysDiff;
    
    return {
      totalTrades,
      totalProfitLoss,
      winRate,
      uniqueCoins,
      mostTradedCoin,
      bestPerformingCoin,
      worstPerformingCoin,
      averageProfitLoss,
      totalFees,
      netProfitLoss,
      averageTradesPerDay,
      monthlyPerformance: monthlyPerformance.sort((a, b) => a.month.localeCompare(b.month)),
      coinPerformance: coinPerformance.sort((a, b) => Math.abs(b.totalProfitLoss) - Math.abs(a.totalProfitLoss))
    };
  }, [state.trades]);

  // Calculate month-over-month changes
  const currentMonth = new Date();
  const previousMonth = subMonths(currentMonth, 1);
  const currentMonthStr = format(currentMonth, 'yyyy-MM');
  const previousMonthStr = format(previousMonth, 'yyyy-MM');
  
  const currentMonthPerf = summaryMetrics.monthlyPerformance.find(
    month => month.month === currentMonthStr
  );
  
  const previousMonthPerf = summaryMetrics.monthlyPerformance.find(
    month => month.month === previousMonthStr
  );
  
  const tradesMoM = currentMonthPerf && previousMonthPerf
    ? ((currentMonthPerf.trades - previousMonthPerf.trades) / previousMonthPerf.trades) * 100
    : 0;
    
  const profitMoM = currentMonthPerf && previousMonthPerf && previousMonthPerf.profitLoss !== 0
    ? ((currentMonthPerf.profitLoss - previousMonthPerf.profitLoss) / Math.abs(previousMonthPerf.profitLoss)) * 100
    : 0;
  
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
        <AlertDescription>Please select a Hyperliquid account to view trading summary.</AlertDescription>
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
          No trades found for {state.selectedAccount.display_name}. 
          {state.lastSyncTime && ` Last sync: ${format(new Date(state.lastSyncTime), 'PPpp')}`}
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Trading Summary - {state.selectedAccount.display_name}</Heading>
        {state.lastSyncTime && (
          <Text fontSize="sm" color="gray.500">
            Last updated: {format(new Date(state.lastSyncTime), 'PPpp')}
          </Text>
        )}
      </Flex>
      
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
              <StatNumber fontSize="3xl">{summaryMetrics.totalTrades.toLocaleString()}</StatNumber>
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
                bg={summaryMetrics.totalProfitLoss >= 0 ? "green.50" : "red.50"}
                color={summaryMetrics.totalProfitLoss >= 0 ? "green.500" : "red.500"}
                mr={4}
              >
                <Icon as={FiDollarSign} boxSize={5} />
              </Flex>
              <Text fontWeight="medium" fontSize="lg">Total Profit/Loss</Text>
            </Flex>
            
            <Stat>
              <StatNumber 
                fontSize="3xl" 
                color={summaryMetrics.totalProfitLoss >= 0 ? "green.500" : "red.500"}
              >
                ${summaryMetrics.totalProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <StatNumber fontSize="3xl">{summaryMetrics.winRate.toFixed(1)}%</StatNumber>
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
        {/* Coin metrics */}
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
              <Text fontWeight="medium" fontSize="lg">Coin Metrics</Text>
            </Flex>
            
            <SimpleGrid columns={2} spacing={4}>
              <Stat>
                <StatLabel>Unique Coins</StatLabel>
                <StatNumber>{summaryMetrics.uniqueCoins}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Most Traded</StatLabel>
                <StatNumber>{summaryMetrics.mostTradedCoin}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Best Performing</StatLabel>
                <StatNumber>{summaryMetrics.bestPerformingCoin}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Worst Performing</StatLabel>
                <StatNumber>{summaryMetrics.worstPerformingCoin}</StatNumber>
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
                  color={summaryMetrics.averageProfitLoss >= 0 ? "green.500" : "red.500"}
                >
                  ${summaryMetrics.averageProfitLoss.toFixed(2)}
                </StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Total Fees</StatLabel>
                <StatNumber>${summaryMetrics.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Net Profit/Loss</StatLabel>
                <StatNumber 
                  color={summaryMetrics.netProfitLoss >= 0 ? "green.500" : "red.500"}
                >
                  ${summaryMetrics.netProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Avg. Trades/Day</StatLabel>
                <StatNumber>{summaryMetrics.averageTradesPerDay.toFixed(1)}</StatNumber>
              </Stat>
            </SimpleGrid>
          </CardBody>
        </Card>
      </SimpleGrid>
      
      {/* Monthly performance chart */}
      {summaryMetrics.monthlyPerformance.length > 0 && (
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden" mb={8}>
          <CardBody>
            <Heading size="md" mb={4}>Monthly Performance</Heading>
            
            <Box h="300px">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={summaryMetrics.monthlyPerformance}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorTrades" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={useColorModeValue('#3182CE', '#63B3ED')} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={useColorModeValue('#3182CE', '#63B3ED')} stopOpacity={0.2}/>
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
                      style: { fontSize: 12, fontWeight: 'bold' }
                    }}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                      style: { fontSize: 12, fontWeight: 'bold' }
                    }}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                        return [`${value.toFixed(1)}%`, 'Win Rate'];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label) => {
                      const date = parseISO(`${label}-01`);
                      return format(date, 'MMMM yyyy');
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="right"
                    dataKey="trades"
                    name="Trades"
                    barSize={30}
                    fill="url(#colorTrades)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="profitLoss"
                    stroke={useColorModeValue('#38A169', '#68D391')}
                    strokeWidth={3}
                    name="Profit/Loss"
                    dot={{ r: 4, fill: useColorModeValue('white', '#1A202C') }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="winRate"
                    stroke={useColorModeValue('#805AD5', '#B794F4')}
                    strokeWidth={3}
                    name="Win Rate (%)"
                    dot={{ r: 4, fill: useColorModeValue('white', '#1A202C') }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </CardBody>
        </Card>
      )}
      
      {/* Top coins by P/L */}
      {summaryMetrics.coinPerformance.length > 0 && (
        <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
          <CardBody>
            <Heading size="md" mb={4}>Top Coins by Profit/Loss</Heading>
            
            <Box h="300px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summaryMetrics.coinPerformance.slice(0, 5).map(coin => ({
                    coin: coin.coin,
                    profitLoss: coin.totalProfitLoss,
                    trades: coin.totalTrades,
                    winRate: coin.winRate
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
                  />
                  <YAxis
                    type="category"
                    dataKey="coin"
                    tick={{
                      fill: useColorModeValue('gray.700', 'white'),
                      fontSize: 14,
                      fontWeight: 'bold'
                    }}
                    width={70}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: useColorModeValue('white', '#1A202C'),
                      borderColor: useColorModeValue('gray.200', 'gray.600'),
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Profit' || name === 'Loss') {
                        return [`$${Math.abs(Number(value)).toLocaleString()}`, name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey={(data) => data.profitLoss >= 0 ? data.profitLoss : 0}
                    name="Profit"
                    fill="url(#colorProfit)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={30}
                  />
                  <Bar
                    dataKey={(data) => data.profitLoss < 0 ? data.profitLoss : 0}
                    name="Loss"
                    fill="url(#colorLoss)"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardBody>
        </Card>
      )}
    </Box>
  );
};

export default Summary;