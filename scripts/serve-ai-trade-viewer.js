#!/usr/bin/env node

/**
 * Standalone AI Trade Viewer Server
 *
 * This script serves only the AI Trade Viewer page independently
 * so you can use ngrok to share just this page without exposing
 * your entire application.
 *
 * Usage:
 *   node scripts/serve-ai-trade-viewer.js
 *
 * Then in another terminal:
 *   ngrok http 3001
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve the AI Trade Viewer page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Trade Viewer Portal</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
            }
            .container {
                text-align: center;
                max-width: 600px;
            }
            .title {
                font-size: 2.5rem;
                font-weight: bold;
                margin-bottom: 1rem;
            }
            .subtitle {
                font-size: 1.2rem;
                opacity: 0.9;
                margin-bottom: 2rem;
            }
            .button {
                background: white;
                color: #667eea;
                border: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-size: 1.1rem;
                font-weight: bold;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin: 10px;
                transition: transform 0.2s;
            }
            .button:hover {
                transform: scale(1.05);
            }
            .features {
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: left;
            }
            .features h3 {
                margin-top: 0;
            }
            .features ul {
                list-style: none;
                padding: 0;
            }
            .features li {
                padding: 5px 0;
                padding-left: 20px;
                position: relative;
            }
            .features li:before {
                content: "✅";
                position: absolute;
                left: 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="title">🤖 AI Trade Viewer Portal</h1>
            <p class="subtitle">Secure, real-time view of AI-generated trade recommendations</p>

            <div class="features">
                <h3>Features:</h3>
                <ul>
                    <li>Real-time active trade monitoring</li>
                    <li>Complete trade history with analytics</li>
                    <li>Performance metrics and win rates</li>
                    <li>Secure local access only</li>
                    <li>No internet exposure required</li>
                </ul>
            </div>

            <a href="/ai-trade-viewer-ngrok.html" class="button">🚀 Open AI Trade Viewer</a>
        </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Trade Viewer Portal',
    timestamp: new Date().toISOString()
  });
});

// API proxy to your backend - REQUIRED for ngrok access
app.get('/api/active-trades/all', async (req, res) => {
  try {
    // Proxy to your local backend
    const response = await fetch('http://localhost:5000/api/active-trades/all');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Backend API error:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.get('/api/active-trades/history-all', async (req, res) => {
  try {
    // Proxy to your local backend
    const response = await fetch('http://localhost:5000/api/active-trades/history-all');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Backend API error:', error);
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

// Macro Sentiment API proxy - REQUIRED for ngrok access
app.get('/api/macro-sentiment/status', async (req, res) => {
  try {
    // Proxy to your local backend
    const response = await fetch('http://localhost:5000/api/macro-sentiment/status');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Macro Sentiment API error:', error);
    res.status(500).json({ error: 'Failed to fetch macro sentiment data' });
  }
});

app.listen(PORT, () => {
  console.log('🚀 AI Trade Viewer Portal Server Started!');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🔗 AI Trade Viewer: http://localhost:${PORT}/ai-trade-viewer.html`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log('\n📋 Next Steps:');
  console.log('1. In another terminal, run: ngrok http 3002');
  console.log('2. Share the ngrok URL with others');
  console.log('3. Make sure your backend API is running on localhost:5000');
  console.log('\n⚠️  Security: Only shares the AI Trade Viewer, not your full app');
});