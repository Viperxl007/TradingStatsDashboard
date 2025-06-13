import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  Progress,
  Divider,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  useColorMode,
  Spinner,
  Alert,
  AlertIcon,
  Icon,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiTarget,
  FiShield,
  FiBarChart,
  FiActivity,
  FiCheckCircle,
  FiAlertTriangle,
  FiImage
} from 'react-icons/fi';
import { ChartAnalysisResult } from '../types/chartAnalysis';
import ChartImageViewer from './ChartImageViewer';
import EnhancedAnalysisDisplay from './EnhancedAnalysisDisplay';

interface AnalysisPanelProps {
  analysis: ChartAnalysisResult | null;
  isAnalyzing: boolean;
  ticker: string;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  isAnalyzing,
  ticker
}) => {
  const { colorMode } = useColorMode();

  // Loading state
  if (isAnalyzing) {
    return (
      <VStack spacing={6} align="center" py={12}>
        <Spinner size="xl" color="brand.500" />
        <VStack spacing={2}>
          <Text fontSize="lg" fontWeight="semibold">
            Analyzing Chart for {ticker}
          </Text>
          <Text color="gray.500" textAlign="center">
            AI is analyzing the chart to identify patterns, key levels, and trading opportunities...
          </Text>
        </VStack>
      </VStack>
    );
  }

  // No analysis state
  if (!analysis) {
    return (
      <Box
        textAlign="center"
        py={12}
        color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
      >
        <Icon as={FiBarChart} boxSize={12} mb={4} />
        <Text fontSize="lg" mb={2}>
          No Analysis Available
        </Text>
        <Text>
          Capture a chart screenshot and run analysis to see AI insights
        </Text>
      </Box>
    );
  }

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

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'green';
      case 'moderate': return 'yellow';
      case 'weak': return 'red';
      default: return 'gray';
    }
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Analysis Header */}
      <Card>
        <CardHeader>
          <Flex justify="space-between" align="center">
            <VStack align="start" spacing={1}>
              <Heading size="md">{ticker} Chart Analysis</Heading>
              <Text fontSize="sm" color="gray.500">
                {analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : 'Unknown time'}
              </Text>
            </VStack>
            
            <VStack align="end" spacing={2}>
              <Badge
                colorScheme={getSentimentColor(analysis.sentiment || 'neutral')}
                variant="solid"
                px={3}
                py={1}
                borderRadius="full"
              >
                <HStack spacing={1}>
                  <Icon as={getSentimentIcon(analysis.sentiment || 'neutral')} />
                  <Text>{analysis.sentiment?.toUpperCase() || 'UNKNOWN'}</Text>
                </HStack>
              </Badge>
              
              <HStack spacing={2}>
                <Text fontSize="sm">Confidence:</Text>
                <Progress
                  value={(analysis.confidence || 0) * 100}
                  colorScheme={(analysis.confidence || 0) > 0.7 ? 'green' : (analysis.confidence || 0) > 0.4 ? 'yellow' : 'red'}
                  size="sm"
                  w="60px"
                />
                <Text fontSize="sm" fontWeight="semibold">
                  {Math.round((analysis.confidence || 0) * 100)}%
                </Text>
              </HStack>
            </VStack>
          </Flex>
        </CardHeader>
        
        <CardBody pt={0}>
          <Text>{analysis.summary || 'No summary available'}</Text>
        </CardBody>
      </Card>

      {/* Chart Image Display */}
      {(analysis as any)?.chartImageBase64 && (
        <Card>
          <CardHeader>
            <HStack spacing={2}>
              <Icon as={FiImage} />
              <Heading size="sm">Chart Image Analyzed</Heading>
            </HStack>
          </CardHeader>
          <CardBody>
            <ChartImageViewer
              chartImage={(analysis as any).chartImageBase64}
              ticker={ticker}
              timestamp={analysis.timestamp ? new Date(analysis.timestamp * 1000).toISOString() : undefined}
            />
          </CardBody>
        </Card>
      )}

      {/* Key Statistics */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <Stat
          p={4}
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <StatLabel>Current Price</StatLabel>
          <StatNumber>${analysis.currentPrice?.toFixed(2) || '0.00'}</StatNumber>
          <StatHelpText>
            <StatArrow type={(analysis.sentiment || 'neutral') === 'bullish' ? 'increase' : 'decrease'} />
            {analysis.timeframe || 'Unknown timeframe'}
          </StatHelpText>
        </Stat>

        <Stat
          p={4}
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <StatLabel>Key Levels</StatLabel>
          <StatNumber>{analysis.keyLevels?.length || 0}</StatNumber>
          <StatHelpText>Support & Resistance</StatHelpText>
        </Stat>

        <Stat
          p={4}
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <StatLabel>Patterns Found</StatLabel>
          <StatNumber>{analysis.patterns?.length || 0}</StatNumber>
          <StatHelpText>Chart Patterns</StatHelpText>
        </Stat>
      </SimpleGrid>

      {/* Detailed Analysis Sections */}
      <Accordion allowMultiple defaultIndex={[0]}>
        {/* Trading Recommendations */}
        <AccordionItem>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              <HStack>
                <Icon as={FiTarget} color="blue.500" />
                <Text fontWeight="semibold">Trading Recommendations</Text>
              </HStack>
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="medium">Action:</Text>
                <Badge
                  colorScheme={
                    analysis.recommendations?.action === 'buy' ? 'green' :
                    analysis.recommendations?.action === 'sell' ? 'red' : 'gray'
                  }
                  variant="solid"
                >
                  {analysis.recommendations?.action?.toUpperCase() || 'UNKNOWN'}
                </Badge>
              </HStack>
              
              {analysis.recommendations?.entryPrice && (
                <HStack justify="space-between">
                  <Text fontWeight="medium">Entry Price:</Text>
                  <Text>${analysis.recommendations?.entryPrice?.toFixed(2) || '0.00'}</Text>
                </HStack>
              )}
              
              {analysis.recommendations?.targetPrice && (
                <HStack justify="space-between">
                  <Text fontWeight="medium">Target Price:</Text>
                  <Text color="green.500">${analysis.recommendations?.targetPrice?.toFixed(2) || '0.00'}</Text>
                </HStack>
              )}
              
              {analysis.recommendations?.stopLoss && (
                <HStack justify="space-between">
                  <Text fontWeight="medium">Stop Loss:</Text>
                  <Text color="red.500">${analysis.recommendations?.stopLoss?.toFixed(2) || '0.00'}</Text>
                </HStack>
              )}
              
              {analysis.recommendations?.riskReward && (
                <HStack justify="space-between">
                  <Text fontWeight="medium">Risk/Reward:</Text>
                  <Text fontWeight="semibold">1:{analysis.recommendations?.riskReward?.toFixed(2) || '0.00'}</Text>
                </HStack>
              )}
              
              <Box>
                <Text fontWeight="medium" mb={2}>Reasoning:</Text>
                <Text fontSize="sm" color="gray.600">
                  {analysis.recommendations?.reasoning || 'No reasoning provided'}
                </Text>
              </Box>
            </VStack>
          </AccordionPanel>
        </AccordionItem>

        {/* Key Levels */}
        {analysis.keyLevels?.length > 0 && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack>
                  <Icon as={FiShield} color="purple.500" />
                  <Text fontWeight="semibold">Key Levels ({analysis.keyLevels?.length || 0})</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <VStack spacing={3} align="stretch">
                {analysis.keyLevels?.map((level, index) => (
                  <Box
                    key={index}
                    p={3}
                    bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
                    borderRadius="md"
                    borderLeft="4px solid"
                    borderLeftColor={
                      level.type === 'support' ? 'green.500' :
                      level.type === 'resistance' ? 'red.500' : 'blue.500'
                    }
                  >
                    <HStack justify="space-between" mb={2}>
                      <HStack>
                        <Badge
                          colorScheme={
                            level.type === 'support' ? 'green' :
                            level.type === 'resistance' ? 'red' : 'blue'
                          }
                          variant="subtle"
                        >
                          {level.type?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        <Badge
                          colorScheme={getStrengthColor(level.strength || 'medium')}
                          variant="outline"
                        >
                          {level.strength || 'Medium'}
                        </Badge>
                      </HStack>
                      <Text fontWeight="bold">${level.price?.toFixed(2) || '0.00'}</Text>
                    </HStack>
                    
                    <Text fontSize="sm" color="gray.600">
                      {level.description || 'No description available'}
                    </Text>
                    
                    <HStack justify="space-between" mt={2}>
                      <Text fontSize="xs" color="gray.500">
                        Confidence: {Math.round((level.confidence || 0) * 100)}%
                      </Text>
                      <Progress
                        value={(level.confidence || 0) * 100}
                        colorScheme={getStrengthColor(level.strength || 'medium')}
                        size="sm"
                        w="60px"
                      />
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Chart Patterns */}
        {analysis.patterns?.length > 0 && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack>
                  <Icon as={FiActivity} color="orange.500" />
                  <Text fontWeight="semibold">Chart Patterns ({analysis.patterns?.length || 0})</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <VStack spacing={3} align="stretch">
                {analysis.patterns?.map((pattern, index) => (
                  <Box
                    key={index}
                    p={3}
                    bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
                    borderRadius="md"
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold">{pattern.name || 'Unknown Pattern'}</Text>
                      <Badge
                        colorScheme={getSentimentColor(pattern.type || 'unknown')}
                        variant="solid"
                      >
                        {pattern.type?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </HStack>
                    
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      {pattern.description || 'No description available'}
                    </Text>
                    
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.500">
                        Confidence: {Math.round((pattern.confidence || 0) * 100)}%
                      </Text>
                      <Progress
                        value={(pattern.confidence || 0) * 100}
                        colorScheme={getSentimentColor(pattern.type || 'neutral')}
                        size="sm"
                        w="60px"
                      />
                    </HStack>
                    
                    {(pattern.targetPrice || pattern.stopLoss) && (
                      <HStack spacing={4} mt={2}>
                        {pattern.targetPrice && (
                          <Text fontSize="sm">
                            Target: <Text as="span" color="green.500" fontWeight="semibold">
                              ${pattern.targetPrice?.toFixed(2) || '0.00'}
                            </Text>
                          </Text>
                        )}
                        {pattern.stopLoss && (
                          <Text fontSize="sm">
                            Stop: <Text as="span" color="red.500" fontWeight="semibold">
                              ${pattern.stopLoss?.toFixed(2) || '0.00'}
                            </Text>
                          </Text>
                        )}
                      </HStack>
                    )}
                  </Box>
                ))}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Technical Indicators */}
        {analysis.technicalIndicators?.length > 0 && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack>
                  <Icon as={FiBarChart} color="teal.500" />
                  <Text fontWeight="semibold">Technical Indicators ({analysis.technicalIndicators?.length || 0})</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {analysis.technicalIndicators?.map((indicator, index) => (
                  <Box
                    key={index}
                    p={3}
                    bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
                    borderRadius="md"
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="semibold" fontSize="sm">{indicator.name || 'Unknown Indicator'}</Text>
                      <Badge
                        colorScheme={getSentimentColor(indicator.signal || 'neutral')}
                        variant="subtle"
                        size="sm"
                      >
                        {indicator.signal || 'NEUTRAL'}
                      </Badge>
                    </HStack>
                    
                    <Text fontWeight="bold" mb={1}>
                      {indicator.value?.toFixed(4) || '0.0000'}
                    </Text>
                    
                    <Text fontSize="xs" color="gray.600">
                      {indicator.description || 'No description available'}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </AccordionPanel>
          </AccordionItem>
        )}
      </Accordion>

      {/* Enhanced Analysis Display */}
      {analysis.detailedAnalysis && (
        <Card>
          <CardHeader>
            <Heading size="sm">Enhanced Analysis Details</Heading>
          </CardHeader>
          <CardBody>
            <EnhancedAnalysisDisplay analysis={analysis} ticker={ticker} />
          </CardBody>
        </Card>
      )}

      {/* Error Display */}
      {analysis?.error && (
        <Alert status="error">
          <AlertIcon />
          <Text>{analysis?.error}</Text>
        </Alert>
      )}
    </VStack>
  );
};

export default AnalysisPanel;