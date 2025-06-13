import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Card,
  CardBody,
  useColorMode,
  Spinner,
  Icon,
  Flex,
  Input,
  Select,
  InputGroup,
  InputLeftElement,
  Divider,
  Tooltip,
  Progress,
  Checkbox,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure
} from '@chakra-ui/react';
import {
  FiSearch,
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiEye,
  FiClock,
  FiBarChart,
  FiTrash2,
  FiCheckSquare,
  FiSquare,
  FiRefreshCw
} from 'react-icons/fi';
import { HistoricalAnalysis } from '../types/chartAnalysis';
import AnalysisDetailsModal from './AnalysisDetailsModal';

interface AnalysisHistoryProps {
  history: HistoricalAnalysis[];
  isLoading: boolean;
  ticker: string;
  onSelectAnalysis: (analysisId: string) => void;
  onDeleteAnalysis?: (analysisId: string) => void;
  onDeleteAnalysesBulk?: (analysisIds: string[]) => void;
  onRefreshHistory?: () => void;
}

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({
  history,
  isLoading,
  ticker,
  onSelectAnalysis,
  onDeleteAnalysis,
  onDeleteAnalysesBulk,
  onRefreshHistory
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { isOpen: isDeleteDialogOpen, onOpen: onDeleteDialogOpen, onClose: onDeleteDialogClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  // Local state for filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  // Selection state for bulk operations
  const [selectedAnalyses, setSelectedAnalyses] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Modal state for viewing analysis details
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Filter and sort history
  const filteredHistory = React.useMemo(() => {
    let filtered = history.filter(analysis => {
      const matchesSearch = analysis.summary.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSentiment = sentimentFilter === 'all' || analysis.sentiment === sentimentFilter;
      const matchesTimeframe = timeframeFilter === 'all' || analysis.timeframe === timeframeFilter;
      return matchesSearch && matchesSentiment && matchesTimeframe;
    });

    // Sort the results
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.timestamp - a.timestamp;
        case 'oldest':
          return a.timestamp - b.timestamp;
        case 'confidence':
          return b.confidence - a.confidence;
        case 'timeframe':
          return (a.timeframe || '').localeCompare(b.timeframe || '');
        default:
          return b.timestamp - a.timestamp;
      }
    });

    return filtered;
  }, [history, searchTerm, sentimentFilter, timeframeFilter, sortBy]);

  // Get unique timeframes for filter dropdown
  const availableTimeframes = React.useMemo(() => {
    const timeframes = new Set(history.map(analysis => analysis.timeframe).filter(Boolean));
    return Array.from(timeframes).sort();
  }, [history]);

  // Selection handlers
  const handleSelectAnalysis = (analysisId: string, checked: boolean) => {
    const newSelected = new Set(selectedAnalyses);
    if (checked) {
      newSelected.add(analysisId);
    } else {
      newSelected.delete(analysisId);
    }
    setSelectedAnalyses(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAnalyses(new Set(filteredHistory.map(analysis => analysis.id)));
    } else {
      setSelectedAnalyses(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedAnalyses.size === 0 || !onDeleteAnalysesBulk) return;
    
    try {
      await onDeleteAnalysesBulk(Array.from(selectedAnalyses));
      setSelectedAnalyses(new Set());
      setIsSelectionMode(false);
      onRefreshHistory?.();
      
      toast({
        title: 'Analyses Deleted',
        description: `Successfully deleted ${selectedAnalyses.size} analyses`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting selected analyses:', error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete analyses',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDeleteSingle = async (analysisId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onDeleteAnalysis) return;
    
    try {
      await onDeleteAnalysis(analysisId);
      onRefreshHistory?.();
      
      toast({
        title: 'Analysis Deleted',
        description: 'Analysis deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting analysis:', error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete analysis',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle viewing analysis details
  const handleViewAnalysis = (analysisId: string) => {
    setSelectedAnalysisId(analysisId);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedAnalysisId(null);
  };

  // Get sentiment color and icon
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'green';
      case 'bearish': return 'red';
      default: return 'gray';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return FiTrendingUp;
      case 'bearish': return FiTrendingDown;
      default: return FiMinus;
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Loading state
  if (isLoading) {
    return (
      <VStack spacing={6} align="center" py={12}>
        <Spinner size="xl" color="brand.500" />
        <VStack spacing={2}>
          <Text fontSize="lg" fontWeight="semibold">
            Loading Analysis History
          </Text>
          <Text color="gray.500" textAlign="center">
            Fetching historical analyses for {ticker}...
          </Text>
        </VStack>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Box>
        <Flex justify="space-between" align="center" mb={2}>
          <VStack align="start" spacing={1}>
            <Text fontSize="xl" fontWeight="bold">
              Analysis History for {ticker}
            </Text>
            <Text color="gray.500">
              {history.length} historical analyses found
              {filteredHistory.length !== history.length && ` (${filteredHistory.length} shown)`}
            </Text>
          </VStack>
          
          <HStack spacing={2}>
            {isSelectionMode ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedAnalyses(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  leftIcon={<Icon as={FiTrash2} />}
                  onClick={onDeleteDialogOpen}
                  isDisabled={selectedAnalyses.size === 0}
                >
                  Delete Selected ({selectedAnalyses.size})
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Icon as={FiRefreshCw} />}
                  onClick={onRefreshHistory}
                  isLoading={isLoading}
                  loadingText="Refreshing"
                  isDisabled={!onRefreshHistory}
                >
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Icon as={FiCheckSquare} />}
                  onClick={() => setIsSelectionMode(true)}
                  isDisabled={filteredHistory.length === 0}
                >
                  Select Multiple
                </Button>
              </>
            )}
          </HStack>
        </Flex>
      </Box>

      {/* Filters */}
      <Box
        p={4}
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      >
        <VStack spacing={4}>
          {/* Bulk selection controls */}
          {isSelectionMode && (
            <HStack justify="space-between" w="full" p={3} bg={colorMode === 'dark' ? 'blue.900' : 'blue.50'} borderRadius="md">
              <HStack>
                <Checkbox
                  isChecked={selectedAnalyses.size === filteredHistory.length && filteredHistory.length > 0}
                  isIndeterminate={selectedAnalyses.size > 0 && selectedAnalyses.size < filteredHistory.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                >
                  Select All
                </Checkbox>
                <Text fontSize="sm" color="gray.600">
                  {selectedAnalyses.size} of {filteredHistory.length} selected
                </Text>
              </HStack>
            </HStack>
          )}
          
          {/* Filter controls */}
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} w="full">
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search analyses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              />
            </InputGroup>

            <Select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
            >
              <option value="all">All Sentiments</option>
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </Select>

            <Select
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value)}
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
            >
              <option value="all">All Timeframes</option>
              {availableTimeframes.map(timeframe => (
                <option key={timeframe} value={timeframe}>{timeframe}</option>
              ))}
            </Select>

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="confidence">Highest Confidence</option>
              <option value="timeframe">By Timeframe</option>
            </Select>
          </SimpleGrid>
        </VStack>
      </Box>

      {/* Results Summary */}
      {filteredHistory.length !== history.length && (
        <Text fontSize="sm" color="gray.500">
          Showing {filteredHistory.length} of {history.length} analyses
        </Text>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <Box
          textAlign="center"
          py={12}
          color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
        >
          <Icon as={FiBarChart} boxSize={12} mb={4} />
          <Text fontSize="lg" mb={2}>
            {history.length === 0 ? 'No Analysis History' : 'No Matching Results'}
          </Text>
          <Text>
            {history.length === 0 
              ? `No previous analyses found for ${ticker}`
              : 'Try adjusting your search filters'
            }
          </Text>
        </Box>
      ) : (
        <VStack spacing={4} align="stretch">
          {filteredHistory.map((analysis) => {
            const { date, time } = formatDate(analysis.timestamp);
            
            return (
              <Card
                key={analysis.id}
                cursor={isSelectionMode ? "default" : "pointer"}
                transition="all 0.2s"
                _hover={{
                  transform: isSelectionMode ? 'none' : 'translateY(-2px)',
                  shadow: 'lg'
                }}
                onClick={isSelectionMode ? undefined : () => onSelectAnalysis(analysis.id)}
                borderColor={selectedAnalyses.has(analysis.id) ? 'blue.500' : undefined}
                borderWidth={selectedAnalyses.has(analysis.id) ? '2px' : '1px'}
              >
                <CardBody>
                  <Flex justify="space-between" align="start" mb={3}>
                    <HStack spacing={3} flex={1}>
                      {/* Selection checkbox */}
                      {isSelectionMode && (
                        <Checkbox
                          isChecked={selectedAnalyses.has(analysis.id)}
                          onChange={(e) => handleSelectAnalysis(analysis.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      
                      <VStack align="start" spacing={1} flex={1}>
                        <HStack spacing={2} flexWrap="wrap">
                        <Badge
                          colorScheme={getSentimentColor(analysis.sentiment)}
                          variant="solid"
                          px={2}
                          py={1}
                          borderRadius="full"
                        >
                          <HStack spacing={1}>
                            <Icon as={getSentimentIcon(analysis.sentiment)} size="xs" />
                            <Text fontSize="xs">{analysis.sentiment.toUpperCase()}</Text>
                          </HStack>
                        </Badge>
                        
                        <Badge variant="outline" colorScheme="gray">
                          <HStack spacing={1}>
                            <Icon as={FiCalendar} size="xs" />
                            <Text fontSize="xs">{date}</Text>
                          </HStack>
                        </Badge>
                        
                        <Badge variant="outline" colorScheme="gray">
                          <HStack spacing={1}>
                            <Icon as={FiClock} size="xs" />
                            <Text fontSize="xs">{time}</Text>
                          </HStack>
                        </Badge>
                        
                        {/* Timeframe badge */}
                        {analysis.timeframe && (
                          <Badge variant="outline" colorScheme="blue">
                            <Text fontSize="xs">{analysis.timeframe}</Text>
                          </Badge>
                        )}
                        
                        {/* Trading recommendation badge */}
                        {analysis.tradingRecommendation && analysis.tradingRecommendation.action !== 'hold' && (
                          <Badge
                            variant="outline"
                            colorScheme={analysis.tradingRecommendation.action === 'buy' ? 'green' : 'red'}
                          >
                            <Text fontSize="xs">{analysis.tradingRecommendation.action.toUpperCase()}</Text>
                          </Badge>
                        )}
                      </HStack>
                      
                      <Text fontSize="sm" color="gray.600" noOfLines={2}>
                        {analysis.summary}
                      </Text>
                    </VStack>
                   </HStack>

                    <VStack align="end" spacing={2} ml={4}>
                      <Tooltip label={`Confidence: ${Math.round((analysis.confidence || 0) * 100)}%`}>
                        <Box>
                          <Progress
                            value={(analysis.confidence || 0) * 100}
                            colorScheme={
                              (analysis.confidence || 0) > 0.7 ? 'green' :
                              (analysis.confidence || 0) > 0.4 ? 'yellow' : 'red'
                            }
                            size="sm"
                            w="60px"
                          />
                        </Box>
                      </Tooltip>
                      
                      <HStack spacing={1}>
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="brand"
                          leftIcon={<Icon as={FiEye} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewAnalysis(analysis.id);
                          }}
                        >
                          View
                        </Button>
                        
                        {!isSelectionMode && onDeleteAnalysis && (
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            leftIcon={<Icon as={FiTrash2} />}
                            onClick={(e) => handleDeleteSingle(analysis.id, e)}
                          >
                            Delete
                          </Button>
                        )}
                      </HStack>
                    </VStack>
                  </Flex>

                  <Divider mb={3} />

                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                    <Box>
                      <Text fontSize="xs" color="gray.500" mb={1}>Price</Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        ${(analysis.currentPrice || 0).toFixed(2)}
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text fontSize="xs" color="gray.500" mb={1}>Key Levels</Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {analysis.keyLevelsCount || 0}
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text fontSize="xs" color="gray.500" mb={1}>Patterns</Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {analysis.patternsCount || 0}
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text fontSize="xs" color="gray.500" mb={1}>Confidence</Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {Math.round((analysis.confidence || 0) * 100)}%
                      </Text>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>
            );
          })}
        </VStack>
      )}

      {/* Load More Button (if needed) */}
      {history.length > 0 && history.length % 20 === 0 && (
        <Button
          variant="outline"
          colorScheme="brand"
          onClick={() => {
            // Handle loading more history
            console.log('Load more history');
          }}
        >
          Load More History
        </Button>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteDialogClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Selected Analyses
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete {selectedAnalyses.size} selected analyses?
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteDialogClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  handleDeleteSelected();
                  onDeleteDialogClose();
                }}
                ml={3}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Analysis Details Modal */}
      <AnalysisDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        analysisId={selectedAnalysisId}
      />
    </VStack>
  );
};

export default AnalysisHistory;