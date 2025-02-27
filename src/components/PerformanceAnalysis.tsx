import * as React from 'react';
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
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuOptionGroup,
  MenuItemOption,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Stack,
  Input
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiCalendar,
  FiChevronDown,
  FiFilter
} from 'react-icons/fi';
import { useData, updateFilters, resetFilters } from '../context/DataContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Cell,
  PieChart,
  Pie,
  Scatter,
  ScatterChart
} from 'recharts';
import { format, parseISO, subMonths, subDays, isAfter } from 'date-fns';

/**
 * Helper function to filter data based on selected timeframe
 * @param data Array of trade data to filter
 * @param timeframe String representing the timeframe to filter by
 * @returns Filtered array of trade data
 */
const filterDataByTimeframe = (data: any[], timeframe: string) => {
  const now = new Date();
  
  switch (timeframe) {
    case 'week':
      return data.filter(item => isAfter(new Date(item.date), subDays(now, 7)));
    case 'month':
      return data.filter(item => isAfter(new Date(item.date), subMonths(now, 1)));
    case '3months':
      return data.filter(item => isAfter(new Date(item.date), subMonths(now, 3)));
    case '6months':
      return data.filter(item => isAfter(new Date(item.date), subMonths(now, 6)));
    case 'year':
      return data.filter(item => isAfter(new Date(item.date), subMonths(now, 12)));
    case 'all':
    default:
      return data;
  }
};

/**
 * Helper function to group trade data by date
 * @param data Array of trade data to group
 * @returns Array of grouped data with aggregated metrics per day
 */
