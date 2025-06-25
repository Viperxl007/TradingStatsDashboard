import React from 'react';
import {
  HStack,
  Box,
  Text,
  useColorMode,
} from '@chakra-ui/react';

interface ChartIndicatorLegendProps {
  showVolume: boolean;
  showSMA20: boolean;
  showSMA50: boolean;
  showSMA200: boolean;
  showVWAP: boolean;
  hasVolumeData?: boolean;
}

/**
 * Chart Indicator Legend Component
 * 
 * Displays active indicators in the chart header area similar to trading levels legend.
 * Only shows indicators that are currently enabled.
 */
const ChartIndicatorLegend: React.FC<ChartIndicatorLegendProps> = ({
  showVolume,
  showSMA20,
  showSMA50,
  showSMA200,
  showVWAP,
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

  const LegendItem = ({ 
    label, 
    color, 
    lineStyle = 'solid' 
  }: { 
    label: string; 
    color: string; 
    lineStyle?: 'solid' | 'dotted';
  }) => (
    <HStack spacing={2}>
      <Box
        w={4}
        h={0}
        borderTop="2px"
        borderStyle={lineStyle}
        borderColor={color}
      />
      <Text fontSize="xs" fontWeight="medium" color="gray.600">
        {label}
      </Text>
    </HStack>
  );

  const VolumeItem = ({ color }: { color: string }) => (
    <HStack spacing={2}>
      <Box
        w={3}
        h={3}
        bg={color}
        opacity={0.7}
      />
      <Text fontSize="xs" fontWeight="medium" color="gray.600">
        Volume
      </Text>
    </HStack>
  );

  // Collect active indicators
  const activeIndicators = [];

  if (showVolume && hasVolumeData) {
    activeIndicators.push(
      <VolumeItem key="volume" color={colors.volume} />
    );
  }

  if (showSMA20) {
    activeIndicators.push(
      <LegendItem key="sma20" label="SMA 20" color={colors.sma20} />
    );
  }

  if (showSMA50) {
    activeIndicators.push(
      <LegendItem key="sma50" label="SMA 50" color={colors.sma50} />
    );
  }

  if (showSMA200) {
    activeIndicators.push(
      <LegendItem key="sma200" label="SMA 200" color={colors.sma200} />
    );
  }

  if (showVWAP && hasVolumeData) {
    activeIndicators.push(
      <LegendItem key="vwap" label="VWAP" color={colors.vwap} lineStyle="dotted" />
    );
  }

  // Don't render if no indicators are active
  if (activeIndicators.length === 0) {
    return null;
  }

  return (
    <HStack spacing={4} flexWrap="wrap">
      {activeIndicators}
    </HStack>
  );
};

export default ChartIndicatorLegend;