"""
Prompt Builder Service

This service builds comprehensive prompts with historical context and forward-looking validation
to enhance AI analysis accuracy while preventing erratic recommendations.

VERSION 2.0 ENHANCEMENTS:
- Macro context integration
- Quality scoring system
- Historical performance feedback
- Enhanced "No Trade" emphasis
- Systematic quality gates
"""

import logging
import sqlite3
import os
import numpy as np
from datetime import datetime, timezone
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class PromptBuilderService:
    """Service for building contextual analysis prompts with V2 enhancements"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize with database path for historical performance tracking"""
        self.db_path = db_path or os.path.join(os.path.dirname(__file__), '..', 'instance', 'chart_analysis.db')
    
    def _build_macro_context_section(self) -> str:
        """Get latest macro sentiment for context"""
        try:
            from .macro_ai_service import get_latest_macro_sentiment
            macro = get_latest_macro_sentiment()
            
            if not macro:
                return ""
            
            # Only include if analysis is recent (< 24 hours old)
            if macro.get('analysis_timestamp'):
                age_hours = (datetime.now().timestamp() - macro['analysis_timestamp']) / 3600
                if age_hours > 24:
                    return ""
            
            return f"""
MARKET MACRO CONTEXT (Overall Market Conditions):
- Market Confidence: {macro.get('overall_confidence', 0)}%
- BTC Trend: {macro.get('btc_trend_direction', 'UNKNOWN')} ({macro.get('btc_trend_strength', 0)}% strength)
- Trade Permission: {macro.get('trade_permission', 'UNKNOWN')}
- Market Regime: {macro.get('market_regime', 'UNKNOWN')}

⚠️ MACRO FILTER RULES:
- If Trade Permission is NO_TRADE: DO NOT recommend any trades regardless of chart setup
- If Trade Permission is SELECTIVE: Only recommend trades with 80%+ confidence
- If Market Confidence < 40%: Reduce position sizes by 50% or recommend NO TRADE
- If asset is moving against macro trend: Require higher confidence (70%+)
"""
        except Exception as e:
            logger.warning(f"Could not get macro context: {e}")
            return ""
    
    def _get_historical_performance_context(self, ticker: str) -> str:
        """Get historical win/loss rate for this ticker"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get last 20 completed trades for this ticker
                cursor.execute('''
                    SELECT status, entry_price, close_price, realized_pnl, close_reason
                    FROM active_trades
                    WHERE ticker = ? AND status IN ('profit_hit', 'stop_hit', 'user_closed')
                    ORDER BY close_time DESC
                    LIMIT 20
                ''', (ticker.upper(),))
                
                trades = cursor.fetchall()
                
                if not trades:
                    return ""
                
                wins = sum(1 for t in trades if t[0] == 'profit_hit')
                win_rate = (wins / len(trades)) * 100
                
                # Calculate average win/loss percentages
                win_pnls = [t[3] for t in trades if t[0] == 'profit_hit' and t[3] is not None]
                loss_pnls = [abs(t[3]) for t in trades if t[0] in ['stop_hit', 'user_closed'] and t[3] is not None and t[3] < 0]
                
                avg_win = np.mean(win_pnls) if win_pnls else 0
                avg_loss = np.mean(loss_pnls) if loss_pnls else 0
                
                return f"""
HISTORICAL PERFORMANCE FOR {ticker}:
- Last {len(trades)} trades: {win_rate:.1f}% win rate
- Average Win: +${avg_win:.2f}
- Average Loss: -${avg_loss:.2f}

⚠️ CALIBRATION NOTICE:
{"This ticker has been UNDERPERFORMING. Be extra selective." if win_rate < 40 else ""}
{"This ticker has normal performance. Standard criteria apply." if 40 <= win_rate <= 60 else ""}
{"This ticker has been OVERPERFORMING. Maintain discipline, don't get greedy." if win_rate > 60 else ""}
"""
        except Exception as e:
            logger.warning(f"Could not get historical performance: {e}")
            return ""
    
    def build_contextual_analysis_prompt(self, ticker: str, timeframe: str, current_price: float,
                                       context: Optional[Dict[str, Any]] = None,
                                       additional_context: str = "") -> str:
        """Build comprehensive prompt with macro context, quality gates, and historical performance feedback (V2)"""
        
        logger.info(f"🔨 Building enhanced contextual prompt for {ticker} at ${current_price}")
        
        # Get macro context
        macro_context = self._build_macro_context_section()
        
        # Get historical performance
        performance_context = self._get_historical_performance_context(ticker)
        
        # Build the complete prompt
        prompt = f"""
