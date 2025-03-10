import * as React from 'react';
import { ChakraProvider, Box, Flex, useColorMode, useToast } from '@chakra-ui/react';
import Dashboard from './components/Dashboard';
import { DataProvider, useData, importDataStart, importDataSuccess, importDataError } from './context/DataContext';
import { loadExampleData } from './services/loadExampleData';
import theme from './theme';

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
  
  // Load example data on component mount
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
    
    loadData();
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