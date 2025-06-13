# AI Chart Analysis - Setup and Configuration Guide

## Overview

This guide provides comprehensive instructions for setting up and configuring the AI Chart Analysis feature in the Trading Stats Dashboard. The feature integrates with Anthropic's Claude Vision API to provide intelligent chart analysis capabilities.

## Prerequisites

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **Node.js**: Version 14 or higher
- **Python**: Version 3.8 or higher
- **pnpm**: Version 6 or higher (recommended) or npm
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: At least 2GB free space
- **Internet**: Stable broadband connection for API calls

### Required Accounts

1. **Anthropic Account**: For Claude API access
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create an account and verify email
   - Obtain API key with sufficient credits

## Installation Steps

### Step 1: Clone and Setup Project

If you haven't already set up the Trading Stats Dashboard:

```bash
# Clone the repository
git clone <repository-url>
cd trading-stats-dashboard

# Install frontend dependencies
pnpm install

# Install backend dependencies
cd backend
python -m pip install -r requirements.txt
cd ..
```

### Step 2: Backend Dependencies

The AI Chart Analysis feature requires additional Python packages. Ensure these are installed:

```bash
cd backend
pip install anthropic pillow requests sqlite3
```

**Required Python Packages:**
- `anthropic` - Claude API client
- `pillow` - Image processing
- `requests` - HTTP requests
- `sqlite3` - Database operations (usually included with Python)
- `flask` - Web framework
- `flask-cors` - Cross-origin resource sharing

### Step 3: Claude API Key Configuration

#### Option 1: Environment Variables (Recommended)

Set the Claude API key as an environment variable:

**Windows (Command Prompt):**
```cmd
set CLAUDE_API_KEY=your_claude_api_key_here
```

**Windows (PowerShell):**
```powershell
$env:CLAUDE_API_KEY="your_claude_api_key_here"
```

**macOS/Linux (Bash):**
```bash
export CLAUDE_API_KEY="your_claude_api_key_here"
```

**Permanent Setup (macOS/Linux):**
Add to your shell profile (`.bashrc`, `.zshrc`, etc.):
```bash
echo 'export CLAUDE_API_KEY="your_claude_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

#### Option 2: Local Configuration File

Create a local configuration file for development:

1. Copy the example configuration:
```bash
cd backend
cp local_config.example.py local_config.py
```

2. Edit `local_config.py` and add your API key:
```python
# Claude API Configuration
CLAUDE_API_KEY = "your_claude_api_key_here"

# Optional: Additional configuration
CLAUDE_MODEL = "claude-3-sonnet-20240229"  # Default model
CLAUDE_MAX_TOKENS = 4000  # Maximum tokens per request
CLAUDE_TIMEOUT = 30  # Request timeout in seconds
```

#### Option 3: Docker Environment

If using Docker, add the environment variable to your `docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    environment:
      - CLAUDE_API_KEY=your_claude_api_key_here
    ports:
      - "5000:5000"
```

### Step 4: Database Setup

The feature automatically creates required SQLite tables on first run. To manually initialize:

```bash
cd backend
python -c "
from app.chart_context import ChartContextManager
manager = ChartContextManager()
print('Database initialized successfully')
"
```

### Step 5: Verify Installation

Test the backend setup:

```bash
cd backend
python run.py
```

The server should start without errors and display:
```
* Running on http://localhost:5000
* Chart Analysis feature: ENABLED
* Claude API: CONFIGURED
```

## Configuration Options

### Backend Configuration

Edit `backend/config.py` to customize settings:

```python
# Chart Analysis Configuration
CHART_ANALYSIS_ENABLED = True
CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')
CLAUDE_MODEL = 'claude-3-sonnet-20240229'
CLAUDE_MAX_TOKENS = 4000
CLAUDE_TIMEOUT = 30

# Image Processing Settings
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_DIMENSIONS = (2048, 2048)
MIN_IMAGE_DIMENSIONS = (200, 200)
SUPPORTED_IMAGE_FORMATS = ['PNG', 'JPEG', 'WEBP']

# Database Settings
DATABASE_PATH = 'instance/chart_analysis.db'
ANALYSIS_RETENTION_DAYS = 90
CLEANUP_INTERVAL_HOURS = 24

# Rate Limiting
ANALYSIS_RATE_LIMIT = 100  # Per hour
API_RETRY_ATTEMPTS = 3
API_RETRY_DELAY = 1  # Seconds
```

### Frontend Configuration

Update `src/services/chartAnalysisService.ts` if needed:

```typescript
// API Configuration
const API_BASE_URL = 'http://localhost:5000/api/chart-analysis';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Image Upload Settings
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp'];
```

## Advanced Configuration

### Custom Claude Model

To use a different Claude model, update the configuration:

```python
# In backend/config.py or local_config.py
CLAUDE_MODEL = 'claude-3-opus-20240229'  # For higher accuracy
# or
CLAUDE_MODEL = 'claude-3-haiku-20240307'  # For faster responses
```

### Database Optimization

For better performance with large datasets:

```python
# In backend/config.py
DATABASE_SETTINGS = {
    'journal_mode': 'WAL',
    'synchronous': 'NORMAL',
    'cache_size': -64000,  # 64MB cache
    'temp_store': 'MEMORY'
}
```

### Logging Configuration

Configure detailed logging for troubleshooting:

```python
# In backend/config.py
LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'detailed': {
            'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        }
    },
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'logs/chart_analysis.log',
            'formatter': 'detailed',
            'level': 'INFO'
        }
    },
    'loggers': {
        'chart_analysis': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': False
        }
    }
}
```

## Security Configuration

### API Key Security

1. **Never commit API keys to version control**
2. **Use environment variables in production**
3. **Rotate keys regularly**
4. **Monitor API usage and costs**

### Network Security

Configure CORS settings in `backend/config.py`:

```python
# CORS Configuration
CORS_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://yourdomain.com'
]

