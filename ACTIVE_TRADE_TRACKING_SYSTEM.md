# Active Trade Tracking System

## Overview

The Active Trade Tracking System is a comprehensive solution that addresses the critical context assessment issue where the AI was losing track of active trades between chart reads. This system maintains complete trade lifecycle management from initial recommendation through final closure.

## Problem Solved

**Original Issue**: The system correctly identified when triggers were hit between reads, but once a trade became ACTIVE, subsequent reads lost the context that there was an active trade. This caused the AI to think triggers hadn't been hit when trades were actually active.

**Solution**: A complete Active Trade tracking system that maintains trade state across all chart reads and provides comprehensive context to the AI.

## Architecture

### Core Components

1. **ActiveTradeService** (`backend/services/active_trade_service.py`)
   - Manages complete trade lifecycle
   - Tracks trade status, progress, and exit conditions
   - Provides AI context for active trades

2. **Enhanced AnalysisContextService** (`backend/services/analysis_context_service.py`)
   - Integrates with ActiveTradeService
   - Provides comprehensive context (historical + active trades)
   - Maintains existing trigger detection functionality

3. **Updated PromptBuilderService** (`backend/services/prompt_builder_service.py`)
   - Builds specialized prompts for active trade scenarios
   - Provides clear AI instructions for trade management

4. **Enhanced ChartContextManager** (`backend/app/chart_context.py`)
   - Automatically creates trades from analysis recommendations
   - Integrates with active trade lifecycle

## Trade Lifecycle

### 1. Trade Creation
- **Trigger**: Analysis contains buy/sell recommendation
- **Action**: Automatically creates active trade record
- **Status**: `waiting` (for entry trigger) or `active` (if trigger already hit)

### 2. Waiting Phase
- **Status**: `waiting`
- **Monitoring**: Continuously checks for entry trigger
- **AI Context**: "WAITING FOR ENTRY" with clear instructions

### 3. Trigger Detection
- **Process**: Candlestick data analysis since last read
- **Action**: Updates trade status to `active`
- **Logging**: Records trigger time, price, and candle data

### 4. Active Phase
- **Status**: `active`
- **Monitoring**: Tracks P&L, max favorable/adverse prices
- **Exit Conditions**: Profit target, stop loss, AI early close
- **AI Context**: "ACTIVE TRADE" with management instructions

### 5. Trade Closure
Four ways to close a trade:
- **Profit Target Hit**: Automatic closure when target reached
- **Stop Loss Hit**: Automatic closure when stop hit
- **AI Early Close**: AI recommends closure for technical reasons
- **User Override**: Manual closure via API/UI

## Database Schema

### active_trades Table
```sql
CREATE TABLE active_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    analysis_id INTEGER NOT NULL,
    
    -- Trade Setup
    action TEXT NOT NULL,  -- buy/sell
    entry_price REAL NOT NULL,
    target_price REAL,
    stop_loss REAL,
    entry_strategy TEXT,
    entry_condition TEXT,
    
    -- Trade Status
    status TEXT NOT NULL DEFAULT 'waiting',
    
    -- Trigger Information
    trigger_hit_time DATETIME,
    trigger_hit_price REAL,
    trigger_hit_candle_data TEXT,
    
    -- Trade Progress
    current_price REAL,
    unrealized_pnl REAL,
    max_favorable_price REAL,
    max_adverse_price REAL,
    
    -- Close Information
    close_time DATETIME,
    close_price REAL,
    close_reason TEXT,
    close_details TEXT,
    realized_pnl REAL,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    original_analysis_data TEXT,
    original_context TEXT
);
```

### trade_updates Table
```sql
CREATE TABLE trade_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    price REAL NOT NULL,
    update_type TEXT NOT NULL,
    update_data TEXT,
    notes TEXT
);
```

## API Endpoints

### Get Active Trade
```
GET /api/active-trades/{ticker}
```
Returns current active trade for a ticker.

### Close Active Trade (User Override)
```
POST /api/active-trades/{ticker}/close
Body: {
    "current_price": 36.89,
    "notes": "Manual close due to market conditions"
}
```

### Get Trade History
```
GET /api/active-trades/{ticker}/history?limit=10
```

### Get All Active Trades
```
GET /api/active-trades/all
```

## AI Integration

### Context Types

1. **Historical Context** (existing)
   - Previous analysis recommendations
   - Trigger detection between reads

