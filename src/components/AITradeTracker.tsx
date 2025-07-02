import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Spinner,
  Center,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  VStack,
  HStack,
  Button,
  useDisclosure,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Badge,
  Icon,
  Flex
} from '@chakra-ui/react';
import { FiActivity, FiTrendingUp, FiBarChart, FiTarget, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { useData } from '../context/DataContext';
import { ActionType } from '../context/DataContext';
import { getAllActiveTradesForAITracker } from '../services/productionActiveTradesService';
import { AITradeEntry, AITradeStatistics } from '../types/aiTradeTracker';
import AIActiveTradesPanel from './aiTradeTracker/AIActiveTradesPanel';
import AITradeHistoryPanel from './aiTradeTracker/AITradeHistoryPanel';
import AITradeStatisticsPanel from './aiTradeTracker/AITradeStatisticsPanel';
import AIPerformanceAnalysisPanel from './aiTradeTracker/AIPerformanceAnalysisPanel';
import DeletionManager from './deletion/DeletionManager';
import { DeletionResult } from '../services/universalDeletionService';

/**
 * AI Trade Tracker Component
 * 
 * Main component for tracking AI-generated trade recommendations and their performance
 */
const AITradeTracker: React.FC = () => {
  const { state, dispatch } = useData();
  const toast = useToast();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiTrades, setAiTrades] = useState<AITradeEntry[]>([]);
  const [statistics, setStatistics] = useState<AITradeStatistics | null>(null);
  const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();

  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');

  // Load AI trades when component mounts
  useEffect(() => {
    loadAITrades();
  }, []);

  // Load AI trades when switching to AI trade tracker
  useEffect(() => {
    if (state.activeTab === 'chartanalysis') {
      loadAITrades();
    }
  }, [state.activeTab]);

  /**
   * Load all AI trades from production
   */
  const loadAITrades = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get all trades from production
      const trades = await getAllActiveTradesForAITracker();
      setAiTrades(trades);
      
      // Calculate basic statistics
      const totalTrades = trades.length;
      const profitableTrades = trades.filter(t => t.profitLoss && t.profitLoss > 0).length;
      const totalReturn = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
      
      const stats: AITradeStatistics = {
        totalRecommendations: totalTrades,
        activeTrades: trades.filter(t => t.status === 'open').length,
        closedTrades: trades.filter(t => t.status === 'closed').length,
        winningTrades: profitableTrades,
        losingTrades: totalTrades - profitableTrades,
        winRate,
        totalReturn,
        averageReturn: totalTrades > 0 ? totalReturn / totalTrades : 0,
        bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.profitLoss || 0)) : 0,
        worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.profitLoss || 0)) : 0,
        averageHoldTime: 0,
        averageConfidence: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
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
      
      console.log(`📊 [AITradeTracker] Loaded ${trades.length} AI trades from production`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load AI trades';
      setError(errorMessage);
      console.error('❌ [AITradeTracker] Error loading AI trades:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh AI trades data
   */
  const handleRefresh = async () => {
    await loadAITrades();
    toast({
      title: 'Data Refreshed',
      description: 'AI trade data has been refreshed',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  /**
   * Handle clearing local AI trade data (production data remains intact)
   */
  const handleClearAllData = async () => {
    try {
      // Clear local state only - production data is preserved
      setAiTrades([]);
      setStatistics(null);
      
      toast({
        title: 'Local data cleared',
        description: 'Local AI trade view cleared. Production data is preserved.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
      
      onAlertClose();
      
      // Reload from production to refresh the view
      await loadAITrades();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear local data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Handle enhanced deletion completion
   */
  const handleDeletionComplete = (result: DeletionResult) => {
    if (result.success) {
      // Reload data after successful deletion
      loadAITrades();
      
      toast({
        title: 'Deletion Completed',
        description: `Successfully processed ${result.deletedItems.length} items with enhanced safety checks`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Deletion Issues',
        description: `Deletion completed with ${result.errors.length} issues. Check console for details.`,
        status: 'warning',
        duration: 7000,
        isClosable: true,
      });
    }
  };

  /**
   * Get selected trades for deletion (example - would be implemented based on selection logic)
   */
  const getSelectedTradesForDeletion = () => {
    // This would be implemented based on your selection logic
    // For now, return closed trades as an example
    const closedTrades = aiTrades.filter(trade => trade.status === 'closed' || trade.status === 'user_closed');
    return closedTrades.slice(0, 5).map(trade => ({
      id: trade.id,
      type: 'ai_trade' as const,
      displayName: `${trade.ticker} - ${trade.action} (${new Date(trade.entryDate).toLocaleDateString()})`
    }));
  };

  /**
   * Handle tab change
   */
  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  /**
   * Get active trades count
   */
  const getActiveTradesCount = () => {
    return aiTrades.filter(trade => trade.status === 'waiting' || trade.status === 'open').length;
  };

  /**
   * Get recent performance indicator
   */
  const getRecentPerformance = () => {
    if (!statistics || !statistics.recentTrends.last7Days.trades) {
      return { value: 0, isPositive: true };
    }
    
    const recent = statistics.recentTrends.last7Days.totalReturn;
    return {
      value: recent,
      isPositive: recent >= 0
    };
  };

  return (
    <Box>
      <Box mb={6}>
        <Flex justify="space-between" align="center" mb={2}>
          <Heading size="lg">AI Trade Tracker</Heading>
          <HStack spacing={2}>
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
                      {getRecentPerformance().value.toFixed(2)}% (7d)
                    </Text>
                  </HStack>
                </Badge>
              </>
            )}
          </HStack>
        </Flex>
        <Text mb={4} color={useColorModeValue('gray.600', 'gray.400')}>
          Track and analyze AI-generated trade recommendations and their performance across all timeframes and models.
        </Text>
      </Box>
      
      {error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <Box>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {isLoading ? (
        <Center height="400px" borderWidth="1px" borderRadius="lg">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" />
            <Text>Loading AI trade data...</Text>
          </VStack>
        </Center>
      ) : (
        <Box>
          <HStack spacing={4} mb={4} justifyContent="flex-end">
            <Button
              leftIcon={<FiRefreshCw />}
              variant="outline"
              colorScheme="brand"
              onClick={handleRefresh}
              size="sm"
            >
              Refresh
            </Button>
            
            {/* Enhanced Deletion Manager */}
            <DeletionManager
              items={getSelectedTradesForDeletion()}
              onDeletionComplete={handleDeletionComplete}
              buttonText="Smart Delete"
              variant="outline"
              size="sm"
              showAsMenu={true}
              dialogTitle="AI Trade Deletion"
              dialogDescription="Review the impact of deleting selected AI trades with comprehensive dependency analysis"
            />
            
            <Button
              leftIcon={<FiTrash2 />}
              colorScheme="red"
              variant="outline"
              onClick={onAlertOpen}
              size="sm"
            >
              Clear All Data
            </Button>
          </HStack>
          
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
              onChange={handleTabChange}
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
                    <Icon as={FiBarChart} />
                    <Text>Trade History</Text>
                  </HStack>
                </Tab>
                <Tab>
                  <HStack spacing={2}>
                    <Icon as={FiTarget} />
                    <Text>Statistics</Text>
                  </HStack>
                </Tab>
                <Tab>
                  <HStack spacing={2}>
                    <Icon as={FiTrendingUp} />
                    <Text>Performance</Text>
                  </HStack>
                </Tab>
              </TabList>
              
              <TabPanels>
                <TabPanel>
                  <AIActiveTradesPanel
                    onError={(error: string) => setError(error)}
                    onTradeUpdate={loadAITrades}
                  />
                </TabPanel>
                <TabPanel>
                  <AITradeHistoryPanel
                    onError={(error: string) => setError(error)}
                    onTradeDeleted={loadAITrades}
                  />
                </TabPanel>
                <TabPanel>
                  <AITradeStatisticsPanel
                    onError={(error: string) => setError(error)}
                  />
                </TabPanel>
                <TabPanel>
                  <AIPerformanceAnalysisPanel
                    onError={(error: string) => setError(error)}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        </Box>
      )}
      
      {/* Clear All Data Confirmation Dialog */}
      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Clear All AI Trade Data
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete all AI trade recommendations and performance data? 
              This action cannot be undone and will permanently remove all your AI trading analytics.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onAlertClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleClearAllData} ml={3}>
                Delete All Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default AITradeTracker;