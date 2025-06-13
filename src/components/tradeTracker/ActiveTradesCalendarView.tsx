import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Text,
  VStack,
  HStack,
  Badge,
  Tooltip,
  useColorModeValue,
  IconButton,
  Flex,
  Heading,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Divider,
  Tag,
  TagLabel,
  Wrap,
  WrapItem
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@chakra-ui/icons';
import { AnyTradeEntry, OptionTradeEntry, OptionLeg } from '../../types/tradeTracker';
import { parseLocalDate, formatDisplayDate, formatShortDate, isDateInPast, hasOptionExpired } from '../../utils/dateUtils';

interface CalendarEvent {
  date: string;
  type: 'expiration' | 'earnings';
  ticker: string;
  tradeId: string;
  details: string;
  isExpired: boolean;
  earningsTime?: 'BMO' | 'AMC';
  legs?: OptionLeg[];
  strategy?: string;
  profitLoss?: number;
  trade?: AnyTradeEntry;
}

interface ActiveTradesCalendarViewProps {
  trades: AnyTradeEntry[];
}

const ActiveTradesCalendarView: React.FC<ActiveTradesCalendarViewProps> = ({ trades }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);
  const [showPnL, setShowPnL] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const todayBg = useColorModeValue('blue.50', 'blue.900');
  const eventBg = useColorModeValue('gray.50', 'gray.700');
  const profitColor = useColorModeValue('green.500', 'green.300');
  const lossColor = useColorModeValue('red.500', 'red.300');
  const earningsColor = useColorModeValue('purple.500', 'purple.300');
  const expiredColor = useColorModeValue('gray.400', 'gray.500');

  // Generate calendar events from trades
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    
    trades.forEach(trade => {
      // Handle option trades with expiration dates
      if ('legs' in trade && trade.legs) {
        const optionTrade = trade as OptionTradeEntry;
        
        // Group legs by expiration date
        const expirationGroups = optionTrade.legs.reduce((groups, leg) => {
          if (!groups[leg.expiration]) {
            groups[leg.expiration] = [];
          }
          groups[leg.expiration].push(leg);
          return groups;
        }, {} as Record<string, OptionLeg[]>);

        // Create expiration events
        Object.entries(expirationGroups).forEach(([expiration, legs]) => {
          events.push({
            date: expiration,
            type: 'expiration',
            ticker: trade.ticker,
            tradeId: trade.id,
            details: `${legs.length} leg${legs.length > 1 ? 's' : ''} expiring`,
            isExpired: isDateInPast(expiration),
            legs,
            strategy: trade.strategy,
            profitLoss: trade.profitLoss,
            trade
          });
        });
      }

      // Handle earnings events from metadata
      if (trade.metadata?.earningsDate) {
        events.push({
          date: trade.metadata.earningsDate,
          type: 'earnings',
          ticker: trade.ticker,
          tradeId: trade.id,
          details: 'Earnings announcement',
          isExpired: isDateInPast(trade.metadata.earningsDate),
          earningsTime: trade.metadata.earningsTime || 'AMC',
          profitLoss: trade.profitLoss,
          trade
        });
      }
    });

    return events;
  }, [trades]);

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Create array of all days to display (including previous/next month padding)
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      events: CalendarEvent[];
    }> = [];
    
    // Add days from previous month
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({
        date,
        isCurrentMonth: false,
        events: []
      });
    }
    
    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split('T')[0];
      const dayEvents = calendarEvents.filter(event => event.date === dateString);
      
      days.push({
        date,
        isCurrentMonth: true,
        events: dayEvents
      });
    }
    
    // Add days from next month to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        events: []
      });
    }
    
    return days;
  }, [currentDate, calendarEvents]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (events: CalendarEvent[]) => {
    if (events.length > 0) {
      setSelectedEvents(events);
      onOpen();
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.isExpired) return expiredColor;
    
    if (event.type === 'earnings') {
      return earningsColor; // Purple for earnings
    }
    
    // For expiration events, color based on profit/loss
    if (event.type === 'expiration') {
      // Use the same P&L calculation as the main function
      const currentPnL = calculateCurrentPnL(event);
      
      if (currentPnL !== null) {
        return currentPnL >= 0 ? profitColor : lossColor;
      }
      
      // Default to neutral color if no P&L data
      return useColorModeValue('blue.500', 'blue.300');
    }
    
    return expiredColor;
  };

  const getEventIcon = (event: CalendarEvent) => {
    return event.type === 'expiration' ? '📅' : '📊';
  };

  const calculateCurrentPnL = (event: CalendarEvent): number | null => {
    if (event.trade && 'legs' in event.trade) {
      const optionTrade = event.trade as OptionTradeEntry;
      const currentLegPrices = optionTrade.metadata?.currentLegPrices || {};
      
      // Use the EXACT SAME logic as ActiveTradeCard.tsx calculateSpreadPnL function
      if (!optionTrade.legs || optionTrade.legs.length === 0) {
        return 0;
      }

      let totalEntryValue = 0;
      let totalCurrentValue = 0;

      optionTrade.legs.forEach((leg: OptionLeg, index: number) => {
        const legKey = `leg_${index}`; // EXACT same key format as ActiveTradeCard
        
        // Check if leg has expired and has an outcome logged using market-hours-aware logic
        const isExpired = hasOptionExpired(leg.expiration);
        const hasExpirationOutcome = leg.expirationOutcome !== undefined;
        
        let currentPrice: number;
        
        if (isExpired && hasExpirationOutcome) {
          // Use the logged expiration outcome price
          currentPrice = leg.expirationOutcome!.priceAtExpiration;
        } else {
          // Use current market price or entry price as fallback
          currentPrice = currentLegPrices[legKey] || leg.premium;
        }
        
        // Calculate leg value (premium * quantity * multiplier)
        const legMultiplier = leg.isLong ? 1 : -1;
        const entryValue = leg.premium * leg.quantity * legMultiplier * 100; // $100 per contract
        const currentValue = currentPrice * leg.quantity * legMultiplier * 100;
        
        totalEntryValue += entryValue;
        totalCurrentValue += currentValue;
      });

      return totalCurrentValue - totalEntryValue;
    }
    
    // Fallback to stored profit/loss for the entire trade
    return event.trade?.profitLoss || event.profitLoss || null;
  };

  const formatPnL = (pnl: number | null): string => {
    if (pnl === null || pnl === undefined) return '';
    return `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(0)}`;
  };

  return (
    <Box>
      {/* Calendar Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={4}>
          <Heading size="lg">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Heading>
          <Button size="sm" onClick={goToToday} leftIcon={<CalendarIcon />}>
            Today
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPnL(!showPnL)}
            colorScheme={showPnL ? 'green' : 'gray'}
            variant={showPnL ? 'solid' : 'outline'}
          >
            {showPnL ? 'Hide P&L' : 'Show P&L'}
          </Button>
        </HStack>
        
        <HStack spacing={2}>
          <IconButton
            aria-label="Previous month"
            icon={<ChevronLeftIcon />}
            onClick={() => navigateMonth('prev')}
            variant="outline"
            size="sm"
          />
          <IconButton
            aria-label="Next month"
            icon={<ChevronRightIcon />}
            onClick={() => navigateMonth('next')}
            variant="outline"
            size="sm"
          />
        </HStack>
      </Flex>

      {/* Legend */}
      <HStack spacing={4} mb={4} justify="center" flexWrap="wrap">
        <HStack spacing={2}>
          <Box w={3} h={3} bg={profitColor} borderRadius="full" />
          <Text fontSize="sm">Profitable Expiration</Text>
        </HStack>
        <HStack spacing={2}>
          <Box w={3} h={3} bg={lossColor} borderRadius="full" />
          <Text fontSize="sm">Losing Expiration</Text>
        </HStack>
        <HStack spacing={2}>
          <Box w={3} h={3} bg={earningsColor} borderRadius="full" />
          <Text fontSize="sm">Earnings Event</Text>
        </HStack>
        <HStack spacing={2}>
          <Box w={3} h={3} bg={expiredColor} borderRadius="full" />
          <Text fontSize="sm">Past Event</Text>
        </HStack>
      </HStack>

      {/* Calendar Grid */}
      <Box borderWidth="1px" borderRadius="lg" overflow="hidden" borderColor={borderColor}>
        {/* Day headers */}
        <Grid templateColumns="repeat(7, 1fr)" bg={eventBg}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Box key={day} p={3} textAlign="center" fontWeight="semibold" fontSize="sm">
              {day}
            </Box>
          ))}
        </Grid>

        {/* Calendar days */}
        <Grid templateColumns="repeat(7, 1fr)">
          {calendarData.map((day, index) => (
            <Box
              key={index}
              minH="120px"
              p={2}
              borderWidth="0 1px 1px 0"
              borderColor={borderColor}
              bg={isToday(day.date) ? todayBg : bgColor}
              opacity={day.isCurrentMonth ? 1 : 0.4}
              cursor={day.events.length > 0 ? 'pointer' : 'default'}
              onClick={() => handleDayClick(day.events)}
              _hover={day.events.length > 0 ? { bg: eventBg } : {}}
              transition="background-color 0.2s"
            >
              <Text
                fontSize="sm"
                fontWeight={isToday(day.date) ? 'bold' : 'normal'}
                mb={2}
              >
                {day.date.getDate()}
              </Text>
              
              <VStack spacing={1} align="stretch">
                {day.events.slice(0, 3).map((event, eventIndex) => {
                  const currentPnL = calculateCurrentPnL(event);
                  const pnlText = showPnL && currentPnL !== null ? ` ${formatPnL(currentPnL)}` : '';
                  
                  return (
                    <Tooltip
                      key={eventIndex}
                      label={`${event.ticker} - ${event.details}${event.earningsTime ? ` (${event.earningsTime})` : ''}${currentPnL !== null ? ` | P&L: ${formatPnL(currentPnL)}` : ''}`}
                      placement="top"
                    >
                      <Box
                        bg={getEventColor(event)}
                        color="white"
                        px={2}
                        py={1}
                        borderRadius="sm"
                        fontSize="xs"
                        fontWeight="medium"
                        textAlign="center"
                        opacity={event.isExpired ? 0.6 : 1}
                      >
                        {getEventIcon(event)} {event.ticker}{pnlText}
                      </Box>
                    </Tooltip>
                  );
                })}
                
                {day.events.length > 3 && (
                  <Text fontSize="xs" color="gray.500" textAlign="center">
                    +{day.events.length - 3} more
                  </Text>
                )}
              </VStack>
            </Box>
          ))}
        </Grid>
      </Box>

      {/* Event Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Events for {selectedEvents.length > 0 && formatDisplayDate(selectedEvents[0].date)}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              {selectedEvents.map((event, index) => (
                <Box key={index} p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                  <HStack justify="space-between" mb={2}>
                    <HStack spacing={2}>
                      <Text fontSize="lg" fontWeight="bold">{event.ticker}</Text>
                      <Badge colorScheme={event.type === 'expiration' ? 'red' : 'green'}>
                        {event.type === 'expiration' ? 'Expiration' : 'Earnings'}
                      </Badge>
                      {event.isExpired && (
                        <Badge colorScheme="gray">Past</Badge>
                      )}
                    </HStack>
                    {event.earningsTime && (
                      <Badge variant="outline">{event.earningsTime}</Badge>
                    )}
                  </HStack>
                  
                  <Text color="gray.600" mb={3}>{event.details}</Text>
                  
                  {event.strategy && (
                    <Text fontSize="sm" color="gray.500" mb={3}>
                      Strategy: {event.strategy.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  )}
                  
                  {/* Enhanced P&L Section */}
                  {event.trade && (
                    <Box mb={3} p={3} bg={eventBg} borderRadius="md">
                      <Text fontSize="sm" fontWeight="semibold" mb={2}>P&L Summary</Text>
                      
                      {(() => {
                        const totalSpreadPnL = calculateCurrentPnL(event);
                        const entryDate = event.trade.entryDate;
                        const daysHeld = Math.ceil((new Date().getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24));
                        
                        // For calendar spreads, show additional spread-specific metrics
                        const isCalendarSpread = event.trade.strategy === 'calendar_spread';
                        const calendarData = isCalendarSpread ? event.trade.metadata?.calendarSpreadData : null;
                        
                        return (
                          <VStack spacing={2} align="stretch">
                            {totalSpreadPnL !== null && (
                              <HStack justify="space-between">
                                <Text fontSize="sm" fontWeight="semibold">
                                  {isCalendarSpread ? 'Total Spread P&L:' : 'Current P&L:'}
                                </Text>
                                <Text
                                  fontSize="sm"
                                  fontWeight="bold"
                                  color={totalSpreadPnL >= 0 ? profitColor : lossColor}
                                >
                                  {totalSpreadPnL >= 0 ? '+' : ''}${totalSpreadPnL.toFixed(2)}
                                </Text>
                              </HStack>
                            )}
                            
                            {isCalendarSpread && calendarData && (
                              <>
                                <HStack justify="space-between">
                                  <Text fontSize="sm">Net Debit Paid:</Text>
                                  <Text fontSize="sm">${calendarData.totalDebit.toFixed(2)}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                  <Text fontSize="sm">Short Month Credit:</Text>
                                  <Text fontSize="sm" color={profitColor}>+${calendarData.shortMonthCredit.toFixed(2)}</Text>
                                </HStack>
                                <HStack justify="space-between">
                                  <Text fontSize="sm">Long Month Debit:</Text>
                                  <Text fontSize="sm" color={lossColor}>-${calendarData.longMonthDebit.toFixed(2)}</Text>
                                </HStack>
                                <Divider />
                              </>
                            )}
                            
                            <HStack justify="space-between">
                              <Text fontSize="sm">Entry Date:</Text>
                              <Text fontSize="sm">{formatDisplayDate(entryDate)}</Text>
                            </HStack>
                            
                            <HStack justify="space-between">
                              <Text fontSize="sm">Days Held:</Text>
                              <Text fontSize="sm">{daysHeld} days</Text>
                            </HStack>
                            
                            {totalSpreadPnL !== null && daysHeld > 0 && (
                              <HStack justify="space-between">
                                <Text fontSize="sm">Daily P&L:</Text>
                                <Text
                                  fontSize="sm"
                                  color={totalSpreadPnL >= 0 ? profitColor : lossColor}
                                >
                                  ${(totalSpreadPnL / daysHeld).toFixed(2)}/day
                                </Text>
                              </HStack>
                            )}
                            
                            {isCalendarSpread && totalSpreadPnL !== null && calendarData && (
                              <HStack justify="space-between">
                                <Text fontSize="sm">Return on Debit:</Text>
                                <Text
                                  fontSize="sm"
                                  fontWeight="semibold"
                                  color={totalSpreadPnL >= 0 ? profitColor : lossColor}
                                >
                                  {((totalSpreadPnL / calendarData.totalDebit) * 100).toFixed(1)}%
                                </Text>
                              </HStack>
                            )}
                          </VStack>
                        );
                      })()}
                    </Box>
                  )}
                  
                  {event.legs && event.legs.length > 0 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" mb={2}>Option Legs Details:</Text>
                      <VStack spacing={2} align="stretch">
                        {event.legs.map((leg, legIndex) => {
                          const daysToExpiry = Math.ceil((new Date(leg.expiration).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          const isExpired = daysToExpiry < 0;
                          
                          return (
                            <Box key={legIndex} p={2} bg={eventBg} borderRadius="sm">
                              <HStack justify="space-between" mb={1}>
                                <Tag size="sm" colorScheme={leg.isLong ? 'green' : 'red'}>
                                  <TagLabel>
                                    {leg.isLong ? 'Long' : 'Short'} {leg.quantity} {leg.optionType.toUpperCase()} ${leg.strike}
                                  </TagLabel>
                                </Tag>
                                <Text fontSize="xs" color="gray.500">
                                  {isExpired ? 'Expired' : `${daysToExpiry} days`}
                                </Text>
                              </HStack>
                              
                              <HStack justify="space-between" fontSize="xs">
                                <Text>Premium: ${leg.premium.toFixed(2)}</Text>
                                <Text>Expires: {formatShortDate(leg.expiration)}</Text>
                              </HStack>
                              
                              {leg.expirationOutcome && (
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                  Outcome: ${leg.expirationOutcome.priceAtExpiration.toFixed(2)}
                                  {leg.expirationOutcome.wasForced ? ' (Forced)' : ' (Expired)'}
                                </Text>
                              )}
                            </Box>
                          );
                        })}
                      </VStack>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ActiveTradesCalendarView;