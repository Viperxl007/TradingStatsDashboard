import React from 'react';
import {
  Box,
  Heading,
  Text,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  useColorModeValue,
  Grid,
  GridItem,
  Tooltip,
  Icon,
} from '@chakra-ui/react';
import { OptimalCalendarSpread } from '../types';
import ScoreThermometer from './ScoreThermometer';
import LiquidityThermometer from './LiquidityThermometer';
import { FiInfo } from 'react-icons/fi';

interface CalendarSpreadDisplayProps {
  ticker: string;
  calendarSpread: OptimalCalendarSpread;
  expectedMove: { percent: number; dollars: number };
  daysToExpiration: number;
  compact?: boolean; // Add compact mode for use in DirectSearch
}

/**
 * CalendarSpreadDisplay Component
 *
 * This component displays the optimal calendar spread for a given ticker.
 * Can be displayed in compact mode for use within other components.
 */
const CalendarSpreadDisplay: React.FC<CalendarSpreadDisplayProps> = ({ 
  ticker, 
  calendarSpread, 
  expectedMove,
  daysToExpiration,
  compact = false 
}) => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bgColor = useColorModeValue('white', 'gray.800');
  
  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Format percentage
  const formatPercent = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Calculate days between expirations
  const daysBetweenExpirations = () => {
    const frontDate = new Date(calendarSpread.frontMonth);
    const backDate = new Date(calendarSpread.backMonth);
    const diffTime = Math.abs(backDate.getTime() - frontDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  // Calculate estimated max profit (typically around 2-3x the spread cost for calendar spreads)
  const estimatedMaxProfit = calendarSpread.spreadCost * 2.8;
  
  // Calculate return on risk
  const returnOnRisk = estimatedMaxProfit / calendarSpread.spreadCost;
  
  // Calculate break-even points (approximate)
  const breakEvenLower = calendarSpread.strike - calendarSpread.spreadCost;
  const breakEvenUpper = calendarSpread.strike + calendarSpread.spreadCost;
  
  // Calculate standard probability (approximate based on IV differential)
  const standardProbability = Math.min(0.95, 0.5 + (calendarSpread.ivDifferential * 0.5));
  
  // Calculate enhanced probability with volatility crush consideration
  const enhancedProbability = Math.min(0.95, standardProbability * 1.06);
  
  // Calculate liquidity score (mock value, would be provided by backend in real implementation)
  const liquidityScore = 8.2;
  
  // Calculate front month and back month IVs based on IV differential
  // This is an approximation - in a real implementation, we would get these from the API
  const backMonthIV = 0.39; // 39%
  const frontMonthIV = backMonthIV * (1 + calendarSpread.ivDifferential);
  
  return (
    <Box
      id={`calendar-spread-${ticker}`}
      p={compact ? 3 : 4}
      mb={compact ? 0 : 6}
      mt={compact ? 0 : 8}
      borderWidth="1px"
      borderRadius="md"
      borderColor="brand.500"
      bg={useColorModeValue('gray.50', 'gray.800')}
    >
      <Heading
        size={compact ? "sm" : "md"}
        mb={4}
        color="white"
        textAlign="center"
        borderBottom={compact ? "2px solid" : "none"}
        borderColor="brand.500"
        pb={2}
      >
        {ticker} Calendar Spread Strategy
      </Heading>
      
      <Divider mb={4} />
      
      <Box mb={4}>
        <Heading as="h4" size="sm" mb={2}>
          Strategy Overview
        </Heading>
        <Text fontSize="sm" mb={3}>
          A calendar spread profits from IV differential between expiration dates and volatility crush after earnings.
        </Text>
        
        <Flex direction={["column", "row"]} justify="space-between" mb={4}>
          <Stat mb={3}>
            <StatLabel>Expected Move</StatLabel>
            <StatNumber>{(expectedMove.percent * 100).toFixed(2)}%</StatNumber>
            <StatHelpText>${expectedMove.dollars.toFixed(2)}</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Days Between Expirations</StatLabel>
            <StatNumber>{daysBetweenExpirations()}</StatNumber>
          </Stat>
        </Flex>
        
        <Flex justifyContent="space-between" alignItems="center" mb={4}>
          <Flex alignItems="center" gap={4}>
            <Flex alignItems="center">
              <Text mr={2} fontSize="sm" fontWeight="bold">Strategy Score:</Text>
              <ScoreThermometer score={calendarSpread.score} size="sm" />
            </Flex>
            <Flex alignItems="center">
              <Text mr={2} fontSize="sm" fontWeight="bold">Liquidity:</Text>
              <LiquidityThermometer 
                liquidityScore={liquidityScore} 
                hasZeroBids={false}
                size="sm"
              />
            </Flex>
          </Flex>
        </Flex>
        
        <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Front Month</Text>
            <Text fontSize="lg" fontWeight="bold">{new Date(calendarSpread.frontMonth).toLocaleDateString()}</Text>
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>IV: {(frontMonthIV * 100).toFixed(2)}%</Text>
            <Text fontSize="sm">Short Call</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Back Month</Text>
            <Text fontSize="lg" fontWeight="bold">{new Date(calendarSpread.backMonth).toLocaleDateString()}</Text>
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>IV: {(backMonthIV * 100).toFixed(2)}%</Text>
            <Text fontSize="sm">Long Call</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Strike Price</Text>
            <Text fontSize="lg" fontWeight="bold">${calendarSpread.strike.toFixed(2)}</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>IV Differential</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.400">{(calendarSpread.ivDifferential * 100).toFixed(2)}%</Text>
          </Box>
        </Grid>
        
        <Heading as="h4" size="sm" mb={2}>
          Risk/Reward Profile
        </Heading>
        
        <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Spread Cost</Text>
            <Text fontSize="lg" fontWeight="bold">${calendarSpread.spreadCost.toFixed(2)}</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Max Risk</Text>
            <Text fontSize="lg" fontWeight="bold">${calendarSpread.spreadCost.toFixed(2)}</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Est. Max Profit</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.400">${estimatedMaxProfit.toFixed(2)}</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Return on Risk</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.400">{(returnOnRisk * 100).toFixed(0)}%</Text>
          </Box>
        </Grid>
        
        <Heading as="h4" size="sm" mb={2}>
          Break-Even Points
        </Heading>
        
        <Flex mb={4}>
          <Box flex="1" mr={4}>
            <Text fontSize="sm">Lower: ${breakEvenLower.toFixed(2)}</Text>
          </Box>
          
          <Box flex="1">
            <Text fontSize="sm">Upper: ${breakEvenUpper.toFixed(2)}</Text>
          </Box>
        </Flex>
        
        <Heading as="h4" size="sm" mb={2}>
          Probability Profile
        </Heading>
        
        <Box mb={4}>
          <Text fontSize="sm">Standard Probability: {(standardProbability * 100).toFixed(2)}%</Text>
          
          <Box mt={1} p={2} borderRadius="md" bg={useColorModeValue('green.50', 'rgba(72, 187, 120, 0.1)')} borderWidth="1px" borderColor="green.200">
            <Text fontSize="sm" fontWeight="bold" color="green.500">
              Enhanced Probability: {(enhancedProbability * 100).toFixed(2)}%
            </Text>
            <Text fontSize="xs" color="green.500">
              Range: {(enhancedProbability * 0.9 * 100).toFixed(0)}% - {(enhancedProbability * 1.1 * 100).toFixed(0)}%
            </Text>
            <Text fontSize="xs" color="green.500" mt={1}>
              Accounts for post-earnings volatility crush
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CalendarSpreadDisplay;