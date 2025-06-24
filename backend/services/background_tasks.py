"""
Background Tasks Service

This module provides background task management for the CL Position Tracking System,
including automated price updates, monitoring, and maintenance tasks.
"""

import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from threading import Lock
import json
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    logger.warning("APScheduler not available. Background tasks will be disabled.")

from .price_updater import PriceUpdateService
from .position_monitor import PositionMonitorService
from models.cl_position import CLPosition


class TaskStatus(Enum):
    """Task execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    DISABLED = "disabled"


@dataclass
class TaskExecution:
    """Task execution record."""
    task_id: str
    task_name: str
    status: TaskStatus
    start_time: datetime
    end_time: Optional[datetime]
    duration: Optional[float]
    result: Optional[Dict[str, Any]]
    error: Optional[str]


class BackgroundTaskService:
    """
    Service for managing background tasks in the CL system.
    
    Handles automated price updates, position monitoring, data cleanup,
    and other maintenance tasks with proper scheduling and error handling.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the background task service.
        
        Args:
            db_path (Optional[str]): Path to SQLite database file
        """
        self.db_path = db_path
        self.scheduler = None
        self.scheduler_running = False
        
        # Task execution tracking
        self._task_executions = []
        self._execution_lock = Lock()
        self._task_counter = 0
        
        # Service instances
        self.price_updater = PriceUpdateService(db_path)
        self.position_monitor = PositionMonitorService(db_path)
        self.position_model = CLPosition(db_path)
        
        # Load configuration
        try:
            from backend.local_config import PRICE_UPDATE_INTERVAL, DATA_RETENTION
            self.update_interval = PRICE_UPDATE_INTERVAL
            self.data_retention = DATA_RETENTION
        except ImportError:
            self.update_interval = 1800  # 30 minutes
            self.data_retention = {
                'price_history_days': 90,
                'fee_history_days': 365,
                'closed_position_days': 730
            }
        
        # Initialize scheduler if available
        if SCHEDULER_AVAILABLE:
            self._init_scheduler()
        else:
            logger.warning("Background tasks disabled - APScheduler not available")
        
        logger.info("Background Task Service initialized")
    
    def _init_scheduler(self):
        """Initialize the APScheduler."""
        try:
            self.scheduler = BackgroundScheduler()
            
            # Add event listeners
            self.scheduler.add_listener(
                self._job_executed_listener, 
                EVENT_JOB_EXECUTED | EVENT_JOB_ERROR
            )
            
            logger.info("APScheduler initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize scheduler: {str(e)}")
            self.scheduler = None
    
    def _job_executed_listener(self, event):
        """Handle job execution events."""
        try:
            job_id = event.job_id
            
            if event.exception:
                logger.error(f"Job {job_id} failed: {event.exception}")
            else:
                logger.debug(f"Job {job_id} completed successfully")
                
        except Exception as e:
            logger.error(f"Error in job event listener: {str(e)}")
    
    def _generate_task_id(self) -> str:
        """Generate a unique task execution ID."""
        self._task_counter += 1
        return f"task_{int(datetime.utcnow().timestamp())}_{self._task_counter}"
    
    def _record_task_execution(
        self, 
        task_name: str, 
        status: TaskStatus,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> str:
        """
        Record a task execution.
        
        Args:
            task_name (str): Name of the task
            status (TaskStatus): Task status
            result (Optional[Dict[str, Any]]): Task result
            error (Optional[str]): Error message if failed
            start_time (Optional[datetime]): Task start time
            end_time (Optional[datetime]): Task end time
            
        Returns:
            str: Task execution ID
        """
        with self._execution_lock:
            task_id = self._generate_task_id()
            
            if start_time and end_time:
                duration = (end_time - start_time).total_seconds()
            else:
                duration = None
            
            execution = TaskExecution(
                task_id=task_id,
                task_name=task_name,
                status=status,
                start_time=start_time or datetime.utcnow(),
                end_time=end_time,
                duration=duration,
                result=result,
                error=error
            )
            
            self._task_executions.append(execution)
            
            # Keep only last 100 executions
            if len(self._task_executions) > 100:
                self._task_executions = self._task_executions[-100:]
            
            return task_id
    
    def _execute_task_with_tracking(self, task_name: str, task_func: Callable) -> Dict[str, Any]:
        """
        Execute a task with proper tracking and error handling.
        
        Args:
            task_name (str): Name of the task
            task_func (Callable): Task function to execute
            
        Returns:
            Dict[str, Any]: Task execution result
        """
        start_time = datetime.utcnow()
        task_id = None
        
        try:
            logger.info(f"Starting task: {task_name}")
            
            # Record task start
            task_id = self._record_task_execution(
                task_name=task_name,
                status=TaskStatus.RUNNING,
                start_time=start_time
            )
            
            # Execute task
            result = task_func()
            
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            # Record successful completion
            self._record_task_execution(
                task_name=task_name,
                status=TaskStatus.COMPLETED,
                result=result,
                start_time=start_time,
                end_time=end_time
            )
            
            logger.info(f"Task {task_name} completed successfully in {duration:.2f}s")
            
            return {
                'success': True,
                'task_id': task_id,
                'duration': duration,
                'result': result
            }
            
        except Exception as e:
            end_time = datetime.utcnow()
            error_msg = str(e)
            
            # Record failure
            self._record_task_execution(
                task_name=task_name,
                status=TaskStatus.FAILED,
                error=error_msg,
                start_time=start_time,
                end_time=end_time
            )
            
            logger.error(f"Task {task_name} failed: {error_msg}")
            
            return {
                'success': False,
                'task_id': task_id,
                'error': error_msg
            }
    
    def update_all_prices_task(self) -> Dict[str, Any]:
        """
        Background task to update all position prices.
        
        Returns:
            Dict[str, Any]: Update results
        """
        return self.price_updater.update_all_positions()
    
    def monitor_all_positions_task(self) -> Dict[str, Any]:
        """
        Background task to monitor all positions and generate alerts.
        
        Returns:
            Dict[str, Any]: Monitoring results
        """
        try:
            # Get active positions
            positions = self.position_model.get_all_positions()
            active_positions = [pos for pos in positions if pos.get('status') == 'active']
            
            if not active_positions:
                return {
                    'positions_monitored': 0,
                    'alerts_generated': 0,
                    'message': 'No active positions to monitor'
                }
            
            # Prepare position data with current prices
            positions_data = []
            for position in active_positions:
                # Get latest price from price history
                position_id = position.get('id')
                latest_price = self.price_updater.price_history_model.get_latest_price(position_id)
                
                if latest_price:
                    positions_data.append({
                        'position': position,
                        'current_price': latest_price.get('price', 0),
                        'price_data': {
                            'price_usd': latest_price.get('price', 0),
                            'volume_24h': latest_price.get('volume_24h', 0),
                            'liquidity_usd': latest_price.get('liquidity_usd', 0)
                        }
                    })
            
            # Monitor positions
            results = self.position_monitor.monitor_all_positions(positions_data)
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to monitor positions: {str(e)}")
            return {
                'error': str(e),
                'positions_monitored': 0,
                'alerts_generated': 0
            }
    
    def cleanup_old_data_task(self) -> Dict[str, Any]:
        """
        Background task to clean up old data.
        
        Returns:
            Dict[str, Any]: Cleanup results
        """
        try:
            results = {}
            
            # Clean up old price history
            price_days = self.data_retention.get('price_history_days', 90)
            price_deleted = self.price_updater.cleanup_old_price_data(price_days)
            results['price_history_deleted'] = price_deleted
            
            # Clean up old alerts
            alert_deleted = self.position_monitor.clear_old_alerts(hours=168)  # 1 week
            results['alerts_deleted'] = alert_deleted
            
            # Clean up old task executions
            with self._execution_lock:
                initial_count = len(self._task_executions)
                cutoff = datetime.utcnow() - timedelta(days=7)
                self._task_executions = [
                    exec for exec in self._task_executions 
                    if exec.start_time > cutoff
                ]
                executions_deleted = initial_count - len(self._task_executions)
                results['task_executions_deleted'] = executions_deleted
            
            logger.info(f"Data cleanup completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to cleanup old data: {str(e)}")
            return {'error': str(e)}
    
    def start_scheduler(self) -> bool:
        """
        Start the background scheduler with all tasks.
        
        Returns:
            bool: True if started successfully, False otherwise
        """
        if not SCHEDULER_AVAILABLE or not self.scheduler:
            logger.error("Cannot start scheduler - APScheduler not available")
            return False
        
        try:
            if self.scheduler_running:
                logger.warning("Scheduler is already running")
                return True
            
            # Add price update task
            self.scheduler.add_job(
                func=lambda: self._execute_task_with_tracking(
                    "price_update", 
                    self.update_all_prices_task
                ),
                trigger=IntervalTrigger(seconds=self.update_interval),
                id='price_update_task',
                name='Update All Prices',
                replace_existing=True
            )
            
            # Add position monitoring task (every hour)
            self.scheduler.add_job(
                func=lambda: self._execute_task_with_tracking(
                    "position_monitoring", 
                    self.monitor_all_positions_task
                ),
                trigger=IntervalTrigger(hours=1),
                id='position_monitoring_task',
                name='Monitor All Positions',
                replace_existing=True
            )
            
            # Add data cleanup task (daily at 2 AM)
            self.scheduler.add_job(
                func=lambda: self._execute_task_with_tracking(
                    "data_cleanup", 
                    self.cleanup_old_data_task
                ),
                trigger=CronTrigger(hour=2, minute=0),
                id='data_cleanup_task',
                name='Clean Up Old Data',
                replace_existing=True
            )
            
            # Start the scheduler
            self.scheduler.start()
            self.scheduler_running = True
            
            logger.info("Background scheduler started successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start scheduler: {str(e)}")
            return False
    
    def stop_scheduler(self) -> bool:
        """
        Stop the background scheduler.
        
        Returns:
            bool: True if stopped successfully, False otherwise
        """
        if not self.scheduler or not self.scheduler_running:
            logger.warning("Scheduler is not running")
            return True
        
        try:
            self.scheduler.shutdown(wait=True)
            self.scheduler_running = False
            
            logger.info("Background scheduler stopped successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to stop scheduler: {str(e)}")
            return False
    
    def execute_task_now(self, task_name: str) -> Dict[str, Any]:
        """
        Execute a specific task immediately.
        
        Args:
            task_name (str): Name of the task to execute
            
        Returns:
            Dict[str, Any]: Task execution result
        """
        task_functions = {
            'price_update': self.update_all_prices_task,
            'position_monitoring': self.monitor_all_positions_task,
            'data_cleanup': self.cleanup_old_data_task
        }
        
        if task_name not in task_functions:
            return {
                'success': False,
                'error': f'Unknown task: {task_name}',
                'available_tasks': list(task_functions.keys())
            }
        
        return self._execute_task_with_tracking(task_name, task_functions[task_name])
    
    def get_scheduled_jobs(self) -> List[Dict[str, Any]]:
        """
        Get information about scheduled jobs.
        
        Returns:
            List[Dict[str, Any]]: List of scheduled jobs
        """
        if not self.scheduler or not self.scheduler_running:
            return []
        
        try:
            jobs = []
            for job in self.scheduler.get_jobs():
                jobs.append({
                    'id': job.id,
                    'name': job.name,
                    'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                    'trigger': str(job.trigger),
                    'func': job.func.__name__ if hasattr(job.func, '__name__') else str(job.func)
                })
            
            return jobs
            
        except Exception as e:
            logger.error(f"Failed to get scheduled jobs: {str(e)}")
            return []
    
    def get_task_executions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get recent task executions.
        
        Args:
            limit (int): Maximum number of executions to return
            
        Returns:
            List[Dict[str, Any]]: List of task executions
        """
        with self._execution_lock:
            # Sort by start time (most recent first)
            sorted_executions = sorted(
                self._task_executions, 
                key=lambda x: x.start_time, 
                reverse=True
            )
            
            # Convert to dict format and limit results
            return [
                {
                    'task_id': exec.task_id,
                    'task_name': exec.task_name,
                    'status': exec.status.value,
                    'start_time': exec.start_time.isoformat(),
                    'end_time': exec.end_time.isoformat() if exec.end_time else None,
                    'duration': exec.duration,
                    'result': exec.result,
                    'error': exec.error
                }
                for exec in sorted_executions[:limit]
            ]
    
    def get_service_status(self) -> Dict[str, Any]:
        """
        Get the status of the background task service.
        
        Returns:
            Dict[str, Any]: Service status information
        """
        try:
            # Get recent executions summary
            with self._execution_lock:
                recent_executions = [
                    exec for exec in self._task_executions 
                    if exec.start_time > datetime.utcnow() - timedelta(hours=24)
                ]
                
                successful_tasks = len([exec for exec in recent_executions if exec.status == TaskStatus.COMPLETED])
                failed_tasks = len([exec for exec in recent_executions if exec.status == TaskStatus.FAILED])
            
            return {
                'scheduler_available': SCHEDULER_AVAILABLE,
                'scheduler_running': self.scheduler_running,
                'scheduled_jobs': len(self.get_scheduled_jobs()),
                'recent_executions_24h': len(recent_executions),
                'successful_tasks_24h': successful_tasks,
                'failed_tasks_24h': failed_tasks,
                'update_interval': self.update_interval,
                'data_retention': self.data_retention,
                'service_uptime': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get service status: {str(e)}")
            return {
                'error': str(e),
                'scheduler_available': SCHEDULER_AVAILABLE,
                'scheduler_running': False
            }
    
    def restart_scheduler(self) -> Dict[str, Any]:
        """
        Restart the background scheduler.
        
        Returns:
            Dict[str, Any]: Restart result
        """
        try:
            # Stop scheduler if running
            if self.scheduler_running:
                stop_success = self.stop_scheduler()
                if not stop_success:
                    return {
                        'success': False,
                        'error': 'Failed to stop scheduler'
                    }
            
            # Wait a moment
            time.sleep(1)
            
            # Start scheduler
            start_success = self.start_scheduler()
            
            return {
                'success': start_success,
                'message': 'Scheduler restarted successfully' if start_success else 'Failed to restart scheduler'
            }
            
        except Exception as e:
            logger.error(f"Failed to restart scheduler: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def __del__(self):
        """Cleanup when service is destroyed."""
        try:
            if self.scheduler_running:
                self.stop_scheduler()
        except:
            pass  # Ignore errors during cleanup