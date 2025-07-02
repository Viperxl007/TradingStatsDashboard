import React, { useEffect, useState } from 'react';
import {
  HStack,
  VStack,
  Text,
  Badge,
  Icon,
  Box,
  useColorMode,
  Spinner
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FiActivity, FiClock, FiTrendingUp } from 'react-icons/fi';
import { fetchActiveTrade, ActiveTrade } from '../services/activeTradeService';
import { isActiveTradeStatus, isWaitingTradeStatus, getStatusDisplayText } from '../utils/statusMapping';

interface ActiveTradeAlertProps {
  ticker: string;
}


// Pulse animation for active trades
const pulseAnimation = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
`;

// Glow animation for waiting trades
const glowAnimation = keyframes`
  0% { box-shadow: 0 0 5px rgba(255, 193, 7, 0.5); }
  50% { box-shadow: 0 0 15px rgba(255, 193, 7, 0.8); }
  100% { box-shadow: 0 0 5px rgba(255, 193, 7, 0.5); }
`;

const ActiveTradeAlert: React.FC<ActiveTradeAlertProps> = ({ ticker }) => {
  const { colorMode } = useColorMode();
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Don't fetch if ticker is undefined or empty
    if (!ticker) {
      setIsLoading(false);
      setActiveTrade(null);
      return;
    }

    const fetchActiveTradeData = async () => {
      try {
        setIsLoading(true);
        console.log(`🔍 [ActiveTradeAlert] Fetching active trade for ${ticker}`);
        
        const trade = await fetchActiveTrade(ticker);
        console.log(`📊 [ActiveTradeAlert] Received trade data:`, trade);
        
        setActiveTrade(trade);
      } catch (error) {
        console.error('❌ [ActiveTradeAlert] Error fetching active trade:', error);
        setActiveTrade(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveTradeData();
  }, [ticker]);

  // Don't render anything if no ticker is provided
  if (!ticker) {
    return null;
  }

  // Don't render anything if loading or no active trade
  if (isLoading) {
    return (
      <HStack spacing={2} opacity={0.6}>
        <Spinner size="xs" />
        <Text fontSize="xs" color="gray.500">Checking trades...</Text>
      </HStack>
    );
  }

  if (!activeTrade) {
    return null;
  }

  // Determine alert styling based on trade status
  const getAlertConfig = () => {
    console.log(`🎨 [ActiveTradeAlert] Determining alert config for ${ticker} with status: "${activeTrade.status}"`);
    if (isActiveTradeStatus(activeTrade.status)) {
      return {
        icon: FiTrendingUp,
        iconColor: 'green.400',
        badgeColorScheme: 'green',
        badgeText: getStatusDisplayText(activeTrade.status),
        alertText: 'ACTIVE TRADE ALERT',
        animation: pulseAnimation,
        bgGradient: colorMode === 'dark'
          ? 'linear(to-r, green.900, green.800)'
          : 'linear(to-r, green.50, green.100)',
        borderColor: 'green.400'
      };
    } else if (isWaitingTradeStatus(activeTrade.status)) {
      return {
        icon: FiClock,
        iconColor: 'orange.400',
        badgeColorScheme: 'orange',
        badgeText: getStatusDisplayText(activeTrade.status),
        alertText: 'ACTIVE TRADE ALERT',
        animation: glowAnimation,
        bgGradient: colorMode === 'dark'
          ? 'linear(to-r, orange.900, orange.800)'
          : 'linear(to-r, orange.50, orange.100)',
        borderColor: 'orange.400'
      };
    } else {
      // Fallback for other statuses
      return {
        icon: FiActivity,
        iconColor: 'gray.400',
        badgeColorScheme: 'gray',
        badgeText: getStatusDisplayText(activeTrade.status),
        alertText: 'TRADE ALERT',
        animation: undefined,
        bgGradient: colorMode === 'dark'
          ? 'linear(to-r, gray.900, gray.800)'
          : 'linear(to-r, gray.50, gray.100)',
        borderColor: 'gray.400'
      };
    }
  };

  const config = getAlertConfig();

  return (
    <Box
      px={3}
      py={2}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={config.borderColor}
      bgGradient={config.bgGradient}
      animation={`${config.animation} 2s ease-in-out infinite`}
      position="relative"
      overflow="hidden"
    >
      {/* Subtle background pattern */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity={0.1}
        bgImage="radial-gradient(circle at 20% 50%, white 1px, transparent 1px)"
        bgSize="20px 20px"
      />
      
      <HStack spacing={3} position="relative" zIndex={1}>
        {/* Animated Icon */}
        <Icon
          as={config.icon}
          color={config.iconColor}
          boxSize={4}
          animation={activeTrade.status === 'active' ? `${pulseAnimation} 1.5s ease-in-out infinite` : undefined}
        />
        
        {/* Alert Text */}
        <VStack spacing={0} align="flex-start">
          <Text
            fontSize="xs"
            fontWeight="bold"
            color={colorMode === 'dark' ? 'white' : 'gray.800'}
            letterSpacing="wide"
            textTransform="uppercase"
          >
            {config.alertText}
          </Text>
          <HStack spacing={2}>
            <Badge
              colorScheme={config.badgeColorScheme}
              variant="solid"
              fontSize="xs"
              px={2}
              py={1}
              borderRadius="md"
              fontWeight="bold"
            >
              {config.badgeText}
            </Badge>
            <Text
              fontSize="xs"
              color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}
              fontWeight="medium"
            >
              {activeTrade.action?.toUpperCase() || 'TRADE'} @ ${activeTrade.entry_price?.toFixed(2) || '0.00'}
            </Text>
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
};

export default ActiveTradeAlert;