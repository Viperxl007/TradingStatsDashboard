import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Progress,
  Icon,
  useColorMode
} from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import { TrendIndicatorProps, TrendDirection } from '../types/macroSentiment';

const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  type,
  direction,
  strength,
  size = 'md'
}) => {
  const { colorMode } = useColorMode();

  const getTrendIcon = (dir: TrendDirection) => {
    switch (dir) {
      case 'UP':
        return FiTrendingUp;
      case 'DOWN':
        return FiTrendingDown;
      case 'SIDEWAYS':
        return FiMinus;
      default:
        return FiMinus;
    }
  };

  const getTrendColor = (dir: TrendDirection, str: number): string => {
    switch (dir) {
      case 'UP':
        return str > 50 ? '#38A169' : '#68D391'; // Green variants
      case 'DOWN':
        return str > 50 ? '#E53E3E' : '#FC8181'; // Red variants
      case 'SIDEWAYS':
        return '#A0AEC0'; // Gray
      default:
        return '#A0AEC0';
    }
  };

  const getTrendColorScheme = (dir: TrendDirection): string => {
    switch (dir) {
      case 'UP':
        return 'green';
      case 'DOWN':
        return 'red';
      case 'SIDEWAYS':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return { iconSize: '20px', progressWidth: '50px', fontSize: 'sm' };
      case 'lg':
        return { iconSize: '28px', progressWidth: '70px', fontSize: 'lg' };
      default:
        return { iconSize: '24px', progressWidth: '60px', fontSize: 'md' };
    }
  };

  const sizeConfig = getSizeConfig();

  return (
    <VStack spacing={3} align="center">
      <Text fontSize="sm" fontWeight="500" color="gray.600">
        {type} Trend
      </Text>
      
      <HStack spacing={2} align="center">
        <Icon 
          as={getTrendIcon(direction)} 
          boxSize={sizeConfig.iconSize}
          color={getTrendColor(direction, strength)}
        />
        <VStack spacing={1} align="start">
          <Text fontSize={sizeConfig.fontSize} fontWeight="bold">
            {direction}
          </Text>
          <Progress 
            value={strength} 
            size="sm" 
            width={sizeConfig.progressWidth}
            colorScheme={getTrendColorScheme(direction)}
            bg={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
          />
        </VStack>
      </HStack>
      
      <Text fontSize="xs" color="gray.500">
        Strength: {strength}%
      </Text>
    </VStack>
  );
};

export default TrendIndicator;