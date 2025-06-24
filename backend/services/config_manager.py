"""
Configuration Management Service for CL Position Tracking

This module provides comprehensive configuration management including:
- Environment-specific configurations (dev/staging/prod)
- Feature flags for gradual rollouts
- A/B testing framework for UI improvements
- User preference management
- System-wide settings and customization
- Security and compliance configurations
"""

import logging
import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, asdict
from enum import Enum
from threading import Lock
import uuid
import hashlib

logger = logging.getLogger(__name__)


class Environment(Enum):
    """Environment enumeration."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class FeatureFlagType(Enum):
    """Feature flag type enumeration."""
    BOOLEAN = "boolean"
    STRING = "string"
    NUMBER = "number"
    JSON = "json"


class ABTestStatus(Enum):
    """A/B test status enumeration."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


@dataclass
class FeatureFlag:
    """Feature flag configuration."""
    id: str
    name: str
    description: str
    flag_type: FeatureFlagType
    default_value: Any
    environment_values: Dict[str, Any]
    enabled: bool = True
    rollout_percentage: float = 100.0
    target_users: List[str] = None
    target_groups: List[str] = None
    created_at: datetime = None
    updated_at: datetime = None


@dataclass
class ABTest:
    """A/B test configuration."""
    id: str
    name: str
    description: str
    feature_flag_id: str
    variants: Dict[str, Any]
    traffic_allocation: Dict[str, float]
    status: ABTestStatus
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    success_metrics: List[str] = None
    results: Dict[str, Any] = None
    created_at: datetime = None


@dataclass
class UserPreference:
    """User preference configuration."""
    user_id: str
    preference_key: str
    preference_value: Any
    preference_type: str
    updated_at: datetime


@dataclass
class SystemConfig:
    """System configuration."""
    config_key: str
    config_value: Any
    config_type: str
    environment: Environment
    description: str
    is_sensitive: bool = False
    updated_at: datetime = None