COMPREHENSIVE CHART ANALYSIS REQUEST FOR {ticker}

CURRENT MARKET STATE:
- Ticker: {ticker}
- Current Price: ${current_price}
- Timeframe: {timeframe}

{macro_context}

{performance_context}

QUALITY GATES (Most should pass for trade recommendation):
□ Trend clarity score ≥ 7/10 
□ Support/Resistance quality ≥ 6/10 
□ Risk/Reward ratio ≥ 2:1 
□ Overall setup quality ≥ 60% 
□ No conflict with macro trend (if macro confidence < 60%, require 70%+ setup quality)

ANALYSIS FRAMEWORK:

1. SETUP QUALITY SCORING (MANDATORY):
Rate each factor 1-10:
- Trend Clarity: _/10
- Support/Resistance Quality: _/10
- Volume Confirmation: _/10
- Pattern Completion: _/10
- Risk/Reward Ratio: _/10
- Momentum Alignment: _/10
OVERALL QUALITY: _% (average × 10)

2. TRADE DECISION MATRIX:
- 80-100% Quality + Good Macro = HIGH CONFIDENCE TRADE (full size)
- 70-79% Quality + Good Macro = MODERATE TRADE (half size)
- 65-69% Quality + Bad Macro = LOW CONFIDENCE TRADE (quarter size)
- Below 65% Quality = NO TRADE (regardless of macro)

3. NO TRADE SCENARIOS (SELECTIVE POSITION):
You should recommend NO TRADE if MULTIPLE of these conditions exist:
- Choppy/unclear price action AND low quality score
- Risk/Reward below 1.5:1 AND poor trend clarity
- Quality score below 50% (not 60% - be less restrictive)
- Macro Trade Permission is NO_TRADE (hard rule)
- Multiple conflicting timeframe signals
- Very low volume AND poor liquidity

4. MANDATORY SKIP CONDITIONS (Any ONE of these = NO TRADE):
- Risk/Reward below 2:1
- Quality score below 65%
- Macro Trade Permission is NO_TRADE

IMPORTANT: "NO TRADE" should be used when setups are genuinely poor quality. Look for valid trading opportunities with reasonable quality scores (50%+). Professional traders are selective but still find 20-30% of setups tradeable.

{self._build_context_section(context) if context else ""}

{self._build_forward_looking_section(current_price)}

{additional_context}

RESPONSE REQUIREMENTS:
Your response MUST include:

1. QUALITY ASSESSMENT SECTION:
"Quality Score: X%
- Trend Clarity: X/10
- Support/Resistance: X/10
- Volume: X/10
- Risk/Reward: X/10
Trade Decision: [HIGH_CONFIDENCE/MODERATE/NO_TRADE]"

2. If recommending a trade, include:
- Entry price with SPECIFIC trigger condition
- Stop loss with clear invalidation reasoning
- Target with realistic probability assessment
- Position size recommendation based on quality

3. If recommending NO TRADE, include:
- Specific reasons why setup doesn't qualify
- What would need to change for a valid setup
- Suggested monitoring levels

Remember: Professional traders are selective but still find 20-30% of setups tradeable. Quality over quantity ALWAYS wins.
Default to NO TRADE unless the setup is exceptional.

PROMPT VERSION: v2.0 (Enhanced with macro context, quality gates, and historical performance)
"""
        
        logger.info(f"✅ Enhanced contextual prompt built - {len(prompt)} characters")
        return prompt
    
    def _build_context_section(self, context: Dict[str, Any]) -> str:
        """Build the historical context section of the prompt"""
        
        # Defensive programming: Ensure required keys exist
        if 'context_urgency' not in context:
            logger.warning("Missing 'context_urgency' key in context, defaulting to 'reference'")
            context['context_urgency'] = 'reference'
        
        if 'context_message' not in context:
            logger.warning("Missing 'context_message' key in context, using default message")
            context['context_message'] = "Previous analysis context"
        
        # Build trigger status section
        trigger_section = ""
        if context.get('trigger_hit'):
            trigger_details = context.get('trigger_details', {})
            trigger_section = f"""
🎯 ENTRY TRIGGER STATUS: ✅ TRIGGERED
{context.get('trigger_message', 'Entry trigger was hit')}
- Trigger occurred at: {trigger_details.get('trigger_time', 'Unknown time')}
- Trigger price: ${trigger_details.get('trigger_price', 'N/A')}
- Target entry price: ${trigger_details.get('entry_price', 'N/A')}

