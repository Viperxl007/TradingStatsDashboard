import React from 'react';
import {
  VStack,
  Text,
  Box,
  Icon,
  useColorMode
} from '@chakra-ui/react';
import { FiX, FiAlertTriangle, FiPlay, FiZap } from 'react-icons/fi';
import { TradePermissionCardProps, TradePermission } from '../types/macroSentiment';

const TradePermissionCard: React.FC<TradePermissionCardProps> = ({
  permission,
  size = 'md'
}) => {
  const { colorMode } = useColorMode();

  const getPermissionColor = (perm: TradePermission): string => {
    switch (perm) {
      case 'NO_TRADE':
        return '#E53E3E'; // Red
      case 'SELECTIVE':
        return '#DD6B20'; // Orange
      case 'ACTIVE':
        return '#38A169'; // Green
      case 'AGGRESSIVE':
        return '#00B5D8'; // Bright green/cyan
      default:
        return '#A0AEC0'; // Gray
    }
  };

  const getPermissionIcon = (perm: TradePermission) => {
    switch (perm) {
      case 'NO_TRADE':
        return FiX;
      case 'SELECTIVE':
        return FiAlertTriangle;
      case 'ACTIVE':
        return FiPlay;
      case 'AGGRESSIVE':
        return FiZap;
      default:
        return FiX;
    }
  };

  const getPermissionLabel = (perm: TradePermission): string => {
    switch (perm) {
      case 'NO_TRADE':
        return 'No Trade';
      case 'SELECTIVE':
        return 'Selective';
      case 'ACTIVE':
        return 'Active';
      case 'AGGRESSIVE':
        return 'Aggressive';
      default:
        return 'Unknown';
    }
  };

  const getPermissionDescription = (perm: TradePermission): string => {
    switch (perm) {
      case 'NO_TRADE':
        return 'Preserve Capital';
      case 'SELECTIVE':
        return 'Selective Trading';
      case 'ACTIVE':
        return 'Active Trading';
      case 'AGGRESSIVE':
        return 'Aggressive Trading';
      default:
        return 'Unknown Status';
    }
  };

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return { circleSize: '50px', iconSize: '20px', fontSize: 'sm' };
      case 'lg':
        return { circleSize: '70px', iconSize: '28px', fontSize: 'lg' };
      default:
        return { circleSize: '60px', iconSize: '24px', fontSize: 'md' };
    }
  };

  const sizeConfig = getSizeConfig();

  return (
    <VStack spacing={3} align="center">
      <Text fontSize="sm" fontWeight="500" color="gray.600">
        Trade Permission
      </Text>
      
      <VStack spacing={2} align="center">
        <Box 
          w={sizeConfig.circleSize}
          h={sizeConfig.circleSize}
          borderRadius="full" 
          bg={getPermissionColor(permission)}
          display="flex"
          alignItems="center"
          justifyContent="center"
          shadow="md"
        >
          <Icon 
            as={getPermissionIcon(permission)} 
            boxSize={sizeConfig.iconSize}
            color="white"
          />
        </Box>
        
        <VStack spacing={1} align="center">
          <Text fontSize={sizeConfig.fontSize} fontWeight="bold">
            {getPermissionLabel(permission)}
          </Text>
          <Text fontSize="xs" color="gray.500" textAlign="center">
            {getPermissionDescription(permission)}
          </Text>
        </VStack>
      </VStack>
    </VStack>
  );
};

export default TradePermissionCard;