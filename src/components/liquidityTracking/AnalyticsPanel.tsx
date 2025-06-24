import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Badge,
  Grid,
  GridItem,
  Icon,
  useColorMode,
  Alert,
  AlertIcon,
  AlertDescription
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiDollarSign,
  FiPercent,
  FiActivity
} from 'react-icons/fi';
import {
  CLPosition,
  CLPortfolioSummary
} from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface AnalyticsPanelProps {
  positions: CLPosition[];
  portfolioSummary: CLPortfolioSummary | null;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  positions,
  portfolioSummary
}) => {
  const { colorMode } = useColorMode();

  // Calculate additional analytics
  const safePositions = Array.isArray(positions) ? positions : [];
  const activePositions = safePositions.filter(p => p.status === 'active');
  const inRangePositions = activePositions.filter(p => p.is_in_range);
  const outOfRangePositions = activePositions.filter(p => !p.is_in_range);
  
  const profitablePositions = safePositions.filter(p => p.total_return > 0);
  const losingPositions = safePositions.filter(p => p.total_return < 0);
  
  const averageHealthScore = safePositions.length > 0
    ? safePositions.reduce((sum, p) => sum + liquidityTrackingService.utils.calculateHealthScore(p), 0) / safePositions.length
    : 0;

  const totalFeesEarned = safePositions.reduce((sum, p) => sum + p.fees_earned_usd, 0);
  const totalImpermanentLoss = safePositions.reduce((sum, p) => sum + Math.abs(p.impermanent_loss), 0);

  // Fee tier distribution
  const feeTierDistribution = safePositions.reduce((acc, position) => {
    const tier = position.fee_tier;
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const getHealthColor = (score: number) => {
    if (score >= 70) return 'green';
    if (score >= 40) return 'yellow';
    return 'red';
  };

  const getReturnColor = (value: number) => {
    if (value > 0) return 'green.500';
    if (value < 0) return 'red.500';
    return 'gray.500';
  };

  if (positions.length === 0) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Heading size="md">Analytics</Heading>
            <Alert status="info">
              <AlertIcon />
              <AlertDescription>
                Add positions to see detailed analytics and insights.
              </AlertDescription>
            </Alert>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Portfolio Health */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="center">
              <Heading size="sm">Portfolio Health</Heading>
              <Badge colorScheme={getHealthColor(averageHealthScore)} variant="solid">
                {Math.round(averageHealthScore)}/100
              </Badge>
            </HStack>
            
            <Progress
              value={averageHealthScore}
              colorScheme={getHealthColor(averageHealthScore)}
              size="md"
              borderRadius="full"
            />

            <Grid templateColumns="1fr 1fr" gap={3} fontSize="sm">
              <VStack align="flex-start" spacing={1}>
                <Text color="gray.500">Active Positions</Text>
                <Text fontWeight="bold">{activePositions.length}</Text>
              </VStack>
              
              <VStack align="flex-start" spacing={1}>
                <Text color="gray.500">In Range</Text>
                <Text fontWeight="bold" color="green.500">
                  {inRangePositions.length}
                </Text>
              </VStack>
            </Grid>
          </VStack>
        </CardBody>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Heading size="sm">Performance</Heading>
            
            <VStack spacing={3} align="stretch">
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Icon as={FiTrendingUp} color="green.500" />
                  <Text fontSize="sm">Profitable</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="bold" color="green.500">
                  {profitablePositions.length}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Icon as={FiTrendingDown} color="red.500" />
                  <Text fontSize="sm">Losing</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="bold" color="red.500">
                  {losingPositions.length}
                </Text>
              </HStack>

              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Icon as={FiTarget} color="orange.500" />
                  <Text fontSize="sm">Out of Range</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="bold" color="orange.500">
                  {outOfRangePositions.length}
                </Text>
              </HStack>
            </VStack>

            {positions.length > 0 && (
              <Box pt={2} borderTop="1px solid" borderTopColor="gray.200">
                <Text fontSize="xs" color="gray.500" textAlign="center">
                  Win Rate: {((profitablePositions.length / positions.length) * 100).toFixed(1)}%
                </Text>
              </Box>
            )}
          </VStack>
        </CardBody>
      </Card>

      {/* Fee Analysis */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Heading size="sm">Fee Analysis</Heading>
            
            <Stat>
              <StatLabel fontSize="xs">Total Fees Earned</StatLabel>
              <StatNumber fontSize="md" color="green.500">
                {liquidityTrackingService.utils.formatCurrency(totalFeesEarned)}
              </StatNumber>
              <StatHelpText fontSize="xs">
                Across all positions
              </StatHelpText>
            </Stat>

            <VStack spacing={2} align="stretch">
              <Text fontSize="xs" fontWeight="medium" color="gray.500">
                Fee Tier Distribution
              </Text>
              {Object.entries(feeTierDistribution).map(([tier, count]) => (
                <HStack key={tier} justify="space-between">
                  <Text fontSize="xs">
                    {(parseInt(tier) / 10000).toFixed(2)}%
                  </Text>
                  <Badge variant="outline" size="sm">
                    {count}
                  </Badge>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Risk Metrics */}
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Heading size="sm">Risk Metrics</Heading>
            
            <Stat>
              <StatLabel fontSize="xs">Total IL</StatLabel>
              <StatNumber fontSize="md" color="red.500">
                {liquidityTrackingService.utils.formatCurrency(totalImpermanentLoss)}
              </StatNumber>
              <StatHelpText fontSize="xs">
                Impermanent Loss
              </StatHelpText>
            </Stat>

            <VStack spacing={2} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">Positions at Risk</Text>
                <Text fontSize="xs" fontWeight="bold" color="orange.500">
                  {safePositions.filter(p => p.impermanent_loss_percentage < -5).length}
                </Text>
              </HStack>
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">High IL ({'>'}10%)</Text>
                <Text fontSize="xs" fontWeight="bold" color="red.500">
                  {safePositions.filter(p => p.impermanent_loss_percentage < -10).length}
                </Text>
              </HStack>
            </VStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Quick Insights */}
      <Card>
        <CardBody>
          <VStack spacing={3} align="stretch">
            <Heading size="sm">Quick Insights</Heading>
            
            <VStack spacing={2} align="stretch" fontSize="xs">
              {averageHealthScore < 50 && (
                <Alert status="warning" size="sm">
                  <AlertIcon boxSize={3} />
                  <Text>Portfolio health is below average. Consider rebalancing.</Text>
                </Alert>
              )}
              
              {outOfRangePositions.length > inRangePositions.length && (
                <Alert status="info" size="sm">
                  <AlertIcon boxSize={3} />
                  <Text>More positions are out of range than in range.</Text>
                </Alert>
              )}
              
              {totalImpermanentLoss > totalFeesEarned && (
                <Alert status="error" size="sm">
                  <AlertIcon boxSize={3} />
                  <Text>Impermanent loss exceeds fees earned.</Text>
                </Alert>
              )}
              
              {profitablePositions.length === 0 && positions.length > 0 && (
                <Alert status="warning" size="sm">
                  <AlertIcon boxSize={3} />
                  <Text>No profitable positions currently.</Text>
                </Alert>
              )}
            </VStack>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default AnalyticsPanel;