🚨 CRITICAL: The entry condition HAS BEEN TRIGGERED since the last analysis. You must acknowledge this in your assessment.
"""
        else:
            trigger_section = f"""
🎯 ENTRY TRIGGER STATUS: ⏳ NOT TRIGGERED
The entry condition has NOT been triggered since the last analysis.
- Entry price target: ${context.get('entry_price', 'N/A')}
- Current price: ${context.get('current_price', 'N/A')}
- Status: Still WAITING for entry condition to be met
"""
        
        if context['context_urgency'] == 'recent':
            return f"""
{context['context_message']}:
- Action: {context['action']} at ${context.get('entry_price', 'N/A')}
- Entry Strategy: {context.get('entry_strategy', 'unknown')}
- Entry Condition: {context.get('entry_condition', 'No condition specified')}
- Price when analysis was made: ${context.get('previous_analysis_price', 'N/A')}
- Current price: ${context.get('current_price', 'N/A')}
- Target: ${context.get('target_price', 'N/A')} | Stop: ${context.get('stop_loss', 'N/A')}
- Sentiment: {context['sentiment']} (confidence: {context.get('confidence', 0):.2f})
- Reasoning: {context.get('reasoning', 'N/A')[:150]}...

{trigger_section}

🚨 CRITICAL REQUIREMENT - EXISTING POSITION ASSESSMENT:
You MUST explicitly address this recent position in your analysis. Choose ONE of the following:

A) MAINTAIN EXISTING POSITION: If the previous recommendation is still valid, state:
   "EXISTING POSITION CONFIRMED: The previous {context['action']} recommendation at ${context.get('entry_price', 'N/A')} remains valid. Current analysis supports maintaining this position."
   
   ⚠️ CRITICAL ENTRY STRATEGY STATUS: The previous recommendation was a "{context.get('entry_strategy', 'unknown')}" strategy with condition: "{context.get('entry_condition', 'No condition specified')}"
   
   🚨 IMPORTANT: The timestamp ({context['hours_ago']:.1f}h ago) refers to when the ANALYSIS was made, NOT when any trade was executed.
   
   🔍 ENTRY TRIGGER ANALYSIS: Based on candlestick data analysis:
   {"✅ ENTRY TRIGGER HAS BEEN HIT - " + context.get('trigger_message', '') if context.get('trigger_hit') else "⏳ ENTRY TRIGGER NOT YET HIT - Still waiting for entry condition"}
   
   ⚠️ IMPORTANT: If maintaining, you MUST use the EXACT SAME entry price (${context.get('entry_price', 'N/A')}) in your recommendations.
   DO NOT suggest a different entry price unless there's a fundamental change in market structure.

B) MODIFY EXISTING POSITION: If adjustments are needed, state:
   "POSITION MODIFICATION: The previous {context['action']} at ${context.get('entry_price', 'N/A')} needs adjustment due to [specific reason]. New levels: [specify changes]"

C) CLOSE EXISTING POSITION: If the position should be closed, state:
   "POSITION CLOSURE: The previous {context['action']} at ${context.get('entry_price', 'N/A')} should be closed due to [specific fundamental change]. Reason: [explain what changed]"

D) NEW POSITION (ONLY if fundamentally different): If recommending a completely new position, you MUST:
   1. First address the existing position status
   2. Explain what FUNDAMENTALLY changed to invalidate the previous analysis
   3. Justify why a new position is warranted instead of modifying the existing one

🔒 CONSISTENCY RULE: Unless there's a clear fundamental change (major support/resistance break, trend reversal, etc.),
you should MAINTAIN the existing position with the SAME entry price. Minor price movements do NOT justify new entry levels.

⚠️ DO NOT ignore the existing position. You must explicitly reference it in your recommendations section.
            """.strip()
            
        elif context['context_urgency'] == 'active':
            return f"""
{context['context_message']}:
- Action: {context['action']} at ${context.get('entry_price', 'N/A')}
- Entry Strategy: {context.get('entry_strategy', 'unknown')}
- Entry Condition: {context.get('entry_condition', 'No condition specified')}
- Price when analysis was made: ${context.get('previous_analysis_price', 'N/A')}
- Current price: ${context.get('current_price', 'N/A')}
- Target: ${context.get('target_price', 'N/A')} | Stop: ${context.get('stop_loss', 'N/A')}
- Original sentiment: {context['sentiment']}
- Original reasoning: {context.get('summary', 'N/A')[:150]}...

{trigger_section}

