import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Box,
  Grid,
  GridItem,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardBody,
  Heading,
  Progress,
  Icon,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  Flex,
  Divider
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiAlertTriangle,
  FiDollarSign,
  FiRefreshCw,
  FiExternalLink
} from 'react-icons/fi';
import PriceRangeChart from './PriceRangeChart';
import PerformanceChart from './PerformanceChart';
import {
  CLPosition,
  CLPriceHistory,
  CLFeeHistory,
  CLAnalytics
} from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface PositionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: CLPosition;
  onPositionUpdated: (position: CLPosition) => void;
}

const PositionDetailsModal: React.FC<PositionDetailsModalProps> = ({
  isOpen,
  onClose,
  position,
  onPositionUpdated
}) => {
  const toast = useToast();
  
  const [priceHistory, setPriceHistory] = useState<CLPriceHistory[]>([]);
  const [feeHistory, setFeeHistory] = useState<CLFeeHistory[]>([]);
  const [analytics, setAnalytics] = useState<CLAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load position details when modal opens
  useEffect(() => {
    if (isOpen && position) {
      loadPositionDetails();
    }
  }, [isOpen, position.id]);

  const loadPositionDetails = async () => {
    setIsLoading(true);
    
    try {
      const [priceResponse, feeResponse, analyticsResponse] = await Promise.all([
        liquidityTrackingService.priceHistory.getPriceHistory(position.id),
        liquidityTrackingService.feeHistory.getFeeHistory(position.id),
        liquidityTrackingService.analytics.getPositionAnalytics(position.id)
      ]);

      if (priceResponse.success && priceResponse.data) {
        setPriceHistory(priceResponse.data);
      }

      if (feeResponse.success && feeResponse.data) {
        setFeeHistory(feeResponse.data);
      }

      if (analyticsResponse.success && analyticsResponse.data) {
        setAnalytics(analyticsResponse.data);
      }

    } catch (error) {
      console.error('Failed to load position details:', error);
      toast({
        title: 'Error Loading Details',
        description: 'Failed to load position details',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Update position with current prices
      const updateResponse = await liquidityTrackingService.priceHistory.updatePositionPrices(position.id);
      
      if (updateResponse.success && updateResponse.data) {
        onPositionUpdated(updateResponse.data);
      }

      // Reload all details
      await loadPositionDetails();

      toast({
        title: 'Position Updated',
        description: 'Position data has been refreshed with current market prices',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh position data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string, isInRange: boolean) => {
    if (status === 'closed') return 'gray';
    if (!isInRange) return 'orange';
    return 'green';
  };

  const getStatusText = (status: string, isInRange: boolean) => {
    if (status === 'closed') return 'Closed';
    if (!isInRange) return 'Out of Range';
    return 'Active';
  };

  const getReturnColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'gray.500';
  };

  const getReturnIcon = (value: number) => {
    if (value > 0) return FiTrendingUp;
    if (value < 0) return FiTrendingDown;
    return FiDollarSign;
  };

  const healthScore = liquidityTrackingService.utils.calculateHealthScore(position);
  const healthColor = healthScore >= 70 ? 'green' : healthScore >= 40 ? 'yellow' : 'red';

  const timeInRange = liquidityTrackingService.utils.calculateTimeInRange(priceHistory);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="1200px" maxH="90vh">
        <ModalHeader>
          <HStack justify="space-between" align="center">
            <VStack align="flex-start" spacing={1}>
              <HStack spacing={3}>
                <Text fontSize="xl" fontWeight="bold">
                  {position.token0_symbol}/{position.token1_symbol}
                </Text>
                <Badge colorScheme={getStatusColor(position.status, position.is_in_range)}>
                  {getStatusText(position.status, position.is_in_range)}
                </Badge>
                <Badge variant="outline">
                  {(position.fee_tier / 10000).toFixed(2)}% Fee
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.500">
                Position ID: {position.id.slice(0, 8)}...
              </Text>
            </VStack>
            
            <HStack spacing={2}>
              <Button
                leftIcon={<Icon as={FiRefreshCw} />}
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                isLoading={isRefreshing}
                loadingText="Refreshing"
              >
                Refresh
              </Button>
              <Button
                leftIcon={<Icon as={FiExternalLink} />}
                size="sm"
                variant="outline"
              >
                View on Explorer
              </Button>
            </HStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody overflow="auto">
          {isLoading ? (
            <Flex justify="center" align="center" h="400px">
              <VStack spacing={4}>
                <Spinner size="xl" color="brand.500" />
                <Text>Loading position details...</Text>
              </VStack>
            </Flex>
          ) : (
            <VStack spacing={6} align="stretch">
              {/* Key Metrics Overview */}
              <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                <Stat>
                  <StatLabel>Current Value</StatLabel>
                  <StatNumber color="brand.500">
                    {liquidityTrackingService.utils.formatCurrency(position.current_usd_value)}
                  </StatNumber>
                  <StatHelpText>
                    Initial: {liquidityTrackingService.utils.formatCurrency(position.initial_usd_value)}
                  </StatHelpText>
                </Stat>

                <Stat>
                  <StatLabel>Total Return</StatLabel>
                  <StatNumber color={getReturnColor(position.total_return)}>
                    <HStack spacing={2}>
                      <Icon as={getReturnIcon(position.total_return)} />
                      <Text>{liquidityTrackingService.utils.formatCurrency(position.total_return)}</Text>
                    </HStack>
                  </StatNumber>
                  <StatHelpText>
                    <StatArrow type={position.total_return_percentage >= 0 ? 'increase' : 'decrease'} />
                    {liquidityTrackingService.utils.formatPercentage(position.total_return_percentage)}
                  </StatHelpText>
                </Stat>

                <Stat>
                  <StatLabel>Fees Earned</StatLabel>
                  <StatNumber color="green.500">
                    {liquidityTrackingService.utils.formatCurrency(position.fees_earned_usd)}
                  </StatNumber>
                  <StatHelpText>
                    From liquidity provision
                  </StatHelpText>
                </Stat>

                <Stat>
                  <StatLabel>Impermanent Loss</StatLabel>
                  <StatNumber color={position.impermanent_loss < 0 ? 'red.500' : 'gray.500'}>
                    {liquidityTrackingService.utils.formatPercentage(position.impermanent_loss_percentage)}
                  </StatNumber>
                  <StatHelpText>
                    {liquidityTrackingService.utils.formatCurrency(Math.abs(position.impermanent_loss))}
                  </StatHelpText>
                </Stat>
              </Grid>

              {/* Range Status */}
              <Card>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                      <Heading size="md">Price Range Status</Heading>
                      <HStack spacing={2}>
                        <Icon 
                          as={position.is_in_range ? FiTarget : FiAlertTriangle} 
                          color={position.is_in_range ? 'green.500' : 'orange.500'}
                        />
                        <Text color={position.is_in_range ? 'green.500' : 'orange.500'}>
                          {position.is_in_range ? 'In Range' : 'Out of Range'}
                        </Text>
                      </HStack>
                    </HStack>

                    <Grid templateColumns="1fr 1fr 1fr" gap={4}>
                      <VStack>
                        <Text fontSize="sm" color="gray.500">Lower Price</Text>
                        <Text fontWeight="bold">
                          {liquidityTrackingService.utils.formatCurrency(position.price_lower, 4)}
                        </Text>
                      </VStack>
                      <VStack>
                        <Text fontSize="sm" color="gray.500">Current Price</Text>
                        <Text fontWeight="bold" color="brand.500">
                          {liquidityTrackingService.utils.formatCurrency(
                            position.current_usd_value / (position.token0_amount + position.token1_amount), 4
                          )}
                        </Text>
                      </VStack>
                      <VStack>
                        <Text fontSize="sm" color="gray.500">Upper Price</Text>
                        <Text fontWeight="bold">
                          {liquidityTrackingService.utils.formatCurrency(position.price_upper, 4)}
                        </Text>
                      </VStack>
                    </Grid>

                    <Box>
                      <HStack justify="space-between" mb={2}>
                        <Text fontSize="sm">Time in Range</Text>
                        <Text fontSize="sm" fontWeight="bold">
                          {timeInRange.toFixed(1)}%
                        </Text>
                      </HStack>
                      <Progress
                        value={timeInRange}
                        colorScheme={timeInRange >= 70 ? 'green' : timeInRange >= 40 ? 'yellow' : 'red'}
                        size="sm"
                        borderRadius="full"
                      />
                    </Box>
                  </VStack>
                </CardBody>
              </Card>

              {/* Position Health */}
              <Card>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                      <Heading size="md">Position Health</Heading>
                      <Badge colorScheme={healthColor} variant="solid">
                        {Math.round(healthScore)}/100
                      </Badge>
                    </HStack>
                    
                    <Progress
                      value={healthScore}
                      colorScheme={healthColor}
                      size="lg"
                      borderRadius="full"
                    />

                    <Grid templateColumns="1fr 1fr" gap={4}>
                      <VStack align="flex-start">
                        <Text fontSize="sm" color="gray.500">Token Composition</Text>
                        <VStack align="flex-start" spacing={1}>
                          <Text fontSize="sm">
                            {position.token0_symbol}: {position.token0_amount.toFixed(4)}
                          </Text>
                          <Text fontSize="sm">
                            {position.token1_symbol}: {position.token1_amount.toFixed(4)}
                          </Text>
                        </VStack>
                      </VStack>
                      
                      <VStack align="flex-start">
                        <Text fontSize="sm" color="gray.500">Performance Metrics</Text>
                        <VStack align="flex-start" spacing={1}>
                          <Text fontSize="sm">
                            ROI: {liquidityTrackingService.utils.formatPercentage(position.total_return_percentage)}
                          </Text>
                          <Text fontSize="sm">
                            Fee APY: {analytics?.performance_metrics.fees_apy 
                              ? liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.fees_apy)
                              : 'N/A'
                            }
                          </Text>
                        </VStack>
                      </VStack>
                    </Grid>
                  </VStack>
                </CardBody>
              </Card>

              {/* Charts and Analytics */}
              <Tabs variant="line" colorScheme="brand">
                <TabList>
                  <Tab>Price Range</Tab>
                  <Tab>Performance</Tab>
                  <Tab>Fee History</Tab>
                  <Tab>Analytics</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel px={0}>
                    <PriceRangeChart
                      position={position}
                      priceHistory={priceHistory}
                    />
                  </TabPanel>

                  <TabPanel px={0}>
                    <PerformanceChart
                      position={position}
                      priceHistory={priceHistory}
                      analytics={analytics}
                    />
                  </TabPanel>

                  <TabPanel px={0}>
                    <Card>
                      <CardBody>
                        <VStack spacing={4} align="stretch">
                          <Heading size="md">Fee Collection History</Heading>
                          
                          {feeHistory.length === 0 ? (
                            <Alert status="info">
                              <AlertIcon />
                              <AlertDescription>
                                No fee collection history available yet.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <VStack spacing={3} align="stretch">
                              {feeHistory.slice(0, 10).map((fee, index) => (
                                <Box
                                  key={fee.id}
                                  p={3}
                                  borderRadius="md"
                                  bg="gray.50"
                                  _dark={{ bg: 'gray.700' }}
                                >
                                  <HStack justify="space-between">
                                    <VStack align="flex-start" spacing={1}>
                                      <Text fontSize="sm" fontWeight="medium">
                                        {liquidityTrackingService.utils.formatCurrency(fee.usd_value)}
                                      </Text>
                                      <Text fontSize="xs" color="gray.500">
                                        {new Date(fee.timestamp).toLocaleString()}
                                      </Text>
                                    </VStack>
                                    <VStack align="flex-end" spacing={1}>
                                      <Text fontSize="xs">
                                        {position.token0_symbol}: {fee.token0_fees.toFixed(6)}
                                      </Text>
                                      <Text fontSize="xs">
                                        {position.token1_symbol}: {fee.token1_fees.toFixed(6)}
                                      </Text>
                                    </VStack>
                                  </HStack>
                                </Box>
                              ))}
                            </VStack>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  </TabPanel>

                  <TabPanel px={0}>
                    <Card>
                      <CardBody>
                        <VStack spacing={6} align="stretch">
                          <Heading size="md">Advanced Analytics</Heading>
                          
                          {analytics ? (
                            <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={4}>
                              <Stat>
                                <StatLabel>Annualized Return</StatLabel>
                                <StatNumber color={getReturnColor(analytics.performance_metrics.annualized_return)}>
                                  {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.annualized_return)}
                                </StatNumber>
                              </Stat>

                              <Stat>
                                <StatLabel>Sharpe Ratio</StatLabel>
                                <StatNumber>
                                  {analytics.performance_metrics.sharpe_ratio.toFixed(2)}
                                </StatNumber>
                              </Stat>

                              <Stat>
                                <StatLabel>Max Drawdown</StatLabel>
                                <StatNumber color="red.500">
                                  {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.max_drawdown)}
                                </StatNumber>
                              </Stat>

                              <Stat>
                                <StatLabel>Volatility</StatLabel>
                                <StatNumber>
                                  {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.volatility)}
                                </StatNumber>
                              </Stat>

                              <Stat>
                                <StatLabel>Range Utilization</StatLabel>
                                <StatNumber color="blue.500">
                                  {liquidityTrackingService.utils.formatPercentage(analytics.range_efficiency.range_utilization)}
                                </StatNumber>
                              </Stat>

                              <Stat>
                                <StatLabel>IL Impact</StatLabel>
                                <StatNumber color="orange.500">
                                  {liquidityTrackingService.utils.formatPercentage(analytics.performance_metrics.il_impact)}
                                </StatNumber>
                              </Stat>
                            </Grid>
                          ) : (
                            <Alert status="info">
                              <AlertIcon />
                              <AlertDescription>
                                Analytics data is being calculated. Please check back later.
                              </AlertDescription>
                            </Alert>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PositionDetailsModal;