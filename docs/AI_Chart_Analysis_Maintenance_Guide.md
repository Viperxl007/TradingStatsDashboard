# AI Chart Analysis - Maintenance and Troubleshooting Guide

## Overview

This guide provides comprehensive information for maintaining, monitoring, and troubleshooting the AI Chart Analysis feature. It covers common issues, performance optimization, backup procedures, and monitoring recommendations.

## System Monitoring

### Health Check Endpoints

The system provides several endpoints for monitoring health and performance:

#### Primary Health Check
```bash
curl http://localhost:5000/api/chart-analysis/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "claude_api": "connected",
    "database": "connected",
    "image_processing": "available"
  }
}
```

#### Database Status Check
```bash
# Check database connectivity
sqlite3 backend/instance/chart_analysis.db ".tables"

# Check record counts
sqlite3 backend/instance/chart_analysis.db "SELECT COUNT(*) FROM chart_analyses;"
```

#### API Key Validation
```bash
# Test Claude API connectivity
curl -X POST http://localhost:5000/api/chart-analysis/analyze \
  -F "image=@test_chart.png" \
  -F "ticker=TEST"
```

### Performance Metrics

Monitor these key performance indicators:

#### Response Time Metrics
- **Chart Analysis**: Target < 5 seconds
- **History Queries**: Target < 1 second
- **Key Levels**: Target < 500ms
- **Health Checks**: Target < 100ms

#### Success Rate Metrics
- **Overall Success Rate**: Target > 95%
- **API Timeout Rate**: Target < 2%
- **Image Processing Errors**: Target < 1%
- **Database Errors**: Target < 0.1%

#### Resource Usage
- **Memory Usage**: Monitor for memory leaks
- **Disk Space**: Database and log file growth
- **CPU Usage**: Image processing load
- **Network**: Claude API bandwidth usage

### Monitoring Scripts

#### Automated Health Check Script
```bash
#!/bin/bash
# health_check.sh

HEALTH_URL="http://localhost:5000/api/chart-analysis/health"
LOG_FILE="/var/log/chart_analysis_health.log"

check_health() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$HEALTH_URL")
    local http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        echo "[$timestamp] Health check PASSED" >> "$LOG_FILE"
        return 0
    else
        echo "[$timestamp] Health check FAILED - HTTP $http_code" >> "$LOG_FILE"
        cat /tmp/health_response.json >> "$LOG_FILE"
        return 1
    fi
}

# Run health check
if ! check_health; then
    # Send alert (customize as needed)
    echo "Chart Analysis service health check failed" | mail -s "Service Alert" admin@example.com
fi
```

#### Performance Monitoring Script
```python
#!/usr/bin/env python3
# performance_monitor.py

import sqlite3
import time
import json
from datetime import datetime, timedelta

def get_performance_metrics():
    """Get performance metrics from database"""
    
    db_path = 'backend/instance/chart_analysis.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get analysis count for last 24 hours
    yesterday = datetime.now() - timedelta(days=1)
    cursor.execute("""
        SELECT COUNT(*) FROM chart_analyses 
        WHERE created_at > ?
    """, (yesterday.isoformat(),))
    
    analyses_24h = cursor.fetchone()[0]
    
    # Get average confidence score
    cursor.execute("""
        SELECT AVG(confidence_score) FROM chart_analyses 
        WHERE created_at > ? AND confidence_score IS NOT NULL
    """, (yesterday.isoformat(),))
    
    avg_confidence = cursor.fetchone()[0] or 0
    
    # Get database size
    cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
    db_size = cursor.fetchone()[0]
    
    conn.close()
    
    metrics = {
        'timestamp': datetime.now().isoformat(),
        'analyses_24h': analyses_24h,
        'avg_confidence_24h': round(avg_confidence, 3),
        'database_size_bytes': db_size,
        'database_size_mb': round(db_size / 1024 / 1024, 2)
    }
    
    return metrics

if __name__ == "__main__":
    metrics = get_performance_metrics()
    print(json.dumps(metrics, indent=2))
```

## Database Maintenance

### Regular Maintenance Tasks

#### Daily Tasks
```bash
# Check database integrity
sqlite3 backend/instance/chart_analysis.db "PRAGMA integrity_check;"

# Optimize database
sqlite3 backend/instance/chart_analysis.db "VACUUM;"

# Update statistics
sqlite3 backend/instance/chart_analysis.db "ANALYZE;"
```

