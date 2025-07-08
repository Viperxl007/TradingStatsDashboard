"""
Enhanced Chart Analyzer Module

This module provides a multi-stage AI-powered chart analysis system that uses
explicit questioning to extract comprehensive technical analysis data.
"""

import logging
import base64
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import os

logger = logging.getLogger(__name__)

class EnhancedChartAnalyzer:
    """
    Enhanced AI-powered chart analyzer with multi-stage analysis.
    
    This class uses a systematic approach with explicit questioning to ensure
    comprehensive technical analysis data extraction.
    """
    
    def __init__(self):
        """Initialize the enhanced chart analyzer with API configuration."""
        try:
            from config import CLAUDE_API_KEY
            self.api_key = CLAUDE_API_KEY
        except ImportError:
            self.api_key = os.environ.get('CLAUDE_API_KEY')
        
        self.api_url = "https://api.anthropic.com/v1/messages"
        self.model = "claude-sonnet-4-20250514"
        self.max_tokens = 4000
        
        if not self.api_key:
            logger.warning("CLAUDE_API_KEY not found in configuration or environment variables")
    
    def analyze_chart_comprehensive(self, image_data: bytes, ticker: str, context_data: Optional[Dict] = None, timeframe: str = '1D', selected_model: Optional[str] = None, historical_context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Perform comprehensive multi-stage chart analysis with historical context.
        
        Args:
            image_data (bytes): Chart image data
            ticker (str): Stock ticker symbol
            context_data (Optional[Dict]): Additional context data
            timeframe (str): Chart timeframe (e.g., '1h', '1D', '1W')
            selected_model (Optional[str]): Claude model to use for analysis
            historical_context (Optional[Dict]): Historical analysis context for accountability
            
        Returns:
            Dict[str, Any]: Comprehensive analysis results
        """
        try:
            if not self.api_key:
                return {
                    "error": "Claude API key not configured",
                    "timestamp": datetime.now().timestamp()
                }
            
            # Use selected model or fall back to default
            if selected_model:
                # Validate the selected model
                try:
                    from config import CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL
                    valid_models = [model['id'] for model in CLAUDE_MODELS]
                    if selected_model not in valid_models:
                        logger.warning(f"Invalid model '{selected_model}' selected, using default: {DEFAULT_CLAUDE_MODEL}")
                        model_to_use = DEFAULT_CLAUDE_MODEL
                    else:
                        model_to_use = selected_model
                        logger.info(f"Using selected model: {model_to_use}")
                except ImportError:
                    logger.warning("Could not import model configuration, using instance default")
                    model_to_use = self.model
            else:
                model_to_use = self.model
            
            # Temporarily override the instance model for this analysis
            original_model = self.model
            self.model = model_to_use
            
            # Encode image to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Stage 1: Initial comprehensive overview with historical context
            logger.info(f"Stage 1: Initial analysis for {ticker}")
            initial_analysis = self._stage_1_initial_analysis(image_base64, ticker, context_data, timeframe, historical_context)
            
            if 'error' in initial_analysis:
                return initial_analysis
            
            # Stage 2: Detailed technical indicators
            logger.info(f"Stage 2: Technical indicators for {ticker}")
            technical_analysis = self._stage_2_technical_indicators(image_base64, ticker, initial_analysis)
            
            # Stage 3: Specific price levels and patterns
            logger.info(f"Stage 3: Price levels and patterns for {ticker}")
            levels_analysis = self._stage_3_price_levels(image_base64, ticker, initial_analysis)
            
            # Stage 4: Trading recommendations
            logger.info(f"Stage 4: Trading recommendations for {ticker}")
            trading_analysis = self._stage_4_trading_recommendations(image_base64, ticker, initial_analysis)
            
            # Combine all analyses
            comprehensive_analysis = self._combine_analyses(
                ticker, initial_analysis, technical_analysis,
                levels_analysis, trading_analysis, timeframe, context_data
            )
            
            logger.info(f"Successfully completed comprehensive analysis for {ticker}")
            return comprehensive_analysis
            
        except Exception as e:
            logger.error(f"Error in comprehensive chart analysis for {ticker}: {str(e)}")
            return {
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }
        finally:
            # Restore original model
            self.model = original_model
    
    def _stage_1_initial_analysis(self, image_base64: str, ticker: str, context_data: Optional[Dict] = None, timeframe: str = '1D', historical_context: Optional[Dict] = None) -> Dict[str, Any]:
        """Stage 1: Get initial comprehensive overview of the chart with historical context."""
        
        # Get current price from context
        current_price = context_data.get('current_price', 0.0) if context_data else 0.0
        
        # Build contextual prompt using the new service
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
        from services.prompt_builder_service import PromptBuilderService
        
        # Build additional context for the base prompt
        additional_context = ""
        if context_data:
            additional_context = f"Market Context: {json.dumps(context_data, indent=2)}"
        
        # Get the contextual prompt
        contextual_prompt = PromptBuilderService.build_contextual_analysis_prompt(
            ticker=ticker,
            timeframe=timeframe,
            current_price=current_price,
            context=historical_context,
            additional_context=additional_context
        )
        
        prompt = f"""
{contextual_prompt}

You are an expert technical analyst. Based on the above context and requirements, analyze this {ticker} chart and provide a comprehensive overview.

CRITICAL: Respond ONLY with valid JSON in this exact format:

{{
    "ticker": "{ticker}",
    "timestamp": "{datetime.now().isoformat()}",
    "chart_overview": {{
        "timeframe_detected": "1m|5m|15m|1h|4h|1d|1w|1m",
        "price_action_summary": "detailed description of what you see",
        "overall_trend": "strongly_bullish|bullish|neutral|bearish|strongly_bearish",
        "trend_strength": "very_strong|strong|moderate|weak|very_weak",
        "current_price_estimate": 0.00,
        "price_range_visible": {{"low": 0.00, "high": 0.00}}
    }},
    "immediate_observations": {{
        "chart_type": "candlestick|line|bar|other",
        "volume_visible": true|false,
        "indicators_visible": ["list of visible indicators"],
        "time_period_estimate": "approximate time period shown"
    }},
    "market_structure": {{
        "higher_highs": true|false,
        "higher_lows": true|false,
        "lower_highs": true|false,
        "lower_lows": true|false,
        "consolidation_pattern": true|false
    }},
    "confidence_level": 0.0-1.0
}}

Focus on what you can clearly see in the chart. Be specific about price levels and patterns.
"""
        
        # Make the API request
        result = self._make_api_request(image_base64, prompt, "stage_1")
        
        # Add historical context and metadata to the result for later stages
        if isinstance(result, dict):
            result['historical_context'] = historical_context
            result['timeframe'] = timeframe
            result['context_data'] = context_data
        
        return result
    
    def _stage_2_technical_indicators(self, image_base64: str, ticker: str, initial_data: Dict) -> Dict[str, Any]:
        """Stage 2: Detailed analysis of technical indicators."""
        prompt = f"""
Based on this {ticker} chart, analyze ONLY the specific technical indicators that are actually visible.

IMPORTANT: The ONLY indicators that may be present on these charts are:
- Volume Bars (obvious volume bars at bottom of chart)
- 20 SMA (orange colored line)
- 50 SMA (teal colored line)
- 200 SMA (purple colored line)
- VWAP (dotted very light green/cream colored line)

Previous analysis context: {json.dumps(initial_data.get('chart_overview', {}), indent=2)}

CRITICAL: Respond ONLY with valid JSON in this exact format:

{{
    "volume_analysis": {{
        "volume_visible": true|false,
        "volume_trend": "increasing|decreasing|stable|irregular|not_visible",
        "volume_vs_average": "above_average|below_average|average|not_visible",
        "volume_price_correlation": "positive|negative|neutral|not_visible",
        "volume_spikes": ["list significant volume events or empty array if not visible"]
    }},
    "moving_averages": {{
        "sma_20_visible": true|false,
        "sma_20_color_confirmed": "orange|other|not_visible",
        "sma_50_visible": true|false,
        "sma_50_color_confirmed": "teal|other|not_visible",
        "sma_200_visible": true|false,
        "sma_200_color_confirmed": "purple|other|not_visible",
        "price_vs_sma20": "above|below|at|not_visible",
        "price_vs_sma50": "above|below|at|not_visible",
        "price_vs_sma200": "above|below|at|not_visible",
        "sma_alignment": "bullish|bearish|mixed|not_enough_data",
        "sma_slopes": "all_rising|all_falling|mixed|not_enough_data"
    }},
    "vwap_analysis": {{
        "vwap_visible": true|false,
        "vwap_color_confirmed": "light_green_cream_dotted|other|not_visible",
        "price_vs_vwap": "above|below|at|not_visible",
        "vwap_slope": "rising|falling|flat|not_visible"
    }}
}}

NEVER make up indicators that you don't clearly see. Only analyze what is actually visible on the chart. If you don't see an indicator, mark it as not_visible or false.
"""
        
        return self._make_api_request(image_base64, prompt, "stage_2")
    
    def _stage_3_price_levels(self, image_base64: str, ticker: str, initial_data: Dict) -> Dict[str, Any]:
        """Stage 3: Identify specific price levels and chart patterns."""
        prompt = f"""
Analyze this {ticker} chart for SPECIFIC price levels and chart patterns.

Chart context: {json.dumps(initial_data.get('chart_overview', {}), indent=2)}

CRITICAL: Respond ONLY with valid JSON in this exact format:

{{
    "support_levels": [
        {{"price": 0.00, "strength": "strong|moderate|weak", "tests": 0, "description": "why this is support"}},
        {{"price": 0.00, "strength": "strong|moderate|weak", "tests": 0, "description": "why this is support"}}
    ],
    "resistance_levels": [
        {{"price": 0.00, "strength": "strong|moderate|weak", "tests": 0, "description": "why this is resistance"}},
        {{"price": 0.00, "strength": "strong|moderate|weak", "tests": 0, "description": "why this is resistance"}}
    ],
    "chart_patterns": [
        {{
            "pattern_name": "triangle|wedge|flag|pennant|head_and_shoulders|double_top|double_bottom|channel|other",
            "pattern_type": "continuation|reversal",
            "completion_status": "forming|completed|broken",
            "target_price": 0.00,
            "pattern_description": "detailed description"
        }}
    ],
    "key_price_zones": [
        {{
            "zone_type": "demand|supply|consolidation|breakout",
            "price_range": {{"low": 0.00, "high": 0.00}},
            "significance": "high|medium|low",
            "description": "why this zone is important"
        }}
    ],
    "fibonacci_levels": {{
        "retracement_levels": [
            {{"level": "23.6%|38.2%|50%|61.8%|78.6%", "price": 0.00, "acting_as": "support|resistance|neutral"}}
        ],
        "extension_levels": [
            {{"level": "127.2%|161.8%|261.8%", "price": 0.00, "target_type": "conservative|aggressive"}}
        ]
    }}
}}

Provide EXACT price levels you can see on the chart. Count actual tests of levels.
"""
        
        return self._make_api_request(image_base64, prompt, "stage_3")
    
    def _stage_4_trading_recommendations(self, image_base64: str, ticker: str, initial_data: Dict) -> Dict[str, Any]:
        """Stage 4: Generate specific trading recommendations with historical context."""
        
        # Get historical context from initial_data
        historical_context = initial_data.get('historical_context')
        current_price = initial_data.get('chart_overview', {}).get('current_price_estimate', 0.0)
        timeframe = initial_data.get('timeframe', '1D')
        
        # Build contextual prompt using the PromptBuilderService
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
        from services.prompt_builder_service import PromptBuilderService
        
        # Build the contextual prompt for trading recommendations
        contextual_prompt = PromptBuilderService.build_contextual_analysis_prompt(
            ticker=ticker,
            timeframe=timeframe,
            current_price=current_price,
            context=historical_context,
            additional_context=f"Chart Analysis Context: {json.dumps(initial_data.get('chart_overview', {}), indent=2)}"
        )
        
        prompt = f"""
{contextual_prompt}

Based on this {ticker} chart analysis, provide SPECIFIC trading recommendations.

CRITICAL: Respond ONLY with valid JSON in this exact format:

{{
    "trading_bias": {{
        "direction": "bullish|bearish|neutral",
        "conviction": "high|medium|low",
        "time_horizon": "scalp|day_trade|swing|position",
        "reasoning": "detailed explanation for bias"
    }},
    "entry_strategies": [
        {{
            "strategy_type": "breakout|pullback|reversal|momentum",
            "entry_price": 0.00,
            "entry_condition": "specific condition to enter",
            "probability": "high|medium|low"
        }}
    ],
    "risk_management": {{
        "stop_loss_levels": [
            {{"price": 0.00, "type": "technical|percentage", "reasoning": "why this stop level"}}
        ],
        "position_sizing": "conservative|moderate|aggressive",
        "risk_reward_ratio": "1:1|1:2|1:3|other"
    }},
    "profit_targets": [
        {{
            "target_price": 0.00,
            "target_type": "conservative|moderate|aggressive",
            "probability": "high|medium|low",
            "reasoning": "why this target"
        }}
    ],
    "options_strategy": {{
        "recommended_strategy": "calls|puts|spreads|straddle|iron_condor|none",
        "strike_suggestions": [0.00],
        "expiration_guidance": "weekly|monthly|quarterly",
        "iv_consideration": "high|normal|low"
    }},
    "context_assessment": {{
        "previous_position_status": "MAINTAIN|MODIFY|CLOSE|REPLACE|NONE",
        "previous_position_reasoning": "detailed explanation of how you addressed any existing position",
        "fundamental_changes": "what changed since the last analysis (if any)",
        "position_continuity": "explanation of position relationship to previous analysis"
    }},
    "key_catalysts": [
        "list events or levels that could change the analysis"
    ],
    "invalidation_levels": [
        {{"price": 0.00, "description": "what would invalidate this analysis"}}
    ]
}}

CRITICAL: If historical context was provided in the prompt, you MUST fill out the context_assessment section.
Be specific with exact price levels and realistic probability assessments.
"""
        
        return self._make_api_request(image_base64, prompt, "stage_4")
    
    def _make_api_request(self, image_base64: str, prompt: str, stage: str) -> Dict[str, Any]:
        """Make API request to Claude with error handling."""
        try:
            headers = {
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01"
            }
            
            payload = {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "messages": [
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
                                    "data": image_base64
                                }
                            }
                        ]
                    }
                ]
            }
            
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=45)
            
            if response.status_code != 200:
                logger.error(f"Claude API error in {stage}: {response.status_code} - {response.text}")
                return {"error": f"API request failed in {stage}: {response.status_code}"}
            
            result = response.json()
            analysis_text = result.get('content', [{}])[0].get('text', '')
            
            # Parse JSON response
            try:
                # Extract JSON from response
                json_start = analysis_text.find('{')
                json_end = analysis_text.rfind('}') + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = analysis_text[json_start:json_end]
                    parsed_data = json.loads(json_str)
                    parsed_data['stage'] = stage
                    parsed_data['raw_response'] = analysis_text
                    return parsed_data
                else:
                    logger.warning(f"No JSON found in {stage} response")
                    return {"error": f"No valid JSON in {stage} response", "raw_text": analysis_text}
                    
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error in {stage}: {str(e)}")
                return {"error": f"JSON parsing failed in {stage}", "raw_text": analysis_text}
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout in {stage}")
            return {"error": f"Request timeout in {stage}"}
        except Exception as e:
            logger.error(f"Error in {stage}: {str(e)}")
            return {"error": f"Request failed in {stage}: {str(e)}"}
    
    def _combine_analyses(self, ticker: str, initial: Dict, technical: Dict,
                         levels: Dict, trading: Dict, timeframe: str = '1D', context_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Combine all analysis stages into comprehensive result."""
        
        # Extract data from each stage, handling errors gracefully
        chart_overview = initial.get('chart_overview', {})
        market_structure = initial.get('market_structure', {})
        
        # Build comprehensive analysis
        comprehensive = {
            "id": f"{ticker}_{int(datetime.now().timestamp())}",
            "ticker": ticker,
            "timestamp": datetime.now().timestamp(),
            "timeframe": timeframe,
            
            # Current price and basic info
            "currentPrice": chart_overview.get('current_price_estimate', 0.0),
            "priceRange": chart_overview.get('price_range_visible', {"low": 0.0, "high": 0.0}),
            
            # Main analysis summary
            "summary": self._generate_comprehensive_summary(initial, technical, levels, trading),
            "sentiment": self._determine_sentiment(chart_overview, trading),
            "confidence": self._calculate_overall_confidence(initial, technical, levels, trading),
            
            # Key levels (formatted for frontend)
            "keyLevels": self._format_key_levels(levels),
            
            # Chart patterns
            "patterns": self._format_patterns(levels),
            
            # Technical indicators
            "technicalIndicators": self._format_technical_indicators(technical),
            
            # Trading recommendations
            "recommendations": self._format_recommendations(trading),
            
            # Detailed analysis sections
            "detailedAnalysis": {
                "chartOverview": chart_overview,
                "marketStructure": market_structure,
                "technicalIndicators": technical,
                "priceLevels": levels,
                "tradingAnalysis": trading
            },
            
            # Analysis metadata
            "analysisStages": {
                "stage1_success": 'error' not in initial,
                "stage2_success": 'error' not in technical,
                "stage3_success": 'error' not in levels,
                "stage4_success": 'error' not in trading
            },
            
            # Context data if provided
            "contextData": context_data or {},
            
            # Context Assessment (NEW - Accountability Layer)
            "context_assessment": self._format_context_assessment(trading),
            
            # Chart image reference
            "chartImageUrl": None,  # Will be set by calling function
            
            # Error handling
            "errors": self._collect_errors(initial, technical, levels, trading)
        }
        
        return comprehensive
    
    def _format_context_assessment(self, trading: Dict) -> str:
        """Format context assessment from trading analysis."""
        try:
            context_assessment = trading.get('context_assessment', {})
            if not context_assessment:
                return ""
            
            # Build a readable context assessment string
            assessment_parts = []
            
            # Previous position status
            status = context_assessment.get('previous_position_status', 'NONE')
            if status != 'NONE':
                assessment_parts.append(f"Previous Position Status: {status}")
            
            # Previous position reasoning
            reasoning = context_assessment.get('previous_position_reasoning', '')
            if reasoning:
                assessment_parts.append(f"Position Assessment: {reasoning}")
            
            # Fundamental changes
            changes = context_assessment.get('fundamental_changes', '')
            if changes:
                assessment_parts.append(f"Market Changes: {changes}")
            
            # Position continuity
            continuity = context_assessment.get('position_continuity', '')
            if continuity:
                assessment_parts.append(f"Position Continuity: {continuity}")
            
            return " | ".join(assessment_parts) if assessment_parts else ""
            
        except Exception as e:
            logger.error(f"Error formatting context assessment: {str(e)}")
            return ""
    
    def _generate_comprehensive_summary(self, initial: Dict, technical: Dict, levels: Dict, trading: Dict) -> str:
        """Generate a comprehensive summary from all analysis stages."""
        try:
            summary_parts = []
            
            # Chart overview
            chart_overview = initial.get('chart_overview', {})
            if chart_overview:
                trend = chart_overview.get('overall_trend', 'neutral')
                strength = chart_overview.get('trend_strength', 'moderate')
                summary_parts.append(f"Overall trend is {trend} with {strength} strength")
            
            # Key levels
            support_levels = levels.get('support_levels', [])
            resistance_levels = levels.get('resistance_levels', [])
            if support_levels or resistance_levels:
                summary_parts.append(f"Identified {len(support_levels)} support and {len(resistance_levels)} resistance levels")
            
            # Trading bias
            trading_bias = trading.get('trading_bias', {})
            if trading_bias:
                direction = trading_bias.get('direction', 'neutral')
                conviction = trading_bias.get('conviction', 'medium')
                summary_parts.append(f"Trading bias is {direction} with {conviction} conviction")
            
            return ". ".join(summary_parts) if summary_parts else "Comprehensive technical analysis completed"
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return "Technical analysis completed with detailed insights"
    
    def _determine_sentiment(self, chart_overview: Dict, trading: Dict) -> str:
        """Determine overall sentiment from analysis."""
        try:
            trend = chart_overview.get('overall_trend', 'neutral')
            trading_direction = trading.get('trading_bias', {}).get('direction', 'neutral')
            
            # Map to frontend expected values
            if 'bullish' in trend or trading_direction == 'bullish':
                return 'bullish'
            elif 'bearish' in trend or trading_direction == 'bearish':
                return 'bearish'
            else:
                return 'neutral'
                
        except Exception:
            return 'neutral'
    
    def _calculate_overall_confidence(self, initial: Dict, technical: Dict, levels: Dict, trading: Dict) -> float:
        """Calculate overall confidence score."""
        try:
            confidences = []
            
            # Initial analysis confidence
            if 'confidence_level' in initial:
                confidences.append(initial['confidence_level'])
            
            # Success rate of stages
            successful_stages = sum([
                'error' not in initial,
                'error' not in technical,
                'error' not in levels,
                'error' not in trading
            ])
            stage_confidence = successful_stages / 4.0
            confidences.append(stage_confidence)
            
            # Data completeness
            data_completeness = 0.0
            if levels.get('support_levels') or levels.get('resistance_levels'):
                data_completeness += 0.3
            
            # Check for any visible technical indicators
            technical_indicators_found = False
            if technical.get('volume_analysis', {}).get('volume_visible', False):
                technical_indicators_found = True
            if technical.get('moving_averages', {}).get('sma_20_visible', False) or \
               technical.get('moving_averages', {}).get('sma_50_visible', False) or \
               technical.get('moving_averages', {}).get('sma_200_visible', False):
                technical_indicators_found = True
            if technical.get('vwap_analysis', {}).get('vwap_visible', False):
                technical_indicators_found = True
            
            if technical_indicators_found:
                data_completeness += 0.3
            if trading.get('trading_bias'):
                data_completeness += 0.4
            confidences.append(data_completeness)
            
            return sum(confidences) / len(confidences) if confidences else 0.5
            
        except Exception:
            return 0.5
    
    def _format_key_levels(self, levels: Dict) -> List[Dict]:
        """Format key levels for frontend consumption."""
        try:
            formatted_levels = []
            
            # Support levels
            for support in levels.get('support_levels', []):
                if isinstance(support, dict) and 'price' in support:
                    formatted_levels.append({
                        "price": support['price'],
                        "type": "support",
                        "strength": support.get('strength', 'moderate'),
                        "description": support.get('description', 'Support level'),
                        "confidence": 0.8 if support.get('strength') == 'strong' else 0.6
                    })
            
            # Resistance levels
            for resistance in levels.get('resistance_levels', []):
                if isinstance(resistance, dict) and 'price' in resistance:
                    formatted_levels.append({
                        "price": resistance['price'],
                        "type": "resistance",
                        "strength": resistance.get('strength', 'moderate'),
                        "description": resistance.get('description', 'Resistance level'),
                        "confidence": 0.8 if resistance.get('strength') == 'strong' else 0.6
                    })
            
            return formatted_levels
            
        except Exception as e:
            logger.error(f"Error formatting key levels: {str(e)}")
            return []
    
    def _format_patterns(self, levels: Dict) -> List[Dict]:
        """Format chart patterns for frontend consumption."""
        try:
            formatted_patterns = []
            
            for pattern in levels.get('chart_patterns', []):
                if isinstance(pattern, dict):
                    # Determine pattern type
                    pattern_type = 'neutral'
                    if pattern.get('pattern_type') == 'reversal':
                        pattern_type = 'bearish' if 'top' in pattern.get('pattern_name', '').lower() else 'bullish'
                    elif pattern.get('pattern_type') == 'continuation':
                        pattern_type = 'bullish'  # Assume bullish continuation for now
                    
                    formatted_patterns.append({
                        "name": pattern.get('pattern_name', 'Unknown Pattern'),
                        "type": pattern_type,
                        "confidence": 0.7,  # Default confidence
                        "description": pattern.get('pattern_description', 'Chart pattern identified'),
                        "targetPrice": pattern.get('target_price'),
                        "stopLoss": None  # Could be derived from pattern
                    })
            
            return formatted_patterns
            
        except Exception as e:
            logger.error(f"Error formatting patterns: {str(e)}")
            return []
    
    def _format_technical_indicators(self, technical: Dict) -> List[Dict]:
        """Format technical indicators for frontend consumption."""
        try:
            formatted_indicators = []
            
            # Volume Analysis
            volume_analysis = technical.get('volume_analysis', {})
            if volume_analysis.get('volume_visible', False):
                volume_trend = volume_analysis.get('volume_trend', 'not_visible')
                if volume_trend != 'not_visible':
                    volume_signal = 'bullish' if volume_trend == 'increasing' else 'bearish' if volume_trend == 'decreasing' else 'neutral'
                    formatted_indicators.append({
                        "name": "Volume Bars",
                        "value": 0,
                        "signal": volume_signal,
                        "description": f"Volume trend is {volume_trend}, correlation with price is {volume_analysis.get('volume_price_correlation', 'neutral')}"
                    })
            
            # Moving Averages - Only include if visible
            ma_analysis = technical.get('moving_averages', {})
            visible_smas = []
            
            # 20 SMA
            if ma_analysis.get('sma_20_visible', False):
                color_status = " (orange)" if ma_analysis.get('sma_20_color_confirmed') == 'orange' else ""
                price_vs = ma_analysis.get('price_vs_sma20', 'not_visible')
                if price_vs != 'not_visible':
                    visible_smas.append(f"20 SMA{color_status}: price {price_vs}")
            
            # 50 SMA
            if ma_analysis.get('sma_50_visible', False):
                color_status = " (teal)" if ma_analysis.get('sma_50_color_confirmed') == 'teal' else ""
                price_vs = ma_analysis.get('price_vs_sma50', 'not_visible')
                if price_vs != 'not_visible':
                    visible_smas.append(f"50 SMA{color_status}: price {price_vs}")
            
            # 200 SMA
            if ma_analysis.get('sma_200_visible', False):
                color_status = " (purple)" if ma_analysis.get('sma_200_color_confirmed') == 'purple' else ""
                price_vs = ma_analysis.get('price_vs_sma200', 'not_visible')
                if price_vs != 'not_visible':
                    visible_smas.append(f"200 SMA{color_status}: price {price_vs}")
            
            if visible_smas:
                ma_alignment = ma_analysis.get('sma_alignment', 'not_enough_data')
                ma_signal = 'bullish' if ma_alignment == 'bullish' else 'bearish' if ma_alignment == 'bearish' else 'neutral'
                formatted_indicators.append({
                    "name": "Simple Moving Averages",
                    "value": len(visible_smas),
                    "signal": ma_signal,
                    "description": f"Visible SMAs: {', '.join(visible_smas)}. Alignment: {ma_alignment}"
                })
            
            # VWAP Analysis
            vwap_analysis = technical.get('vwap_analysis', {})
            if vwap_analysis.get('vwap_visible', False):
                color_status = " (light green/cream dotted)" if vwap_analysis.get('vwap_color_confirmed') == 'light_green_cream_dotted' else ""
                price_vs_vwap = vwap_analysis.get('price_vs_vwap', 'not_visible')
                vwap_slope = vwap_analysis.get('vwap_slope', 'not_visible')
                
                if price_vs_vwap != 'not_visible':
                    vwap_signal = 'bullish' if price_vs_vwap == 'above' else 'bearish' if price_vs_vwap == 'below' else 'neutral'
                    formatted_indicators.append({
                        "name": "VWAP",
                        "value": 0,
                        "signal": vwap_signal,
                        "description": f"VWAP{color_status}: price {price_vs_vwap}, slope {vwap_slope}"
                    })
            
            return formatted_indicators
            
        except Exception as e:
            logger.error(f"Error formatting technical indicators: {str(e)}")
            return []
    
    def _format_recommendations(self, trading: Dict) -> Dict:
        """Format trading recommendations for frontend consumption."""
        try:
            trading_bias = trading.get('trading_bias', {})
            entry_strategies = trading.get('entry_strategies', [])
            profit_targets = trading.get('profit_targets', [])
            risk_management = trading.get('risk_management', {})
            
            # CRITICAL FIX: Sort entry strategies by probability (highest first)
            if entry_strategies:
                def probability_sort_key(strategy):
                    prob = strategy.get('probability', 'low').lower()
                    if prob == 'high':
                        return 3
                    elif prob == 'medium':
                        return 2
                    else:  # low or any other value
                        return 1
                
                # Keep original order for stop loss matching
                original_entry_strategies = entry_strategies.copy()
                entry_strategies = sorted(entry_strategies, key=probability_sort_key, reverse=True)
                logger.info(f"🎯 [PROBABILITY FIX] Sorted {len(entry_strategies)} strategies by probability:")
                for i, strategy in enumerate(entry_strategies):
                    logger.info(f"   {i+1}. {strategy.get('strategy_type', 'unknown')} - {strategy.get('probability', 'unknown')} probability")
            
            # Determine action
            action = 'hold'
            if trading_bias.get('direction') == 'bullish':
                action = 'buy'
            elif trading_bias.get('direction') == 'bearish':
                action = 'sell'
            
            # Get entry price from HIGHEST PROBABILITY strategy (now first after sorting)
            entry_price = None
            selected_strategy = None
            if entry_strategies:
                selected_strategy = entry_strategies[0]
                # Try both camelCase and snake_case for compatibility
                entry_price = selected_strategy.get('entryPrice') or selected_strategy.get('entry_price')
                logger.info(f"🎯 [PROBABILITY FIX] Selected strategy: {selected_strategy.get('strategy_type', 'unknown')} with {selected_strategy.get('probability', 'unknown')} probability")
            
            # Get target price
            target_price = None
            if profit_targets:
                target_price = profit_targets[0].get('target_price')
            
            # Get stop loss - prioritize strategy-specific stop loss if available
            stop_loss = None
            stop_loss_levels = risk_management.get('stop_loss_levels', []) or risk_management.get('stopLoss_levels', [])
            
            # First, check if the selected strategy has a corresponding stop loss
            # If we have multiple strategies and multiple stop losses, try to match them
            if selected_strategy and stop_loss_levels and len(original_entry_strategies) > 1 and len(stop_loss_levels) > 1:
                # Find the index of the selected strategy in the ORIGINAL (unsorted) entry_strategies list by strategy_type
                selected_strategy_type = selected_strategy.get('strategy_type', '')
                selected_strategy_index = 0
                for i, strategy in enumerate(original_entry_strategies):
                    strategy_type = strategy.get('strategy_type', '')
                    if strategy_type == selected_strategy_type:
                        selected_strategy_index = i
                        break
                
                # Use the corresponding stop loss if available, otherwise fall back to first
                if selected_strategy_index < len(stop_loss_levels):
                    stop_loss = stop_loss_levels[selected_strategy_index].get('price')
                    logger.info(f"🎯 [STOP LOSS FIX] Using strategy-specific stop loss: ${stop_loss} for {selected_strategy_type} strategy (index {selected_strategy_index})")
                else:
                    stop_loss = stop_loss_levels[0].get('price')
                    logger.warning(f"🎯 [STOP LOSS FIX] Strategy index {selected_strategy_index} exceeds stop loss array, using first stop loss: ${stop_loss}")
            elif stop_loss_levels:
                # Fallback to first stop loss for backward compatibility
                stop_loss = stop_loss_levels[0].get('price')
                logger.info(f"🎯 [STOP LOSS FIX] Using default first stop loss: ${stop_loss} (single strategy or single stop loss)")
            
            # Calculate risk/reward
            risk_reward = None
            if entry_price and target_price and stop_loss:
                risk = abs(entry_price - stop_loss)
                reward = abs(target_price - entry_price)
                if risk > 0:
                    risk_reward = reward / risk
            
            # Enhanced reasoning that includes strategy selection info
            base_reasoning = trading_bias.get('reasoning', 'Based on technical analysis')
            if selected_strategy and len(entry_strategies) > 1:
                strategy_info = f" Selected highest probability strategy: {selected_strategy.get('strategy_type', 'unknown')} ({selected_strategy.get('probability', 'unknown')} probability) from {len(entry_strategies)} available strategies."
                reasoning = base_reasoning + strategy_info
            else:
                reasoning = base_reasoning

            return {
                "action": action,
                "entryPrice": entry_price,
                "targetPrice": target_price,
                "stopLoss": stop_loss,
                "riskReward": risk_reward,
                "reasoning": reasoning
            }
            
        except Exception as e:
            logger.error(f"Error formatting recommendations: {str(e)}")
            return {
                "action": "hold",
                "reasoning": "Analysis completed but recommendations unavailable"
            }
    
    def _collect_errors(self, initial: Dict, technical: Dict, levels: Dict, trading: Dict) -> List[str]:
        """Collect any errors from analysis stages."""
        errors = []
        
        for stage_name, stage_data in [
            ("Initial Analysis", initial),
            ("Technical Indicators", technical),
            ("Price Levels", levels),
            ("Trading Recommendations", trading)
        ]:
            if 'error' in stage_data:
                errors.append(f"{stage_name}: {stage_data['error']}")
        
        return errors

# Global instance
enhanced_chart_analyzer = EnhancedChartAnalyzer()