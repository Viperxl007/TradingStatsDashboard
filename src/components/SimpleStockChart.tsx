import React from 'react';
import {
  Box,
  useColorMode,
  Heading,
  Text,
  Button,
  Link,
  VStack,
  HStack,
  Icon
} from '@chakra-ui/react';
import { FiExternalLink } from 'react-icons/fi';

interface SimpleStockChartProps {
  symbol: string;
  height?: string;
  width?: string;
}

/**
 * SimpleStockChart Component
 * 
 * This component provides links to external stock chart providers.
 * It's a reliable alternative when embedded charts don't work properly.
 */
const SimpleStockChart: React.FC<SimpleStockChartProps> = ({ 
  symbol, 
  height = '400px', 
  width = '100%' 
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <Box 
      height={height} 
      width={width} 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden"
    >
      <Box p={4} borderBottomWidth="1px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}>
        <Heading size="sm">Stock Chart - {symbol}</Heading>
      </Box>
      
      <VStack 
        spacing={6} 
        justify="center" 
        align="center" 
        height="calc(100% - 53px)" 
        p={6}
      >
        <Text>
          View {symbol} chart on your preferred platform:
        </Text>
        
        <HStack spacing={4} width="100%" justify="center">
          <Button
            as={Link}
            href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
            isExternal
            colorScheme="brand"
            size="lg"
            width="200px"
            rightIcon={<Icon as={FiExternalLink} />}
          >
            TradingView
          </Button>
          
          <Button
            as={Link}
            href={`https://finance.yahoo.com/chart/${symbol}`}
            isExternal
            colorScheme="blue"
            size="lg"
            width="200px"
            rightIcon={<Icon as={FiExternalLink} />}
          >
            Yahoo Finance
          </Button>
        </HStack>
        
        <Text fontSize="sm" color="gray.500" maxW="md" textAlign="center">
          Due to browser extension conflicts, we're providing direct links to external chart providers.
          Click on your preferred platform to view the chart in a new tab.
        </Text>
      </VStack>
    </Box>
  );
};

export default SimpleStockChart;