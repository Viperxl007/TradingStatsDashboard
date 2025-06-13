"""
Chart Analyzer Module

This module provides AI-powered chart analysis using Claude Vision API.
It processes chart images and provides technical analysis insights.
"""

import logging
import base64
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import os

logger = logging.getLogger(__name__)

class ChartAnalyzer:
    """
    AI-powered chart analyzer using Claude Vision API.
    
    This class handles chart image processing and analysis,
    providing technical insights and trading recommendations.
    """
    
    def __init__(self):
        """Initialize the chart analyzer with API configuration."""
        # Import configuration to get API key from config.py (which loads local_config.py)
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
    
    def validate_api_key(self) -> bool:
        """
        Validate that the Claude API key is configured.
        
        Returns:
            bool: True if API key is available, False otherwise
        """
        return bool(self.api_key)
    
    def analyze_chart(self, image_data: bytes, ticker: str, context_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze a chart image using Claude Vision API.
        
        Args:
            image_data (bytes): Chart image data
            ticker (str): Stock ticker symbol
            context_data (Optional[Dict]): Additional context data (OHLCV, earnings, etc.)
            
        Returns:
            Dict[str, Any]: Analysis results including insights and recommendations
        """
        try:
            if not self.validate_api_key():
                return {
                    "error": "Claude API key not configured",
                    "timestamp": datetime.now().timestamp()
                }
            
            # Encode image to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Build analysis prompt
            prompt = self._build_analysis_prompt(ticker, context_data)
            
            # Prepare API request
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
            
            # Make API request
            logger.info(f"Analyzing chart for {ticker}")
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"Claude API error: {response.status_code} - {response.text}")
                return {
                    "error": f"API request failed: {response.status_code}",
                    "timestamp": datetime.now().timestamp()
                }
            
            # Parse response
            result = response.json()
            analysis_text = result.get('content', [{}])[0].get('text', '')
            
            # Parse structured analysis from response
            parsed_analysis = self._parse_analysis_response(analysis_text, ticker)
            
            logger.info(f"Successfully analyzed chart for {ticker}")
            return parsed_analysis
            
        except requests.exceptions.Timeout:
            logger.error(f"Timeout analyzing chart for {ticker}")
            return {
                "error": "Request timeout",
                "timestamp": datetime.now().timestamp()
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error analyzing chart for {ticker}: {str(e)}")
            return {
                "error": f"Request failed: {str(e)}",
                "timestamp": datetime.now().timestamp()
            }
        except Exception as e:
            logger.error(f"Error analyzing chart for {ticker}: {str(e)}")
            return {
                "error": str(e),
                "timestamp": datetime.now().timestamp()
            }
    
    def _build_analysis_prompt(self, ticker: str, context_data: Optional[Dict] = None) -> str:
        """
        Build the analysis prompt for Claude Vision API.
        
        Args:
            ticker (str): Stock ticker symbol
            context_data (Optional[Dict]): Additional context data
            
        Returns:
            str: Formatted prompt for analysis
        """
        base_prompt = f"""
Analyze this stock chart for {ticker} and provide a comprehensive technical analysis.

Please provide your analysis in the following JSON format:

{{
    "ticker": "{ticker}",
    "analysis_timestamp": "{datetime.now().isoformat()}",
    "trend_analysis": {{
        "primary_trend": "bullish|bearish|neutral",
        "trend_strength": "strong|moderate|weak",
        "trend_description": "detailed description of the trend"
    }},
    "support_resistance": {{
        "key_support_levels": [list of support price levels],
        "key_resistance_levels": [list of resistance price levels],
        "current_level_significance": "description of current price level"
    }},
    "technical_indicators": {{
        "moving_averages": "analysis of visible moving averages",
        "volume_analysis": "volume pattern analysis",
        "momentum_indicators": "RSI, MACD, or other visible indicators"
    }},
    "chart_patterns": {{
        "identified_patterns": ["list of chart patterns"],
        "pattern_implications": "what these patterns suggest"
    }},
    "trading_insights": {{
        "entry_points": [list of potential entry price levels],
        "exit_points": [list of potential exit price levels],
        "stop_loss_levels": [list of suggested stop loss levels],
        "risk_assessment": "high|medium|low risk assessment"
    }},
    "time_frame_analysis": {{
        "short_term_outlook": "1-5 day outlook",
        "medium_term_outlook": "1-4 week outlook",
        "key_events_to_watch": ["upcoming events or levels to monitor"]
    }},
    "confidence_score": 0.0-1.0,
    "summary": "concise summary of the analysis"
}}

Focus on:
1. Clear identification of support and resistance levels
2. Trend analysis and momentum
3. Chart patterns and their implications
4. Volume analysis if visible
5. Risk assessment and trading levels
6. Actionable insights for options trading
"""
        
        # Add context data if available
        if context_data:
            context_section = "\n\nAdditional Context:\n"
            if 'current_price' in context_data:
                context_section += f"Current Price: ${context_data['current_price']:.2f}\n"
            if 'earnings_date' in context_data:
                context_section += f"Next Earnings: {context_data['earnings_date']}\n"
            if 'iv_rank' in context_data:
                context_section += f"IV Rank: {context_data['iv_rank']:.1f}%\n"
            if 'volume_avg' in context_data:
                context_section += f"Average Volume: {context_data['volume_avg']:,.0f}\n"
            
            base_prompt += context_section
        
        return base_prompt
    
    def _parse_analysis_response(self, analysis_text: str, ticker: str) -> Dict[str, Any]:
        """
        Parse the Claude API response into structured data.
        Enhanced to handle both structured JSON and unstructured text responses.
        
        Args:
            analysis_text (str): Raw analysis text from Claude
            ticker (str): Stock ticker symbol
            
        Returns:
            Dict[str, Any]: Parsed analysis data
        """
        try:
            # First, try to extract JSON from the response
            json_start = analysis_text.find('{')
            json_end = analysis_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = analysis_text[json_start:json_end]
                try:
                    parsed_data = json.loads(json_str)
                    
                    # Ensure required fields are present
                    parsed_data['ticker'] = ticker
                    parsed_data['analysis_timestamp'] = datetime.now().isoformat()
                    parsed_data['raw_analysis'] = analysis_text
                    
                    # Validate and set default values for expected fields
                    if 'confidence_score' not in parsed_data:
                        parsed_data['confidence_score'] = 0.7
                    if 'summary' not in parsed_data:
                        parsed_data['summary'] = parsed_data.get('analysis', analysis_text[:500])
                    
                    logger.info(f"Successfully parsed structured JSON response for {ticker}")
                    return parsed_data
                    
                except json.JSONDecodeError:
                    logger.warning(f"Found JSON-like structure but failed to parse for {ticker}")
                    # Continue to unstructured parsing
            
            # Enhanced unstructured text parsing
            logger.info(f"Parsing unstructured response for {ticker}")
            structured_analysis = self._parse_unstructured_text(analysis_text, ticker)
            return structured_analysis
                
        except Exception as e:
            logger.error(f"Error parsing analysis response for {ticker}: {str(e)}")
            return {
                "ticker": ticker,
                "analysis_timestamp": datetime.now().isoformat(),
                "raw_analysis": analysis_text,
                "summary": "Analysis parsing failed",
                "confidence_score": 0.3,
                "parsing_error": str(e),  # Changed from 'error' to 'parsing_error'
                "timestamp": datetime.now().timestamp()
            }
    
    def _parse_unstructured_text(self, analysis_text: str, ticker: str) -> Dict[str, Any]:
        """
        Parse unstructured text response into structured format.
        
        Args:
            analysis_text (str): Raw unstructured analysis text
            ticker (str): Stock ticker symbol
            
        Returns:
            Dict[str, Any]: Structured analysis data
        """
        # Initialize structured response
        structured_data = {
            "ticker": ticker,
            "analysis_timestamp": datetime.now().isoformat(),
            "raw_analysis": analysis_text,
            "confidence_score": 0.6,
            "analysis_type": "unstructured_text",
            "parsing_info": "Successfully parsed unstructured text response"
        }
        
        # Extract summary (first paragraph or first 300 characters)
        lines = analysis_text.strip().split('\n')
        first_paragraph = next((line.strip() for line in lines if line.strip()), "")
        if len(first_paragraph) > 300:
            structured_data['summary'] = first_paragraph[:300] + "..."
        else:
            structured_data['summary'] = first_paragraph or analysis_text[:300] + "..."
        
        # Try to extract key insights using keyword matching
        text_lower = analysis_text.lower()
        
        # Extract trend analysis
        if any(word in text_lower for word in ['bullish', 'upward', 'rising', 'positive']):
            structured_data['trend'] = 'bullish'
        elif any(word in text_lower for word in ['bearish', 'downward', 'falling', 'negative']):
            structured_data['trend'] = 'bearish'
        else:
            structured_data['trend'] = 'neutral'
        
        # Extract support/resistance levels if mentioned
        import re
        price_pattern = r'\$?(\d+\.?\d*)'
        prices = re.findall(price_pattern, analysis_text)
        if prices:
            try:
                price_levels = [float(p) for p in prices if float(p) > 1]  # Filter out small numbers
                if price_levels:
                    structured_data['key_levels'] = sorted(set(price_levels))[:5]  # Top 5 unique levels
            except ValueError:
                pass
        
        # Extract key phrases for insights
        insights = []
        sentences = analysis_text.replace('\n', ' ').split('.')
        for sentence in sentences[:3]:  # First 3 sentences
            sentence = sentence.strip()
            if len(sentence) > 20:  # Only meaningful sentences
                insights.append(sentence)
        
        if insights:
            structured_data['key_insights'] = insights
        
        # Set confidence based on content quality
        if len(analysis_text) > 200 and any(word in text_lower for word in ['support', 'resistance', 'trend', 'pattern']):
            structured_data['confidence_score'] = 0.7
        elif len(analysis_text) > 100:
            structured_data['confidence_score'] = 0.6
        else:
            structured_data['confidence_score'] = 0.4
        
        logger.info(f"Successfully parsed unstructured text for {ticker} with confidence {structured_data['confidence_score']}")
        return structured_data
    
    def get_analysis_summary(self, analysis_data: Dict[str, Any]) -> str:
        """
        Generate a concise summary from analysis data.
        
        Args:
            analysis_data (Dict[str, Any]): Full analysis data
            
        Returns:
            str: Concise analysis summary
        """
        try:
            if 'summary' in analysis_data:
                return analysis_data['summary']
            
            # Build summary from components
            summary_parts = []
            
            if 'trend_analysis' in analysis_data:
                trend = analysis_data['trend_analysis']
                summary_parts.append(f"Trend: {trend.get('primary_trend', 'unknown')} ({trend.get('trend_strength', 'unknown')})")
            
            if 'trading_insights' in analysis_data:
                insights = analysis_data['trading_insights']
                risk = insights.get('risk_assessment', 'unknown')
                summary_parts.append(f"Risk: {risk}")
            
            if 'confidence_score' in analysis_data:
                confidence = analysis_data['confidence_score']
                summary_parts.append(f"Confidence: {confidence:.1%}")
            
            return " | ".join(summary_parts) if summary_parts else "Analysis completed"
            
        except Exception as e:
            logger.error(f"Error generating analysis summary: {str(e)}")
            return "Analysis completed with errors"

# Global instance
chart_analyzer = ChartAnalyzer()