class ConfigManager:
    """
    Comprehensive configuration management service.
    
    Provides centralized configuration management with support for
    feature flags, A/B testing, user preferences, and environment-specific settings.
    """
    
    def __init__(self, db_path: Optional[str] = None, environment: Optional[str] = None):
        """
        Initialize the configuration manager.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
            environment (Optional[str]): Current environment
        """
        import os
        self.db_path = db_path or os.path.join(
            os.path.dirname(__file__), '..', 'instance', 'config.db'
        )
        self.db_lock = Lock()
        
        # Determine environment
        self.environment = Environment(environment or os.getenv('ENVIRONMENT', 'development'))
        
        # Configuration cache
        self._config_cache: Dict[str, Any] = {}
        self._feature_flags_cache: Dict[str, FeatureFlag] = {}
        self._cache_expiry = datetime.now()
        self._cache_ttl = timedelta(minutes=5)
        
        # Initialize database
        self._ensure_database()
        
        # Load default configurations
        self._load_default_configs()
        
        logger.info(f"Configuration Manager initialized for {self.environment.value} environment")
    
    def _ensure_database(self):
        """Ensure the database and tables exist."""
        try:
            import os
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create feature_flags table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS feature_flags (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        description TEXT NOT NULL,
                        flag_type TEXT NOT NULL,
                        default_value TEXT NOT NULL,
                        environment_values TEXT,
                        enabled INTEGER DEFAULT 1,
                        rollout_percentage REAL DEFAULT 100.0,
                        target_users TEXT,
                        target_groups TEXT,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                ''')
                
                # Create ab_tests table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS ab_tests (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        feature_flag_id TEXT NOT NULL,
                        variants TEXT NOT NULL,
                        traffic_allocation TEXT NOT NULL,
                        status TEXT NOT NULL,
                        start_date INTEGER,
                        end_date INTEGER,
                        success_metrics TEXT,
                        results TEXT,
                        created_at INTEGER NOT NULL,
                        FOREIGN KEY (feature_flag_id) REFERENCES feature_flags (id)
                    )
                ''')
                
                # Create user_preferences table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS user_preferences (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        preference_key TEXT NOT NULL,
                        preference_value TEXT NOT NULL,
                        preference_type TEXT NOT NULL,
                        updated_at INTEGER NOT NULL,
                        UNIQUE(user_id, preference_key)
                    )
                ''')
                
                # Create system_configs table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS system_configs (
                        id TEXT PRIMARY KEY,
                        config_key TEXT NOT NULL,
                        config_value TEXT NOT NULL,
                        config_type TEXT NOT NULL,
                        environment TEXT NOT NULL,
                        description TEXT NOT NULL,
                        is_sensitive INTEGER DEFAULT 0,
                        updated_at INTEGER NOT NULL,
                        UNIQUE(config_key, environment)
                    )
                ''')
                
                # Create config_audit_log table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS config_audit_log (
                        id TEXT PRIMARY KEY,
                        config_type TEXT NOT NULL,
                        config_id TEXT NOT NULL,
                        action TEXT NOT NULL,
                        old_value TEXT,
                        new_value TEXT,
                        changed_by TEXT,
                        changed_at INTEGER NOT NULL
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_configs_env ON system_configs(environment)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_log_type ON config_audit_log(config_type)')
                
                conn.commit()
                logger.info(f"Configuration database initialized at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Error initializing configuration database: {str(e)}")
            raise
    
    def _load_default_configs(self):
        """Load default system configurations."""
        default_configs = [
            {
                'config_key': 'max_positions_per_user',
                'config_value': 100,
                'config_type': 'number',
                'description': 'Maximum number of positions per user',
                'environment_values': {
                    'development': 10,
                    'staging': 50,
                    'production': 100
                }
            },
            {
                'config_key': 'api_rate_limit_per_minute',
                'config_value': 60,
                'config_type': 'number',
                'description': 'API rate limit per minute',
                'environment_values': {
                    'development': 1000,
                    'staging': 100,
                    'production': 60
                }
            },
            {
                'config_key': 'enable_advanced_analytics',
                'config_value': True,
                'config_type': 'boolean',
                'description': 'Enable advanced analytics features',
                'environment_values': {
                    'development': True,
                    'staging': True,
                    'production': False
                }
            },
            {
                'config_key': 'notification_settings',
                'config_value': {
                    'email_enabled': True,
                    'push_enabled': True,
                    'webhook_enabled': False
                },
                'config_type': 'json',
                'description': 'Default notification settings'
            }
        ]
        
        for config in default_configs:
            self._create_default_config(config)
    
    def _create_default_config(self, config_data: Dict[str, Any]):
        """Create default configuration if it doesn't exist."""
        try:
            # Check if config already exists
            existing_config = self.get_system_config(config_data['config_key'])
            if existing_config is not None:
                return
            
            # Use environment-specific value if available
            value = config_data['config_value']
            if 'environment_values' in config_data:
                env_values = config_data['environment_values']
                if self.environment.value in env_values:
                    value = env_values[self.environment.value]
            
            # Create system config
            system_config = SystemConfig(
                config_key=config_data['config_key'],
                config_value=value,
                config_type=config_data['config_type'],
                environment=self.environment,
                description=config_data['description'],
                updated_at=datetime.now()
            )
            
            self._save_system_config(system_config)
            
        except Exception as e:
            logger.error(f"Error creating default config {config_data['config_key']}: {str(e)}")
    
    def create_feature_flag(self, flag_data: Dict[str, Any]) -> str:
        """
        Create a new feature flag.
        
        Args:
            flag_data (Dict[str, Any]): Feature flag configuration
            
        Returns:
            str: Feature flag ID
        """
        try:
            flag_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            flag = FeatureFlag(
                id=flag_id,
                name=flag_data['name'],
                description=flag_data['description'],
                flag_type=FeatureFlagType(flag_data['flag_type']),
                default_value=flag_data['default_value'],
                environment_values=flag_data.get('environment_values', {}),
                enabled=flag_data.get('enabled', True),
                rollout_percentage=flag_data.get('rollout_percentage', 100.0),
                target_users=flag_data.get('target_users', []),
                target_groups=flag_data.get('target_groups', []),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO feature_flags (
                            id, name, description, flag_type, default_value,
                            environment_values, enabled, rollout_percentage,
                            target_users, target_groups, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        flag_id, flag.name, flag.description, flag.flag_type.value,
                        json.dumps(flag.default_value), json.dumps(flag.environment_values),
                        int(flag.enabled), flag.rollout_percentage,
                        json.dumps(flag.target_users), json.dumps(flag.target_groups),
                        current_timestamp, current_timestamp
                    ))
                    
                    conn.commit()
            
            # Clear cache
            self._clear_cache()
            
            # Log audit
            self._log_config_change('feature_flag', flag_id, 'create', None, asdict(flag))
            
            logger.info(f"Created feature flag: {flag.name}")
            return flag_id
            
        except Exception as e:
            logger.error(f"Error creating feature flag: {str(e)}")
            raise
    
    def get_feature_flag(self, flag_name: str, user_id: Optional[str] = None,
                        user_groups: Optional[List[str]] = None) -> Any:
        """
        Get feature flag value for a user.
        
        Args:
            flag_name (str): Feature flag name
            user_id (Optional[str]): User ID for targeting
            user_groups (Optional[List[str]]): User groups for targeting
            
        Returns:
            Any: Feature flag value
        """
        try:
            # Check cache first
            if self._is_cache_valid() and flag_name in self._feature_flags_cache:
                flag = self._feature_flags_cache[flag_name]
            else:
                flag = self._load_feature_flag(flag_name)
                if not flag:
                    return None
            
            # Check if flag is enabled
            if not flag.enabled:
                return flag.default_value
            
            # Check targeting
            if not self._is_user_targeted(flag, user_id, user_groups):
                return flag.default_value
            
            # Check rollout percentage
            if not self._is_user_in_rollout(flag, user_id):
                return flag.default_value
            
            # Get environment-specific value
            env_value = flag.environment_values.get(self.environment.value)
            if env_value is not None:
                return env_value
            
            return flag.default_value
            
        except Exception as e:
            logger.error(f"Error getting feature flag {flag_name}: {str(e)}")
            return None
    
    def update_feature_flag(self, flag_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update a feature flag.
        
        Args:
            flag_id (str): Feature flag ID
            updates (Dict[str, Any]): Updates to apply
            
        Returns:
            bool: True if successful
        """
        try:
            current_timestamp = int(datetime.now().timestamp())
            
            # Get current flag for audit
            old_flag = self._load_feature_flag_by_id(flag_id)
            if not old_flag:
                return False
            
            # Build update query
            set_clauses = []
            params = []
            
            for field, value in updates.items():
                if field in ['name', 'description', 'flag_type', 'enabled', 'rollout_percentage']:
                    set_clauses.append(f"{field} = ?")
                    if field == 'enabled':
                        params.append(int(value))
                    elif field == 'flag_type':
                        params.append(value.value if isinstance(value, FeatureFlagType) else value)
                    else:
                        params.append(value)
                elif field in ['default_value', 'environment_values', 'target_users', 'target_groups']:
                    set_clauses.append(f"{field} = ?")
                    params.append(json.dumps(value))
            
            if not set_clauses:
                return True
            
            set_clauses.append("updated_at = ?")
            params.append(current_timestamp)
            params.append(flag_id)
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    query = f"UPDATE feature_flags SET {', '.join(set_clauses)} WHERE id = ?"
                    cursor.execute(query, params)
                    
                    if cursor.rowcount > 0:
                        conn.commit()
                        
                        # Clear cache
                        self._clear_cache()
                        
                        # Log audit
                        self._log_config_change('feature_flag', flag_id, 'update', asdict(old_flag), updates)
                        
                        logger.info(f"Updated feature flag: {flag_id}")
                        return True
                    else:
                        return False
                        
        except Exception as e:
            logger.error(f"Error updating feature flag {flag_id}: {str(e)}")
            raise
    
    def create_ab_test(self, test_data: Dict[str, Any]) -> str:
        """
        Create a new A/B test.
        
        Args:
            test_data (Dict[str, Any]): A/B test configuration
            
        Returns:
            str: A/B test ID
        """
        try:
            test_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            ab_test = ABTest(
                id=test_id,
                name=test_data['name'],
                description=test_data['description'],
                feature_flag_id=test_data['feature_flag_id'],
                variants=test_data['variants'],
                traffic_allocation=test_data['traffic_allocation'],
                status=ABTestStatus(test_data.get('status', 'draft')),
                start_date=datetime.fromisoformat(test_data['start_date']) if test_data.get('start_date') else None,
                end_date=datetime.fromisoformat(test_data['end_date']) if test_data.get('end_date') else None,
                success_metrics=test_data.get('success_metrics', []),
                created_at=datetime.now()
            )
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO ab_tests (
                            id, name, description, feature_flag_id, variants,
                            traffic_allocation, status, start_date, end_date,
                            success_metrics, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        test_id, ab_test.name, ab_test.description, ab_test.feature_flag_id,
                        json.dumps(ab_test.variants), json.dumps(ab_test.traffic_allocation),
                        ab_test.status.value,
                        int(ab_test.start_date.timestamp()) if ab_test.start_date else None,
                        int(ab_test.end_date.timestamp()) if ab_test.end_date else None,
                        json.dumps(ab_test.success_metrics), current_timestamp
                    ))
                    
                    conn.commit()
            
            logger.info(f"Created A/B test: {ab_test.name}")
            return test_id
            
        except Exception as e:
            logger.error(f"Error creating A/B test: {str(e)}")
            raise
    
    def get_ab_test_variant(self, test_id: str, user_id: str) -> Optional[str]:
        """
        Get A/B test variant for a user.
        
        Args:
            test_id (str): A/B test ID
            user_id (str): User ID
            
        Returns:
            Optional[str]: Variant name or None
        """
        try:
            # Load A/B test
            ab_test = self._load_ab_test(test_id)
            if not ab_test or ab_test.status != ABTestStatus.ACTIVE:
                return None
            
            # Check if test is active
            now = datetime.now()
            if ab_test.start_date and now < ab_test.start_date:
                return None
            if ab_test.end_date and now > ab_test.end_date:
                return None
            
            # Determine variant based on user hash
            user_hash = hashlib.md5(f"{test_id}:{user_id}".encode()).hexdigest()
            hash_value = int(user_hash[:8], 16) / 0xffffffff  # Normalize to 0-1
            
            cumulative_allocation = 0.0
            for variant, allocation in ab_test.traffic_allocation.items():
                cumulative_allocation += allocation
                if hash_value <= cumulative_allocation:
                    return variant
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting A/B test variant: {str(e)}")
            return None
    
    def set_user_preference(self, user_id: str, preference_key: str, 
                           preference_value: Any, preference_type: str = 'string') -> bool:
        """
        Set user preference.
        
        Args:
            user_id (str): User ID
            preference_key (str): Preference key
            preference_value (Any): Preference value
            preference_type (str): Value type
            
        Returns:
            bool: True if successful
        """
        try:
            pref_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            # Serialize value based on type
            if preference_type == 'json':
                serialized_value = json.dumps(preference_value)
            else:
                serialized_value = str(preference_value)
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO user_preferences (
                            id, user_id, preference_key, preference_value,
                            preference_type, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        pref_id, user_id, preference_key, serialized_value,
                        preference_type, current_timestamp
                    ))
                    
                    conn.commit()
            
            logger.info(f"Set user preference: {user_id}.{preference_key}")
            return True
            
        except Exception as e:
            logger.error(f"Error setting user preference: {str(e)}")
            raise
    
    def get_user_preference(self, user_id: str, preference_key: str, 
                           default_value: Any = None) -> Any:
        """
        Get user preference.
        
        Args:
            user_id (str): User ID
            preference_key (str): Preference key
            default_value (Any): Default value if not found
            
        Returns:
            Any: Preference value or default
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT preference_value, preference_type
                    FROM user_preferences
                    WHERE user_id = ? AND preference_key = ?
                ''', (user_id, preference_key))
                
                row = cursor.fetchone()
                if not row:
                    return default_value
                
                # Deserialize value based on type
                if row['preference_type'] == 'json':
                    return json.loads(row['preference_value'])
                elif row['preference_type'] == 'boolean':
                    return row['preference_value'].lower() == 'true'
                elif row['preference_type'] == 'number':
                    return float(row['preference_value'])
                else:
                    return row['preference_value']
                    
        except Exception as e:
            logger.error(f"Error getting user preference: {str(e)}")
            return default_value
    
    def get_system_config(self, config_key: str, default_value: Any = None) -> Any:
        """
        Get system configuration value.
        
        Args:
            config_key (str): Configuration key
            default_value (Any): Default value if not found
            
        Returns:
            Any: Configuration value or default
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT config_value, config_type
                    FROM system_configs
                    WHERE config_key = ? AND environment = ?
                ''', (config_key, self.environment.value))
                
                row = cursor.fetchone()
                if not row:
                    return default_value
                
                # Deserialize value based on type
                if row['config_type'] == 'json':
                    return json.loads(row['config_value'])
                elif row['config_type'] == 'boolean':
                    return row['config_value'].lower() == 'true'
                elif row['config_type'] == 'number':
                    return float(row['config_value'])
                else:
                    return row['config_value']
                    
        except Exception as e:
            logger.error(f"Error getting system config: {str(e)}")
            return default_value
    
    def set_system_config(self, config_key: str, config_value: Any, 
                         config_type: str, description: str,
                         is_sensitive: bool = False) -> bool:
        """
        Set system configuration.
        
        Args:
            config_key (str): Configuration key
            config_value (Any): Configuration value
            config_type (str): Value type
            description (str): Configuration description
            is_sensitive (bool): Whether config contains sensitive data
            
        Returns:
            bool: True if successful
        """
        try:
            system_config = SystemConfig(
                config_key=config_key,
                config_value=config_value,
                config_type=config_type,
                environment=self.environment,
                description=description,
                is_sensitive=is_sensitive,
                updated_at=datetime.now()
            )
            
            return self._save_system_config(system_config)
            
        except Exception as e:
            logger.error(f"Error setting system config: {str(e)}")
            raise
    
    def _save_system_config(self, config: SystemConfig) -> bool:
        """Save system configuration to database."""
        try:
            config_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            # Serialize value based on type
            if config.config_type == 'json':
                serialized_value = json.dumps(config.config_value)
            else:
                serialized_value = str(config.config_value)
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO system_configs (
                            id, config_key, config_value, config_type,
                            environment, description, is_sensitive, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        config_id, config.config_key, serialized_value, config.config_type,
                        config.environment.value, config.description,
                        int(config.is_sensitive), current_timestamp
                    ))
                    
                    conn.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving system config: {str(e)}")
            raise
    
    def _load_feature_flag(self, flag_name: str) -> Optional[FeatureFlag]:
        """Load feature flag from database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM feature_flags WHERE name = ?', (flag_name,))
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                flag = FeatureFlag(
                    id=row['id'],
                    name=row['name'],
                    description=row['description'],
                    flag_type=FeatureFlagType(row['flag_type']),
                    default_value=json.loads(row['default_value']),
                    environment_values=json.loads(row['environment_values']) if row['environment_values'] else {},
                    enabled=bool(row['enabled']),
                    rollout_percentage=row['rollout_percentage'],
                    target_users=json.loads(row['target_users']) if row['target_users'] else [],
                    target_groups=json.loads(row['target_groups']) if row['target_groups'] else [],
                    created_at=datetime.fromtimestamp(row['created_at']),
                    updated_at=datetime.fromtimestamp(row['updated_at'])
                )
                
                # Cache the flag
                self._feature_flags_cache[flag_name] = flag
                
                return flag
                
        except Exception as e:
            logger.error(f"Error loading feature flag {flag_name}: {str(e)}")
            return None
    
    def _load_feature_flag_by_id(self, flag_id: str) -> Optional[FeatureFlag]:
        """Load feature flag by ID from database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM feature_flags WHERE id = ?', (flag_id,))
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                return FeatureFlag(
                    id=row['id'],
                    name=row['name'],
                    description=row['description'],
                    flag_type=FeatureFlagType(row['flag_type']),
                    default_value=json.loads(row['default_value']),
                    environment_values=json.loads(row['environment_values']) if row['environment_values'] else {},
                    enabled=bool(row['enabled']),
                    rollout_percentage=row['rollout_percentage'],
                    target_users=json.loads(row['target_users']) if row['target_users'] else [],
                    target_groups=json.loads(row['target_groups']) if row['target_groups'] else [],
                    created_at=datetime.fromtimestamp(row['created_at']),
                    updated_at=datetime.fromtimestamp(row['updated_at'])
                )
                
        except Exception as e:
            logger.error(f"Error loading feature flag by ID {flag_id}: {str(e)}")
            return None
    
    def _load_ab_test(self, test_id: str) -> Optional[ABTest]:
        """Load A/B test from database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM ab_tests WHERE id = ?', (test_id,))
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                return ABTest(
                    id=row['id'],
                    name=row['name'],
                    description=row['description'],
                    feature_flag_id=row['feature_flag_id'],
                    variants=json.loads(row['variants']),
                    traffic_allocation=json.loads(row['traffic_allocation']),
                    status=ABTestStatus(row['status']),
                    start_date=datetime.fromtimestamp(row['start_date']) if row['start_date'] else None,
                    end_date=datetime.fromtimestamp(row['end_date']) if row['end_date'] else None,
                    success_metrics=json.loads(row['success_metrics']) if row['success_metrics'] else [],
                    results=json.loads(row['results']) if row['results'] else None,
                    created_at=datetime.fromtimestamp(row['created_at'])
                )
                
        except Exception as e:
            logger.error(f"Error loading A/B test {test_id}: {str(e)}")
            return None
    
    def _is_user_targeted(self, flag: FeatureFlag, user_id: Optional[str],
                         user_groups: Optional[List[str]]) -> bool:
        """Check if user is targeted by feature flag."""
        # If no targeting is specified, target all users
        if not flag.target_users and not flag.target_groups:
            return True
        
        # Check user targeting
        if flag.target_users and user_id and user_id in flag.target_users:
            return True
        
        # Check group targeting
        if flag.target_groups and user_groups:
            for group in user_groups:
                if group in flag.target_groups:
                    return True
        
        return False
    
    def _is_user_in_rollout(self, flag: FeatureFlag, user_id: Optional[str]) -> bool:
        """Check if user is in rollout percentage."""
        if flag.rollout_percentage >= 100.0:
            return True
        
        if not user_id:
            return False
        
        # Use consistent hash for rollout
        user_hash = hashlib.md5(f"{flag.id}:{user_id}".encode()).hexdigest()
        hash_value = int(user_hash[:8], 16) / 0xffffffff * 100  # Normalize to 0-100
        
        return hash_value <= flag.rollout_percentage
    
    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid."""
        return datetime.now() < self._cache_expiry
    
    def _clear_cache(self):
        """Clear configuration cache."""
        self._config_cache.clear()
        self._feature_flags_cache.clear()
        self._cache_expiry = datetime.now() + self._cache_ttl
    
    def _log_config_change(self, config_type: str, config_id: str, action: str,
                          old_value: Any, new_value: Any, changed_by: str = 'system'):
        """Log configuration change for audit."""
        try:
            log_id = str(uuid.uuid4())
            current_timestamp = int(datetime.now().timestamp())
            
            with self.db_lock:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO config_audit_log (
                            id, config_type, config_id, action, old_value,
                            new_value, changed_by, changed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        log_id, config_type, config_id, action,
                        json.dumps(old_value) if old_value else None,
                        json.dumps(new_value) if new_value else None,
                        changed_by, current_timestamp
                    ))
                    
                    conn.commit()
                    
        except Exception as e:
            logger.error(f"Error logging config change: {str(e)}")
    
    def get_all_feature_flags(self) -> List[Dict[str, Any]]:
        """
        Get all feature flags.
        
        Returns:
            List[Dict[str, Any]]: List of feature flags
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM feature_flags ORDER BY name')
                rows = cursor.fetchall()
                
                flags = []
                for row in rows:
                    flag_dict = dict(row)
                    # Parse JSON fields
                    flag_dict['default_value'] = json.loads(flag_dict['default_value'])
                    flag_dict['environment_values'] = json.loads(flag_dict['environment_values']) if flag_dict['environment_values'] else {}
                    flag_dict['target_users'] = json.loads(flag_dict['target_users']) if flag_dict['target_users'] else []
                    flag_dict['target_groups'] = json.loads(flag_dict['target_groups']) if flag_dict['target_groups'] else []
                    flag_dict['enabled'] = bool(flag_dict['enabled'])
                    flags.append(flag_dict)
                
                return flags
                
        except Exception as e:
            logger.error(f"Error getting all feature flags: {str(e)}")
            raise
    
    def get_all_ab_tests(self) -> List[Dict[str, Any]]:
        """
        Get all A/B tests.
        
        Returns:
            List[Dict[str, Any]]: List of A/B tests
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('SELECT * FROM ab_tests ORDER BY created_at DESC')
                rows = cursor.fetchall()
                
                tests = []
                for row in rows:
                    test_dict = dict(row)
                    # Parse JSON fields
                    test_dict['variants'] = json.loads(test_dict['variants'])
                    test_dict['traffic_allocation'] = json.loads(test_dict['traffic_allocation'])
                    test_dict['success_metrics'] = json.loads(test_dict['success_metrics']) if test_dict['success_metrics'] else []
                    test_dict['results'] = json.loads(test_dict['results']) if test_dict['results'] else None
                    tests.append(test_dict)
                
                return tests
                
        except Exception as e:
            logger.error(f"Error getting all A/B tests: {str(e)}")
            raise
    
    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """
        Get all preferences for a user.
        
        Args:
            user_id (str): User ID
            
        Returns:
            Dict[str, Any]: User preferences
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT preference_key, preference_value, preference_type
                    FROM user_preferences
                    WHERE user_id = ?
                ''', (user_id,))
                
                rows = cursor.fetchall()
                
                preferences = {}
                for row in rows:
                    key = row['preference_key']
                    value = row['preference_value']
                    pref_type = row['preference_type']
                    
                    # Deserialize value based on type
                    if pref_type == 'json':
                        preferences[key] = json.loads(value)
                    elif pref_type == 'boolean':
                        preferences[key] = value.lower() == 'true'
                    elif pref_type == 'number':
                        preferences[key] = float(value)
                    else:
                        preferences[key] = value
                
                return preferences
                
        except Exception as e:
            logger.error(f"Error getting user preferences: {str(e)}")
            return {}
    
    def get_system_configs(self) -> Dict[str, Any]:
        """
        Get all system configurations for current environment.
        
        Returns:
            Dict[str, Any]: System configurations
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT config_key, config_value, config_type, is_sensitive
                    FROM system_configs
                    WHERE environment = ?
                ''', (self.environment.value,))
                
                rows = cursor.fetchall()
                
                configs = {}
                for row in rows:
                    key = row['config_key']
                    value = row['config_value']
                    config_type = row['config_type']
                    is_sensitive = bool(row['is_sensitive'])
                    
                    # Skip sensitive configs in response
                    if is_sensitive:
                        configs[key] = '***SENSITIVE***'
                        continue
                    
                    # Deserialize value based on type
                    if config_type == 'json':
                        configs[key] = json.loads(value)
                    elif config_type == 'boolean':
                        configs[key] = value.lower() == 'true'
                    elif config_type == 'number':
                        configs[key] = float(value)
                    else:
                        configs[key] = value
                
                return configs
                
        except Exception as e:
            logger.error(f"Error getting system configs: {str(e)}")
            return {}
    
    def export_configuration(self) -> Dict[str, Any]:
        """
        Export all configuration data.
        
        Returns:
            Dict[str, Any]: Complete configuration export
        """
        try:
            return {
                'environment': self.environment.value,
                'feature_flags': self.get_all_feature_flags(),
                'ab_tests': self.get_all_ab_tests(),
                'system_configs': self.get_system_configs(),
                'exported_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error exporting configuration: {str(e)}")
            raise