import * as React from 'react';
import { ChakraProvider, Box, useColorMode } from '@chakra-ui/react';
import { DataProvider } from './context/DataContext';
import { HyperliquidProvider } from './context/HyperliquidContext';
import theme from './theme';
import AITradeViewerPortal from './components/AITradeViewerPortal';

/**
 * Standalone AI Trade Viewer Portal App
 *
 * This is a standalone application that can be run independently
 * to view AI-generated trade recommendations and their performance.
 *
 * Security Note: This application only displays trade data and does not
 * expose any sensitive backend functionality. It connects to the existing
 * production API to fetch read-only trade data.
 */
const AITradeViewerAppContent: React.FC = () => {
  const { colorMode } = useColorMode();

  return (
    <Box
      minH="100vh"
      bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
      color={colorMode === 'dark' ? 'white' : 'gray.800'}
    >
      <AITradeViewerPortal />
    </Box>
  );
};

const AITradeViewerApp: React.FC = () => {
  return (
    <ChakraProvider theme={theme}>
      <DataProvider>
        <HyperliquidProvider>
          <AITradeViewerAppContent />
        </HyperliquidProvider>
      </DataProvider>
    </ChakraProvider>
  );
};

export default AITradeViewerApp;