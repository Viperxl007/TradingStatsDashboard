Lets add a NEW feature - this new feature will be on the Options Earnings tab and we'll make a new sub-tab called "Naked" (please also rename the "Scan" tab to "Calender Spreads"

The new naked sub-tab will have the same scanning abilities as the current "Scan" tab so it should use a VERY similar setup as far as the scan buttons and using the calendar to select specific dates to scan as well as it will produce a ranking of tickers with earnings on that date but for the naked tab it will rank based on opportunity potential by evaluating naked single options premium selling rather than the calendar spread strategy of the other tab.  It will still utilize the same 3 core calculations though: The Volume - the IV30/RV30 calculation and the TS Slope here are more specific details about the new feature implementation:

Naked Options Earnings Strategy Screener
Background Context
We have an existing Options Earnings Dashboard with a Calendar Spread feature that uses three core metrics:

IV/RV ratio (≥1.25) - Implied vs. Realized Volatility
Term Structure Slope (≤-0.00406) - Negative slope indicating backwardation
Average Volume (≥1,500,000) - Ensuring sufficient liquidity

These metrics help identify opportunities where options are overpriced relative to historical movement, especially around earnings events.
New Feature Request
Create a "Naked" screener functionality that:

Uses the same core 3 metrics as the calendar spread screener
Specifically targets opportunities for selling naked options to profit from post-earnings volatility crush
Ranks and identifies the most favorable strike/expiration combinations for a naked option selling strategy

We are still only focusing on tickers with earnings for the date selected.

Technical Requirements
Data Analysis Engine

Enhance the existing analyze_options function to add a naked options analysis section
Implement a new find_optimal_naked_options function that evaluates individual options rather than spreads
Maintain compatibility with the existing data fetching mechanisms (yfinance, etc.)

Key Metrics and Adjustments

Distance from Current Price:

Focus on OTM options with delta values between 0.15-0.40
Rank by optimal risk/reward balance in relation to strike distance

Expected Move Analysis:

Calculate probability of the stock remaining OTM based on the expected move
Use the straddle price to derive expected move % and compare with historical earnings moves

Premium Efficiency:

Calculate return on capital (ROC) for each potential trade
Evaluate the premium received relative to margin requirements
Score options based on premium captured per unit of risk

IV Crush Potential:

Estimate post-earnings IV using historical IV crush patterns
Prioritize options with higher potential IV reduction percentages

Ranking System

Create a composite scoring function for naked options that weights:

IV/RV ratio (30%)
Delta/probability of profit (25%)
Premium efficiency (25%)
Liquidity metrics (10%)
Historical earnings behavior (10%)


Include risk metrics:

Maximum possible loss
Margin requirements
Risk/reward ratio



Output Format

Return a structured output with top 3-5 naked options opportunities ranked by score
For each opportunity include:

Option details (strike, expiration, type)
Premium and ROC
Probability metrics
Risk assessment
Recommended position sizing

Implementation Notes

Emphasize risk management given the unlimited risk profile of naked options
Add configurable risk tolerance parameters
Focus on efficiency by pre-filtering for obviously unsuitable candidates
Consider both calls and puts, with a preference for puts in uncertain market environments
Allow customizable weightings for the ranking algorithm

The code should leverage the existing Yang-Zhang volatility estimator and term structure analysis while adapting them specifically for evaluating individual options rather than spreads.

PRIORITY DIRECTIVES: DO NOT MOCK ANY DATA - ALL DATA SHOULD BE REAL DATA FETCHED FROM THE APPROPRIATE APIs.

IF THERE IS A WAY TO INTEGRATE THIS NEW FEATURE INTO THE EXISTING SCAN SUB-TAB AND STILL BE USER FRIENDLY, THEN THAT'S ACCEPTABLE AND THIS CAN BE COMBINED INTO THE EXISTING SCAN TAB FOR ONE SINGLE INTERFACE (No need to rename the scan tab in this case) - If there are unique aspects to the naked screener that would be too confusing in one primary tab then go ahead and go the second tab route.  Use your best judgement on the design for the optimal user experience and usage efficiency.

DO NOT CHANGE ANY EXISTING LOGIC UNRELATED TO THIS FEATURE - PRESERVE ALL FUNCTIONALITY THAT CURRENTLY EXISTS.