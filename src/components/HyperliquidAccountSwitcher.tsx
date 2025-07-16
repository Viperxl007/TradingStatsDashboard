import React from 'react';
import {
  Box,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  HStack,
  VStack,
  Badge,
  Icon,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from '@chakra-ui/react';
import { FiChevronDown, FiUser, FiRefreshCw, FiDatabase } from 'react-icons/fi';
import { useHyperliquid, HyperliquidAccount } from '../context/HyperliquidContext';
import { formatDistanceToNow } from 'date-fns';

const HyperliquidAccountSwitcher: React.FC = () => {
  const { state, selectAccount, triggerSync, clearError } = useHyperliquid();
  const toast = useToast();
  
  // Colors
  const menuBg = useColorModeValue('white', 'gray.800');
  const menuBorder = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  
  const handleAccountSelect = (account: HyperliquidAccount) => {
    selectAccount(account);
    toast({
      title: 'Account switched',
      description: `Switched to ${account.display_name}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleSync = async () => {
    try {
      await triggerSync();
      toast({
        title: 'Sync completed',
        description: 'Data has been synchronized successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to sync data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getAccountTypeColor = (accountType: string) => {
    switch (accountType) {
      case 'personal_wallet':
        return 'blue';
      case 'trading_vault':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'personal_wallet':
        return FiUser;
      case 'trading_vault':
        return FiDatabase;
      default:
        return FiUser;
    }
  };

  const formatWalletAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (state.accounts.length === 0 && !state.isLoading) {
    return (
      <Alert status="warning" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>No Hyperliquid accounts configured!</AlertTitle>
          <AlertDescription>
            Please configure your wallet addresses in the environment variables.
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Error display */}
      {(state.error || state.syncError) && (
        <Alert status="error" borderRadius="md" mb={4}>
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>
              {state.error || state.syncError}
            </AlertDescription>
          </Box>
          <Button size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </Alert>
      )}

      <HStack spacing={4} align="center">
        {/* Account Selector */}
        <Menu>
          <MenuButton
            as={Button}
            rightIcon={<Icon as={FiChevronDown} />}
            leftIcon={
              state.selectedAccount ? (
                <Icon as={getAccountTypeIcon(state.selectedAccount.account_type)} />
              ) : (
                <Icon as={FiUser} />
              )
            }
            variant="outline"
            size="md"
            isLoading={state.isLoading}
            loadingText="Loading..."
            minW="200px"
          >
            {state.selectedAccount ? (
              <VStack spacing={0} align="start">
                <Text fontSize="sm" fontWeight="medium">
                  {state.selectedAccount.display_name}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {formatWalletAddress(state.selectedAccount.wallet_address)}
                </Text>
              </VStack>
            ) : (
              'Select Account'
            )}
          </MenuButton>
          
          <MenuList bg={menuBg} borderColor={menuBorder}>
            {state.accounts.map((account) => (
              <MenuItem
                key={`${account.account_type}_${account.wallet_address}`}
                onClick={() => handleAccountSelect(account)}
                _hover={{ bg: hoverBg }}
                isDisabled={state.isLoading}
              >
                <HStack spacing={3} width="100%">
                  <Icon as={getAccountTypeIcon(account.account_type)} />
                  <VStack spacing={0} align="start" flex="1">
                    <HStack spacing={2}>
                      <Text fontWeight="medium">{account.display_name}</Text>
                      <Badge
                        colorScheme={getAccountTypeColor(account.account_type)}
                        size="sm"
                      >
                        {account.account_type.replace('_', ' ')}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      {formatWalletAddress(account.wallet_address)}
                    </Text>
                  </VStack>
                  {state.selectedAccount?.wallet_address === account.wallet_address && (
                    <Badge colorScheme="green" size="sm">
                      Active
                    </Badge>
                  )}
                </HStack>
              </MenuItem>
            ))}
          </MenuList>
        </Menu>

        {/* Sync Button */}
        <Button
          leftIcon={<Icon as={FiRefreshCw} />}
          onClick={handleSync}
          isLoading={state.syncInProgress}
          loadingText="Syncing..."
          variant="outline"
          colorScheme="blue"
          size="md"
          isDisabled={!state.selectedAccount || state.isLoading}
        >
          Sync Data
        </Button>

        {/* Last Sync Time */}
        {state.lastSyncTime && (
          <Text fontSize="sm" color="gray.500">
            Last sync: {formatDistanceToNow(new Date(state.lastSyncTime), { addSuffix: true })}
          </Text>
        )}

        {/* Loading indicator */}
        {state.isLoading && (
          <HStack spacing={2}>
            <Spinner size="sm" />
            <Text fontSize="sm" color="gray.500">
              Loading data...
            </Text>
          </HStack>
        )}
      </HStack>

      {/* Account Summary */}
      {state.selectedAccount && state.summary && (
        <Box mt={4} p={4} borderWidth="1px" borderRadius="md" bg={menuBg}>
          <HStack spacing={6} justify="space-between">
            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.500">
                Account Value
              </Text>
              <Text fontSize="lg" fontWeight="bold">
                ${state.summary.current_portfolio.account_value.toLocaleString()}
              </Text>
            </VStack>
            
            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.500">
                Total Trades
              </Text>
              <Text fontSize="lg" fontWeight="bold">
                {state.summary.trade_statistics.total_trades}
              </Text>
            </VStack>
            
            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.500">
                Win Rate
              </Text>
              <Text fontSize="lg" fontWeight="bold">
                {state.summary.trade_statistics.win_rate.toFixed(1)}%
              </Text>
            </VStack>
            
            <VStack spacing={1} align="start">
              <Text fontSize="sm" color="gray.500">
                Net P&L
              </Text>
              <Text 
                fontSize="lg" 
                fontWeight="bold"
                color={state.summary.trade_statistics.net_pnl >= 0 ? 'green.500' : 'red.500'}
              >
                ${state.summary.trade_statistics.net_pnl.toLocaleString()}
              </Text>
            </VStack>
          </HStack>
        </Box>
      )}
    </Box>
  );
};

export default HyperliquidAccountSwitcher;