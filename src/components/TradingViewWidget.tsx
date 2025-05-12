import React, { useEffect, useRef } from 'react';
import { Box, useColorMode, Spinner, Center, Text } from '@chakra-ui/react';

interface TradingViewWidgetProps {
  symbol: string;
  height?: string;
  width?: string;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

/**
 * TradingViewWidget Component
 * 
 * This component renders a TradingView chart for a given symbol using the official TradingView Widget API.
 * It follows the official documentation at https://www.tradingview.com/widget/advanced-chart/
 */
const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ 
  symbol, 
  height = '400px', 
  width = '100%' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { colorMode } = useColorMode();
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    // Function to load the TradingView Widget script
    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.TradingView) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.id = 'tradingview-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error('Failed to load TradingView script'));
        
        document.head.appendChild(script);
        scriptRef.current = script;
      });
    };

    // Function to create the TradingView Widget
    const createWidget = () => {
      if (!containerRef.current || !window.TradingView) return;
      
      // Clear previous widget if any
      if (widgetRef.current) {
        try {
          // Some versions of the widget have a cleanup method
          if (typeof widgetRef.current.remove === 'function') {
            widgetRef.current.remove();
          }
        } catch (e) {
          console.error('Error cleaning up previous widget:', e);
        }
      }
      
      // Clear container
      containerRef.current.innerHTML = '';
      
      // Create new widget
      widgetRef.current = new window.TradingView.widget({
        container_id: containerRef.current.id,
        autosize: true,
        symbol: symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: colorMode === 'dark' ? 'dark' : 'light',
        style: '1',
        locale: 'en',
        toolbar_bg: colorMode === 'dark' ? '#2D3748' : '#f0f3fa',
        enable_publishing: false,
        withdateranges: true,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        details: true,
        hotlist: true,
        calendar: true,
        // No default studies - let users add their own indicators
        studies: [],
        // Enhanced chart options for better user experience
        show_popup_button: true,
        popup_width: '1000',
        popup_height: '650',
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        drawing_ideas: true
      });
    };

    // Main initialization function
    const initWidget = async () => {
      try {
        await loadScript();
        createWidget();
      } catch (error) {
        console.error('Error initializing TradingView widget:', error);
      }
    };

    // Initialize the widget
    initWidget();

    // Cleanup function
    return () => {
      if (widgetRef.current) {
        try {
          // Check if the container still exists in the DOM before removing
          if (containerRef.current && typeof widgetRef.current.remove === 'function') {
            widgetRef.current.remove();
          }
          // Clear the reference
          widgetRef.current = null;
        } catch (e) {
          console.error('Error cleaning up widget:', e);
        }
      }
    };
  }, [symbol, colorMode]);

  return (
    <Box height={height} width={width} position="relative" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Box p={4} borderBottomWidth="1px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}>
        <Text fontWeight="bold">TradingView Chart - {symbol}</Text>
      </Box>
      
      <Box 
        id={`tradingview-widget-${symbol}`} 
        ref={containerRef} 
        height="calc(100% - 53px)" 
        width="100%"
      />
      
      {!window.TradingView && (
        <Center position="absolute" top="53px" left="0" right="0" bottom="0" bg={colorMode === 'dark' ? 'rgba(26, 32, 44, 0.7)' : 'rgba(247, 250, 252, 0.7)'} zIndex="1">
          <Box textAlign="center">
            <Spinner size="xl" color="brand.500" mb={4} />
            <Text>Loading TradingView chart...</Text>
          </Box>
        </Center>
      )}
    </Box>
  );
};

export default TradingViewWidget;