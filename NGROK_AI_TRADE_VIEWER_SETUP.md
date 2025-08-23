# 🚀 AI Trade Viewer Portal - ngrok Setup

This guide shows you how to securely share your AI Trade Viewer Portal using ngrok without exposing your entire application.

## Quick Start

### Step 1: Start the AI Trade Viewer Server
```bash
node scripts/serve-ai-trade-viewer.js
```

You'll see:
```
🚀 AI Trade Viewer Portal Server Started!
📍 Local: http://localhost:3001
🔗 AI Trade Viewer: http://localhost:3001/ai-trade-viewer.html
🏥 Health Check: http://localhost:3001/health
```

### Step 2: Start ngrok
In a **separate terminal** window:
```bash
ngrok http 3001
```

You'll see output like:
```
ngrok by @inconshreveable

Session Status                online
Account                       your-account (Plan: Free)
Version                       3.0.7
Region                        United States (us)
Latency                       25ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    http://abc123.ngrok.io -> http://localhost:3001
Forwarding                    https://abc123.ngrok.io -> http://localhost:3001

Connections                   ttl     opn     rt1     rt5     p50     p95
                              0       0       0.00    0.00    0.00    0.00
```

### Step 3: Share the URL
Share this URL with others:
```
https://abc123.ngrok.io/ai-trade-viewer.html
```

## What People Will See

When others visit the ngrok URL, they'll see:

1. **Landing Page** (`/`) - Overview of the AI Trade Viewer
2. **Trade Viewer** (`/ai-trade-viewer.html`) - The actual portal with:
   - Real-time active trades
   - Trade history with search/filter
   - Performance analytics
   - All data from your local backend

## Security Features

✅ **No Internet Exposure**: Only the AI Trade Viewer is accessible
✅ **Read-Only Access**: No sensitive operations exposed
✅ **Local Data Only**: All data stays on your local network
✅ **Minimal Attack Surface**: Single-purpose server

## Prerequisites

1. **Backend API Running**: Your trading backend must be running on `localhost:5000`
2. **Node.js**: For running the server script
3. **ngrok**: Installed and authenticated

## Troubleshooting

### Backend API Not Found
```
Error: Failed to fetch trades
```
**Solution**: Make sure your backend is running on `localhost:5000`

### ngrok Connection Issues
```
ERR_NGROK_XXX
```
**Solution**: Check ngrok status and restart if needed:
```bash
ngrok http 3001
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Solution**: Change the port in the script or kill the existing process:
```bash
lsof -ti:3001 | xargs kill -9
```

## Advanced Configuration

### Custom Port
Edit `scripts/serve-ai-trade-viewer.js`:
```javascript
const PORT = process.env.PORT || 3001; // Change 3001 to your desired port
```

### Environment Variables
```bash
PORT=8080 node scripts/serve-ai-trade-viewer.js
```

### Custom ngrok Domain
```bash
ngrok http 3001 --domain=your-custom-domain.ngrok.app
```

## Monitoring

### Health Check
Visit `http://localhost:3001/health` to verify the server is running.

### ngrok Web Interface
Visit `http://127.0.0.1:4040` to monitor ngrok connections.

## Security Best Practices

1. **Use HTTPS**: ngrok provides HTTPS by default
2. **Set ngrok Password**: Protect your ngrok web interface
3. **Monitor Usage**: Check ngrok dashboard for connection logs
4. **Regular Restarts**: Restart ngrok periodically for security

## Files Created

```
src/pages/AITradeViewerPage.tsx          # Standalone React page
scripts/serve-ai-trade-viewer.js         # Dedicated server
public/ai-trade-viewer.html              # HTML version
NGROK_AI_TRADE_VIEWER_SETUP.md           # This setup guide
```

## Alternative: Direct React Integration

If you prefer to integrate into your existing app:

1. Add the page to your router:
```typescript
<Route path="/ai-trades" element={<AITradeViewerPage />} />
```

2. Run ngrok to your main app port instead of 3001

This method exposes more of your application but gives you full control over routing and authentication.

## Support

If you encounter issues:
1. Check the health endpoint: `http://localhost:3001/health`
2. Verify your backend API is responding
3. Ensure ngrok is properly authenticated
4. Check browser console for JavaScript errors

The AI Trade Viewer Portal is designed to be secure, simple, and effective for sharing your AI trading insights with others.