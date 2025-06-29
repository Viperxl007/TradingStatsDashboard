"""
Test the actual AnalysisContextService to find where it's failing.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

def test_actual_context_service():
    """Test the actual context service"""
    
    print("🧪 Testing Actual AnalysisContextService")
    print("=" * 50)
    
    try:
        from services.analysis_context_service import AnalysisContextService
        
        # Initialize the service
        service = AnalysisContextService()
        
        # Test the exact call that was made
        ticker = "HYPEUSD"
        current_timeframe = "1h"
        current_price = 0.0
        
        print(f"📊 Testing with:")
        print(f"  Ticker: {ticker}")
        print(f"  Timeframe: {current_timeframe}")
        print(f"  Current Price: {current_price}")
        
        # Call the service
        print(f"\n🔍 Calling get_recent_analysis_context...")
        context = service.get_recent_analysis_context(ticker, current_timeframe, current_price)
        
        print(f"\n📊 Result:")
        if context:
            print(f"  ✅ Context found!")
            print(f"  Context keys: {list(context.keys())}")
            print(f"  Hours ago: {context.get('hours_ago', 'N/A')}")
            print(f"  Context urgency: {context.get('context_urgency', 'N/A')}")
            print(f"  Action: {context.get('action', 'N/A')}")
            print(f"  Entry price: {context.get('entry_price', 'N/A')}")
            print(f"  Target price: {context.get('target_price', 'N/A')}")
            print(f"  Stop loss: {context.get('stop_loss', 'N/A')}")
        else:
            print(f"  ❌ No context returned")
            
        # Also test the timeframe mapping
        print(f"\n🕐 Testing timeframe mapping:")
        for tf in ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W']:
            hours = service.get_contextual_timeframe_hours(tf)
            print(f"  {tf}: {hours} hours")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_actual_context_service()