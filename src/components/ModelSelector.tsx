import React, { useState, useEffect } from 'react';
import {
  Box,
  Select,
  FormControl,
  FormLabel,
  Text,
  HStack,
  VStack,
  Badge,
  Tooltip,
  useColorMode,
  Spinner,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import { ClaudeModel, AvailableModelsResponse } from '../types/chartAnalysis';
import { getAvailableModels } from '../services/chartAnalysisService';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  isDisabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  isDisabled = false
}) => {
  const { colorMode } = useColorMode();
  const [models, setModels] = useState<ClaudeModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response: AvailableModelsResponse = await getAvailableModels();
        
        if (response.success) {
          setModels(response.models);
          setDefaultModel(response.default_model);
          
          // If no model is selected, use the default
          if (!selectedModel && response.default_model) {
            onModelChange(response.default_model);
          }
        } else {
          setError('Failed to load available models');
        }
      } catch (err) {
        console.error('Error fetching models:', err);
        setError(err instanceof Error ? err.message : 'Failed to load models');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [selectedModel, onModelChange]);

  const selectedModelInfo = models.find(model => model.id === selectedModel);

  if (isLoading) {
    return (
      <Box>
        <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">
          AI Model Selection
        </FormLabel>
        <HStack>
          <Spinner size="sm" />
          <Text fontSize="sm" color="gray.500">Loading models...</Text>
        </HStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">
          AI Model Selection
        </FormLabel>
        <Alert status="warning" size="sm">
          <AlertIcon />
          <Text fontSize="sm">{error}</Text>
        </Alert>
      </Box>
    );
  }

  return (
    <VStack spacing={3} align="stretch">
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">
          AI Model Selection
        </FormLabel>
        
        <Select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          isDisabled={isDisabled}
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
          size="sm"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </Select>
      </FormControl>

      {/* Model Information */}
      {selectedModelInfo && (
        <Box
          p={3}
          bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
          borderRadius="md"
          border="1px solid"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <VStack spacing={2} align="stretch">
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="semibold">
                {selectedModelInfo.name}
              </Text>
              {selectedModel === defaultModel && (
                <Badge colorScheme="blue" size="sm">
                  Default
                </Badge>
              )}
            </HStack>
            
            <Text fontSize="xs" color="gray.500">
              {selectedModelInfo.description}
            </Text>
            
            <HStack justify="space-between" fontSize="xs">
              <Tooltip label="Maximum tokens the model can process">
                <Text color="gray.500">
                  Max Tokens: <Text as="span" fontWeight="medium">{selectedModelInfo.max_tokens.toLocaleString()}</Text>
                </Text>
              </Tooltip>
              
              <Tooltip label="Cost per 1,000 tokens">
                <Text color="gray.500">
                  Cost: <Text as="span" fontWeight="medium">${selectedModelInfo.cost_per_1k_tokens}/1K</Text>
                </Text>
              </Tooltip>
            </HStack>
          </VStack>
        </Box>
      )}
      
      <Text fontSize="xs" color="gray.500">
        The selected model will be used for all AI chart analysis. Model selection is saved automatically.
      </Text>
    </VStack>
  );
};

export default ModelSelector;