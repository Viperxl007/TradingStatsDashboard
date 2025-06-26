import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Box,
  Image,
  SimpleGrid,
  Divider,
  Spinner,
  Alert,
  AlertIcon,
  useColorMode,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Progress,
  Icon,
  Tooltip,
  Card,
  CardBody,
  CardHeader,
  Heading
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiCalendar,
  FiClock,
  FiTarget,
  FiShield,
  FiDollarSign,
  FiBarChart,
  FiActivity
} from 'react-icons/fi';
import { getAnalysisDetails } from '../services/chartAnalysisService';

interface AnalysisDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId: string | null;
}

const AnalysisDetailsModal: React.FC<AnalysisDetailsModalProps> = ({
  isOpen,
  onClose,
  analysisId
}) => {
  const { colorMode } = useColorMode();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && analysisId) {
      loadAnalysisDetails();
    }
  }, [isOpen, analysisId]);

  const loadAnalysisDetails = async () => {
    if (!analysisId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const details = await getAnalysisDetails(analysisId);
      setAnalysisData(details);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load analysis details');
    } finally {
      setIsLoading(false);
    }
  };

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

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={FiBarChart} />
            <Text>Analysis Details</Text>
            {analysisData && (
              <Badge colorScheme="blue" variant="outline">
                {analysisData.ticker}
              </Badge>
            )}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          {isLoading && (
            <VStack spacing={4} py={8}>
              <Spinner size="xl" color="brand.500" />
              <Text>Loading analysis details...</Text>
            </VStack>
          )}
          
          {error && (
            <Alert status="error">
              <AlertIcon />
              {error}
            </Alert>
          )}
          
          {analysisData && !isLoading && (
            <VStack spacing={6} align="stretch">
              {/* Header Info */}
              <Card>
                <CardHeader>
                  <Heading size="md">Analysis Overview</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                    <Box>
                      <Text fontSize="sm" color="gray.500" mb={1}>Date & Time</Text>
                      <VStack align="start" spacing={1}>
                        <HStack spacing={1}>
                          <Icon as={FiCalendar} size="xs" />
                          <Text fontSize="sm">{formatDate(analysisData.timestamp).date}</Text>
                        </HStack>
                        <HStack spacing={1}>
                          <Icon as={FiClock} size="xs" />
                          <Text fontSize="sm">{formatDate(analysisData.timestamp).time}</Text>
                        </HStack>
                      </VStack>
                    </Box>
                    
                    <Box>
                      <Text fontSize="sm" color="gray.500" mb={1}>Sentiment</Text>
                      <Badge
                        colorScheme={getSentimentColor(analysisData.analysis.sentiment || 'neutral')}
                        variant="solid"
                        px={2}
                        py={1}
                        borderRadius="full"
                      >
                        <HStack spacing={1}>
                          <Icon as={getSentimentIcon(analysisData.analysis.sentiment || 'neutral')} size="xs" />
                          <Text fontSize="xs">{(analysisData.analysis.sentiment || 'neutral').toUpperCase()}</Text>
                        </HStack>
                      </Badge>
                    </Box>
                    
                    <Box>
                      <Text fontSize="sm" color="gray.500" mb={1}>Confidence</Text>
                      <VStack align="start" spacing={1}>
                        <Progress
                          value={(analysisData.analysis.confidence || analysisData.confidence_score || 0) * 100}
                          colorScheme={
                            (analysisData.analysis.confidence || analysisData.confidence_score || 0) > 0.7 ? 'green' :
                            (analysisData.analysis.confidence || analysisData.confidence_score || 0) > 0.4 ? 'yellow' : 'red'
                          }
                          size="sm"
                          w="80px"
                        />
                        <Text fontSize="sm">{Math.round((analysisData.analysis.confidence || analysisData.confidence_score || 0) * 100)}%</Text>
                      </VStack>
                    </Box>
                    
                    <Box>
                      <Text fontSize="sm" color="gray.500" mb={1}>Current Price</Text>
                      <Text fontSize="lg" fontWeight="semibold">
                        {analysisData.analysis.currentPrice || analysisData.analysis.current_price ?
                          formatPrice(analysisData.analysis.currentPrice || analysisData.analysis.current_price) :
                          'N/A'
                        }
                      </Text>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>

              <Tabs variant="enclosed" colorScheme="brand">
                <TabList>
                  <Tab>Chart Image</Tab>
                  <Tab>Trade Recommendation Chart</Tab>
                  <Tab>Trading Recommendations</Tab>
                  <Tab>Context Assessment</Tab>
                  <Tab>Support & Resistance</Tab>
                  <Tab>Technical Analysis</Tab>
                  <Tab>Raw Data</Tab>
                </TabList>

                <TabPanels>
                  {/* Chart Image Tab */}
                  <TabPanel>
                    <VStack spacing={4}>
                      <Text fontSize="lg" fontWeight="semibold">Analyzed Chart</Text>
                      {analysisData.analysis.chartImageBase64 ? (
                        <Box
                          borderWidth="1px"
                          borderRadius="lg"
                          overflow="hidden"
                          maxW="100%"
                        >
                          <Image
                            src={`data:image/png;base64,${analysisData.analysis.chartImageBase64}`}
                            alt="Analyzed Chart"
                            maxW="100%"
                            height="auto"
                          />
                        </Box>
                      ) : (
                        <Alert status="info">
                          <AlertIcon />
                          Chart image not available for this analysis
                        </Alert>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Trade Recommendation Chart Tab */}
                  <TabPanel>
                    <VStack spacing={4}>
                      <Text fontSize="lg" fontWeight="semibold">Chart with Trade Recommendations</Text>
                      {analysisData.analysis.markedUpChartImageBase64 ? (
                        <Box
                          borderWidth="1px"
                          borderRadius="lg"
                          overflow="hidden"
                          maxW="100%"
                        >
                          <Image
                            src={`data:image/png;base64,${analysisData.analysis.markedUpChartImageBase64}`}
                            alt="Chart with Trade Recommendations"
                            maxW="100%"
                            height="auto"
                          />
                        </Box>
                      ) : (
                        <Alert status="info">
                          <AlertIcon />
                          Trade recommendation chart not available for this analysis. This feature was added in a recent update.
                        </Alert>
                      )}
                      <Text fontSize="sm" color="gray.500" textAlign="center">
                        This chart shows the original analysis with all support/resistance levels and trading recommendations overlaid for historical reference.
                      </Text>
                    </VStack>
                  </TabPanel>

                  {/* Trading Recommendations Tab */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      {analysisData.analysis.recommendations ? (
                        <Card>
                          <CardHeader>
                            <Heading size="md">Trading Recommendation</Heading>
                          </CardHeader>
                          <CardBody>
                            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                              <Box>
                                <Text fontSize="sm" color="gray.500" mb={2}>Action</Text>
                                <Badge
                                  colorScheme={
                                    analysisData.analysis.recommendations.action === 'buy' ? 'green' :
                                    analysisData.analysis.recommendations.action === 'sell' ? 'red' : 'gray'
                                  }
                                  variant="solid"
                                  px={3}
                                  py={1}
                                  fontSize="md"
                                >
                                  {analysisData.analysis.recommendations.action?.toUpperCase() || 'HOLD'}
                                </Badge>
                              </Box>
                              
                              {analysisData.analysis.recommendations.entryPrice && (
                                <Box>
                                  <Text fontSize="sm" color="gray.500" mb={1}>Entry Price</Text>
                                  <HStack>
                                    <Icon as={FiDollarSign} color="blue.500" />
                                    <Text fontSize="lg" fontWeight="semibold">
                                      {formatPrice(analysisData.analysis.recommendations.entryPrice)}
                                    </Text>
                                  </HStack>
                                </Box>
                              )}
                              
                              {analysisData.analysis.recommendations.targetPrice && (
                                <Box>
                                  <Text fontSize="sm" color="gray.500" mb={1}>Target Price</Text>
                                  <HStack>
                                    <Icon as={FiTarget} color="green.500" />
                                    <Text fontSize="lg" fontWeight="semibold">
                                      {formatPrice(analysisData.analysis.recommendations.targetPrice)}
                                    </Text>
                                  </HStack>
                                </Box>
                              )}
                              
                              {analysisData.analysis.recommendations.stopLoss && (
                                <Box>
                                  <Text fontSize="sm" color="gray.500" mb={1}>Stop Loss</Text>
                                  <HStack>
                                    <Icon as={FiShield} color="red.500" />
                                    <Text fontSize="lg" fontWeight="semibold">
                                      {formatPrice(analysisData.analysis.recommendations.stopLoss)}
                                    </Text>
                                  </HStack>
                                </Box>
                              )}
                            </SimpleGrid>
                            
                            {analysisData.analysis.recommendations.reasoning && (
                              <Box mt={4}>
                                <Text fontSize="sm" color="gray.500" mb={2}>Reasoning</Text>
                                <Text fontSize="sm" p={3} bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'} borderRadius="md">
                                  {analysisData.analysis.recommendations.reasoning}
                                </Text>
                              </Box>
                            )}
                          </CardBody>
                        </Card>
                      ) : (
                        <Alert status="info">
                          <AlertIcon />
                          No trading recommendations available for this analysis
                        </Alert>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Context Assessment Tab */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      {analysisData.analysis.context_assessment ? (
                        <Card>
                          <CardHeader>
                            <HStack>
                              <Icon as={FiActivity} color="purple.500" />
                              <Heading size="md">Context Assessment</Heading>
                            </HStack>
                          </CardHeader>
                          <CardBody>
                            <Box
                              p={4}
                              bg={colorMode === 'dark' ? 'purple.900' : 'purple.50'}
                              borderRadius="md"
                              borderLeft="4px solid"
                              borderLeftColor="purple.500"
                            >
                              <Text
                                fontSize="sm"
                                lineHeight="1.6"
                                whiteSpace="pre-wrap"
                                color={colorMode === 'dark' ? 'purple.100' : 'purple.800'}
                              >
                                {analysisData.analysis.context_assessment}
                              </Text>
                            </Box>
                          </CardBody>
                        </Card>
                      ) : (
                        <Card>
                          <CardHeader>
                            <HStack>
                              <Icon as={FiActivity} color="gray.500" />
                              <Heading size="md">Context Assessment</Heading>
                            </HStack>
                          </CardHeader>
                          <CardBody>
                            <Alert status="info">
                              <AlertIcon />
                              <Text fontSize="sm">
                                No context assessment available for this analysis. This feature provides insights into how previous trading positions were considered when making the current recommendation.
                              </Text>
                            </Alert>
                          </CardBody>
                        </Card>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Support & Resistance Tab */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        {/* Support Levels */}
                        <Card>
                          <CardHeader>
                            <Heading size="md" color="green.500">Support Levels</Heading>
                          </CardHeader>
                          <CardBody>
                            {(() => {
                              // Extract support levels from the correct location in the data structure
                              const supportLevels =
                                analysisData.analysis.detailedAnalysis?.priceLevels?.support_levels ||
                                analysisData.analysis.support_resistance?.key_support_levels ||
                                analysisData.analysis.key_levels?.support ||
                                analysisData.analysis.support_levels ||
                                (analysisData.analysis.key_levels && Array.isArray(analysisData.analysis.key_levels)
                                  ? analysisData.analysis.key_levels.filter((level: any) => level.type === 'support').map((level: any) => level.price || level.level)
                                  : []) ||
                                [];
                              
                              return supportLevels.length > 0 ? (
                                <VStack spacing={2} align="stretch">
                                  {supportLevels.map((level: any, index: number) => {
                                    const price = typeof level === 'object' ? level.price : level;
                                    return (
                                      <HStack key={index} justify="space-between" p={2} bg={colorMode === 'dark' ? 'green.900' : 'green.50'} borderRadius="md">
                                        <Text fontSize="sm">Support {index + 1}</Text>
                                        <Text fontSize="sm" fontWeight="semibold">{formatPrice(price)}</Text>
                                      </HStack>
                                    );
                                  })}
                                </VStack>
                              ) : (
                                <Text fontSize="sm" color="gray.500">No support levels identified</Text>
                              );
                            })()}
                          </CardBody>
                        </Card>

                        {/* Resistance Levels */}
                        <Card>
                          <CardHeader>
                            <Heading size="md" color="red.500">Resistance Levels</Heading>
                          </CardHeader>
                          <CardBody>
                            {(() => {
                              // Extract resistance levels from the correct location in the data structure
                              const resistanceLevels =
                                analysisData.analysis.detailedAnalysis?.priceLevels?.resistance_levels ||
                                analysisData.analysis.support_resistance?.key_resistance_levels ||
                                analysisData.analysis.key_levels?.resistance ||
                                analysisData.analysis.resistance_levels ||
                                (analysisData.analysis.key_levels && Array.isArray(analysisData.analysis.key_levels)
                                  ? analysisData.analysis.key_levels.filter((level: any) => level.type === 'resistance').map((level: any) => level.price || level.level)
                                  : []) ||
                                [];
                              
                              return resistanceLevels.length > 0 ? (
                                <VStack spacing={2} align="stretch">
                                  {resistanceLevels.map((level: any, index: number) => {
                                    const price = typeof level === 'object' ? level.price : level;
                                    return (
                                      <HStack key={index} justify="space-between" p={2} bg={colorMode === 'dark' ? 'red.900' : 'red.50'} borderRadius="md">
                                        <Text fontSize="sm">Resistance {index + 1}</Text>
                                        <Text fontSize="sm" fontWeight="semibold">{formatPrice(price)}</Text>
                                      </HStack>
                                    );
                                  })}
                                </VStack>
                              ) : (
                                <Text fontSize="sm" color="gray.500">No resistance levels identified</Text>
                              );
                            })()}
                          </CardBody>
                        </Card>
                      </SimpleGrid>
                    </VStack>
                  </TabPanel>

                  {/* Technical Analysis Tab */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      {/* Summary */}
                      {analysisData.analysis.summary && (
                        <Card>
                          <CardHeader>
                            <Heading size="md">Analysis Summary</Heading>
                          </CardHeader>
                          <CardBody>
                            <Text>{analysisData.analysis.summary}</Text>
                          </CardBody>
                        </Card>
                      )}

                      {/* Technical Indicators */}
                      {analysisData.analysis.technical_indicators && (
                        <Card>
                          <CardHeader>
                            <Heading size="md">Technical Indicators</Heading>
                          </CardHeader>
                          <CardBody>
                            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                              {Object.entries(analysisData.analysis.technical_indicators).map(([key, value]: [string, any]) => (
                                <Box key={key}>
                                  <Text fontSize="sm" color="gray.500" mb={1}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                                  <Text fontSize="sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                                </Box>
                              ))}
                            </SimpleGrid>
                          </CardBody>
                        </Card>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Raw Data Tab */}
                  <TabPanel>
                    <Card>
                      <CardHeader>
                        <Heading size="md">Raw Analysis Data</Heading>
                      </CardHeader>
                      <CardBody>
                        <Box
                          as="pre"
                          fontSize="xs"
                          p={4}
                          bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
                          borderRadius="md"
                          overflow="auto"
                          maxH="400px"
                        >
                          {JSON.stringify(analysisData.analysis, null, 2)}
                        </Box>
                      </CardBody>
                    </Card>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AnalysisDetailsModal;