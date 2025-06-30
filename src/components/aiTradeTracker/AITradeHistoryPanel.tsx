import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  useColorModeValue,
  Icon,
  Flex,
  Input,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Image,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useToast
} from '@chakra-ui/react';
import {
  FiSearch,
  FiFilter,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiDollarSign,
  FiTarget,
  FiEye,
  FiMoreVertical,
  FiTrash2,
  FiEdit
} from 'react-icons/fi';
import { format } from 'date-fns';
import { AITradeEntry, AITradeFilterOptions, AITradeStatus } from '../../types/aiTradeTracker';
import { getAllTradesHistoryForAITracker } from '../../services/productionActiveTradesService';

interface AITradeHistoryPanelProps {
  onError: (error: string) => void;
}

const AITradeHistoryPanel: React.FC<AITradeHistoryPanelProps> = ({ onError }) => {
  const toast = useToast();
  const [trades, setTrades] = useState<AITradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<AITradeEntry | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'performance' | 'confidence'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  
  // Load trades data
  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      setLoading(true);
      // Load all trades including closed ones for history
      const allTrades = await getAllTradesHistoryForAITracker();
      setTrades(allTrades);
    } catch (error) {
      console.error('Error loading trades:', error);
      onError('Failed to load trade history');
    } finally {
      setLoading(false);
    }
  };
  
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  /**
   * Filter and sort trades
   */
  const filteredAndSortedTrades = useMemo(() => {
    let filtered = trades;

    // Apply search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(trade => 
        trade.ticker.toLowerCase().includes(searchLower) ||
        trade.reasoning.toLowerCase().includes(searchLower) ||
        trade.aiModel.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trade => trade.status === statusFilter);
    }

    // Apply confidence filter
    if (confidenceFilter !== 'all') {
      switch (confidenceFilter) {
        case 'high':
          filtered = filtered.filter(trade => trade.confidence >= 0.75);
          break;
        case 'medium':
          filtered = filtered.filter(trade => trade.confidence >= 0.5 && trade.confidence < 0.75);
          break;
        case 'low':
          filtered = filtered.filter(trade => trade.confidence < 0.5);
          break;
      }
    }

    // Sort trades
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.entryDate - b.entryDate;
          break;
        case 'performance':
          const aPerf = a.profitLossPercentage || 0;
          const bPerf = b.profitLossPercentage || 0;
          comparison = aPerf - bPerf;
          break;
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [trades, searchText, statusFilter, confidenceFilter, sortBy, sortOrder]);

  /**
   * Calculate summary statistics for filtered trades
   */
  const summaryStats = useMemo(() => {
    const closedTrades = filteredAndSortedTrades.filter(trade =>
      ['closed', 'profit_hit', 'stop_hit', 'ai_closed', 'user_closed'].includes(trade.status) &&
      trade.profitLoss !== undefined
    );
    
    const winningTrades = closedTrades.filter(trade =>
      trade.profitLoss! > 0 || trade.status === 'profit_hit'
    );
    const totalReturn = closedTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const avgReturn = closedTrades.length > 0 ? totalReturn / closedTrades.length : 0;

    return {
      totalTrades: filteredAndSortedTrades.length,
      closedTrades: closedTrades.length,
      winRate,
      totalReturn,
      avgReturn
    };
  }, [filteredAndSortedTrades]);

  /**
   * Get status color scheme
   */
  const getStatusColorScheme = (status: AITradeStatus) => {
    switch (status) {
      case 'waiting': return 'yellow';
      case 'open': return 'green';
      case 'closed': return 'gray';
      case 'profit_hit': return 'green';
      case 'stop_hit': return 'red';
      case 'cancelled': return 'red';
      case 'expired': return 'orange';
      case 'ai_closed': return 'blue';
      case 'user_closed': return 'purple';
      default: return 'gray';
    }
  };

  /**
   * Get performance color
   */
  const getPerformanceColor = (profitLoss?: number) => {
    if (!profitLoss) return 'gray.500';
    return profitLoss > 0 ? 'green.500' : 'red.500';
  };

  /**
   * Handle viewing trade details
   */
  const handleViewDetails = (trade: AITradeEntry) => {
    setSelectedTrade(trade);
    onDetailOpen();
  };

  /**
   * Handle deleting a trade
   */
  const handleDeleteTrade = async (trade: AITradeEntry) => {
    // Note: We don't delete production trades from AI Trade Tracker
    // This would need to be handled through the Chart Analysis system
    toast({
      title: 'Cannot Delete',
      description: 'Production trades must be managed through Chart Analysis',
      status: 'warning',
      duration: 5000,
      isClosable: true,
    });
  };

  /**
   * Format duration
   */
  const formatDuration = (hours?: number) => {
    if (!hours) return 'N/A';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  if (loading) {
    return (
      <Box textAlign="center" py={8}>
        <Text>Loading trade history...</Text>
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters and Search */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px" mb={6}>
        <CardBody>
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={4}>
            <Box>
              <Text fontSize="sm" mb={2} fontWeight="medium">Search</Text>
              <Input
                placeholder="Search trades..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Box>
            <Box>
              <Text fontSize="sm" mb={2} fontWeight="medium">Status</Text>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="waiting">Waiting</option>
                <option value="open">Open</option>
                <option value="closed">Closed (Generic)</option>
                <option value="profit_hit">Profit Hit (WIN)</option>
                <option value="stop_hit">Stop Hit (LOSS)</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="ai_closed">AI Closed</option>
                <option value="user_closed">User Closed</option>
              </Select>
            </Box>
            <Box>
              <Text fontSize="sm" mb={2} fontWeight="medium">Confidence</Text>
              <Select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)}>
                <option value="all">All Confidence</option>
                <option value="high">High (75%+)</option>
                <option value="medium">Medium (50-75%)</option>
                <option value="low">Low (under 50%)</option>
              </Select>
            </Box>
            <Box>
              <Text fontSize="sm" mb={2} fontWeight="medium">Sort By</Text>
              <HStack>
                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="date">Date</option>
                  <option value="performance">Performance</option>
                  <option value="confidence">Confidence</option>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </HStack>
            </Box>
          </SimpleGrid>

          {/* Summary Stats */}
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
            <Stat>
              <StatLabel>Total Trades</StatLabel>
              <StatNumber>{summaryStats.totalTrades}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Closed</StatLabel>
              <StatNumber>{summaryStats.closedTrades}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Win Rate</StatLabel>
              <StatNumber>{(summaryStats.winRate || 0).toFixed(1)}%</StatNumber>
              <StatHelpText>
                <StatArrow type={summaryStats.winRate >= 50 ? 'increase' : 'decrease'} />
                {summaryStats.winRate >= 50 ? 'Above 50%' : 'Below 50%'}
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Total Return</StatLabel>
              <StatNumber color={getPerformanceColor(summaryStats.totalReturn)}>
                {summaryStats.totalReturn > 0 ? '+' : ''}${(summaryStats.totalReturn || 0).toFixed(2)}
              </StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Avg Return</StatLabel>
              <StatNumber color={getPerformanceColor(summaryStats.avgReturn)}>
                {summaryStats.avgReturn > 0 ? '+' : ''}${(summaryStats.avgReturn || 0).toFixed(2)}
              </StatNumber>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>

      {/* Trades Table */}
      <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
        <CardHeader>
          <Heading size="md">Trade History ({filteredAndSortedTrades.length})</Heading>
        </CardHeader>
        <CardBody pt={0}>
          {filteredAndSortedTrades.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Text color={textColor}>No trades found matching your filters.</Text>
            </Box>
          ) : (
            <TableContainer>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Trade</Th>
                    <Th>Entry</Th>
                    <Th>Exit</Th>
                    <Th>Performance</Th>
                    <Th>Duration</Th>
                    <Th>Confidence</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredAndSortedTrades.map((trade) => (
                    <Tr key={trade.id}>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <HStack>
                            <Text fontWeight="bold">{trade.ticker}</Text>
                            <Badge size="sm" colorScheme="blue" variant="outline">
                              {trade.timeframe}
                            </Badge>
                            <Badge 
                              size="sm" 
                              colorScheme={trade.action === 'buy' ? 'green' : 'red'} 
                              variant="solid"
                            >
                              {trade.action.toUpperCase()}
                            </Badge>
                          </HStack>
                          <Text fontSize="xs" color={textColor}>
                            {format(new Date(trade.entryDate), 'MMM dd, yyyy HH:mm')}
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontWeight="medium">${trade.entryPrice.toFixed(2)}</Text>
                        {trade.actualEntryPrice && trade.actualEntryPrice !== trade.entryPrice && (
                          <Text fontSize="xs" color={textColor}>
                            Actual: ${trade.actualEntryPrice.toFixed(2)}
                          </Text>
                        )}
                      </Td>
                      <Td>
                        {trade.exitPrice ? (
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="medium">${trade.exitPrice.toFixed(2)}</Text>
                            {trade.exitDate && (
                              <Text fontSize="xs" color={textColor}>
                                {format(new Date(trade.exitDate), 'MMM dd, HH:mm')}
                              </Text>
                            )}
                          </VStack>
                        ) : (
                          <Text color={textColor}>-</Text>
                        )}
                      </Td>
                      <Td>
                        {trade.profitLoss !== undefined ? (
                          <VStack align="start" spacing={1}>
                            <Text 
                              fontWeight="bold" 
                              color={getPerformanceColor(trade.profitLoss)}
                            >
                              {(trade.profitLoss || 0) > 0 ? '+' : ''}${(trade.profitLoss || 0).toFixed(2)}
                            </Text>
                            {trade.profitLossPercentage && (
                              <Text
                                fontSize="xs"
                                color={getPerformanceColor(trade.profitLoss)}
                              >
                                {(trade.profitLossPercentage || 0) > 0 ? '+' : ''}
                                {(trade.profitLossPercentage || 0).toFixed(1)}%
                              </Text>
                            )}
                          </VStack>
                        ) : (
                          <Text color={textColor}>-</Text>
                        )}
                      </Td>
                      <Td>
                        <Text>{formatDuration(trade.holdTime)}</Text>
                      </Td>
                      <Td>
                        <Badge 
                          colorScheme={trade.confidence >= 0.75 ? 'green' : trade.confidence >= 0.5 ? 'yellow' : 'red'}
                          variant="solid"
                        >
                          {(trade.confidence * 100).toFixed(0)}%
                        </Badge>
                      </Td>
                      <Td>
                        <Badge 
                          colorScheme={getStatusColorScheme(trade.status)}
                          variant="subtle"
                        >
                          {trade.status.toUpperCase()}
                        </Badge>
                      </Td>
                      <Td>
                        <HStack spacing={1}>
                          <Tooltip label="View Details">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => handleViewDetails(trade)}
                            >
                              <Icon as={FiEye} />
                            </Button>
                          </Tooltip>
                          <Menu>
                            <MenuButton as={Button} size="xs" variant="ghost">
                              <Icon as={FiMoreVertical} />
                            </MenuButton>
                            <MenuList>
                              <MenuItem 
                                icon={<FiTrash2 />} 
                                onClick={() => handleDeleteTrade(trade)}
                                color="red.500"
                              >
                                Delete Trade
                              </MenuItem>
                            </MenuList>
                          </Menu>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
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
                {/* Performance Summary */}
                {['closed', 'profit_hit', 'stop_hit', 'ai_closed', 'user_closed'].includes(selectedTrade.status) && (
                  <Card bg={useColorModeValue('gray.50', 'gray.700')} p={4}>
                    <SimpleGrid columns={3} spacing={4}>
                      <Stat textAlign="center">
                        <StatLabel>P&L</StatLabel>
                        <StatNumber color={getPerformanceColor(selectedTrade.profitLoss)}>
                          {selectedTrade.profitLoss && selectedTrade.profitLoss > 0 ? '+' : ''}
                          ${selectedTrade.profitLoss?.toFixed(2) || '0.00'}
                        </StatNumber>
                      </Stat>
                      <Stat textAlign="center">
                        <StatLabel>Return %</StatLabel>
                        <StatNumber color={getPerformanceColor(selectedTrade.profitLoss)}>
                          {selectedTrade.profitLossPercentage && selectedTrade.profitLossPercentage > 0 ? '+' : ''}
                          {selectedTrade.profitLossPercentage?.toFixed(1) || '0.0'}%
                        </StatNumber>
                      </Stat>
                      <Stat textAlign="center">
                        <StatLabel>Hold Time</StatLabel>
                        <StatNumber>{formatDuration(selectedTrade.holdTime)}</StatNumber>
                      </Stat>
                    </SimpleGrid>
                  </Card>
                )}

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
                      <Text><strong>Action:</strong> {selectedTrade.action.toUpperCase()}</Text>
                      <Text><strong>Sentiment:</strong> {selectedTrade.sentiment}</Text>
                      <Text><strong>Confidence:</strong> {(selectedTrade.confidence * 100).toFixed(1)}%</Text>
                      <Text><strong>Status:</strong> {selectedTrade.status}</Text>
                      {selectedTrade.closeReason && (
                        <Text><strong>Close Reason:</strong> {selectedTrade.closeReason}</Text>
                      )}
                    </VStack>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={2}>Price Information</Text>
                    <VStack align="start" spacing={2}>
                      <Text><strong>Entry Price:</strong> ${selectedTrade.entryPrice.toFixed(2)}</Text>
                      {selectedTrade.actualEntryPrice && (
                        <Text><strong>Actual Entry:</strong> ${selectedTrade.actualEntryPrice.toFixed(2)}</Text>
                      )}
                      {selectedTrade.exitPrice && (
                        <Text><strong>Exit Price:</strong> ${selectedTrade.exitPrice.toFixed(2)}</Text>
                      )}
                      <Text><strong>Target:</strong> ${selectedTrade.targetPrice?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Stop Loss:</strong> ${selectedTrade.stopLoss?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Risk/Reward:</strong> {selectedTrade.riskReward?.toFixed(2) || 'N/A'}</Text>
                    </VStack>
                  </Box>
                </SimpleGrid>
                
                {/* AI Reasoning */}
                <Box>
                  <Text fontWeight="bold" mb={2}>AI Reasoning</Text>
                  <Text fontSize="sm" color={textColor}>
                    {selectedTrade.reasoning}
                  </Text>
                </Box>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AITradeHistoryPanel;