import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Button,
  IconButton,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  Badge,
  Progress,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  FormControl,
  FormLabel,
  Input,
  Select,
  Switch,
  Divider,
  SimpleGrid,
  Tooltip,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer
} from '@chakra-ui/react';
import { 
  FiShield, 
  FiAlertTriangle, 
  FiSettings, 
  FiRefreshCw,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiEye,
  FiTrendingDown,
  FiActivity
} from 'react-icons/fi';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { CLPosition, CLAlert } from '../../types/liquidityTracking';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface RiskManagementProps {
  positions: CLPosition[];
  selectedPosition?: CLPosition | null;
  onPositionSelect?: (position: CLPosition) => void;
}

interface RiskMetrics {
  portfolio_var: number;
  portfolio_cvar: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  volatility: number;
  correlation_risk: number;
  concentration_risk: number;
  liquidity_risk: number;
}

interface RiskLimit {
  id: string;
  name: string;
  type: 'var' | 'drawdown' | 'concentration' | 'il' | 'custom';
  threshold: number;
  current_value: number;
  is_breached: boolean;
  severity: 'low' | 'medium' | 'high';
  is_active: boolean;
}

interface StressTestScenario {
  id: string;
  name: string;
  description: string;
  price_shock: number;
  volatility_shock: number;
  correlation_shock: number;
  expected_loss: number;
  probability: number;
}

