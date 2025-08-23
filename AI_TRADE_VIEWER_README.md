# AI Trade Viewer Portal

A standalone web application that provides secure, real-time viewing access to AI-generated trade recommendations without exposing your local PC to the internet.

## Overview

The AI Trade Viewer Portal is designed to share AI chart reader trades with others in a secure way. It provides a smooth UX that matches the main application's design language while maintaining minimal network exposure.

## Security Features

- **No Internet Exposure**: The portal runs locally and only connects to your existing backend API
- **Read-Only Access**: Only displays trade data, no sensitive operations exposed
- **Local Data Only**: All data stays on your local network
- **Minimal Attack Surface**: No additional ports or services opened

## Architecture Options

### Option 1: React Component (Recommended)
Use `AITradeViewerPortal` as a component within your existing React application.

```typescript
import AITradeViewerPortal from './components/AITradeViewerPortal';

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AITradeViewerPortal />
    </ChakraProvider>
  );
}
```

### Option 2: Standalone HTML File
Deploy `public/ai-trade-viewer.html` as a standalone web page.

### Option 3: Discord Bot Integration
Use Discord webhooks or bots to automatically share trade updates:

```javascript
// Example Discord webhook integration
const sendTradeUpdate = async (trade) => {
  const webhookUrl = 'YOUR_DISCORD_WEBHOOK_URL';

  const embed = {
    title: `AI Trade Alert: ${trade.ticker}`,
    description: trade.reasoning,
    color: trade.action === 'buy' ? 0x00ff00 : 0xff0000,
    fields: [
      { name: 'Action', value: trade.action.toUpperCase(), inline: true },
      { name: 'Entry Price', value: `$${trade.entryPrice}`, inline: true },
      { name: 'Confidence', value: `${(trade.confidence * 100).toFixed(1)}%`, inline: true },
      { name: 'Target', value: `$${trade.targetPrice}`, inline: true },
      { name: 'Stop Loss', value: `$${trade.stopLoss}`, inline: true }
    ],
    timestamp: new Date(trade.entryDate).toISOString()
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] })
  });
};
```

### Option 4: Push Button Fetch
Create a simple endpoint that others can poll:

```javascript
// Simple API endpoint for trade data
app.get('/api/trades/public', async (req, res) => {
  try {
    const trades = await getAllActiveTradesForAITracker();
    // Filter sensitive data
    const publicTrades = trades.map(trade => ({
      id: trade.id,
      ticker: trade.ticker,
      action: trade.action,
      entryPrice: trade.entryPrice,
      targetPrice: trade.targetPrice,
      stopLoss: trade.stopLoss,
      status: trade.status,
      confidence: trade.confidence,
      reasoning: trade.reasoning,
      entryDate: trade.entryDate
    }));
    res.json(publicTrades);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});
```

## Features

### Active Trades Display
- Real-time view of currently active AI trades
- Color-coded trade actions (buy/sell)
- Confidence levels and AI reasoning
- Entry prices, targets, and stop losses
- Time since recommendation

### Trade History
- Complete historical trade data
- Search and filter capabilities
- Performance metrics per trade
- Win/loss tracking

### Performance Analytics
- Win rate calculations
- Total return metrics
- Performance by confidence level
- Model comparison analytics
- Risk metrics (Sharpe ratio, drawdown)

### Design Consistency
- Matches main application theme
- Dark/light mode support
- Responsive design
- Consistent UI components

## Installation & Setup

### Prerequisites
- Node.js 16+
- Running backend API (typically on localhost:5000)
- React application with Chakra UI

### Using as React Component

1. Import the component:
```typescript
import AITradeViewerPortal from './components/AITradeViewerPortal';
```

2. Add to your app:
```typescript
function App() {
  return (
    <ChakraProvider theme={theme}>
      <AITradeViewerPortal />
    </ChakraProvider>
  );
}
```

### Using Standalone HTML

1. Copy `public/ai-trade-viewer.html` to your web server
2. Ensure your backend API is running on `localhost:5000`
3. Open the HTML file in a browser

## Configuration Options

### Data Refresh Interval
The portal automatically refreshes data. To modify the refresh rate:

```typescript
// In AITradeViewerPortal component
const REFRESH_INTERVAL = 30000; // 30 seconds
```

### API Endpoint Configuration
Update the API endpoint in the services:

```typescript
// In productionActiveTradesService.ts
const API_BASE_URL = 'http://localhost:5000/api';
```

### Styling Customization
The portal uses the same theme as the main application. To customize:

```typescript
// Create custom theme
const customTheme = extendTheme({
  ...theme,
  colors: {
    brand: {
      // Custom brand colors
    }
  }
});
```

## Deployment Options

### Local Network Sharing
- Run on your local machine
- Share via local network IP address
- No internet exposure required

### Internal Company Access
- Deploy on internal server
- Use VPN for remote access
- Maintain security boundaries

### Cloud Deployment (Advanced)
- Deploy to secure cloud instance
- Use API key authentication
- Implement rate limiting

## Security Considerations

### Network Security
- Keep backend API on localhost
- Use firewall rules to limit access
- Monitor network traffic

### Data Privacy
- Only expose necessary trade data
- Remove sensitive information
- Implement data sanitization

### Access Control
- Use IP whitelisting
- Implement API key authentication
- Add rate limiting

## Troubleshooting

### Common Issues

**Backend API Connection Failed**
- Ensure backend is running on `localhost:5000`
- Check CORS settings
- Verify API endpoints are accessible

**No Trade Data Displayed**
- Check if AI trades exist in the system
- Verify API response format
- Check browser console for errors

**Styling Issues**
- Ensure Chakra UI theme is properly imported
- Check CSS conflicts
- Verify font loading

### Debug Mode
Enable debug logging:

```typescript
// Add to browser console
localStorage.setItem('AI_TRADE_VIEWER_DEBUG', 'true');
```

## File Structure

```
src/
├── components/
│   ├── AITradeViewerPortal.tsx           # Main portal component
│   └── aiTradeViewer/
│       ├── AITradeViewerActiveTrades.tsx # Active trades display
│       ├── AITradeViewerHistory.tsx      # Trade history table
│       └── AITradeViewerPerformance.tsx  # Performance analytics
├── AITradeViewerApp.tsx                  # Standalone app entry
└── services/
    └── productionActiveTradesService.ts  # Data fetching service

public/
└── ai-trade-viewer.html                  # Standalone HTML version
```

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Include error handling
4. Update documentation

## License

This component is part of the main application and follows the same license terms.