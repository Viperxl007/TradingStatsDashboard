import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  useDisclosure,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Center,
  Icon,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useColorModeValue
} from '@chakra-ui/react';
import {
  FiTrash2,
  FiShield,
  FiDatabase,
  FiRefreshCw,
  FiDownload,
  FiUpload,
  FiChevronDown,
  FiAlertTriangle
} from 'react-icons/fi';
import {
  universalDeletionService,
  DeletableDataType,
  DeletionResult,
  DeletionStrategy
} from '../../services/universalDeletionService';
import EnhancedDeletionWarningDialog from './EnhancedDeletionWarningDialog';

interface DeletionManagerProps {
  /**
   * Items to be deleted
   */
  items: Array<{ id: string; type: DeletableDataType; displayName?: string }>;
  
  /**
   * Callback when deletion is completed
   */
  onDeletionComplete?: (result: DeletionResult) => void;
  
  /**
   * Custom button text
   */
  buttonText?: string;
  
  /**
   * Button variant
   */
  variant?: 'solid' | 'outline' | 'ghost';
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Show as menu with options
   */
  showAsMenu?: boolean;
  
  /**
   * Disable the component
   */
  disabled?: boolean;
  
  /**
   * Custom title for the dialog
   */
  dialogTitle?: string;
  
  /**
   * Custom description for the dialog
   */
  dialogDescription?: string;
}

/**
 * Deletion Manager Component
 * 
 * Provides a unified interface for deletion operations with enhanced warnings
 */
