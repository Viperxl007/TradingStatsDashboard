"""
Advanced Alert Service for CL Position Tracking

This module provides comprehensive alerting capabilities including:
- Email notifications via SMTP
- Browser push notifications
- Webhook integrations
- Alert escalation and acknowledgment workflows
- Custom alert rules and thresholds
- Alert analytics and reporting
"""

import logging
import smtplib
import json
import uuid
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from threading import Lock
import requests
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class AlertType(Enum):
    """Alert type enumeration."""
    PRICE_OUT_OF_RANGE = "price_out_of_range"
    HIGH_IMPERMANENT_LOSS = "high_impermanent_loss"
    LOW_FEES_COLLECTED = "low_fees_collected"
    POSITION_EXPIRY = "position_expiry"
    REBALANCE_SUGGESTION = "rebalance_suggestion"
    SYSTEM_ERROR = "system_error"
    CUSTOM = "custom"


class AlertSeverity(Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(Enum):
    """Alert status enumeration."""
    PENDING = "pending"
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


@dataclass
class AlertRule:
    """Alert rule configuration."""
    id: str
    name: str
    alert_type: AlertType
    severity: AlertSeverity
    conditions: Dict[str, Any]
    enabled: bool = True
    position_id: Optional[str] = None
    notification_channels: List[str] = None
    escalation_delay_minutes: int = 30
    max_escalations: int = 3


@dataclass
class Alert:
    """Alert data structure."""
    id: str
    rule_id: str
    position_id: Optional[str]
    alert_type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    status: AlertStatus
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    escalation_count: int = 0
    metadata: Dict[str, Any] = None


class AlertService:
    """
    Advanced alert service for CL position tracking.
    
    Provides comprehensive alerting capabilities with multiple notification
    channels, escalation workflows, and analytics.
    """
    
    def __init__(self, db_path: Optional[str] = None, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the alert service.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
            config (Optional[Dict[str, Any]]): Configuration for SMTP, webhooks, etc.
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'alerts.db'
        )
        self.db_lock = Lock()
        self.config = config or {}
        self.alert_rules: Dict[str, AlertRule] = {}
        self.notification_handlers: Dict[str, Callable] = {}
        
        # Initialize database
        self._ensure_database()
        
        # Register default notification handlers
        self._register_notification_handlers()
        
        # Load alert rules from database
        self._load_alert_rules()
        
        logger.info("Advanced Alert Service initialized")
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create alert_rules table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS alert_rules (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        alert_type TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        conditions TEXT NOT NULL,
                        enabled INTEGER DEFAULT 1,
                        position_id TEXT,
                        notification_channels TEXT,
                        escalation_delay_minutes INTEGER DEFAULT 30,
                        max_escalations INTEGER DEFAULT 3,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                ''')
                
                # Create alerts table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS alerts (
                        id TEXT PRIMARY KEY,
                        rule_id TEXT NOT NULL,
                        position_id TEXT,
                        alert_type TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL,
                        acknowledged_at INTEGER,
                        acknowledged_by TEXT,
                        resolved_at INTEGER,
                        escalation_count INTEGER DEFAULT 0,
                        metadata TEXT,
                        FOREIGN KEY (rule_id) REFERENCES alert_rules (id)
                    )
                ''')
                
                # Create alert_notifications table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS alert_notifications (
                        id TEXT PRIMARY KEY,
                        alert_id TEXT NOT NULL,
                        channel TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        sent_at INTEGER,
                        error_message TEXT,
                        created_at INTEGER NOT NULL,
                        FOREIGN KEY (alert_id) REFERENCES alerts (id)
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_position_id ON alerts(position_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled)')
                
                conn.commit()
                logger.info(f"Alert database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing alert database: {str(e)}")
            raise
    
    def _register_notification_handlers(self):
        """Register default notification handlers."""
        self.notification_handlers = {
            'email': self._send_email_notification,
            'webhook': self._send_webhook_notification,
            'push': self._send_push_notification,
            'log': self._send_log_notification
        }
    
    def _load_alert_rules(self):
        """Load alert rules from database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM alert_rules WHERE enabled = 1')
                rows = cursor.fetchall()
                
                for row in rows:
                    rule = AlertRule(
                        id=row['id'],
                        name=row['name'],
                        alert_type=AlertType(row['alert_type']),
                        severity=AlertSeverity(row['severity']),
                        conditions=json.loads(row['conditions']),
                        enabled=bool(row['enabled']),
                        position_id=row['position_id'],
                        notification_channels=json.loads(row['notification_channels']) if row['notification_channels'] else [],
                        escalation_delay_minutes=row['escalation_delay_minutes'],
                        max_escalations=row['max_escalations']
                    )
                    self.alert_rules[rule.id] = rule
                
                logger.info(f"Loaded {len(self.alert_rules)} alert rules")
                
        except Exception as e:
            logger.error(f"Error loading alert rules: {str(e)}")
    
    def create_alert_rule(self, rule_data: Dict[str, Any]) -> str:
        """
        Create a new alert rule.
        
        Args:
            rule_data (Dict[str, Any]): Alert rule configuration
            
        Returns:
            str: The ID of the created rule
        """
        try:
            rule_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            rule = AlertRule(
                id=rule_id,
                name=rule_data['name'],
                alert_type=AlertType(rule_data['alert_type']),
                severity=AlertSeverity(rule_data['severity']),
                conditions=rule_data['conditions'],
                enabled=rule_data.get('enabled', True),
                position_id=rule_data.get('position_id'),
                notification_channels=rule_data.get('notification_channels', ['log']),
                escalation_delay_minutes=rule_data.get('escalation_delay_minutes', 30),
                max_escalations=rule_data.get('max_escalations', 3)
            )
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO alert_rules (
                            id, name, alert_type, severity, conditions, enabled,
                            position_id, notification_channels, escalation_delay_minutes,
                            max_escalations, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        rule_id, rule.name, rule.alert_type.value, rule.severity.value,
                        json.dumps(rule.conditions), int(rule.enabled), rule.position_id,
                        json.dumps(rule.notification_channels), rule.escalation_delay_minutes,
                        rule.max_escalations, current_timestamp, current_timestamp
                    ))
                    
                    conn.commit()
                    
            # Add to memory
            self.alert_rules[rule_id] = rule
            
            logger.info(f"Created alert rule: {rule_id}")
            return rule_id
            
        except Exception as e:
            logger.error(f"Error creating alert rule: {str(e)}")
            raise
    
    def trigger_alert(self, rule_id: str, position_data: Optional[Dict[str, Any]] = None,
                     custom_message: Optional[str] = None) -> str:
        """
        Trigger an alert based on a rule.
        
        Args:
            rule_id (str): The alert rule ID
            position_data (Optional[Dict[str, Any]]): Position data for context
            custom_message (Optional[str]): Custom alert message
            
        Returns:
            str: The ID of the created alert
        """
        try:
            if rule_id not in self.alert_rules:
                raise ValueError(f"Alert rule not found: {rule_id}")
            
            rule = self.alert_rules[rule_id]
            
            if not rule.enabled:
                logger.debug(f"Alert rule disabled: {rule_id}")
                return None
            
            alert_id = str(uuid.uuid4())
            current_time = datetime.now()
            
            # Generate alert title and message
            title, message = self._generate_alert_content(rule, position_data, custom_message)
            
            alert = Alert(
                id=alert_id,
                rule_id=rule_id,
                position_id=rule.position_id or (position_data.get('id') if position_data else None),
                alert_type=rule.alert_type,
                severity=rule.severity,
                title=title,
                message=message,
                status=AlertStatus.PENDING,
                created_at=current_time,
                updated_at=current_time,
                metadata=position_data
            )
            
            # Save alert to database
            self._save_alert(alert)
            
            # Send notifications
            self._send_notifications(alert, rule)
            
            logger.info(f"Triggered alert: {alert_id} for rule: {rule_id}")
            return alert_id
            
        except Exception as e:
            logger.error(f"Error triggering alert: {str(e)}")
            raise
    
    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """
        Acknowledge an alert.
        
        Args:
            alert_id (str): The alert ID
            acknowledged_by (str): User who acknowledged the alert
            
        Returns:
            bool: True if successful
        """
        try:
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        UPDATE alerts 
                        SET status = ?, acknowledged_at = ?, acknowledged_by = ?, updated_at = ?
                        WHERE id = ? AND status IN ('pending', 'sent', 'escalated')
                    ''', (
                        AlertStatus.ACKNOWLEDGED.value, current_timestamp,
                        acknowledged_by, current_timestamp, alert_id
                    ))
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Alert acknowledged: {alert_id} by {acknowledged_by}")
                        return True
                    else:
                        logger.warning(f"Alert not found or already processed: {alert_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error acknowledging alert {alert_id}: {str(e)}")
            raise
    
    def resolve_alert(self, alert_id: str) -> bool:
        """
        Resolve an alert.
        
        Args:
            alert_id (str): The alert ID
            
        Returns:
            bool: True if successful
        """
        try:
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        UPDATE alerts 
                        SET status = ?, resolved_at = ?, updated_at = ?
                        WHERE id = ?
                    ''', (
                        AlertStatus.RESOLVED.value, current_timestamp,
                        current_timestamp, alert_id
                    ))
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        logger.info(f"Alert resolved: {alert_id}")
                        return True
                    else:
                        logger.warning(f"Alert not found: {alert_id}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error resolving alert {alert_id}: {str(e)}")
            raise
    
    def get_alerts(self, status: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get alerts with optional filtering.
        
        Args:
            status (Optional[str]): Filter by status
            limit (Optional[int]): Limit number of results
            
        Returns:
            List[Dict[str, Any]]: List of alerts
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                query = 'SELECT * FROM alerts'
                params = []
                
                if status:
                    query += ' WHERE status = ?'
                    params.append(status)
                
                query += ' ORDER BY created_at DESC'
                
                if limit:
                    query += ' LIMIT ?'
                    params.append(limit)
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                alerts = []
                for row in rows:
                    alert_dict = dict(row)
                    if alert_dict['metadata']:
                        alert_dict['metadata'] = json.loads(alert_dict['metadata'])
                    alerts.append(alert_dict)
                
                return alerts
                
        except Exception as e:
            logger.error(f"Error retrieving alerts: {str(e)}")
            raise
    
    def get_alert_analytics(self, days: int = 30) -> Dict[str, Any]:
        """
        Get alert analytics for the specified period.
        
        Args:
            days (int): Number of days to analyze
            
        Returns:
            Dict[str, Any]: Analytics data
        """
        try:
            start_timestamp = int((datetime.now() - timedelta(days=days)).timestamp())
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Total alerts by status
                cursor.execute('''
                    SELECT status, COUNT(*) as count
                    FROM alerts
                    WHERE created_at >= ?
                    GROUP BY status
                ''', (start_timestamp,))
                status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
                
                # Alerts by type
                cursor.execute('''
                    SELECT alert_type, COUNT(*) as count
                    FROM alerts
                    WHERE created_at >= ?
                    GROUP BY alert_type
                ''', (start_timestamp,))
                type_counts = {row['alert_type']: row['count'] for row in cursor.fetchall()}
                
                # Alerts by severity
                cursor.execute('''
                    SELECT severity, COUNT(*) as count
                    FROM alerts
                    WHERE created_at >= ?
                    GROUP BY severity
                ''', (start_timestamp,))
                severity_counts = {row['severity']: row['count'] for row in cursor.fetchall()}
                
                # Average response time (acknowledgment)
                cursor.execute('''
                    SELECT AVG(acknowledged_at - created_at) as avg_response_time
                    FROM alerts
                    WHERE created_at >= ? AND acknowledged_at IS NOT NULL
                ''', (start_timestamp,))
                avg_response_time = cursor.fetchone()['avg_response_time'] or 0
                
                # Escalation rate
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_alerts,
                        SUM(CASE WHEN escalation_count > 0 THEN 1 ELSE 0 END) as escalated_alerts
                    FROM alerts
                    WHERE created_at >= ?
                ''', (start_timestamp,))
                escalation_data = cursor.fetchone()
                escalation_rate = (escalation_data['escalated_alerts'] / escalation_data['total_alerts'] * 100) if escalation_data['total_alerts'] > 0 else 0
                
                analytics = {
                    'period_days': days,
                    'total_alerts': sum(status_counts.values()),
                    'status_breakdown': status_counts,
                    'type_breakdown': type_counts,
                    'severity_breakdown': severity_counts,
                    'avg_response_time_seconds': avg_response_time,
                    'escalation_rate_percent': escalation_rate
                }
                
                return analytics
                
        except Exception as e:
            logger.error(f"Error generating alert analytics: {str(e)}")
            raise
    
    def _save_alert(self, alert: Alert):
        """Save alert to database."""
        try:
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO alerts (
                            id, rule_id, position_id, alert_type, severity, title, message,
                            status, created_at, updated_at, escalation_count, metadata
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        alert.id, alert.rule_id, alert.position_id,
                        alert.alert_type.value, alert.severity.value,
                        alert.title, alert.message, alert.status.value,
                        int(alert.created_at.timestamp()), int(alert.updated_at.timestamp()),
                        alert.escalation_count, json.dumps(alert.metadata) if alert.metadata else None
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error saving alert: {str(e)}")
            raise
    
    def _generate_alert_content(self, rule: AlertRule, position_data: Optional[Dict[str, Any]],
                               custom_message: Optional[str]) -> Tuple[str, str]:
        """Generate alert title and message."""
        if custom_message:
            return f"{rule.alert_type.value.replace('_', ' ').title()}", custom_message
        
        position_name = position_data.get('trade_name', 'Unknown') if position_data else 'System'
        
        title_templates = {
            AlertType.PRICE_OUT_OF_RANGE: f"Price Alert: {position_name}",
            AlertType.HIGH_IMPERMANENT_LOSS: f"High IL Alert: {position_name}",
            AlertType.LOW_FEES_COLLECTED: f"Low Fees Alert: {position_name}",
            AlertType.POSITION_EXPIRY: f"Position Expiry: {position_name}",
            AlertType.REBALANCE_SUGGESTION: f"Rebalance Suggestion: {position_name}",
            AlertType.SYSTEM_ERROR: "System Error Alert",
            AlertType.CUSTOM: f"Custom Alert: {position_name}"
        }
        
        message_templates = {
            AlertType.PRICE_OUT_OF_RANGE: f"Position {position_name} price is outside the configured range.",
            AlertType.HIGH_IMPERMANENT_LOSS: f"Position {position_name} has high impermanent loss.",
            AlertType.LOW_FEES_COLLECTED: f"Position {position_name} has collected fewer fees than expected.",
            AlertType.POSITION_EXPIRY: f"Position {position_name} is approaching expiry.",
            AlertType.REBALANCE_SUGGESTION: f"Position {position_name} may benefit from rebalancing.",
            AlertType.SYSTEM_ERROR: "A system error has occurred.",
            AlertType.CUSTOM: f"Custom alert triggered for {position_name}."
        }
        
        title = title_templates.get(rule.alert_type, f"Alert: {position_name}")
        message = message_templates.get(rule.alert_type, "Alert triggered.")
        
        return title, message
    
    def _send_notifications(self, alert: Alert, rule: AlertRule):
        """Send notifications for an alert."""
        for channel in rule.notification_channels:
            if channel in self.notification_handlers:
                try:
                    self.notification_handlers[channel](alert, rule)
                    self._log_notification(alert.id, channel, 'sent')
                except Exception as e:
                    logger.error(f"Error sending {channel} notification: {str(e)}")
                    self._log_notification(alert.id, channel, 'failed', str(e))
    
    def _send_email_notification(self, alert: Alert, rule: AlertRule):
        """Send email notification."""
        if 'smtp' not in self.config:
            logger.warning("SMTP configuration not found")
            return
        
        smtp_config = self.config['smtp']
        
        msg = MimeMultipart()
        msg['From'] = smtp_config['from_email']
        msg['To'] = smtp_config['to_email']
        msg['Subject'] = f"[{alert.severity.value.upper()}] {alert.title}"
        
        body = f"""
        Alert Details:
        - Type: {alert.alert_type.value}
        - Severity: {alert.severity.value}
        - Position: {alert.position_id or 'N/A'}
        - Time: {alert.created_at}
        
        Message: {alert.message}
        
        Alert ID: {alert.id}
        """
        
        msg.attach(MimeText(body, 'plain'))
        
        with smtplib.SMTP(smtp_config['host'], smtp_config['port']) as server:
            if smtp_config.get('use_tls'):
                server.starttls()
            if smtp_config.get('username'):
                server.login(smtp_config['username'], smtp_config['password'])
            server.send_message(msg)
    
    def _send_webhook_notification(self, alert: Alert, rule: AlertRule):
        """Send webhook notification."""
        if 'webhook_url' not in self.config:
            logger.warning("Webhook URL not configured")
            return
        
        payload = {
            'alert_id': alert.id,
            'rule_id': alert.rule_id,
            'position_id': alert.position_id,
            'type': alert.alert_type.value,
            'severity': alert.severity.value,
            'title': alert.title,
            'message': alert.message,
            'timestamp': alert.created_at.isoformat(),
            'metadata': alert.metadata
        }
        
        response = requests.post(
            self.config['webhook_url'],
            json=payload,
            timeout=30
        )
        response.raise_for_status()
    
    def _send_push_notification(self, alert: Alert, rule: AlertRule):
        """Send browser push notification."""
        # This would integrate with a push notification service
        # For now, just log the notification
        logger.info(f"Push notification: {alert.title} - {alert.message}")
    
    def _send_log_notification(self, alert: Alert, rule: AlertRule):
        """Send log notification."""
        log_level = {
            AlertSeverity.LOW: logging.INFO,
            AlertSeverity.MEDIUM: logging.WARNING,
            AlertSeverity.HIGH: logging.ERROR,
            AlertSeverity.CRITICAL: logging.CRITICAL
        }.get(alert.severity, logging.INFO)
        
        logger.log(log_level, f"ALERT [{alert.severity.value.upper()}] {alert.title}: {alert.message}")
    
    def _log_notification(self, alert_id: str, channel: str, status: str, error_message: str = None):
        """Log notification attempt."""
        try:
            notification_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO alert_notifications (
                            id, alert_id, channel, status, sent_at, error_message, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        notification_id, alert_id, channel, status,
                        current_timestamp if status == 'sent' else None,
                        error_message, current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error logging notification: {str(e)}")