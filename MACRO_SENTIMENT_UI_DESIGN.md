# Macro Sentiment UI/UX Design Specification

## Overview

This document details the user interface design for the macro market sentiment system that will be integrated into the existing Chart Analysis tab. The design emphasizes clarity, modern aesthetics, and actionable information while maintaining consistency with the existing Chakra UI design system.

## Design Principles

### 1. Clarity Over Complexity
- Clear visual hierarchy with confidence as the primary metric
- Minimal cognitive load with intuitive color coding
- Essential information prominently displayed

### 2. Actionable Intelligence
- Immediate understanding of trade permission status
- Clear directional indicators for BTC and ALT trends
- Historical context for confidence trends

### 3. Modern Aesthetics
- Clean, professional design language
- Smooth animations and micro-interactions
- Responsive design for all screen sizes

### 4. Consistency
- Follows existing Chakra UI patterns
- Matches current color schemes and typography
- Integrates seamlessly with Chart Analysis tab

## Integration Point

**Location**: Top section of Chart Analysis tab (`src/components/ChartAnalysis.tsx`)
**Placement**: Prominent position above ticker input, visible before any chart analysis
**Behavior**: Always visible when on Chart Analysis tab, updates automatically every 4 hours

## Component Architecture

### Main Container: MacroSentimentPanel

```tsx
<Box 
  mb={6} 
  p={6} 
  bg={colorMode === 'dark' ? 'gray.700' : 'white'} 
  borderRadius="xl" 
  shadow="lg"
  border="1px solid"
  borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
>
  <VStack spacing={4} align="stretch">
    <MacroSentimentHeader />
    <MacroSentimentContent />
    <MacroSentimentFooter />
  </VStack>
</Box>
```

## Component Specifications

### 1. MacroSentimentHeader

**Purpose**: Title and status indicator
**Layout**: Horizontal with title left, status right

```tsx
<Flex justify="space-between" align="center">
  <HStack spacing={3}>
    <Icon as={FiTrendingUp} size="20px" color="brand.500" />
    <Heading size="md" fontWeight="600">
      Market Macro Sentiment
    </Heading>
    <Badge 
      colorScheme={getStatusColorScheme(systemStatus)} 
      variant="subtle"
      fontSize="xs"
    >
      {systemStatus}
    </Badge>
  </HStack>
  
  <HStack spacing={2}>
    <Text fontSize="sm" color="gray.500">
      Last Updated: {formatTimeAgo(lastUpdated)}
    </Text>
    <Tooltip label="Next update in 3h 24m">
      <Icon as={FiClock} color="gray.400" />
    </Tooltip>
  </HStack>
</Flex>
```

### 2. MacroSentimentContent

**Purpose**: Main sentiment data display
**Layout**: Horizontal grid with 4 key sections

```tsx
<SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
  <ConfidenceGauge />
  <TrendIndicator type="BTC" />
  <TrendIndicator type="ALT" />
  <TradePermissionCard />
</SimpleGrid>
```

#### 2.1 ConfidenceGauge Component

**Purpose**: Primary confidence visualization (0-100)
**Design**: Circular progress indicator with dynamic colors

```tsx
<VStack spacing={3} align="center">
  <Text fontSize="sm" fontWeight="500" color="gray.600">
    Overall Confidence
  </Text>
  
  <Box position="relative">
    <CircularProgress 
      value={confidence} 
      size="80px" 
      thickness="8px"
      color={getConfidenceColor(confidence)}
      trackColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
    >
      <CircularProgressLabel>
        <VStack spacing={0}>
          <Text fontSize="xl" fontWeight="bold">
            {confidence}
          </Text>
          <Text fontSize="xs" color="gray.500">
            /100
          </Text>
        </VStack>
      </CircularProgressLabel>
    </CircularProgress>
    
    {/* Confidence level indicator */}
    <Badge 
      position="absolute" 
      bottom="-8px" 
      left="50%" 
      transform="translateX(-50%)"
      colorScheme={getConfidenceColorScheme(confidence)}
      fontSize="xs"
    >
      {getConfidenceLabel(confidence)}
    </Badge>
  </Box>
</VStack>
```

