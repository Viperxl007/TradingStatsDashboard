import React from 'react';
import {
  Box,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Card,
  CardBody,
  Heading,
  Text,
  HStack,
  VStack,
  Badge,
  Icon,
  useColorMode,
  Skeleton
} from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiTarget, FiAlertCircle } from 'react-icons/fi';
import { CLPortfolioSummary } from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface PortfolioSummaryProps {
  summary: CLPortfolioSummary | null;
  isLoading: boolean;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ summary, isLoading }) => {
  const { colorMode } = useColorMode();

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Skeleton height="20px" />
            <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} height="80px" />
              ))}
            </Grid>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Text color="gray.500">No portfolio data available</Text>
            <Text fontSize="sm" color="gray.400">
              Add your first liquidity position to see portfolio metrics
            </Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

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

  return (
    <Card>
      <CardBody>
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <Heading size="md">Portfolio Overview</Heading>
            <HStack spacing={2}>
              <Badge colorScheme="blue" variant="subtle">
                {summary.active_positions} Active
              </Badge>
              {summary.active_alerts > 0 && (
                <Badge colorScheme="red" variant="subtle">
                  <HStack spacing={1}>
                    <Icon as={FiAlertCircle} boxSize={3} />
                    <Text>{summary.active_alerts} Alerts</Text>
                  </HStack>
                </Badge>
              )}
            </HStack>
          </HStack>

          {/* Main Metrics Grid */}
          <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
            {/* Total Value */}
            <GridItem>
              <Stat>
                <StatLabel>Total Portfolio Value</StatLabel>
                <StatNumber color="brand.500">
                  {liquidityTrackingService.utils.formatCurrency(summary.total_usd_value)}
                </StatNumber>
                <StatHelpText>
                  {summary.total_positions} position{summary.total_positions !== 1 ? 's' : ''}
                </StatHelpText>
              </Stat>
            </GridItem>

            {/* Total Return */}
            <GridItem>
              <Stat>
                <StatLabel>Total Return</StatLabel>
                <StatNumber color={getReturnColor(summary.total_return)}>
                  <HStack spacing={2}>
                    <Icon as={getReturnIcon(summary.total_return)} />
                    <Text>
                      {liquidityTrackingService.utils.formatCurrency(summary.total_return)}
                    </Text>
                  </HStack>
                </StatNumber>
                <StatHelpText>
                  <StatArrow type={summary.total_return_percentage >= 0 ? 'increase' : 'decrease'} />
                  {liquidityTrackingService.utils.formatPercentage(summary.total_return_percentage)}
                </StatHelpText>
              </Stat>
            </GridItem>

            {/* Fees Earned */}
            <GridItem>
              <Stat>
                <StatLabel>Total Fees Earned</StatLabel>
                <StatNumber color="green.500">
                  {liquidityTrackingService.utils.formatCurrency(summary.total_fees_earned)}
                </StatNumber>
                <StatHelpText>
                  From liquidity provision
                </StatHelpText>
              </Stat>
            </GridItem>

            {/* Impermanent Loss */}
            <GridItem>
              <Stat>
                <StatLabel>Impermanent Loss</StatLabel>
                <StatNumber color={summary.total_impermanent_loss < 0 ? 'red.500' : 'gray.500'}>
                  {liquidityTrackingService.utils.formatCurrency(Math.abs(summary.total_impermanent_loss))}
                </StatNumber>
                <StatHelpText>
                  {summary.total_impermanent_loss < 0 ? 'Loss' : 'No Loss'}
                </StatHelpText>
              </Stat>
            </GridItem>

            {/* Average Return */}
            <GridItem>
              <Stat>
                <StatLabel>Average Return</StatLabel>
                <StatNumber color={getReturnColor(summary.average_return_percentage)}>
                  {liquidityTrackingService.utils.formatPercentage(summary.average_return_percentage)}
                </StatNumber>
                <StatHelpText>
                  Per position
                </StatHelpText>
              </Stat>
            </GridItem>

            {/* Range Status */}
            <GridItem>
              <Stat>
                <StatLabel>In Range</StatLabel>
                <StatNumber>
                  <HStack spacing={2}>
                    <Icon as={FiTarget} color="green.500" />
                    <Text>
                      {summary.positions_in_range}/{summary.active_positions}
                    </Text>
                  </HStack>
                </StatNumber>
                <StatHelpText>
                  {summary.active_positions > 0 
                    ? `${Math.round((summary.positions_in_range / summary.active_positions) * 100)}% in range`
                    : 'No active positions'
                  }
                </StatHelpText>
              </Stat>
            </GridItem>
          </Grid>

          {/* Performance Highlights */}
          {(summary.best_performing_position || summary.worst_performing_position) && (
            <Box>
              <Heading size="sm" mb={3}>Performance Highlights</Heading>
              <Grid templateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={4}>
                {summary.best_performing_position && (
                  <Box
                    p={3}
                    borderRadius="md"
                    bg={colorMode === 'dark' ? 'green.900' : 'green.50'}
                    borderLeft="4px solid"
                    borderLeftColor="green.500"
                  >
                    <Text fontSize="sm" fontWeight="medium" color="green.600">
                      Best Performer
                    </Text>
                    <Text fontSize="lg" fontWeight="bold">
                      {summary.best_performing_position}
                    </Text>
                  </Box>
                )}
                
                {summary.worst_performing_position && (
                  <Box
                    p={3}
                    borderRadius="md"
                    bg={colorMode === 'dark' ? 'red.900' : 'red.50'}
                    borderLeft="4px solid"
                    borderLeftColor="red.500"
                  >
                    <Text fontSize="sm" fontWeight="medium" color="red.600">
                      Needs Attention
                    </Text>
                    <Text fontSize="lg" fontWeight="bold">
                      {summary.worst_performing_position}
                    </Text>
                  </Box>
                )}
              </Grid>
            </Box>
          )}

          {/* Quick Stats */}
          <HStack justify="space-between" pt={2} borderTop="1px solid" borderTopColor="gray.200">
            <VStack spacing={0} align="start">
              <Text fontSize="xs" color="gray.500">ACTIVE POSITIONS</Text>
              <Text fontSize="sm" fontWeight="medium">{summary.active_positions}</Text>
            </VStack>
            
            <VStack spacing={0} align="center">
              <Text fontSize="xs" color="gray.500">OUT OF RANGE</Text>
              <Text fontSize="sm" fontWeight="medium" color="orange.500">
                {summary.positions_out_of_range}
              </Text>
            </VStack>
            
            <VStack spacing={0} align="end">
              <Text fontSize="xs" color="gray.500">TOTAL ALERTS</Text>
              <Text fontSize="sm" fontWeight="medium" color={summary.active_alerts > 0 ? 'red.500' : 'gray.500'}>
                {summary.active_alerts}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PortfolioSummary;