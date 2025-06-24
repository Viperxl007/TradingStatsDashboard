import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Card,
  CardBody,
  Heading,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Flex,
  Icon,
  useToast
} from '@chakra-ui/react';
import { FiRefreshCw, FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { CLPosition, CLPriceHistory } from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';
import { useRealTimePrices } from '../../hooks/useRealTimePrices';
import PriceRangeChart from './PriceRangeChart';
import PositionCard from './PositionCard';

interface EnhancedPositionViewProps {
  position: CLPosition;
  priceHistory?: CLPriceHistory[];
}

const EnhancedPositionView: React.FC<EnhancedPositionViewProps> = ({
  position,
  priceHistory = []
}) => {
  const toast = useToast();
  const [enrichedPosition, setEnrichedPosition] = useState<CLPosition>(position);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { 
    fetchPrice, 
    isLoading: isPriceLoading, 
    getError: getPriceError, 
    getData: getPriceData 
  } = useRealTimePrices();

  const currentPriceData = getPriceData(position.id);
  const priceError = getPriceError(position.id);
  const isLoadingPrice = isPriceLoading(position.id);

  // Fetch enriched position data with real-time prices
  const fetchEnrichedPosition = async () => {
    setIsRefreshing(true);
    try {
      const response = await liquidityTrackingService.priceHistory.getPositionWithCurrentPrice(position.id);
      
      if (response.success && response.data) {
        setEnrichedPosition(response.data);
        
        if (response.data.priceData) {
          toast({
            title: 'Price Updated',
            description: 'Real-time price data loaded successfully',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        }
      } else {
        toast({
          title: 'Update Failed',
          description: response.error || 'Failed to fetch real-time data',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error fetching enriched position:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch position data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    await Promise.all([
      fetchPrice(position.id),
      fetchEnrichedPosition()
    ]);
  };

  // Initial load
  useEffect(() => {
    if (position.token0_address && position.token1_address) {
      fetchPrice(position.id);
      fetchEnrichedPosition();
    }
  }, [position.id, position.token0_address, position.token1_address]);

  // Calculate P&L information
  const getPnlInfo = () => {
    if (currentPriceData?.position_value) {
      const pnl = currentPriceData.position_value.pnl || 0;
      const pnlPercentage = currentPriceData.position_value.pnl_percentage || 0;
      return { pnl, pnlPercentage, isRealTime: true };
    }
    return { 
      pnl: enrichedPosition.total_return, 
      pnlPercentage: enrichedPosition.total_return_percentage,
      isRealTime: false 
    };
  };

  const pnlInfo = getPnlInfo();

  return (
    <VStack spacing={6} align="stretch">
      {/* Header with Refresh Button */}
      <Flex justify="space-between" align="center">
        <Heading size="lg">
          {enrichedPosition.token0_symbol}/{enrichedPosition.token1_symbol} Position
        </Heading>
        
        <HStack spacing={2}>
          {(enrichedPosition.token0_address && enrichedPosition.token1_address) ? (
            <Badge colorScheme="green" variant="subtle">
              Real-time Enabled
            </Badge>
          ) : (
            <Badge colorScheme="orange" variant="subtle">
              Token Addresses Missing
            </Badge>
          )}
          
          <Button
            leftIcon={<FiRefreshCw />}
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            isLoading={isRefreshing || isLoadingPrice}
            loadingText="Updating..."
          >
            Refresh Prices
          </Button>
        </HStack>
      </Flex>

      {/* Error Alert */}
      {priceError && (
        <Alert status="warning">
          <AlertIcon />
          <VStack align="flex-start" spacing={1}>
            <Text fontWeight="medium">Price Data Error</Text>
            <Text fontSize="sm">{priceError}</Text>
          </VStack>
        </Alert>
      )}

      {/* Real-time P&L Summary */}
      {currentPriceData && (
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <Heading size="md">Real-time Performance</Heading>
              
              <HStack spacing={8} justify="center">
                <VStack spacing={1}>
                  <Text fontSize="sm" color="gray.500">Current USD Value</Text>
                  <Text fontSize="xl" fontWeight="bold" color="brand.500">
                    {liquidityTrackingService.utils.formatCurrency(
                      currentPriceData.position_value?.current_usd_value || enrichedPosition.current_usd_value
                    )}
                  </Text>
                  {pnlInfo.isRealTime && (
                    <Badge colorScheme="green" size="sm">Live</Badge>
                  )}
                </VStack>

                <VStack spacing={1}>
                  <Text fontSize="sm" color="gray.500">P&L</Text>
                  <HStack spacing={1}>
                    <Icon 
                      as={pnlInfo.pnl >= 0 ? FiTrendingUp : FiTrendingDown} 
                      color={pnlInfo.pnl >= 0 ? 'green.500' : 'red.500'}
                    />
                    <Text 
                      fontSize="xl" 
                      fontWeight="bold" 
                      color={pnlInfo.pnl >= 0 ? 'green.500' : 'red.500'}
                    >
                      {liquidityTrackingService.utils.formatCurrency(pnlInfo.pnl)}
                    </Text>
                  </HStack>
                  <Text 
                    fontSize="sm" 
                    color={pnlInfo.pnl >= 0 ? 'green.500' : 'red.500'}
                  >
                    {liquidityTrackingService.utils.formatPercentage(pnlInfo.pnlPercentage)}
                  </Text>
                </VStack>

                <VStack spacing={1}>
                  <Text fontSize="sm" color="gray.500">Initial Investment</Text>
                  <Text fontSize="xl" fontWeight="bold">
                    {liquidityTrackingService.utils.formatCurrency(enrichedPosition.initial_usd_value)}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Enhanced Position Card */}
      <PositionCard
        position={enrichedPosition}
        onClick={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        currentPriceData={currentPriceData}
        isLoadingPrice={isLoadingPrice}
        priceError={priceError}
      />

      {/* Price Range Chart */}
      <PriceRangeChart
        position={enrichedPosition}
        priceHistory={priceHistory}
        currentPriceData={currentPriceData}
        isLoadingPrice={isLoadingPrice}
        priceError={priceError}
      />

      {/* Token Price Details */}
      {currentPriceData?.token0 && currentPriceData?.token1 && (
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <Heading size="md">Token Price Details</Heading>
              
              <HStack spacing={8} justify="center">
                <VStack spacing={2}>
                  <Text fontWeight="medium">{enrichedPosition.token0_symbol}</Text>
                  <Text fontSize="lg" fontWeight="bold">
                    {liquidityTrackingService.utils.formatCurrency(
                      currentPriceData.token0.price_data?.price_usd || 0,
                      6
                    )}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    24h Vol: {liquidityTrackingService.utils.formatCurrency(
                      currentPriceData.token0.price_data?.volume_24h || 0
                    )}
                  </Text>
                </VStack>

                <VStack spacing={2}>
                  <Text fontWeight="medium">{enrichedPosition.token1_symbol}</Text>
                  <Text fontSize="lg" fontWeight="bold">
                    {liquidityTrackingService.utils.formatCurrency(
                      currentPriceData.token1.price_data?.price_usd || 0,
                      6
                    )}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    24h Vol: {liquidityTrackingService.utils.formatCurrency(
                      currentPriceData.token1.price_data?.volume_24h || 0
                    )}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}

      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <Card>
          <CardBody>
            <VStack spacing={2} align="flex-start">
              <Heading size="sm">Debug Info</Heading>
              <Text fontSize="xs">Position ID: {enrichedPosition.id}</Text>
              <Text fontSize="xs">Token0 Address: {enrichedPosition.token0_address || 'Not set'}</Text>
              <Text fontSize="xs">Token1 Address: {enrichedPosition.token1_address || 'Not set'}</Text>
              <Text fontSize="xs">Has Price Data: {currentPriceData ? 'Yes' : 'No'}</Text>
              <Text fontSize="xs">Loading: {isLoadingPrice ? 'Yes' : 'No'}</Text>
              <Text fontSize="xs">Error: {priceError || 'None'}</Text>
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
};

export default EnhancedPositionView;