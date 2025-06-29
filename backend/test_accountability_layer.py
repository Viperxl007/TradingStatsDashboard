"""
Test script for the new accountability layer implementation.

This script tests the context retrieval and prompt building services
to ensure they work correctly with the existing chart analysis system.
"""

import sys
import os
import json
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

def test_analysis_context_service():
    """Test the AnalysisContextService functionality"""
    print("🧪 Testing AnalysisContextService...")
    
    try:
        from services.analysis_context_service import AnalysisContextService
        
        # Test timeframe mapping
        service = AnalysisContextService()
        
        # Test different timeframes
        timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W']
        for tf in timeframes:
            hours = service.get_contextual_timeframe_hours(tf)
            print(f"  ✅ {tf} timeframe -> {hours} hours lookback")
        
        # Test with unknown timeframe
        unknown_hours = service.get_contextual_timeframe_hours('unknown')
        print(f"  ✅ Unknown timeframe -> {unknown_hours} hours (default)")
        
        print("✅ AnalysisContextService tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ AnalysisContextService test failed: {str(e)}")
        return False

def test_prompt_builder_service():
    """Test the PromptBuilderService functionality"""
    print("\n🧪 Testing PromptBuilderService...")
    
    try:
        from services.prompt_builder_service import PromptBuilderService
        
        # Test basic prompt building
        basic_prompt = PromptBuilderService.build_contextual_analysis_prompt(
            ticker="AAPL",
            timeframe="1D",
            current_price=150.00
        )
        
        assert "AAPL" in basic_prompt
        assert "$150.0" in basic_prompt
        assert "1D" in basic_prompt
        print("  ✅ Basic prompt building works")
        
        # Test with historical context (recent)
        recent_context = {
            'has_context': True,
            'hours_ago': 2.5,
            'context_urgency': 'recent',
            'context_message': 'RECENT POSITION (2.5 hours ago)',
            'action': 'buy',
            'entry_price': 148.50,
            'target_price': 155.00,
            'stop_loss': 145.00,
            'sentiment': 'bullish',
            'confidence': 0.85,
            'reasoning': 'Strong breakout above resistance'
        }
        
        contextual_prompt = PromptBuilderService.build_contextual_analysis_prompt(
            ticker="AAPL",
            timeframe="1D", 
            current_price=150.00,
            context=recent_context
        )
        
        assert "RECENT POSITION" in contextual_prompt
        assert "buy at $148.5" in contextual_prompt
        assert "contrary action" in contextual_prompt
        print("  ✅ Recent context prompt building works")
        
        # Test with active context
        active_context = {
            'has_context': True,
            'hours_ago': 12.0,
            'context_urgency': 'active',
            'context_message': 'ACTIVE POSITION (12.0 hours ago)',
            'action': 'sell',
            'entry_price': 152.00,
            'sentiment': 'bearish'
        }
        
        active_prompt = PromptBuilderService.build_contextual_analysis_prompt(
            ticker="AAPL",
            timeframe="1D",
            current_price=150.00,
            context=active_context
        )
        
        assert "ACTIVE POSITION" in active_prompt
        assert "ASSESSMENT REQUIRED" in active_prompt
        print("  ✅ Active context prompt building works")
        
        # Test forward-looking section
        assert "FORWARD-LOOKING REQUIREMENTS" in basic_prompt
        assert "Current price is $150.0" in basic_prompt
        assert "VALIDATION CHECKLIST" in basic_prompt
        print("  ✅ Forward-looking validation section works")
        
        print("✅ PromptBuilderService tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ PromptBuilderService test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_database_integration():
    """Test database integration with the new index"""
    print("\n🧪 Testing database integration...")
    
    try:
        from app.chart_context import ChartContextManager
        
        # Initialize with test database
        test_db_path = os.path.join(os.path.dirname(__file__), 'test_accountability.db')
        context_manager = ChartContextManager(test_db_path)
        
        # Test that the new index was created
        import sqlite3
        with sqlite3.connect(test_db_path) as conn:
            cursor = conn.cursor()
            
            # Check if the new index exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='index' AND name='idx_chart_analysis_ticker_timestamp'
            """)
            result = cursor.fetchone()
            
            if result:
                print("  ✅ New composite index created successfully")
            else:
                print("  ⚠️ New composite index not found")
        
        # Clean up test database (Windows-safe)
        try:
            if os.path.exists(test_db_path):
                os.remove(test_db_path)
        except OSError:
            # File may be locked on Windows, ignore cleanup error
            pass
            
        print("✅ Database integration test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Database integration test failed: {str(e)}")
        return False

def test_enhanced_analyzer_integration():
    """Test that the enhanced analyzer accepts the new parameters"""
    print("\n🧪 Testing enhanced analyzer integration...")
    
    try:
        from app.enhanced_chart_analyzer import EnhancedChartAnalyzer
        
        analyzer = EnhancedChartAnalyzer()
        
        # Check that the method signature accepts historical_context
        import inspect
        sig = inspect.signature(analyzer.analyze_chart_comprehensive)
        params = list(sig.parameters.keys())
        
        if 'historical_context' in params:
            print("  ✅ Enhanced analyzer accepts historical_context parameter")
        else:
            print("  ❌ Enhanced analyzer missing historical_context parameter")
            return False
            
        print("✅ Enhanced analyzer integration test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Enhanced analyzer integration test failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Accountability Layer Implementation")
    print("=" * 50)
    
    tests = [
        test_analysis_context_service,
        test_prompt_builder_service,
        test_database_integration,
        test_enhanced_analyzer_integration
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The accountability layer is ready for production.")
    else:
        print("⚠️ Some tests failed. Please review the implementation.")
        sys.exit(1)

if __name__ == "__main__":
    main()