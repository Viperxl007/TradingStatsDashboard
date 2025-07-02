import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
  Badge,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
  ListIcon,
  Checkbox,
  Select,
  useColorModeValue,
  Spinner,
  Center,
  Icon,
  Flex,
  Tooltip,
  Code,
  useToast
} from '@chakra-ui/react';
import {
  FiAlertTriangle,
  FiInfo,
  FiTrash2,
  FiShield,
  FiLink,
  FiDatabase,
  FiClock,
  FiTarget,
  FiCheckCircle,
  FiXCircle,
  FiArrowRight
} from 'react-icons/fi';
import {
  universalDeletionService,
  DeletionImpact,
  DeletionStrategy,
  DeletableDataType,
  DeletionConfig,
  DeletionResult
} from '../../services/universalDeletionService';

interface EnhancedDeletionWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ id: string; type: DeletableDataType; displayName?: string }>;
  onConfirm: (result: DeletionResult) => void;
  title?: string;
  description?: string;
}

/**
 * Enhanced Deletion Warning Dialog
 * 
 * Provides comprehensive warnings and impact assessment before deletion
 */
const EnhancedDeletionWarningDialog: React.FC<EnhancedDeletionWarningDialogProps> = ({
  isOpen,
  onClose,
  items,
  onConfirm,
  title = 'Confirm Deletion',
  description = 'Review the impact of this deletion operation'
}) => {
  const [impacts, setImpacts] = useState<DeletionImpact[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<DeletionStrategy>('preserve');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const toast = useToast();
  
  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const criticalColor = useColorModeValue('red.50', 'red.900');
  const warningColor = useColorModeValue('orange.50', 'orange.900');
  const infoColor = useColorModeValue('blue.50', 'blue.900');

  // Analyze impact when dialog opens
  useEffect(() => {
    if (isOpen && items.length > 0) {
      analyzeImpact();
    }
  }, [isOpen, items]);

  /**
   * Analyze deletion impact
   */
  const analyzeImpact = async () => {
    setIsAnalyzing(true);
    try {
      const impactResults = await universalDeletionService.assessBulkDeletionImpact(items);
      setImpacts(impactResults);
      
      // Set recommended strategy based on analysis
      const hasCritical = impactResults.some(impact => impact.criticalDependencies.length > 0);
      const hasWarnings = impactResults.some(impact => impact.warnings.length > 0);
      
      if (hasCritical) {
        setSelectedStrategy('warn_and_stop');
      } else if (hasWarnings) {
        setSelectedStrategy('preserve');
      } else {
        setSelectedStrategy('cascade');
      }
      
    } catch (error) {
      console.error('Error analyzing deletion impact:', error);
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze deletion impact',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Execute deletion
   */
  const handleConfirm = async () => {
    if (!confirmChecked) {
      toast({
        title: 'Confirmation Required',
        description: 'Please confirm that you understand the impact',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsExecuting(true);
    try {
      const config: DeletionConfig = {
        strategy: selectedStrategy,
        force: false,
        createBackup,
        dryRun: false,
        confirmBeforeDelete: false,
        logLevel: 'detailed',
        preserveProductionData: true
      };

      const result = await universalDeletionService.executeDeletion(items, config);
      onConfirm(result);
      
    } catch (error) {
      console.error('Error executing deletion:', error);
      toast({
        title: 'Deletion Error',
        description: 'Failed to execute deletion operation',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * Get severity color for impact
   */
  const getSeverityColor = (impact: DeletionImpact) => {
    if (impact.criticalDependencies.length > 0) return 'red';
    if (impact.warnings.length > 0) return 'orange';
    return 'green';
  };

  /**
   * Get strategy description
   */
  const getStrategyDescription = (strategy: DeletionStrategy) => {
    switch (strategy) {
      case 'cascade':
        return 'Delete item and all dependent data (may break references)';
      case 'preserve':
        return 'Delete item but preserve dependent data with warnings';
      case 'warn_and_stop':
        return 'Stop deletion due to critical dependencies';
      default:
        return 'Unknown strategy';
    }
  };

  /**
   * Calculate total impact
   */
  const totalImpact = impacts.reduce((acc, impact) => ({
    directDependencies: acc.directDependencies + impact.directDependencies.length,
    indirectDependencies: acc.indirectDependencies + impact.indirectDependencies.length,
    criticalDependencies: acc.criticalDependencies + impact.criticalDependencies.length,
    affectedRecords: acc.affectedRecords + impact.affectedRecordsCount
  }), {
    directDependencies: 0,
    indirectDependencies: 0,
    criticalDependencies: 0,
    affectedRecords: 0
  });

  const canProceed = impacts.length > 0 && 
    (selectedStrategy !== 'warn_and_stop' || totalImpact.criticalDependencies === 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg={bgColor} maxH="90vh">
        <ModalHeader>
          <HStack>
            <Icon as={FiAlertTriangle} color="orange.500" />
            <Text>{title}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Description */}
            <Text color="gray.600">{description}</Text>

            {/* Analysis Loading */}
            {isAnalyzing && (
              <Center py={8}>
                <VStack>
                  <Spinner size="lg" color="blue.500" />
                  <Text>Analyzing deletion impact...</Text>
                </VStack>
              </Center>
            )}

            {/* Impact Summary */}
            {!isAnalyzing && impacts.length > 0 && (
              <Alert status={totalImpact.criticalDependencies > 0 ? 'error' : 'warning'}>
                <AlertIcon />
                <Box>
                  <AlertTitle>Impact Summary</AlertTitle>
                  <AlertDescription>
                    <VStack align="start" spacing={1}>
                      <Text>
                        Deleting {items.length} item{items.length > 1 ? 's' : ''} will affect{' '}
                        <strong>{totalImpact.affectedRecords}</strong> related record{totalImpact.affectedRecords !== 1 ? 's' : ''}
                      </Text>
                      {totalImpact.criticalDependencies > 0 && (
                        <Text color="red.600">
                          ⚠️ {totalImpact.criticalDependencies} critical dependencies found
                        </Text>
                      )}
                    </VStack>
                  </AlertDescription>
                </Box>
              </Alert>
            )}

            {/* Detailed Impact Analysis */}
            {!isAnalyzing && impacts.length > 0 && (
              <Accordion allowMultiple>
                <AccordionItem>
                  <AccordionButton>
                    <Box flex="1" textAlign="left">
                      <HStack>
                        <Icon as={FiDatabase} />
                        <Text fontWeight="medium">Detailed Impact Analysis</Text>
                        <Badge colorScheme={totalImpact.criticalDependencies > 0 ? 'red' : 'orange'}>
                          {impacts.length} item{impacts.length > 1 ? 's' : ''}
                        </Badge>
                      </HStack>
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4}>
                    <VStack spacing={4} align="stretch">
                      {impacts.map((impact, index) => (
                        <Box
                          key={`${impact.targetType}-${impact.targetId}`}
                          p={4}
                          border="1px"
                          borderColor={borderColor}
                          borderRadius="md"
                          bg={impact.criticalDependencies.length > 0 ? criticalColor : 
                              impact.warnings.length > 0 ? warningColor : infoColor}
                        >
                          <VStack align="stretch" spacing={3}>
                            {/* Item Header */}
                            <HStack justify="space-between">
                              <HStack>
                                <Badge colorScheme={getSeverityColor(impact)}>
                                  {impact.targetType}
                                </Badge>
                                <Code>{impact.targetId}</Code>
                              </HStack>
                              <Badge variant="outline">
                                {impact.affectedRecordsCount} affected
                              </Badge>
                            </HStack>

                            {/* Dependencies */}
                            {impact.directDependencies.length > 0 && (
                              <Box>
                                <Text fontWeight="medium" fontSize="sm" mb={2}>
                                  Direct Dependencies ({impact.directDependencies.length})
                                </Text>
                                <List spacing={1}>
                                  {impact.directDependencies.slice(0, 3).map((dep, depIndex) => (
                                    <ListItem key={depIndex} fontSize="sm">
                                      <ListIcon 
                                        as={dep.critical ? FiXCircle : FiLink} 
                                        color={dep.critical ? 'red.500' : 'blue.500'} 
                                      />
                                      <Badge size="sm" mr={2}>{dep.type}</Badge>
                                      {dep.description}
                                    </ListItem>
                                  ))}
                                  {impact.directDependencies.length > 3 && (
                                    <ListItem fontSize="sm" color="gray.600">
                                      ... and {impact.directDependencies.length - 3} more
                                    </ListItem>
                                  )}
                                </List>
                              </Box>
                            )}

                            {/* Warnings */}
                            {impact.warnings.length > 0 && (
                              <Box>
                                <Text fontWeight="medium" fontSize="sm" mb={2}>
                                  Warnings
                                </Text>
                                <List spacing={1}>
                                  {impact.warnings.map((warning, warnIndex) => (
                                    <ListItem key={warnIndex} fontSize="sm">
                                      <ListIcon as={FiAlertTriangle} color="orange.500" />
                                      {warning}
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}

                            {/* Alternative Actions */}
                            {impact.alternativeActions.length > 0 && (
                              <Box>
                                <Text fontWeight="medium" fontSize="sm" mb={2}>
                                  Recommended Actions
                                </Text>
                                <List spacing={1}>
                                  {impact.alternativeActions.map((action, actionIndex) => (
                                    <ListItem key={actionIndex} fontSize="sm">
                                      <ListIcon as={FiArrowRight} color="green.500" />
                                      {action}
                                    </ListItem>
                                  ))}
                                </List>
                              </Box>
                            )}
                          </VStack>
                        </Box>
                      ))}
                    </VStack>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            )}

            {/* Strategy Selection */}
            {!isAnalyzing && impacts.length > 0 && (
              <Box>
                <Text fontWeight="medium" mb={3}>Deletion Strategy</Text>
                <VStack spacing={3} align="stretch">
                  <Select
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value as DeletionStrategy)}
                    disabled={totalImpact.criticalDependencies > 0}
                  >
                    <option value="preserve">Preserve Dependencies</option>
                    <option value="cascade">Cascade Delete</option>
                    {totalImpact.criticalDependencies > 0 && (
                      <option value="warn_and_stop">Stop - Critical Dependencies</option>
                    )}
                  </Select>
                  <Text fontSize="sm" color="gray.600">
                    {getStrategyDescription(selectedStrategy)}
                  </Text>
                </VStack>
              </Box>
            )}

            {/* Advanced Options */}
            <Box>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                leftIcon={<Icon as={FiTarget} />}
              >
                Advanced Options
              </Button>
              
              {showAdvanced && (
                <VStack spacing={3} align="stretch" mt={3} p={4} bg={infoColor} borderRadius="md">
                  <Checkbox
                    isChecked={createBackup}
                    onChange={(e) => setCreateBackup(e.target.checked)}
                  >
                    Create backup before deletion
                  </Checkbox>
                  
                  <Text fontSize="sm" color="gray.600">
                    Backups allow you to restore deleted data if needed.
                  </Text>
                </VStack>
              )}
            </Box>

            {/* Confirmation */}
            {!isAnalyzing && impacts.length > 0 && (
              <Box p={4} bg={warningColor} borderRadius="md">
                <Checkbox
                  isChecked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  colorScheme="red"
                >
                  <Text fontWeight="medium">
                    I understand the impact and want to proceed with deletion
                  </Text>
                </Checkbox>
                
                {totalImpact.criticalDependencies > 0 && (
                  <Alert status="error" mt={3} size="sm">
                    <AlertIcon />
                    <AlertDescription fontSize="sm">
                      Critical dependencies prevent safe deletion. Please resolve dependencies first.
                    </AlertDescription>
                  </Alert>
                )}
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose} disabled={isExecuting}>
              Cancel
            </Button>
            
            <Tooltip
              label={!canProceed ? 'Cannot proceed due to critical dependencies' : ''}
              isDisabled={canProceed}
            >
              <Button
                colorScheme="red"
                onClick={handleConfirm}
                disabled={!canProceed || !confirmChecked || isExecuting}
                isLoading={isExecuting}
                loadingText="Deleting..."
                leftIcon={<Icon as={FiTrash2} />}
              >
                {selectedStrategy === 'warn_and_stop' ? 'Cannot Delete' : 'Delete Items'}
              </Button>
            </Tooltip>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EnhancedDeletionWarningDialog;