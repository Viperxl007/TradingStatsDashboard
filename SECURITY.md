# Security Configuration Guide

This document outlines the security measures implemented in the Trading Stats Dashboard and provides guidance on proper configuration.

## 🔐 Environment Variables and API Keys

### Market Data API Configuration

The application supports two market data sources:

1. **Yahoo Finance (yfinance)** - Default, free, no API key required
2. **AlphaVantage** - Requires API key, more features

### Setting Up API Keys Securely

#### Option 1: Environment Variables (Recommended)
```bash
# Set environment variable
export MARKET_DATA_SOURCE=alphavantage
export ALPHAVANTAGE_API_KEY=your-actual-api-key-here
```

#### Option 2: Local Configuration File
1. Copy `backend/local_config.example.py` to `backend/local_config.py`
2. Edit `backend/local_config.py` with your settings:
```python
MARKET_DATA_SOURCE = 'alphavantage'
ALPHAVANTAGE_API_KEY = 'your-actual-api-key-here'
```

#### Option 3: .env File
1. Copy `.env.example` to `.env`
2. Edit `.env` with your settings:
```env
MARKET_DATA_SOURCE=alphavantage
ALPHAVANTAGE_API_KEY=your-actual-api-key-here
```

## 🛡️ Protected Files

The following files are automatically excluded from version control:

### Configuration Files
- `.env` (all variants)
- `backend/local_config.py`
- `config.local.*`

### Database Files
- `*.db`, `*.sqlite`, `*.sqlite3`
- Database journal and WAL files

### Backup and Temporary Files
- `*.bak`, `*.backup`, `*.tmp`
- Editor swap files

### Log Files
- `*.log`
- `logs/` directory

## 🗄️ Database Security

### Trade Data Storage
- **Frontend**: Uses IndexedDB (browser-local storage)
- **No server-side database**: Trade data stays on your local machine
- **No cloud sync**: Data is not transmitted to external servers

### Data Privacy
- All trading data remains local to your browser
- No sensitive trading information is uploaded to GitHub
- Database files are excluded from version control

## ⚠️ Security Best Practices

### DO:
- ✅ Use environment variables for API keys
- ✅ Keep `local_config.py` out of version control
- ✅ Regenerate API keys if accidentally exposed
- ✅ Use the free yfinance option if you don't need AlphaVantage features

### DON'T:
- ❌ Hardcode API keys in source code
- ❌ Commit `.env` or `local_config.py` files
- ❌ Share API keys in public repositories
- ❌ Use production API keys in development

## 🔧 Troubleshooting

### API Key Issues
If you see warnings about missing API keys:

1. **Check your configuration**: Ensure the API key is set correctly
2. **Verify the source**: Make sure `MARKET_DATA_SOURCE` matches your setup
3. **Fallback behavior**: The app will automatically fall back to yfinance if AlphaVantage is misconfigured

### Configuration Priority
Settings are loaded in this order (later overrides earlier):
1. Default values in `config.py`
2. Environment variables
3. `local_config.py` file

## 📞 Getting API Keys

### AlphaVantage
1. Visit: https://www.alphavantage.co/support/#api-key
2. Sign up for a free account
3. Copy your API key
4. Configure using one of the methods above

## 🚨 Security Incident Response

If you accidentally commit sensitive data:

1. **Immediately** regenerate any exposed API keys
2. Remove the sensitive data from your repository
3. Consider the exposed keys compromised
4. Update your local configuration with new keys

## 📋 Security Checklist

Before deploying or sharing your code:

- [ ] No hardcoded API keys in source files
- [ ] `.gitignore` includes all sensitive file patterns
- [ ] Environment variables are properly configured
- [ ] Local config files are excluded from version control
- [ ] API keys are regenerated if previously exposed