**Color Mapping**:
- 0-25: Red (Very Low)
- 26-50: Orange (Low)
- 51-75: Yellow (Moderate)
- 76-100: Green (High)

#### 2.2 TrendIndicator Component

**Purpose**: BTC and ALT trend visualization
**Design**: Directional arrow with strength meter

```tsx
<VStack spacing={3} align="center">
  <Text fontSize="sm" fontWeight="500" color="gray.600">
    {type} Trend
  </Text>
  
  <HStack spacing={2} align="center">
    <Icon 
      as={getTrendIcon(direction)} 
      size="24px" 
      color={getTrendColor(direction, strength)}
    />
    <VStack spacing={1} align="start">
      <Text fontSize="lg" fontWeight="bold">
        {direction}
      </Text>
      <Progress 
        value={strength} 
        size="sm" 
        width="60px"
        colorScheme={getTrendColorScheme(direction)}
      />
    </VStack>
  </HStack>
  
  <Text fontSize="xs" color="gray.500">
    Strength: {strength}%
  </Text>
</VStack>
```

**Icons**:
- UP: FiTrendingUp (green)
- DOWN: FiTrendingDown (red)
- SIDEWAYS: FiMinus (gray)

#### 2.3 TradePermissionCard Component

**Purpose**: Clear trading recommendation
**Design**: Traffic light system with action text

```tsx
<VStack spacing={3} align="center">
  <Text fontSize="sm" fontWeight="500" color="gray.600">
    Trade Permission
  </Text>
  
  <VStack spacing={2} align="center">
    <Box 
      w="60px" 
      h="60px" 
      borderRadius="full" 
      bg={getPermissionColor(permission)}
      display="flex"
      alignItems="center"
      justifyContent="center"
      shadow="md"
    >
      <Icon 
        as={getPermissionIcon(permission)} 
        size="24px" 
        color="white"
      />
    </Box>
    
    <VStack spacing={1} align="center">
      <Text fontSize="md" fontWeight="bold">
        {getPermissionLabel(permission)}
      </Text>
      <Text fontSize="xs" color="gray.500" textAlign="center">
        {getPermissionDescription(permission)}
      </Text>
    </VStack>
  </VStack>
</VStack>
```

**Permission Mapping**:
- NO_TRADE: Red circle with FiX icon - "Preserve Capital"
- SELECTIVE: Orange circle with FiAlertTriangle icon - "Selective Trading"
- ACTIVE: Green circle with FiPlay icon - "Active Trading"
- AGGRESSIVE: Bright green circle with FiZap icon - "Aggressive Trading"

### 3. MacroSentimentFooter

**Purpose**: Additional context and actions
**Layout**: Horizontal with market regime left, mini chart center, actions right

```tsx
<Flex justify="space-between" align="center" pt={4} borderTop="1px solid" borderColor="gray.200">
  <HStack spacing={3}>
    <Text fontSize="sm" color="gray.600">Market Regime:</Text>
    <Badge colorScheme={getRegimeColorScheme(marketRegime)} variant="outline">
      {formatRegimeLabel(marketRegime)}
    </Badge>
  </HStack>
  
  <Box flex={1} mx={6}>
    <MiniConfidenceChart data={historicalConfidence} />
  </Box>
  
  <HStack spacing={2}>
    <Tooltip label="View detailed analysis">
      <IconButton
        aria-label="View details"
        icon={<FiInfo />}
        size="sm"
        variant="ghost"
        onClick={onViewDetails}
      />
    </Tooltip>
    <Tooltip label="Refresh data">
      <IconButton
        aria-label="Refresh"
        icon={<FiRefreshCw />}
        size="sm"
        variant="ghost"
        onClick={onRefresh}
        isLoading={isRefreshing}
      />
    </Tooltip>
  </HStack>
</Flex>
```

#### 3.1 MiniConfidenceChart Component

**Purpose**: Historical confidence trend visualization
**Design**: Small line chart showing last 7 days

```tsx
<Box height="40px" width="200px">
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <Line 
        type="monotone" 
        dataKey="confidence" 
        stroke={colorMode === 'dark' ? '#4FD1C7' : '#319795'}
        strokeWidth={2}
        dot={false}
      />
      <XAxis hide />
      <YAxis hide domain={[0, 100]} />
    </LineChart>
  </ResponsiveContainer>
</Box>
```

