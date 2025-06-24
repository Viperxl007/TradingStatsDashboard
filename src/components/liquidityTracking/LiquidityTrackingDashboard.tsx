import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Button,
  useColorModeValue,
  Container,
  Heading,
  Text,
  Alert,
  AlertIcon,
  Spinner,
  useToast
} from '@chakra-ui/react';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';
import { CLPosition, CLPortfolioSummary, CLFilterOptions, CLAlert } from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

// Import existing components
import PortfolioSummary from './PortfolioSummary';
import PositionsList from './PositionsList';
import AnalyticsPanel from './AnalyticsPanel';
import AlertsPanel from './AlertsPanel';
import AddPositionModal from './AddPositionModal';

// Import our new advanced components
import AdvancedAnalytics from './AdvancedAnalytics';
import RiskManagement from './RiskManagement';

const LiquidityTrackingDashboard: React.FC = () => {
  const [positions, setPositions] = useState<CLPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<CLPosition | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<CLPortfolioSummary | null>(null);
  const [alerts, setAlerts] = useState<CLAlert[]>([]);
  const [filters, setFilters] = useState<CLFilterOptions>({
    status: 'all',
    fee_tiers: [],
    tokens: [],
    date_range: [null, null],
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0);

  const toast = useToast();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBgColor = useColorModeValue('white', 'gray.800');

  // Mock user ID - in a real app, this would come from authentication
  const userId = 'user123';

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Load positions and portfolio summary
      const [positionsResponse, summaryResponse] = await Promise.all([
        liquidityTrackingService.positions.getPositions(userId),
        liquidityTrackingService.analytics.getPortfolioSummary(userId)
      ]);

      if (positionsResponse.success && positionsResponse.data) {
        // Ensure data is an array
        const positionsData = Array.isArray(positionsResponse.data) ? positionsResponse.data : [];
        setPositions(positionsData);
        // Select first position if available
        if (positionsData.length > 0 && !selectedPosition) {
          setSelectedPosition(positionsData[0]);
        }
      } else {
        // Set empty array on error to prevent iteration issues
        setPositions([]);
        throw new Error(positionsResponse.error || 'Failed to load positions');
      }

      if (summaryResponse.success && summaryResponse.data) {
        setPortfolioSummary(summaryResponse.data);
      } else {
        console.warn('Portfolio summary not available:', summaryResponse.error);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      toast({
        title: 'Error Loading Data',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = (): void => {
    loadDashboardData();
  };

  const handleAddPosition = (): void => {
    setIsAddModalOpen(true);
  };

  const handlePositionSelect = (position: CLPosition): void => {
    setSelectedPosition(position);
  };

  const handlePositionCreated = (newPosition: CLPosition): void => {
    setPositions(prev => {
      // Ensure prev is an array
      const currentPositions = Array.isArray(prev) ? prev : [];
      return [...currentPositions, newPosition];
    });
    setSelectedPosition(newPosition);
    setIsAddModalOpen(false);
    
    // Refresh portfolio summary
    loadDashboardData();
    
    toast({
      title: 'Position Added',
      description: 'New liquidity position has been added successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handlePositionDelete = async (positionId: string): Promise<void> => {
    try {
      const response = await liquidityTrackingService.positions.deletePosition(positionId);
      if (response.success) {
        setPositions(prev => {
          // Ensure prev is an array
          const currentPositions = Array.isArray(prev) ? prev : [];
          return currentPositions.filter(p => p.id !== positionId);
        });
        if (selectedPosition?.id === positionId) {
          setSelectedPosition(null);
        }
        toast({
          title: 'Position Deleted',
          description: 'Position has been deleted successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Failed to delete position');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete position';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleFiltersChange = (newFilters: Partial<CLFilterOptions>): void => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleAlertAcknowledge = async (alertId: string): Promise<void> => {
    try {
      const response = await liquidityTrackingService.alerts.acknowledgeAlert(alertId);
      if (response.success) {
        setAlerts(prev => prev.map(alert =>
          alert.id === alertId ? { ...alert, is_active: false } : alert
        ));
        toast({
          title: 'Alert Acknowledged',
          description: 'Alert has been acknowledged',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Failed to acknowledge alert');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleTabChange = (index: number): void => {
    setActiveTab(index);
  };

  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8}>
          <VStack spacing={4}>
            <Spinner size="xl" />
            <Text color="gray.500">Loading liquidity tracking dashboard...</Text>
          </VStack>
        </VStack>
      </Container>
    );
  }

  return (
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Heading size="xl">Concentrated Liquidity Tracking</Heading>
              <Text color="gray.600">
                Monitor and optimize your DeFi liquidity positions
              </Text>
            </VStack>
            <HStack spacing={3}>
              <Button
                leftIcon={<FiPlus />}
                colorScheme="blue"
                onClick={handleAddPosition}
              >
                Add Position
              </Button>
              <Button
                leftIcon={<FiRefreshCw />}
                variant="outline"
                onClick={handleRefresh}
                isLoading={isLoading}
              >
                Refresh
              </Button>
            </HStack>
          </HStack>

          {/* Error Alert */}
          {error && (
            <Alert status="error">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold">Error Loading Data</Text>
                <Text fontSize="sm">{error}</Text>
              </Box>
            </Alert>
          )}

          {/* Portfolio Summary */}
          <PortfolioSummary 
            summary={portfolioSummary} 
            isLoading={isLoading} 
          />

          {/* Main Content Tabs */}
          <Box bg={cardBgColor} borderRadius="lg" shadow="sm">
            <Tabs index={activeTab} onChange={handleTabChange} variant="enclosed">
              <TabList>
                <Tab>Positions</Tab>
                <Tab>Analytics</Tab>
                <Tab>Advanced Analytics</Tab>
                <Tab>Risk Management</Tab>
                <Tab>Alerts</Tab>
              </TabList>

              <TabPanels>
                {/* Positions Tab */}
                <TabPanel>
                  <PositionsList
                    positions={positions}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onPositionSelect={handlePositionSelect}
                    onPositionDelete={handlePositionDelete}
                    isLoading={isLoading}
                  />
                </TabPanel>

                {/* Basic Analytics Tab */}
                <TabPanel>
                  <AnalyticsPanel
                    positions={positions}
                    portfolioSummary={portfolioSummary}
                  />
                </TabPanel>

                {/* Advanced Analytics Tab */}
                <TabPanel>
                  <AdvancedAnalytics
                    positions={positions}
                    selectedPosition={selectedPosition}
                    onPositionSelect={handlePositionSelect}
                  />
                </TabPanel>

                {/* Risk Management Tab */}
                <TabPanel>
                  <RiskManagement
                    positions={positions}
                    selectedPosition={selectedPosition}
                    onPositionSelect={handlePositionSelect}
                  />
                </TabPanel>

                {/* Alerts Tab */}
                <TabPanel>
                  <AlertsPanel
                    alerts={alerts}
                    onAlertAcknowledge={handleAlertAcknowledge}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>

          {/* Empty State */}
          {positions.length === 0 && !isLoading && (
            <Box
              bg={cardBgColor}
              borderRadius="lg"
              p={12}
              textAlign="center"
              borderWidth="2px"
              borderStyle="dashed"
              borderColor="gray.300"
            >
              <VStack spacing={4}>
                <Heading size="md" color="gray.500">
                  No Liquidity Positions
                </Heading>
                <Text color="gray.400" maxW="md">
                  Start tracking your concentrated liquidity positions by adding your first position.
                  Monitor performance, fees, and impermanent loss in real-time.
                </Text>
                <Button
                  leftIcon={<FiPlus />}
                  colorScheme="blue"
                  size="lg"
                  onClick={handleAddPosition}
                >
                  Add Your First Position
                </Button>
              </VStack>
            </Box>
          )}
        </VStack>
      </Container>

      {/* Add Position Modal */}
      <AddPositionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPositionCreated={handlePositionCreated}
        userId={userId}
      />
    </Box>
  );
};

export default LiquidityTrackingDashboard;