2. **Active Trade Context** (new)
   - Current trade status and details
   - Specialized AI instructions
   - Trade progress information

### AI Instructions

#### For Waiting Trades
```
🎯 ACTIVE TRADE MONITORING - WAITING FOR ENTRY:
- Action: BUY at $35.50
- Entry Condition: Wait for pullback to 35.50-36.00 support zone
- Status: WAITING for entry trigger

🚨 CRITICAL - ACTIVE TRADE ASSESSMENT REQUIRED:
You MUST acknowledge this WAITING trade and assess its current status:

A) MAINTAIN WAITING POSITION: If the entry condition is still valid
B) MODIFY ENTRY LEVELS: If market conditions have changed
C) CANCEL WAITING TRADE: If the setup is no longer valid
```

#### For Active Trades
```
🎯 ACTIVE TRADE MONITORING - TRADE IS OPEN:
- Position: BUY at $35.50
- Current Price: $36.89
- Unrealized P&L: +$1.39 (profit)
- Status: ACTIVE TRADE IN PROGRESS

🚨 CRITICAL - ACTIVE TRADE MANAGEMENT REQUIRED:
You MUST acknowledge this ACTIVE trade and provide explicit guidance:

A) MAINTAIN ACTIVE POSITION: If the trade thesis still holds
B) SUGGEST EARLY CLOSE: ONLY if there are overwhelming technical reasons
C) ADJUST STOP/TARGET: If risk management needs updating
```

## Frontend Integration

### ActiveTradePanel Component
- Displays current active trade status
- Shows P&L, entry/target/stop prices
- Provides user override functionality
- Real-time updates on trade progress

### Integration Points
- Chart analysis display
- Trading dashboard
- Position management interface

## Key Features

### 1. Comprehensive State Management
- Maintains trade state across all chart reads
- Prevents loss of active trade context
- Provides complete trade history

### 2. Intelligent AI Context
- Specialized prompts for different trade phases
- Clear instructions for trade management
- Bias toward consistency unless fundamental changes

### 3. Automatic Trade Management
- Creates trades from analysis recommendations
- Monitors entry triggers continuously
- Handles automatic exits on profit/stop targets

### 4. User Control
- Manual trade closure capability
- Override functionality for emergency situations
- Complete trade history and audit trail

### 5. Robust Error Handling
- Graceful degradation if services unavailable
- Comprehensive logging and monitoring
- Database integrity and consistency

## Usage Examples

### Creating a Trade from Analysis
```python
# Analysis contains buy recommendation
analysis_data = {
    "recommendations": {
        "action": "buy",
        "entryPrice": 35.50,
        "targetPrice": 40.00,
        "stopLoss": 32.00
    }
}

# Trade automatically created when analysis stored
analysis_id = chart_manager.store_analysis(ticker, analysis_data, timeframe="1h")
```

### Getting Comprehensive Context
```python
# Returns active trade context if available, otherwise historical
context = context_service.get_comprehensive_context(ticker, timeframe, current_price)

if context and context.get('context_type') == 'active_trade':
    print(f"Active {context['status']} trade: {context['action']} at ${context['entry_price']}")
```

### Manual Trade Closure
```python
# User override to close active trade
success = trade_service.close_trade_by_user(ticker, current_price, "Market conditions changed")
```

## Testing

Run the comprehensive test suite:
```bash
cd backend
python test_active_trade_system.py
```

Tests cover:
- Complete trade lifecycle
- Context retrieval and AI integration
- User override functionality
- API endpoint functionality
- Error handling and edge cases

## Benefits

1. **Eliminates Context Loss**: AI always knows about active trades
2. **Maintains Consistency**: Prevents erratic recommendations
3. **Provides Control**: User can override when needed
4. **Comprehensive Tracking**: Complete audit trail of all trades
5. **Intelligent Management**: Automatic handling of common scenarios
6. **Scalable Architecture**: Supports multiple concurrent trades

## Migration Notes

- Existing functionality is preserved
- New features are additive, not breaking
- Database schema is automatically created
- Backward compatibility maintained
- Gradual rollout possible

## Future Enhancements

1. **Portfolio Management**: Track multiple positions across tickers
2. **Risk Management**: Position sizing and portfolio risk metrics
3. **Performance Analytics**: Trade statistics and performance tracking
4. **Advanced Alerts**: Real-time notifications for trade events
5. **Integration**: Connect with actual trading platforms