#### Weekly Tasks
```bash
# Backup database
cp backend/instance/chart_analysis.db backups/chart_analysis_$(date +%Y%m%d).db

# Clean old analyses (older than 90 days)
sqlite3 backend/instance/chart_analysis.db "
DELETE FROM chart_analyses 
WHERE created_at < datetime('now', '-90 days');
"

# Clean inactive key levels
sqlite3 backend/instance/chart_analysis.db "
DELETE FROM key_levels 
WHERE is_active = 0 AND created_at < datetime('now', '-30 days');
"
```

#### Monthly Tasks
```bash
# Full database backup with compression
tar -czf backups/chart_analysis_full_$(date +%Y%m).tar.gz backend/instance/

# Archive old log files
find logs/ -name "*.log" -mtime +30 -exec gzip {} \;

# Review and clean up old backups
find backups/ -name "*.db" -mtime +90 -delete
```

### Database Schema Migrations

#### Migration Script Template
```python
#!/usr/bin/env python3
# migrate_database.py

import sqlite3
import os
from datetime import datetime

def backup_database(db_path):
    """Create backup before migration"""
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.system(f"cp {db_path} {backup_path}")
    return backup_path

def migrate_v1_to_v2(db_path):
    """Example migration from v1 to v2"""
    
    backup_path = backup_database(db_path)
    print(f"Database backed up to: {backup_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add new column
        cursor.execute("""
            ALTER TABLE chart_analyses 
            ADD COLUMN processing_time_ms INTEGER DEFAULT NULL
        """)
        
        # Create new index
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analyses_processing_time 
            ON chart_analyses(processing_time_ms)
        """)
        
        conn.commit()
        print("Migration completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        # Restore backup
        os.system(f"cp {backup_path} {db_path}")
        
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_v1_to_v2('backend/instance/chart_analysis.db')
```

### Database Optimization

#### Index Optimization
```sql
-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_analyses_ticker_timestamp 
ON chart_analyses(ticker, analysis_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_levels_ticker_active 
ON key_levels(ticker, is_active, price_level);

CREATE INDEX IF NOT EXISTS idx_context_ticker_valid 
ON analysis_context(ticker, valid_until);

-- Analyze query performance
EXPLAIN QUERY PLAN 
SELECT * FROM chart_analyses 
WHERE ticker = 'AAPL' 
ORDER BY analysis_timestamp DESC 
LIMIT 10;
```

#### Storage Optimization
```sql
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- Optimize page size
PRAGMA page_size = 4096;

-- Set cache size (64MB)
PRAGMA cache_size = -64000;

-- Enable memory temp store
PRAGMA temp_store = MEMORY;
```

## Log Management

### Log File Locations

- **Application Logs**: `backend/logs/chart_analysis.log`
- **Error Logs**: `backend/logs/error.log`
- **Access Logs**: `backend/logs/access.log`
- **Performance Logs**: `backend/logs/performance.log`

### Log Rotation Configuration

#### Using logrotate (Linux/macOS)
```bash
# /etc/logrotate.d/chart-analysis
/path/to/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload chart-analysis
    endscript
}
```

#### Manual Log Rotation Script
```bash
#!/bin/bash
# rotate_logs.sh

LOG_DIR="backend/logs"
MAX_SIZE="100M"
KEEP_DAYS=30

for log_file in "$LOG_DIR"/*.log; do
    if [ -f "$log_file" ]; then
        # Check file size
        size=$(du -m "$log_file" | cut -f1)
        
        if [ "$size" -gt 100 ]; then
            # Rotate log
            timestamp=$(date +%Y%m%d_%H%M%S)
            mv "$log_file" "${log_file}.${timestamp}"
            gzip "${log_file}.${timestamp}"
            
            # Create new log file
            touch "$log_file"
            chmod 644 "$log_file"
            
            echo "Rotated $log_file"
        fi
    fi
done

# Clean old compressed logs
find "$LOG_DIR" -name "*.log.*.gz" -mtime +$KEEP_DAYS -delete
```

### Log Analysis

#### Error Pattern Detection
```bash
# Find common errors
grep -E "(ERROR|CRITICAL)" backend/logs/chart_analysis.log | \
    awk '{print $4}' | sort | uniq -c | sort -nr

# API timeout analysis
grep "timeout" backend/logs/chart_analysis.log | \
    awk '{print $1, $2}' | sort | uniq -c

# Failed analysis patterns
grep "analysis failed" backend/logs/chart_analysis.log | \
    grep -o "ticker=[A-Z]*" | sort | uniq -c
```

#### Performance Analysis
```bash
# Response time analysis
grep "processing_time" backend/logs/performance.log | \
    awk '{print $NF}' | sort -n | \
    awk '{a[NR]=$1} END {print "Median:", a[int(NR/2)]}'

# Memory usage trends
grep "memory_usage" backend/logs/performance.log | \
    tail -100 | awk '{print $1, $2, $NF}'
```

