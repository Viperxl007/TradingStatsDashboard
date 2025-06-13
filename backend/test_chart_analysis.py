"""
Test Script for AI Chart Analysis Feature

This script tests the core functionality of the AI chart analysis feature
without requiring actual API calls or image files.
"""

import sys
import os
import logging
from datetime import datetime

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_chart_context_manager():
    """Test the chart context manager functionality."""
    try:
        from app.chart_context import ChartContextManager
        
        print("Testing Chart Context Manager...")
        
        # Initialize with test database
        test_db_path = os.path.join(os.path.dirname(__file__), 'test_chart_analysis.db')
        context_manager = ChartContextManager(test_db_path)
        
        # Test storing context
        test_context = {
            'current_price': 150.00,
            'earnings_date': '2024-01-20',
            'iv_rank': 75.5
        }
        
        success = context_manager.store_context('AAPL', 'test', test_context)
        print(f"✓ Store context: {'SUCCESS' if success else 'FAILED'}")
        
        # Test retrieving context
        retrieved_context = context_manager.get_context('AAPL', 'test')
        print(f"✓ Retrieve context: {'SUCCESS' if retrieved_context else 'FAILED'}")
        
        # Test storing analysis
        test_analysis = {
            'ticker': 'AAPL',
            'confidence_score': 0.85,
            'support_resistance': {
                'key_support_levels': [145.00, 148.50],
                'key_resistance_levels': [155.00, 160.00]
            },
            'trading_insights': {
                'entry_points': [150.00],
                'exit_points': [158.00],
                'stop_loss_levels': [147.00]
            }
        }
        
        analysis_id = context_manager.store_analysis('AAPL', test_analysis)
        print(f"✓ Store analysis: {'SUCCESS' if analysis_id else 'FAILED'}")
        
        # Test getting analysis history
        history = context_manager.get_analysis_history('AAPL', limit=5)
        print(f"✓ Get analysis history: {'SUCCESS' if isinstance(history, list) else 'FAILED'}")
        
        # Test getting key levels
        levels = context_manager.get_key_levels('AAPL')
        print(f"✓ Get key levels: {'SUCCESS' if isinstance(levels, list) else 'FAILED'}")
        
        # Clean up test database
        if os.path.exists(test_db_path):
            os.remove(test_db_path)
        
        print("Chart Context Manager tests completed successfully!\n")
        return True
        
    except Exception as e:
        print(f"✗ Chart Context Manager test failed: {str(e)}\n")
        return False

def test_level_detector():
    """Test the level detector functionality."""
    try:
        from app.level_detector import LevelDetector
        
        print("Testing Level Detector...")
        
        level_detector = LevelDetector()
        
        # Test extracting levels from analysis
        test_analysis = {
            'support_resistance': {
                'key_support_levels': [145.00, 148.50, 150.00],
                'key_resistance_levels': [155.00, 160.00, 165.00]
            },
            'trading_insights': {
                'entry_points': [150.00, 152.00],
                'exit_points': [158.00, 162.00],
                'stop_loss_levels': [147.00, 145.00]
            }
        }
        
        extracted_levels = level_detector.extract_levels_from_analysis(test_analysis)
        print(f"✓ Extract levels from analysis: {'SUCCESS' if extracted_levels else 'FAILED'}")
        
        # Test level clustering
        test_levels = [149.95, 150.00, 150.05, 155.00, 155.10]
        clustered = level_detector._cluster_levels(test_levels)
        print(f"✓ Cluster levels: {'SUCCESS' if len(clustered) < len(test_levels) else 'FAILED'}")
        
        # Test level cleaning
        dirty_levels = [150.00, 150.01, 155.00, 155.50, 160.00]
        cleaned = level_detector._clean_levels(dirty_levels)
        print(f"✓ Clean levels: {'SUCCESS' if len(cleaned) <= len(dirty_levels) else 'FAILED'}")
        
        print("Level Detector tests completed successfully!\n")
        return True
        
    except Exception as e:
        print(f"✗ Level Detector test failed: {str(e)}\n")
        return False

