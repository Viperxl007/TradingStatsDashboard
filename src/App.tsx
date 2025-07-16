import * as React from 'react';
import { ChakraProvider, Box, Flex, useColorMode, useToast } from '@chakra-ui/react';
import Dashboard from './components/Dashboard';
import { DataProvider, useData } from './context/DataContext';
import theme from './theme';

// Import testing and cleanup utilities to ensure they're included in the bundle
import { initializeCleanupTools } from './utils/aiTradeCleanupIntegration';
import { initializeBrowserConsoleTest } from './utils/browserConsoleTest';

const App: React.FC = () => {
  return (
    <ChakraProvider theme={theme}>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </ChakraProvider>
  );
};

const AppContent: React.FC = () => {
  const { colorMode } = useColorMode();
  const { state, dispatch } = useData();
  const toast = useToast();
  
  // Initialize utilities on component mount - NO SAMPLE DATA LOADING
  React.useEffect(() => {
    // Initialize testing and cleanup utilities for browser console access
    const initializeUtilities = () => {
      try {
        initializeCleanupTools();
        initializeBrowserConsoleTest();
        console.log('🚀 [App] Browser console utilities initialized successfully');
        console.log('💡 [App] Type showBrowserConsoleHelp() in console for usage instructions');
      } catch (error) {
        console.error('❌ [App] Failed to initialize browser console utilities:', error);
      }
    };
    
    initializeUtilities();
  }, []);
  
  return (
    <Box
      minH="100vh"
      bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
      color={colorMode === 'dark' ? 'white' : 'gray.800'}
    >
      <Flex direction="column" h="100vh">
        <Dashboard />
      </Flex>
    </Box>
  );
};

export default App;