#!/usr/bin/env python3
"""
Active Trade Database Migration Script

This script ensures the active trades database schema is properly set up
in the production database. It can be run safely multiple times.
"""

import os
import sys
import sqlite3
import logging
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.active_trade_service import ActiveTradeService
from app.chart_context import ChartContextManager

def setup_logging():
    """Set up logging for the migration script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('migration.log')
        ]
    )
    return logging.getLogger(__name__)

def check_database_integrity(db_path):
    """Check the integrity of the database."""
    logger = logging.getLogger(__name__)
    
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Check if active_trades table exists and has correct schema
            cursor.execute("""
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='active_trades'
            """)
            result = cursor.fetchone()
            
            if result:
                logger.info("✅ active_trades table exists")
                logger.info(f"Schema: {result[0]}")
            else:
                logger.warning("⚠️ active_trades table does not exist")
                return False
            
            # Check if trade_updates table exists
            cursor.execute("""
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='trade_updates'
            """)
            result = cursor.fetchone()
            
            if result:
                logger.info("✅ trade_updates table exists")
            else:
                logger.warning("⚠️ trade_updates table does not exist")
                return False
            
            # Check for any existing active trades
            cursor.execute("SELECT COUNT(*) FROM active_trades WHERE status IN ('waiting', 'active')")
            active_count = cursor.fetchone()[0]
            logger.info(f"📊 Found {active_count} active trades")
            
            # Check for historical trades
            cursor.execute("SELECT COUNT(*) FROM active_trades")
            total_count = cursor.fetchone()[0]
            logger.info(f"📊 Found {total_count} total trades in history")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Database integrity check failed: {str(e)}")
        return False

def migrate_database():
    """Run the database migration."""
    logger = setup_logging()
    logger.info("🚀 Starting Active Trade Database Migration")
    logger.info("=" * 60)
    
    # Determine database path
    instance_dir = os.path.join(os.path.dirname(__file__), 'instance')
    db_path = os.path.join(instance_dir, 'chart_analysis.db')
    
    logger.info(f"📁 Database path: {db_path}")
    
    # Ensure instance directory exists
    os.makedirs(instance_dir, exist_ok=True)
    
    # Check if database file exists
    if os.path.exists(db_path):
        logger.info("✅ Database file exists")
    else:
        logger.info("📝 Database file will be created")
    
    try:
        # Initialize the chart context manager (this creates the main tables)
        logger.info("🔧 Initializing chart context manager...")
        chart_manager = ChartContextManager(db_path)
        logger.info("✅ Chart context manager initialized")
        
        # Initialize the active trade service (this creates the active trade tables)
        logger.info("🔧 Initializing active trade service...")
        trade_service = ActiveTradeService(db_path)
        logger.info("✅ Active trade service initialized")
        
        # Check database integrity
        logger.info("🔍 Checking database integrity...")
        if check_database_integrity(db_path):
            logger.info("✅ Database integrity check passed")
        else:
            logger.error("❌ Database integrity check failed")
            return False
        
        # Test basic functionality
        logger.info("🧪 Testing basic functionality...")
        
        # Test getting active trade for a test ticker
        active_trade = trade_service.get_active_trade("TEST")
        logger.info(f"✅ Active trade query successful: {active_trade is not None}")
        
        # Test getting trade history for a test ticker
        history = trade_service.get_trade_history("TEST", limit=1)
        logger.info(f"✅ Trade history query successful: {len(history)} historical trades")
        
        logger.info("🎉 Migration completed successfully!")
        logger.info("=" * 60)
        logger.info("📋 Summary:")
        logger.info("- Active trade tables created/verified")
        logger.info("- Database integrity confirmed")
        logger.info("- Basic functionality tested")
        logger.info("- System ready for active trade tracking")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        logger.error("Please check the error details above and try again")
        return False

if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)