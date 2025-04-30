import React, { useState } from 'react';
import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Heading,
  Text,
  useColorMode
} from '@chakra-ui/react';
import { useData } from '../context/DataContext';
import DirectSearch from './DirectSearch';
import ScanResults from './ScanResults';
import TradeTracker from './TradeTracker';

/**
 * Options Earnings Screener Component
 *
 * This component serves as the container for the Options Earnings Screener feature.
 * It includes three tabs:
 * 1. Direct Search - For analyzing individual stocks
 * 2. Options Strategies - For scanning stocks with earnings announcements for different strategy types
 * 3. Trade Tracker - For tracking trades using a Google Sheets spreadsheet
 */
const OptionsEarningsScreener: React.FC = () => {
  const { colorMode } = useColorMode();
  const { state } = useData();
  const [activeTab, setActiveTab] = useState<number>(0);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" mb={2}>Options Earnings Screener</Heading>
        <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
          Analyze options data for earnings plays and scan for potential opportunities
        </Text>
      </Box>

      <Tabs
        variant="line"
        colorScheme="brand"
        index={activeTab}
        onChange={handleTabChange}
        isLazy
      >
        <TabList>
          <Tab>Direct Search</Tab>
          <Tab>Options Strategies</Tab>
          <Tab>Trade Tracker</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <DirectSearch />
          </TabPanel>
          <TabPanel>
            <ScanResults />
          </TabPanel>
          <TabPanel>
            <TradeTracker />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default OptionsEarningsScreener;