import React, { useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Tab,
  Tabs,
  TabList,
  TabPanel,
  TabPanels,
  useColorMode,
  Button,
  HStack,
  Icon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Text,
  VStack,
  Spinner,
  useToast
} from '@chakra-ui/react';
import { FiUpload, FiDownload, FiMoon, FiSun, FiSettings } from 'react-icons/fi';
import Summary from './Summary';
import TokenFilter from './TokenFilter';
import PerformanceAnalysis from './PerformanceAnalysis';
import TokensView from './TokensView';
import TrendsView from './TrendsView';
import HistoryView from './HistoryView';
import OptionsEarningsScreener from './OptionsEarningsScreener';
import TradeTracker from './TradeTracker';
import ChartAnalysis from './ChartAnalysis';
import AITradeTracker from './AITradeTracker';
import LiquidityTrackingDashboard from './liquidityTracking/LiquidityTrackingDashboard';
import { useData, importDataStart, importDataSuccess, importDataError, setActiveTab, toggleDarkMode } from '../context/DataContext';
import { importData } from '../services/dataImport';

const Dashboard: React.FC = () => {
  const { state, dispatch } = useData();
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [importError, setImportError] = useState<string | null>(null);
  const toast = useToast();

  // Handle file import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    try {
      setImportError(null);
      dispatch(importDataStart());
      onClose();
      
      const data = await importData(file);
      dispatch(importDataSuccess(data));
      
      toast({
        title: 'Data imported successfully',
        description: `Imported ${data.length} trades from ${file.name}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setImportError(errorMessage);
      dispatch(importDataError(errorMessage));
      
      toast({
        title: 'Import failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle tab change
  const handleTabChange = (index: number) => {
    const tabNames = ['summary', 'performance', 'tokens', 'trends', 'history', 'options', 'tradetracker', 'chartanalysis', 'liquiditytracking'];
    dispatch(setActiveTab(tabNames[index]));
  };

  // Get current tab index
  const getCurrentTabIndex = () => {
    const tabNames = ['summary', 'performance', 'tokens', 'trends', 'history', 'options', 'tradetracker', 'chartanalysis', 'liquiditytracking'];
    return tabNames.indexOf(state.activeTab);
  };

  // Handle dark mode toggle
  const handleDarkModeToggle = () => {
    toggleColorMode();
    dispatch(toggleDarkMode());
  };

  return (
    <Box w="100%" h="100%">
      {/* Header */}
      <Flex
        as="header"
        align="center"
        justify="space-between"
        py={4}
        px={6}
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderBottomWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        boxShadow="sm"
      >
        <Heading size="lg" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
          Trading Stats Dashboard
        </Heading>
        
        <HStack spacing={4}>
          <Button
            leftIcon={<Icon as={FiUpload} />}
            colorScheme="brand"
            onClick={onOpen}
            isLoading={state.isLoading}
            loadingText="Importing"
          >
            Import
          </Button>
          
          <Button
            leftIcon={<Icon as={FiDownload} />}
            variant="outline"
            colorScheme="brand"
            isDisabled={state.rawData.length === 0}
          >
            Export
          </Button>
          
          <Button
            leftIcon={<Icon as={FiSettings} />}
            variant="ghost"
            colorScheme="brand"
          >
            Settings
          </Button>
          
          <Button
            aria-label="Toggle dark mode"
            variant="ghost"
            onClick={handleDarkModeToggle}
          >
            <Icon as={colorMode === 'dark' ? FiSun : FiMoon} />
          </Button>
        </HStack>
      </Flex>

      {/* Main content */}
      <Box p={6}>
        {state.isLoading ? (
          <Flex justify="center" align="center" h="50vh">
            <VStack spacing={4}>
              <Spinner size="xl" color="brand.500" />
              <Text>Loading data...</Text>
            </VStack>
          </Flex>
        ) : state.error ? (
          <Flex justify="center" align="center" h="50vh">
            <VStack spacing={4}>
              <Text color="red.500" fontSize="xl">Error: {state.error}</Text>
              <Button colorScheme="brand" onClick={onOpen}>Try Again</Button>
            </VStack>
          </Flex>
        ) : state.rawData.length === 0 ? (
          <Flex justify="center" align="center" h="50vh">
            <VStack spacing={4}>
              <Text fontSize="xl">No data available</Text>
              <Text>Import your trading data to get started</Text>
              <Button colorScheme="brand" onClick={onOpen} leftIcon={<Icon as={FiUpload} />}>
                Import Data
              </Button>
            </VStack>
          </Flex>
        ) : (
          <Tabs 
            variant="line" 
            colorScheme="brand" 
            index={getCurrentTabIndex()} 
            onChange={handleTabChange}
            isLazy
          >
            <TabList>
              <Tab>Summary</Tab>
              <Tab>Performance</Tab>
              <Tab>Tokens</Tab>
              <Tab>Trends</Tab>
              <Tab>History</Tab>
              <Tab>Options Earnings</Tab>
              <Tab>Trade Tracker</Tab>
              <Tab>Chart Analysis</Tab>
              <Tab>AI Trade Tracker</Tab>
              <Tab>Liquidity Tracking</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <Summary />
              </TabPanel>
              <TabPanel>
                <PerformanceAnalysis />
              </TabPanel>
              <TabPanel>
                <TokensView />
              </TabPanel>
              <TabPanel>
                <TrendsView />
              </TabPanel>
              <TabPanel>
                <HistoryView />
              </TabPanel>
              <TabPanel>
                <OptionsEarningsScreener />
              </TabPanel>
              <TabPanel>
                <TradeTracker />
              </TabPanel>
              <TabPanel>
                <ChartAnalysis />
              </TabPanel>
              <TabPanel>
                <AITradeTracker />
              </TabPanel>
              <TabPanel>
                <LiquidityTrackingDashboard />
              </TabPanel>
            </TabPanels>
          </Tabs>
        )}
      </Box>

      {/* Import Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import Trading Data</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text>
                Select an Excel file containing your trading data. The file should have the following columns:
              </Text>
              <Box as="ul" pl={5}>
                <Box as="li">id - Unique identifier for the trade</Box>
                <Box as="li">token - Token/cryptocurrency symbol</Box>
                <Box as="li">date - Date of the trade (YYYY-MM-DD format)</Box>
                <Box as="li">type - Trade type ('buy' or 'sell')</Box>
                <Box as="li">amount - Quantity of tokens traded</Box>
                <Box as="li">price - Price per token in USD</Box>
                <Box as="li">profitLoss - Profit/loss for this trade (optional)</Box>
                <Box as="li">fees - Transaction fees (optional)</Box>
              </Box>
              
              {importError && (
                <Text color="red.500">{importError}</Text>
              )}
              
              <Button
                as="label"
                htmlFor="file-upload"
                colorScheme="brand"
                leftIcon={<Icon as={FiUpload} />}
                cursor="pointer"
              >
                Select File
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Dashboard;