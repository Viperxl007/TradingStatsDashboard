import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  IconButton,
  Tooltip,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  SimpleGrid,
  useColorMode,
  useToast
} from '@chakra-ui/react';
import { FiTrendingUp, FiClock, FiInfo, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';

import { MacroSentimentPanelProps, MacroSentimentData } from '../types/macroSentiment';
import { 
  getMacroSentimentStatus, 
  getMacroSentimentHistory, 
  triggerManualScan,
  formatTimeAgo,
  formatTimeUntil
} from '../services/macroSentimentService';

import ConfidenceGauge from './ConfidenceGauge';
import TrendIndicator from './TrendIndicator';
import TradePermissionCard from './TradePermissionCard';
import MiniConfidenceChart from './MiniConfidenceChart';
import DetailedAnalysisModal from './DetailedAnalysisModal';

const MacroSentimentPanel: React.FC<MacroSentimentPanelProps> = ({
  data: initialData,
  isLoading: initialLoading,
  error: initialError,
  onRefresh
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  const [data, setData] = useState<MacroSentimentData | null>(initialData);
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [nextUpdate, setNextUpdate] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch data on component mount and set up polling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const statusResult = await getMacroSentimentStatus();
        setData(statusResult.sentiment);
        setSystemStatus(statusResult.systemStatus);
        setNextUpdate(statusResult.nextUpdate);
        
        // Fetch historical data for mini chart
        try {
          const historyResult = await getMacroSentimentHistory(7);
          setHistoricalData(historyResult.history);
        } catch (historyError) {
          console.warn('Failed to fetch historical data:', historyError);
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load macro sentiment data';
        setError(errorMessage);
        console.error('Error fetching macro sentiment data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Set up polling every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const statusResult = await getMacroSentimentStatus();
      setData(statusResult.sentiment);
      setSystemStatus(statusResult.systemStatus);
      setNextUpdate(statusResult.nextUpdate);
      
      toast({
        title: 'Data refreshed',
        description: 'Macro sentiment data has been updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data';
      toast({
        title: 'Refresh failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualScan = async () => {
    try {
      toast({
        title: 'Triggering scan',
        description: 'Manual scan initiated...',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      
      await triggerManualScan();
      
      // Refresh data after scan
      setTimeout(handleRefresh, 2000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger scan';
      toast({
        title: 'Scan failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getStatusColorScheme = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'green';
      case 'INITIALIZING': return 'blue';
      case 'ERROR': return 'red';
      case 'MAINTENANCE': return 'orange';
      default: return 'gray';
    }
  };

  // Loading state
  if (isLoading && !data) {
    return (
      <Box 
        mb={6} 
        p={6} 
        bg={colorMode === 'dark' ? 'gray.700' : 'white'} 
        borderRadius="xl" 
        shadow="lg"
        border="1px solid"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      >
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.500" />
          <Text>Loading macro sentiment data...</Text>
        </VStack>
      </Box>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <Box 
        mb={6} 
        p={6} 
        bg={colorMode === 'dark' ? 'gray.700' : 'white'} 
        borderRadius="xl" 
        shadow="lg"
        border="1px solid"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      >
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Macro Analysis Error</AlertTitle>
            <AlertDescription>
              {error}. The system will retry automatically.
            </AlertDescription>
          </Box>
        </Alert>
        <Button mt={4} onClick={handleRefresh} leftIcon={<FiRefreshCw />}>
          Retry
        </Button>
      </Box>
    );
  }

  // No data state
  if (!data) {
    return (
      <Box 
        mb={6} 
        p={6} 
        bg={colorMode === 'dark' ? 'gray.700' : 'white'} 
        borderRadius="xl" 
        shadow="lg"
        border="1px solid"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      >
        <VStack spacing={4} py={8}>
          <FiAlertTriangle size="48px" color="orange" />
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="500">
              Macro Data Unavailable
            </Text>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              The macro sentiment system is currently initializing or experiencing issues.
            </Text>
          </VStack>
          <Button size="sm" onClick={handleRefresh}>
            Retry
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box 
      mb={6} 
      p={6} 
      bg={colorMode === 'dark' ? 'gray.700' : 'white'} 
      borderRadius="xl" 
      shadow="lg"
      border="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
    >
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <HStack spacing={3}>
            <FiTrendingUp size="20px" color={colorMode === 'dark' ? '#4FD1C7' : '#319795'} />
            <Heading size="md" fontWeight="600">
              Market Macro Sentiment
            </Heading>
            <Badge 
              colorScheme={getStatusColorScheme(systemStatus?.scanner?.system_status)} 
              variant="subtle"
              fontSize="xs"
            >
              {systemStatus?.scanner?.system_status || 'UNKNOWN'}
            </Badge>
          </HStack>
          
          <HStack spacing={2}>
            <Text fontSize="sm" color="gray.500">
              Last Updated: {formatTimeAgo(new Date(data.created_at * 1000).toISOString())}
            </Text>
            {nextUpdate && (
              <Tooltip label={`Next update in ${formatTimeUntil(nextUpdate)}`}>
                <HStack spacing={1}>
                  <FiClock color="gray" size="14px" />
                  <Text fontSize="xs" color="gray.400">
                    {formatTimeUntil(nextUpdate)}
                  </Text>
                </HStack>
              </Tooltip>
            )}
          </HStack>
        </Flex>

        {/* Stale data warning */}
        {data.created_at < (Date.now() / 1000) - (6 * 60 * 60) && (
          <Alert status="warning" borderRadius="md" size="sm">
            <AlertIcon />
            <AlertDescription>
              Data is {formatTimeAgo(new Date(data.created_at * 1000).toISOString())} old. 
              {nextUpdate && ` Next update expected in ${formatTimeUntil(nextUpdate)}.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <ConfidenceGauge confidence={data.overall_confidence} />
          <TrendIndicator 
            type="BTC" 
            direction={data.btc_trend_direction}
            strength={data.btc_trend_strength}
          />
          <TrendIndicator 
            type="ALT" 
            direction={data.alt_trend_direction}
            strength={data.alt_trend_strength}
          />
          <TradePermissionCard permission={data.trade_permission} />
        </SimpleGrid>

        {/* Footer */}
        <Flex 
          justify="space-between" 
          align="center" 
          pt={4} 
          borderTop="1px solid" 
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <HStack spacing={3}>
            <Text fontSize="sm" color="gray.600">Market Regime:</Text>
            <Badge 
              colorScheme={data.market_regime === 'BTC_SEASON' ? 'orange' : 
                          data.market_regime === 'ALT_SEASON' ? 'purple' :
                          data.market_regime === 'TRANSITION' ? 'blue' : 'red'} 
              variant="outline"
            >
              {data.market_regime.replace('_', ' ')}
            </Badge>
          </HStack>
          
          <Box flex={1} mx={6}>
            {historicalData.length > 0 && (
              <MiniConfidenceChart data={historicalData} />
            )}
          </Box>
          
          <HStack spacing={2}>
            <Tooltip label="View detailed analysis">
              <IconButton
                aria-label="View details"
                icon={<FiInfo />}
                size="sm"
                variant="ghost"
                onClick={() => setIsDetailModalOpen(true)}
              />
            </Tooltip>
            <Tooltip label="Trigger manual scan">
              <IconButton
                aria-label="Manual scan"
                icon={<FiRefreshCw />}
                size="sm"
                variant="ghost"
                onClick={handleManualScan}
              />
            </Tooltip>
            <Tooltip label="Refresh data">
              <IconButton
                aria-label="Refresh"
                icon={<FiRefreshCw />}
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                isLoading={isRefreshing}
              />
            </Tooltip>
          </HStack>
        </Flex>
      </VStack>

      {/* Detailed Analysis Modal */}
      {data && (
        <DetailedAnalysisModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          data={data}
        />
      )}
    </Box>
  );
};

export default MacroSentimentPanel;