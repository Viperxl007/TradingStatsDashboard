import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Spinner,
  Center,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorModeValue,
  VStack,
  HStack,
  Button,
  useDisclosure,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { useData } from '../context/DataContext';
import { ActionType } from '../context/DataContext';
import TradeIdeasPanel from './tradeTracker/TradeIdeasPanel';
import ActiveTradesPanel from './tradeTracker/ActiveTradesPanel';
import TradeHistoryPanel from './tradeTracker/TradeHistoryPanel';
import StatisticsPanel from './tradeTracker/StatisticsPanel';
import AddTradeIdeaModal from './tradeTracker/AddTradeIdeaModal';
import AddActiveTradeModal from './tradeTracker/AddActiveTradeModal';

/**
 * TradeTracker Component
 * 
 * This component provides a comprehensive interface for tracking trades,
 * including trade ideas, active trades, trade history, and performance statistics.
 */
const TradeTracker: React.FC = () => {
  const { state, dispatch } = useData();
  const { tradeTrackerData } = state;
  const { isLoading, error } = tradeTrackerData;
  const [activeTab, setActiveTab] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isActiveTradeModalOpen, onOpen: onActiveTradeModalOpen, onClose: onActiveTradeModalClose } = useDisclosure();
  const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();
  const toast = useToast();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Load trades when component mounts or when the component is shown
  useEffect(() => {
    loadTrades();
  }, [state.activeTab]);

  // Function to load trades from the database
  const loadTrades = async () => {
    try {
      dispatch({ type: ActionType.LOAD_TRADES_START });
      
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../services/tradeTrackerDB');
      
      // Get all trades from the database
      const trades = await tradeTrackerDB.getAllTrades();
      
      // Update state with the trades
      dispatch({
        type: ActionType.LOAD_TRADES_SUCCESS,
        payload: trades
      });
      
      // Calculate statistics
      const statistics = await tradeTrackerDB.calculateStatistics(trades);
      dispatch({
        type: ActionType.CALCULATE_TRADE_STATISTICS,
        payload: statistics
      });
      
      // Apply any active filters
      if (tradeTrackerData.filters) {
        dispatch({
          type: ActionType.FILTER_TRADES,
          payload: tradeTrackerData.filters
        });
      }
    } catch (err) {
      dispatch({ 
        type: ActionType.LOAD_TRADES_ERROR,
        payload: err instanceof Error ? err.message : 'Failed to load trades'
      });
    }
  };

  // Handle tab change
  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  // Handle clear all data
  const handleClearAllData = async () => {
    try {
      // Import the tradeTrackerDB service
      const { tradeTrackerDB } = await import('../services/tradeTrackerDB');
      
      // Clear all data from database
      await tradeTrackerDB.clearAllData();
      
      // Dispatch action to clear data from state
      dispatch({
        type: ActionType.CLEAR_TRADE_TRACKER_DATA
      });
      
      // Show success toast
      toast({
        title: 'All data cleared',
        description: 'All trades and trade ideas have been removed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Close the alert dialog
      onAlertClose();
    } catch (error) {
      // Show error toast
      toast({
        title: 'Error',
        description: 'Failed to clear data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" mb={2}>Trade Tracker</Heading>
        <Text mb={4}>
          Track your trade ideas, active trades, and trading history to improve your performance.
        </Text>
      </Box>
      
      {error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <Box>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {isLoading ? (
        <Center height="400px" borderWidth="1px" borderRadius="lg">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" />
            <Text>Loading trade data...</Text>
          </VStack>
        </Center>
      ) : (
        <Box>
          <HStack spacing={4} mb={4} justifyContent="flex-end">
            <Button
              leftIcon={<DeleteIcon />}
              colorScheme="red"
              variant="outline"
              onClick={onAlertOpen}
              size="sm"
            >
              Clear All Data
            </Button>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="brand"
              onClick={activeTab === 1 ? onActiveTradeModalOpen : onOpen}
            >
              {activeTab === 1 ? 'Add Active Trade' : 'Add Trade Idea'}
            </Button>
          </HStack>
          
          <Box 
            borderWidth="1px" 
            borderRadius="lg" 
            overflow="hidden"
            bg={bgColor}
            borderColor={borderColor}
          >
            <Tabs 
              isFitted 
              variant="enclosed" 
              index={activeTab} 
              onChange={handleTabChange}
              colorScheme="brand"
            >
              <TabList>
                <Tab>Trade Ideas</Tab>
                <Tab>Active Trades</Tab>
                <Tab>Trade History</Tab>
                <Tab>Statistics</Tab>
              </TabList>
              
              <TabPanels>
                <TabPanel>
                  <TradeIdeasPanel />
                </TabPanel>
                <TabPanel>
                  <ActiveTradesPanel />
                </TabPanel>
                <TabPanel>
                  <TradeHistoryPanel />
                </TabPanel>
                <TabPanel>
                  <StatisticsPanel />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        </Box>
      )}
      
      {/* Add Trade Idea Modal */}
      <AddTradeIdeaModal isOpen={isOpen} onClose={onClose} />
      
      {/* Add Active Trade Modal */}
      <AddActiveTradeModal isOpen={isActiveTradeModalOpen} onClose={onActiveTradeModalClose} />
      
      {/* Clear All Data Confirmation Dialog */}
      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Clear All Data
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete all trades and trade ideas? This action cannot be undone and will permanently remove all your trading data.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onAlertClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleClearAllData} ml={3}>
                Delete All Data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default TradeTracker;