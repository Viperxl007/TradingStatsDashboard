import React from 'react';
import {
  Box,
  Image,
  Text,
  VStack,
  HStack,
  Badge,
  useColorMode,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Button,
  Icon
} from '@chakra-ui/react';
import { FiEye, FiImage } from 'react-icons/fi';

interface ChartImageViewerProps {
  chartImage: string | null;
  ticker: string;
  timestamp?: string;
}

const ChartImageViewer: React.FC<ChartImageViewerProps> = ({
  chartImage,
  ticker,
  timestamp
}) => {
  const { colorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();

  if (!chartImage) {
    return (
      <Box
        p={4}
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        textAlign="center"
      >
        <Icon as={FiImage} boxSize={8} color="gray.400" mb={2} />
        <Text color="gray.500" fontSize="sm">
          No chart image available
        </Text>
      </Box>
    );
  }

  const imageDataUrl = `data:image/png;base64,${chartImage}`;

  return (
    <VStack spacing={3} align="stretch">
      <HStack justify="space-between" align="center">
        <VStack align="start" spacing={1}>
          <Text fontWeight="semibold" fontSize="sm">
            Chart Image Sent to AI
          </Text>
          <HStack spacing={2}>
            <Badge colorScheme="blue" variant="subtle">
              {ticker}
            </Badge>
            {timestamp && (
              <Badge colorScheme="gray" variant="subtle">
                {new Date(timestamp).toLocaleString()}
              </Badge>
            )}
          </HStack>
        </VStack>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon as={FiEye} />}
          onClick={onOpen}
        >
          View Full Size
        </Button>
      </HStack>

      {/* Thumbnail */}
      <Box
        borderRadius="lg"
        overflow="hidden"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        cursor="pointer"
        onClick={onOpen}
        _hover={{
          borderColor: colorMode === 'dark' ? 'gray.500' : 'gray.300',
          transform: 'scale(1.02)',
          transition: 'all 0.2s'
        }}
      >
        <Image
          src={imageDataUrl}
          alt={`Chart for ${ticker}`}
          maxH="200px"
          w="100%"
          objectFit="contain"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        />
      </Box>

      {/* Full Size Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Chart Image - {ticker}
            {timestamp && (
              <Text fontSize="sm" fontWeight="normal" color="gray.500" mt={1}>
                Analyzed on {new Date(timestamp).toLocaleString()}
              </Text>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Image
              src={imageDataUrl}
              alt={`Full size chart for ${ticker}`}
              w="100%"
              objectFit="contain"
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              borderRadius="md"
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default ChartImageViewer;