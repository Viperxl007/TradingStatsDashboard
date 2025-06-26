"""
Prompt Builder Service

This service builds comprehensive prompts with historical context and forward-looking validation
to enhance AI analysis accuracy while preventing erratic recommendations.
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class PromptBuilderService:
    """Service for building contextual analysis prompts"""
    
    @staticmethod
    def build_contextual_analysis_prompt(ticker: str, timeframe: str, current_price: float,
                                       context: Optional[Dict[str, Any]] = None,
                                       additional_context: str = "") -> str:
        """Build comprehensive prompt with historical context and forward-looking validation"""
        
        logger.info(f"🔨 Building contextual prompt for {ticker} at ${current_price}")
        
        # Base analysis prompt
        base_prompt = f"""
Analyze this {timeframe} chart for {ticker} trading opportunities.

CURRENT MARKET STATE:
- Ticker: {ticker}
- Current Price: ${current_price}
- Timeframe: {timeframe}
        """.strip()
        
        # Add historical context if available
        context_section = ""
        if context and context.get('has_context'):
            context_section = PromptBuilderService._build_context_section(context)
            logger.info(f"📝 Added context section: {context['context_urgency']} ({context['hours_ago']:.1f}h ago)")
        else:
            logger.info("📝 No historical context added - fresh analysis")
            
        # Forward-looking validation requirements
        forward_looking_section = PromptBuilderService._build_forward_looking_section(current_price)
        
        # Additional context
        additional_section = f"\nADDITIONAL CONTEXT:\n{additional_context}" if additional_context else ""
        
        # Combine all sections
        full_prompt = f"""
{base_prompt}

{context_section}

{forward_looking_section}

{additional_section}

ANALYSIS REQUIREMENTS:
□ Provide specific entry/exit levels with clear reasoning
□ Address any existing position status if applicable
□ Ensure all recommendations are actionable from current price
□ Include confidence levels for all recommendations
□ Specify risk/reward ratios
□ MANDATORY: Include a "Context Assessment" section in your response explaining how you addressed any previous positions

RESPONSE FORMAT REQUIREMENT:
Your Stage 4 JSON response MUST include a "context_assessment" field that explains:
- How you evaluated any existing positions
- What decision you made (MAINTAIN/MODIFY/CLOSE/NEW) and why
- CRITICAL: Entry strategy status - was the entry condition triggered or still waiting?
- The specific reasoning for your position assessment
- Any changes from previous recommendations and justification

Example: "context_assessment": "EXISTING POSITION CONFIRMED: The previous buy recommendation at $37.50 remains valid. Entry Strategy Status: The 'pullback' strategy condition 'Wait for pullback to 35.50-36.00 support zone' has NOT been triggered yet - price has not reached the pullback level, so we are still WAITING for entry. The analysis was made 11h ago but NO TRADE was executed - we are still waiting for the pullback condition. Current analysis shows the uptrend is intact with no fundamental changes to market structure. Maintaining the same entry level and strategy as the technical setup remains unchanged."
        """.strip()
        
        logger.info(f"✅ Contextual prompt built - {len(full_prompt)} characters")
        return full_prompt
    
    @staticmethod
    def _build_context_section(context: Dict[str, Any]) -> str:
        """Build the historical context section of the prompt"""
        
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

🚨 CRITICAL REQUIREMENT - EXISTING POSITION ASSESSMENT:
You MUST explicitly address this recent position in your analysis. Choose ONE of the following:

A) MAINTAIN EXISTING POSITION: If the previous recommendation is still valid, state:
   "EXISTING POSITION CONFIRMED: The previous {context['action']} recommendation at ${context.get('entry_price', 'N/A')} remains valid. Current analysis supports maintaining this position."
   
   ⚠️ CRITICAL ENTRY STRATEGY STATUS: The previous recommendation was a "{context.get('entry_strategy', 'unknown')}" strategy with condition: "{context.get('entry_condition', 'No condition specified')}"
   
   🚨 IMPORTANT: The timestamp ({context['hours_ago']:.1f}h ago) refers to when the ANALYSIS was made, NOT when any trade was executed.
   
   🔍 CRITICAL TEMPORAL ANALYSIS: You have the price when the analysis was made (${context.get('previous_analysis_price', 'N/A')}) vs current price (${context.get('current_price', 'N/A')}).
   
   You MUST determine and state:
   - Has this entry condition been triggered SINCE the previous analysis was made?
   - If PULLBACK strategy to ${context.get('entry_price', 'N/A')}: Has price dropped to that level SINCE the analysis was made at ${context.get('previous_analysis_price', 'N/A')}?
   - If BREAKOUT strategy: Has the breakout occurred with volume SINCE the analysis was made?
   - Current status: WAITING for entry condition OR entry condition has been TRIGGERED since analysis
   
   ⚠️ DO NOT assume the trade was executed just because an analysis was made. The analysis timestamp ≠ trade execution.
   ⚠️ DO NOT assume entry condition was triggered just because price hit that level at some point - it must have happened AFTER the analysis.
   
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
    
    @staticmethod
    def _build_forward_looking_section(current_price: float) -> str:
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