const groupDataByDate = (data: any[]) => {
  const groupedData = data.reduce((acc, trade) => {
    const date = trade.date.split('T')[0]; // Extract YYYY-MM-DD
    
    if (!acc[date]) {
      acc[date] = {
        date,
        profitLoss: 0,
        trades: 0,
        volume: 0
      };
    }
    
    acc[date].profitLoss += trade.profitLoss || 0;
    acc[date].trades += 1;
    acc[date].volume += trade.totalValue || 0;
    
    return acc;
  }, {});
  
  // Sort by date ascending
  return Object.values(groupedData).sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

/**
 * Helper function to calculate cumulative profit/loss over time
 * @param data Array of grouped trade data
 * @returns Array with added cumulativePL property
 */
const calculateCumulativePL = (data: any[]) => {
  let cumulativePL = 0;
  
  return data.map(item => {
    cumulativePL += item.profitLoss;
    return {
      ...item,
      cumulativePL
    };
  });
};

const PerformanceAnalysis: React.FC = () => {
  const { state } = useData();
  const { filteredData, tokenPerformance: allTokenPerformance } = state;
  
  // Local state
  const [timeframe, setTimeframe] = React.useState('all');
  const [chartType, setChartType] = React.useState('line');
  const [dateRange, setDateRange] = React.useState<[Date | null, Date | null]>([null, null]);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Prepare chart data
  const filteredByTimeframe = React.useMemo(() =>
    filterDataByTimeframe(filteredData, timeframe),
    [filteredData, timeframe]
  );
  
  const groupedData = React.useMemo(() =>
    groupDataByDate(filteredByTimeframe),
    [filteredByTimeframe]
  );
  
  const chartData = React.useMemo(() =>
    calculateCumulativePL(groupedData),
    [groupedData]
  );
  
  // Filter token performance data by timeframe
  const tokenPerformance = React.useMemo(() => {
    // If we have timeframe filtering, we need to recalculate token performance
    if (timeframe !== 'all') {
      // Get the filtered trades
      const filteredTrades = filterDataByTimeframe(filteredData, timeframe);
      
      // Group by token
      const tokenGroups = filteredTrades.reduce((acc, trade) => {
        const token = trade.token;
        if (!acc[token]) {
          acc[token] = [];
        }
        acc[token].push(trade);
        return acc;
      }, {});
      
      // Calculate performance metrics for each token
      return Object.keys(tokenGroups).map(token => {
        const trades = tokenGroups[token];
        const totalTrades = trades.length;
        const winningTrades = trades.filter((t: any) => t.profitLoss > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const totalProfitLoss = trades.reduce((sum: number, t: any) => sum + t.profitLoss, 0);
        const averageProfitLoss = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;
        const totalVolume = trades.reduce((sum: number, t: any) => sum + (t.totalValue || 0), 0);
        
        return {
          token,
          totalTrades,
          winningTrades,
          winRate,
          totalProfitLoss,
          averageProfitLoss,
          totalVolume
        };
      });
    }
    
    // If no timeframe filtering, use the original token performance data
    return allTokenPerformance;
  }, [allTokenPerformance, filteredData, timeframe]);
  
  // Loading state
  if (state.isLoading) {
    return (
      <Box>
        <Skeleton height="40px" mb={4} />
        <Skeleton height="400px" mb={6} />
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Skeleton height="300px" />
          <Skeleton height="300px" />
        </SimpleGrid>
      </Box>
    );
  }
  
  return (
    <Box>
      <Heading size="lg" mb={6}>Performance Analysis</Heading>
      
      {/* Filters */}
      <HStack mb={6} spacing={4} wrap="wrap" justifyContent="flex-start">
        {/* Get context from DataContext */}
        {(() => {
          const { state, dispatch } = useData();
          const { selectedTokens, tradeType } = state;
          
          // Get unique tokens from raw data
          const uniqueTokens = [...new Set(state.rawData.map(trade => trade.token))].sort();
          
          // Handle token selection
          const handleTokenSelect = (token: string) => {
            const newSelectedTokens = selectedTokens.includes(token)
              ? selectedTokens.filter(t => t !== token)
              : [...selectedTokens, token];
            
            dispatch(updateFilters({ selectedTokens: newSelectedTokens }));
          };
          
          // Handle trade type selection
          const handleTradeTypeSelect = (type: 'all' | 'buy' | 'sell') => {
            dispatch(updateFilters({ tradeType: type }));
          };
          
          // Handle reset filters
          const handleResetFilters = () => {
            dispatch(resetFilters());
          };
          
          return (
            <>
              {/* Token filter */}
              <Box position="relative" width="200px">
                <Menu closeOnSelect={false}>
                  {/*
                    Token filter button - Using Button component with leftIcon/rightIcon props
                    for proper icon alignment in both light and dark modes
                  */}
                  <MenuButton
                    as={Button}
                    variant="outline"
                    height="40px"
                    width="100%"
                    px={4}
                    py={2}
                    leftIcon={<Icon as={FiFilter} boxSize="16px" />}
                    rightIcon={<Icon as={FiChevronDown} boxSize="16px" />}
                    iconSpacing={2}
                    bg={useColorModeValue('white', 'gray.700')}
                    borderColor={useColorModeValue('gray.200', 'gray.600')}
                    _hover={{ borderColor: useColorModeValue('gray.300', 'gray.500') }}
                  >
                    {selectedTokens.length > 0 ? `Tokens (${selectedTokens.length})` : 'All Tokens'}
                  </MenuButton>
                  <MenuList maxH="300px" overflowY="auto">
                    <MenuOptionGroup title="Select Tokens" type="checkbox">
                      {uniqueTokens.map(token => (
                        <MenuItemOption
                          key={token}
                          value={token}
                          isChecked={selectedTokens.includes(token)}
                          onClick={() => handleTokenSelect(token)}
                        >
                          {token}
                        </MenuItemOption>
                      ))}
                    </MenuOptionGroup>
                  </MenuList>
                </Menu>
              </Box>
              
              {/* Date Range Button */}
              <Box position="relative" width="200px">
                <Popover
                  isOpen={isDatePickerOpen}
                  onClose={() => setIsDatePickerOpen(false)}
                  placement="bottom-start"
                  closeOnBlur={true}
                >
                  <PopoverTrigger>
                    <Button
                      variant="outline"
                      height="40px"
                      width="100%"
                      px={4}
                      py={2}
                      leftIcon={<Icon as={FiCalendar} boxSize="16px" />}
                      rightIcon={<Icon as={FiChevronDown} boxSize="16px" />}
                      iconSpacing={2}
                      bg={useColorModeValue('white', 'gray.700')}
                      borderColor={useColorModeValue('gray.200', 'gray.600')}
                      _hover={{ borderColor: useColorModeValue('gray.300', 'gray.500') }}
                      onClick={() => setIsDatePickerOpen(true)}
                    >
                      {dateRange[0] && dateRange[1]
                        ? `${format(dateRange[0], 'MM/dd/yyyy')} - ${format(dateRange[1], 'MM/dd/yyyy')}`
                        : 'Date Range'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent width="300px" p={4}>
                    <PopoverArrow />
                    <PopoverCloseButton />
                    <PopoverHeader fontWeight="bold" border="0" pb={0}>Select Date Range</PopoverHeader>
                    <PopoverBody>
                      <Stack spacing={4}>
                        <Box>
                          <Text mb={1} fontSize="sm">Start Date</Text>
                          <Input
                            type="date"
                            value={dateRange[0] ? format(dateRange[0], 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : null;
                              setDateRange([date, dateRange[1]]);
                              
                              // Update filters in DataContext
                              if (date && dateRange[1]) {
                                dispatch(updateFilters({ dateRange: [date, dateRange[1]] }));
                              }
                            }}
                          />
                        </Box>
                        <Box>
                          <Text mb={1} fontSize="sm">End Date</Text>
                          <Input
                            type="date"
                            value={dateRange[1] ? format(dateRange[1], 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : null;
                              setDateRange([dateRange[0], date]);
                              
                              // Update filters in DataContext
                              if (dateRange[0] && date) {
                                dispatch(updateFilters({ dateRange: [dateRange[0], date] }));
                              }
                            }}
                          />
                        </Box>
                        <Button
                          colorScheme="blue"
                          size="sm"
                          onClick={() => {
                            if (dateRange[0] && dateRange[1]) {
                              dispatch(updateFilters({ dateRange }));
                              setIsDatePickerOpen(false);
                            }
                          }}
                          isDisabled={!dateRange[0] || !dateRange[1]}
                        >
                          Apply
                        </Button>
                      </Stack>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Box>
              
              {/* Trade Type Filter */}
              <Box position="relative" width="200px">
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="outline"
                    height="40px"
                    width="100%"
                    px={4}
                    py={2}
                    leftIcon={<Icon as={FiActivity} boxSize="16px" />}
                    rightIcon={<Icon as={FiChevronDown} boxSize="16px" />}
                    iconSpacing={2}
                    bg={useColorModeValue('white', 'gray.700')}
                    borderColor={useColorModeValue('gray.200', 'gray.600')}
                    _hover={{ borderColor: useColorModeValue('gray.300', 'gray.500') }}
                  >
                    {tradeType === 'all' ? 'All Types' : tradeType === 'buy' ? 'Buy Only' : 'Sell Only'}
                  </MenuButton>
                  <MenuList>
                    <MenuItem onClick={() => handleTradeTypeSelect('all')}>
                      All Types
                    </MenuItem>
                    <MenuItem onClick={() => handleTradeTypeSelect('buy')}>
                      Buy Only
                    </MenuItem>
                    <MenuItem onClick={() => handleTradeTypeSelect('sell')}>
                      Sell Only
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Box>
              
              {/* Timeframe Selector */}
              <Box position="relative" width="200px">
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="outline"
                    height="40px"
                    width="100%"
                    px={4}
                    py={2}
                    leftIcon={<Icon as={FiCalendar} boxSize="16px" />}
                    rightIcon={<Icon as={FiChevronDown} boxSize="16px" />}
                    iconSpacing={2}
                    bg={useColorModeValue('white', 'gray.700')}
                    borderColor={useColorModeValue('gray.200', 'gray.600')}
                    _hover={{ borderColor: useColorModeValue('gray.300', 'gray.500') }}
                  >
                    {timeframe === 'all' ? 'All Time' :
                     timeframe === 'year' ? 'Past Year' :
                     timeframe === '6months' ? 'Past 6 Months' :
                     timeframe === '3months' ? 'Past 3 Months' :
                     timeframe === 'month' ? 'Past Month' : 'Past Week'}
                  </MenuButton>
                  <MenuList>
                    <MenuItem onClick={() => setTimeframe('all')}>All Time</MenuItem>
                    <MenuItem onClick={() => setTimeframe('year')}>Past Year</MenuItem>
                    <MenuItem onClick={() => setTimeframe('6months')}>Past 6 Months</MenuItem>
                    <MenuItem onClick={() => setTimeframe('3months')}>Past 3 Months</MenuItem>
                    <MenuItem onClick={() => setTimeframe('month')}>Past Month</MenuItem>
                    <MenuItem onClick={() => setTimeframe('week')}>Past Week</MenuItem>
                  </MenuList>
                </Menu>
              </Box>
              
              {/* Reset filters */}
              {(selectedTokens.length > 0 || tradeType !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  height="40px"
                >
                  Reset Filters
                </Button>
              )}
            </>
          );
        })()}
      </HStack>
      
      {/* Chart Type Selector */}
      <Tabs variant="line" colorScheme="blue" mb={6} size="md">
        <TabList>
          <Tab
            onClick={() => setChartType('line')}
            fontWeight={chartType === 'line' ? 'medium' : 'normal'}
            px={4}
            py={2}
          >
            <Icon as={FiTrendingUp} mr={2} />
            <Text>Line</Text>
          </Tab>
          <Tab
            onClick={() => setChartType('bar')}
            fontWeight={chartType === 'bar' ? 'medium' : 'normal'}
            px={4}
            py={2}
          >
            <Icon as={FiBarChart2} mr={2} />
            <Text>Bar</Text>
          </Tab>
          <Tab
            onClick={() => setChartType('calendar')}
            fontWeight={chartType === 'calendar' ? 'medium' : 'normal'}
            px={4}
            py={2}
          >
            <Icon as={FiCalendar} mr={2} />
            <Text>Calendar</Text>
          </Tab>
        </TabList>
      </Tabs>
      
      {/* Main performance chart */}
      <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden" mb={6}>
        <CardBody>
          <Heading size="md" mb={4}>Performance Over Time</Heading>
          
          <Box h="400px">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="date"
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => {
                      if (Math.abs(value) >= 1000000) {
                        return `$${(value / 1000000).toFixed(1)}M`;
                      } else if (Math.abs(value) >= 1000) {
                        return `$${(value / 1000).toFixed(0)}K`;
                      }
                      return `$${value}`;
                    }}
                    width={80}
                    label={{
                      value: 'Profit/Loss ($)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: useColorModeValue('gray.700', 'white'),
                      style: { textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)') }
                    }}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => {
                      if (Math.abs(value) >= 1000000) {
                        return `$${(value / 1000000).toFixed(1)}M`;
                      } else if (Math.abs(value) >= 1000) {
                        return `$${(value / 1000).toFixed(0)}K`;
                      }
                      return `$${value}`;
                    }}
                    width={80}
                    label={{
                      value: 'Volume ($)',
                      angle: 90,
                      position: 'insideRight',
                      fill: useColorModeValue('gray.700', 'white'),
                      style: { textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)') }
                    }}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                      if (name === 'Cumulative P/L') {
                        return [`$${Number(value).toLocaleString()}`, 'Cumulative P/L'];
                      }
                      if (name === 'Daily P/L') {
                        return [`$${Number(value).toLocaleString()}`, 'Daily P/L'];
                      }
                      if (name === 'Volume') {
                        return [`$${Number(value).toLocaleString()}`, 'Volume'];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label) => format(new Date(label), 'MMMM dd, yyyy')}
                    cursor={{ stroke: useColorModeValue('gray.400', 'gray.500'), strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: '10px',
                      color: useColorModeValue('#2D3748', 'white')
                    }}
                    iconType="circle"
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="profitLoss"
                    name="Daily P/L"
                    stroke={useColorModeValue('#38A169', '#68D391')}
                    fillOpacity={1}
                    fill="url(#colorPL)"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cumulativePL"
                    name="Cumulative P/L"
                    stroke={useColorModeValue('#805AD5', '#B794F4')}
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      stroke: useColorModeValue('#805AD5', '#B794F4'),
                      fill: useColorModeValue('white', '#1A202C')
                    }}
                    activeDot={{
                      r: 6,
                      stroke: useColorModeValue('#805AD5', '#B794F4'),
                      strokeWidth: 2,
                      fill: useColorModeValue('white', '#1A202C')
                    }}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="volume"
                    name="Volume"
                    barSize={20}
                    fill="url(#colorVolume)"
                    radius={[4, 4, 0, 0]}
                    opacity={0.6}
                  />
                </ComposedChart>
              ) : chartType === 'bar' ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorProfitBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={useColorModeValue('#38A169', '#68D391')} stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="colorLossBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={useColorModeValue('#E53E3E', '#FC8181')} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={useColorModeValue('#E53E3E', '#FC8181')} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={useColorModeValue('gray.200', 'gray.700')}
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  />
                  <YAxis
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                      return [value, name];
                    }}
                    labelFormatter={(label) => format(new Date(label), 'MMMM dd, yyyy')}
                    cursor={{ fill: useColorModeValue('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)') }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: '10px',
                      color: useColorModeValue('#2D3748', 'white')
                    }}
                    iconType="circle"
                  />
                  <Bar
                    dataKey={(data) => data.profitLoss >= 0 ? data.profitLoss : 0}
                    name="Profit"
                    fill="url(#colorProfitBar)"
                    radius={[4, 4, 0, 0]}
                    stackId="stack"
                  />
                  <Bar
                    dataKey={(data) => data.profitLoss < 0 ? -data.profitLoss : 0}
                    name="Loss"
                    fill="url(#colorLossBar)"
                    radius={[4, 4, 0, 0]}
                    stackId="stack"
                  />
                </BarChart>
              ) : (
                <ScatterChart
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={useColorModeValue('gray.200', 'gray.700')}
                    opacity={0.5}
                  />
                  <XAxis
                    type="category"
                    dataKey="date"
                    name="Date"
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                  />
                  <YAxis
                    type="number"
                    dataKey="profitLoss"
                    name="Profit/Loss"
                    tick={{ fill: useColorModeValue('gray.700', 'white') }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                    itemStyle={{
                      color: useColorModeValue('gray.800', 'white')
                    }}
                    labelStyle={{
                      color: useColorModeValue('gray.800', 'white')
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Profit/Loss') {
                        return [`$${Number(value).toLocaleString()}`, 'Profit/Loss'];
                      }
                      if (name === 'Trades') {
                        return [value, 'Trades'];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label) => format(new Date(label), 'MMMM dd, yyyy')}
                    cursor={{ stroke: useColorModeValue('gray.400', 'gray.500'), strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Legend
                    wrapperStyle={{
                      paddingTop: '10px',
                      color: useColorModeValue('#2D3748', 'white')
                    }}
                    iconType="circle"
                  />
                  <Scatter
                    name="Trades"
                    data={chartData}
                    fill={useColorModeValue('#3182CE', '#63B3ED')}
                    shape="circle"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.profitLoss >= 0 ?
                          useColorModeValue('#38A169', '#68D391') :
                          useColorModeValue('#E53E3E', '#FC8181')}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              )}
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
      
      {/* Additional analysis tabs */}
      <Tabs variant="enclosed" colorScheme="brand">
        <TabList>
          <Tab>Token Comparison</Tab>
          <Tab>Distribution</Tab>
          <Tab>Win/Loss Analysis</Tab>
        </TabList>
        
        <TabPanels>
          {/* Token Comparison */}
          <TabPanel p={0} pt={4}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
                <CardBody>
                  <Heading size="md" mb={4}>Token Performance Comparison</Heading>
                  
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={tokenPerformance}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={useColorModeValue('gray.200', 'gray.700')}
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="token"
                          tick={{ fill: useColorModeValue('gray.700', 'white') }}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: useColorModeValue('gray.700', 'white') }}
                          tickFormatter={(value) => `${value.toFixed(0)}%`}
                          width={60}
                          domain={[0, 100]}
                          label={{
                            value: 'Win Rate (%)',
                            angle: -90,
                            position: 'insideLeft',
                            fill: useColorModeValue('gray.700', 'white'),
                            style: { textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)') }
                          }}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: useColorModeValue('gray.700', 'white') }}
                          tickFormatter={(value) => {
                            if (Math.abs(value) >= 1000) {
                              return `$${(value / 1000).toFixed(0)}K`;
                            }
                            return `$${value}`;
                          }}
                          width={80}
                          label={{
                            value: 'Avg. Profit/Loss ($)',
                            angle: 90,
                            position: 'insideRight',
                            fill: useColorModeValue('gray.700', 'white'),
                            style: { textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)') }
                          }}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                            if (name === 'Win Rate') {
                              return [`${value.toFixed(1)}%`, 'Win Rate'];
                            }
                            if (name === 'Avg. Profit') {
                              return [`$${Number(value).toLocaleString()}`, 'Avg. Profit'];
                            }
                            return [value, name];
                          }}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '10px',
                            color: useColorModeValue('#2D3748', 'white')
                          }}
                          iconType="circle"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="winRate"
                          name="Win Rate"
                          stroke={useColorModeValue('#805AD5', '#B794F4')}
                          strokeWidth={3}
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
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="averageProfitLoss"
                          name="Avg. Profit"
                          stroke={useColorModeValue('#38A169', '#68D391')}
                          strokeWidth={3}
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
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
              
              <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
                <CardBody>
                  <Heading size="md" mb={4}>Profit/Loss by Token</Heading>
                  
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tokenPerformance
                          .slice()
                          .sort((a, b) => Math.abs(b.totalProfitLoss) - Math.abs(a.totalProfitLoss))
                          .slice(0, 5)}
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
                          dataKey={(data) => data.totalProfitLoss >= 0 ? data.totalProfitLoss : 0}
                          name="Profit"
                          fill="url(#colorProfit)"
                          radius={[0, 6, 6, 0]}
                          animationDuration={1500}
                          animationBegin={300}
                          maxBarSize={30}
                        />
                        
                        {/* Negative values bar */}
                        <Bar
                          dataKey={(data) => data.totalProfitLoss < 0 ? data.totalProfitLoss : 0}
                          name="Loss"
                          fill="url(#colorLoss)"
                          radius={[0, 6, 6, 0]}
                          animationDuration={1500}
                          animationBegin={300}
                          maxBarSize={30}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>
          
          {/* Distribution */}
          <TabPanel p={0} pt={4}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
                <CardBody>
                  <Heading size="md" mb={4}>Trade Distribution by Token</Heading>
                  
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tokenPerformance.slice().sort((a, b) => b.totalTrades - a.totalTrades)}
                          dataKey="totalTrades"
                          nameKey="token"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={60}
                          paddingAngle={2}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          labelLine={false}
                          animationDuration={1500}
                        >
                          {tokenPerformance.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={[
                                '#4299E1', // blue.400
                                '#38B2AC', // teal.400
                                '#48BB78', // green.400
                                '#ECC94B', // yellow.400
                                '#ED8936', // orange.400
                                '#F56565', // red.400
                                '#9F7AEA', // purple.400
                                '#ED64A6', // pink.400
                                '#667EEA', // indigo.400
                                '#A0AEC0'  // gray.400
                              ][index % 10]}
                            />
                          ))}
                        </Pie>
                        {/*
                          Tooltip with proper dark mode support
                          - Added itemStyle and labelStyle with color mode values
                          - Ensures text is readable in both light and dark modes
                          - Added higher z-index to prevent tooltip from being hidden
                        */}
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
                          itemStyle={{
                            color: useColorModeValue('gray.800', 'white')
                          }}
                          labelStyle={{
                            color: useColorModeValue('gray.800', 'white')
                          }}
                          formatter={(value: any, name: string, props: any) => {
                            const token = props.payload.token;
                            return [`${value} trades (${props.percent ? (props.percent * 100).toFixed(1) : 0}%)`, token];
                          }}
                          wrapperStyle={{ zIndex: 1000 }}
                        />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          wrapperStyle={{
                            paddingTop: '20px',
                            color: useColorModeValue('#2D3748', 'white')
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
              
              <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
                <CardBody>
                  <Heading size="md" mb={4}>Trade Volume by Token</Heading>
                  
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tokenPerformance
                          .slice()
                          .sort((a, b) => b.totalVolume - a.totalVolume)
                          .slice(0, 5)}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
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
                          dataKey="token"
                          tick={{ fill: useColorModeValue('gray.700', 'white') }}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                        />
                        <YAxis
                          tick={{ fill: useColorModeValue('gray.700', 'white') }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                          label={{
                            value: 'Volume ($)',
                            angle: -90,
                            position: 'insideLeft',
                            fill: useColorModeValue('gray.700', 'white'),
                            style: { textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)') }
                          }}
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
                          formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Volume']}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '10px',
                            color: useColorModeValue('#2D3748', 'white')
                          }}
                          iconType="circle"
                        />
                        <Bar
                          dataKey="totalVolume"
                          name="Volume"
                          fill="url(#colorVolume)"
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>
          
          {/* Win/Loss Analysis */}
          <TabPanel p={0} pt={4}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
                <CardBody>
                  <Heading size="md" mb={4}>Win/Loss Ratio by Token</Heading>
                  
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tokenPerformance
                          .slice()
                          .sort((a, b) => b.winRate - a.winRate)}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        layout="vertical"
                      >
                        <defs>
                          <linearGradient id="colorWinRate" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={useColorModeValue('#805AD5', '#B794F4')} stopOpacity={0.8}/>
                            <stop offset="100%" stopColor={useColorModeValue('#9F7AEA', '#D6BCFA')} stopOpacity={1}/>
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
                          tickFormatter={(value) => `${value}%`}
                          domain={[0, 100]}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
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
                          formatter={(value: any) => [`${value.toFixed(1)}%`, 'Win Rate']}
                          cursor={{ fill: useColorModeValue('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)') }}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '10px',
                            color: useColorModeValue('#2D3748', 'white')
                          }}
                          iconType="circle"
                        />
                        <Bar
                          dataKey="winRate"
                          name="Win Rate"
                          fill="url(#colorWinRate)"
                          radius={[0, 6, 6, 0]}
                          animationDuration={1500}
                          maxBarSize={30}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
              
              <Card bg={cardBg} borderWidth="1px" borderColor={cardBorderColor} borderRadius="lg" overflow="hidden">
                <CardBody>
                  <Heading size="md" mb={4}>Profit/Loss Distribution</Heading>
                  
                  <Box h="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { range: 'Large Loss (>$1000)', count: filteredByTimeframe.filter(t => t.profitLoss <= -1000).length },
                          { range: 'Medium Loss ($500-$1000)', count: filteredByTimeframe.filter(t => t.profitLoss < -500 && t.profitLoss > -1000).length },
                          { range: 'Small Loss ($0-$500)', count: filteredByTimeframe.filter(t => t.profitLoss < 0 && t.profitLoss >= -500).length },
                          { range: 'Small Profit ($0-$500)', count: filteredByTimeframe.filter(t => t.profitLoss > 0 && t.profitLoss <= 500).length },
                          { range: 'Medium Profit ($500-$1000)', count: filteredByTimeframe.filter(t => t.profitLoss > 500 && t.profitLoss <= 1000).length },
                          { range: 'Large Profit (>$1000)', count: filteredByTimeframe.filter(t => t.profitLoss > 1000).length }
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="colorDistribution" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={useColorModeValue('#ED8936', '#F6AD55')} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={useColorModeValue('#ED8936', '#F6AD55')} stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={useColorModeValue('gray.200', 'gray.700')}
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="range"
                          tick={{ fill: useColorModeValue('gray.700', 'white'), fontSize: 11 }}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{ fill: useColorModeValue('gray.700', 'white') }}
                          axisLine={{ stroke: useColorModeValue('gray.300', 'gray.500') }}
                          label={{
                            value: 'Number of Trades',
                            angle: -90,
                            position: 'insideLeft',
                            fill: useColorModeValue('gray.700', 'white'),
                            style: { textShadow: useColorModeValue('none', '0 0 3px rgba(0,0,0,0.5)') }
                          }}
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
                          formatter={(value: any) => [value, 'Trades']}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '10px',
                            color: useColorModeValue('#2D3748', 'white')
                          }}
                          iconType="circle"
                        />
                        <Bar
                          dataKey="count"
                          name="Trades"
                          fill="url(#colorDistribution)"
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default PerformanceAnalysis;