📊 ACTIVE POSITION ASSESSMENT REQUIRED:
You MUST evaluate the existing position and provide explicit guidance:

1. POSITION STATUS: Is the {context['action']} position at ${context.get('entry_price', 'N/A')} still valid?

2. ENTRY STRATEGY STATUS: The previous recommendation was a "{context.get('entry_strategy', 'unknown')}" strategy with condition: "{context.get('entry_condition', 'No condition specified')}"
   
   🚨 IMPORTANT: The timestamp ({context['hours_ago']:.1f}h ago) refers to when the ANALYSIS was made, NOT when any trade was executed.
   
   🔍 CRITICAL TEMPORAL ANALYSIS: You have the price when the analysis was made (${context.get('previous_analysis_price', 'N/A')}) vs current price (${context.get('current_price', 'N/A')}).
   
   You MUST determine and state:
   - Has this entry condition been triggered SINCE the previous analysis was made?
   - If PULLBACK strategy to ${context.get('entry_price', 'N/A')}: Has price dropped to that level SINCE the analysis was made at ${context.get('previous_analysis_price', 'N/A')}?
   - If BREAKOUT strategy: Has the breakout occurred with volume SINCE the analysis was made?
   - Current position status: WAITING for entry condition OR entry condition has been TRIGGERED since analysis
   
   ⚠️ DO NOT assume the trade was executed just because an analysis was made. The analysis timestamp ≠ trade execution.
   ⚠️ DO NOT assume entry condition was triggered just because price hit that level at some point - it must have happened AFTER the analysis.

3. CURRENT EVALUATION: Based on current chart conditions, should this position be:
   - MAINTAINED (if thesis still holds) - DEFAULT CHOICE unless fundamentally changed
   - MODIFIED (if levels need adjustment)
   - CLOSED (if thesis invalidated)
   - REPLACED (if fundamentally different opportunity exists)

4. EXPLICIT RECOMMENDATION: You must state one of:
   "MAINTAIN: Continue holding the {context['action']} position from ${context.get('entry_price', 'N/A')}"
   "MODIFY: Adjust the {context['action']} position levels to [new levels] due to [reason]"
   "CLOSE: Exit the {context['action']} position due to [specific change in thesis]"
   "REPLACE: Close existing position and enter new position due to [fundamental change]"

🔒 BIAS TOWARD CONSISTENCY: Unless there's a clear fundamental change in market structure,
you should DEFAULT to MAINTAINING the existing position. Minor price fluctuations do NOT justify position changes.

⚠️ Do not provide new recommendations without first addressing the existing position status.
If you choose MAINTAIN, use the EXACT SAME entry price in your recommendations.
            """.strip()
            
        else:  # reference or error
            return f"{context['context_message']}"
    
    def _build_active_trade_context_section(self, context: Dict[str, Any]) -> str:
        """Build the active trade context section of the prompt"""
        
        trade_status = context.get('status', 'unknown')
        action = context.get('action', 'unknown')
        entry_price = context.get('entry_price', 0)
        target_price = context.get('target_price')
        stop_loss = context.get('stop_loss')
        current_price = context.get('current_price', 0)
        # Safe handling of potentially None values
        unrealized_pnl = context.get('unrealized_pnl')
        if unrealized_pnl is None:
            unrealized_pnl = 0
        time_since_creation = context.get('time_since_creation_hours', 0)
        time_since_trigger = context.get('time_since_trigger_hours')
        
        if trade_status == 'waiting':
            return f"""
🎯 ACTIVE TRADE MONITORING - WAITING FOR ENTRY:
- Trade ID: {context.get('trade_id')}
- Action: {action.upper()} at ${entry_price}
- Entry Strategy: {context.get('entry_strategy', 'unknown')}
- Entry Condition: {context.get('entry_condition', 'No condition specified')}
- Target: ${target_price} | Stop: ${stop_loss}
- Current Price: ${current_price}
- Time Since Setup: {time_since_creation:.1f} hours
- Status: WAITING for entry trigger

🚨 CRITICAL - ACTIVE TRADE ASSESSMENT REQUIRED:
You MUST acknowledge this WAITING trade and assess its current status:

A) MAINTAIN WAITING POSITION: If the entry condition is still valid, state:
   "ACTIVE TRADE CONFIRMED: Maintaining {action.upper()} setup at ${entry_price}. Entry condition '{context.get('entry_condition', 'unknown')}' has not been triggered yet. Current analysis supports continuing to wait for entry."

