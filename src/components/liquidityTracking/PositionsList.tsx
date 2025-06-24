import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Select,
  Flex,
  Badge,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useToast,
  Heading,
  Card,
  CardBody,
  Grid,
  GridItem,
  Icon,
  useColorMode
} from '@chakra-ui/react';
import { 
  FiFilter, 
  FiSearch, 
  FiMoreVertical, 
  FiEdit, 
  FiTrash2, 
  FiExternalLink,
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiAlertTriangle
} from 'react-icons/fi';
import PositionCard from './PositionCard';
import { CLPosition, CLFilterOptions } from '../../types/liquidityTracking';
import { liquidityTrackingService } from '../../services/liquidityTrackingService';
import { useRealTimePrices } from '../../hooks/useRealTimePrices';

interface PositionsListProps {
  positions: CLPosition[];
  filters: CLFilterOptions;
  onFiltersChange: (filters: Partial<CLFilterOptions>) => void;
  onPositionSelect: (position: CLPosition) => void;
  onPositionDelete: (positionId: string) => void;
  isLoading: boolean;
}

const PositionsList: React.FC<PositionsListProps> = ({
  positions,
  filters,
  onFiltersChange,
  onPositionSelect,
  onPositionDelete,
  isLoading
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [deletePositionId, setDeletePositionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  // Real-time price data hook
  const { fetchAllPrices, isLoading: isPriceLoading, getError: getPriceError, getData: getPriceData } = useRealTimePrices();

  // Fetch prices when positions change
  React.useEffect(() => {
    if (positions.length > 0) {
      fetchAllPrices(positions);
    }
  }, [positions, fetchAllPrices]);

  // Handle delete confirmation
  const handleDeleteClick = (positionId: string) => {
    setDeletePositionId(positionId);
    onOpen();
  };

  const handleDeleteConfirm = () => {
    if (deletePositionId) {
      onPositionDelete(deletePositionId);
      setDeletePositionId(null);
    }
    onClose();
  };

  // Filter positions based on search term
  const safePositions = Array.isArray(positions) ? positions : [];
  const searchFilteredPositions = safePositions.filter(position => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    // Handle both pair_symbol format and individual token symbols
    const pairSymbol = position.pair_symbol || '';
    const [token0, token1] = pairSymbol.split('/');
    
    return (
      pairSymbol.toLowerCase().includes(searchLower) ||
      (token0 && token0.toLowerCase().includes(searchLower)) ||
      (token1 && token1.toLowerCase().includes(searchLower)) ||
      (position.token0_symbol && position.token0_symbol.toLowerCase().includes(searchLower)) ||
      (position.token1_symbol && position.token1_symbol.toLowerCase().includes(searchLower)) ||
      position.pool_address.toLowerCase().includes(searchLower)
    );
  });

  // Get unique fee tiers for filter dropdown
  const uniqueFeeTiers = Array.from(new Set(safePositions.map(p => p.fee_tier))).sort((a, b) => a - b);

  // Get unique tokens for filter
  const uniqueTokens = Array.from(new Set([
    ...safePositions.map(p => p.token0_symbol),
    ...safePositions.map(p => p.token1_symbol)
  ])).sort();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'closed': return 'gray';
      case 'out_of_range': return 'orange';
      default: return 'gray';
    }
  };

  const getStatusIcon = (position: CLPosition) => {
    if (!position.is_in_range) return FiAlertTriangle;
    if (position.total_return > 0) return FiTrendingUp;
    if (position.total_return < 0) return FiTrendingDown;
    return FiTarget;
  };

  const getStatusIconColor = (position: CLPosition) => {
    if (!position.is_in_range) return 'orange.500';
    if (position.total_return > 0) return 'green.500';
    if (position.total_return < 0) return 'red.500';
    return 'gray.500';
  };

  return (
    <Box>
      {/* Header with Search and Filters */}
      <VStack spacing={4} align="stretch" mb={6}>
        <Flex justify="space-between" align="center">
          <Heading size="md">
            Positions ({searchFilteredPositions.length})
          </Heading>
          
          <HStack spacing={2}>
            <Button
              leftIcon={<Icon as={FiFilter} />}
              variant={showFilters ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </HStack>
        </Flex>

        {/* Search Bar */}
        <HStack spacing={3}>
          <Box position="relative" flex="1">
            <Input
              placeholder="Search positions by token or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              pl={10}
            />
            <Icon
              as={FiSearch}
              position="absolute"
              left={3}
              top="50%"
              transform="translateY(-50%)"
              color="gray.400"
            />
          </Box>
          
          <Select
            value={filters.sort_by}
            onChange={(e) => onFiltersChange({ sort_by: e.target.value as any })}
            width="200px"
          >
            <option value="created_at">Date Created</option>
            <option value="usd_value">USD Value</option>
            <option value="total_return">Total Return</option>
            <option value="fees_earned">Fees Earned</option>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange({ 
              sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc' 
            })}
          >
            {filters.sort_order === 'asc' ? '↑' : '↓'}
          </Button>
        </HStack>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardBody>
              <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
                <GridItem>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Status</Text>
                  <Select
                    value={filters.status}
                    onChange={(e) => onFiltersChange({ status: e.target.value as any })}
                  >
                    <option value="all">All Positions</option>
                    <option value="active">Active Only</option>
                    <option value="closed">Closed Only</option>
                    <option value="out_of_range">Out of Range</option>
                  </Select>
                </GridItem>

                <GridItem>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Fee Tier</Text>
                  <Select
                    value={filters.fee_tiers.length === 1 ? filters.fee_tiers[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      onFiltersChange({ 
                        fee_tiers: value ? [parseInt(value)] : [] 
                      });
                    }}
                  >
                    <option value="">All Fee Tiers</option>
                    {uniqueFeeTiers.map(tier => (
                      <option key={tier} value={tier}>
                        {(tier / 10000).toFixed(2)}%
                      </option>
                    ))}
                  </Select>
                </GridItem>

                <GridItem>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Token</Text>
                  <Select
                    value={filters.tokens.length === 1 ? filters.tokens[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      onFiltersChange({ 
                        tokens: value ? [value] : [] 
                      });
                    }}
                  >
                    <option value="">All Tokens</option>
                    {uniqueTokens.map(token => (
                      <option key={token} value={token}>
                        {token}
                      </option>
                    ))}
                  </Select>
                </GridItem>

                <GridItem>
                  <Flex justify="flex-end" align="flex-end" h="100%">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFiltersChange({
                        status: 'all',
                        fee_tiers: [],
                        tokens: [],
                        date_range: [null, null]
                      })}
                    >
                      Clear Filters
                    </Button>
                  </Flex>
                </GridItem>
              </Grid>
            </CardBody>
          </Card>
        )}
      </VStack>

      {/* Positions Grid */}
      {searchFilteredPositions.length === 0 ? (
        <Card>
          <CardBody>
            <VStack spacing={4} py={8}>
              <Text fontSize="lg" color="gray.500">
                {positions.length === 0 ? 'No positions found' : 'No positions match your filters'}
              </Text>
              <Text fontSize="sm" color="gray.400">
                {positions.length === 0 
                  ? 'Create your first liquidity position to get started'
                  : 'Try adjusting your search or filter criteria'
                }
              </Text>
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(400px, 1fr))" gap={4}>
          {searchFilteredPositions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              onClick={() => onPositionSelect(position)}
              onEdit={() => onPositionSelect(position)}
              onDelete={() => handleDeleteClick(position.id)}
              currentPriceData={getPriceData(position.id)}
              isLoadingPrice={isPriceLoading(position.id)}
              priceError={getPriceError(position.id)}
            />
          ))}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Position
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this position? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default PositionsList;