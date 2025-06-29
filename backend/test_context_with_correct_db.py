"""
Test the context service with the correct database path.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

def test_context_with_correct_db():
    """Test context service with the same DB path as chart_context_manager"""
    
    print("🧪 Testing AnalysisContextService with Correct Database Path")
    print("=" * 60)
    
    try:
        # Import the chart context manager to get the correct DB path
        from app.chart_context import chart_context_manager
        from services.analysis_context_service import AnalysisContextService
        
        print(f"📊 Chart context manager DB path: {chart_context_manager.db_path}")
        
        # Initialize context service with the same DB path
        context_service = AnalysisContextService(chart_context_manager.db_path)
        
        # Test the exact call that was made
        ticker = "HYPEUSD"
        current_timeframe = "1h"
        current_price = 0.0
        
        print(f"\n📊 Testing with:")
        print(f"  Ticker: {ticker}")
        print(f"  Timeframe: {current_timeframe}")
        print(f"  Current Price: {current_price}")
        print(f"  Database Path: {context_service.db_path}")
        
        # Call the service
        print(f"\n🔍 Calling get_recent_analysis_context...")
        context = context_service.get_recent_analysis_context(ticker, current_timeframe, current_price)
        
        print(f"\n📊 Result:")
        if context:
            print(f"  ✅ Context found!")
            print(f"  Hours ago: {context.get('hours_ago', 'N/A'):.2f}")
            print(f"  Context urgency: {context.get('context_urgency', 'N/A')}")
            print(f"  Context message: {context.get('context_message', 'N/A')}")
            print(f"  Action: {context.get('action', 'N/A')}")
            print(f"  Entry price: ${context.get('entry_price', 'N/A')}")
            print(f"  Target price: ${context.get('target_price', 'N/A')}")
            print(f"  Stop loss: ${context.get('stop_loss', 'N/A')}")
            print(f"  Sentiment: {context.get('sentiment', 'N/A')}")
            print(f"  Confidence: {context.get('confidence', 'N/A')}")
            
            # Test what the prompt would look like
            print(f"\n🔨 Testing Prompt Builder:")
            sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
            from services.prompt_builder_service import PromptBuilderService
            
            prompt = PromptBuilderService.build_contextual_analysis_prompt(
                ticker=ticker,
                timeframe=current_timeframe,
                current_price=current_price,
                context=context
            )
            
            print(f"  Prompt length: {len(prompt)} characters")
            print(f"  Contains 'RECENT POSITION': {'RECENT POSITION' in prompt}")
            print(f"  Contains 'contrary action': {'contrary action' in prompt}")
            print(f"  Contains current price: {f'${current_price}' in prompt}")
            
        else:
            print(f"  ❌ No context returned")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_context_with_correct_db()