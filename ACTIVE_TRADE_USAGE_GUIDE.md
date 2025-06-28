# Active Trade Tracking System - Usage Guide

## Quick Start

The Active Trade Tracking System is now fully integrated and ready to use. Here's how to get started:

### 1. System Status ✅

- **Database**: Migrated and ready (`backend/instance/chart_analysis.db`)
- **Backend Services**: All services implemented and tested
- **Frontend Components**: ActiveTradePanel integrated into analysis display
- **API Endpoints**: All endpoints functional
- **Tests**: Comprehensive test suite passing

### 2. How It Works

#### Automatic Trade Creation
When you run a chart analysis that contains trading recommendations, the system automatically:

1. **Creates a trade record** in the `active_trades` table
2. **Sets initial status** to `waiting` (for entry trigger) or `active` (if trigger already hit)
3. **Tracks all trade details** including entry price, target, stop loss, and strategy

#### Context Awareness
The AI now has complete context awareness:

- **Waiting Trades**: AI knows there's a pending trade setup and monitors for entry conditions
- **Active Trades**: AI knows there's an open position and provides appropriate management guidance
- **Historical Context**: When no active trades exist, AI uses historical analysis context

#### Trade Lifecycle Management
The system handles the complete trade lifecycle:

1. **Waiting** → **Active** (when entry trigger is hit)
2. **Active** → **Closed** (profit target, stop loss, AI early close, or user override)
3. **Comprehensive Tracking** of P&L, max favorable/adverse prices, and exit reasons

### 3. User Interface

#### ActiveTradePanel
The `ActiveTradePanel` component is now integrated into the main analysis display and shows:

- **Current trade status** (waiting/active/none)
- **Trade details** (entry, target, stop, current P&L)
- **Manual close button** for user overrides
- **Real-time updates** as prices change

#### API Endpoints
Available endpoints for trade management:

```
GET /api/active-trades/{ticker}           # Get current active trade
POST /api/active-trades/{ticker}/close    # Manual close trade
GET /api/active-trades/{ticker}/history   # Get trade history
GET /api/active-trades/all               # Get all active trades
```

### 4. AI Integration

#### Enhanced Prompts
The AI now receives specialized context based on trade status:

**For Waiting Trades:**
```
🎯 ACTIVE TRADE MONITORING - WAITING FOR ENTRY:
- Action: BUY at $35.50
- Entry Condition: Wait for pullback to 35.50-36.00 support zone
- Status: WAITING for entry trigger

🚨 CRITICAL - ACTIVE TRADE ASSESSMENT REQUIRED:
You MUST acknowledge this WAITING trade and assess its current status...
```

**For Active Trades:**
```
🎯 ACTIVE TRADE MONITORING - TRADE IS OPEN:
- Position: BUY at $35.50
- Current Price: $36.89
- Unrealized P&L: +$1.39 (profit)
- Status: ACTIVE TRADE IN PROGRESS

🚨 CRITICAL - ACTIVE TRADE MANAGEMENT REQUIRED:
You MUST acknowledge this ACTIVE trade and provide explicit guidance...
```

#### AI Behavior
The AI is now programmed to:

- **Acknowledge active trades** in every response
- **Maintain consistency** with existing trade setups
- **Suggest early closure** only for compelling technical reasons
- **Provide clear guidance** on trade management

### 5. Testing and Validation

#### Run Tests
```bash
cd backend
python test_active_trade_system.py
```

#### Check Database
```bash
cd backend
python migrate_active_trades.py
```

### 6. Example Workflow

#### Step 1: Run Analysis
```bash
# Run chart analysis as usual
# System automatically creates trade if recommendations present
```

#### Step 2: Monitor Active Trade
- **Frontend**: ActiveTradePanel shows current status
- **AI**: Receives active trade context in subsequent analyses
- **API**: Query trade status programmatically

#### Step 3: Trade Management
- **Automatic**: System closes on profit target or stop loss
- **AI Suggested**: AI can suggest early close for technical reasons
- **Manual Override**: User can close trade manually via UI or API

#### Step 4: Trade History
- **Complete Record**: All trades stored with full details
- **Performance Tracking**: P&L, success rate, and trade statistics
- **Audit Trail**: Complete history of all trade actions

### 7. Key Benefits

#### For Users
- **Never lose track** of active trades
- **Complete transparency** of trade status
- **Manual override** capability when needed
- **Comprehensive history** of all trading activity

#### For AI
- **Complete context** awareness at all times
- **Consistent recommendations** based on active positions
- **Intelligent trade management** suggestions
- **Bias toward maintaining** existing setups unless fundamental changes

#### For System
- **Robust state management** across all chart reads
- **Automatic lifecycle handling** from entry to exit
- **Comprehensive logging** and error handling
- **Scalable architecture** for multiple concurrent trades

### 8. Configuration

#### Database Location
```
backend/instance/chart_analysis.db
```

#### Service Configuration
All services are automatically initialized when the Flask app starts. No additional configuration required.

#### Frontend Integration
The `ActiveTradePanel` is automatically included in the `EnhancedAnalysisDisplay` component.

### 9. Troubleshooting

#### Common Issues

**No Active Trade Showing**
- Check if analysis contained trading recommendations
- Verify database migration completed successfully
- Check browser console for API errors

**Trade Not Updating**
- Ensure current price is being passed to update methods
- Check backend logs for service errors
- Verify database connectivity

**AI Not Acknowledging Trade**
- Confirm trade is in `waiting` or `active` status
- Check that context service is returning active trade data
- Verify prompt builder is including trade context

#### Debug Commands
```bash
# Check database schema
cd backend && python -c "from services.active_trade_service import ActiveTradeService; service = ActiveTradeService(); print('Schema OK')"

# Test API endpoints
curl http://localhost:5000/api/active-trades/AAPL

# Check logs
tail -f backend/app.log
```

### 10. Future Enhancements

The system is designed to be extensible. Potential future features:

- **Portfolio Management**: Track multiple positions across tickers
- **Risk Management**: Position sizing and portfolio risk metrics
- **Performance Analytics**: Detailed trade statistics and performance tracking
- **Real-time Alerts**: Notifications for trade events
- **Trading Platform Integration**: Connect with actual brokers

### 11. Support

For issues or questions:

1. **Check the logs**: Backend logs provide detailed information about system operations
2. **Run tests**: The test suite validates all functionality
3. **Review documentation**: `ACTIVE_TRADE_TRACKING_SYSTEM.md` contains technical details
4. **Database integrity**: Run the migration script to verify database state

---

## Summary

The Active Trade Tracking System is now fully operational and provides comprehensive trade lifecycle management. The system ensures the AI always has proper context about active trades, preventing the confusion that occurred when trade context was lost between chart reads.

**Key Achievement**: The AI will now maintain awareness of active trades across all chart reads, providing consistent and appropriate trading guidance based on current positions.