import React from 'react';
import {
  Tooltip,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Text,
  Box,
  List,
  ListItem,
  ListIcon,
  useDisclosure
} from '@chakra-ui/react';
import { FiInfo, FiCheckCircle, FiAlertTriangle, FiXCircle } from 'react-icons/fi';

interface LiquidityInfoTooltipProps {
  placement?: 'top' | 'right' | 'bottom' | 'left';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * LiquidityInfoTooltip Component
 * 
 * Provides detailed information about how liquidity scores are calculated
 * and what they mean for iron condor strategies.
 */
const LiquidityInfoTooltip: React.FC<LiquidityInfoTooltipProps> = ({ 
  placement = 'right',
  size = 'md'
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      placement={placement}
      closeOnBlur={true}
    >
      <PopoverTrigger>
        <IconButton
          aria-label="Liquidity information"
          icon={<FiInfo />}
          size={size}
          variant="ghost"
          colorScheme="blue"
        />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold">Understanding Liquidity Scores</PopoverHeader>
        <PopoverBody>
          <Text mb={3}>
            Liquidity scores help you identify iron condors that are easier to execute at fair prices.
          </Text>
          
          <Box mb={3}>
            <Text fontWeight="bold" mb={1}>Calculation factors:</Text>
            <List spacing={1} fontSize="sm">
              <ListItem>
                <ListIcon as={FiCheckCircle} color="green.500" />
                Bid-ask spread as a percentage of option price
              </ListItem>
              <ListItem>
                <ListIcon as={FiCheckCircle} color="green.500" />
                Trading volume for each option
              </ListItem>
              <ListItem>
                <ListIcon as={FiCheckCircle} color="green.500" />
                Open interest for each option
              </ListItem>
              <ListItem>
                <ListIcon as={FiAlertTriangle} color="red.500" />
                Zero bids are heavily penalized
              </ListItem>
            </List>
          </Box>
          
          <Box>
            <Text fontWeight="bold" mb={1}>Liquidity ratings:</Text>
            <List spacing={1} fontSize="sm">
              <ListItem>
                <ListIcon as={FiCheckCircle} color="green.500" />
                <Text as="span" fontWeight="bold">High (7-10):</Text> Tight spreads, good volume
              </ListItem>
              <ListItem>
                <ListIcon as={FiAlertTriangle} color="yellow.500" />
                <Text as="span" fontWeight="bold">Moderate (3-7):</Text> Acceptable spreads and volume
              </ListItem>
              <ListItem>
                <ListIcon as={FiXCircle} color="red.500" />
                <Text as="span" fontWeight="bold">Poor (0-3):</Text> Wide spreads, low volume, or zero bids
              </ListItem>
            </List>
          </Box>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default LiquidityInfoTooltip;