## Troubleshooting Common Issues

### API Connection Issues

#### Problem: "Claude API key not configured"
**Symptoms:**
- 500 error on analysis requests
- Health check shows "claude_api": "disconnected"

**Diagnosis:**
```bash
# Check environment variable
echo $CLAUDE_API_KEY

# Check local config
grep CLAUDE_API_KEY backend/local_config.py

# Test API key format
python3 -c "
import os
key = os.getenv('CLAUDE_API_KEY')
if key:
    print(f'Key format: {key[:10]}...{key[-4:]}')
    print(f'Length: {len(key)}')
else:
    print('No API key found')
"
```

**Solutions:**
1. Set environment variable correctly
2. Verify API key is valid and active
3. Check API key has sufficient credits
4. Restart backend service after setting key

#### Problem: "Request timeout" errors
**Symptoms:**
- 504 timeout errors
- Long response times
- Intermittent failures

**Diagnosis:**
```bash
# Check network connectivity
curl -I https://api.anthropic.com

# Test API response time
time curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'

# Monitor network latency
ping -c 10 api.anthropic.com
```

**Solutions:**
1. Increase timeout settings in config
2. Check internet connection stability
3. Implement retry logic with exponential backoff
4. Consider using a different network or VPN

### Database Issues

#### Problem: "Database is locked"
**Symptoms:**
- SQLite database lock errors
- Write operations failing
- Application hanging on database operations

**Diagnosis:**
```bash
# Check for lock files
ls -la backend/instance/chart_analysis.db*

# Check processes using database
lsof backend/instance/chart_analysis.db

# Check database integrity
sqlite3 backend/instance/chart_analysis.db "PRAGMA integrity_check;"
```

**Solutions:**
```bash
# Stop all processes using database
pkill -f "python run.py"

# Remove lock files
rm -f backend/instance/chart_analysis.db-wal
rm -f backend/instance/chart_analysis.db-shm

# Restart application
pnpm start
```

#### Problem: Database corruption
**Symptoms:**
- Integrity check failures
- Unexpected query results
- Application crashes on database operations

**Recovery Steps:**
```bash
# 1. Stop application
pkill -f "python run.py"

# 2. Backup current database
cp backend/instance/chart_analysis.db backend/instance/chart_analysis.db.corrupt

# 3. Try to repair
sqlite3 backend/instance/chart_analysis.db ".recover" | \
sqlite3 backend/instance/chart_analysis_recovered.db

# 4. Verify recovered database
sqlite3 backend/instance/chart_analysis_recovered.db "PRAGMA integrity_check;"

# 5. Replace if recovery successful
mv backend/instance/chart_analysis_recovered.db backend/instance/chart_analysis.db

# 6. Restart application
pnpm start
```

### Image Processing Issues

#### Problem: "Image processing failed"
**Symptoms:**
- Unsupported format errors
- Image size errors
- Processing timeouts

**Diagnosis:**
```bash
# Check image properties
file uploaded_image.png
identify uploaded_image.png  # ImageMagick

# Test image processing
python3 -c "
from PIL import Image
img = Image.open('uploaded_image.png')
print(f'Format: {img.format}')
print(f'Size: {img.size}')
print(f'Mode: {img.mode}')
"
```

**Solutions:**
1. Convert image to supported format (PNG recommended)
2. Resize image if too large (max 2048x2048)
3. Compress image if file size too large (max 10MB)
4. Ensure image is not corrupted

### Performance Issues

#### Problem: Slow analysis responses
**Symptoms:**
- Response times > 10 seconds
- High CPU usage
- Memory consumption growing

**Diagnosis:**
```bash
# Monitor system resources
top -p $(pgrep -f "python run.py")

# Check memory usage
ps aux | grep "python run.py"

# Monitor disk I/O
iotop -p $(pgrep -f "python run.py")

# Check database performance
sqlite3 backend/instance/chart_analysis.db "
.timer on
SELECT COUNT(*) FROM chart_analyses;
"
```

**Optimization Steps:**
1. **Database Optimization:**
```sql
-- Vacuum database
VACUUM;

-- Analyze tables
ANALYZE;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_analyses_recent 
ON chart_analyses(created_at DESC);
```

2. **Image Optimization:**
```python
# Implement image compression
from PIL import Image

def optimize_image(image_path, max_size=(1024, 1024), quality=85):
    with Image.open(image_path) as img:
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        img.save(image_path, optimize=True, quality=quality)
```

