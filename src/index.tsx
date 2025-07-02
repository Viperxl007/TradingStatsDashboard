import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize cleanup utilities for browser console access
import './utils/aiTradeCleanupIntegration';
import './utils/browserConsoleTest';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);