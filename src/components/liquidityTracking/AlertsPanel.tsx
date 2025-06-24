import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Card,
  CardBody,
  Heading,
  Icon,
  IconButton,
  Alert,
  AlertIcon,
  AlertDescription,
  useColorMode,
  Tooltip
} from '@chakra-ui/react';
import {
  FiAlertTriangle,
  FiAlertCircle,
  FiTrendingDown,
  FiTarget,
  FiX,
  FiCheck
} from 'react-icons/fi';
import { CLAlert } from '../../types/liquidityTracking';

interface AlertsPanelProps {
  alerts: CLAlert[];
  onAlertAcknowledge: (alertId: string) => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onAlertAcknowledge
}) => {
  const { colorMode } = useColorMode();

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'range_breach':
        return FiTarget;
      case 'low_fees':
        return FiTrendingDown;
      case 'high_il':
        return FiAlertTriangle;
      case 'price_target':
        return FiAlertCircle;
      default:
        return FiAlertCircle;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getAlertTitle = (alertType: string) => {
    switch (alertType) {
      case 'range_breach':
        return 'Range Breach';
      case 'low_fees':
        return 'Low Fee Generation';
      case 'high_il':
        return 'High Impermanent Loss';
      case 'price_target':
        return 'Price Target';
      default:
        return 'Alert';
    }
  };

  const formatAlertTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardBody>
          <VStack spacing={4}>
            <Heading size="md">Alerts</Heading>
            <Alert status="success">
              <AlertIcon />
              <AlertDescription>
                No active alerts. Your positions are performing well!
              </AlertDescription>
            </Alert>
          </VStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <VStack spacing={4} align="stretch">
          <HStack justify="space-between" align="center">
            <Heading size="md">Alerts</Heading>
            <Badge colorScheme="red" variant="solid">
              {alerts.length}
            </Badge>
          </HStack>

          <VStack spacing={3} align="stretch" maxH="400px" overflowY="auto">
            {alerts.map((alert) => (
              <Box
                key={alert.id}
                p={3}
                borderRadius="md"
                borderLeft="4px solid"
                borderLeftColor={`${getAlertColor(alert.severity)}.500`}
                bg={colorMode === 'dark' 
                  ? `${getAlertColor(alert.severity)}.900` 
                  : `${getAlertColor(alert.severity)}.50`
                }
                position="relative"
              >
                <HStack justify="space-between" align="flex-start" spacing={3}>
                  <HStack spacing={3} flex="1">
                    <Icon
                      as={getAlertIcon(alert.alert_type)}
                      color={`${getAlertColor(alert.severity)}.500`}
                      boxSize={5}
                    />
                    
                    <VStack align="flex-start" spacing={1} flex="1">
                      <HStack justify="space-between" w="100%">
                        <Text fontSize="sm" fontWeight="semibold">
                          {getAlertTitle(alert.alert_type)}
                        </Text>
                        <Badge
                          colorScheme={getAlertColor(alert.severity)}
                          variant="subtle"
                          size="sm"
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </HStack>
                      
                      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.300' }}>
                        {alert.message}
                      </Text>
                      
                      <HStack spacing={4} fontSize="xs" color="gray.500">
                        <Text>
                          Threshold: {alert.threshold_value}
                        </Text>
                        {alert.triggered_at && (
                          <Text>
                            {formatAlertTime(alert.triggered_at)}
                          </Text>
                        )}
                      </HStack>
                    </VStack>
                  </HStack>

                  <Tooltip label="Acknowledge Alert">
                    <IconButton
                      icon={<FiCheck />}
                      size="sm"
                      variant="ghost"
                      colorScheme={getAlertColor(alert.severity)}
                      onClick={() => onAlertAcknowledge(alert.id)}
                      aria-label="Acknowledge alert"
                    />
                  </Tooltip>
                </HStack>
              </Box>
            ))}
          </VStack>

          {alerts.length > 5 && (
            <Text fontSize="xs" color="gray.500" textAlign="center">
              Showing latest {Math.min(alerts.length, 10)} alerts
            </Text>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

export default AlertsPanel;