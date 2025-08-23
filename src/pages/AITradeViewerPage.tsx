import React from 'react';
import { ChakraProvider, Box, useColorMode, Button, VStack, Text, Heading, useColorModeValue } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import AITradeViewerPortal from '../components/AITradeViewerPortal';
import theme from '../theme';

/**
 * Standalone AI Trade Viewer Page
 *
 * This page can be served independently and accessed via ngrok
 * without exposing your entire application.
 */
const AITradeViewerPage: React.FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const bgColor = useColorModeValue('gray.50', 'gray.900');

  return (
    <ChakraProvider theme={theme}>
      <Box minH="100vh" bg={bgColor}>
        {/* Header with theme toggle */}
        <Box
          as="header"
          bg={useColorModeValue('white', 'gray.800')}
          borderBottomWidth="1px"
          borderColor={useColorModeValue('gray.200', 'gray.700')}
          px={6}
          py={4}
          position="sticky"
          top={0}
          zIndex={10}
          boxShadow="sm"
        >
          <VStack spacing={2} align="start">
            <Heading size="lg" color={useColorModeValue('gray.800', 'white')}>
              🤖 AI Trade Viewer Portal
            </Heading>
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>
              Real-time view of AI-generated trade recommendations • Secure local access only
            </Text>
          </VStack>

          {/* Theme toggle button */}
          <Button
            position="absolute"
            top={4}
            right={6}
            onClick={toggleColorMode}
            variant="ghost"
            size="sm"
            leftIcon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
          >
            {colorMode === 'light' ? 'Dark' : 'Light'}
          </Button>
        </Box>

        {/* Main content */}
        <Box p={0}>
          <AITradeViewerPortal />
        </Box>

        {/* Footer */}
        <Box
          as="footer"
          bg={useColorModeValue('white', 'gray.800')}
          borderTopWidth="1px"
          borderColor={useColorModeValue('gray.200', 'gray.700')}
          px={6}
          py={4}
          textAlign="center"
        >
          <VStack spacing={1}>
            <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')}>
              🔒 Secure local access • No internet exposure • Read-only data
            </Text>
            <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.500')}>
              Last updated: {new Date().toLocaleString()}
            </Text>
          </VStack>
        </Box>
      </Box>
    </ChakraProvider>
  );
};

export default AITradeViewerPage;