# Security Headers
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
}
```

### Input Validation

Ensure proper input validation:

```python
# Image Validation Settings
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILENAME_LENGTH = 255
SCAN_UPLOADED_FILES = True  # Enable virus scanning if available
```

## Production Deployment

### Environment Setup

For production deployment:

1. **Use a production WSGI server**:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

2. **Set production environment variables**:
```bash
export FLASK_ENV=production
export CLAUDE_API_KEY="your_production_api_key"
export DATABASE_URL="postgresql://user:pass@localhost/dbname"
```

3. **Configure reverse proxy** (nginx example):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### Database Migration

For production databases:

```python
# Migration script
from app.chart_context import ChartContextManager

def migrate_database():
    manager = ChartContextManager()
    # Add any migration logic here
    print("Database migration completed")

if __name__ == "__main__":
    migrate_database()
```

### Monitoring Setup

Configure monitoring and alerting:

```python
# Health check endpoint
@app.route('/health')
def health_check():
    try:
        # Test database connection
        manager = ChartContextManager()
        manager.get_analysis_history('TEST', limit=1)
        
        # Test Claude API
        if not os.getenv('CLAUDE_API_KEY'):
            return {'status': 'error', 'message': 'API key not configured'}, 500
            
        return {'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}, 500
```

## Troubleshooting Setup Issues

### Common Installation Problems

#### Python Dependencies

**Problem**: `ModuleNotFoundError: No module named 'anthropic'`
**Solution**:
```bash
cd backend
pip install --upgrade pip
pip install anthropic
```

**Problem**: `ImportError: cannot import name 'Anthropic'`
**Solution**:
```bash
pip uninstall anthropic
pip install anthropic>=0.3.0
```

#### API Key Issues

**Problem**: "Claude API key not configured"
**Solution**:
1. Verify the environment variable is set: `echo $CLAUDE_API_KEY`
2. Check the API key format (should start with `sk-ant-`)
3. Ensure the key has sufficient credits
4. Test the key with a simple API call

#### Database Issues

**Problem**: "Permission denied" when creating database
**Solution**:
```bash
# Create instance directory with proper permissions
mkdir -p backend/instance
chmod 755 backend/instance
```

**Problem**: "Database is locked"
**Solution**:
```bash
# Stop all backend processes and remove lock
pkill -f "python run.py"
rm -f backend/instance/chart_analysis.db-wal
rm -f backend/instance/chart_analysis.db-shm
```

### Network and Connectivity

#### Port Conflicts

**Problem**: "Address already in use"
**Solution**:
```bash
# Find and kill process using port 5000
lsof -ti:5000 | xargs kill -9
# Or use a different port
export FLASK_PORT=5001
```

#### CORS Issues

**Problem**: "CORS policy" errors in browser
**Solution**:
1. Check CORS configuration in `backend/config.py`
2. Ensure frontend URL is in allowed origins
3. Restart backend server after changes

### Performance Issues

#### Slow API Responses

**Problem**: Analysis requests timeout
**Solution**:
1. Increase timeout settings
2. Optimize image size before upload
3. Check internet connection stability
4. Monitor Claude API status

#### Memory Usage

**Problem**: High memory consumption
**Solution**:
1. Implement image compression
2. Add cleanup routines for old data
3. Optimize database queries
4. Monitor memory usage with tools like `htop`

## Maintenance

### Regular Tasks

1. **Monitor API Usage**: Track Claude API costs and usage
2. **Database Cleanup**: Remove old analyses (automated)
3. **Log Rotation**: Manage log file sizes
4. **Security Updates**: Keep dependencies updated
5. **Backup Data**: Regular database backups

### Update Procedures

To update the AI Chart Analysis feature:

```bash
# Backup current data
cp backend/instance/chart_analysis.db backup/

# Update code
git pull origin main

# Update dependencies
cd backend
pip install -r requirements.txt --upgrade

# Run migrations if needed
python migrate.py

# Restart services
pnpm start
```

## Support and Resources

### Documentation Links

- [Anthropic Claude API Documentation](https://docs.anthropic.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [React Documentation](https://reactjs.org/docs/)

### Getting Help

1. **Check Logs**: Review application logs for error details
2. **Test Components**: Isolate issues to specific components
3. **Community Support**: Check project issues and discussions
4. **Professional Support**: Contact development team for enterprise support

### Useful Commands

```bash
# Check backend status
curl http://localhost:5000/health

# Test API endpoint
curl -X POST http://localhost:5000/api/chart-analysis/analyze \
  -F "image=@test_chart.png" \
  -F "ticker=AAPL"

# View logs
tail -f backend/logs/chart_analysis.log

# Database inspection
sqlite3 backend/instance/chart_analysis.db ".tables"
```

This setup guide should help you successfully configure and deploy the AI Chart Analysis feature. For additional support or advanced configuration needs, refer to the technical documentation or contact the development team.