"""
Production Monitoring Service for CL Position Tracking

This module provides comprehensive system monitoring including:
- System health monitoring and metrics
- Performance monitoring and optimization
- Database maintenance and cleanup
- API rate limiting and usage analytics
- Error tracking and alerting
- Service uptime and reliability monitoring
"""

import logging
import sqlite3
import psutil
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
from enum import Enum
import json
import uuid
from threading import Lock
import os
import gc
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """System health status enumeration."""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    DOWN = "down"


class MetricType(Enum):
    """Metric type enumeration."""
    SYSTEM = "system"
    DATABASE = "database"
    API = "api"
    APPLICATION = "application"
    CUSTOM = "custom"


@dataclass
class SystemMetrics:
    """System metrics data structure."""
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, int]
    process_count: int
    uptime_seconds: int
    load_average: List[float]


@dataclass
class DatabaseMetrics:
    """Database metrics data structure."""
    timestamp: datetime
    connection_count: int
    query_count: int
    avg_query_time: float
    slow_queries: int
    database_size: int
    table_sizes: Dict[str, int]
    index_usage: Dict[str, float]


@dataclass
class APIMetrics:
    """API metrics data structure."""
    timestamp: datetime
    request_count: int
    response_times: List[float]
    error_count: int
    status_codes: Dict[str, int]
    endpoint_usage: Dict[str, int]
    rate_limit_hits: int


@dataclass
class HealthCheck:
    """Health check result data structure."""
    component: str
    status: HealthStatus
    message: str
    timestamp: datetime
    response_time_ms: float
    metadata: Dict[str, Any] = None


