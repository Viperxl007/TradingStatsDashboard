#!/usr/bin/env python3
"""
Test script to verify legacy trade migration worked correctly.
"""

import os
import sys

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.active_trade_service import ActiveTradeService
from services.analysis_context_service import AnalysisContextService

def test_legacy_migration():
    """Test that legacy trades were migrated correctly."""
    print("🔍 Testing Legacy Trade Migration Results")
    print("=" * 50)
    
    # Initialize services
    db_path = os.path.join('instance', 'chart_analysis.db')
    trade_service = ActiveTradeService(db_path)
    context_service = AnalysisContextService(db_path)
    
    # Test HYPEUSD active trade
    print("🎯 Checking HYPEUSD active trade...")
    active_trade = trade_service.get_active_trade('HYPEUSD')
    if active_trade:
        print(f"✅ Found active trade: {active_trade['action']} at ${active_trade['entry_price']} (status: {active_trade['status']})")
        print(f"   Current P&L: ${active_trade.get('unrealized_pnl', 0):.2f}")
        print(f"   Target: ${active_trade.get('target_price', 'N/A')}")
        print(f"   Stop: ${active_trade.get('stop_loss', 'N/A')}")
    else:
        print("❌ No active trade found")
        return False
    
    # Test comprehensive context
    print("\n🔍 Testing comprehensive context...")
    context = context_service.get_comprehensive_context('HYPEUSD', '1h', 36.39)
    if context and context.get('context_type') == 'active_trade':
        print(f"✅ Active trade context detected: {context['status']}")
        print(f"   Trade message: {context['trade_message']}")
    else:
        print("❌ No active trade context found")
        return False
    
    # Test all active trades
    print("\n📊 Checking all migrated trades...")
    import sqlite3
    with sqlite3.connect(trade_service.db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT ticker, action, entry_price, status, unrealized_pnl
            FROM active_trades
            WHERE status IN ('waiting', 'active')
            ORDER BY ticker
        ''')
        trades = cursor.fetchall()
        
        print(f"Found {len(trades)} active trades:")
        for trade in trades:
            ticker, action, entry_price, status, pnl = trade
            pnl_str = f"${pnl:+.2f}" if pnl else "N/A"
            print(f"  - {ticker}: {action} at ${entry_price} ({status}) P&L: {pnl_str}")
    
    print("\n🎉 Legacy migration verification completed successfully!")
    return True

if __name__ == "__main__":
    success = test_legacy_migration()
    sys.exit(0 if success else 1)