3. **Memory Management:**
```python
# Add garbage collection
import gc

def cleanup_after_analysis():
    gc.collect()
```

## Backup and Recovery

### Automated Backup Strategy

#### Daily Backup Script
```bash
#!/bin/bash
# daily_backup.sh

BACKUP_DIR="/backups/chart_analysis"
DB_PATH="backend/instance/chart_analysis.db"
DATE=$(date +%Y%m%d)

# Create backup directory
mkdir -p "$BACKUP_DIR/daily"

# Database backup
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/daily/chart_analysis_$DATE.db'"

# Compress backup
gzip "$BACKUP_DIR/daily/chart_analysis_$DATE.db"

# Log files backup
tar -czf "$BACKUP_DIR/daily/logs_$DATE.tar.gz" backend/logs/

# Clean old daily backups (keep 7 days)
find "$BACKUP_DIR/daily" -name "*.gz" -mtime +7 -delete

echo "Daily backup completed: $DATE"
```

#### Weekly Full Backup
```bash
#!/bin/bash
# weekly_backup.sh

BACKUP_DIR="/backups/chart_analysis"
DATE=$(date +%Y%m%d)

# Create weekly backup directory
mkdir -p "$BACKUP_DIR/weekly"

# Full application backup
tar -czf "$BACKUP_DIR/weekly/full_backup_$DATE.tar.gz" \
    backend/instance/ \
    backend/logs/ \
    backend/config.py \
    backend/local_config.py

# Clean old weekly backups (keep 4 weeks)
find "$BACKUP_DIR/weekly" -name "*.tar.gz" -mtime +28 -delete

echo "Weekly backup completed: $DATE"
```

### Recovery Procedures

#### Database Recovery
```bash
# 1. Stop application
systemctl stop chart-analysis

# 2. Restore from backup
gunzip -c /backups/chart_analysis/daily/chart_analysis_20240115.db.gz > \
    backend/instance/chart_analysis.db

# 3. Verify integrity
sqlite3 backend/instance/chart_analysis.db "PRAGMA integrity_check;"

# 4. Start application
systemctl start chart-analysis
```

#### Full System Recovery
```bash
# 1. Extract full backup
tar -xzf /backups/chart_analysis/weekly/full_backup_20240115.tar.gz

# 2. Restore configuration
cp -r backend/instance/ backend/
cp -r backend/logs/ backend/

# 3. Verify configuration
python3 -c "
import sys
sys.path.append('backend')
from config import CLAUDE_API_KEY
print('Config loaded successfully')
"

# 4. Start services
pnpm start
```

## Alerting and Notifications

### Alert Configuration

#### Email Alerts Script
```python
#!/usr/bin/env python3
# alert_system.py

import smtplib
import json
import requests
from email.mime.text import MIMEText
from datetime import datetime

class AlertSystem:
    def __init__(self, smtp_server, smtp_port, username, password, recipients):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.recipients = recipients
    
    def send_alert(self, subject, message, severity="INFO"):
        """Send email alert"""
        
        msg = MIMEText(f"""
        Alert Time: {datetime.now().isoformat()}
        Severity: {severity}
        
        {message}
        
        --
        Chart Analysis Monitoring System
        """)
        
        msg['Subject'] = f"[{severity}] Chart Analysis: {subject}"
        msg['From'] = self.username
        msg['To'] = ', '.join(self.recipients)
        
        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
            print(f"Alert sent: {subject}")
        except Exception as e:
            print(f"Failed to send alert: {e}")
    
    def check_service_health(self):
        """Check service health and send alerts if needed"""
        
        try:
            response = requests.get('http://localhost:5000/api/chart-analysis/health', timeout=10)
            
            if response.status_code != 200:
                self.send_alert(
                    "Service Health Check Failed",
                    f"Health check returned status code: {response.status_code}",
                    "ERROR"
                )
                return False
            
            health_data = response.json()
            
            # Check individual services
            if health_data.get('services', {}).get('claude_api') != 'connected':
                self.send_alert(
                    "Claude API Connection Failed",
                    "Claude API is not responding properly",
                    "CRITICAL"
                )
            
            if health_data.get('services', {}).get('database') != 'connected':
                self.send_alert(
                    "Database Connection Failed",
                    "Database is not accessible",
                    "CRITICAL"
                )
            
            return True
            
        except requests.exceptions.RequestException as e:
            self.send_alert(
                "Service Unreachable",
                f"Cannot connect to chart analysis service: {e}",
                "CRITICAL"
            )
            return False

# Usage
if __name__ == "__main__":
    alert_system = AlertSystem(
        smtp_server="smtp.gmail.com",
        smtp_port=587,
        username="alerts@example.com",
        password="app_password",
        recipients=["admin@example.com", "dev@example.com"]
    )
    
    alert_system.check_service_health()
```

