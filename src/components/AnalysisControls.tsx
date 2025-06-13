import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Textarea,
  Switch,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useColorMode,
  Icon,
  Divider,
  Alert,
  AlertIcon,
  Collapse,
  useDisclosure,
  Card,
  CardBody,
  CardHeader,
  Flex
} from '@chakra-ui/react';
import {
  FiSettings,
  FiPlay,
  FiUpload,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp
} from 'react-icons/fi';
import ModelSelector from './ModelSelector';

interface AnalysisControlsProps {
  ticker: string;
  onAnalyzeChart: (chartImage: string, additionalContext?: string, selectedModel?: string) => void;
  isAnalyzing: boolean;
}

const AnalysisControls: React.FC<AnalysisControlsProps> = ({
  ticker,
  onAnalyzeChart,
  isAnalyzing
}) => {
  const { colorMode } = useColorMode();
  const { isOpen: isAdvancedOpen, onToggle: onAdvancedToggle } = useDisclosure();
  
  // Local state
  const [additionalContext, setAdditionalContext] = useState('');
  const [autoAnalysis, setAutoAnalysis] = useState(false);
  const [analysisInterval, setAnalysisInterval] = useState(30);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Load saved model selection from localStorage
  useEffect(() => {
    const savedModel = localStorage.getItem('selectedClaudeModel');
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Save model selection to localStorage when it changes
  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('selectedClaudeModel', modelId);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        // Remove data URL prefix
        const imageData = base64.split(',')[1];
        setUploadedImage(imageData);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle analyze with uploaded image
  const handleAnalyzeUploaded = () => {
    if (uploadedImage) {
      const context = additionalContext.trim() || undefined;
      onAnalyzeChart(uploadedImage, context, selectedModel);
    }
  };

  // Handle quick analysis (placeholder for screenshot capture)
  const handleQuickAnalysis = () => {
    // This would trigger the chart screenshot capture in the parent component
    // For now, we'll show a placeholder message
    console.log('Quick analysis triggered for', ticker, 'with model:', selectedModel);
  };

  return (
    <Card>
      <CardHeader>
        <Flex justify="space-between" align="center">
          <HStack>
            <Icon as={FiSettings} color="blue.500" />
            <Text fontWeight="semibold">Analysis Controls</Text>
          </HStack>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={onAdvancedToggle}
            rightIcon={<Icon as={isAdvancedOpen ? FiChevronUp : FiChevronDown} />}
          >
            Advanced
          </Button>
        </Flex>
      </CardHeader>

      <CardBody pt={0}>
        <VStack spacing={6} align="stretch">
          {/* Quick Actions */}
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="gray.600">
              Quick Actions
            </Text>
            
            <HStack spacing={3}>
              <Button
                flex={1}
                colorScheme="brand"
                leftIcon={<Icon as={FiPlay} />}
                onClick={handleQuickAnalysis}
                isLoading={isAnalyzing}
                loadingText="Analyzing"
              >
                Analyze Current Chart
              </Button>
              
              <Button
                flex={1}
                variant="outline"
                colorScheme="brand"
                leftIcon={<Icon as={FiRefreshCw} />}
                onClick={() => {
                  // Refresh and analyze
                  setTimeout(handleQuickAnalysis, 1000);
                }}
                isDisabled={isAnalyzing}
              >
                Refresh & Analyze
              </Button>
            </HStack>
          </VStack>

          <Divider />

          {/* Model Selection */}
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            isDisabled={isAnalyzing}
          />

          <Divider />

          {/* Manual Upload */}
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="gray.600">
              Manual Chart Upload
            </Text>
            
            <Box
              p={4}
              border="2px dashed"
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
              borderRadius="lg"
              textAlign="center"
              bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
            >
              <VStack spacing={3}>
                <Icon as={FiUpload} boxSize={8} color="gray.400" />
                
                {uploadedImage ? (
                  <VStack spacing={2}>
                    <Text color="green.500" fontWeight="medium">
                      Chart image uploaded successfully
                    </Text>
                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        colorScheme="brand"
                        onClick={handleAnalyzeUploaded}
                        isLoading={isAnalyzing}
                        loadingText="Analyzing"
                      >
                        Analyze Uploaded Chart
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUploadedImage(null)}
                      >
                        Clear
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <VStack spacing={2}>
                    <Text fontSize="sm" color="gray.500">
                      Upload a chart screenshot for analysis
                    </Text>
                    <Button
                      as="label"
                      htmlFor="chart-upload-controls"
                      size="sm"
                      variant="outline"
                      colorScheme="brand"
                      cursor="pointer"
                      leftIcon={<Icon as={FiUpload} />}
                    >
                      Choose File
                      <input
                        id="chart-upload-controls"
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                    </Button>
                  </VStack>
                )}
              </VStack>
            </Box>
          </VStack>

          {/* Additional Context */}
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="gray.600">
              Additional Context (Optional)
            </Text>
            
            <Textarea
              placeholder="Provide additional context for the AI analysis (e.g., recent news, market conditions, specific patterns to look for...)"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
            />
            
            <Text fontSize="xs" color="gray.500">
              This information will be included with your analysis request to provide better context to the AI.
            </Text>
          </VStack>

          {/* Advanced Settings */}
          <Collapse in={isAdvancedOpen} animateOpacity>
            <VStack spacing={4} align="stretch">
              <Divider />
              
              <Text fontSize="sm" fontWeight="medium" color="gray.600">
                Advanced Settings
              </Text>

              {/* Auto Analysis */}
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="auto-analysis" mb="0" flex={1}>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="sm">Auto Analysis</Text>
                    <Text fontSize="xs" color="gray.500">
                      Automatically analyze charts at regular intervals
                    </Text>
                  </VStack>
                </FormLabel>
                <Switch
                  id="auto-analysis"
                  isChecked={autoAnalysis}
                  onChange={(e) => setAutoAnalysis(e.target.checked)}
                  colorScheme="brand"
                />
              </FormControl>

              {/* Analysis Interval */}
              {autoAnalysis && (
                <FormControl>
                  <FormLabel fontSize="sm">Analysis Interval (minutes)</FormLabel>
                  <NumberInput
                    value={analysisInterval}
                    onChange={(_, value) => setAnalysisInterval(value || 30)}
                    min={5}
                    max={1440}
                    step={5}
                  >
                    <NumberInputField
                      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                    />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    How often to automatically capture and analyze the chart
                  </Text>
                </FormControl>
              )}

              {/* Auto Analysis Warning */}
              {autoAnalysis && (
                <Alert status="info" size="sm">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Auto analysis will consume API credits. Monitor your usage carefully.
                  </Text>
                </Alert>
              )}
            </VStack>
          </Collapse>

          {/* Status Information */}
          <Box
            p={3}
            bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
            borderRadius="md"
          >
            <VStack spacing={2} align="stretch">
              <Text fontSize="xs" fontWeight="medium" color="gray.600">
                Analysis Status
              </Text>
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">Selected Ticker:</Text>
                <Text fontSize="xs" fontWeight="semibold">{ticker}</Text>
              </HStack>
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">AI Model:</Text>
                <Text fontSize="xs" fontWeight="semibold" color="blue.500">
                  {selectedModel ? selectedModel.split('-').slice(0, 3).join(' ').toUpperCase() : 'Loading...'}
                </Text>
              </HStack>
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">Auto Analysis:</Text>
                <Text fontSize="xs" fontWeight="semibold" color={autoAnalysis ? 'green.500' : 'gray.500'}>
                  {autoAnalysis ? `Every ${analysisInterval}m` : 'Disabled'}
                </Text>
              </HStack>
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">Status:</Text>
                <Text fontSize="xs" fontWeight="semibold" color={isAnalyzing ? 'blue.500' : 'green.500'}>
                  {isAnalyzing ? 'Analyzing...' : 'Ready'}
                </Text>
              </HStack>
            </VStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default AnalysisControls;