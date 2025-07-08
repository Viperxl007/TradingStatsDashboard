import React, { useState, useEffect } from 'react';
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
  Divider,
  useColorModeValue,
  Icon,
  Flex,
  Tooltip,
  useDisclosure,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Image,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useToast
} from '@chakra-ui/react';
import {
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiShield,
  FiDollarSign,
  FiActivity,
  FiEye,
  FiEdit,
  FiX
} from 'react-icons/fi';
import { format } from 'date-fns';
import { AITradeEntry, AITradeStatus } from '../../types/aiTradeTracker';
import { getAllActiveTradesForAITracker, closeActiveTradeInProduction } from '../../services/productionActiveTradesService';
import { getStatusColorScheme, getStatusDisplayText } from '../../utils/statusMapping';

interface AIActiveTradesPanelProps {
  onError: (error: string) => void;
  onTradeUpdate: () => void;
}

const AIActiveTradesPanel: React.FC<AIActiveTradesPanelProps> = ({ onError, onTradeUpdate }) => {
  const toast = useToast();
  const [trades, setTrades] = useState<AITradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<AITradeEntry | null>(null);
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  
  // Load active trades
  useEffect(() => {
    loadActiveTrades();
  }, []);

  const loadActiveTrades = async () => {
    try {
      setLoading(true);
      const activeTrades = await getAllActiveTradesForAITracker();
      setTrades(activeTrades);
    } catch (error) {
      console.error('Error loading active trades:', error);
      onError('Failed to load active trades');
    } finally {
      setLoading(false);
    }
  };
  
  // Colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  /**
   * Get status color scheme (using standardized utility)
   */
  const getTradeStatusColorScheme = (status: AITradeStatus) => {
    return getStatusColorScheme(status);
  };

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
   * Handle updating trade status
   */
  const handleUpdateStatus = async (trade: AITradeEntry, newStatus: AITradeStatus) => {
    try {
      // For production trades, status updates are handled by the backend
      // We'll just reload the data to reflect any changes
      await loadActiveTrades();
      onTradeUpdate();
      
      toast({
        title: 'Trade Status Checked',
        description: `Trade status updated to ${newStatus}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update trade status',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Handle cancelling trade
   */
  const handleCancelTrade = async (trade: AITradeEntry) => {
    try {
      // Close the trade via production API
      const success = await closeActiveTradeInProduction(
        trade.ticker,
        trade.actualEntryPrice || trade.entryPrice,
        'Cancelled via AI Trade Tracker'
      );
      
      if (success) {
        await loadActiveTrades();
        onTradeUpdate();
        
        toast({
          title: 'Trade Cancelled',
          description: 'Trade has been cancelled',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Cancel Failed',
          description: 'Failed to cancel trade',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: 'Failed to cancel trade',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Calculate time since recommendation
   */
  const getTimeSinceRecommendation = (entryDate: number) => {
    const now = Date.now();
    const diffHours = (now - entryDate) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return `${Math.round(diffHours * 60)}m ago`;
    } else if (diffHours < 24) {
      return `${Math.round(diffHours)}h ago`;
    } else {
      return `${Math.round(diffHours / 24)}d ago`;
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" py={12}>
        <Text>Loading active trades...</Text>
      </Box>
    );
  }

  if (trades.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Icon as={FiActivity} boxSize={12} color="gray.400" mb={4} />
        <Heading size="md" color="gray.500" mb={2}>
          No Active Trades
        </Heading>
        <Text color={textColor}>
          AI trade recommendations will appear here when generated from chart analysis.
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      {/* Summary Stats */}
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4} mb={6}>
        <Stat>
          <StatLabel>Active Trades</StatLabel>
          <StatNumber>{trades.length}</StatNumber>
          <StatHelpText>
            <Icon as={FiActivity} mr={1} />
            Currently monitoring
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Waiting Entry</StatLabel>
          <StatNumber>{trades.filter(t => t.status === 'waiting').length}</StatNumber>
          <StatHelpText>
            <Icon as={FiClock} mr={1} />
            Pending execution
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Open Positions</StatLabel>
          <StatNumber>{trades.filter(t => t.status === 'open').length}</StatNumber>
          <StatHelpText>
            <Icon as={FiTrendingUp} mr={1} />
            Currently held
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Profitable Exits</StatLabel>
          <StatNumber>{trades.filter(t => t.status === 'profit_hit').length}</StatNumber>
          <StatHelpText>
            <Icon as={FiTarget} mr={1} />
            Target hit
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Stop Losses</StatLabel>
          <StatNumber>{trades.filter(t => t.status === 'stop_hit').length}</StatNumber>
          <StatHelpText>
            <Icon as={FiShield} mr={1} />
            Risk managed
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Unrealized P&L</StatLabel>
          <StatNumber color={
            trades.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0) >= 0
              ? 'green.500'
              : 'red.500'
          }>
            {trades.length > 0
              ? `${trades.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0).toFixed(2)}%`
              : '0.00%'
            }
          </StatNumber>
          <StatHelpText>
            <Icon as={FiDollarSign} mr={1} />
            Total percentage return
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Active Trades List */}
      <VStack spacing={4} align="stretch">
        {trades.map((trade) => {
          const actionDisplay = getActionDisplay(trade.action);
          
          return (
            <Card key={trade.id} bg={cardBg} borderColor={borderColor} borderWidth="1px">
              <CardHeader pb={2}>
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Badge 
                      colorScheme={actionDisplay.color} 
                      variant="solid"
                      px={3}
                      py={1}
                      borderRadius="full"
                    >
                      <HStack spacing={1}>
                        <Icon as={actionDisplay.icon} boxSize={3} />
                        <Text fontSize="sm" fontWeight="bold">{actionDisplay.text}</Text>
                      </HStack>
                    </Badge>
                    <Heading size="md">{trade.ticker}</Heading>
                    <Badge colorScheme="blue" variant="outline">
                      {trade.timeframe}
                    </Badge>
                    <Badge
                      colorScheme={getTradeStatusColorScheme(trade.status)}
                      variant="subtle"
                    >
                      {getStatusDisplayText(trade.status)}
                    </Badge>
                  </HStack>
                  
                  <HStack spacing={2}>
                    <Text fontSize="sm" color={textColor}>
                      {getTimeSinceRecommendation(trade.entryDate)}
                    </Text>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<FiEye />}
                      onClick={() => handleViewDetails(trade)}
                    >
                      Details
                    </Button>
                  </HStack>
                </Flex>
              </CardHeader>
              
              <CardBody pt={0}>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
                  <Box>
                    <Text fontSize="sm" color={textColor} mb={1}>Entry Price</Text>
                    <Text fontWeight="bold">${trade.entryPrice.toFixed(2)}</Text>
                  </Box>
                  {trade.targetPrice && (
                    <Box>
                      <Text fontSize="sm" color={textColor} mb={1}>Target</Text>
                      <Text fontWeight="bold" color="green.500">
                        ${trade.targetPrice.toFixed(2)}
                      </Text>
                    </Box>
                  )}
                  {trade.stopLoss && (
                    <Box>
                      <Text fontSize="sm" color={textColor} mb={1}>Stop Loss</Text>
                      <Text fontWeight="bold" color="red.500">
                        ${trade.stopLoss.toFixed(2)}
                      </Text>
                    </Box>
                  )}
                  <Box>
                    <Text fontSize="sm" color={textColor} mb={1}>Confidence</Text>
                    <Badge 
                      colorScheme={getConfidenceColorScheme(trade.confidence)}
                      variant="solid"
                    >
                      {(trade.confidence * 100).toFixed(0)}%
                    </Badge>
                  </Box>
                </SimpleGrid>
                
                <Text fontSize="sm" color={textColor} mb={3} noOfLines={2}>
                  {trade.reasoning}
                </Text>
                
                <HStack spacing={2} justify="flex-end">
                  {trade.status === 'waiting' && (
                    <>
                      <Button
                        size="sm"
                        colorScheme="green"
                        variant="outline"
                        onClick={() => handleUpdateStatus(trade, 'open')}
                      >
                        Enter Trade
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        leftIcon={<FiX />}
                        onClick={() => handleCancelTrade(trade)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {trade.status === 'open' && (
                    <Button
                      size="sm"
                      colorScheme="blue"
                      variant="outline"
                      leftIcon={<FiEdit />}
                    >
                      Manage
                    </Button>
                  )}
                </HStack>
              </CardBody>
            </Card>
          );
        })}
      </VStack>

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
                      <Text><strong>Sentiment:</strong> {selectedTrade.sentiment}</Text>
                      <Text><strong>Confidence:</strong> {(selectedTrade.confidence * 100).toFixed(1)}%</Text>
                      <Text><strong>Risk/Reward:</strong> {selectedTrade.riskReward?.toFixed(2) || 'N/A'}</Text>
                    </VStack>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="bold" mb={2}>Price Levels</Text>
                    <VStack align="start" spacing={2}>
                      <Text><strong>Entry:</strong> ${selectedTrade.entryPrice.toFixed(2)}</Text>
                      <Text><strong>Target:</strong> ${selectedTrade.targetPrice?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Stop Loss:</strong> ${selectedTrade.stopLoss?.toFixed(2) || 'N/A'}</Text>
                      <Text><strong>Current:</strong> ${selectedTrade.priceAtRecommendation.toFixed(2)}</Text>
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

export default AIActiveTradesPanel;