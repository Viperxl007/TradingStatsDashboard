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
    
    def analyze_chart_comprehensive(self, image_data: bytes, ticker: str, context_data: Optional[Dict] = None, timeframe: str = '1D', selected_model: Optional[str] = None) -> Dict[str, Any]:
        """
        Perform comprehensive multi-stage chart analysis.
        
        Args:
            image_data (bytes): Chart image data
            ticker (str): Stock ticker symbol
            context_data (Optional[Dict]): Additional context data
            timeframe (str): Chart timeframe (e.g., '1h', '1D', '1W')
            selected_model (Optional[str]): Claude model to use for analysis
            
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
            
            # Stage 1: Initial comprehensive overview
            logger.info(f"Stage 1: Initial analysis for {ticker}")
            initial_analysis = self._stage_1_initial_analysis(image_base64, ticker, context_data)
            
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
    
    def _stage_1_initial_analysis(self, image_base64: str, ticker: str, context_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Stage 1: Get initial comprehensive overview of the chart."""
        prompt = f"""
You are an expert technical analyst. Analyze this {ticker} chart and provide a comprehensive overview.

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
        
        return self._make_api_request(image_base64, prompt, "stage_1")
    
    def _stage_2_technical_indicators(self, image_base64: str, ticker: str, initial_data: Dict) -> Dict[str, Any]:
        """Stage 2: Detailed analysis of technical indicators."""
        prompt = f"""
Based on this {ticker} chart, analyze ALL visible technical indicators in detail.

Previous analysis context: {json.dumps(initial_data.get('chart_overview', {}), indent=2)}

CRITICAL: Respond ONLY with valid JSON in this exact format:

{{
    "moving_averages": {{
        "visible_mas": ["list all visible MAs like '20 SMA', '50 EMA', etc."],
        "ma_analysis": {{
            "price_vs_ma20": "above|below|at",
            "price_vs_ma50": "above|below|at",
            "price_vs_ma200": "above|below|at",
            "ma_alignment": "bullish|bearish|mixed",
            "ma_slopes": "all_rising|all_falling|mixed"
        }}
    }},
    "volume_analysis": {{
        "volume_trend": "increasing|decreasing|stable|irregular",
        "volume_vs_average": "above_average|below_average|average",
        "volume_price_correlation": "positive|negative|neutral",
        "volume_spikes": ["list significant volume events"]
    }},
    "momentum_indicators": {{
        "rsi_reading": 0-100,
        "rsi_condition": "overbought|oversold|neutral",
        "macd_signal": "bullish|bearish|neutral",
        "macd_histogram": "rising|falling|flat",
        "stochastic": "overbought|oversold|neutral"
    }},
    "volatility_indicators": {{
        "bollinger_bands": {{
            "position": "upper|middle|lower|outside",
            "squeeze": true|false,
            "expansion": true|false
        }},
        "atr_assessment": "high|normal|low"
    }}
}}

Be precise about what you can actually see. If an indicator isn't visible, don't guess.
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
        """Stage 4: Generate specific trading recommendations."""
        prompt = f"""
Based on this {ticker} chart analysis, provide SPECIFIC trading recommendations.

Chart overview: {json.dumps(initial_data.get('chart_overview', {}), indent=2)}

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
    "key_catalysts": [
        "list events or levels that could change the analysis"
    ],
    "invalidation_levels": [
        {{"price": 0.00, "description": "what would invalidate this analysis"}}
    ]
}}

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
            
            # Chart image reference
            "chartImageUrl": None,  # Will be set by calling function
            
            # Error handling
            "errors": self._collect_errors(initial, technical, levels, trading)
        }
        
        return comprehensive
    
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
            if technical.get('moving_averages'):
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
            
            # Moving averages
            ma_analysis = technical.get('moving_averages', {}).get('ma_analysis', {})
            if ma_analysis:
                ma_signal = 'bullish' if ma_analysis.get('ma_alignment') == 'bullish' else 'bearish'
                formatted_indicators.append({
                    "name": "Moving Averages",
                    "value": 0,  # Could calculate a score
                    "signal": ma_signal,
                    "description": f"MA alignment is {ma_analysis.get('ma_alignment', 'mixed')}"
                })
            
            # RSI
            momentum = technical.get('momentum_indicators', {})
            if 'rsi_reading' in momentum:
                rsi_value = momentum['rsi_reading']
                rsi_signal = 'bullish' if rsi_value < 30 else 'bearish' if rsi_value > 70 else 'neutral'
                formatted_indicators.append({
                    "name": "RSI",
                    "value": rsi_value,
                    "signal": rsi_signal,
                    "description": f"RSI at {rsi_value}, {momentum.get('rsi_condition', 'neutral')}"
                })
            
            # Volume
            volume_analysis = technical.get('volume_analysis', {})
            if volume_analysis:
                volume_signal = 'bullish' if volume_analysis.get('volume_trend') == 'increasing' else 'neutral'
                formatted_indicators.append({
                    "name": "Volume",
                    "value": 0,
                    "signal": volume_signal,
                    "description": f"Volume trend is {volume_analysis.get('volume_trend', 'stable')}"
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
            
            # Determine action
            action = 'hold'
            if trading_bias.get('direction') == 'bullish':
                action = 'buy'
            elif trading_bias.get('direction') == 'bearish':
                action = 'sell'
            
            # Get entry price
            entry_price = None
            if entry_strategies:
                entry_price = entry_strategies[0].get('entry_price')
            
            # Get target price
            target_price = None
            if profit_targets:
                target_price = profit_targets[0].get('target_price')
            
            # Get stop loss
            stop_loss = None
            stop_loss_levels = risk_management.get('stop_loss_levels', [])
            if stop_loss_levels:
                stop_loss = stop_loss_levels[0].get('price')
            
            # Calculate risk/reward
            risk_reward = None
            if entry_price and target_price and stop_loss:
                risk = abs(entry_price - stop_loss)
                reward = abs(target_price - entry_price)
                if risk > 0:
                    risk_reward = reward / risk
            
            return {
                "action": action,
                "entryPrice": entry_price,
                "targetPrice": target_price,
                "stopLoss": stop_loss,
                "riskReward": risk_reward,
                "reasoning": trading_bias.get('reasoning', 'Based on technical analysis')
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