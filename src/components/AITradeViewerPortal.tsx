import React, { useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  VStack,
  HStack,
  Button,
  Icon,
  useToast,
  Flex,
  Badge,
  Spinner,
  useDisclosure
} from '@chakra-ui/react';
import {
  FiActivity,
  FiTrendingUp,
  FiBarChart,
  FiTarget,
  FiRefreshCw,
  FiExternalLink,
  FiClock
} from 'react-icons/fi';
import theme from '../theme';
import { AITradeEntry, AITradeStatistics } from '../types/aiTradeTracker';
import { getAllActiveTradesForAITracker, getAllTradesHistoryForAITracker } from '../services/productionActiveTradesService';

// Import sub-components (we'll create these next)
import AITradeViewerActiveTrades from './aiTradeViewer/AITradeViewerActiveTrades';
import AITradeViewerHistory from './aiTradeViewer/AITradeViewerHistory';
import AITradeViewerPerformance from './aiTradeViewer/AITradeViewerPerformance';

/**
 * AI Trade Viewer Portal
 *
 * A standalone portal that displays AI-generated trade recommendations
 * with the same design language as the main application
 */
const AITradeViewerPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTrades, setActiveTrades] = useState<AITradeEntry[]>([]);
  const [tradeHistory, setTradeHistory] = useState<AITradeEntry[]>([]);
  const [statistics, setStatistics] = useState<AITradeStatistics | null>(null);

  const toast = useToast();

  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  // Load data on component mount
  React.useEffect(() => {
    loadData();
  }, []);

  /**
   * Load all trade data
   */
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load active trades
      const active = await getAllActiveTradesForAITracker();
      setActiveTrades(active);

      // Load trade history
      const history = await getAllTradesHistoryForAITracker();
      setTradeHistory(history);

      // Calculate basic statistics
      const totalTrades = history.length;
      const profitableTrades = history.filter(t => t.profitLossPercentage && t.profitLossPercentage > 0).length;
      const totalReturn = history.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0);
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

      const stats: AITradeStatistics = {
        totalRecommendations: totalTrades,
        activeTrades: active.length,
        closedTrades: history.filter(t => t.status === 'closed' || t.status === 'profit_hit' || t.status === 'stop_hit').length,
        winningTrades: profitableTrades,
        losingTrades: totalTrades - profitableTrades,
        winRate,
        totalReturn,
        averageReturn: totalTrades > 0 ? totalReturn / totalTrades : 0,
        bestTrade: history.length > 0 ? Math.max(...history.map(t => t.profitLossPercentage || 0)) : 0,
        worstTrade: history.length > 0 ? Math.min(...history.map(t => t.profitLossPercentage || 0)) : 0,
        averageHoldTime: 0,
        averageConfidence: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        averageRiskReward: 0,
        profitFactor: 1,
        byModel: {},
        byTicker: {},
        byTimeframe: {},
        byConfidence: {
          low: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
          medium: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
          high: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 },
          very_high: { count: 0, winRate: 0, averageReturn: 0, totalReturn: 0 }
        },
        monthlyPerformance: [],
        recentTrends: {
          last7Days: { trades: 0, winRate: 0, totalReturn: 0 },
          last30Days: { trades: 0, winRate: 0, totalReturn: 0 },
          last90Days: { trades: 0, winRate: 0, totalReturn: 0 }
        }
      };

      setStatistics(stats);

      console.log(`📊 [AITradeViewerPortal] Loaded ${active.length} active trades and ${history.length} historical trades`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load trade data';
      setError(errorMessage);
      console.error('❌ [AITradeViewerPortal] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh data
   */
  const handleRefresh = async () => {
    await loadData();
    toast({
      title: 'Data Refreshed',
      description: 'Trade data has been updated',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  /**
   * Get active trades count
   */
  const getActiveTradesCount = () => {
    return activeTrades.filter(trade => trade.status === 'waiting' || trade.status === 'open').length;
  };

  /**
   * Get recent performance indicator
   */
  const getRecentPerformance = () => {
    if (!statistics) {
      return { value: 0, isPositive: true };
    }

    const recentTrades = tradeHistory.slice(0, 10); // Last 10 trades
    const recentReturn = recentTrades.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0);
    return {
      value: recentReturn,
      isPositive: recentReturn >= 0
    };
  };

  return (
    <Box minH="100vh" bg={useColorModeValue('gray.50', 'gray.900')} p={4}>
      {/* Header */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        py={4}
        px={6}
        bg={bgColor}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
        boxShadow="sm"
        mb={6}
      >
        <VStack align="start" spacing={1}>
          <HStack spacing={4}>
            <Heading size="lg" color={useColorModeValue('gray.800', 'white')}>
              AI Trade Viewer Portal
            </Heading>
            <Badge colorScheme="blue" variant="subtle" px={3} py={1} borderRadius="full">
              <HStack spacing={1}>
                <Icon as={FiActivity} boxSize={3} />
                <Text fontSize="sm">Live</Text>
              </HStack>
            </Badge>
          </HStack>
          <Text fontSize="sm" color={textColor}>
            Real-time view of AI-generated trade recommendations and performance
          </Text>
        </VStack>

        <HStack spacing={4}>
          {statistics && (
            <>
              <Badge
                colorScheme={getActiveTradesCount() > 0 ? 'green' : 'gray'}
                variant="subtle"
                px={3}
                py={1}
                borderRadius="full"
              >
                <HStack spacing={1}>
                  <Icon as={FiActivity} boxSize={3} />
                  <Text fontSize="sm">{getActiveTradesCount()} Active</Text>
                </HStack>
              </Badge>
              <Badge
                colorScheme={getRecentPerformance().isPositive ? 'green' : 'red'}
                variant="subtle"
                px={3}
                py={1}
                borderRadius="full"
              >
                <HStack spacing={1}>
                  <Icon as={FiTrendingUp} boxSize={3} />
                  <Text fontSize="sm">
                    {getRecentPerformance().isPositive ? '+' : ''}
                    {getRecentPerformance().value.toFixed(2)}% (Recent)
                  </Text>
                </HStack>
              </Badge>
            </>
          )}

          <Button
            leftIcon={<FiRefreshCw />}
            variant="outline"
            colorScheme="brand"
            onClick={handleRefresh}
            isLoading={isLoading}
            loadingText="Refreshing"
            size="sm"
          >
            Refresh
          </Button>
        </HStack>
      </Flex>

      {/* Error State */}
      {error && (
        <Box
          p={4}
          bg="red.50"
          borderWidth="1px"
          borderColor="red.200"
          borderRadius="md"
          mb={6}
        >
          <Text color="red.600">{error}</Text>
        </Box>
      )}

      {/* Loading State */}
      {isLoading && !activeTrades.length && !tradeHistory.length ? (
        <Flex justify="center" align="center" h="400px">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" />
            <Text>Loading AI trade data...</Text>
          </VStack>
        </Flex>
      ) : (
        <Box
          borderWidth="1px"
          borderRadius="lg"
          overflow="hidden"
          bg={bgColor}
          borderColor={borderColor}
        >
          <Tabs
            isFitted
            variant="enclosed"
            index={activeTab}
            onChange={setActiveTab}
            colorScheme="brand"
          >
            <TabList>
              <Tab>
                <HStack spacing={2}>
                  <Icon as={FiActivity} />
                  <Text>Active Trades</Text>
                  {getActiveTradesCount() > 0 && (
                    <Badge colorScheme="green" borderRadius="full" px={2}>
                      {getActiveTradesCount()}
                    </Badge>
                  )}
                </HStack>
              </Tab>
              <Tab>
                <HStack spacing={2}>
                  <Icon as={FiClock} />
                  <Text>Trade History</Text>
                </HStack>
              </Tab>
              <Tab>
                <HStack spacing={2}>
                  <Icon as={FiTarget} />
                  <Text>Performance</Text>
                </HStack>
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <AITradeViewerActiveTrades
                  trades={activeTrades}
                  onRefresh={loadData}
                  onError={setError}
                />
              </TabPanel>
              <TabPanel>
                <AITradeViewerHistory
                  trades={tradeHistory}
                  onRefresh={loadData}
                  onError={setError}
                />
              </TabPanel>
              <TabPanel>
                <AITradeViewerPerformance
                  statistics={statistics}
                  trades={tradeHistory}
                  onRefresh={loadData}
                  onError={setError}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      )}

      {/* Footer */}
      <Box mt={8} textAlign="center">
        <Text fontSize="sm" color={textColor}>
          AI Trade Viewer Portal - Last updated: {new Date().toLocaleString()}
        </Text>
      </Box>
    </Box>
  );
};

export default AITradeViewerPortal;