const RiskManagement: React.FC<RiskManagementProps> = ({
  positions,
  selectedPosition,
  onPositionSelect
}) => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [riskLimits, setRiskLimits] = useState<RiskLimit[]>([]);
  const [alerts, setAlerts] = useState<CLAlert[]>([]);
  const [stressTestResults, setStressTestResults] = useState<StressTestScenario[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRiskLimit, setSelectedRiskLimit] = useState<RiskLimit | null>(null);

  const { isOpen: isLimitModalOpen, onOpen: onLimitModalOpen, onClose: onLimitModalClose } = useDisclosure();
  const { isOpen: isStressTestModalOpen, onOpen: onStressTestModalOpen, onClose: onStressTestModalClose } = useDisclosure();

  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  // Load risk management data
  useEffect(() => {
    loadRiskData();
  }, [positions]);

  const loadRiskData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API calls - replace with actual service calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock risk metrics
      const mockRiskMetrics: RiskMetrics = {
        portfolio_var: -8.45,
        portfolio_cvar: -12.67,
        sharpe_ratio: 1.85,
        sortino_ratio: 2.34,
        max_drawdown: -15.23,
        volatility: 18.90,
        correlation_risk: 0.65,
        concentration_risk: 0.78,
        liquidity_risk: 0.23
      };

      // Mock risk limits
      const mockRiskLimits: RiskLimit[] = [
        {
          id: '1',
          name: 'Portfolio VaR Limit',
          type: 'var',
          threshold: -10.0,
          current_value: -8.45,
          is_breached: false,
          severity: 'medium',
          is_active: true
        },
        {
          id: '2',
          name: 'Maximum Drawdown',
          type: 'drawdown',
          threshold: -20.0,
          current_value: -15.23,
          is_breached: false,
          severity: 'high',
          is_active: true
        },
        {
          id: '3',
          name: 'Concentration Risk',
          type: 'concentration',
          threshold: 0.80,
          current_value: 0.78,
          is_breached: false,
          severity: 'medium',
          is_active: true
        },
        {
          id: '4',
          name: 'IL Threshold',
          type: 'il',
          threshold: -5.0,
          current_value: -3.21,
          is_breached: false,
          severity: 'low',
          is_active: true
        }
      ];

      // Mock alerts
      const mockAlerts: CLAlert[] = [
        {
          id: '1',
          position_id: positions[0]?.id || '',
          alert_type: 'high_il',
          threshold_value: -5.0,
          is_active: true,
          triggered_at: '2024-01-15T10:30:00Z',
          message: 'Impermanent loss exceeds threshold',
          severity: 'medium'
        },
        {
          id: '2',
          position_id: positions[1]?.id || '',
          alert_type: 'range_breach',
          threshold_value: 0.95,
          is_active: true,
          message: 'Position approaching range boundary',
          severity: 'low'
        }
      ];

      // Mock stress test scenarios
      const mockStressTestResults: StressTestScenario[] = [
        {
          id: '1',
          name: 'Market Crash (-30%)',
          description: 'Severe market downturn with 30% price decline',
          price_shock: -30,
          volatility_shock: 50,
          correlation_shock: 20,
          expected_loss: -25.67,
          probability: 0.05
        },
        {
          id: '2',
          name: 'High Volatility',
          description: 'Increased market volatility without directional bias',
          price_shock: 0,
          volatility_shock: 100,
          correlation_shock: 30,
          expected_loss: -12.34,
          probability: 0.15
        },
        {
          id: '3',
          name: 'Correlation Breakdown',
          description: 'Asset correlations increase significantly',
          price_shock: -10,
          volatility_shock: 25,
          correlation_shock: 80,
          expected_loss: -18.90,
          probability: 0.10
        }
      ];

      setRiskMetrics(mockRiskMetrics);
      setRiskLimits(mockRiskLimits);
      setAlerts(mockAlerts);
      setStressTestResults(mockStressTestResults);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load risk data';
      setError(errorMessage);
      toast({
        title: 'Error',
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
    loadRiskData();
  };

  const handleCreateRiskLimit = (): void => {
    setSelectedRiskLimit(null);
    onLimitModalOpen();
  };

  const handleEditRiskLimit = (limit: RiskLimit): void => {
    setSelectedRiskLimit(limit);
    onLimitModalOpen();
  };

  const handleDeleteRiskLimit = (limitId: string): void => {
    setRiskLimits(prev => prev.filter(limit => limit.id !== limitId));
    toast({
      title: 'Risk Limit Deleted',
      description: 'Risk limit has been removed',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleToggleRiskLimit = (limitId: string): void => {
    setRiskLimits(prev => prev.map(limit => 
      limit.id === limitId ? { ...limit, is_active: !limit.is_active } : limit
    ));
  };

  const handleRunStressTest = (): void => {
    onStressTestModalOpen();
  };

  const createRiskDistributionChart = () => {
    if (!riskMetrics) return null;

    const data = {
      labels: ['Market Risk', 'Liquidity Risk', 'Concentration Risk', 'Correlation Risk'],
      datasets: [
        {
          data: [
            riskMetrics.volatility,
            riskMetrics.liquidity_risk * 100,
            riskMetrics.concentration_risk * 100,
            riskMetrics.correlation_risk * 100
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)'
          ],
          borderWidth: 1
        }
      ]
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom' as const,
        },
        title: {
          display: true,
          text: 'Risk Distribution'
        }
      }
    };

    return <Doughnut data={data} options={options} />;
  };

  const createVaRChart = () => {
    if (!riskMetrics) return null;

    // Mock historical VaR data
    const dates = [];
    const varValues = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
      varValues.push(riskMetrics.portfolio_var + (Math.random() - 0.5) * 2);
    }

    const data = {
      labels: dates,
      datasets: [
        {
          label: 'Portfolio VaR (%)',
          data: varValues,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.1
        }
      ]
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Value at Risk (95% Confidence)'
        }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    };

    return <Line data={data} options={options} />;
  };

  const getRiskLevelColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'green';
      case 'medium': return 'yellow';
      case 'high': return 'red';
      default: return 'gray';
    }
  };

  const getRiskLevelIcon = (severity: string) => {
    switch (severity) {
      case 'low': return <FiShield />;
      case 'medium': return <FiActivity />;
      case 'high': return <FiAlertTriangle />;
      default: return <FiShield />;
    }
  };

  if (isLoading) {
    return (
      <Card bg={bgColor} borderColor={borderColor}>
        <CardBody>
          <VStack spacing={4} py={8}>
            <Spinner size="xl" />
            <Text color={mutedColor}>Loading risk management data...</Text>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Box>
      <Card bg={bgColor} borderColor={borderColor} mb={6}>
        <CardHeader>
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Heading size="lg" color={textColor}>Risk Management</Heading>
              <Text color={mutedColor}>
                Portfolio risk monitoring and controls
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Button
                leftIcon={<FiPlus />}
                size="sm"
                onClick={handleCreateRiskLimit}
              >
                Add Limit
              </Button>
              <Button
                leftIcon={<FiActivity />}
                size="sm"
                onClick={handleRunStressTest}
              >
                Stress Test
              </Button>
              <IconButton
                aria-label="Refresh data"
                icon={<FiRefreshCw />}
                size="sm"
                onClick={handleRefresh}
                isLoading={isLoading}
              />
            </HStack>
          </HStack>
        </CardHeader>
      </Card>

      {error && (
        <Alert status="error" mb={6}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      <VStack spacing={6}>
        {/* Risk Overview */}
        {riskMetrics && (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} w="full">
            <Stat>
              <StatLabel>Portfolio VaR (95%)</StatLabel>
              <StatNumber color="red.500">{riskMetrics.portfolio_var.toFixed(2)}%</StatNumber>
              <StatHelpText>Daily risk estimate</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Sharpe Ratio</StatLabel>
              <StatNumber>{riskMetrics.sharpe_ratio.toFixed(2)}</StatNumber>
              <StatHelpText>Risk-adjusted return</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Max Drawdown</StatLabel>
              <StatNumber color="red.500">{riskMetrics.max_drawdown.toFixed(2)}%</StatNumber>
              <StatHelpText>Worst decline</StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Volatility</StatLabel>
              <StatNumber>{riskMetrics.volatility.toFixed(2)}%</StatNumber>
              <StatHelpText>Annualized</StatHelpText>
            </Stat>
          </SimpleGrid>
        )}

        {/* Risk Charts */}
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6} w="full">
          <Card bg={bgColor} borderColor={borderColor}>
            <CardHeader>
              <Heading size="md">Risk Distribution</Heading>
            </CardHeader>
            <CardBody>
              <Box h="300px">
                {createRiskDistributionChart()}
              </Box>
            </CardBody>
          </Card>

          <Card bg={bgColor} borderColor={borderColor}>
            <CardHeader>
              <Heading size="md">Value at Risk Trend</Heading>
            </CardHeader>
            <CardBody>
              <Box h="300px">
                {createVaRChart()}
              </Box>
            </CardBody>
          </Card>
        </Grid>

        {/* Risk Limits */}
        <Card bg={bgColor} borderColor={borderColor} w="full">
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Risk Limits</Heading>
              <Button
                leftIcon={<FiPlus />}
                size="sm"
                onClick={handleCreateRiskLimit}
              >
                Add Limit
              </Button>
            </HStack>
          </CardHeader>
          <CardBody>
            <TableContainer>
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Threshold</Th>
                    <Th>Current</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {riskLimits.map((limit) => (
                    <Tr key={limit.id}>
                      <Td>
                        <HStack>
                          {getRiskLevelIcon(limit.severity)}
                          <Text>{limit.name}</Text>
                        </HStack>
                      </Td>
                      <Td>
                        <Badge colorScheme="blue">{limit.type.toUpperCase()}</Badge>
                      </Td>
                      <Td>{limit.threshold.toFixed(2)}%</Td>
                      <Td>
                        <Text color={limit.is_breached ? 'red.500' : 'inherit'}>
                          {limit.current_value.toFixed(2)}%
                        </Text>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <Badge 
                            colorScheme={limit.is_breached ? 'red' : 'green'}
                          >
                            {limit.is_breached ? 'BREACHED' : 'OK'}
                          </Badge>
                          <Switch
                            isChecked={limit.is_active}
                            onChange={() => handleToggleRiskLimit(limit.id)}
                            size="sm"
                          />
                        </HStack>
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton
                            aria-label="Edit limit"
                            icon={<FiEdit />}
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRiskLimit(limit)}
                          />
                          <IconButton
                            aria-label="Delete limit"
                            icon={<FiTrash2 />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDeleteRiskLimit(limit.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </CardBody>
        </Card>

        {/* Active Alerts */}
        <Card bg={bgColor} borderColor={borderColor} w="full">
          <CardHeader>
            <Heading size="md">Active Alerts</Heading>
          </CardHeader>
          <CardBody>
            {alerts.length === 0 ? (
              <VStack spacing={4} py={8}>
                <FiShield size={48} color={mutedColor} />
                <Text color={mutedColor} textAlign="center">
                  No active alerts
                </Text>
              </VStack>
            ) : (
              <VStack spacing={3} align="stretch">
                {alerts.map((alert) => (
                  <Alert key={alert.id} status={alert.severity === 'high' ? 'error' : alert.severity === 'medium' ? 'warning' : 'info'}>
                    <AlertIcon />
                    <Box flex="1">
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold">{alert.message}</Text>
                          <Text fontSize="sm" color={mutedColor}>
                            {alert.alert_type.replace('_', ' ').toUpperCase()} - Threshold: {alert.threshold_value}
                          </Text>
                        </VStack>
                        <Badge colorScheme={getRiskLevelColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </HStack>
                    </Box>
                  </Alert>
                ))}
              </VStack>
            )}
          </CardBody>
        </Card>

        {/* Stress Test Results */}
        <Card bg={bgColor} borderColor={borderColor} w="full">
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Stress Test Scenarios</Heading>
              <Button
                leftIcon={<FiActivity />}
                size="sm"
                onClick={handleRunStressTest}
              >
                Run Test
              </Button>
            </HStack>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              {stressTestResults.map((scenario) => (
                <Card key={scenario.id} variant="outline">
                  <CardHeader>
                    <VStack align="start" spacing={1}>
                      <Heading size="sm">{scenario.name}</Heading>
                      <Text fontSize="sm" color={mutedColor}>
                        {scenario.description}
                      </Text>
                    </VStack>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={3} align="stretch">
                      <HStack justify="space-between">
                        <Text>Expected Loss</Text>
                        <Text fontWeight="bold" color="red.500">
                          {scenario.expected_loss.toFixed(2)}%
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text>Probability</Text>
                        <Text fontWeight="bold">
                          {(scenario.probability * 100).toFixed(1)}%
                        </Text>
                      </HStack>
                      <Divider />
                      <VStack spacing={2} align="stretch" fontSize="sm">
                        <HStack justify="space-between">
                          <Text>Price Shock</Text>
                          <Text>{scenario.price_shock}%</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text>Vol Shock</Text>
                          <Text>+{scenario.volatility_shock}%</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text>Corr Shock</Text>
                          <Text>+{scenario.correlation_shock}%</Text>
                        </HStack>
                      </VStack>
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </CardBody>
        </Card>
      </VStack>

      {/* Risk Limit Modal */}
      <Modal isOpen={isLimitModalOpen} onClose={onLimitModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedRiskLimit ? 'Edit Risk Limit' : 'Create Risk Limit'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Limit Name</FormLabel>
                <Input placeholder="Enter limit name" />
              </FormControl>
              <FormControl>
                <FormLabel>Limit Type</FormLabel>
                <Select placeholder="Select limit type">
                  <option value="var">Value at Risk</option>
                  <option value="drawdown">Maximum Drawdown</option>
                  <option value="concentration">Concentration Risk</option>
                  <option value="il">Impermanent Loss</option>
                  <option value="custom">Custom</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Threshold Value (%)</FormLabel>
                <Input type="number" placeholder="Enter threshold" />
              </FormControl>
              <FormControl>
                <FormLabel>Severity Level</FormLabel>
                <Select placeholder="Select severity">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onLimitModalClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={onLimitModalClose}>
              {selectedRiskLimit ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stress Test Modal */}
      <Modal isOpen={isStressTestModalOpen} onClose={onStressTestModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Run Stress Test</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Alert status="info">
                <AlertIcon />
                <Box>
                  <Text fontWeight="bold">Stress Testing</Text>
                  <Text fontSize="sm">
                    Configure scenario parameters to test portfolio resilience under adverse conditions.
                  </Text>
                </Box>
              </Alert>
              
              <FormControl>
                <FormLabel>Price Shock (%)</FormLabel>
                <Slider defaultValue={-10} min={-50} max={50} step={1}>
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </FormControl>
              
              <FormControl>
                <FormLabel>Volatility Increase (%)</FormLabel>
                <Slider defaultValue={25} min={0} max={200} step={5}>
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </FormControl>
              
              <FormControl>
                <FormLabel>Correlation Increase (%)</FormLabel>
                <Slider defaultValue={20} min={0} max={100} step={5}>
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onStressTestModalClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={onStressTestModalClose}>
              Run Test
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default RiskManagement;