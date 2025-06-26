"""
Test the enhanced accountability system with explicit position assessment requirements.
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

def test_enhanced_accountability():
    """Test the enhanced accountability system"""
    
    print("🧪 Testing Enhanced Accountability System")
    print("=" * 60)
    
    try:
        # Import required services
        from app.chart_context import chart_context_manager
        from services.analysis_context_service import AnalysisContextService
        from services.prompt_builder_service import PromptBuilderService
        
        # Initialize context service with correct DB path
        context_service = AnalysisContextService(chart_context_manager.db_path)
        
        # Test parameters
        ticker = "HYPEUSD"
        current_timeframe = "1h"
        current_price = 37.50  # Simulate current price
        
        print(f"📊 Testing Enhanced Accountability for:")
        print(f"  Ticker: {ticker}")
        print(f"  Timeframe: {current_timeframe}")
        print(f"  Current Price: ${current_price}")
        
        # Step 1: Get historical context
        print(f"\n🔍 Step 1: Retrieving Historical Context")
        context = context_service.get_recent_analysis_context(ticker, current_timeframe, current_price)
        
        if context:
            print(f"  ✅ Context found:")
            print(f"    Hours ago: {context['hours_ago']:.2f}")
            print(f"    Context urgency: {context['context_urgency']}")
            print(f"    Previous action: {context['action']} at ${context.get('entry_price', 'N/A')}")
            print(f"    Previous target: ${context.get('target_price', 'N/A')}")
            print(f"    Previous stop: ${context.get('stop_loss', 'N/A')}")
        else:
            print(f"  ❌ No context found")
            return
        
        # Step 2: Build enhanced prompt
        print(f"\n🔨 Step 2: Building Enhanced Prompt")
        enhanced_prompt = PromptBuilderService.build_contextual_analysis_prompt(
            ticker=ticker,
            timeframe=current_timeframe,
            current_price=current_price,
            context=context,
            additional_context="Testing enhanced accountability system"
        )
        
        print(f"  ✅ Enhanced prompt built:")
        print(f"    Length: {len(enhanced_prompt)} characters")
        print(f"    Contains 'CRITICAL REQUIREMENT': {'CRITICAL REQUIREMENT' in enhanced_prompt}")
        print(f"    Contains 'EXISTING POSITION': {'EXISTING POSITION' in enhanced_prompt}")
        print(f"    Contains 'MAINTAIN': {'MAINTAIN' in enhanced_prompt}")
        print(f"    Contains 'MODIFY': {'MODIFY' in enhanced_prompt}")
        print(f"    Contains 'CLOSE': {'CLOSE' in enhanced_prompt}")
        print(f"    Contains 'NEW POSITION': {'NEW POSITION' in enhanced_prompt}")
        
        # Step 3: Show key sections of the prompt
        print(f"\n📝 Step 3: Key Prompt Sections")
        
        # Extract the context section
        if "🚨 CRITICAL REQUIREMENT" in enhanced_prompt:
            context_start = enhanced_prompt.find("🚨 CRITICAL REQUIREMENT")
            context_end = enhanced_prompt.find("CRITICAL FORWARD-LOOKING", context_start)
            if context_end == -1:
                context_end = len(enhanced_prompt)
            
            context_section = enhanced_prompt[context_start:context_end].strip()
            print(f"  Context Assessment Section:")
            print(f"    {context_section[:200]}...")
        
        # Step 4: Verify requirements
        print(f"\n✅ Step 4: Accountability Requirements Verification")
        
        required_elements = [
            ("Position Assessment Options", "MAINTAIN EXISTING POSITION" in enhanced_prompt),
            ("Modification Option", "MODIFY EXISTING POSITION" in enhanced_prompt),
            ("Closure Option", "CLOSE EXISTING POSITION" in enhanced_prompt),
            ("New Position Requirements", "NEW POSITION (ONLY if fundamentally different)" in enhanced_prompt),
            ("Explicit Reference Requirement", "DO NOT ignore the existing position" in enhanced_prompt),
            ("Forward-Looking Validation", "FORWARD-LOOKING REQUIREMENTS" in enhanced_prompt),
            ("Current Price Validation", f"${current_price}" in enhanced_prompt)
        ]
        
        for requirement, present in required_elements:
            status = "✅" if present else "❌"
            print(f"    {status} {requirement}: {present}")
        
        # Step 5: Summary
        all_present = all(present for _, present in required_elements)
        print(f"\n🎯 Step 5: System Status")
        if all_present:
            print(f"  🎉 Enhanced Accountability System: FULLY OPERATIONAL")
            print(f"  📊 The AI will now be required to:")
            print(f"    - Explicitly address the existing {context['action']} position at ${context.get('entry_price', 'N/A')}")
            print(f"    - Choose from MAINTAIN/MODIFY/CLOSE/REPLACE options")
            print(f"    - Provide detailed reasoning for any changes")
            print(f"    - Include context_assessment in the JSON response")
        else:
            print(f"  ⚠️ Some requirements missing - system may not enforce accountability properly")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_enhanced_accountability()