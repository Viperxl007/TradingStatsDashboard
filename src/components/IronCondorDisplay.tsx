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
import { IronCondor, OptimalIronCondors } from '../types';
import ScoreThermometer from './ScoreThermometer';

interface IronCondorDisplayProps {
  ticker: string;
  ironCondors: OptimalIronCondors;
  compact?: boolean; // Add compact mode for use in DirectSearch
}

/**
 * IronCondorDisplay Component
 *
 * This component displays the optimal iron condors for a given ticker.
 * Can be displayed in compact mode for use within other components.
 */
const IronCondorDisplay: React.FC<IronCondorDisplayProps> = ({ ticker, ironCondors, compact = false }) => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bgColor = useColorModeValue('white', 'gray.800');

  // Function to determine why no iron condors were found
  const getNoIronCondorReason = () => {
    // If we have iron condors, return null
    if (ironCondors && ironCondors.topIronCondors && ironCondors.topIronCondors.length > 0) {
      return null;
    }
    
    // Check if there are enough OTM options
    return "No suitable combinations found that meet delta, width, and premium requirements";
  };

  return (
    <Box
      id={`iron-condor-${ticker}`}
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
        {ticker} Short Iron Condor Strategy
      </Heading>
      
      <Divider mb={4} />
      
      {ironCondors && ironCondors.topIronCondors && ironCondors.topIronCondors.length > 0 ? (
        <>
          <Flex direction={compact ? "column" : ["column", "row"]} mb={4}>
            <Box flex="1" mr={compact ? 0 : 4} mb={compact ? 4 : 0}>
              <Heading as="h4" size="sm" mb={2}>
                Strategy Overview
              </Heading>
              <Text fontSize="sm" mb={3}>
                A defined-risk strategy with 4 legs that profits from post-earnings volatility collapse.
              </Text>
              
              <Stat mb={3}>
                <StatLabel>Expected Move</StatLabel>
                <StatNumber>{(ironCondors.expectedMove.percent * 100).toFixed(2)}%</StatNumber>
                <StatHelpText>${ironCondors.expectedMove.dollars.toFixed(2)}</StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel>Days to Expiration</StatLabel>
                <StatNumber>{ironCondors.daysToExpiration}</StatNumber>
              </Stat>
            </Box>
            
            {ironCondors.topIronCondors.length > 0 && (
              <Box flex="2">
                <Heading as="h4" size="sm" mb={2}>
                  Top Iron Condor
                </Heading>
                
                <Flex direction={["column", "row"]} mb={3}>
                  <Box flex="1" mr={[0, 4]} mb={[3, 0]}>
                    <Text fontWeight="bold">Call Spread</Text>
                    <Text fontSize="sm">
                      Short ${ironCondors.topIronCondors[0].callSpread.shortStrike.toFixed(2)} Call
                    </Text>
                    <Text fontSize="sm">
                      Long ${ironCondors.topIronCondors[0].callSpread.longStrike.toFixed(2)} Call
                    </Text>
                    <Text fontSize="sm">
                      Net Credit: ${(ironCondors.topIronCondors[0].callSpread.shortPremium -
                        ironCondors.topIronCondors[0].callSpread.longPremium).toFixed(2)}
                    </Text>
                  </Box>
                  
                  <Box flex="1">
                    <Text fontWeight="bold">Put Spread</Text>
                    <Text fontSize="sm">
                      Short ${ironCondors.topIronCondors[0].putSpread.shortStrike.toFixed(2)} Put
                    </Text>
                    <Text fontSize="sm">
                      Long ${ironCondors.topIronCondors[0].putSpread.longStrike.toFixed(2)} Put
                    </Text>
                    <Text fontSize="sm">
                      Net Credit: ${(ironCondors.topIronCondors[0].putSpread.shortPremium -
                        ironCondors.topIronCondors[0].putSpread.longPremium).toFixed(2)}
                    </Text>
                  </Box>
                </Flex>
                
                <Flex direction={["column", "row"]}>
                  <Box flex="1" mr={[0, 4]} mb={[3, 0]}>
                    <Text fontWeight="bold">Risk/Reward Profile</Text>
                    <Text fontSize="sm">
                      Total Net Credit: ${ironCondors.topIronCondors[0].netCredit.toFixed(2)}
                    </Text>
                    <Text fontSize="sm">
                      Max Loss: ${ironCondors.topIronCondors[0].maxLoss.toFixed(2)}
                    </Text>
                    <Text fontSize="sm">
                      Return on Risk: {(ironCondors.topIronCondors[0].returnOnRisk * 100).toFixed(2)}%
                    </Text>
                    <Text fontSize="sm">
                      Probability of Profit: {(ironCondors.topIronCondors[0].probProfit * 100).toFixed(2)}%
                    </Text>
                  </Box>
                  
                  <Box flex="1">
                    <Text fontWeight="bold">Break-Even Points</Text>
                    <Text fontSize="sm">
                      Lower: ${ironCondors.topIronCondors[0].breakEvenLow.toFixed(2)}
                    </Text>
                    <Text fontSize="sm">
                      Upper: ${ironCondors.topIronCondors[0].breakEvenHigh.toFixed(2)}
                    </Text>
                    
                    <Box mt={2} display="flex" justifyContent="center">
                      <ScoreThermometer score={ironCondors.topIronCondors[0].score} />
                    </Box>
                  </Box>
                </Flex>
              </Box>
            )}
          </Flex>
          
          {!compact && ironCondors.topIronCondors.length > 1 && (
            <Box mt={4}>
              <Heading as="h4" size="sm" mb={2}>
                Additional Iron Condor Opportunities
              </Heading>
              <TableContainer>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Call Spread</Th>
                      <Th>Put Spread</Th>
                      <Th>Net Credit</Th>
                      <Th>Max Loss</Th>
                      <Th>Return on Risk</Th>
                      <Th>Prob. Profit</Th>
                      <Th>Score</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {ironCondors.topIronCondors.slice(1).map((ic, idx) => (
                      <Tr key={idx}>
                        <Td>{ic.callSpread.shortStrike.toFixed(2)} / {ic.callSpread.longStrike.toFixed(2)}</Td>
                        <Td>{ic.putSpread.longStrike.toFixed(2)} / {ic.putSpread.shortStrike.toFixed(2)}</Td>
                        <Td>${ic.netCredit.toFixed(2)}</Td>
                        <Td>${ic.maxLoss.toFixed(2)}</Td>
                        <Td>{(ic.returnOnRisk * 100).toFixed(2)}%</Td>
                        <Td>{(ic.probProfit * 100).toFixed(2)}%</Td>
                        <Td>{ic.score.toFixed(2)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      ) : (
        <Flex direction="column" align="center" justify="center" py={6}>
          <Box
            width="100%"
            maxWidth="400px"
            height="200px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mb={4}
            position="relative"
          >
            {/* Iron Condor Diagram */}
            <svg width="300" height="150" viewBox="0 0 300 150">
              <defs>
                <linearGradient id="gradientFill" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="red.300" />
                  <stop offset="30%" stopColor="green.300" />
                  <stop offset="70%" stopColor="green.300" />
                  <stop offset="100%" stopColor="red.300" />
                </linearGradient>
              </defs>
              
              {/* Horizontal axis */}
              <line x1="20" y1="100" x2="280" y2="100" stroke="#A0AEC0" strokeWidth="2" />
              
              {/* Profit/Loss line */}
              <polyline
                points="20,20 80,80 150,80 220,80 280,20"
                fill="none"
                stroke="#4299E1"
                strokeWidth="3"
              />
              
              {/* Strike price markers */}
              <line x1="80" y1="95" x2="80" y2="105" stroke="#A0AEC0" strokeWidth="2" />
              <line x1="150" y1="95" x2="150" y2="105" stroke="#A0AEC0" strokeWidth="2" />
              <line x1="220" y1="95" x2="220" y2="105" stroke="#A0AEC0" strokeWidth="2" />
              
              {/* Strike price labels */}
              <text x="80" y="120" textAnchor="middle" fill="#A0AEC0" fontSize="12">Put Long</text>
              <text x="150" y="120" textAnchor="middle" fill="#A0AEC0" fontSize="12">Current Price</text>
              <text x="220" y="120" textAnchor="middle" fill="#A0AEC0" fontSize="12">Call Long</text>
              
              {/* Profit zone */}
              <rect x="80" y="80" width="140" height="20" fill="url(#gradientFill)" opacity="0.3" />
            </svg>
          </Box>
          
          <Heading as="h4" size="md" color="red.500" mb={2}>
            No Suitable Iron Condors Found
          </Heading>
          
          <Text align="center" maxWidth="500px">
            {getNoIronCondorReason()}
          </Text>
        </Flex>
      )}
    </Box>
  );
};

export default IronCondorDisplay;