B) MODIFY ENTRY LEVELS: If market conditions have changed, state:
   "TRADE MODIFICATION: Adjusting {action.upper()} entry from ${entry_price} to [new price] due to [specific market structure change]."

C) CANCEL WAITING TRADE: If the setup is no longer valid, state:
   "TRADE CANCELLATION: Canceling {action.upper()} setup at ${entry_price} due to [specific reason - trend invalidation/market structure change]."

🔒 CONSISTENCY RULE: Unless there's a fundamental change in market structure, you should MAINTAIN the existing trade setup.
The trade was created {time_since_creation:.1f} hours ago and is still waiting for the entry condition to be met.

⚠️ You MUST explicitly address this waiting trade in your recommendations. Do not ignore it or create conflicting recommendations.
            """.strip()
            
        elif trade_status == 'active':
            # Safe PnL formatting - handle None values
            pnl_text = f"${unrealized_pnl:.2f}" if unrealized_pnl is not None and unrealized_pnl != 0 else "$0.00"
            pnl_status = "profit" if unrealized_pnl and unrealized_pnl > 0 else "loss" if unrealized_pnl and unrealized_pnl < 0 else "breakeven"
            
            # Safe time formatting - handle None values
            time_text = f"{time_since_trigger:.1f} hours" if time_since_trigger is not None else "Unknown"
            
            return f"""
🎯 ACTIVE TRADE MONITORING - TRADE IS OPEN:
- Trade ID: {context.get('trade_id')}
- Position: {action.upper()} at ${entry_price}
- Current Price: ${current_price}
- Target: ${target_price} | Stop: ${stop_loss}
- Unrealized P&L: {pnl_text} ({pnl_status})
- Time Since Entry: {time_text}
- Max Favorable: ${context.get('max_favorable_price', entry_price)}
- Max Adverse: ${context.get('max_adverse_price', entry_price)}
- Status: ACTIVE TRADE IN PROGRESS

🚨 CRITICAL - ACTIVE TRADE MANAGEMENT REQUIRED:
You MUST acknowledge this ACTIVE trade and provide explicit guidance:

A) MAINTAIN ACTIVE POSITION: If the trade thesis still holds, state:
   "ACTIVE TRADE CONFIRMED: Maintaining {action.upper()} position from ${entry_price}. Current P&L: {pnl_text}. Technical analysis supports holding the position toward target ${target_price}."

B) SUGGEST EARLY CLOSE: ONLY if there are overwhelming technical reasons, state:
   "EARLY CLOSE RECOMMENDED: Close {action.upper()} position at ${current_price} due to [CRITICAL market structure change]. Reason: [specific technical invalidation]."
   
   ⚠️ IMPORTANT: Early close should ONLY be suggested for:
   - Major trend reversal with strong confirmation
   - Critical support/resistance break with volume
   - Fundamental market structure change
   - NOT for minor pullbacks or temporary weakness

C) ADJUST STOP/TARGET: If risk management needs updating, state:
   "POSITION ADJUSTMENT: Modify stop loss to [new level] and/or target to [new level] due to [specific technical development]."

🔒 BIAS TOWARD HOLDING: Unless there's overwhelming evidence of trend invalidation or major market structure change,
you should DEFAULT to maintaining the active position. The trade is currently showing {pnl_status} of {pnl_text}.

⚠️ You MUST explicitly address this active trade. Do not provide conflicting recommendations or ignore the open position.
            """.strip()
            
        else:
            return f"""
🎯 TRADE STATUS: {trade_status.upper()}
- Previous {action.upper()} trade at ${entry_price}
- Current Price: ${current_price}
- Status: Trade is no longer active

📊 FRESH ANALYSIS: Since the previous trade is closed, you may provide new recommendations based on current market conditions.
            """.strip()
    
    def _build_forward_looking_section(self, current_price: float) -> str:
        """Build the forward-looking validation section"""
        return f"""
CRITICAL FORWARD-LOOKING REQUIREMENTS:
🎯 Current price is ${current_price} - ALL recommendations must be actionable from this level

ENTRY SPECIFICATION REQUIREMENTS:
- If entry price > current price: State "waiting for breakout above ${current_price}"
- If entry price < current price: State "waiting for pullback to [price]" 
- If entry price ≈ current price: State "immediate entry opportunity"
- If suggesting retest of a level: Explicitly state "on retest of [level]"

VALIDATION CHECKLIST:
□ Entry strategy clearly defined (immediate/pullback/breakout/retest)
□ Price relationship to current level specified  
□ Time horizon for entry opportunity stated
□ Risk management levels forward-looking
        """.strip()