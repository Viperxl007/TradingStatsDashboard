import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  useColorMode,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
  ListIcon,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Icon,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tooltip
} from '@chakra-ui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiShield,
  FiActivity,
  FiBarChart,
  FiCheckCircle,
  FiAlertTriangle,
  FiInfo,
  FiDollarSign
} from 'react-icons/fi';
import { ChartAnalysisResult } from '../types/chartAnalysis';

interface EnhancedAnalysisDisplayProps {
  analysis: ChartAnalysisResult;
  ticker: string;
}

const EnhancedAnalysisDisplay: React.FC<EnhancedAnalysisDisplayProps> = ({
  analysis,
  ticker
}) => {
  const { colorMode } = useColorMode();

  const detailedAnalysis = analysis.detailedAnalysis;
  const analysisStages = analysis.analysisStages;

  if (!detailedAnalysis) {
    return (
      <Alert status="info">
        <AlertIcon />
        <AlertTitle>Enhanced Analysis Not Available</AlertTitle>
        <AlertDescription>
          This analysis was performed with the basic analyzer. Enhanced multi-stage analysis data is not available.
        </AlertDescription>
      </Alert>
    );
  }

  const getStageStatus = (stageSuccess?: boolean) => {
    if (stageSuccess === undefined) return { color: 'gray', icon: FiInfo, text: 'Unknown' };
    return stageSuccess 
      ? { color: 'green', icon: FiCheckCircle, text: 'Success' }
      : { color: 'red', icon: FiAlertTriangle, text: 'Failed' };
  };

  const formatPrice = (price: number | undefined) => {
    return price ? `$${price.toFixed(2)}` : 'N/A';
  };

  const getTrendColor = (trend: string) => {
    if (trend?.includes('bullish')) return 'green';
    if (trend?.includes('bearish')) return 'red';
    return 'gray';
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Analysis Stages Status */}
      {analysisStages && (
        <Card>
          <CardHeader>
            <Heading size="sm">Analysis Stages Status</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
              {[
                { key: 'stage1_success', label: 'Initial Analysis' },
                { key: 'stage2_success', label: 'Technical Indicators' },
                { key: 'stage3_success', label: 'Price Levels' },
                { key: 'stage4_success', label: 'Trading Recommendations' }
              ].map(({ key, label }) => {
                const status = getStageStatus(analysisStages[key as keyof typeof analysisStages]);
                return (
                  <HStack key={key} spacing={2}>
                    <Icon as={status.icon} color={`${status.color}.500`} />
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xs" fontWeight="semibold">{label}</Text>
                      <Text fontSize="xs" color={`${status.color}.500`}>{status.text}</Text>
                    </VStack>
                  </HStack>
                );
              })}
            </SimpleGrid>
          </CardBody>
        </Card>
      )}

      <Accordion allowMultiple defaultIndex={[0]}>
        {/* Chart Overview */}
        {detailedAnalysis.chartOverview && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack spacing={2}>
                  <Icon as={FiBarChart} />
                  <Text fontWeight="semibold">Chart Overview</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Overall Trend</Text>
                    <Badge
                      colorScheme={getTrendColor(detailedAnalysis.chartOverview.overall_trend)}
                      variant="solid"
                      px={2}
                      py={1}
                    >
                      {detailedAnalysis.chartOverview.overall_trend?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </Box>
                  
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Trend Strength</Text>
                    <Text fontSize="sm">{detailedAnalysis.chartOverview.trend_strength || 'Unknown'}</Text>
                  </Box>
                  
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Timeframe Detected</Text>
                    <Text fontSize="sm">{detailedAnalysis.chartOverview.timeframe_detected || 'Unknown'}</Text>
                  </Box>
                </VStack>
                
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Current Price Estimate</Text>
                    <Text fontSize="sm" fontWeight="bold" color="blue.500">
                      {formatPrice(detailedAnalysis.chartOverview.current_price_estimate)}
                    </Text>
                  </Box>
                  
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Price Range Visible</Text>
                    <Text fontSize="sm">
                      {detailedAnalysis.chartOverview.price_range_visible ? 
                        `${formatPrice(detailedAnalysis.chartOverview.price_range_visible.low)} - ${formatPrice(detailedAnalysis.chartOverview.price_range_visible.high)}` : 
                        'Unknown'
                      }
                    </Text>
                  </Box>
                  
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Price Action Summary</Text>
                    <Text fontSize="sm">{detailedAnalysis.chartOverview.price_action_summary || 'No summary available'}</Text>
                  </Box>
                </VStack>
              </SimpleGrid>
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Technical Indicators */}
        {detailedAnalysis.technicalIndicators && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack spacing={2}>
                  <Icon as={FiActivity} />
                  <Text fontWeight="semibold">Technical Indicators</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={4}>
                {/* Volume Analysis */}
                {detailedAnalysis.technicalIndicators.volume_analysis && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Volume Bars</Text>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <Box>
                        <Text fontSize="xs" color="gray.500">Visible</Text>
                        <Badge colorScheme={detailedAnalysis.technicalIndicators.volume_analysis.volume_visible ? 'green' : 'red'}>
                          {detailedAnalysis.technicalIndicators.volume_analysis.volume_visible ? 'Yes' : 'No'}
                        </Badge>
                      </Box>
                      {detailedAnalysis.technicalIndicators.volume_analysis.volume_visible && (
                        <>
                          <Box>
                            <Text fontSize="xs" color="gray.500">Volume Trend</Text>
                            <Text fontSize="sm">
                              {detailedAnalysis.technicalIndicators.volume_analysis.volume_trend || 'Unknown'}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500">vs Average</Text>
                            <Text fontSize="sm">
                              {detailedAnalysis.technicalIndicators.volume_analysis.volume_vs_average || 'Unknown'}
                            </Text>
                          </Box>
                        </>
                      )}
                    </SimpleGrid>
                  </Box>
                )}

                {/* Simple Moving Averages */}
                {detailedAnalysis.technicalIndicators.moving_averages && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Simple Moving Averages</Text>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      {/* 20 SMA */}
                      <Box>
                        <Text fontSize="xs" color="gray.500">20 SMA (Orange)</Text>
                        <VStack align="start" spacing={1}>
                          <Badge colorScheme={detailedAnalysis.technicalIndicators.moving_averages.sma_20_visible ? 'green' : 'red'}>
                            {detailedAnalysis.technicalIndicators.moving_averages.sma_20_visible ? 'Visible' : 'Not Visible'}
                          </Badge>
                          {detailedAnalysis.technicalIndicators.moving_averages.sma_20_visible && (
                            <Text fontSize="xs">
                              Price: {detailedAnalysis.technicalIndicators.moving_averages.price_vs_sma20 || 'Unknown'}
                            </Text>
                          )}
                        </VStack>
                      </Box>
                      
                      {/* 50 SMA */}
                      <Box>
                        <Text fontSize="xs" color="gray.500">50 SMA (Teal)</Text>
                        <VStack align="start" spacing={1}>
                          <Badge colorScheme={detailedAnalysis.technicalIndicators.moving_averages.sma_50_visible ? 'green' : 'red'}>
                            {detailedAnalysis.technicalIndicators.moving_averages.sma_50_visible ? 'Visible' : 'Not Visible'}
                          </Badge>
                          {detailedAnalysis.technicalIndicators.moving_averages.sma_50_visible && (
                            <Text fontSize="xs">
                              Price: {detailedAnalysis.technicalIndicators.moving_averages.price_vs_sma50 || 'Unknown'}
                            </Text>
                          )}
                        </VStack>
                      </Box>
                      
                      {/* 200 SMA */}
                      <Box>
                        <Text fontSize="xs" color="gray.500">200 SMA (Purple)</Text>
                        <VStack align="start" spacing={1}>
                          <Badge colorScheme={detailedAnalysis.technicalIndicators.moving_averages.sma_200_visible ? 'green' : 'red'}>
                            {detailedAnalysis.technicalIndicators.moving_averages.sma_200_visible ? 'Visible' : 'Not Visible'}
                          </Badge>
                          {detailedAnalysis.technicalIndicators.moving_averages.sma_200_visible && (
                            <Text fontSize="xs">
                              Price: {detailedAnalysis.technicalIndicators.moving_averages.price_vs_sma200 || 'Unknown'}
                            </Text>
                          )}
                        </VStack>
                      </Box>
                    </SimpleGrid>
                    
                    {/* SMA Alignment */}
                    {(detailedAnalysis.technicalIndicators.moving_averages.sma_20_visible ||
                      detailedAnalysis.technicalIndicators.moving_averages.sma_50_visible ||
                      detailedAnalysis.technicalIndicators.moving_averages.sma_200_visible) && (
                      <Box mt={3}>
                        <Text fontSize="xs" color="gray.500">SMA Alignment</Text>
                        <Badge
                          colorScheme={getTrendColor(detailedAnalysis.technicalIndicators.moving_averages.sma_alignment)}
                          variant="outline"
                        >
                          {detailedAnalysis.technicalIndicators.moving_averages.sma_alignment || 'Unknown'}
                        </Badge>
                      </Box>
                    )}
                  </Box>
                )}

                {/* VWAP Analysis */}
                {detailedAnalysis.technicalIndicators.vwap_analysis && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>VWAP (Light Green/Cream Dotted)</Text>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      <Box>
                        <Text fontSize="xs" color="gray.500">Visible</Text>
                        <Badge colorScheme={detailedAnalysis.technicalIndicators.vwap_analysis.vwap_visible ? 'green' : 'red'}>
                          {detailedAnalysis.technicalIndicators.vwap_analysis.vwap_visible ? 'Yes' : 'No'}
                        </Badge>
                      </Box>
                      {detailedAnalysis.technicalIndicators.vwap_analysis.vwap_visible && (
                        <>
                          <Box>
                            <Text fontSize="xs" color="gray.500">Price vs VWAP</Text>
                            <Text fontSize="sm">
                              {detailedAnalysis.technicalIndicators.vwap_analysis.price_vs_vwap || 'Unknown'}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500">VWAP Slope</Text>
                            <Text fontSize="sm">
                              {detailedAnalysis.technicalIndicators.vwap_analysis.vwap_slope || 'Unknown'}
                            </Text>
                          </Box>
                        </>
                      )}
                    </SimpleGrid>
                  </Box>
                )}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Price Levels */}
        {detailedAnalysis.priceLevels && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack spacing={2}>
                  <Icon as={FiTarget} />
                  <Text fontWeight="semibold">Price Levels & Patterns</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={4}>
                {/* Support Levels */}
                {detailedAnalysis.priceLevels.support_levels?.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Support Levels</Text>
                    <List spacing={2}>
                      {detailedAnalysis.priceLevels.support_levels.map((level: any, index: number) => (
                        <ListItem key={index}>
                          <ListIcon as={FiShield} color="green.500" />
                          <HStack spacing={2} display="inline-flex">
                            <Text fontWeight="bold">{formatPrice(level.price)}</Text>
                            <Badge colorScheme="green" variant="outline" size="sm">
                              {level.strength}
                            </Badge>
                            <Text fontSize="sm" color="gray.500">
                              {level.description}
                            </Text>
                          </HStack>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Resistance Levels */}
                {detailedAnalysis.priceLevels.resistance_levels?.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Resistance Levels</Text>
                    <List spacing={2}>
                      {detailedAnalysis.priceLevels.resistance_levels.map((level: any, index: number) => (
                        <ListItem key={index}>
                          <ListIcon as={FiTarget} color="red.500" />
                          <HStack spacing={2} display="inline-flex">
                            <Text fontWeight="bold">{formatPrice(level.price)}</Text>
                            <Badge colorScheme="red" variant="outline" size="sm">
                              {level.strength}
                            </Badge>
                            <Text fontSize="sm" color="gray.500">
                              {level.description}
                            </Text>
                          </HStack>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Chart Patterns */}
                {detailedAnalysis.priceLevels.chart_patterns?.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Chart Patterns</Text>
                    <VStack align="stretch" spacing={2}>
                      {detailedAnalysis.priceLevels.chart_patterns.map((pattern: any, index: number) => (
                        <Box
                          key={index}
                          p={3}
                          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                        >
                          <HStack justify="space-between" mb={2}>
                            <Text fontWeight="semibold">{pattern.pattern_name}</Text>
                            <Badge
                              colorScheme={pattern.pattern_type === 'reversal' ? 'orange' : 'blue'}
                              variant="solid"
                            >
                              {pattern.pattern_type}
                            </Badge>
                          </HStack>
                          <Text fontSize="sm" color="gray.500" mb={1}>
                            {pattern.pattern_description}
                          </Text>
                          {pattern.target_price && (
                            <Text fontSize="sm">
                              <strong>Target:</strong> {formatPrice(pattern.target_price)}
                            </Text>
                          )}
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Trading Analysis */}
        {detailedAnalysis.tradingAnalysis && (
          <AccordionItem>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                <HStack spacing={2}>
                  <Icon as={FiDollarSign} />
                  <Text fontWeight="semibold">Trading Analysis</Text>
                </HStack>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={4}>
                {/* Trading Bias */}
                {detailedAnalysis.tradingAnalysis.trading_bias && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Trading Bias</Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Box>
                        <Text fontSize="xs" color="gray.500">Direction</Text>
                        <Badge
                          colorScheme={getTrendColor(detailedAnalysis.tradingAnalysis.trading_bias.direction)}
                          variant="solid"
                          px={2}
                          py={1}
                        >
                          {detailedAnalysis.tradingAnalysis.trading_bias.direction?.toUpperCase()}
                        </Badge>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.500">Conviction</Text>
                        <Text fontSize="sm">{detailedAnalysis.tradingAnalysis.trading_bias.conviction}</Text>
                      </Box>
                    </SimpleGrid>
                    <Text fontSize="sm" mt={2} color="gray.600">
                      {detailedAnalysis.tradingAnalysis.trading_bias.reasoning}
                    </Text>
                  </Box>
                )}

                {/* Entry Strategies */}
                {detailedAnalysis.tradingAnalysis.entry_strategies?.length > 0 && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Entry Strategies</Text>
                    <VStack align="stretch" spacing={2}>
                      {detailedAnalysis.tradingAnalysis.entry_strategies.map((strategy: any, index: number) => (
                        <Box
                          key={index}
                          p={3}
                          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                          borderRadius="md"
                          borderWidth="1px"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                        >
                          <HStack justify="space-between" mb={1}>
                            <Text fontWeight="semibold">{strategy.strategy_type}</Text>
                            <Badge colorScheme="blue" variant="outline">
                              {strategy.probability} probability
                            </Badge>
                          </HStack>
                          <Text fontSize="sm">
                            <strong>Entry:</strong> {formatPrice(strategy.entry_price)}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {strategy.entry_condition}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}

                {/* Risk Management */}
                {detailedAnalysis.tradingAnalysis.risk_management && (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Risk Management</Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      {detailedAnalysis.tradingAnalysis.risk_management.stop_loss_levels?.length > 0 && (
                        <Box>
                          <Text fontSize="xs" color="gray.500">Stop Loss Levels</Text>
                          {detailedAnalysis.tradingAnalysis.risk_management.stop_loss_levels.map((stop: any, index: number) => (
                            <Text key={index} fontSize="sm">
                              {formatPrice(stop.price)} ({stop.type})
                            </Text>
                          ))}
                        </Box>
                      )}
                      <Box>
                        <Text fontSize="xs" color="gray.500">Risk/Reward Ratio</Text>
                        <Text fontSize="sm">
                          {detailedAnalysis.tradingAnalysis.risk_management.risk_reward_ratio || 'Not specified'}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Box>
                )}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        )}
      </Accordion>

      {/* Analysis Errors */}
      {analysis.errors && analysis.errors.length > 0 && (
        <Alert status="warning">
          <AlertIcon />
          <Box>
            <AlertTitle>Analysis Warnings</AlertTitle>
            <AlertDescription>
              <List spacing={1}>
                {analysis.errors.map((error, index) => (
                  <ListItem key={index} fontSize="sm">
                    • {error}
                  </ListItem>
                ))}
              </List>
            </AlertDescription>
          </Box>
        </Alert>
      )}
    </VStack>
  );
};

export default EnhancedAnalysisDisplay;