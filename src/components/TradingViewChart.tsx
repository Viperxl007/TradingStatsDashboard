import React, { useEffect, useRef, useState } from 'react';
import { Box, useColorMode, Spinner, Center, Text, Button, Link } from '@chakra-ui/react';

interface TradingViewChartProps {
  symbol: string;
  height?: string;
  width?: string;
}

/**
 * TradingViewChart Component
 * 
 * This component renders a TradingView chart for a given symbol using a sandboxed iframe.
 * It uses the TradingView widget embed URL with specific parameters to avoid conflicts.
 */
const TradingViewChart: React.FC<TradingViewChartProps> = ({ 
  symbol, 
  height = '400px', 
  width = '100%' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    // Function to create a sandboxed TradingView chart iframe
    const createSandboxedChart = () => {
      if (containerRef.current) {
        try {
          // Clear previous content
          containerRef.current.innerHTML = '';
          
          // Create iframe for TradingView chart with sandbox attributes
          const iframe = document.createElement('iframe');
          iframe.id = `tradingview-iframe-${symbol}-${retryCount}`;
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          
          // Add sandbox attributes to isolate the iframe
          // allow-scripts: Allow scripts to run in the iframe
          // allow-same-origin: Allow the iframe to access its own origin
          // allow-popups: Allow popups from the iframe
          iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-popups-to-escape-sandbox');
          
          // Use the TradingView widget embed URL with specific parameters
          iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=${iframe.id}&symbol=${symbol}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=${colorMode === 'dark' ? '2D3748' : 'f0f3fa'}&studies=MAExp%40tv-basicstudies%2CMACD%40tv-basicstudies%2CRSI%40tv-basicstudies&theme=${colorMode === 'dark' ? 'dark' : 'light'}&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&allow_symbol_change=1&details=1&hotlist=1&calendar=1&news=1&widgetbar_width=300`;
          
          // Add load event to iframe
          iframe.onload = () => {
            setIsLoading(false);
            console.log('TradingView iframe loaded successfully');
          };
          
          // Add error event to iframe
          iframe.onerror = (e) => {
            console.error('TradingView iframe error:', e);
            setError('Failed to load TradingView chart. Please check your internet connection.');
            setIsLoading(false);
          };
          
          // Append iframe to container
          containerRef.current.appendChild(iframe);
          
          // Set a timeout to check if the iframe loaded
          setTimeout(() => {
            if (isLoading) {
              console.log('Checking if iframe is still loading...');
              try {
                // If still loading after timeout, check if iframe content is accessible
                if (iframe.contentDocument === null) {
                  throw new Error('Cannot access iframe content - likely blocked by CORS');
                }
              } catch (err) {
                // If we can't access iframe content, it might be blocked by CORS
                setError('TradingView chart might be blocked by browser security. Try disabling any crypto wallet extensions or use a different browser.');
                setIsLoading(false);
              }
            }
          }, 5000); // 5 seconds timeout
        } catch (err) {
          setError(`Error initializing TradingView chart: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };
    
    // Create the chart
    createSandboxedChart();
    
    // Set a final timeout for overall loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        setError('TradingView chart is taking too long to load. You can try refreshing the page or check your internet connection.');
        setIsLoading(false);
      }
    }, 15000); // 15 seconds timeout
    
    return () => {
      clearTimeout(timeout);
    };
  }, [symbol, colorMode, isLoading, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setIsLoading(true);
    setError(null);
  };

  return (
    <Box height={height} width={width} position="relative" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Box p={4} borderBottomWidth="1px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}>
        <Text fontWeight="bold">TradingView Chart - {symbol}</Text>
      </Box>
      
      {isLoading && (
        <Center position="absolute" top="53px" left="0" right="0" bottom="0" bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'} zIndex="1">
          <Box textAlign="center">
            <Spinner size="xl" color="brand.500" mb={4} />
            <Text mb={4}>Loading TradingView chart for {symbol}...</Text>
            <Text fontSize="sm" color="gray.500">This may take a few moments</Text>
          </Box>
        </Center>
      )}
      
      {error && (
        <Center position="absolute" top="53px" left="0" right="0" bottom="0" bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'} zIndex="1">
          <Box textAlign="center" maxW="80%" p={4}>
            <Text color="red.500" mb={2} fontWeight="bold">Error loading chart:</Text>
            <Text mb={4}>{error}</Text>
            
            <Button 
              colorScheme="brand" 
              onClick={handleRetry}
              mb={4}
            >
              Retry
            </Button>
            
            <Box>
              <Text fontSize="sm" mb={2}>Alternatively, view chart on TradingView:</Text>
              <Link 
                href={`https://www.tradingview.com/chart/?symbol=${symbol}`} 
                isExternal 
                color="brand.500"
                textDecoration="underline"
              >
                Open {symbol} on TradingView.com
              </Link>
            </Box>
          </Box>
        </Center>
      )}
      
      <Box 
        id={`tradingview-container-${symbol}`} 
        ref={containerRef} 
        height="calc(100% - 53px)" 
        width="100%"
        opacity={isLoading || error ? 0.3 : 1}
      />
    </Box>
  );
};

export default TradingViewChart;