import React from 'react';
import {
  Box,
  HStack,
  VStack,
  Switch,
  Text,
  useColorMode,
  Divider,
  Badge,
  Tooltip,
} from '@chakra-ui/react';

interface ChartIndicatorControlsProps {
  showVolume: boolean;
  showSMA20: boolean;
  showSMA50: boolean;
  showSMA200: boolean;
  showVWAP: boolean;
  onToggleVolume: (enabled: boolean) => void;
  onToggleSMA20: (enabled: boolean) => void;
  onToggleSMA50: (enabled: boolean) => void;
  onToggleSMA200: (enabled: boolean) => void;
  onToggleVWAP: (enabled: boolean) => void;
  hasVolumeData?: boolean;
}

/**
 * Chart Indicator Controls Component
 * 
 * Provides toggle switches for various technical indicators on the chart.
 * Includes visual indicators for each type and tooltips for user guidance.
 */
const ChartIndicatorControls: React.FC<ChartIndicatorControlsProps> = ({
  showVolume,
  showSMA20,
  showSMA50,
  showSMA200,
  showVWAP,
  onToggleVolume,
  onToggleSMA20,
  onToggleSMA50,
  onToggleSMA200,
  onToggleVWAP,
  hasVolumeData = false,
}) => {
  const { colorMode } = useColorMode();

  const indicatorColors = {
    light: {
      volume: '#94a3b8',
      sma20: '#ff6b35',
      sma50: '#4ecdc4',
      sma200: '#9333ea',
      vwap: '#96ceb4',
    },
    dark: {
      volume: '#718096',
      sma20: '#ff8c69',
      sma50: '#5fd3ca',
      sma200: '#a855f7',
      vwap: '#a8d8c2',
    }
  };

  const colors = indicatorColors[colorMode];

  const IndicatorControl = ({
    label,
    isEnabled,
    onToggle,
    color,
    tooltip,
    disabled = false,
  }: {
    label: string;
    isEnabled: boolean;
    onToggle: (enabled: boolean) => void;
    color: string;
    tooltip: string;
    disabled?: boolean;
  }) => (
    <Tooltip label={tooltip} placement="top" hasArrow>
      <HStack spacing={3} opacity={disabled ? 0.5 : 1}>
        <Switch
          isChecked={isEnabled}
          onChange={(e) => onToggle(e.target.checked)}
          colorScheme="blue"
          size="sm"
          isDisabled={disabled}
        />
        <HStack spacing={2}>
          <Box
            w={3}
            h={3}
            borderRadius="full"
            bg={color}
            opacity={isEnabled ? 1 : 0.3}
          />
          <Text fontSize="sm" fontWeight="medium">
            {label}
          </Text>
        </HStack>
      </HStack>
    </Tooltip>
  );

  return (
    <Box
      p={4}
      borderRadius="lg"
      bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
      border="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      shadow="sm"
    >
      <VStack spacing={3} align="stretch">
        <HStack justify="space-between" align="center">
          <Text fontSize="sm" fontWeight="bold" color="gray.500">
            Technical Indicators
          </Text>
          <Badge
            colorScheme="blue"
            variant="subtle"
            fontSize="xs"
          >
            Chart Overlays
          </Badge>
        </HStack>

        <Divider />

        {/* Volume Indicator */}
        <IndicatorControl
          label="Volume Bars"
          isEnabled={showVolume}
          onToggle={onToggleVolume}
          color={colors.volume}
          tooltip={hasVolumeData ? "Show volume histogram at bottom of chart" : "Volume data not available for this symbol"}
          disabled={!hasVolumeData}
        />

        <Divider />

        {/* Moving Averages */}
        <VStack spacing={2} align="stretch">
          <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase">
            Moving Averages
          </Text>
          
          <IndicatorControl
            label="SMA 20"
            isEnabled={showSMA20}
            onToggle={onToggleSMA20}
            color={colors.sma20}
            tooltip="20-period Simple Moving Average - Short-term trend"
          />
          
          <IndicatorControl
            label="SMA 50"
            isEnabled={showSMA50}
            onToggle={onToggleSMA50}
            color={colors.sma50}
            tooltip="50-period Simple Moving Average - Medium-term trend"
          />
          
          <IndicatorControl
            label="SMA 200"
            isEnabled={showSMA200}
            onToggle={onToggleSMA200}
            color={colors.sma200}
            tooltip="200-period Simple Moving Average - Long-term trend"
          />
        </VStack>

        <Divider />

        {/* VWAP */}
        <IndicatorControl
          label="VWAP"
          isEnabled={showVWAP}
          onToggle={onToggleVWAP}
          color={colors.vwap}
          tooltip={hasVolumeData ? "Volume Weighted Average Price - Institutional benchmark" : "VWAP requires volume data"}
          disabled={!hasVolumeData}
        />
      </VStack>
    </Box>
  );
};

export default ChartIndicatorControls;