#### Slack Integration
```python
import requests
import json

def send_slack_alert(webhook_url, message, severity="INFO"):
    """Send alert to Slack"""
    
    color_map = {
        "INFO": "#36a64f",
        "WARNING": "#ff9500", 
        "ERROR": "#ff0000",
        "CRITICAL": "#8B0000"
    }
    
    payload = {
        "attachments": [
            {
                "color": color_map.get(severity, "#36a64f"),
                "title": f"Chart Analysis Alert - {severity}",
                "text": message,
                "ts": int(datetime.now().timestamp())
            }
        ]
    }
    
    try:
        response = requests.post(webhook_url, json=payload)
        response.raise_for_status()
        print("Slack alert sent successfully")
    except Exception as e:
        print(f"Failed to send Slack alert: {e}")
```

### Monitoring Dashboard

#### Simple Status Dashboard
```html
<!DOCTYPE html>
<html>
<head>
    <title>Chart Analysis Status</title>
    <meta http-equiv="refresh" content="30">
    <style>
        .status-ok { color: green; }
        .status-error { color: red; }
        .status-warning { color: orange; }
    </style>
</head>
<body>
    <h1>Chart Analysis Service Status</h1>
    <div id="status"></div>
    
    <script>
        async function checkStatus() {
            try {
                const response = await fetch('/api/chart-analysis/health');
                const data = await response.json();
                
                let html = '<h2>Service Status</h2>';
                html += `<p>Overall Status: <span class="status-ok">${data.status}</span></p>`;
                html += `<p>Last Check: ${new Date().toLocaleString()}</p>`;
                
                html += '<h3>Components</h3>';
                for (const [service, status] of Object.entries(data.services)) {
                    const cssClass = status === 'connected' ? 'status-ok' : 'status-error';
                    html += `<p>${service}: <span class="${cssClass}">${status}</span></p>`;
                }
                
                document.getElementById('status').innerHTML = html;
            } catch (error) {
                document.getElementById('status').innerHTML = 
                    '<p class="status-error">Service Unavailable</p>';
            }
        }
        
        checkStatus();
        setInterval(checkStatus, 30000);
    </script>
</body>
</html>
```

## Performance Optimization

### Caching Strategies

#### Redis Caching (Optional)
```python
import redis
import json
import hashlib

class AnalysisCache:
    def __init__(self, redis_host='localhost', redis_port=6379, ttl=3600):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        self.ttl = ttl
    
    def get_cache_key(self, ticker, image_hash):
        """Generate cache key for analysis"""
        return f"analysis:{ticker}:{image_hash}"
    
    def get_cached_analysis(self, ticker, image_hash):
        """Get cached analysis result"""
        key = self.get_cache_key(ticker, image_hash)
        cached = self.redis_client.get(key)
        return json.loads(cached) if cached else None
    
    def cache_analysis(self, ticker, image_hash, analysis_result):
        """Cache analysis result"""
        key = self.get_cache_key(ticker, image_hash)
        self.redis_client.setex(key, self.ttl, json.dumps(analysis_result))
```

#### Memory Caching
```python
from functools import lru_cache
import hashlib

class MemoryCache:
    def __init__(self, max_size=100):
        self.cache = {}
        self.max_size = max_size
    
    @lru_cache(maxsize=100)
    def get_key_levels(self, ticker, price_range):
        """Cached key levels lookup"""
        # Implementation here
        pass
    
    def clear_cache(self):
        """Clear all cached data"""
        self.cache.clear()
        self.get_key_levels.cache_clear()
```

### Database Optimization

#### Connection Pooling
```python
import sqlite3
from contextlib import contextmanager
import threading

class DatabasePool:
    def __init__(self, db_path, max_connections=10):
        self.db_path = db_path
        self.max_connections = max_connections
        self.connections = []
        self.lock = threading.Lock()
    
    @contextmanager
    def get_connection(self):
        """Get database connection from pool"""
        with self.lock:
            if self.connections:
                conn = self.connections.pop()
            else:
                conn = sqlite3.connect(self.db_path)
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA synchronous=NORMAL")
        
        try:
            yield conn
        finally:
            with self.lock:
                if len(self.connections) < self.max_connections:
                    self.connections.append(conn)
                else:
                    conn.close()
```

This comprehensive maintenance guide provides all the tools and procedures needed to keep the AI Chart Analysis feature running smoothly in production. Regular monitoring, proactive maintenance, and quick troubleshooting will ensure optimal performance and reliability.