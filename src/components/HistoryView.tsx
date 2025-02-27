import * as React from 'react';
import {
  Box,
  Heading,
  Text,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  Button,
  ButtonGroup,
  Select,
  InputGroup,
  Input,
  InputLeftElement,
  Icon,
  Card,
  CardBody,
  Tooltip,
  useColorModeValue
} from '@chakra-ui/react';
import {
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiInfo
} from 'react-icons/fi';
import { useData } from '../context/DataContext';
import * as dateFns from 'date-fns';

const HistoryView: React.FC = () => {
  const { state } = useData();
  const { filteredData } = state;
  
  // Local state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState('date');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  
  // Colors
  const tableBg = useColorModeValue('white', 'gray.800');
  const tableBorderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Filter data based on search term
  const filteredTradeData = React.useMemo(() => {
    return filteredData.filter(trade =>
      trade.token.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trade.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trade.date.includes(searchTerm)
    );
  }, [filteredData, searchTerm]);
  
  // Sort data based on selected field and direction
  const sortedData = React.useMemo(() => {
    return [...filteredTradeData].sort((a, b) => {
      const aValue = a[sortField as keyof typeof a];
      const bValue = b[sortField as keyof typeof b];
      
      if (sortField === 'date') {
        const aDate = dateFns.parseISO(a.date);
        const bDate = dateFns.parseISO(b.date);
        return sortDirection === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  }, [filteredTradeData, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);
  
  // Handle sort change
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  // Handle page size change
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };
  
  return (
    <Box>
      <Heading size="lg" mb={6}>Trade History</Heading>
      
      {/* Filters */}
      <Card bg={tableBg} borderWidth="1px" borderColor={tableBorderColor} borderRadius="lg" mb={6}>
        <CardBody>
          <HStack spacing={4} mb={4}>
            <InputGroup maxW="300px">
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search trades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
            
            <Select
              maxW="200px"
              value={sortField}
              onChange={(e) => handleSort(e.target.value)}
            >
              <option value="date">Date</option>
              <option value="token">Token</option>
              <option value="type">Type</option>
              <option value="amount">Amount</option>
              <option value="price">Price</option>
              <option value="totalValue">Total Value</option>
              <option value="profitLoss">Profit/Loss</option>
            </Select>
          </HStack>
          
          <Text fontSize="sm" color="gray.500">
            Showing {paginatedData.length} of {sortedData.length} trades
          </Text>
        </CardBody>
      </Card>
      
      {/* Trade history table */}
      {sortedData.length === 0 ? (
        <Flex
          justify="center"
          align="center"
          h="400px"
          borderWidth="1px"
          borderRadius="lg"
          borderColor={tableBorderColor}
          bg={tableBg}
        >
          <Text>No trade data available</Text>
        </Flex>
      ) : (
        <Box
          borderWidth="1px"
          borderRadius="lg"
          overflow="hidden"
          borderColor={tableBorderColor}
          bg={tableBg}
        >
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('date')}
                  >
                    Date
                    {sortField === 'date' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('token')}
                  >
                    Token
                    {sortField === 'token' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('type')}
                  >
                    Type
                    {sortField === 'type' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('amount')}
                    isNumeric
                  >
                    Amount
                    {sortField === 'amount' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('price')}
                    isNumeric
                  >
                    Price
                    {sortField === 'price' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('totalValue')}
                    isNumeric
                  >
                    Total Value
                    {sortField === 'totalValue' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th
                    cursor="pointer"
                    onClick={() => handleSort('profitLoss')}
                    isNumeric
                  >
                    P/L
                    {sortField === 'profitLoss' && (
                      <Text as="span" ml={1}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </Th>
                  <Th>Details</Th>
                </Tr>
              </Thead>
              <Tbody>
                {paginatedData.map((trade) => (
                  <Tr key={trade.id}>
                    <Td>{trade.date}</Td>
                    <Td>
                      <Badge colorScheme="blue">{trade.token}</Badge>
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={trade.type === 'buy' ? 'green' : 'red'}
                      >
                        {trade.type.toUpperCase()}
                      </Badge>
                    </Td>
                    <Td isNumeric>{trade.amount.toLocaleString()}</Td>
                    <Td isNumeric>${trade.price.toLocaleString()}</Td>
                    <Td isNumeric>${trade.totalValue.toLocaleString()}</Td>
                    <Td isNumeric>
                      {trade.type === 'sell' ? (
                        <Text
                          color={trade.profitLoss >= 0 ? 'green.500' : 'red.500'}
                          fontWeight="medium"
                        >
                          ${trade.profitLoss.toLocaleString()}
                        </Text>
                      ) : (
                        <Text color="gray.500">-</Text>
                      )}
                    </Td>
                    <Td>
                      <Tooltip
                        label={`Exchange: ${trade.exchange || 'Unknown'}\nFees: $${trade.fees.toLocaleString()}\nNotes: ${trade.notes || 'None'}`}
                        hasArrow
                      >
                        <Box as="span" cursor="pointer">
                          <Icon as={FiInfo} />
                        </Box>
                      </Tooltip>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          
          {/* Pagination */}
          <Flex justify="space-between" align="center" p={4}>
            <HStack>
              <Text fontSize="sm">Rows per page:</Text>
              <Select
                size="sm"
                width="70px"
                value={pageSize}
                onChange={handlePageSizeChange}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </Select>
              <Text fontSize="sm">
                Page {currentPage} of {totalPages}
              </Text>
            </HStack>
            
            <ButtonGroup size="sm" isAttached variant="outline">
              <Button
                onClick={() => handlePageChange(1)}
                isDisabled={currentPage === 1}
              >
                <Icon as={FiChevronsLeft} />
              </Button>
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                isDisabled={currentPage === 1}
              >
                <Icon as={FiChevronLeft} />
              </Button>
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                isDisabled={currentPage === totalPages}
              >
                <Icon as={FiChevronRight} />
              </Button>
              <Button
                onClick={() => handlePageChange(totalPages)}
                isDisabled={currentPage === totalPages}
              >
                <Icon as={FiChevronsRight} />
              </Button>
            </ButtonGroup>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default HistoryView;