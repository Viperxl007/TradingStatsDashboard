#!/usr/bin/env python3
"""
Test Referential Integrity Protection

This script tests the new referential integrity protection system to ensure
that chart analyses with active trades cannot be deleted.
"""

import sqlite3
import json
import logging
from datetime import datetime, timedelta
import os
import sys

# Add the backend directory to the path so we can import services
sys.path.append(os.path.dirname(__file__))

from services.active_trade_service import ActiveTradeService
from app.chart_context import ChartContextManager

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_analysis(db_path: str) -> int:
    """Create a test chart analysis and return its ID."""
    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            test_analysis = {
                'recommendations': {
                    'entryPrice': 100.0,
                    'targetPrice': 110.0,
                    'stopLoss': 95.0,
                    'action': 'buy'
                },
                'analysis': 'Test analysis for referential integrity'
            }
            
            cursor.execute('''
                INSERT INTO chart_analyses (
                    ticker, analysis_data, context_data,
                    analysis_timestamp, created_at
                ) VALUES (?, ?, ?, ?, ?)
            ''', (
                'TESTCOIN',
                json.dumps(test_analysis),
                json.dumps({'test': 'context'}),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            
            analysis_id = cursor.lastrowid
            conn.commit()
            
            logger.info(f"Created test analysis with ID: {analysis_id}")
            return analysis_id
            
    except Exception as e:
        logger.error(f"Error creating test analysis: {str(e)}")
        return None

def test_referential_integrity_protection():
    """Test the complete referential integrity protection system."""
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found: {db_path}")
        return False
    
    logger.info("Starting referential integrity protection test")
    
    # Initialize services
    active_trade_service = ActiveTradeService(db_path)
    chart_context_service = ChartContextManager(db_path)
    
    try:
        # Step 1: Create a test analysis
        analysis_id = create_test_analysis(db_path)
        if not analysis_id:
            logger.error("Failed to create test analysis")
            return False
        
        # Step 2: Create an active trade referencing this analysis
        logger.info("Creating active trade referencing the test analysis")
        trade_created = active_trade_service.create_trade_from_analysis(
            ticker='TESTCOIN',
            timeframe='1h',
            analysis_id=analysis_id,
            analysis_data={
                'recommendations': {
                    'entryPrice': 100.0,
                    'targetPrice': 110.0,
                    'stopLoss': 95.0,
                    'action': 'buy'
                }
            },
            context={'test': 'context'}
        )
        
        if not trade_created:
            logger.error("Failed to create test trade")
            return False
        
        logger.info("✅ Test trade created successfully")
        
        # Step 3: Test single analysis deletion protection
        logger.info("Testing single analysis deletion protection...")
        deletion_result = chart_context_service.delete_analysis(analysis_id)
        
        if deletion_result:
            logger.error("❌ FAILED: Analysis was deleted despite having active trade!")
            return False
        else:
            logger.info("✅ SUCCESS: Analysis deletion was properly blocked")
        
        # Step 4: Test bulk deletion protection
        logger.info("Testing bulk deletion protection...")
        deleted_count = chart_context_service.delete_analyses_bulk([analysis_id])
        
        if deleted_count > 0:
            logger.error("❌ FAILED: Analysis was deleted in bulk despite having active trade!")
            return False
        else:
            logger.info("✅ SUCCESS: Bulk deletion was properly blocked")
        
        # Step 5: Test cleanup protection
        logger.info("Testing cleanup protection...")
        # Make the analysis appear old by updating its created_at
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            old_date = datetime.now() - timedelta(days=100)
            cursor.execute('''
                UPDATE chart_analyses 
                SET created_at = ? 
                WHERE id = ?
            ''', (old_date.isoformat(), analysis_id))
            conn.commit()
        
        # Try cleanup - should protect the analysis
        chart_context_service.cleanup_old_data(days_to_keep=30)
        
        # Check if analysis still exists
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM chart_analyses WHERE id = ?', (analysis_id,))
            still_exists = cursor.fetchone() is not None
        
        if not still_exists:
            logger.error("❌ FAILED: Analysis was deleted during cleanup despite having active trade!")
            return False
        else:
            logger.info("✅ SUCCESS: Analysis was protected during cleanup")
        
        # Step 6: Close the trade and verify deletion now works
        logger.info("Closing the test trade...")
        trade_closed = active_trade_service.close_trade_by_user('TESTCOIN', 105.0, "Test completion")
        
        if not trade_closed:
            logger.error("Failed to close test trade")
            return False
        
        logger.info("✅ Test trade closed successfully")
        
        # Step 7: Verify deletion now works
        logger.info("Testing deletion after trade closure...")
        deletion_result = chart_context_service.delete_analysis(analysis_id)
        
        if not deletion_result:
            logger.error("❌ FAILED: Analysis deletion failed even after trade was closed!")
            return False
        else:
            logger.info("✅ SUCCESS: Analysis deletion worked after trade closure")
        
        logger.info("🎉 ALL TESTS PASSED - Referential integrity protection is working correctly!")
        return True
        
    except Exception as e:
        logger.error(f"Test failed with exception: {str(e)}")
        return False
    
    finally:
        # Cleanup: Try to remove test data
        try:
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM active_trades WHERE ticker = ?', ('TESTCOIN',))
                cursor.execute('DELETE FROM chart_analyses WHERE ticker = ?', ('TESTCOIN',))
                conn.commit()
                logger.info("Test cleanup completed")
        except Exception as e:
            logger.warning(f"Cleanup failed: {str(e)}")

def main():
    """Run the referential integrity test."""
    success = test_referential_integrity_protection()
    
    if success:
        print("\n🎉 REFERENTIAL INTEGRITY PROTECTION TEST PASSED!")
        print("The system properly prevents deletion of analyses with active trades.")
        sys.exit(0)
    else:
        print("\n❌ REFERENTIAL INTEGRITY PROTECTION TEST FAILED!")
        print("There are issues with the protection system.")
        sys.exit(1)

if __name__ == '__main__':
    main()