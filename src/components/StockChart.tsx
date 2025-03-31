import React, { useEffect, useState } from 'react';
import {
  Box,
  useColorMode,
  Spinner,
  Center,
  Text,
  Button,
  Link,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react';

interface StockChartProps {
  symbol: string;
  height?: string;
  width?: string;
}

/**
 * StockChart Component
 * 
 * This component renders a stock chart for a given symbol using a public API.
 * It's a fallback for when TradingView charts don't work properly.
 */
const StockChart: React.FC<StockChartProps> = ({ 
  symbol, 
  height = '400px', 
  width = '100%' 
}) => {
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartUrl, setChartUrl] = useState<string>('');

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    // Use a simple chart API that doesn't require JavaScript injection
    // This avoids conflicts with browser extensions like MetaMask
    try {
      // Yahoo Finance chart URL
      const yahooChartUrl = `https://finance.yahoo.com/chart/${symbol}`;
      
      // Alpha Vantage chart URL (fallback)
      const alphaVantageUrl = `https://www.alphavantage.co/chart?symbol=${symbol}&interval=daily&outputsize=full`;
      
      // Set the chart URL
      setChartUrl(yahooChartUrl);
      setIsLoading(false);
    } catch (err) {
      setError(`Error initializing chart: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
    
    // Set a timeout for loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        setError('Chart is taking too long to load. Please try a different approach.');
        setIsLoading(false);
      }
    }, 10000);
    
    return () => {
      clearTimeout(timeout);
    };
  }, [symbol, isLoading]);

  return (
    <Box height={height} width={width} position="relative" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Box p={4} borderBottomWidth="1px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}>
        <Text fontWeight="bold">Stock Chart - {symbol}</Text>
      </Box>
      
      {isLoading && (
        <Center position="absolute" top="0" left="0" right="0" bottom="0" bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'} zIndex="1">
          <Box textAlign="center">
            <Spinner size="xl" color="brand.500" mb={4} />
            <Text mb={4}>Loading chart for {symbol}...</Text>
          </Box>
        </Center>
      )}
      
      {error && (
        <Center height="calc(100% - 53px)" bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}>
          <Box textAlign="center" maxW="80%" p={4}>
            <Alert status="error" borderRadius="md" mb={4}>
              <AlertIcon />
              <Box>
                <AlertTitle>Error loading chart</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Box>
            </Alert>
            
            <Text mb={4}>
              Due to browser extension conflicts, we're unable to load the interactive chart.
              Please use one of the options below:
            </Text>
            
            <Box mb={4}>
              <Link 
                href={`https://finance.yahoo.com/chart/${symbol}`} 
                isExternal 
                color="brand.500"
                textDecoration="underline"
                display="block"
                mb={2}
              >
                View {symbol} on Yahoo Finance
              </Link>
              
              <Link 
                href={`https://www.tradingview.com/chart/?symbol=${symbol}`} 
                isExternal 
                color="brand.500"
                textDecoration="underline"
                display="block"
              >
                View {symbol} on TradingView
              </Link>
            </Box>
          </Box>
        </Center>
      )}
      
      {!isLoading && !error && (
        <Box height="calc(100% - 53px)" width="100%" p={4} textAlign="center">
          <Text mb={4}>
            Due to browser extension conflicts, we can't display the interactive chart directly.
          </Text>
          
          <Button
            as={Link}
            href={`https://finance.yahoo.com/chart/${symbol}`}
            isExternal
            colorScheme="brand"
            mb={4}
            width="100%"
            maxW="300px"
          >
            Open {symbol} Chart on Yahoo Finance
          </Button>
          
          <Button
            as={Link}
            href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
            isExternal
            colorScheme="gray"
            width="100%"
            maxW="300px"
          >
            Open {symbol} Chart on TradingView
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default StockChart;