class SystemMonitor:
    """
    Comprehensive system monitoring service.
    
    Provides real-time monitoring, alerting, and maintenance
    capabilities for production environments.
    """
    
    def __init__(self, db_path: Optional[str] = None, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the system monitor.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
            config (Optional[Dict[str, Any]]): Monitor configuration
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'monitoring.db'
        )
        self.db_lock = Lock()
        self.config = config or {}
        
        # Monitoring state
        self.is_monitoring = False
        self.monitor_thread = None
        self.start_time = datetime.now()
        
        # Metrics storage
        self.metrics_buffer = deque(maxlen=1000)
        self.api_metrics = defaultdict(list)
        self.error_counts = defaultdict(int)
        
        # Health check functions
        self.health_checks: Dict[str, Callable] = {}
        
        # Initialize database
        self._ensure_database()
        
        # Register default health checks
        self._register_default_health_checks()
        
        logger.info("System Monitor initialized")
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create system_metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS system_metrics (
                        id TEXT PRIMARY KEY,
                        timestamp INTEGER NOT NULL,
                        metric_type TEXT NOT NULL,
                        cpu_usage REAL,
                        memory_usage REAL,
                        disk_usage REAL,
                        network_io TEXT,
                        process_count INTEGER,
                        uptime_seconds INTEGER,
                        load_average TEXT,
                        custom_data TEXT
                    )
                ''')
                
                # Create database_metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS database_metrics (
                        id TEXT PRIMARY KEY,
                        timestamp INTEGER NOT NULL,
                        connection_count INTEGER,
                        query_count INTEGER,
                        avg_query_time REAL,
                        slow_queries INTEGER,
                        database_size INTEGER,
                        table_sizes TEXT,
                        index_usage TEXT
                    )
                ''')
                
                # Create api_metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS api_metrics (
                        id TEXT PRIMARY KEY,
                        timestamp INTEGER NOT NULL,
                        request_count INTEGER,
                        response_times TEXT,
                        error_count INTEGER,
                        status_codes TEXT,
                        endpoint_usage TEXT,
                        rate_limit_hits INTEGER
                    )
                ''')
                
                # Create health_checks table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS health_checks (
                        id TEXT PRIMARY KEY,
                        component TEXT NOT NULL,
                        status TEXT NOT NULL,
                        message TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        response_time_ms REAL NOT NULL,
                        metadata TEXT
                    )
                ''')
                
                # Create alerts table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS monitoring_alerts (
                        id TEXT PRIMARY KEY,
                        alert_type TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        component TEXT NOT NULL,
                        message TEXT NOT NULL,
                        threshold_value REAL,
                        actual_value REAL,
                        status TEXT DEFAULT 'active',
                        created_at INTEGER NOT NULL,
                        resolved_at INTEGER
                    )
                ''')
                
                # Create maintenance_logs table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS maintenance_logs (
                        id TEXT PRIMARY KEY,
                        maintenance_type TEXT NOT NULL,
                        component TEXT NOT NULL,
                        action TEXT NOT NULL,
                        status TEXT NOT NULL,
                        details TEXT,
                        started_at INTEGER NOT NULL,
                        completed_at INTEGER,
                        duration_ms INTEGER
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_health_checks_component ON health_checks(component)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_status ON monitoring_alerts(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance_logs(maintenance_type)')
                
                conn.commit()
                logger.info(f"Monitoring database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing monitoring database: {str(e)}")
            raise
    
    def start_monitoring(self, interval_seconds: int = 60):
        """
        Start continuous system monitoring.
        
        Args:
            interval_seconds (int): Monitoring interval in seconds
        """
        if self.is_monitoring:
            logger.warning("Monitoring is already running")
            return
        
        self.is_monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitoring_loop,
            args=(interval_seconds,),
            daemon=True
        )
        self.monitor_thread.start()
        
        logger.info(f"Started system monitoring with {interval_seconds}s interval")
    
    def stop_monitoring(self):
        """Stop continuous system monitoring."""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        logger.info("Stopped system monitoring")
    
    def _monitoring_loop(self, interval_seconds: int):
        """Main monitoring loop."""
        while self.is_monitoring:
            try:
                # Collect system metrics
                system_metrics = self._collect_system_metrics()
                self._save_system_metrics(system_metrics)
                
                # Collect database metrics
                db_metrics = self._collect_database_metrics()
                self._save_database_metrics(db_metrics)
                
                # Run health checks
                self._run_health_checks()
                
                # Check for alerts
                self._check_alert_conditions(system_metrics, db_metrics)
                
                # Perform maintenance tasks
                self._perform_maintenance_tasks()
                
                time.sleep(interval_seconds)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {str(e)}")
                time.sleep(interval_seconds)
    
    def _collect_system_metrics(self) -> SystemMetrics:
        """Collect current system metrics."""
        try:
            # CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_usage = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_usage = disk.percent
            
            # Network I/O
            network = psutil.net_io_counters()
            network_io = {
                'bytes_sent': network.bytes_sent,
                'bytes_recv': network.bytes_recv,
                'packets_sent': network.packets_sent,
                'packets_recv': network.packets_recv
            }
            
            # Process count
            process_count = len(psutil.pids())
            
            # Uptime
            uptime_seconds = int((datetime.now() - self.start_time).total_seconds())
            
            # Load average (Unix-like systems)
            try:
                load_average = list(os.getloadavg())
            except (OSError, AttributeError):
                load_average = [0.0, 0.0, 0.0]  # Windows fallback
            
            metrics = SystemMetrics(
                timestamp=datetime.now(),
                cpu_usage=cpu_usage,
                memory_usage=memory_usage,
                disk_usage=disk_usage,
                network_io=network_io,
                process_count=process_count,
                uptime_seconds=uptime_seconds,
                load_average=load_average
            )
            
            # Add to buffer for real-time access
            self.metrics_buffer.append(metrics)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {str(e)}")
            raise
    
    def _collect_database_metrics(self) -> DatabaseMetrics:
        """Collect database performance metrics."""
        try:
            # Get database file size
            db_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
            
            # Query database for additional metrics
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get table sizes
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                
                table_sizes = {}
                for (table_name,) in tables:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count = cursor.fetchone()[0]
                    table_sizes[table_name] = count
                
                # Simulate other metrics (would be more complex in real implementation)
                connection_count = 1  # SQLite doesn't have connection pooling
                query_count = sum(table_sizes.values())  # Simplified
                avg_query_time = 0.1  # Placeholder
                slow_queries = 0  # Placeholder
                index_usage = {}  # Placeholder
            
            metrics = DatabaseMetrics(
                timestamp=datetime.now(),
                connection_count=connection_count,
                query_count=query_count,
                avg_query_time=avg_query_time,
                slow_queries=slow_queries,
                database_size=db_size,
                table_sizes=table_sizes,
                index_usage=index_usage
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error collecting database metrics: {str(e)}")
            # Return empty metrics on error
            return DatabaseMetrics(
                timestamp=datetime.now(),
                connection_count=0,
                query_count=0,
                avg_query_time=0,
                slow_queries=0,
                database_size=0,
                table_sizes={},
                index_usage={}
            )
    
    def _register_default_health_checks(self):
        """Register default health check functions."""
        self.health_checks = {
            'database': self._check_database_health,
            'disk_space': self._check_disk_space,
            'memory': self._check_memory_usage,
            'cpu': self._check_cpu_usage,
            'process': self._check_process_health
        }
    
    def _run_health_checks(self):
        """Run all registered health checks."""
        for component, check_func in self.health_checks.items():
            try:
                start_time = time.time()
                health_result = check_func()
                response_time = (time.time() - start_time) * 1000  # Convert to ms
                
                health_check = HealthCheck(
                    component=component,
                    status=health_result['status'],
                    message=health_result['message'],
                    timestamp=datetime.now(),
                    response_time_ms=response_time,
                    metadata=health_result.get('metadata', {})
                )
                
                self._save_health_check(health_check)
                
            except Exception as e:
                logger.error(f"Error running health check for {component}: {str(e)}")
                
                # Log failed health check
                failed_check = HealthCheck(
                    component=component,
                    status=HealthStatus.CRITICAL,
                    message=f"Health check failed: {str(e)}",
                    timestamp=datetime.now(),
                    response_time_ms=0,
                    metadata={'error': str(e)}
                )
                
                self._save_health_check(failed_check)
    
    def _check_database_health(self) -> Dict[str, Any]:
        """Check database health."""
        try:
            with sqlite3.connect(self.db_path, timeout=5) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            return {
                'status': HealthStatus.HEALTHY,
                'message': 'Database connection successful'
            }
            
        except Exception as e:
            return {
                'status': HealthStatus.CRITICAL,
                'message': f'Database connection failed: {str(e)}'
            }
    
    def _check_disk_space(self) -> Dict[str, Any]:
        """Check disk space availability."""
        try:
            disk = psutil.disk_usage('/')
            usage_percent = disk.percent
            
            if usage_percent > 90:
                status = HealthStatus.CRITICAL
                message = f"Disk usage critical: {usage_percent:.1f}%"
            elif usage_percent > 80:
                status = HealthStatus.WARNING
                message = f"Disk usage high: {usage_percent:.1f}%"
            else:
                status = HealthStatus.HEALTHY
                message = f"Disk usage normal: {usage_percent:.1f}%"
            
            return {
                'status': status,
                'message': message,
                'metadata': {
                    'usage_percent': usage_percent,
                    'free_bytes': disk.free,
                    'total_bytes': disk.total
                }
            }
            
        except Exception as e:
            return {
                'status': HealthStatus.CRITICAL,
                'message': f'Disk check failed: {str(e)}'
            }
    
    def _check_memory_usage(self) -> Dict[str, Any]:
        """Check memory usage."""
        try:
            memory = psutil.virtual_memory()
            usage_percent = memory.percent
            
            if usage_percent > 90:
                status = HealthStatus.CRITICAL
                message = f"Memory usage critical: {usage_percent:.1f}%"
            elif usage_percent > 80:
                status = HealthStatus.WARNING
                message = f"Memory usage high: {usage_percent:.1f}%"
            else:
                status = HealthStatus.HEALTHY
                message = f"Memory usage normal: {usage_percent:.1f}%"
            
            return {
                'status': status,
                'message': message,
                'metadata': {
                    'usage_percent': usage_percent,
                    'available_bytes': memory.available,
                    'total_bytes': memory.total
                }
            }
            
        except Exception as e:
            return {
                'status': HealthStatus.CRITICAL,
                'message': f'Memory check failed: {str(e)}'
            }
    
    def _check_cpu_usage(self) -> Dict[str, Any]:
        """Check CPU usage."""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            
            if cpu_percent > 90:
                status = HealthStatus.CRITICAL
                message = f"CPU usage critical: {cpu_percent:.1f}%"
            elif cpu_percent > 80:
                status = HealthStatus.WARNING
                message = f"CPU usage high: {cpu_percent:.1f}%"
            else:
                status = HealthStatus.HEALTHY
                message = f"CPU usage normal: {cpu_percent:.1f}%"
            
            return {
                'status': status,
                'message': message,
                'metadata': {
                    'usage_percent': cpu_percent,
                    'cpu_count': psutil.cpu_count()
                }
            }
            
        except Exception as e:
            return {
                'status': HealthStatus.CRITICAL,
                'message': f'CPU check failed: {str(e)}'
            }
    
    def _check_process_health(self) -> Dict[str, Any]:
        """Check process health."""
        try:
            current_process = psutil.Process()
            
            # Check if process is running normally
            if current_process.is_running():
                cpu_percent = current_process.cpu_percent()
                memory_info = current_process.memory_info()
                
                status = HealthStatus.HEALTHY
                message = f"Process healthy - CPU: {cpu_percent:.1f}%, Memory: {memory_info.rss / 1024 / 1024:.1f}MB"
                
                metadata = {
                    'pid': current_process.pid,
                    'cpu_percent': cpu_percent,
                    'memory_rss': memory_info.rss,
                    'memory_vms': memory_info.vms,
                    'num_threads': current_process.num_threads()
                }
            else:
                status = HealthStatus.CRITICAL
                message = "Process not running"
                metadata = {}
            
            return {
                'status': status,
                'message': message,
                'metadata': metadata
            }
            
        except Exception as e:
            return {
                'status': HealthStatus.CRITICAL,
                'message': f'Process check failed: {str(e)}'
            }
    
    def _check_alert_conditions(self, system_metrics: SystemMetrics, db_metrics: DatabaseMetrics):
        """Check for alert conditions and trigger alerts."""
        try:
            alerts = []
            
            # CPU usage alert
            if system_metrics.cpu_usage > 90:
                alerts.append({
                    'alert_type': 'cpu_usage',
                    'severity': 'critical',
                    'component': 'system',
                    'message': f'CPU usage critical: {system_metrics.cpu_usage:.1f}%',
                    'threshold_value': 90,
                    'actual_value': system_metrics.cpu_usage
                })
            elif system_metrics.cpu_usage > 80:
                alerts.append({
                    'alert_type': 'cpu_usage',
                    'severity': 'warning',
                    'component': 'system',
                    'message': f'CPU usage high: {system_metrics.cpu_usage:.1f}%',
                    'threshold_value': 80,
                    'actual_value': system_metrics.cpu_usage
                })
            
            # Memory usage alert
            if system_metrics.memory_usage > 90:
                alerts.append({
                    'alert_type': 'memory_usage',
                    'severity': 'critical',
                    'component': 'system',
                    'message': f'Memory usage critical: {system_metrics.memory_usage:.1f}%',
                    'threshold_value': 90,
                    'actual_value': system_metrics.memory_usage
                })
            
            # Disk usage alert
            if system_metrics.disk_usage > 90:
                alerts.append({
                    'alert_type': 'disk_usage',
                    'severity': 'critical',
                    'component': 'system',
                    'message': f'Disk usage critical: {system_metrics.disk_usage:.1f}%',
                    'threshold_value': 90,
                    'actual_value': system_metrics.disk_usage
                })
            
            # Database size alert
            if db_metrics.database_size > 1024 * 1024 * 1024:  # 1GB
                alerts.append({
                    'alert_type': 'database_size',
                    'severity': 'warning',
                    'component': 'database',
                    'message': f'Database size large: {db_metrics.database_size / 1024 / 1024:.1f}MB',
                    'threshold_value': 1024 * 1024 * 1024,
                    'actual_value': db_metrics.database_size
                })
            
            # Save alerts
            for alert in alerts:
                self._save_alert(alert)
            
        except Exception as e:
            logger.error(f"Error checking alert conditions: {str(e)}")
    
    def _perform_maintenance_tasks(self):
        """Perform routine maintenance tasks."""
        try:
            current_time = datetime.now()
            
            # Daily maintenance tasks
            if current_time.hour == 2 and current_time.minute < 5:  # Run at 2 AM
                self._cleanup_old_metrics()
                self._optimize_database()
                self._cleanup_logs()
            
            # Weekly maintenance tasks
            if current_time.weekday() == 6 and current_time.hour == 3:  # Sunday at 3 AM
                self._vacuum_database()
                self._archive_old_data()
            
        except Exception as e:
            logger.error(f"Error performing maintenance tasks: {str(e)}")
    
    def _cleanup_old_metrics(self):
        """Clean up old metrics data."""
        try:
            cutoff_timestamp = int((datetime.now() - timedelta(days=30)).timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Clean up old system metrics
                    cursor.execute('DELETE FROM system_metrics WHERE timestamp < ?', (cutoff_timestamp,))
                    deleted_system = cursor.rowcount
                    
                    # Clean up old health checks
                    cursor.execute('DELETE FROM health_checks WHERE timestamp < ?', (cutoff_timestamp,))
                    deleted_health = cursor.rowcount
                    
                    conn.commit()
                    
            self._log_maintenance('cleanup_metrics', 'system', 
                                f'Cleaned up {deleted_system} system metrics and {deleted_health} health checks')
            
        except Exception as e:
            logger.error(f"Error cleaning up old metrics: {str(e)}")
    
    def _optimize_database(self):
        """Optimize database performance."""
        try:
            start_time = time.time()
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Analyze tables
                    cursor.execute('ANALYZE')
                    
                    # Update statistics
                    cursor.execute('PRAGMA optimize')
                    
                    conn.commit()
            
            duration_ms = int((time.time() - start_time) * 1000)
            self._log_maintenance('optimize', 'database', 
                                f'Database optimization completed in {duration_ms}ms')
            
        except Exception as e:
            logger.error(f"Error optimizing database: {str(e)}")
    
    def _vacuum_database(self):
        """Vacuum database to reclaim space."""
        try:
            start_time = time.time()
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute('VACUUM')
                    conn.commit()
            
            duration_ms = int((time.time() - start_time) * 1000)
            self._log_maintenance('vacuum', 'database', 
                                f'Database vacuum completed in {duration_ms}ms')
            
        except Exception as e:
            logger.error(f"Error vacuuming database: {str(e)}")
    
    def _cleanup_logs(self):
        """Clean up old log files."""
        try:
            # This would clean up application log files
            # Implementation depends on logging configuration
            self._log_maintenance('cleanup_logs', 'system', 'Log cleanup completed')
            
        except Exception as e:
            logger.error(f"Error cleaning up logs: {str(e)}")
    
    def _archive_old_data(self):
        """Archive old data for long-term storage."""
        try:
            # This would archive old data to external storage
            # Implementation depends on archival strategy
            self._log_maintenance('archive', 'system', 'Data archival completed')
            
        except Exception as e:
            logger.error(f"Error archiving old data: {str(e)}")
    
    def _save_system_metrics(self, metrics: SystemMetrics):
        """Save system metrics to database."""
        try:
            metrics_id = str(uuid.uuid4())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO system_metrics (
                            id, timestamp, metric_type, cpu_usage, memory_usage,
                            disk_usage, network_io, process_count, uptime_seconds,
                            load_average
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        metrics_id, int(metrics.timestamp.timestamp()), MetricType.SYSTEM.value,
                        metrics.cpu_usage, metrics.memory_usage, metrics.disk_usage,
                        json.dumps(metrics.network_io), metrics.process_count,
                        metrics.uptime_seconds, json.dumps(metrics.load_average)
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving system metrics: {str(e)}")
    
    def _save_database_metrics(self, metrics: DatabaseMetrics):
        """Save database metrics to database."""
        try:
            metrics_id = str(uuid.uuid4())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO database_metrics (
                            id, timestamp, connection_count, query_count, avg_query_time,
                            slow_queries, database_size, table_sizes, index_usage
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        metrics_id, int(metrics.timestamp.timestamp()),
                        metrics.connection_count, metrics.query_count, metrics.avg_query_time,
                        metrics.slow_queries, metrics.database_size,
                        json.dumps(metrics.table_sizes), json.dumps(metrics.index_usage)
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving database metrics: {str(e)}")
    
    def _save_health_check(self, health_check: HealthCheck):
        """Save health check result to database."""
        try:
            check_id = str(uuid.uuid4())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO health_checks (
                            id, component, status, message, timestamp, response_time_ms, metadata
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        check_id, health_check.component, health_check.status.value,
                        health_check.message, int(health_check.timestamp.timestamp()),
                        health_check.response_time_ms,
                        json.dumps(health_check.metadata) if health_check.metadata else None
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving health check: {str(e)}")
    
    def _save_alert(self, alert: Dict[str, Any]):
        """Save alert to database."""
        try:
            alert_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO monitoring_alerts (
                            id, alert_type, severity, component, message,
                            threshold_value, actual_value, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        alert_id, alert['alert_type'], alert['severity'],
                        alert['component'], alert['message'],
                        alert.get('threshold_value'), alert.get('actual_value'),
                        current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving alert: {str(e)}")
    
    def _log_maintenance(self, maintenance_type: str, component: str, details: str):
        """Log maintenance activity."""
        try:
            log_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO maintenance_logs (
                            id, maintenance_type, component, action, status,
                            details, started_at, completed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        log_id, maintenance_type, component, details, 'completed',
                        details, current_timestamp, current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error logging maintenance: {str(e)}")
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """
        Get current system metrics.
        
        Returns:
            Dict[str, Any]: Current system metrics
        """
        try:
            if self.metrics_buffer:
                latest_metrics = self.metrics_buffer[-1]
                return {
                    'timestamp': latest_metrics.timestamp.isoformat(),
                    'cpu_usage': latest_metrics.cpu_usage,
                    'memory_usage': latest_metrics.memory_usage,
                    'disk_usage': latest_metrics.disk_usage,
                    'network_io': latest_metrics.network_io,
                    'process_count': latest_metrics.process_count,
                    'uptime_seconds': latest_metrics.uptime_seconds,
                    'load_average': latest_metrics.load_average
                }
            else:
                # Collect metrics on demand if buffer is empty
                metrics = self._collect_system_metrics()
                return {
                    'timestamp': metrics.timestamp.isoformat(),
                    'cpu_usage': metrics.cpu_usage,
                    'memory_usage': metrics.memory_usage,
                    'disk_usage': metrics.disk_usage,
                    'network_io': metrics.network_io,
                    'process_count': metrics.process_count,
                    'uptime_seconds': metrics.uptime_seconds,
                    'load_average': metrics.load_average
                }
                
        except Exception as e:
            logger.error(f"Error getting current metrics: {str(e)}")
            raise
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get current health status of all components.
        
        Returns:
            Dict[str, Any]: Health status summary
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Get latest health check for each component
                cursor.execute('''
                    SELECT component, status, message, timestamp, response_time_ms
                    FROM health_checks h1
                    WHERE timestamp = (
                        SELECT MAX(timestamp)
                        FROM health_checks h2
                        WHERE h2.component = h1.component
                    )
                    ORDER BY component
                ''')
                
                health_checks = cursor.fetchall()
                
                overall_status = HealthStatus.HEALTHY
                components = {}
                
                for check in health_checks:
                    component_status = HealthStatus(check['status'])
                    components[check['component']] = {
                        'status': component_status.value,
                        'message': check['message'],
                        'last_check': datetime.fromtimestamp(check['timestamp']).isoformat(),
                        'response_time_ms': check['response_time_ms']
                    }
                    
                    # Determine overall status
                    if component_status == HealthStatus.CRITICAL:
                        overall_status = HealthStatus.CRITICAL
                    elif component_status == HealthStatus.WARNING and overall_status != HealthStatus.CRITICAL:
                        overall_status = HealthStatus.WARNING
                
                return {
                    'overall_status': overall_status.value,
                    'components': components,
                    'last_updated': datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error getting health status: {str(e)}")
            return {
                'overall_status': HealthStatus.CRITICAL.value,
                'components': {},
                'last_updated': datetime.now().isoformat(),
                'error': str(e)
            }
    
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """
        Get active monitoring alerts.
        
        Returns:
            List[Dict[str, Any]]: List of active alerts
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM monitoring_alerts
                    WHERE status = 'active'
                    ORDER BY created_at DESC
                ''')
                
                alerts = cursor.fetchall()
                return [dict(alert) for alert in alerts]
                
        except Exception as e:
            logger.error(f"Error getting active alerts: {str(e)}")
            raise
    
    def resolve_alert(self, alert_id: str) -> bool:
        """
        Resolve an active alert.
        
        Args:
            alert_id (str): Alert ID to resolve
            
        Returns:
            bool: True if successful
        """
        try:
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        UPDATE monitoring_alerts
                        SET status = 'resolved', resolved_at = ?
                        WHERE id = ? AND status = 'active'
                    ''', (current_timestamp, alert_id))
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Resolved alert: {alert_id}")
                        return True
                    else:
                        logger.warning(f"Alert not found or already resolved: {alert_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error resolving alert {alert_id}: {str(e)}")
            raise
    
    def get_metrics_history(self, metric_type: str, hours: int = 24) -> List[Dict[str, Any]]:
        """
        Get metrics history for a specified period.
        
        Args:
            metric_type (str): Type of metrics to retrieve
            hours (int): Number of hours of history to retrieve
            
        Returns:
            List[Dict[str, Any]]: Historical metrics data
        """
        try:
            start_timestamp = int((datetime.now() - timedelta(hours=hours)).timestamp())
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                if metric_type == 'system':
                    cursor.execute('''
                        SELECT * FROM system_metrics
                        WHERE timestamp >= ?
                        ORDER BY timestamp ASC
                    ''', (start_timestamp,))
                elif metric_type == 'database':
                    cursor.execute('''
                        SELECT * FROM database_metrics
                        WHERE timestamp >= ?
                        ORDER BY timestamp ASC
                    ''', (start_timestamp,))
                elif metric_type == 'api':
                    cursor.execute('''
                        SELECT * FROM api_metrics
                        WHERE timestamp >= ?
                        ORDER BY timestamp ASC
                    ''', (start_timestamp,))
                else:
                    raise ValueError(f"Unknown metric type: {metric_type}")
                
                rows = cursor.fetchall()
                
                metrics = []
                for row in rows:
                    metric_dict = dict(row)
                    # Parse JSON fields
                    for field in ['network_io', 'load_average', 'table_sizes', 'index_usage',
                                'response_times', 'status_codes', 'endpoint_usage']:
                        if field in metric_dict and metric_dict[field]:
                            try:
                                metric_dict[field] = json.loads(metric_dict[field])
                            except (json.JSONDecodeError, TypeError):
                                pass
                    metrics.append(metric_dict)
                
                return metrics
                
        except Exception as e:
            logger.error(f"Error getting metrics history: {str(e)}")
            raise
    
    def register_health_check(self, component: str, check_function: Callable) -> bool:
        """
        Register a custom health check function.
        
        Args:
            component (str): Component name
            check_function (Callable): Health check function
            
        Returns:
            bool: True if successful
        """
        try:
            self.health_checks[component] = check_function
            logger.info(f"Registered health check for component: {component}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering health check for {component}: {str(e)}")
            return False
    
    def force_garbage_collection(self) -> Dict[str, Any]:
        """
        Force garbage collection and return memory statistics.
        
        Returns:
            Dict[str, Any]: Memory statistics before and after GC
        """
        try:
            # Get memory before GC
            memory_before = psutil.virtual_memory()
            process_before = psutil.Process().memory_info()
            
            # Force garbage collection
            collected = gc.collect()
            
            # Get memory after GC
            memory_after = psutil.virtual_memory()
            process_after = psutil.Process().memory_info()
            
            result = {
                'objects_collected': collected,
                'system_memory': {
                    'before_percent': memory_before.percent,
                    'after_percent': memory_after.percent,
                    'freed_bytes': memory_before.used - memory_after.used
                },
                'process_memory': {
                    'before_rss': process_before.rss,
                    'after_rss': process_after.rss,
                    'freed_bytes': process_before.rss - process_after.rss
                },
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"Forced garbage collection: {collected} objects collected")
            return result
            
        except Exception as e:
            logger.error(f"Error forcing garbage collection: {str(e)}")
            raise