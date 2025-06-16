import React from 'react';
import {
  Box,
  Text,
  Flex,
  Badge,
  Tooltip,
  VStack,
  HStack,
  Progress,
  useColorMode
} from '@chakra-ui/react';
import { SimulationResults } from '../types';

interface SimulationProbabilityDisplayProps {
  simulationResults: SimulationResults;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const SimulationProbabilityDisplay: React.FC<SimulationProbabilityDisplayProps> = ({
  simulationResults,
  size = 'sm',
  showDetails = false
}) => {
  const { colorMode } = useColorMode();
  
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
  
  if (size === 'sm' && !showDetails) {
    return (
      <Tooltip
        label={
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">Monte Carlo Simulation (10,000 runs)</Text>
            <Text>Probability of Profit: {simulationResults.probabilityOfProfit}%</Text>
            <Text>Expected Return: {simulationResults.expectedReturn}%</Text>
            <Text>25th Percentile: {simulationResults.percentiles.p25}%</Text>
            <Text>50th Percentile: {simulationResults.percentiles.p50}%</Text>
            <Text>75th Percentile: {simulationResults.percentiles.p75}%</Text>
            <Text>Max Loss: {simulationResults.maxLossScenario}%</Text>
            <Text fontSize="xs" color="gray.400" mt={2}>
              Specialized earnings volatility calendar spread strategy
            </Text>
          </VStack>
        }
        placement="top"
        hasArrow
      >
        <Box>
          <Badge
            colorScheme={getProbabilityColor(simulationResults.probabilityOfProfit)}
            fontSize="xs"
            px={2}
            py={1}
            borderRadius="md"
            cursor="help"
          >
            {simulationResults.probabilityOfProfit}%
          </Badge>
        </Box>
      </Tooltip>
    );
  }
  
  return (
    <Box
      p={4}
      borderWidth="1px"
      borderRadius="lg"
      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
    >
      <VStack align="stretch" spacing={3}>
        <Flex justify="space-between" align="center">
          <Text fontWeight="bold" fontSize="md">
            Monte Carlo Simulation
          </Text>
          <Text fontSize="xs" color="gray.500">
            {simulationResults.simulationCount.toLocaleString()} runs
          </Text>
        </Flex>
        
        <HStack justify="space-between">
          <VStack align="start" spacing={1}>
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
          
          <VStack align="end" spacing={1}>
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
        </HStack>
        
        <Box>
          <Text fontSize="xs" color="gray.500" mb={2}>
            Confidence: {simulationResults.confidenceInterval.low}% - {simulationResults.confidenceInterval.high}%
          </Text>
          <Progress
            value={simulationResults.probabilityOfProfit}
            colorScheme={getProbabilityColor(simulationResults.probabilityOfProfit)}
            size="sm"
            borderRadius="md"
          />
        </Box>
        
        {showDetails && (
          <VStack align="stretch" spacing={2} pt={2} borderTopWidth="1px" borderColor="gray.200">
            <Text fontSize="sm" fontWeight="medium">Outcome Distribution</Text>
            
            <HStack justify="space-between" fontSize="xs">
              <VStack align="center" spacing={0}>
                <Text color="gray.500">25th %ile</Text>
                <Text fontWeight="medium">{simulationResults.percentiles.p25}%</Text>
              </VStack>
              <VStack align="center" spacing={0}>
                <Text color="gray.500">Median</Text>
                <Text fontWeight="medium">{simulationResults.percentiles.p50}%</Text>
              </VStack>
              <VStack align="center" spacing={0}>
                <Text color="gray.500">75th %ile</Text>
                <Text fontWeight="medium">{simulationResults.percentiles.p75}%</Text>
              </VStack>
              <VStack align="center" spacing={0}>
                <Text color="gray.500">Max Loss</Text>
                <Text fontWeight="medium" color="red.500">{simulationResults.maxLossScenario}%</Text>
              </VStack>
            </HStack>
            
            <Text fontSize="xs" color="gray.400" textAlign="center" mt={2}>
              Earnings volatility calendar spread strategy<br/>
              Entry: 15min before close | Exit: 15min after open next day
            </Text>
          </VStack>
        )}
      </VStack>
    </Box>
  );
};

export default SimulationProbabilityDisplay;