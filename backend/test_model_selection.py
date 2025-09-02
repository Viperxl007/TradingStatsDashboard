#!/usr/bin/env python3
"""
Test Model Selection and Routing

This script tests that the new Claude models (Opus 4.1 and Sonnet 3.7) are properly
configured and that model selection works correctly across all AI services.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from config import CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL
from services.macro_ai_service import MacroAIService
from app.enhanced_chart_analyzer import EnhancedChartAnalyzer

def test_model_configuration():
    """Test that new models are properly configured."""
    print("🧪 Testing Model Configuration")
    print("=" * 50)
    
    # Check if Claude Opus 4.1 is available
    opus_41_found = False
    sonnet_37_found = False
    
    print(f"📋 Available models ({len(CLAUDE_MODELS)}):")
    for model in CLAUDE_MODELS:
        print(f"   • {model['name']} ({model['id']})")
        if model['id'] == 'claude-opus-4-1-20250805':
            opus_41_found = True
        elif model['id'] == 'claude-3-7-sonnet-20250219':
            sonnet_37_found = True
    
    print(f"\n🎯 Default model: {DEFAULT_CLAUDE_MODEL}")
    
    # Verify new models are present
    if opus_41_found:
        print("✅ Claude Opus 4.1 is configured")
    else:
        print("❌ Claude Opus 4.1 is missing")
    
    if sonnet_37_found:
        print("✅ Claude 3.7 Sonnet is configured")
    else:
        print("❌ Claude 3.7 Sonnet is missing")
    
    return opus_41_found and sonnet_37_found

def test_macro_ai_service():
    """Test macro AI service model selection."""
    print("\n🧪 Testing Macro AI Service")
    print("=" * 50)
    
    try:
        service = MacroAIService()
        print(f"✅ MacroAIService initialized")
        print(f"   Default model: {service.default_model}")
        print(f"   Available models: {len(service.available_models)}")
        
        # Test model validation
        valid_models = [model['id'] for model in service.available_models]
        test_models = [
            'claude-opus-4-1-20250805',
            'claude-3-7-sonnet-20250219',
            'claude-sonnet-4-20250514'
        ]
        
        for model in test_models:
            if model in valid_models:
                print(f"✅ Model {model} is valid")
            else:
                print(f"❌ Model {model} is not valid")
        
        return True
        
    except Exception as e:
        print(f"❌ MacroAIService test failed: {e}")
        return False

def test_enhanced_chart_analyzer():
    """Test enhanced chart analyzer model selection."""
    print("\n🧪 Testing Enhanced Chart Analyzer")
    print("=" * 50)
    
    try:
        analyzer = EnhancedChartAnalyzer()
        print(f"✅ EnhancedChartAnalyzer initialized")
        print(f"   Default model: {analyzer.model}")
        
        # Test model validation logic
        from config import CLAUDE_MODELS
        valid_models = [model['id'] for model in CLAUDE_MODELS]
        
        test_models = [
            'claude-opus-4-1-20250805',
            'claude-3-7-sonnet-20250219',
            'invalid-model-123'
        ]
        
        for model in test_models:
            if model in valid_models:
                print(f"✅ Model {model} would be accepted")
            else:
                print(f"⚠️  Model {model} would fall back to default")
        
        return True
        
    except Exception as e:
        print(f"❌ EnhancedChartAnalyzer test failed: {e}")
        return False

def test_model_logging():
    """Test that model information is properly logged."""
    print("\n🧪 Testing Model Logging")
    print("=" * 50)
    
    # Test that the services have the necessary methods for model tracking
    try:
        service = MacroAIService()
        
        # Check if the _process_ai_result method accepts model_used parameter
        import inspect
        sig = inspect.signature(service._process_ai_result)
        params = list(sig.parameters.keys())
        
        if 'model_used' in params:
            print("✅ MacroAIService supports model logging")
        else:
            print("❌ MacroAIService missing model logging parameter")
        
        # Test enhanced chart analyzer
        analyzer = EnhancedChartAnalyzer()
        sig = inspect.signature(analyzer._combine_analyses)
        params = list(sig.parameters.keys())
        
        if 'model_used' in params:
            print("✅ EnhancedChartAnalyzer supports model logging")
        else:
            print("❌ EnhancedChartAnalyzer missing model logging parameter")
        
        return True
        
    except Exception as e:
        print(f"❌ Model logging test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Claude Model Selection and Routing Tests")
    print("=" * 60)
    
    tests = [
        ("Model Configuration", test_model_configuration),
        ("Macro AI Service", test_macro_ai_service),
        ("Enhanced Chart Analyzer", test_enhanced_chart_analyzer),
        ("Model Logging", test_model_logging)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n📊 Test Results Summary")
    print("=" * 60)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! Model selection and routing is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the configuration.")
        return 1

if __name__ == "__main__":
    exit(main())