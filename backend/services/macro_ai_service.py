"""
Macro Market Sentiment AI Analysis Service

This service handles AI-powered analysis of macro market conditions using
Claude API, following existing patterns from the enhanced chart analyzer.
"""

import asyncio
import logging
import time
import json
import base64
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import hashlib

# Windows-specific asyncio fix for aiodns compatibility
if sys.platform == 'win32':
    # aiodns requires SelectorEventLoop on Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

try:
    from .macro_chart_service import MacroChartService
    from ..models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase, TrendDirection, TradePermission, MarketRegime
except ImportError:
    # Fallback for when running from root directory
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from services.macro_chart_service import MacroChartService
    from models.macro_sentiment_models import get_macro_db, MacroSentimentDatabase, TrendDirection, TradePermission, MarketRegime

logger = logging.getLogger(__name__)


class MacroAIService:
    """
    AI analysis service for macro market sentiment.
    
    This service uses Claude API to analyze macro market charts and provide
    confidence scores, trend analysis, and trading recommendations.
    """
    
    def __init__(self, db: Optional[MacroSentimentDatabase] = None):
        """
        Initialize AI service.
        
        Args:
            db (Optional[MacroSentimentDatabase]): Database instance
        """
        self.db = db or get_macro_db()
        self.chart_service = MacroChartService(db)
        
        # Import Claude API configuration
        try:
            from config import CLAUDE_API_KEY, DEFAULT_CLAUDE_MODEL, CLAUDE_MODELS
            self.api_key = CLAUDE_API_KEY
            self.default_model = DEFAULT_CLAUDE_MODEL
            self.available_models = CLAUDE_MODELS
        except ImportError:
            logger.error("Claude API configuration not found")
            raise ValueError("Claude API not configured")
        
        if not self.api_key:
            raise ValueError("Claude API key not configured")
    
    async def analyze_macro_sentiment(self, model: Optional[str] = None, days: int = 90) -> Dict[str, Any]:
        """
        Perform comprehensive macro sentiment analysis.
        
        Args:
            model (Optional[str]): Claude model to use
            days (int): Days of data to analyze
            
        Returns:
            Dict[str, Any]: Analysis results
        """
        try:
            start_time = time.time()
            analysis_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            logger.info(f"Starting macro sentiment analysis with {days} days of data")
            
            # Step 1: Generate charts
            logger.debug("Generating macro charts for analysis")
            chart_data = self.chart_service.generate_macro_charts(days)
            
            # Step 2: Get market data summary
            chart_summary = self.chart_service.get_chart_summary(days)
            
            # Step 3: Prepare AI analysis request
            model_to_use = model or self.default_model
            
            # Step 4: Perform AI analysis
            logger.debug(f"Performing AI analysis with model: {model_to_use}")
            ai_result = await self._perform_claude_analysis(
                chart_data, chart_summary, model_to_use
            )
            
            # Step 5: Process and validate results
            processed_result = self._process_ai_result(ai_result, chart_data, analysis_timestamp, model_to_use)
            
            # Step 6: Store analysis in database
            analysis_id = self.db.insert_sentiment_analysis(processed_result)
            processed_result['analysis_id'] = analysis_id
            
            processing_time = int((time.time() - start_time) * 1000)
            processed_result['total_processing_time_ms'] = processing_time
            
            logger.info(f"Macro sentiment analysis completed in {processing_time}ms "
                       f"(confidence: {processed_result['overall_confidence']}%)")
            
            return processed_result
            
        except Exception as e:
            logger.error(f"Error in macro sentiment analysis: {e}")
            raise
    
    async def _perform_claude_analysis(self, chart_data: Dict[str, Any], 
                                     chart_summary: Dict[str, Any], 
                                     model: str) -> Dict[str, Any]:
        """
        Perform Claude API analysis of macro charts.
        
        Args:
            chart_data (Dict[str, Any]): Generated chart data
            chart_summary (Dict[str, Any]): Market data summary
            model (str): Claude model to use
            
        Returns:
            Dict[str, Any]: Raw AI analysis result
        """
        try:
            # Import Claude API client (following existing patterns)
            import anthropic
            
            client = anthropic.Anthropic(api_key=self.api_key)
            
            # Prepare the analysis prompt
            prompt = self._build_analysis_prompt(chart_summary)
            
            # Prepare image for analysis (ETH/BTC ratio chart)
            eth_btc_ratio_chart_b64 = chart_data['eth_btc_ratio_chart_image']
            
            # Make API request
            logger.debug(f"Making Claude API request with model: {model}")
            
            response = client.messages.create(
                model=model,
                max_tokens=4000,
                temperature=0.1,  # Low temperature for consistent analysis
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": eth_btc_ratio_chart_b64
                                }
                            }
                        ]
                    }
                ]
            )
            
            # Extract response content
            response_text = response.content[0].text
            
            # Parse JSON response
            try:
                ai_result = json.loads(response_text)
            except json.JSONDecodeError:
                # If JSON parsing fails, try to extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    ai_result = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse JSON from AI response")
            
            logger.debug("Claude API analysis completed successfully")
            return ai_result
            
        except Exception as e:
            logger.error(f"Error in Claude API analysis: {e}")
            raise
    
    def _build_analysis_prompt(self, chart_summary: Dict[str, Any]) -> str:
        """
        Build the analysis prompt for Claude API.
        
        Args:
            chart_summary (Dict[str, Any]): Market data summary
            
        Returns:
            str: Analysis prompt
        """
        
        # Extract current values for context
        btc_price = chart_summary.get('btc_price', {})
        eth_price = chart_summary.get('eth_price', {})  # ETH Integration: Add ETH price context
        btc_dominance = chart_summary.get('btc_dominance', {})
        alt_strength = chart_summary.get('alt_strength_ratio', {})
        
        prompt = f"""
You are an expert cryptocurrency macro analyst. Analyze the provided 5 charts showing comprehensive market data over the past {chart_summary.get('data_points', 'unknown')} data points.

CHARTS PROVIDED FOR ANALYSIS:
1. Bitcoin Price Chart - BTC price movements and trends
2. Ethereum Price Chart - ETH price movements and trends
3. Bitcoin Dominance Chart - BTC's market share percentage
4. Altcoin Strength Index Chart - Overall altcoin performance ratio
5. ETH/BTC Ratio Chart - ETH market cap relative to BTC market cap (shows ETH strength vs BTC)

CURRENT MARKET CONTEXT:
- BTC Price: ${btc_price.get('current', 0):,.2f} (Change: {btc_price.get('change_percent', 0):+.1f}%)
- ETH Price: ${eth_price.get('current', 0):,.2f} (Change: {eth_price.get('change_percent', 0):+.1f}%)
- BTC Dominance: {btc_dominance.get('current', 0):.1f}% (Change: {btc_dominance.get('change_percent', 0):+.1f}%)
- Alt Strength Ratio: {alt_strength.get('current', 0):.2f} (Change: {alt_strength.get('change_percent', 0):+.1f}%)

ANALYSIS REQUIREMENTS:

1. CONFIDENCE SCORING (0-100):
   - Use the ENTIRE 0-100 range responsibly
   - 0-25: Very uncertain/choppy conditions
   - 26-50: Low confidence/mixed signals
   - 51-75: Moderate confidence/some clarity
   - 76-100: High confidence/clear trends
   - Be BRUTALLY HONEST - no false positives or sugar-coating

2. TREND ANALYSIS:
   - BTC Trend: Direction (UP/DOWN/SIDEWAYS) and Strength (0-100)
   - ETH Trend: Direction (UP/DOWN/SIDEWAYS) and Strength (0-100)
   - ALT Trend: Direction (UP/DOWN/SIDEWAYS) and Strength (0-100)
   - Base analysis on observable chart patterns, not speculation

3. TRADE PERMISSION LEVELS:
   - NO_TRADE: Choppy, uncertain conditions - preserve capital
   - SELECTIVE: Some opportunities but be very careful
   - ACTIVE: Good conditions for active trading
   - AGGRESSIVE: Excellent trending conditions

4. MARKET REGIME CLASSIFICATION:
   - BTC_SEASON: BTC outperforming, dominance rising
   - ALT_SEASON: Alts outperforming, dominance falling
   - TRANSITION: Unclear leadership, mixed signals
   - BEAR_MARKET: Overall declining conditions

CRITICAL REQUIREMENTS:
- Ground ALL analysis in observable chart data
- Acknowledge uncertainty when present
- Distinguish between high-confidence trends vs choppy conditions
- Provide specific reasoning for confidence scores
- Be realistic about market conditions

Respond with ONLY a JSON object in this exact format:

{{
    "overall_confidence": <0-100 integer>,
    "btc_trend_direction": "<UP|DOWN|SIDEWAYS>",
    "btc_trend_strength": <0-100 integer>,
    "eth_trend_direction": "<UP|DOWN|SIDEWAYS>",
    "eth_trend_strength": <0-100 integer>,
    "alt_trend_direction": "<UP|DOWN|SIDEWAYS>",
    "alt_trend_strength": <0-100 integer>,
    "trade_permission": "<NO_TRADE|SELECTIVE|ACTIVE|AGGRESSIVE>",
    "market_regime": "<BTC_SEASON|ALT_SEASON|TRANSITION|BEAR_MARKET>",
    "reasoning": "<detailed analysis explaining your confidence scores and recommendations>"
}}

REMEMBER: Use the full 0-100 confidence range. Be honest about uncertainty. Only recommend active trading when conditions clearly support it.
"""
        
        return prompt.strip()
    
    def _process_ai_result(self, ai_result: Dict[str, Any],
                          chart_data: Dict[str, Any],
                          analysis_timestamp: int,
                          model_used: str) -> Dict[str, Any]:
        """
        Process and validate AI analysis result.
        
        Args:
            ai_result (Dict[str, Any]): Raw AI result
            chart_data (Dict[str, Any]): Chart generation data
            analysis_timestamp (int): Analysis timestamp
            model_used (str): The actual Claude model used for analysis
            
        Returns:
            Dict[str, Any]: Processed result for database storage
        """
        try:
            # Validate required fields
            required_fields = [
                'overall_confidence', 'btc_trend_direction', 'btc_trend_strength',
                'eth_trend_direction', 'eth_trend_strength',  # ETH Integration: Add ETH validation
                'alt_trend_direction', 'alt_trend_strength', 'trade_permission',
                'market_regime', 'reasoning'
            ]
            
            for field in required_fields:
                if field not in ai_result:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate confidence scores
            confidence_fields = ['overall_confidence', 'btc_trend_strength', 'eth_trend_strength', 'alt_trend_strength']
            for field in confidence_fields:
                value = ai_result[field]
                if not isinstance(value, int) or value < 0 or value > 100:
                    raise ValueError(f"Invalid confidence score for {field}: {value}")
            
            # Validate enum values
            valid_directions = ['UP', 'DOWN', 'SIDEWAYS']
            valid_permissions = ['NO_TRADE', 'SELECTIVE', 'ACTIVE', 'AGGRESSIVE']
            valid_regimes = ['BTC_SEASON', 'ALT_SEASON', 'TRANSITION', 'BEAR_MARKET']
            
            if ai_result['btc_trend_direction'] not in valid_directions:
                raise ValueError(f"Invalid BTC trend direction: {ai_result['btc_trend_direction']}")
            
            if ai_result['eth_trend_direction'] not in valid_directions:
                raise ValueError(f"Invalid ETH trend direction: {ai_result['eth_trend_direction']}")
            
            if ai_result['alt_trend_direction'] not in valid_directions:
                raise ValueError(f"Invalid ALT trend direction: {ai_result['alt_trend_direction']}")
            
            if ai_result['trade_permission'] not in valid_permissions:
                raise ValueError(f"Invalid trade permission: {ai_result['trade_permission']}")
            
            if ai_result['market_regime'] not in valid_regimes:
                raise ValueError(f"Invalid market regime: {ai_result['market_regime']}")
            
            # Build processed result
            processed_result = {
                'analysis_timestamp': analysis_timestamp,
                'data_period_start': chart_data['data_period_start'],
                'data_period_end': chart_data['data_period_end'],
                'overall_confidence': ai_result['overall_confidence'],
                'btc_trend_direction': ai_result['btc_trend_direction'],
                'btc_trend_strength': ai_result['btc_trend_strength'],
                'eth_trend_direction': ai_result['eth_trend_direction'],
                'eth_trend_strength': ai_result['eth_trend_strength'],
                'alt_trend_direction': ai_result['alt_trend_direction'],
                'alt_trend_strength': ai_result['alt_trend_strength'],
                'trade_permission': ai_result['trade_permission'],
                'market_regime': ai_result['market_regime'],
                'ai_reasoning': ai_result['reasoning'],
                'chart_data_hash': chart_data['chart_data_hash'],
                'processing_time_ms': chart_data['processing_time_ms'],
                'model_used': model_used,
                'prompt_version': 'v1.0',
                'btc_chart_image': chart_data['btc_chart_image'],
                'eth_chart_image': chart_data['eth_chart_image'],
                'dominance_chart_image': chart_data['dominance_chart_image'],
                'alt_strength_chart_image': chart_data['alt_strength_chart_image'],
                'eth_btc_ratio_chart_image': chart_data['eth_btc_ratio_chart_image']
            }
            
            logger.debug("AI result processed and validated successfully")
            return processed_result
            
        except Exception as e:
            logger.error(f"Error processing AI result: {e}")
            raise
    
    def get_latest_analysis(self) -> Optional[Dict[str, Any]]:
        """Get the most recent sentiment analysis."""
        return self.db.get_latest_sentiment()
    
    def get_confidence_history(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get confidence history for the specified number of days."""
        return self.db.get_confidence_history(days)


# Utility functions for easy access
async def trigger_macro_analysis(model: Optional[str] = None, days: int = 90) -> Dict[str, Any]:
    """Trigger macro sentiment analysis."""
    service = MacroAIService()
    return await service.analyze_macro_sentiment(model, days)


def get_latest_macro_sentiment() -> Optional[Dict[str, Any]]:
    """Get latest macro sentiment analysis."""
    service = MacroAIService()
    return service.get_latest_analysis()


def get_macro_confidence_history(days: int = 7) -> List[Dict[str, Any]]:
    """Get macro confidence history."""
    service = MacroAIService()
    return service.get_confidence_history(days)


# Example usage and testing
if __name__ == "__main__":
    import asyncio
    
    async def test_ai_service():
        """Test the AI service"""
        try:
            print("Testing macro AI service...")
            
            # Create service
            service = MacroAIService()
            
            # Test latest analysis retrieval
            latest = service.get_latest_analysis()
            if latest:
                print(f"✅ Latest analysis: {latest['overall_confidence']}% confidence")
            else:
                print("ℹ️ No previous analysis found")
            
            # Test confidence history
            history = service.get_confidence_history(7)
            print(f"✅ Confidence history: {len(history)} data points")
            
            # Test analysis (if we have chart data)
            try:
                result = await service.analyze_macro_sentiment(days=7)
                print(f"✅ New analysis completed:")
                print(f"   Confidence: {result['overall_confidence']}%")
                print(f"   BTC Trend: {result['btc_trend_direction']} ({result['btc_trend_strength']}%)")
                print(f"   ALT Trend: {result['alt_trend_direction']} ({result['alt_trend_strength']}%)")
                print(f"   Trade Permission: {result['trade_permission']}")
                print(f"   Market Regime: {result['market_regime']}")
            except Exception as e:
                print(f"⚠️ Analysis test skipped: {e}")
            
            print("🎉 AI service tests completed!")
            
        except Exception as e:
            print(f"❌ AI service test failed: {e}")
    
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # Run test
    asyncio.run(test_ai_service())