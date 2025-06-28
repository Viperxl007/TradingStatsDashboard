#!/usr/bin/env python3
"""
Test script to verify the SOL context synchronization fix
"""

import sys
import os
import json
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

def test_sol_context_retrieval():
    """Test that SOLUSD context is properly retrieved"""
    print("🧪 Testing SOL Context Retrieval Fix")
    print("=" * 50)
    
    # First, delete the incomplete record (Analysis ID 130)
    print("🗑️ Deleting incomplete record (Analysis ID 130)...")
    try:
        from backend.services.database_service import DatabaseService
        db = DatabaseService()
        result = db.execute_query('DELETE FROM chart_analysis WHERE id = ?', (130,))
        print(f"✅ Deleted {result} record(s)")
        
        # Check what SOLUSD records remain
        print('\n📊 Remaining SOLUSD records:')
        records = db.fetch_all('SELECT id, timestamp, action, summary, confidence FROM chart_analysis WHERE ticker = ? ORDER BY timestamp DESC LIMIT 5', ('SOLUSD',))
        for record in records:
            print(f'   ID: {record[0]}, Time: {record[1]}, Action: {record[2]}, Confidence: {record[4]:.2f}')
            print(f'   Summary: {record[3][:100]}...')
            print()
    except Exception as e:
        print(f"❌ Error deleting record: {e}")
    
    print("=" * 50)
    
    try:
        from services.analysis_context_service import AnalysisContextService
        
        # Initialize the service
        db_path = backend_path / "instance" / "chart_analysis.db"
        context_service = AnalysisContextService(str(db_path))
        
        # Test parameters matching the SOL scenario
        ticker = "SOLUSD"
        timeframe = "1h"
        current_price = 146.86
        
        print(f"📊 Testing context retrieval for {ticker}")
        print(f"💰 Current Price: ${current_price}")
        print(f"⏰ Timeframe: {timeframe}")
        print()
        
        # Get comprehensive context
        context = context_service.get_comprehensive_context(ticker, timeframe, current_price)
        
        if context:
            print("✅ Context Retrieved Successfully!")
            print(f"📋 Context Type: {context.get('context_type', 'unknown')}")
            
            if context.get('context_type') == 'active_trade':
                print(f"🎯 Active Trade Status: {context.get('status', 'unknown')}")
                print(f"💵 Entry Price: ${context.get('entry_price', 'N/A')}")
                print(f"🎯 Target Price: ${context.get('target_price', 'N/A')}")
                print(f"🛡️ Stop Loss: ${context.get('stop_loss', 'N/A')}")
                
                if context.get('historical_context'):
                    hist = context['historical_context']
                    print(f"📚 Historical Context Found:")
                    print(f"   - Analysis ID: {hist.get('analysis_id', 'N/A')}")
                    print(f"   - Hours Ago: {hist.get('hours_ago', 'N/A'):.1f}h")
                    print(f"   - Action: {hist.get('action', 'N/A')}")
                    print(f"   - Summary: {hist.get('summary', 'N/A')[:100]}...")
                else:
                    print("⚠️ No historical context found for active trade")
                    
            elif context.get('context_type') == 'historical':
                print(f"📚 Historical Analysis Found:")
                print(f"   - Analysis ID: {context.get('analysis_id', 'N/A')}")
                print(f"   - Hours Ago: {context.get('hours_ago', 'N/A'):.1f}h")
                print(f"   - Action: {context.get('action', 'N/A')}")
                print(f"   - Summary: {context.get('summary', 'N/A')[:100]}...")
            
            print()
            print("🔍 Full Context Data:")
            print(json.dumps(context, indent=2, default=str))
            
        else:
            print("❌ No context found!")
            print("This indicates the issue is still present.")
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_sol_context_retrieval()