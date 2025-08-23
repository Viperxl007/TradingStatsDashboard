import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useColorModeValue,
  Icon,
  Flex,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Image,
  Button,
  Tooltip
} from '@chakra-ui/react';
import {
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiSearch,
  FiFilter,
  FiEye,
  FiBarChart
} from 'react-icons/fi';
import { format } from 'date-fns';
import { AITradeEntry, AITradeStatus } from '../../types/aiTradeTracker';
import { getStatusColorScheme, getStatusDisplayText } from '../../utils/statusMapping';

interface AITradeViewerHistoryProps {
  trades: AITradeEntry[];
  onRefresh: () => void;
  onError: (error: string) => void;
}

const AITradeViewerHistory: React.FC<AITradeViewerHistoryProps> = ({
  trades,
  onRefresh,
  onError
}) => {
  const [selectedTrade, setSelectedTrade] = useState<AITradeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();

  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  /**
   * Filter trades based on search and status
   */
  const filteredTrades = trades.filter(trade => {
    const matchesSearch = trade.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trade.reasoning.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trade.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /**
   * Get confidence color scheme
   */
  const getConfidenceColorScheme = (confidence: number) => {
    if (confidence >= 0.9) return 'green';
    if (confidence >= 0.75) return 'blue';
    if (confidence >= 0.5) return 'yellow';
    return 'red';
  };

  /**
   * Get action color and icon
   */
  const getActionDisplay = (action: 'buy' | 'sell') => {
    return action === 'buy'
      ? { color: 'green', icon: FiTrendingUp, text: 'BUY' }
      : { color: 'red', icon: FiTrendingDown, text: 'SELL' };
  };

  /**
   * Handle viewing trade details
   */
  const handleViewDetails = (trade: AITradeEntry) => {
    setSelectedTrade(trade);
    onDetailOpen();
  };

  /**
   * Format date for display
   */
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM dd, HH:mm');
  };

  /**
   * Calculate performance metrics for filtered trades
   */
  const calculateMetrics = () => {
    const totalTrades = filteredTrades.length;
    const profitableTrades = filteredTrades.filter(t => t.profitLossPercentage && t.profitLossPercentage > 0).length;
    const totalReturn = filteredTrades.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0);
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

    return {
      totalTrades,
      profitableTrades,
      winRate,
      totalReturn
    };
  };

  const metrics = calculateMetrics();

  if (trades.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={FiClock} boxSize={12} color="gray.400" mb={4} />
        <Heading size="md" color="gray.500" mb={2}>
          No Trade History
        </Heading>
        <Text color={textColor}>
          Historical AI trade data will appear here as trades are completed.
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Stat>
          <StatLabel>Total Trades</StatLabel>
          <StatNumber>{metrics.totalTrades}</StatNumber>
          <StatHelpText>
            <Icon as={FiBarChart} mr={1} />
            In history
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Profitable Trades</StatLabel>
          <StatNumber>{metrics.profitableTrades}</StatNumber>
          <StatHelpText>
            <Icon as={FiTarget} mr={1} />
            Winning trades
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Win Rate</StatLabel>
          <StatNumber>{metrics.winRate.toFixed(1)}%</StatNumber>
          <StatHelpText>
            <Icon as={FiTrendingUp} mr={1} />
            Success rate
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Total Return</StatLabel>
          <StatNumber color={metrics.totalReturn >= 0 ? 'green.500' : 'red.500'}>
            {metrics.totalReturn >= 0 ? '+' : ''}{metrics.totalReturn.toFixed(2)}%
          </StatNumber>
          <StatHelpText>
            <Icon as={FiClock} mr={1} />
            Overall performance
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Filters */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" mb={6}>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search by ticker or reasoning..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="profit_hit">Profit Hit</option>
              <option value="stop_hit">Stop Loss</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Trade History Table */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
        <CardHeader>
          <Heading size="md">Trade History ({filteredTrades.length} trades)</Heading>
        </CardHeader>
        <CardBody>
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Ticker</Th>
                  <Th>Action</Th>
                  <Th>Entry Price</Th>
                  <Th>Exit Price</Th>
                  <Th>P&L %</Th>
                  <Th>Status</Th>
                  <Th>Confidence</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredTrades.map((trade) => {
                  const actionDisplay = getActionDisplay(trade.action);

                  return (
                    <Tr key={trade.id}>
                      <Td>{formatDate(trade.entryDate)}</Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold">{trade.ticker}</Text>
                          <Text fontSize="xs" color={textColor}>{trade.timeframe}</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={actionDisplay.color}
                          variant="solid"
                          px={2}
                          py={1}
                          borderRadius="full"
                        >
                          <HStack spacing={1}>
                            <Icon as={actionDisplay.icon} boxSize={2} />
                            <Text fontSize="xs" fontWeight="bold">{actionDisplay.text}</Text>
                          </HStack>
                        </Badge>
                      </Td>
                      <Td>${trade.entryPrice.toFixed(2)}</Td>
                      <Td>
                        {trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
                      </Td>
                      <Td>
                        {trade.profitLossPercentage !== undefined ? (
                          <Text
                            fontWeight="bold"
                            color={trade.profitLossPercentage >= 0 ? 'green.500' : 'red.500'}
                          >
                            {trade.profitLossPercentage >= 0 ? '+' : ''}{trade.profitLossPercentage.toFixed(2)}%
                          </Text>
                        ) : (
                          '-'
                        )}
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={getStatusColorScheme(trade.status)}
                          variant="subtle"
                        >
                          {getStatusDisplayText(trade.status)}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={getConfidenceColorScheme(trade.confidence)}
                          variant="solid"
                        >
                          {(trade.confidence * 100).toFixed(0)}%
                        </Badge>
                      </Td>
                      <Td>
                        <Tooltip label="View Details">
                          <Button
                            size="xs"
                            variant="ghost"
                            leftIcon={<FiEye />}
                            onClick={() => handleViewDetails(trade)}
                          >
                            View
                          </Button>
                        </Tooltip>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      {/* Trade Details Modal */}
      <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Trade Details - {selectedTrade?.ticker} {selectedTrade?.timeframe}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedTrade && (
              <VStack spacing={4} align="stretch">
                {/* Chart Image */}
                {selectedTrade.markedUpChartImageBase64 && (
                  <Box>
                    <Text fontWeight="bold" mb={2}>Analysis Chart</Text>
                    <Image
                      src={`data:image/png;base64,${selectedTrade.markedUpChartImageBase64}`}
                      alt="Chart Analysis"
                      borderRadius="md"
                      maxH="300px"
                      objectFit="contain"
                    />
                  </Box>
                )}

                {/* Trade Details */}
                <SimpleGrid columns={2} spacing={4}>
                  <Box>
                    <Text fontWeight="bold" mb={2}>Trade Information</Text>
                    <VStack align="start" spacing={2}>
                      <Text><strong>AI Model:</strong> {selectedTrade.aiModel}</Text>
                      <Text><strong>Status:</strong> {getStatusDisplayText(selectedTrade.status)}</Text>
                      <Text><strong>Confidence:</strong> {(selectedTrade.confidence * 100).toFixed(1)}%</Text>
                      <Text><strong>Risk/Reward:</strong> {selectedTrade.riskReward?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Entry Date:</strong> {formatDate(selectedTrade.entryDate)}</Text>
                      {selectedTrade.exitDate && (
                        <Text><strong>Exit Date:</strong> {formatDate(selectedTrade.exitDate)}</Text>
                      )}
                    </VStack>
                  </Box>

                  <Box>
                    <Text fontWeight="bold" mb={2}>Price Levels</Text>
                    <VStack align="start" spacing={2}>
                      <Text><strong>Entry:</strong> ${selectedTrade.entryPrice.toFixed(2)}</Text>
                      <Text><strong>Target:</strong> ${selectedTrade.targetPrice?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Stop Loss:</strong> ${selectedTrade.stopLoss?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Exit:</strong> ${selectedTrade.exitPrice?.toFixed(2) || 'N/A'}</Text>
                      {selectedTrade.profitLossPercentage !== undefined && (
                        <Text>
                          <strong>P&L:</strong>{' '}
                          <Text as="span" color={selectedTrade.profitLossPercentage >= 0 ? 'green.500' : 'red.500'}>
                            {selectedTrade.profitLossPercentage >= 0 ? '+' : ''}{selectedTrade.profitLossPercentage.toFixed(2)}%
                          </Text>
                        </Text>
                      )}
                    </VStack>
                  </Box>
                </SimpleGrid>

                {/* Reasoning */}
                <Box>
                  <Text fontWeight="bold" mb={2}>AI Reasoning</Text>
                  <Text fontSize="sm" color={textColor}>
                    {selectedTrade.reasoning}
                  </Text>
                </Box>

                {/* Key Levels */}
                {selectedTrade.keyLevels && (
                  <SimpleGrid columns={2} spacing={4}>
                    <Box>
                      <Text fontWeight="bold" mb={2}>Support Levels</Text>
                      <VStack align="start" spacing={1}>
                        {selectedTrade.keyLevels.support.map((level, index) => (
                          <Text key={index} fontSize="sm">${level.toFixed(2)}</Text>
                        ))}
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontWeight="bold" mb={2}>Resistance Levels</Text>
                      <VStack align="start" spacing={1}>
                        {selectedTrade.keyLevels.resistance.map((level, index) => (
                          <Text key={index} fontSize="sm">${level.toFixed(2)}</Text>
                        ))}
                      </VStack>
                    </Box>
                  </SimpleGrid>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AITradeViewerHistory;