import React from 'react';
import {
  Box,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  useColorModeValue,
  TableContainer,
  Tooltip
} from '@chakra-ui/react';
import { NakedOption, OptimalNakedOptions } from '../types';
import ScoreThermometer from './ScoreThermometer';

interface NakedOptionsDisplayProps {
  ticker: string;
  nakedOptions: OptimalNakedOptions;
  compact?: boolean; // Add compact mode for use in DirectSearch
}

/**
 * NakedOptionsDisplay Component
 *
 * This component displays the optimal naked options for a given ticker.
 * Can be displayed in compact mode for use within other components.
 */
const NakedOptionsDisplay: React.FC<NakedOptionsDisplayProps> = ({ ticker, nakedOptions, compact = false }) => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bgColor = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  
  // Add debugging
  React.useEffect(() => {
    console.log(`NakedOptionsDisplay for ${ticker}:`, nakedOptions);
  }, [ticker, nakedOptions]);

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

  return (
    <Box
      id={`naked-options-${ticker}`}
      p={compact ? 3 : 4}
      mb={compact ? 0 : 6}
      mt={compact ? 0 : 8}
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
        {ticker} Naked Options Opportunities
      </Heading>
      
      <Flex
        direction={{ base: 'column', md: 'row' }}
        gap={4}
        mb={4}
        p={compact ? 2 : 4}
        bg={compact ? 'transparent' : headerBg}
        borderRadius="md"
      >
        <Stat size={compact ? "sm" : "md"}>
          <StatLabel>Expected Move</StatLabel>
          <StatNumber fontSize={compact ? "lg" : "xl"}>{formatPercent(nakedOptions.expectedMove.percent)}</StatNumber>
          <StatHelpText>{formatCurrency(nakedOptions.expectedMove.dollars)}</StatHelpText>
        </Stat>
        
        <Stat size={compact ? "sm" : "md"}>
          <StatLabel>Days to Expiration</StatLabel>
          <StatNumber fontSize={compact ? "lg" : "xl"}>{nakedOptions.daysToExpiration}</StatNumber>
          <StatHelpText>After Earnings</StatHelpText>
        </Stat>
        
        {!compact && (
          <Box flex="1">
            <Text fontWeight="medium" mb={1}>Expected Price Range:</Text>
            <Box position="relative" h="40px" mt={2}>
              {/* Current price marker */}
              <Box
                position="absolute"
                left="50%"
                top="0"
                bottom="0"
                width="2px"
                bg="yellow.500"
                transform="translateX(-50%)"
              />
              <Text
                position="absolute"
                left="50%"
                bottom="-20px"
                fontSize="xs"
                transform="translateX(-50%)"
                fontWeight="bold"
              >
                Current Price
              </Text>
              
              {/* Expected move range */}
              <Box
                position="absolute"
                left="25%"
                right="25%"
                top="15px"
                height="10px"
                bg="gray.200"
                borderRadius="full"
              />
              
              {/* Break-even markers for top options */}
              {nakedOptions.topOptions.slice(0, 3).map((option, idx) => {
                // Get the current price from the first option's strike (approximation)
                // In a real implementation, we would get this from the API
                const currentPrice = nakedOptions.topOptions[0].strike;
                
                // Calculate expected move in dollars
                const expectedMoveDollars = nakedOptions.expectedMove.dollars;
                
                // Position from 0% (far left) to 100% (far right)
                // Center is 50%
                let position = 50; // Start at center
                
                // Adjust based on break-even relative to current price
                // Scale by expected move (±25% of width represents expected move)
                const scaleFactor = 25 / expectedMoveDollars;
                position += (option.breakEven - currentPrice) * scaleFactor;
                
                // Clamp between 5% and 95% to keep visible
                position = Math.max(5, Math.min(95, position));
                
                return (
                  <Tooltip
                    key={idx}
                    label={`${option.type.toUpperCase()} Break-even: $${option.breakEven.toFixed(2)}`}
                    placement="top"
                  >
                    <Box
                      position="absolute"
                      left={`${position}%`}
                      top="10px"
                      width="12px"
                      height="20px"
                      borderRadius="sm"
                      bg={option.type === 'put' ? 'purple.500' : 'blue.500'}
                      transform="translateX(-50%)"
                      border="2px solid white"
                      boxShadow="md"
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        )}
      </Flex>
      
      <Divider mb={compact ? 2 : 4} />
      
      <Text fontWeight="medium" mb={2} fontSize={compact ? "sm" : "md"}>Top Naked Options Opportunities:</Text>
      
      <TableContainer>
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th textAlign="center">Type</Th>
              <Th textAlign="center">Strike</Th>
              <Th textAlign="center">Premium</Th>
              <Th textAlign="center">Break-Even</Th>
              <Th textAlign="center">ROC</Th>
              {!compact && <Th textAlign="center">Prob. OTM</Th>}
              {!compact && <Th textAlign="center">IV</Th>}
              {!compact && <Th textAlign="center">Margin Req.</Th>}
              {!compact && <Th textAlign="center">Max Loss</Th>}
              <Th textAlign="center">Score</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(compact ? nakedOptions.topOptions.slice(0, 3) : nakedOptions.topOptions).map((option, index) => (
              <Tr key={index}>
                <Td textAlign="center">
                  <Badge colorScheme={option.type === 'put' ? 'purple' : 'blue'}>
                    {option.type.toUpperCase()}
                  </Badge>
                </Td>
                <Td textAlign="center">${option.strike.toFixed(2)}</Td>
                <Td textAlign="center">{formatCurrency(option.premium)}</Td>
                <Td textAlign="center">
                  <Tooltip
                    label={`Break-even price: $${option.breakEven.toFixed(2)} (${option.breakEvenPct > 0 ? "+" : ""}${option.breakEvenPct.toFixed(2)}% from current price)
${option.outsideExpectedMove === "true"
  ? "✓ Outside expected move range - higher probability of profit"
  : "⚠ Inside expected move range - consider risk carefully"}`}
                    placement="top"
                    hasArrow
                  >
                    <Flex direction="column" alignItems="center">
                      <Text fontWeight={option.outsideExpectedMove === "true" ? "bold" : "normal"}
                            color={option.outsideExpectedMove === "true" ? "green.500" : "inherit"}>
                        ${option.breakEven.toFixed(2)}
                      </Text>
                      <Badge
                        colorScheme={option.outsideExpectedMove === "true" ? "green" :
                                   (option.breakEvenPct > 0 ? "blue" : "purple")}
                        fontSize="xs"
                      >
                        {option.breakEvenPct > 0 ? "+" : ""}{option.breakEvenPct.toFixed(2)}%
                        {option.outsideExpectedMove === "true" && " ✓"}
                      </Badge>
                    </Flex>
                  </Tooltip>
                </Td>
                <Td textAlign="center">{formatPercent(option.roc)}</Td>
                {!compact && <Td textAlign="center">{formatPercent(option.probOtm)}</Td>}
                {!compact && <Td textAlign="center">{formatPercent(option.iv)}</Td>}
                {!compact && <Td textAlign="center">{formatCurrency(option.marginRequirement)}</Td>}
                {!compact && <Td textAlign="center">{option.maxLoss !== null ? formatCurrency(option.maxLoss) : 'Unlimited'}</Td>}
                <Td textAlign="center">
                  <ScoreThermometer score={option.score} size={compact ? "sm" : "md"} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
      
      {!compact && (
        <>
          <Divider my={3} />
          <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" fontSize="sm">
            <Text fontWeight="bold" mb={2}>Understanding Break-Even Prices:</Text>
            <Text mb={2}>
              • For puts: Strike Price - Premium = Break-Even Price
            </Text>
            <Text mb={2}>
              • For calls: Strike Price + Premium = Break-Even Price
            </Text>
            <Text mb={2}>
              • <Badge colorScheme="green">Green</Badge> break-even prices are outside the expected move range, indicating higher probability of profit
            </Text>
            <Text>
              Note: These are algorithmic recommendations based on the current market data.
              Always conduct your own research before making trading decisions.
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default NakedOptionsDisplay;