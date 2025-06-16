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
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  useColorMode,
  Flex,
  Divider
} from '@chakra-ui/react';
import { SimulationResults } from '../types';

interface MonteCarloChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  simulationResults: SimulationResults;
  rawSimulationData?: number[]; // Raw P&L results from each simulation run
}

/**
 * MonteCarloChartModal Component
 * 
 * This component displays a modal with a dot plot chart showing all Monte Carlo
 * simulation results for a ticker's calendar spread strategy risk profile.
 */
const MonteCarloChartModal: React.FC<MonteCarloChartModalProps> = ({
  isOpen,
  onClose,
  ticker,
  simulationResults,
  rawSimulationData = []
}) => {
  const { colorMode } = useColorMode();
  
  // Early return if no simulation results
  if (!simulationResults) {
    return null;
  }
  
  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'green';
    if (probability >= 50) return 'yellow';
    if (probability >= 30) return 'orange';
    return 'red';
  };
  
  const getReturnColor = (returnPct: number) => {
    if (returnPct >= 15) return 'green';
    if (returnPct >= 8) return 'yellow';
    if (returnPct >= 0) return 'orange';
    return 'red';
  };

  // Create histogram data for the dot plot
  const createHistogramData = () => {
    if (!rawSimulationData || rawSimulationData.length === 0) {
      return [];
    }

    // Sort the data
    const sortedData = [...rawSimulationData].sort((a, b) => a - b);
    
    // Create bins for the histogram
    const minValue = Math.min(...sortedData);
    const maxValue = Math.max(...sortedData);
    const range = maxValue - minValue;
    const binCount = Math.min(50, Math.max(20, Math.floor(Math.sqrt(sortedData.length))));
    const binWidth = range / binCount;
    
    const bins: { x: number; y: number; count: number; values: number[] }[] = [];
    
    for (let i = 0; i < binCount; i++) {
      const binStart = minValue + i * binWidth;
      const binEnd = binStart + binWidth;
      const binCenter = binStart + binWidth / 2;
      
      const valuesInBin = sortedData.filter(value => 
        value >= binStart && (i === binCount - 1 ? value <= binEnd : value < binEnd)
      );
      
      bins.push({
        x: binCenter,
        y: valuesInBin.length,
        count: valuesInBin.length,
        values: valuesInBin
      });
    }
    
    return bins;
  };

  const histogramData = createHistogramData();
  const maxCount = Math.max(...histogramData.map(bin => bin.count), 1);
  
  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 300;
  const margin = { top: 20, right: 20, bottom: 60, left: 80 };
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;

  // Create scales
  const xScale = (value: number) => {
    if (histogramData.length === 0) return 0;
    const minX = Math.min(...histogramData.map(d => d.x));
    const maxX = Math.max(...histogramData.map(d => d.x));
    const range = maxX - minX;
    if (range === 0) return plotWidth / 2;
    return ((value - minX) / range) * plotWidth;
  };

  const yScale = (count: number) => {
    return plotHeight - (count / maxCount) * plotHeight;
  };

  // Generate tick marks for axes
  const generateXTicks = () => {
    if (histogramData.length === 0) return [];
    const minX = Math.min(...histogramData.map(d => d.x));
    const maxX = Math.max(...histogramData.map(d => d.x));
    const tickCount = 8;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = minX + (i / tickCount) * (maxX - minX);
      ticks.push(value);
    }
    return ticks;
  };

  const generateYTicks = () => {
    const tickCount = 5;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = (i / tickCount) * maxCount;
      ticks.push(Math.round(value));
    }
    return ticks;
  };

  const xTicks = generateXTicks();
  const yTicks = generateYTicks();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="900px">
        <ModalHeader>
          <VStack align="start" spacing={2}>
            <Text fontSize="xl" fontWeight="bold">
              Monte Carlo Risk Profile: {ticker}
            </Text>
            <Text fontSize="sm" color="gray.500">
              Calendar Spread Strategy - {simulationResults.simulationCount.toLocaleString()} Simulations
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Summary Statistics */}
            <Box
              p={4}
              borderWidth="1px"
              borderRadius="lg"
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
              bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
            >
              <HStack justify="space-between" wrap="wrap" spacing={4}>
                <VStack align="center" spacing={1}>
                  <Text fontSize="xs" color="gray.500">Probability of Profit</Text>
                  <Badge
                    colorScheme={getProbabilityColor(simulationResults.probabilityOfProfit)}
                    fontSize="lg"
                    px={3}
                    py={1}
                  >
                    {simulationResults.probabilityOfProfit}%
                  </Badge>
                </VStack>
                
                <VStack align="center" spacing={1}>
                  <Text fontSize="xs" color="gray.500">Expected Return</Text>
                  <Badge
                    colorScheme={getReturnColor(simulationResults.expectedReturn)}
                    fontSize="lg"
                    px={3}
                    py={1}
                  >
                    {simulationResults.expectedReturn > 0 ? '+' : ''}{simulationResults.expectedReturn}%
                  </Badge>
                </VStack>
                
                <VStack align="center" spacing={1}>
                  <Text fontSize="xs" color="gray.500">25th Percentile</Text>
                  <Text fontWeight="bold" fontSize="md">
                    {simulationResults.percentiles.p25}%
                  </Text>
                </VStack>
                
                <VStack align="center" spacing={1}>
                  <Text fontSize="xs" color="gray.500">Median</Text>
                  <Text fontWeight="bold" fontSize="md">
                    {simulationResults.percentiles.p50}%
                  </Text>
                </VStack>
                
                <VStack align="center" spacing={1}>
                  <Text fontSize="xs" color="gray.500">75th Percentile</Text>
                  <Text fontWeight="bold" fontSize="md">
                    {simulationResults.percentiles.p75}%
                  </Text>
                </VStack>
                
                <VStack align="center" spacing={1}>
                  <Text fontSize="xs" color="gray.500">Max Loss</Text>
                  <Text fontWeight="bold" fontSize="md" color="red.500">
                    {simulationResults.maxLossScenario}%
                  </Text>
                </VStack>
              </HStack>
            </Box>

            <Divider />

            {/* Chart */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4} textAlign="center">
                Return Distribution (% Return on Investment)
              </Text>
              
              {rawSimulationData && rawSimulationData.length > 0 ? (
                <Flex justify="center">
                  <Box position="relative">
                    <svg width={chartWidth} height={chartHeight}>
                      {/* Chart background */}
                      <rect
                        x={margin.left}
                        y={margin.top}
                        width={plotWidth}
                        height={plotHeight}
                        fill="transparent"
                        stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'}
                        strokeWidth="1"
                      />
                      
                      {/* Grid lines */}
                      {yTicks.map((tick, i) => (
                        <g key={`y-grid-${i}`}>
                          <line
                            x1={margin.left}
                            y1={margin.top + yScale(tick)}
                            x2={margin.left + plotWidth}
                            y2={margin.top + yScale(tick)}
                            stroke={colorMode === 'dark' ? '#2D3748' : '#F7FAFC'}
                            strokeWidth="1"
                          />
                        </g>
                      ))}
                      
                      {xTicks.map((tick, i) => (
                        <g key={`x-grid-${i}`}>
                          <line
                            x1={margin.left + xScale(tick)}
                            y1={margin.top}
                            x2={margin.left + xScale(tick)}
                            y2={margin.top + plotHeight}
                            stroke={colorMode === 'dark' ? '#2D3748' : '#F7FAFC'}
                            strokeWidth="1"
                          />
                        </g>
                      ))}
                      
                      {/* Zero line */}
                      <line
                        x1={margin.left + xScale(0)}
                        y1={margin.top}
                        x2={margin.left + xScale(0)}
                        y2={margin.top + plotHeight}
                        stroke={colorMode === 'dark' ? '#E53E3E' : '#E53E3E'}
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                      
                      {/* Histogram bars */}
                      {histogramData.map((bin, i) => {
                        const barWidth = Math.max(2, plotWidth / histogramData.length * 0.8);
                        const barHeight = plotHeight - yScale(bin.count);
                        const barX = margin.left + xScale(bin.x) - barWidth / 2;
                        const barY = margin.top + yScale(bin.count);
                        
                        // Color based on profit/loss
                        const color = bin.x >= 0 
                          ? (colorMode === 'dark' ? '#48BB78' : '#38A169')
                          : (colorMode === 'dark' ? '#F56565' : '#E53E3E');
                        
                        return (
                          <rect
                            key={`bar-${i}`}
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            fill={color}
                            opacity={0.7}
                          />
                        );
                      })}
                      
                      {/* X-axis */}
                      <line
                        x1={margin.left}
                        y1={margin.top + plotHeight}
                        x2={margin.left + plotWidth}
                        y2={margin.top + plotHeight}
                        stroke={colorMode === 'dark' ? '#4A5568' : '#2D3748'}
                        strokeWidth="2"
                      />
                      
                      {/* Y-axis */}
                      <line
                        x1={margin.left}
                        y1={margin.top}
                        x2={margin.left}
                        y2={margin.top + plotHeight}
                        stroke={colorMode === 'dark' ? '#4A5568' : '#2D3748'}
                        strokeWidth="2"
                      />
                      
                      {/* X-axis ticks and labels */}
                      {xTicks.map((tick, i) => (
                        <g key={`x-tick-${i}`}>
                          <line
                            x1={margin.left + xScale(tick)}
                            y1={margin.top + plotHeight}
                            x2={margin.left + xScale(tick)}
                            y2={margin.top + plotHeight + 5}
                            stroke={colorMode === 'dark' ? '#4A5568' : '#2D3748'}
                            strokeWidth="1"
                          />
                          <text
                            x={margin.left + xScale(tick)}
                            y={margin.top + plotHeight + 20}
                            textAnchor="middle"
                            fontSize="12"
                            fill={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                          >
                            {tick.toFixed(1)}%
                          </text>
                        </g>
                      ))}
                      
                      {/* Y-axis ticks and labels */}
                      {yTicks.map((tick, i) => (
                        <g key={`y-tick-${i}`}>
                          <line
                            x1={margin.left - 5}
                            y1={margin.top + yScale(tick)}
                            x2={margin.left}
                            y2={margin.top + yScale(tick)}
                            stroke={colorMode === 'dark' ? '#4A5568' : '#2D3748'}
                            strokeWidth="1"
                          />
                          <text
                            x={margin.left - 10}
                            y={margin.top + yScale(tick) + 4}
                            textAnchor="end"
                            fontSize="12"
                            fill={colorMode === 'dark' ? '#A0AEC0' : '#4A5568'}
                          >
                            {tick}
                          </text>
                        </g>
                      ))}
                      
                      {/* Axis labels */}
                      <text
                        x={margin.left + plotWidth / 2}
                        y={chartHeight - 10}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="bold"
                        fill={colorMode === 'dark' ? '#E2E8F0' : '#2D3748'}
                      >
                        Return on Investment (%)
                      </text>
                      
                      <text
                        x={15}
                        y={margin.top + plotHeight / 2}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="bold"
                        fill={colorMode === 'dark' ? '#E2E8F0' : '#2D3748'}
                        transform={`rotate(-90, 15, ${margin.top + plotHeight / 2})`}
                      >
                        Frequency
                      </text>
                    </svg>
                  </Box>
                </Flex>
              ) : (
                <Box textAlign="center" py={8}>
                  <Text color="gray.500">
                    Raw simulation data not available for charting.
                  </Text>
                  <Text fontSize="sm" color="gray.400" mt={2}>
                    Chart requires individual simulation results to display the risk distribution.
                  </Text>
                </Box>
              )}
            </Box>

            {/* Strategy Description */}
            <Box
              p={4}
              borderWidth="1px"
              borderRadius="lg"
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
              bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
            >
              <Text fontSize="sm" color="gray.600" textAlign="center">
                <strong>Earnings Volatility Calendar Spread Strategy</strong><br/>
                Entry: 15 minutes before market close | Exit: 15 minutes after market open next day<br/>
                Strategy profits from IV crush differential between front and back month options
              </Text>
            </Box>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MonteCarloChartModal;