const DeletionManager: React.FC<DeletionManagerProps> = ({
  items,
  onDeletionComplete,
  buttonText = 'Delete',
  variant = 'solid',
  size = 'md',
  showAsMenu = false,
  disabled = false,
  dialogTitle,
  dialogDescription
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  /**
   * Handle deletion completion
   */
  const handleDeletionComplete = useCallback((result: DeletionResult) => {
    onClose();
    
    if (result.success) {
      toast({
        title: 'Deletion Completed',
        description: `Successfully deleted ${result.deletedItems.length} item${result.deletedItems.length !== 1 ? 's' : ''}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Deletion Failed',
        description: `Failed to delete items. ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} occurred.`,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    }
    
    if (onDeletionComplete) {
      onDeletionComplete(result);
    }
  }, [onClose, toast, onDeletionComplete]);

  /**
   * Handle quick deletion (with minimal warnings)
   */
  const handleQuickDelete = async () => {
    if (items.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to delete',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      
      // Quick impact assessment
      const impacts = await universalDeletionService.assessBulkDeletionImpact(items);
      const hasCritical = impacts.some(impact => impact.criticalDependencies.length > 0);
      
      if (hasCritical) {
        // Force open detailed dialog for critical dependencies
        onOpen();
        return;
      }
      
      // Execute with preserve strategy for safety
      const result = await universalDeletionService.executeDeletion(items, {
        strategy: 'preserve',
        force: false,
        createBackup: true,
        dryRun: false,
        confirmBeforeDelete: false,
        logLevel: 'minimal',
        preserveProductionData: true
      });
      
      handleDeletionComplete(result);
      
    } catch (error) {
      console.error('Error in quick deletion:', error);
      toast({
        title: 'Deletion Error',
        description: 'Failed to execute quick deletion',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Handle dry run
   */
  const handleDryRun = async () => {
    if (items.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select items to test deletion',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      
      const result = await universalDeletionService.executeDeletion(items, {
        strategy: 'preserve',
        force: false,
        createBackup: false,
        dryRun: true,
        confirmBeforeDelete: false,
        logLevel: 'detailed',
        preserveProductionData: true
      });
      
      toast({
        title: 'Dry Run Completed',
        description: `Would delete ${result.deletedItems.length} items and preserve ${result.preservedItems.length} items`,
        status: 'info',
        duration: 7000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('Error in dry run:', error);
      toast({
        title: 'Dry Run Error',
        description: 'Failed to execute dry run',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Load deletion statistics
   */
  const loadStatistics = async () => {
    try {
      setIsAnalyzing(true);
      const stats = await universalDeletionService.getDeletionStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Get button color scheme based on items
   */
  const getColorScheme = () => {
    if (items.length === 0) return 'gray';
    if (items.length > 10) return 'red';
    if (items.length > 5) return 'orange';
    return 'red';
  };

  /**
   * Check if items contain production data
   */
  const hasProductionData = () => {
    return items.some(item => 
      item.type === 'active_trade' || 
      (item.type === 'ai_trade' && item.id.includes('production'))
    );
  };

  if (showAsMenu) {
    return (
      <>
        <Menu>
          <MenuButton
            as={Button}
            rightIcon={<FiChevronDown />}
            colorScheme={getColorScheme()}
            variant={variant}
            size={size}
            disabled={disabled || items.length === 0}
            isLoading={isAnalyzing}
          >
            {buttonText} ({items.length})
          </MenuButton>
          <MenuList>
            <MenuItem
              icon={<FiAlertTriangle />}
              onClick={onOpen}
              disabled={items.length === 0}
            >
              Delete with Full Analysis
            </MenuItem>
            <MenuItem
              icon={<FiTrash2 />}
              onClick={handleQuickDelete}
              disabled={items.length === 0}
            >
              Quick Delete (Safe)
            </MenuItem>
            <MenuItem
              icon={<FiShield />}
              onClick={handleDryRun}
              disabled={items.length === 0}
            >
              Test Deletion (Dry Run)
            </MenuItem>
            <MenuDivider />
            <MenuItem
              icon={<FiDatabase />}
              onClick={loadStatistics}
            >
              View Statistics
            </MenuItem>
          </MenuList>
        </Menu>

        <EnhancedDeletionWarningDialog
          isOpen={isOpen}
          onClose={onClose}
          items={items}
          onConfirm={handleDeletionComplete}
          title={dialogTitle}
          description={dialogDescription}
        />
      </>
    );
  }

  return (
    <>
      <Tooltip
        label={
          items.length === 0 
            ? 'No items selected for deletion'
            : hasProductionData()
            ? 'Contains production data - use with caution'
            : `Delete ${items.length} item${items.length !== 1 ? 's' : ''}`
        }
      >
        <Button
          colorScheme={getColorScheme()}
          variant={variant}
          size={size}
          onClick={onOpen}
          disabled={disabled || items.length === 0}
          isLoading={isAnalyzing}
          leftIcon={<Icon as={FiTrash2} />}
        >
          {buttonText}
          {items.length > 0 && (
            <Badge ml={2} colorScheme="white" color={getColorScheme() + '.500'}>
              {items.length}
            </Badge>
          )}
        </Button>
      </Tooltip>

      {/* Production Data Warning */}
      {hasProductionData() && (
        <Alert status="warning" size="sm" mt={2}>
          <AlertIcon />
          <AlertDescription fontSize="sm">
            Selection contains production data
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Display */}
      {statistics && (
        <Box mt={4} p={4} bg={bgColor} border="1px" borderColor={borderColor} borderRadius="md">
          <Text fontWeight="medium" mb={3}>Deletion Statistics</Text>
          <VStack spacing={2} align="stretch">
            {Object.entries(statistics.totalItems).map(([type, count]) => (
              <HStack key={type} justify="space-between">
                <Text fontSize="sm" textTransform="capitalize">
                  {type.replace('_', ' ')}:
                </Text>
                <HStack>
                  <Badge>{count as number} total</Badge>
                  <Badge colorScheme="green">
                    {statistics.deletableItems[type]} deletable
                  </Badge>
                </HStack>
              </HStack>
            ))}
            
            {statistics.recommendations.length > 0 && (
              <Box mt={3}>
                <Text fontSize="sm" fontWeight="medium" mb={2}>Recommendations:</Text>
                <VStack spacing={1} align="stretch">
                  {statistics.recommendations.map((rec: string, index: number) => (
                    <Text key={index} fontSize="xs" color="gray.600">
                      • {rec}
                    </Text>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </Box>
      )}

      <EnhancedDeletionWarningDialog
        isOpen={isOpen}
        onClose={onClose}
        items={items}
        onConfirm={handleDeletionComplete}
        title={dialogTitle}
        description={dialogDescription}
      />
    </>
  );
};

export default DeletionManager;