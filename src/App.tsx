import * as React from 'react';
import { ChakraProvider, Box, Flex, useColorMode, useToast } from '@chakra-ui/react';
import Dashboard from './components/Dashboard';
import { DataProvider, useData, importDataStart, importDataSuccess, importDataError } from './context/DataContext';
import { loadExampleData } from './services/loadExampleData';
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
  
  // Load example data and initialize utilities on component mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Only load data if no data is already loaded
        if (state.rawData.length === 0) {
          dispatch(importDataStart());
          
          const data = await loadExampleData();
          dispatch(importDataSuccess(data));
          
          toast({
            title: 'Example data loaded',
            description: `Loaded ${data.length} sample trades`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        dispatch(importDataError(errorMessage));
        
        toast({
          title: 'Failed to load example data',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };
    
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
    
    loadData();
    initializeUtilities();
  }, [dispatch, state.rawData.length, toast]);
  
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