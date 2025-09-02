# Prompt Version Display Implementation

## Overview
This document details the implementation of prompt version tracking and display in the AI Trade Tracker UI, allowing users to see which prompt version (v1.0, v2.0, etc.) was used to generate each trading recommendation.

## Problem Statement
The user reported that the AAVEUSD trade generated with the new V2 prompt system didn't show which prompt version was used in the Trade Details modal. This made it difficult to track performance differences between prompt versions.

## Implementation Details

### 1. Backend API Updates

#### Modified Routes (`backend/app/routes.py`)

**Active Trades API (`/api/active-trades/all`)**:
- Added `ca.prompt_version` to the SQL query JOIN with chart_analyses table
- Updated response to include `prompt_version` field in each trade object

**Trade History API (`/api/active-trades/history-all`)**:
- Added `ca.prompt_version` to the SQL query JOIN with chart_analyses table  
- Updated response to include `prompt_version` field in each trade object

```sql
-- Updated query structure
SELECT at.ticker, at.timeframe, at.status, at.action, at.entry_price, at.target_price,
       at.stop_loss, at.current_price, at.unrealized_pnl, at.created_at, at.updated_at,
       at.close_time, at.close_price, at.close_reason, at.realized_pnl,
       ca.analysis_data, ca.prompt_version
FROM active_trades at
LEFT JOIN chart_analyses ca ON at.analysis_id = ca.id
```

### 2. Frontend Type Updates

#### AITradeEntry Interface (`src/types/aiTradeTracker.ts`)
- Added optional `promptVersion?: string` field to the AITradeEntry interface
- Positioned after `aiModel` field for logical grouping

```typescript
// AI Analysis Data
aiModel: string; // Claude model used for analysis
promptVersion?: string; // Prompt version used for analysis (e.g., "v2.0")
confidence: number; // 0-1 scale from AI analysis
```

#### ProductionActiveTrade Interface (`src/services/productionActiveTradesService.ts`)
- Added `prompt_version?: string` field to match backend API response
- Updated `convertProductionTradeToAITrade` function to map prompt version with fallback to "v1.0"

```typescript
// AI Analysis Data
aiModel: 'production_system',
promptVersion: productionTrade.prompt_version || 'v1.0', // Default to v1.0 if not specified
confidence: 1.0, // Production trades have 100% confidence
```

### 3. UI Display Implementation

#### AI Active Trades Panel (`src/components/aiTradeTracker/AIActiveTradesPanel.tsx`)
- Added prompt version display in the Trade Details modal
- Conditionally rendered only when `promptVersion` is available
- Positioned between AI Model and Sentiment for logical flow

```tsx
<Text fontWeight="bold" mb={2}>Trade Information</Text>
<VStack align="start" spacing={2}>
  <Text><strong>AI Model:</strong> {selectedTrade.aiModel}</Text>
  {selectedTrade.promptVersion && (
    <Text><strong>Prompt Version:</strong> {selectedTrade.promptVersion}</Text>
  )}
  <Text><strong>Sentiment:</strong> {selectedTrade.sentiment}</Text>
  <Text><strong>Confidence:</strong> {(selectedTrade.confidence * 100).toFixed(1)}%</Text>
  <Text><strong>Risk/Reward:</strong> {selectedTrade.riskReward?.toFixed(2) || 'N/A'}</Text>
</VStack>
```

## Data Flow

1. **Chart Analysis**: When a new analysis is performed, the prompt version ("v2.0") is stored in the `chart_analyses.prompt_version` column
2. **Trade Creation**: Active trades reference the analysis via `analysis_id` foreign key
3. **API Response**: Backend APIs JOIN with chart_analyses to include prompt_version in responses
4. **Frontend Mapping**: Production trade service maps prompt_version to AITradeEntry.promptVersion
5. **UI Display**: Trade Details modal conditionally displays the prompt version

## Backward Compatibility

- **Database**: Existing records without prompt_version will show NULL, handled gracefully
- **API**: New prompt_version field is optional, won't break existing clients
- **Frontend**: Conditional rendering ensures UI works with or without prompt version data
- **Default Values**: Missing prompt versions default to "v1.0" for consistency

## Benefits

1. **Performance Tracking**: Users can now compare win rates and performance between prompt versions
2. **A/B Testing**: Clear visibility into which prompt version generated each recommendation
3. **Debugging**: Easier to identify issues specific to certain prompt versions
4. **Analytics**: Historical analysis of prompt version effectiveness over time

## Testing Considerations

- **New Trades**: All new trades generated with V2 prompts will show "Prompt Version: v2.0"
- **Legacy Trades**: Existing trades will show "Prompt Version: v1.0" or no version display if NULL
- **API Compatibility**: Both active trades and history APIs include prompt version data
- **UI Responsiveness**: Conditional rendering ensures no layout issues when version is missing

## Future Enhancements

1. **Filtering**: Add prompt version filter to trade history and statistics panels
2. **Performance Comparison**: Side-by-side performance metrics by prompt version
3. **Version Badges**: Visual indicators (badges/colors) for different prompt versions
4. **Analytics Dashboard**: Dedicated section for prompt version performance analysis

## Conclusion

The prompt version display implementation provides complete visibility into which AI prompt version generated each trading recommendation. This enables data-driven optimization of the prompt system and clear performance tracking across different prompt iterations.

Users can now see "Prompt Version: v2.0" in the Trade Details modal for trades generated with the enhanced V2 prompt system, making it easy to track and compare performance between prompt versions.