## Responsive Design

### Mobile (< 768px)
- Single column layout
- Stacked components
- Larger touch targets
- Simplified mini chart

### Tablet (768px - 1024px)
- Two column grid
- Maintained component spacing
- Responsive text sizes

### Desktop (> 1024px)
- Four column grid
- Full feature set
- Optimal spacing and sizing

## Animation and Interactions

### Loading States
```tsx
// Skeleton loading for initial load
<SkeletonCircle size="80px" />
<SkeletonText noOfLines={2} spacing="4" />

// Shimmer effect for data updates
<Box className="shimmer-effect">
  {/* Content */}
</Box>
```

### Micro-interactions
- Hover effects on interactive elements
- Smooth transitions for data updates
- Pulse animation for real-time updates
- Tooltip delays and animations

### Data Update Animations
```tsx
// Confidence gauge animation
<CircularProgress 
  value={confidence}
  transition="all 0.5s ease-in-out"
/>

// Number counter animation
<AnimatedNumber 
  value={confidence}
  duration={800}
  formatValue={(value) => Math.round(value)}
/>
```

## Error States

### No Data Available
```tsx
<VStack spacing={4} py={8}>
  <Icon as={FiAlertTriangle} size="48px" color="orange.400" />
  <VStack spacing={2}>
    <Text fontSize="lg" fontWeight="500">
      Macro Data Unavailable
    </Text>
    <Text fontSize="sm" color="gray.500" textAlign="center">
      The macro sentiment system is currently initializing or experiencing issues.
    </Text>
  </VStack>
  <Button size="sm" onClick={onRetry}>
    Retry
  </Button>
</VStack>
```

### System Error
```tsx
<Alert status="error" borderRadius="md">
  <AlertIcon />
  <Box>
    <AlertTitle>Macro Analysis Error</AlertTitle>
    <AlertDescription>
      Unable to load macro sentiment data. The system will retry automatically.
    </AlertDescription>
  </Box>
</Alert>
```

### Stale Data Warning
```tsx
<Alert status="warning" borderRadius="md" size="sm">
  <AlertIcon />
  <AlertDescription>
    Data is {formatTimeAgo(lastUpdated)} old. Next update expected in {timeToNextUpdate}.
  </AlertDescription>
</Alert>
```

## Accessibility

### ARIA Labels
- Proper labeling for screen readers
- Role definitions for interactive elements
- Live regions for dynamic updates

### Keyboard Navigation
- Tab order optimization
- Keyboard shortcuts for actions
- Focus management

### Color Accessibility
- WCAG AA compliant color contrasts
- Color-blind friendly palette
- Alternative indicators beyond color

## Performance Considerations

### Optimization Strategies
- Memoized components for expensive renders
- Lazy loading for chart components
- Efficient re-render patterns
- Debounced API calls

### Bundle Size
- Tree-shaking for unused chart libraries
- Dynamic imports for heavy components
- Optimized image assets

## Integration Code Example

```tsx
// Integration into ChartAnalysis.tsx
const ChartAnalysis: React.FC = () => {
  const [macroSentiment, setMacroSentiment] = useState<MacroSentimentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMacroSentiment = async () => {
      try {
        setIsLoading(true);
        const data = await getMacroSentiment();
        setMacroSentiment(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load macro sentiment');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMacroSentiment();
    
    // Set up polling for updates
    const interval = setInterval(fetchMacroSentiment, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <Box w="100%" h="100%">
      <VStack spacing={4} align="stretch">
        {/* Macro Sentiment Panel */}
        <MacroSentimentPanel 
          data={macroSentiment}
          isLoading={isLoading}
          error={error}
          onRefresh={() => fetchMacroSentiment()}
        />
        
        {/* Existing Chart Analysis Content */}
        <Box>
          {/* ... existing content ... */}
        </Box>
      </VStack>
    </Box>
  );
};
```

This UI design provides a sophisticated yet intuitive interface for macro market sentiment analysis, ensuring traders can quickly assess market conditions and make informed decisions about when to engage with the detailed chart analysis features.