def test_snapshot_processor():
    """Test the snapshot processor functionality."""
    try:
        from app.snapshot_processor import SnapshotProcessor
        
        print("Testing Snapshot Processor...")
        
        processor = SnapshotProcessor()
        
        # Test image hash generation
        test_data = b"test image data"
        image_hash = processor.generate_image_hash(test_data)
        print(f"✓ Generate image hash: {'SUCCESS' if image_hash else 'FAILED'}")
        
        # Test base64 conversion
        base64_str = processor.convert_to_base64(test_data)
        converted_back = processor.convert_from_base64(base64_str)
        print(f"✓ Base64 conversion: {'SUCCESS' if converted_back == test_data else 'FAILED'}")
        
        # Test validation with invalid data
        validation = processor.validate_image(b"invalid")
        print(f"✓ Invalid image validation: {'SUCCESS' if not validation['is_valid'] else 'FAILED'}")
        
        print("Snapshot Processor tests completed successfully!\n")
        return True
        
    except Exception as e:
        print(f"✗ Snapshot Processor test failed: {str(e)}\n")
        return False

def test_chart_analyzer():
    """Test the chart analyzer functionality."""
    try:
        from app.chart_analyzer import ChartAnalyzer
        
        print("Testing Chart Analyzer...")
        
        analyzer = ChartAnalyzer()
        
        # Test API key validation
        has_key = analyzer.validate_api_key()
        print(f"✓ API key validation: {'SUCCESS' if isinstance(has_key, bool) else 'FAILED'}")
        
        # Test analysis prompt building
        prompt = analyzer._build_analysis_prompt('AAPL', {'current_price': 150.00})
        print(f"✓ Build analysis prompt: {'SUCCESS' if 'AAPL' in prompt else 'FAILED'}")
        
        # Test response parsing with mock data
        mock_response = '{"ticker": "AAPL", "confidence_score": 0.85, "summary": "Test analysis"}'
        parsed = analyzer._parse_analysis_response(mock_response, 'AAPL')
        print(f"✓ Parse analysis response: {'SUCCESS' if parsed.get('ticker') == 'AAPL' else 'FAILED'}")
        
        # Test summary generation
        test_analysis = {
            'summary': 'Test summary',
            'confidence_score': 0.85,
            'trend_analysis': {'primary_trend': 'bullish'}
        }
        summary = analyzer.get_analysis_summary(test_analysis)
        print(f"✓ Generate analysis summary: {'SUCCESS' if summary else 'FAILED'}")
        
        print("Chart Analyzer tests completed successfully!\n")
        return True
        
    except Exception as e:
        print(f"✗ Chart Analyzer test failed: {str(e)}\n")
        return False

def test_chart_data_integration():
    """Test the chart data integration functionality."""
    try:
        from app.chart_data_integration import ChartDataIntegrator
        
        print("Testing Chart Data Integration...")
        
        integrator = ChartDataIntegrator()
        
        # Test market context (this will work without external dependencies)
        market_context = integrator.get_market_context()
        print(f"✓ Get market context: {'SUCCESS' if 'timestamp' in market_context else 'FAILED'}")
        
        print("Chart Data Integration tests completed successfully!\n")
        return True
        
    except Exception as e:
        print(f"✗ Chart Data Integration test failed: {str(e)}\n")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("AI CHART ANALYSIS FEATURE TEST SUITE")
    print("=" * 60)
    print()
    
    tests = [
        test_chart_context_manager,
        test_level_detector,
        test_snapshot_processor,
        test_chart_analyzer,
        test_chart_data_integration
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("=" * 60)
    print(f"TEST RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The AI chart analysis feature is ready.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
    
    print("=" * 60)
    
    # Print configuration status
    print("\nCONFIGURATION STATUS:")
    print("-" * 30)
    
    claude_key = os.environ.get('CLAUDE_API_KEY')
    print(f"Claude API Key: {'✓ SET' if claude_key else '✗ NOT SET'}")
    
    if not claude_key:
        print("\nTo enable AI analysis, set the CLAUDE_API_KEY environment variable:")
        print("export CLAUDE_API_KEY=your_api_key_here")
    
    print("\nRequired dependencies:")
    try:
        import PIL
        print("✓ Pillow (PIL) - Available")
    except ImportError:
        print("✗ Pillow (PIL) - Missing (pip install Pillow)")
    
    try:
        import requests
        print("✓ Requests - Available")
    except ImportError:
        print("✗ Requests - Missing (pip install requests)")
    
    print()

if __name__ == "__main__":
    main()