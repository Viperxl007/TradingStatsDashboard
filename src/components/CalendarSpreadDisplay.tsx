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
  
  // Use the estimated max profit from the backend or calculate it as fallback
  const estimatedMaxProfit = calendarSpread.estimatedMaxProfit ||
    calendarSpread.spreadCost * 2.8; // Fallback for backward compatibility
  
  // Use the return on risk from the backend or calculate it as fallback
  const returnOnRisk = calendarSpread.returnOnRisk ||
    (estimatedMaxProfit / calendarSpread.spreadCost);
  
  // Calculate break-even points (approximate)
  const breakEvenLower = calendarSpread.strike - calendarSpread.spreadCost;
  const breakEvenUpper = calendarSpread.strike + calendarSpread.spreadCost;
  
  // Use the probability from the backend or calculate it as fallback
  const standardProbability = calendarSpread.probabilityOfProfit ||
    Math.min(0.95, 0.5 + (calendarSpread.ivDifferential * 0.5));
  
  // Use the enhanced probability from the backend or calculate it as fallback
  const enhancedProbability = calendarSpread.enhancedProbability ||
    Math.min(0.95, standardProbability * 1.06);
  
  // Get liquidity scores from the backend data
  // Handle both object and number formats for backward compatibility
  const frontLiquidityScore = typeof calendarSpread.frontLiquidity === 'number'
    ? calendarSpread.frontLiquidity
    : (calendarSpread.frontLiquidity?.score || 0);
  
  const backLiquidityScore = typeof calendarSpread.backLiquidity === 'number'
    ? calendarSpread.backLiquidity
    : (calendarSpread.backLiquidity?.score || 0);
  
  // Create liquidity detail objects with default values if they don't exist
  const frontLiquidity = typeof calendarSpread.frontLiquidity === 'object' && calendarSpread.frontLiquidity
    ? calendarSpread.frontLiquidity
    : {
        score: frontLiquidityScore,
        spread_pct: 0.05,
        volume: 0,
        open_interest: 0,
        has_zero_bid: false,
        spread_dollars: 0.05
      };
  
  const backLiquidity = typeof calendarSpread.backLiquidity === 'object' && calendarSpread.backLiquidity
    ? calendarSpread.backLiquidity
    : {
        score: backLiquidityScore,
        spread_pct: 0.05,
        volume: 0,
        open_interest: 0,
        has_zero_bid: false,
        spread_dollars: 0.05
      };
  
  // Create combined liquidity if it doesn't exist
  const combinedLiquidity = calendarSpread.combinedLiquidity || {
    score: (frontLiquidityScore + backLiquidityScore) / 2,
    front_liquidity: frontLiquidity,
    back_liquidity: backLiquidity,
    spread_impact: 0.1, // Default value
    has_zero_bids: frontLiquidity.has_zero_bid || backLiquidity.has_zero_bid
  };
  
  // Use actual IV values from the API if available
  const frontMonthIV = calendarSpread.frontIv !== undefined ? calendarSpread.frontIv : 0.39; // Default to 39% if not available
  const backMonthIV = calendarSpread.backIv !== undefined ? calendarSpread.backIv : (frontMonthIV / (1 + calendarSpread.ivDifferential));
  
  // Calculate strike distance from current price as percentage
  // We need to use the current price from the expected move calculation
  const currentPrice = expectedMove?.dollars ? expectedMove.dollars / expectedMove.percent : 0;
  const strikeDistancePercent = currentPrice ? ((calendarSpread.strike / currentPrice) - 1) * 100 : 0;
  const isStrikeOutsideExpectedMove = Math.abs(strikeDistancePercent) > (expectedMove?.percent || 0) * 100;
  
  const monteCarloProb = calendarSpread.monteCarloResults?.probabilityOfProfit;

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
        {ticker} {calendarSpread.optionType?.toUpperCase() || 'Call'} Calendar Spread Strategy
      </Heading>
      
      <Divider mb={4} />
      
      <Box mb={4}>
        <>
          <Heading as="h4" size="sm" mb={2}>
            Strategy Overview
          </Heading>
          <Text fontSize="sm" mb={3}>
            A calendar spread profits from IV differential between expiration dates and volatility crush after earnings.
          </Text>
          
          <Flex direction={["column", "row"]} justify="space-between" mb={4}>
          <Stat mb={3}>
            <StatLabel>Expected Move</StatLabel>
            <StatNumber>{(expectedMove?.percent || 0) * 100 > 0 ? ((expectedMove?.percent || 0) * 100).toFixed(2) : "0.00"}%</StatNumber>
            <StatHelpText>${(expectedMove?.dollars || 0).toFixed(2)}</StatHelpText>
          </Stat>
          
          <Stat>
            <StatLabel>Days Between Expirations</StatLabel>
            <StatNumber>{daysBetweenExpirations()}</StatNumber>
          </Stat>
        </Flex>
        
        <Flex justifyContent="space-between" alignItems="center" mb={4}>
          <Flex alignItems="center" gap={4} flexWrap="wrap">
            <Flex alignItems="center">
              <Text mr={2} fontSize="sm" fontWeight="bold">Strategy Score:</Text>
              <ScoreThermometer score={calendarSpread.score} size="sm" />
              <Text ml={2} fontSize="sm" fontWeight="bold">
                {calendarSpread.score.toFixed(0)}/100
              </Text>
              <Tooltip label="Normalized score (0-100) based on IV differential, cost efficiency, liquidity, and other factors">
                <span><Icon as={FiInfo} ml={1} fontSize="xs" /></span>
              </Tooltip>
            </Flex>
            <Flex alignItems="center">
              <Text mr={2} fontSize="sm" fontWeight="bold">Overall Liquidity:</Text>
              <LiquidityThermometer
                liquidityScore={combinedLiquidity?.score || 0}
                hasZeroBids={combinedLiquidity?.has_zero_bids || false}
                size="sm"
              />
              <Text ml={2} fontSize="sm">
                {(combinedLiquidity?.score || 0).toFixed(1)}/10
              </Text>
            </Flex>
          </Flex>
        </Flex>
        
        <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Front Month</Text>
            <Text fontSize="lg" fontWeight="bold">{new Date(calendarSpread.frontMonth).toLocaleDateString()}</Text>
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>IV: {(frontMonthIV * 100).toFixed(2)}%</Text>
            <Text fontSize="sm">Short {calendarSpread.optionType?.toUpperCase() || 'Call'}</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Back Month</Text>
            <Text fontSize="lg" fontWeight="bold">{new Date(calendarSpread.backMonth).toLocaleDateString()}</Text>
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>IV: {(backMonthIV * 100).toFixed(2)}%</Text>
            <Text fontSize="sm">Long {calendarSpread.optionType?.toUpperCase() || 'Call'}</Text>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Strike Price</Text>
            <Text fontSize="lg" fontWeight="bold">${calendarSpread.strike.toFixed(2)}</Text>
            
            {/* Show strike distance from current price */}
            {currentPrice > 0 && (
              <Text
                fontSize="sm"
                color={Math.abs(strikeDistancePercent) > 15 ? "yellow.500" : "inherit"}
              >
                {strikeDistancePercent > 0
                  ? `${strikeDistancePercent.toFixed(1)}% above current price`
                  : `${Math.abs(strikeDistancePercent).toFixed(1)}% below current price`}
              </Text>
            )}
            
            {/* Show whether strike is outside expected move */}
            {isStrikeOutsideExpectedMove && (
              <Text fontSize="xs" color="green.500" mt={1}>
                Outside expected move range
                <Tooltip label="Strike price is outside the expected price movement, which may improve probability of profit">
                  <span><Icon as={FiInfo} ml={1} fontSize="xs" /></span>
                </Tooltip>
              </Text>
            )}
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>IV Differential</Text>
            <Text fontSize="lg" fontWeight="bold" color="green.400">{(calendarSpread.ivDifferential * 100).toFixed(2)}%</Text>
            
            {/* Display IV Quality if available */}
            {calendarSpread.ivQuality && (
              <Text
                fontSize="sm"
                fontWeight="semibold"
                color={
                  calendarSpread.ivQuality === "Excellent" ? "green.500" :
                  calendarSpread.ivQuality === "Good" ? "blue.500" :
                  "gray.500"
                }
              >
                {calendarSpread.ivQuality}
                <Tooltip label="IV differential quality rating based on thresholds: Excellent (≥15%), Good (≥10%), Below threshold (<10%)">
                  <span><Icon as={FiInfo} ml={1} fontSize="xs" /></span>
                </Tooltip>
              </Text>
            )}
          </Box>
        </Grid>
        
        <Heading as="h4" size="sm" mb={2}>
          Risk/Reward Profile
        </Heading>
        
        <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Flex alignItems="center">
              <Text fontWeight="bold" mb={2}>Spread Cost</Text>
              {calendarSpread.spreadCost < 0.20 && (
                <Tooltip label="Very low spread costs often indicate pricing inefficiencies rather than opportunities">
                  <Box ml={1} mb={2}>
                    <Icon as={FiInfo} color="yellow.500" />
                  </Box>
                </Tooltip>
              )}
            </Flex>
            <Text
              fontSize="lg"
              fontWeight="bold"
              color={calendarSpread.spreadCost < 0.15 ? "yellow.500" : "inherit"}
            >
              ${calendarSpread.spreadCost.toFixed(2)}
              {calendarSpread.spreadCost < 0.15 && " ⚠️"}
            </Text>
            {calendarSpread.spreadCost < 0.15 && (
              <Text fontSize="xs" color="yellow.500">
                Warning: Extremely low cost may indicate pricing anomalies
              </Text>
            )}
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
            <Flex alignItems="center">
              <Text fontWeight="bold" mb={2}>Return on Risk</Text>
              <Tooltip label="Theoretical maximum return based on model calculations">
                <Box ml={1} mb={2}>
                  <Icon as={FiInfo} />
                </Box>
              </Tooltip>
            </Flex>
            <Text fontSize="lg" fontWeight="bold" color="green.400">{(returnOnRisk * 100).toFixed(0)}%</Text>
            
            {/* Add risk-adjusted return */}
            <Flex alignItems="center" mt={2}>
              <Text fontSize="sm" fontWeight="bold">Risk-Adjusted:</Text>
              <Tooltip label="Factors in spread impact, liquidity constraints, and execution probability">
                <Box ml={1}>
                  <Icon as={FiInfo} fontSize="xs" />
                </Box>
              </Tooltip>
            </Flex>
            <Text
              fontSize="md"
              fontWeight="bold"
              color={
                returnOnRisk * (1 - (combinedLiquidity?.spread_impact || 0.1)) *
                (Math.min(1, (combinedLiquidity?.score || 5) / 10)) > 0.5
                  ? "green.400"
                  : "yellow.500"
              }
            >
              {(returnOnRisk *
                (1 - (combinedLiquidity?.spread_impact || 0.1)) *
                (Math.min(1, (combinedLiquidity?.score || 5) / 10)) * 100).toFixed(0)}%
            </Text>
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
          Liquidity Details
        </Heading>
        
        {/* Add liquidity warning if either leg has poor liquidity */}
        {(frontLiquidity.score < 4.0 || backLiquidity.score < 4.0) && (
          <Box p={2} mb={3} borderRadius="md" bg={useColorModeValue('yellow.50', 'rgba(236, 201, 75, 0.1)')} borderWidth="1px" borderColor="yellow.200">
            <Flex alignItems="center">
              <Text fontSize="sm" fontWeight="bold" color="yellow.600">Liquidity Warning</Text>
              <Tooltip label="Low liquidity makes execution difficult and increases slippage">
                <span><Icon as={FiInfo} ml={1} color="yellow.600" /></span>
              </Tooltip>
            </Flex>
            <Text fontSize="xs" color="yellow.600" mt={1}>
              {frontLiquidity.score < 4.0 && backLiquidity.score < 4.0
                ? "Both legs have poor liquidity - execution may be difficult"
                : frontLiquidity.score < 4.0
                  ? "Front month has poor liquidity - may be difficult to close position"
                  : "Back month has poor liquidity - may be difficult to establish position"}
            </Text>
            <Text fontSize="xs" color="yellow.600" mt={1}>
              Minimum recommended liquidity: 4.0/10
            </Text>
          </Box>
        )}
        
        <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={4}>
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Front Month Liquidity</Text>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Bid/Ask:</Text>
              <Text fontSize="sm" fontWeight="bold">
                ${frontLiquidity.spread_dollars.toFixed(2)} ({(frontLiquidity.spread_pct * 100).toFixed(0)}%)
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Volume:</Text>
              <Text fontSize="sm" fontWeight="bold">
                {frontLiquidity.volume > 0 ? frontLiquidity.volume.toLocaleString() : "N/A"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Open Interest:</Text>
              <Text fontSize="sm" fontWeight="bold">
                {frontLiquidity.open_interest > 0 ? frontLiquidity.open_interest.toLocaleString() : "N/A"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Score:</Text>
              <Text fontSize="sm" fontWeight="bold" color={frontLiquidity.score >= 7 ? "green.400" : frontLiquidity.score >= 3 ? "yellow.400" : "red.400"}>
                {frontLiquidity.score.toFixed(1)}/10
              </Text>
            </Flex>
          </Box>
          
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Text fontWeight="bold" mb={2}>Back Month Liquidity</Text>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Bid/Ask:</Text>
              <Text fontSize="sm" fontWeight="bold">
                ${backLiquidity.spread_dollars.toFixed(2)} ({(backLiquidity.spread_pct * 100).toFixed(0)}%)
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Volume:</Text>
              <Text fontSize="sm" fontWeight="bold">
                {backLiquidity.volume > 0 ? backLiquidity.volume.toLocaleString() : "N/A"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Open Interest:</Text>
              <Text fontSize="sm" fontWeight="bold">
                {backLiquidity.open_interest > 0 ? backLiquidity.open_interest.toLocaleString() : "N/A"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text fontSize="sm">Score:</Text>
              <Text fontSize="sm" fontWeight="bold" color={backLiquidity.score >= 7 ? "green.400" : backLiquidity.score >= 3 ? "yellow.400" : "red.400"}>
                {backLiquidity.score.toFixed(1)}/10
              </Text>
            </Flex>
          </Box>
        </Grid>
        
        <Box mt={3} p={3} borderRadius="md"
             bg={combinedLiquidity && combinedLiquidity.spread_impact > 0.3 ?
                useColorModeValue('red.50', 'rgba(245, 101, 101, 0.1)') :
                useColorModeValue('green.50', 'rgba(72, 187, 120, 0.1)')
             }
             borderWidth="1px"
             borderColor={combinedLiquidity && combinedLiquidity.spread_impact > 0.3 ? "red.200" : "green.200"}>
          <Flex justifyContent="space-between" alignItems="center">
            <Flex alignItems="center">
              <Text fontSize="sm" fontWeight="bold">Spread Impact:</Text>
              <Tooltip label="The percentage of your spread cost consumed by bid-ask spreads. Higher values make execution difficult and reduce profitability.">
                <span><Icon as={FiInfo} ml={1} /></span>
              </Tooltip>
            </Flex>
            <Text fontSize="sm"
                  fontWeight="bold"
                  color={combinedLiquidity && combinedLiquidity.spread_impact > 0.3 ? "red.500" : "green.500"}>
              {((combinedLiquidity?.spread_impact || 0.1) * 100).toFixed(0)}% of cost
            </Text>
          </Flex>
          
          {combinedLiquidity && combinedLiquidity.spread_impact > 0.3 ? (
            <>
              <Text fontSize="xs" color="red.500" fontWeight="bold" mt={1}>
                Warning: High spread impact significantly reduces profitability
              </Text>
              <Text fontSize="xs" color="red.500" mt={1}>
                {combinedLiquidity.spread_impact > 0.5 ?
                  "Execution may be impractical despite theoretical score" :
                  "Consider only if other metrics are exceptionally strong"}
              </Text>
            </>
          ) : (
            <Text fontSize="xs" color="green.500" mt={1}>
              Good: Low spread impact on trade cost
            </Text>
          )}
          
          <Text fontSize="xs" mt={1} fontStyle="italic">
            Realistic ROI: ~{(returnOnRisk * (1 - (combinedLiquidity?.spread_impact || 0.1)) * 100).toFixed(0)}%
            (adjusted for spread impact)
          </Text>
        </Box>
        
        <Heading as="h4" size="sm" mb={2} mt={4}>
          Probability Profile
        </Heading>
        
        {/* Add debug logging outside of JSX completely */}
        {calendarSpread.monteCarloResults && monteCarloProb !== undefined &&
          console.log('CalendarSpreadDisplay: monteCarloResults', {
            monteCarloProb,
            raw_probability: calendarSpread.monteCarloResults.raw_probability,
            numSimulations: calendarSpread.monteCarloResults.numSimulations,
            monteCarloResults: calendarSpread.monteCarloResults
          })
        }
        
        <Box mb={4}>
          {calendarSpread.monteCarloResults && monteCarloProb !== undefined ? (
            <Box p={2} borderRadius="md" bg={useColorModeValue('blue.50', 'rgba(66, 153, 225, 0.1)')} borderWidth="1px" borderColor="blue.200">
              <Text fontSize="sm" fontWeight="bold" color="blue.500">
                Monte Carlo Probability: {(monteCarloProb * 100).toFixed(2)}%
              </Text>
              
              {/* Display raw probability if available */}
              {calendarSpread.monteCarloResults.raw_probability !== undefined && (
                <Flex alignItems="center" mt={1}>
                  <Text fontSize="xs" color="blue.500">
                    Raw Probability: {(calendarSpread.monteCarloResults.raw_probability * 100).toFixed(2)}%
                  </Text>
                  <Tooltip label="Raw probability before conservative adjustments are applied">
                    <span><Icon as={FiInfo} ml={1} fontSize="xs" /></span>
                  </Tooltip>
                </Flex>
              )}
              
              <Text fontSize="xs" color="blue.500">
                Based on {calendarSpread.monteCarloResults.expectedProfit >= 0 ? "positive" : "negative"} expected profit of ${calendarSpread.monteCarloResults.expectedProfit.toFixed(2)}
              </Text>
              <Text fontSize="xs" color="blue.500" mt={1}>
                Based on {calendarSpread.monteCarloResults.numSimulations?.toLocaleString() || 500} simulations
              </Text>
              <Text fontSize="xs" color="blue.500">
                Simulates price movement and volatility crush with realistic transaction costs
              </Text>
            </Box>
          ) : (
            <>
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
            </>
          )}
        </Box>
        </>
      </Box>
    </Box>
  );
};

export default CalendarSpreadDisplay;