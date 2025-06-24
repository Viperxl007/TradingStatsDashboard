import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Input,
  Select,
  Text,
  Divider,
  Box,
  Grid,
  GridItem,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  Tooltip,
  Icon,
  Badge,
  Flex
} from '@chakra-ui/react';
import { FiInfo, FiDollarSign, FiHelpCircle } from 'react-icons/fi';
import {
  CreatePositionFormData,
  PositionFormErrors,
  CLPosition
} from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPositionCreated: (position: CLPosition) => void;
  userId: string;
}

const AddPositionModal: React.FC<AddPositionModalProps> = ({
  isOpen,
  onClose,
  onPositionCreated,
  userId
}) => {
  const toast = useToast();
  
  const [formData, setFormData] = useState<CreatePositionFormData>({
    trade_name: '',
    pool_address: '',
    token0_address: '',
    token1_address: '',
    token0_symbol: '',
    token1_symbol: '',
    fee_tier: 3000, // 0.3% default
    price_lower: 0,
    price_upper: 0,
    token0_amount: 0,
    token1_amount: 0,
    initial_usd_value: 0
  });

  const [errors, setErrors] = useState<PositionFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingPosition, setIsCreatingPosition] = useState(false);

  // Common fee tiers
  const feeTiers = [
    { value: 100, label: '0.01% (Stable pairs)' },
    { value: 500, label: '0.05% (Stable pairs)' },
    { value: 3000, label: '0.30% (Standard)' },
    { value: 10000, label: '1.00% (Exotic pairs)' }
  ];

  // Popular token addresses (you can expand this)
  const popularTokens = [
    { symbol: 'HYPE', address: '0x0d01dc56dcaaca66ad901c959b4011ec' },
    { symbol: 'USDC', address: '0xA0b86a33E6417c8C4C2F4B8C4C2F4B8C4C2F4B8C' },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' }
  ];

  const handleInputChange = (field: keyof CreatePositionFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Auto-detect LICKO/WHYPE token addresses when symbols are entered
    if (field === 'token0_symbol' || field === 'token1_symbol') {
      autoDetectTokenAddresses(field, value as string);
    }
  };

  const autoDetectTokenAddresses = (field: 'token0_symbol' | 'token1_symbol', symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Known token addresses for LICKO/HYPE (using HYPE for reliable pricing)
    const knownTokens: { [key: string]: string } = {
      'LICKO': '0xBf7F2B530c073e21EA0627F36DeEaec21A6adfec',
      'HYPE': '0x0d01dc56dcaaca66ad901c959b4011ec',
      'WHYPE': '0x0d01dc56dcaaca66ad901c959b4011ec'  // Map WHYPE to HYPE for better price data
    };

    if (knownTokens[upperSymbol]) {
      const addressField = field === 'token0_symbol' ? 'token0_address' : 'token1_address';
      setFormData(prev => ({
        ...prev,
        [addressField]: knownTokens[upperSymbol]
      }));
    }
  };

  const handleTokenSelect = (tokenIndex: 0 | 1, tokenData: { symbol: string; address: string }) => {
    if (tokenIndex === 0) {
      setFormData(prev => ({
        ...prev,
        token0_symbol: tokenData.symbol,
        token0_address: tokenData.address
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        token1_symbol: tokenData.symbol,
        token1_address: tokenData.address
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: PositionFormErrors = {};

    // Required fields
    if (!formData.trade_name.trim()) {
      newErrors.trade_name = 'Position name is required';
    }
    if (!formData.token0_symbol.trim()) {
      newErrors.token0_symbol = 'Token 0 symbol is required';
    }
    if (!formData.token1_symbol.trim()) {
      newErrors.token1_symbol = 'Token 1 symbol is required';
    }
    if (!formData.token0_address.trim()) {
      newErrors.token0_address = 'Token 0 address is required';
    }
    if (!formData.token1_address.trim()) {
      newErrors.token1_address = 'Token 1 address is required';
    }
    if (!formData.pool_address.trim()) {
      newErrors.pool_address = 'Pool address is required';
    }

    // Numeric validations - ensure proper decimal handling
    if (isNaN(formData.price_lower) || formData.price_lower <= 0) {
      newErrors.price_lower = 'Lower price must be a valid number greater than 0';
    }
    if (isNaN(formData.price_upper) || formData.price_upper <= 0) {
      newErrors.price_upper = 'Upper price must be a valid number greater than 0';
    }
    if (!isNaN(formData.price_lower) && !isNaN(formData.price_upper) && formData.price_lower >= formData.price_upper) {
      newErrors.price_upper = 'Upper price must be greater than lower price';
    }
    if (isNaN(formData.token0_amount) || formData.token0_amount <= 0) {
      newErrors.token0_amount = 'Token 0 amount must be a valid number greater than 0';
    }
    if (isNaN(formData.token1_amount) || formData.token1_amount <= 0) {
      newErrors.token1_amount = 'Token 1 amount must be a valid number greater than 0';
    }
    if (isNaN(formData.initial_usd_value) || formData.initial_usd_value <= 0) {
      newErrors.initial_usd_value = 'Initial USD value must be a valid number greater than 0';
    }

    // Address format validation (flexible for different address lengths)
    const addressRegex = /^0x[a-fA-F0-9]{32,40}$/;
    if (formData.token0_address && !addressRegex.test(formData.token0_address)) {
      newErrors.token0_address = 'Invalid address format (must start with 0x followed by 32-40 hex characters)';
    }
    if (formData.token1_address && !addressRegex.test(formData.token1_address)) {
      newErrors.token1_address = 'Invalid address format (must start with 0x followed by 32-40 hex characters)';
    }
    if (formData.pool_address && !addressRegex.test(formData.pool_address)) {
      newErrors.pool_address = 'Invalid address format (must start with 0x followed by 32-40 hex characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setIsCreatingPosition(true);

    try {
      // Transform frontend form data to backend expected format
      const backendData = {
        trade_name: formData.trade_name,
        pair_symbol: `${formData.token0_symbol}/${formData.token1_symbol}`,
        price_range_min: formData.price_lower,
        price_range_max: formData.price_upper,
        liquidity_amount: formData.token0_amount + formData.token1_amount, // Combined liquidity
        initial_investment: formData.initial_usd_value,
        entry_date: new Date().toISOString(),
        user_id: userId,
        // Include token addresses for price fetching
        token0_address: formData.token0_address,
        token1_address: formData.token1_address,
        // Optional fields for future use
        contract_address: formData.pool_address,
        protocol: "HyperSwap",
        chain: "HyperEVM",
        notes: `Token0: ${formData.token0_symbol} (${formData.token0_amount}), Token1: ${formData.token1_symbol} (${formData.token1_amount}), Fee Tier: ${formData.fee_tier}bp`
      };

      const response = await liquidityTrackingService.positions.createPosition(backendData as any);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create position');
      }

      onPositionCreated(response.data);
      handleClose();

      toast({
        title: 'Position Created',
        description: `Successfully created ${formData.token0_symbol}/${formData.token1_symbol} position. ${formData.token0_address && formData.token1_address ? 'Price data will be fetched automatically.' : 'Add token addresses later for real-time pricing.'}`,
        status: 'success',
        duration: 7000,
        isClosable: true,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create position';
      toast({
        title: 'Creation Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
      setIsCreatingPosition(false);
    }
  };

  const handleClose = () => {
    setFormData({
      trade_name: '',
      pool_address: '',
      token0_address: '',
      token1_address: '',
      token0_symbol: '',
      token1_symbol: '',
      fee_tier: 3000,
      price_lower: 0,
      price_upper: 0,
      token0_amount: 0,
      token1_amount: 0,
      initial_usd_value: 0
    });
    setErrors({});
    onClose();
  };

  // Calculate estimated values
  const estimatedValue = formData.token0_amount + formData.token1_amount;
  const priceRange = formData.price_upper - formData.price_lower;
  const priceRangePercent = formData.price_lower > 0 
    ? ((priceRange / formData.price_lower) * 100).toFixed(1)
    : '0';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent maxW="800px">
        <ModalHeader>Add New Liquidity Position</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Position Name */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>Position Details</Text>
              
              <FormControl isInvalid={!!errors.trade_name}>
                <FormLabel>Position Name</FormLabel>
                <Input
                  placeholder="e.g., ETH/USDC LP Position #1"
                  value={formData.trade_name}
                  onChange={(e) => handleInputChange('trade_name', e.target.value)}
                />
                <FormErrorMessage>{errors.trade_name}</FormErrorMessage>
                <FormHelperText>Give your position a memorable name for tracking</FormHelperText>
              </FormControl>
            </Box>

            {/* Pool Information */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>Pool Information</Text>
              
              <VStack spacing={4}>
                <FormControl isInvalid={!!errors.pool_address}>
                  <FormLabel>Pool Address</FormLabel>
                  <Input
                    placeholder="0x..."
                    value={formData.pool_address}
                    onChange={(e) => handleInputChange('pool_address', e.target.value)}
                  />
                  <FormErrorMessage>{errors.pool_address}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.fee_tier}>
                  <FormLabel>Fee Tier</FormLabel>
                  <Select
                    value={formData.fee_tier}
                    onChange={(e) => handleInputChange('fee_tier', parseInt(e.target.value))}
                  >
                    {feeTiers.map(tier => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </Select>
                  <FormErrorMessage>{errors.fee_tier}</FormErrorMessage>
                </FormControl>
              </VStack>
            </Box>

            <Divider />

            {/* Token Configuration */}
            <Box>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>Token Configuration</Text>
              
              <Grid templateColumns="1fr 1fr" gap={6}>
                {/* Token 0 */}
                <GridItem>
                  <VStack spacing={4}>
                    <Text fontWeight="medium" alignSelf="flex-start">Token 0</Text>
                    
                    <FormControl isInvalid={!!errors.token0_symbol}>
                      <FormLabel>Symbol</FormLabel>
                      <HStack>
                        <Input
                          placeholder="ETH"
                          value={formData.token0_symbol}
                          onChange={(e) => handleInputChange('token0_symbol', e.target.value)}
                        />
                        <Select
                          placeholder="Quick select"
                          onChange={(e) => {
                            const token = popularTokens.find(t => t.symbol === e.target.value);
                            if (token) handleTokenSelect(0, token);
                          }}
                          maxW="150px"
                        >
                          {popularTokens.map(token => (
                            <option key={token.symbol} value={token.symbol}>
                              {token.symbol}
                            </option>
                          ))}
                        </Select>
                      </HStack>
                      <FormErrorMessage>{errors.token0_symbol}</FormErrorMessage>
                    </FormControl>

                    <FormControl isInvalid={!!errors.token0_address}>
                      <FormLabel>Address</FormLabel>
                      <Input
                        placeholder="0x..."
                        value={formData.token0_address}
                        onChange={(e) => handleInputChange('token0_address', e.target.value)}
                      />
                      <FormErrorMessage>{errors.token0_address}</FormErrorMessage>
                    </FormControl>

                    <FormControl isInvalid={!!errors.token0_amount}>
                      <FormLabel>Amount</FormLabel>
                      <Input
                        type="number"
                        value={formData.token0_amount}
                        onChange={(e) => handleInputChange('token0_amount', parseFloat(e.target.value) || 0)}
                        min={0}
                        step="any"
                        placeholder="0.000000"
                      />
                      <FormErrorMessage>{errors.token0_amount}</FormErrorMessage>
                    </FormControl>
                  </VStack>
                </GridItem>

                {/* Token 1 */}
                <GridItem>
                  <VStack spacing={4}>
                    <Text fontWeight="medium" alignSelf="flex-start">Token 1</Text>
                    
                    <FormControl isInvalid={!!errors.token1_symbol}>
                      <FormLabel>Symbol</FormLabel>
                      <HStack>
                        <Input
                          placeholder="USDC"
                          value={formData.token1_symbol}
                          onChange={(e) => handleInputChange('token1_symbol', e.target.value)}
                        />
                        <Select
                          placeholder="Quick select"
                          onChange={(e) => {
                            const token = popularTokens.find(t => t.symbol === e.target.value);
                            if (token) handleTokenSelect(1, token);
                          }}
                          maxW="150px"
                        >
                          {popularTokens.map(token => (
                            <option key={token.symbol} value={token.symbol}>
                              {token.symbol}
                            </option>
                          ))}
                        </Select>
                      </HStack>
                      <FormErrorMessage>{errors.token1_symbol}</FormErrorMessage>
                    </FormControl>

                    <FormControl isInvalid={!!errors.token1_address}>
                      <FormLabel>Address</FormLabel>
                      <Input
                        placeholder="0x..."
                        value={formData.token1_address}
                        onChange={(e) => handleInputChange('token1_address', e.target.value)}
                      />
                      <FormErrorMessage>{errors.token1_address}</FormErrorMessage>
                    </FormControl>

                    <FormControl isInvalid={!!errors.token1_amount}>
                      <FormLabel>Amount</FormLabel>
                      <Input
                        type="number"
                        value={formData.token1_amount}
                        onChange={(e) => handleInputChange('token1_amount', parseFloat(e.target.value) || 0)}
                        min={0}
                        step="any"
                        placeholder="0.000000"
                      />
                      <FormErrorMessage>{errors.token1_amount}</FormErrorMessage>
                    </FormControl>
                  </VStack>
                </GridItem>
              </Grid>
            </Box>

            <Divider />

            {/* Price Range */}
            <Box>
              <VStack align="stretch" spacing={4}>
                {/* Header with enhanced title and help */}
                <Flex justify="space-between" align="center">
                  <VStack align="flex-start" spacing={1}>
                    <Text fontSize="lg" fontWeight="semibold">Price Range (Exchange Rate)</Text>
                    <Text fontSize="sm" color="gray.600">
                      Set the price bounds where your liquidity will be active
                    </Text>
                  </VStack>
                  <Tooltip
                    label="Your liquidity will only earn fees when the market price is within this range. Prices represent how many Token 1 you get per Token 0."
                    placement="left"
                    hasArrow
                  >
                    <Icon as={FiHelpCircle} color="gray.400" cursor="help" />
                  </Tooltip>
                </Flex>

                {/* Dynamic exchange rate explanation */}
                {formData.token0_symbol && formData.token1_symbol && (
                  <Alert status="info" variant="left-accent">
                    <AlertIcon />
                    <AlertDescription>
                      <Text fontSize="sm">
                        <strong>Exchange Rate:</strong> 1 {formData.token0_symbol} = X {formData.token1_symbol}
                        <br />
                        Enter how many {formData.token1_symbol} tokens you expect to receive per {formData.token0_symbol} token.
                      </Text>
                    </AlertDescription>
                  </Alert>
                )}

                {/* HYPE DexScreener integration notice */}
                {(formData.token0_symbol?.toLowerCase() === 'hype' || formData.token1_symbol?.toLowerCase() === 'hype') && (
                  <Alert status="success" variant="left-accent">
                    <AlertIcon />
                    <AlertDescription>
                      <Text fontSize="sm">
                        <strong>HYPE Token Detected:</strong> Real-time price data will be fetched from DexScreener using the HYPE/USDC pool.
                        <br />
                        Pool Contract: 0x13ba5fea7078ab3798fbce53b4d0721c
                      </Text>
                    </AlertDescription>
                  </Alert>
                )}

                <Grid templateColumns="1fr 1fr 1fr" gap={4}>
                  <FormControl isInvalid={!!errors.price_lower}>
                    <FormLabel>
                      <VStack align="flex-start" spacing={1}>
                        <Text>Lower Price</Text>
                        {formData.token0_symbol && formData.token1_symbol && (
                          <Text fontSize="xs" color="gray.500" fontWeight="normal">
                            ({formData.token1_symbol} per {formData.token0_symbol})
                          </Text>
                        )}
                      </VStack>
                    </FormLabel>
                    <Input
                      type="number"
                      value={formData.price_lower}
                      onChange={(e) => handleInputChange('price_lower', parseFloat(e.target.value) || 0)}
                      min={0}
                      step="any"
                      placeholder={formData.token0_symbol && formData.token1_symbol
                        ? `e.g., 0.0001 ${formData.token1_symbol}`
                        : "0.000000"
                      }
                    />
                    <FormErrorMessage>{errors.price_lower}</FormErrorMessage>
                    <FormHelperText fontSize="xs">
                      Minimum price for active liquidity
                    </FormHelperText>
                  </FormControl>

                  <FormControl isInvalid={!!errors.price_upper}>
                    <FormLabel>
                      <VStack align="flex-start" spacing={1}>
                        <Text>Upper Price</Text>
                        {formData.token0_symbol && formData.token1_symbol && (
                          <Text fontSize="xs" color="gray.500" fontWeight="normal">
                            ({formData.token1_symbol} per {formData.token0_symbol})
                          </Text>
                        )}
                      </VStack>
                    </FormLabel>
                    <Input
                      type="number"
                      value={formData.price_upper}
                      onChange={(e) => handleInputChange('price_upper', parseFloat(e.target.value) || 0)}
                      min={0}
                      step="any"
                      placeholder={formData.token0_symbol && formData.token1_symbol
                        ? `e.g., 0.0010 ${formData.token1_symbol}`
                        : "0.000000"
                      }
                    />
                    <FormErrorMessage>{errors.price_upper}</FormErrorMessage>
                    <FormHelperText fontSize="xs">
                      Maximum price for active liquidity
                    </FormHelperText>
                  </FormControl>

                  <FormControl isInvalid={!!errors.initial_usd_value}>
                    <FormLabel>
                      <VStack align="flex-start" spacing={1}>
                        <Text>Initial USD Value</Text>
                        <Text fontSize="xs" color="gray.500" fontWeight="normal">
                          (Total position value)
                        </Text>
                      </VStack>
                    </FormLabel>
                    <Input
                      type="number"
                      value={formData.initial_usd_value}
                      onChange={(e) => handleInputChange('initial_usd_value', parseFloat(e.target.value) || 0)}
                      min={0}
                      step="any"
                      placeholder="1000.00"
                    />
                    <FormErrorMessage>{errors.initial_usd_value}</FormErrorMessage>
                    <FormHelperText fontSize="xs">
                      Total USD value of your position
                    </FormHelperText>
                  </FormControl>
                </Grid>

                {/* Enhanced Range Info with Current Price Simulation */}
                {formData.price_lower > 0 && formData.price_upper > formData.price_lower && (
                  <VStack spacing={3} align="stretch">
                    <Alert status="success" variant="left-accent">
                      <AlertIcon />
                      <Box>
                        <AlertDescription>
                          <VStack align="flex-start" spacing={2}>
                            <Text fontSize="sm">
                              <strong>Price Range:</strong> {liquidityTrackingService.utils.formatCurrency(formData.price_lower, 6)} - {liquidityTrackingService.utils.formatCurrency(formData.price_upper, 6)}
                              {formData.token0_symbol && formData.token1_symbol && (
                                <> {formData.token1_symbol} per {formData.token0_symbol}</>
                              )}
                            </Text>
                            <Text fontSize="sm">
                              <strong>Range Width:</strong> {priceRangePercent}%
                              <Badge ml={2} colorScheme={parseFloat(priceRangePercent) > 50 ? "yellow" : parseFloat(priceRangePercent) > 20 ? "green" : "red"} size="sm">
                                {parseFloat(priceRangePercent) > 50 ? "Wide" : parseFloat(priceRangePercent) > 20 ? "Moderate" : "Narrow"}
                              </Badge>
                            </Text>
                          </VStack>
                        </AlertDescription>
                      </Box>
                    </Alert>

                    {/* Simulated Current Price Display */}
                    <Alert status="info" variant="subtle">
                      <AlertIcon />
                      <Box>
                        <AlertDescription>
                          <VStack align="flex-start" spacing={1}>
                            <Text fontSize="sm" fontWeight="medium">
                              💡 Liquidity Position Guide:
                            </Text>
                            <Text fontSize="xs">
                              • Your liquidity will be <strong>active</strong> when market price is between {liquidityTrackingService.utils.formatCurrency(formData.price_lower, 6)} and {liquidityTrackingService.utils.formatCurrency(formData.price_upper, 6)}
                            </Text>
                            <Text fontSize="xs">
                              • You'll earn fees only when price is <strong>within this range</strong>
                            </Text>
                            <Text fontSize="xs">
                              • When price moves <strong>outside this range</strong>, your position stops earning fees
                            </Text>
                            <Text fontSize="xs" color="blue.600">
                              • Narrower ranges = higher fee concentration but higher risk of going out of range
                            </Text>
                          </VStack>
                        </AlertDescription>
                      </Box>
                    </Alert>
                  </VStack>
                )}
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="brand"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText={isCreatingPosition ? "Creating Position..." : "Processing..."}
            disabled={isSubmitting}
          >
            Create Position
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddPositionModal;