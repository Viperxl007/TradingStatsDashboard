import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Flex,
  Spacer,
  useColorModeValue,
  Select,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  SimpleGrid
} from '@chakra-ui/react';
import { useData } from '../../context/DataContext';
import { StrategyType } from '../../types/tradeTracker';
import StatisticsChart from './StatisticsChart';

/**
 * StatisticsPanel Component
 * 
 * This component displays trade performance statistics and visualizations.
 */
const StatisticsPanel: React.FC = () => {
  const { state } = useData();
  const { tradeTrackerData } = state;
  const { statistics, trades } = tradeTrackerData;
  
  const [timeFrame, setTimeFrame] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBgColor = useColorModeValue('gray.50', 'gray.700');
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Format percentage
  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };
  
  // Get color based on value (positive/negative)
  const getValueColor = (value: number) => {
    return value >= 0 ? 'green.500' : 'red.500';
  };
  
  // Filter strategies with data
  const strategiesWithData = Object.entries(statistics.byStrategy)
    .filter(([_, data]) => data.count > 0)
    .map(([strategy]) => strategy);
  
  // Get top performing tickers
  const topTickers = Object.entries(statistics.byTicker)
    .filter(([_, data]) => data.count >= 3) // Only include tickers with at least 3 trades
    .sort((a, b) => b[1].netProfitLoss - a[1].netProfitLoss)
    .slice(0, 5);
  
  // Get worst performing tickers
  const worstTickers = Object.entries(statistics.byTicker)
    .filter(([_, data]) => data.count >= 3) // Only include tickers with at least 3 trades
    .sort((a, b) => a[1].netProfitLoss - b[1].netProfitLoss)
    .slice(0, 5);
  
  // Handle time frame change
  const handleTimeFrameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeFrame(e.target.value);
  };
  
  // Handle strategy filter change
  const handleStrategyFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStrategyFilter(e.target.value);
  };
  
  return (
    <Box>
      <Flex mb={4} direction={{ base: 'column', md: 'row' }} gap={4}>
        <HStack spacing={2}>
          <Text fontWeight="medium">Time Period:</Text>
          <Select
            value={timeFrame}
            onChange={handleTimeFrameChange}
            width="auto"
            size="sm"
          >
            <option value="all">All Time</option>
            <option value="ytd">Year to Date</option>
            <option value="1m">Last Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last Year</option>
          </Select>
        </HStack>
        
        <Spacer />
        
        <HStack spacing={2}>
          <Text fontWeight="medium">Strategy:</Text>
          <Select
            value={strategyFilter}
            onChange={handleStrategyFilterChange}
            width="auto"
            size="sm"
          >
            <option value="all">All Strategies</option>
            {strategiesWithData.map(strategy => (
              <option key={strategy} value={strategy}>
                {strategy.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </HStack>
      </Flex>
      
      {/* Summary Statistics */}
      <Grid 
        templateColumns={{ base: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }}
        gap={4}
        mb={6}
      >
        <GridItem>
          <Box 
            p={4} 
            borderRadius="lg" 
            bg={cardBgColor} 
            borderWidth="1px"
            borderColor={borderColor}
            height="100%"
          >
            <Stat>
              <StatLabel>Win Rate</StatLabel>
              <StatNumber color={getValueColor(statistics.winRate - 0.5)}>
                {formatPercentage(statistics.winRate)}
              </StatNumber>
              <StatHelpText>
                {statistics.winningTrades} / {statistics.closedTrades} trades
              </StatHelpText>
            </Stat>
          </Box>
        </GridItem>
        
        <GridItem>
          <Box 
            p={4} 
            borderRadius="lg" 
            bg={cardBgColor} 
            borderWidth="1px"
            borderColor={borderColor}
            height="100%"
          >
            <Stat>
              <StatLabel>Net Profit/Loss</StatLabel>
              <StatNumber color={getValueColor(statistics.netProfitLoss)}>
                {formatCurrency(statistics.netProfitLoss)}
              </StatNumber>
              <StatHelpText>
                {statistics.closedTrades} closed trades
              </StatHelpText>
            </Stat>
          </Box>
        </GridItem>
        
        <GridItem>
          <Box 
            p={4} 
            borderRadius="lg" 
            bg={cardBgColor} 
            borderWidth="1px"
            borderColor={borderColor}
            height="100%"
          >
            <Stat>
              <StatLabel>Profit Factor</StatLabel>
              <StatNumber color={getValueColor(statistics.profitFactor - 1)}>
                {statistics.profitFactor.toFixed(2)}
              </StatNumber>
              <StatHelpText>
                Profit / Loss Ratio
              </StatHelpText>
            </Stat>
          </Box>
        </GridItem>
        
        <GridItem>
          <Box 
            p={4} 
            borderRadius="lg" 
            bg={cardBgColor} 
            borderWidth="1px"
            borderColor={borderColor}
            height="100%"
          >
            <Stat>
              <StatLabel>Expectancy</StatLabel>
              <StatNumber color={getValueColor(statistics.expectancy)}>
                {formatCurrency(statistics.expectancy)}
              </StatNumber>
              <StatHelpText>
                Expected value per trade
              </StatHelpText>
            </Stat>
          </Box>
        </GridItem>
      </Grid>
      
      {/* Performance Charts */}
      <Box 
        p={4} 
        borderRadius="lg" 
        bg={bgColor} 
        borderWidth="1px"
        borderColor={borderColor}
        mb={6}
      >
        <Text fontSize="lg" fontWeight="medium" mb={4}>Performance Over Time</Text>
        <StatisticsChart 
          trades={trades} 
          timeFrame={timeFrame} 
          strategyFilter={strategyFilter === 'all' ? undefined : strategyFilter as StrategyType}
        />
      </Box>
      
      {/* Detailed Statistics */}
      <Tabs variant="enclosed" colorScheme="brand" mb={6}>
        <TabList>
          <Tab>Strategy Performance</Tab>
          <Tab>Ticker Performance</Tab>
          <Tab>Detailed Metrics</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel>
            <Box overflowX="auto">
              <Box minWidth="600px">
                <Flex 
                  p={3} 
                  bg={cardBgColor} 
                  borderTopRadius="md" 
                  fontWeight="medium"
                  borderWidth="1px"
                  borderColor={borderColor}
                >
                  <Box flex="1">Strategy</Box>
                  <Box width="100px" textAlign="center">Count</Box>
                  <Box width="100px" textAlign="center">Win Rate</Box>
                  <Box width="150px" textAlign="right">Net P&L</Box>
                </Flex>
                
                <VStack spacing={0} align="stretch">
                  {Object.entries(statistics.byStrategy)
                    .filter(([_, data]) => data.count > 0)
                    .sort((a, b) => b[1].netProfitLoss - a[1].netProfitLoss)
                    .map(([strategy, data]) => (
                      <Flex 
                        key={strategy} 
                        p={3} 
                        borderWidth="1px" 
                        borderTop="none"
                        borderColor={borderColor}
                        _hover={{ bg: cardBgColor }}
                      >
                        <Box flex="1">
                          <Text>{strategy.replace('_', ' ')}</Text>
                        </Box>
                        <Box width="100px" textAlign="center">{data.count}</Box>
                        <Box width="100px" textAlign="center">{formatPercentage(data.winRate)}</Box>
                        <Box 
                          width="150px" 
                          textAlign="right" 
                          color={getValueColor(data.netProfitLoss)}
                        >
                          {formatCurrency(data.netProfitLoss)}
                        </Box>
                      </Flex>
                    ))
                  }
                </VStack>
              </Box>
            </Box>
          </TabPanel>
          
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box>
                <Text fontSize="md" fontWeight="medium" mb={3}>Top Performing Tickers</Text>
                <Box overflowX="auto">
                  <Box minWidth="400px">
                    <Flex 
                      p={3} 
                      bg={cardBgColor} 
                      borderTopRadius="md" 
                      fontWeight="medium"
                      borderWidth="1px"
                      borderColor={borderColor}
                    >
                      <Box flex="1">Ticker</Box>
                      <Box width="80px" textAlign="center">Count</Box>
                      <Box width="80px" textAlign="center">Win Rate</Box>
                      <Box width="120px" textAlign="right">Net P&L</Box>
                    </Flex>
                    
                    <VStack spacing={0} align="stretch">
                      {topTickers.map(([ticker, data]) => (
                        <Flex 
                          key={ticker} 
                          p={3} 
                          borderWidth="1px" 
                          borderTop="none"
                          borderColor={borderColor}
                          _hover={{ bg: cardBgColor }}
                        >
                          <Box flex="1">
                            <Text>{ticker}</Text>
                          </Box>
                          <Box width="80px" textAlign="center">{data.count}</Box>
                          <Box width="80px" textAlign="center">{formatPercentage(data.winRate)}</Box>
                          <Box 
                            width="120px" 
                            textAlign="right" 
                            color={getValueColor(data.netProfitLoss)}
                          >
                            {formatCurrency(data.netProfitLoss)}
                          </Box>
                        </Flex>
                      ))}
                    </VStack>
                  </Box>
                </Box>
              </Box>
              
              <Box>
                <Text fontSize="md" fontWeight="medium" mb={3}>Worst Performing Tickers</Text>
                <Box overflowX="auto">
                  <Box minWidth="400px">
                    <Flex 
                      p={3} 
                      bg={cardBgColor} 
                      borderTopRadius="md" 
                      fontWeight="medium"
                      borderWidth="1px"
                      borderColor={borderColor}
                    >
                      <Box flex="1">Ticker</Box>
                      <Box width="80px" textAlign="center">Count</Box>
                      <Box width="80px" textAlign="center">Win Rate</Box>
                      <Box width="120px" textAlign="right">Net P&L</Box>
                    </Flex>
                    
                    <VStack spacing={0} align="stretch">
                      {worstTickers.map(([ticker, data]) => (
                        <Flex 
                          key={ticker} 
                          p={3} 
                          borderWidth="1px" 
                          borderTop="none"
                          borderColor={borderColor}
                          _hover={{ bg: cardBgColor }}
                        >
                          <Box flex="1">
                            <Text>{ticker}</Text>
                          </Box>
                          <Box width="80px" textAlign="center">{data.count}</Box>
                          <Box width="80px" textAlign="center">{formatPercentage(data.winRate)}</Box>
                          <Box 
                            width="120px" 
                            textAlign="right" 
                            color={getValueColor(data.netProfitLoss)}
                          >
                            {formatCurrency(data.netProfitLoss)}
                          </Box>
                        </Flex>
                      ))}
                    </VStack>
                  </Box>
                </Box>
              </Box>
            </SimpleGrid>
          </TabPanel>
          
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              <Box 
                p={4} 
                borderRadius="md" 
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Text fontSize="sm" color="gray.500">Total Trades</Text>
                <Text fontSize="xl" fontWeight="bold">{statistics.totalTrades}</Text>
                <Divider my={2} />
                <Flex>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Open</Text>
                    <Text>{statistics.openTrades}</Text>
                  </Box>
                  <Spacer />
                  <Box>
                    <Text fontSize="sm" color="gray.500">Closed</Text>
                    <Text>{statistics.closedTrades}</Text>
                  </Box>
                </Flex>
              </Box>
              
              <Box 
                p={4} 
                borderRadius="md" 
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Text fontSize="sm" color="gray.500">Win/Loss</Text>
                <Text fontSize="xl" fontWeight="bold">
                  {statistics.winningTrades} / {statistics.losingTrades}
                </Text>
                <Divider my={2} />
                <Flex>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Win Rate</Text>
                    <Text color={getValueColor(statistics.winRate - 0.5)}>
                      {formatPercentage(statistics.winRate)}
                    </Text>
                  </Box>
                  <Spacer />
                  <Box>
                    <Text fontSize="sm" color="gray.500">Avg Duration</Text>
                    <Text>{statistics.averageDuration.toFixed(1)} days</Text>
                  </Box>
                </Flex>
              </Box>
              
              <Box 
                p={4} 
                borderRadius="md" 
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Text fontSize="sm" color="gray.500">Profit/Loss</Text>
                <Text fontSize="xl" fontWeight="bold" color={getValueColor(statistics.netProfitLoss)}>
                  {formatCurrency(statistics.netProfitLoss)}
                </Text>
                <Divider my={2} />
                <Flex>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Total Profit</Text>
                    <Text color="green.500">{formatCurrency(statistics.totalProfit)}</Text>
                  </Box>
                  <Spacer />
                  <Box>
                    <Text fontSize="sm" color="gray.500">Total Loss</Text>
                    <Text color="red.500">{formatCurrency(statistics.totalLoss)}</Text>
                  </Box>
                </Flex>
              </Box>
              
              <Box 
                p={4} 
                borderRadius="md" 
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Text fontSize="sm" color="gray.500">Average Trade</Text>
                <Text fontSize="xl" fontWeight="bold" color={getValueColor(statistics.expectancy)}>
                  {formatCurrency(statistics.expectancy)}
                </Text>
                <Divider my={2} />
                <Flex>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Avg Profit</Text>
                    <Text color="green.500">{formatCurrency(statistics.averageProfit)}</Text>
                  </Box>
                  <Spacer />
                  <Box>
                    <Text fontSize="sm" color="gray.500">Avg Loss</Text>
                    <Text color="red.500">{formatCurrency(statistics.averageLoss)}</Text>
                  </Box>
                </Flex>
              </Box>
              
              <Box 
                p={4} 
                borderRadius="md" 
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Text fontSize="sm" color="gray.500">Largest Trades</Text>
                <Text fontSize="xl" fontWeight="bold">
                  {formatCurrency(Math.max(statistics.largestProfit, statistics.largestLoss))}
                </Text>
                <Divider my={2} />
                <Flex>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Largest Profit</Text>
                    <Text color="green.500">{formatCurrency(statistics.largestProfit)}</Text>
                  </Box>
                  <Spacer />
                  <Box>
                    <Text fontSize="sm" color="gray.500">Largest Loss</Text>
                    <Text color="red.500">{formatCurrency(statistics.largestLoss)}</Text>
                  </Box>
                </Flex>
              </Box>
              
              <Box 
                p={4} 
                borderRadius="md" 
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Text fontSize="sm" color="gray.500">Performance Metrics</Text>
                <Text fontSize="xl" fontWeight="bold">
                  {statistics.profitFactor.toFixed(2)}
                </Text>
                <Divider my={2} />
                <Flex>
                  <Box>
                    <Text fontSize="sm" color="gray.500">Profit Factor</Text>
                    <Text color={getValueColor(statistics.profitFactor - 1)}>
                      {statistics.profitFactor.toFixed(2)}
                    </Text>
                  </Box>
                  <Spacer />
                  <Box>
                    <Text fontSize="sm" color="gray.500">Expectancy</Text>
                    <Text color={getValueColor(statistics.expectancy)}>
                      {formatCurrency(statistics.expectancy)}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default StatisticsPanel;