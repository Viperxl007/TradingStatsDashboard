import React from 'react';
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
  Divider,
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Image,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useColorMode,
  Flex,
  Icon
} from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiMinus, FiClock, FiTarget, FiActivity, FiBarChart } from 'react-icons/fi';
import { MacroSentimentData } from '../types/macroSentiment';

interface DetailedAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MacroSentimentData;
}

const DetailedAnalysisModal: React.FC<DetailedAnalysisModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const { colorMode } = useColorMode();

  const getTrendIcon = (direction: string) => {
    switch (direction?.toUpperCase()) {
      case 'UP': return FiTrendingUp;
      case 'DOWN': return FiTrendingDown;
      default: return FiMinus;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction?.toUpperCase()) {
      case 'UP': return 'green.500';
      case 'DOWN': return 'red.500';
      default: return 'gray.500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'green.500';
    if (confidence >= 60) return 'yellow.500';
    return 'red.500';
  };

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'BTC_SEASON': return 'orange';
      case 'ALT_SEASON': return 'purple';
      case 'TRANSITION': return 'blue';
      default: return 'gray';
    }
  };

  const getTradePermissionColor = (permission: string) => {
    switch (permission?.toUpperCase()) {
      case 'ACTIVE': return 'green';
      case 'SELECTIVE': return 'yellow';
      case 'AGGRESSIVE': return 'orange';
      case 'NO_TRADE': return 'red';
      default: return 'gray';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(10px)" />
      <ModalContent 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        maxH="90vh"
        mx={4}
      >
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={FiActivity} color="brand.500" />
            <Text>Detailed AI Market Analysis</Text>
            <Badge 
              colorScheme={getRegimeColor(data.market_regime)} 
              variant="subtle"
              fontSize="sm"
            >
              {data.market_regime.replace('_', ' ')}
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            
            {/* Analysis Summary */}
            <Box>
              <HStack spacing={2} mb={3}>
                <Icon as={FiActivity} color="blue.500" />
                <Text fontSize="lg" fontWeight="600">AI Analysis Summary</Text>
              </HStack>
              <Box 
                p={4} 
                bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'} 
                borderRadius="md"
                border="1px solid"
                borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
              >
                <Text fontSize="sm" lineHeight="1.6" whiteSpace="pre-wrap">
                  {data.ai_reasoning}
                </Text>
              </Box>
            </Box>

            <Divider />

            {/* Key Metrics */}
            <Box>
              <HStack spacing={2} mb={4}>
                <Icon as={FiTarget} color="green.500" />
                <Text fontSize="lg" fontWeight="600">Key Metrics</Text>
              </HStack>
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat>
                  <StatLabel>Overall Confidence</StatLabel>
                  <StatNumber color={getConfidenceColor(data.overall_confidence)}>
                    {data.overall_confidence}%
                  </StatNumber>
                  <StatHelpText>
                    {data.overall_confidence >= 80 ? 'High' : 
                     data.overall_confidence >= 60 ? 'Medium' : 'Low'} Confidence
                  </StatHelpText>
                </Stat>
                
                <Stat>
                  <StatLabel>BTC Trend</StatLabel>
                  <HStack>
                    <Icon as={getTrendIcon(data.btc_trend_direction)} color={getTrendColor(data.btc_trend_direction)} />
                    <StatNumber fontSize="md">{data.btc_trend_direction}</StatNumber>
                  </HStack>
                  <StatHelpText>Strength: {data.btc_trend_strength}%</StatHelpText>
                </Stat>
                
                <Stat>
                  <StatLabel>ETH Trend</StatLabel>
                  <HStack>
                    <Icon as={getTrendIcon(data.eth_trend_direction)} color={getTrendColor(data.eth_trend_direction)} />
                    <StatNumber fontSize="md">{data.eth_trend_direction}</StatNumber>
                  </HStack>
                  <StatHelpText>Strength: {data.eth_trend_strength}%</StatHelpText>
                </Stat>
                
                <Stat>
                  <StatLabel>ALT Trend</StatLabel>
                  <HStack>
                    <Icon as={getTrendIcon(data.alt_trend_direction)} color={getTrendColor(data.alt_trend_direction)} />
                    <StatNumber fontSize="md">{data.alt_trend_direction}</StatNumber>
                  </HStack>
                  <StatHelpText>Strength: {data.alt_trend_strength}%</StatHelpText>
                </Stat>
                
                <Stat>
                  <StatLabel>Trade Permission</StatLabel>
                  <Badge 
                    colorScheme={getTradePermissionColor(data.trade_permission)} 
                    variant="solid"
                    fontSize="sm"
                    px={2}
                    py={1}
                  >
                    {data.trade_permission}
                  </Badge>
                  <StatHelpText>
                    {data.trade_permission === 'ACTIVE' ? 'Safe to trade' :
                     data.trade_permission === 'SELECTIVE' ? 'Trade carefully' :
                     data.trade_permission === 'AGGRESSIVE' ? 'High activity' : 'Avoid trading'}
                  </StatHelpText>
                </Stat>
              </SimpleGrid>
            </Box>

            <Divider />

            {/* Chart Images */}
            {(data.btc_chart_image || data.eth_chart_image || data.dominance_chart_image || data.alt_strength_chart_image || data.eth_btc_ratio_chart_image) && (
              <Box>
                <HStack spacing={2} mb={4}>
                  <Icon as={FiBarChart} color="purple.500" />
                  <Text fontSize="lg" fontWeight="600">Analysis Charts</Text>
                </HStack>
                <Accordion allowMultiple>
                  {data.btc_chart_image && (
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <HStack>
                            <Icon as={FiTrendingUp} color="orange.500" />
                            <Text>Bitcoin Price Chart</Text>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <Image
                          src={`data:image/png;base64,${data.btc_chart_image}`}
                          alt="Bitcoin Price Chart"
                          maxW="100%"
                          borderRadius="md"
                          border="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                          key={`btc-${data.analysis_timestamp || Date.now()}`}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  )}
                  
                  {data.eth_chart_image && (
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <HStack>
                            <Icon as={FiTrendingUp} color="blue.400" />
                            <Text>Ethereum Price Chart</Text>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <Image
                          src={`data:image/png;base64,${data.eth_chart_image}`}
                          alt="Ethereum Price Chart"
                          maxW="100%"
                          borderRadius="md"
                          border="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                          key={`eth-${data.analysis_timestamp || Date.now()}`}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  )}
                  
                  {data.dominance_chart_image && (
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <HStack>
                            <Icon as={FiTarget} color="blue.500" />
                            <Text>Bitcoin Dominance Chart</Text>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <Image
                          src={`data:image/png;base64,${data.dominance_chart_image}`}
                          alt="Bitcoin Dominance Chart"
                          maxW="100%"
                          key={`dominance-${data.analysis_timestamp || Date.now()}`}
                          borderRadius="md"
                          border="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  )}
                  
                  {data.alt_strength_chart_image && (
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <HStack>
                            <Icon as={FiTrendingDown} color="purple.500" />
                            <Text>Alt Strength Index Chart</Text>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <Image
                          src={`data:image/png;base64,${data.alt_strength_chart_image}`}
                          alt="Alt Strength Chart"
                          maxW="100%"
                          borderRadius="md"
                          border="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                          key={`alt-strength-${data.analysis_timestamp || Date.now()}`}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  )}
                  
                  {data.eth_btc_ratio_chart_image && (
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <HStack>
                            <Icon as={FiActivity} color="green.500" />
                            <Text>ETH/BTC Ratio Chart</Text>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <Image
                          src={`data:image/png;base64,${data.eth_btc_ratio_chart_image}`}
                          alt="ETH/BTC Ratio Chart"
                          maxW="100%"
                          borderRadius="md"
                          border="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                          key={`eth-btc-ratio-${data.analysis_timestamp || Date.now()}`}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  )}
                </Accordion>
              </Box>
            )}

            <Divider />

            {/* Technical Details */}
            <Box>
              <HStack spacing={2} mb={4}>
                <Icon as={FiClock} color="gray.500" />
                <Text fontSize="lg" fontWeight="600">Technical Details</Text>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="500" mb={2}>Analysis Information</Text>
                  <VStack align="start" spacing={1}>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Analysis Time:</Text>
                      <Text fontSize="xs">{formatTimestamp(data.analysis_timestamp)}</Text>
                    </HStack>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Processing Time:</Text>
                      <Text fontSize="xs">{formatDuration(data.processing_time_ms)}</Text>
                    </HStack>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Model Used:</Text>
                      <Text fontSize="xs">{data.model_used}</Text>
                    </HStack>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Prompt Version:</Text>
                      <Text fontSize="xs">{data.prompt_version}</Text>
                    </HStack>
                  </VStack>
                </Box>
                
                <Box>
                  <Text fontSize="sm" fontWeight="500" mb={2}>Data Period</Text>
                  <VStack align="start" spacing={1}>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Period Start:</Text>
                      <Text fontSize="xs">{formatTimestamp(data.data_period_start)}</Text>
                    </HStack>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Period End:</Text>
                      <Text fontSize="xs">{formatTimestamp(data.data_period_end)}</Text>
                    </HStack>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="xs" color="gray.500">Data Hash:</Text>
                      <Text fontSize="xs" fontFamily="mono">
                        {data.chart_data_hash?.substring(0, 12)}...
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              </SimpleGrid>
            </Box>

          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close Analysis
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DetailedAnalysisModal;