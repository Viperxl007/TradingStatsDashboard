IMPORTANT NOTE: THIS FEATURE IS COMPLETED!!! DO NOT RE-IMPLEMENT!!!


Algorithmic Selection Criteria

On the "Direct Search" sub-tab inside the "Options Earnings" tab I want to add an enhancement.

THIS IS A TRUE ENHANCEMENT - OTHER ELEMENENTS OF THE DASHBOARD AND FUNCTIONAL LOGIC SHOULD NOT BE ALTERED.

In the summary box (where the Analysis Metrics are displayed for the stock ticker being searched) I want to add a sub-section inside that box called "Optimal Spread".

The purpose of this sub-section is to show that if the 3 analysis metrics are met with a "Pass" rating - then the next step in the process is to select the optimal spread on that underlying (no optimal spreads available is also a completely valid situation).  We need to algorithmically identify the optimal calendar spread.  Below is some EXAMPLE code on MAYBE how to best algorithmically calculate the optimal spread for the ticker.  Please review and implment this feature - ONLY implement this feature and do not disturb the existing functionality of the dashboard, stay focused on this enhancement task.  The code below is guidance and if there is a smarter or more efficient or relevant way to do something specific to our project - please choose the solution that makes the most sense.  The code was generated outside of this project so not all project details were known to the code generator.  Use your best judgement and context of the actual project environment.

To algorithmically identify the optimal calendar spread once a ticker meets the initial criteria, you could extend the script to evaluate these additional factors:

pythondef find_optimal_calendar_spread(ticker, front_month_exp, back_month_exp_options=[30, 45, 60]):
    # Get options chain data
    stock = yf.Ticker(ticker)
    current_price = get_current_price(stock)
    
    best_spread = None
    best_score = 0
    
    # First, find the front month expiration
    exp_dates = filter_dates(stock.options)
    front_month = exp_dates[0]
    
    # For each potential back month expiration
    for days_out in back_month_exp_options:
        target_date = (datetime.today() + timedelta(days=days_out)).date()
        back_month = find_closest_expiration(exp_dates, target_date)
        
        # For each strike near current price (e.g., ±10%)
        for strike in get_strikes_near_price(stock, front_month, current_price, range_percent=10):
            # Calculate key metrics for this potential spread
            front_iv = get_atm_iv(stock, front_month, strike)
            back_iv = get_atm_iv(stock, back_month, strike)
            iv_differential = front_iv - back_iv
            
            # Get pricing information
            spread_cost = calculate_spread_cost(stock, front_month, back_month, strike)
            
            # Calculate liquidity metrics
            front_liquidity = get_liquidity_score(stock, front_month, strike)
            back_liquidity = get_liquidity_score(stock, back_month, strike)
            
            # Calculate a composite score
            score = calculate_spread_score(
                iv_differential, 
                spread_cost,
                front_liquidity,
                back_liquidity,
                strike_distance_from_atm=abs(strike - current_price)
            )
            
            if score > best_score:
                best_score = score
                best_spread = {
                    'strike': strike,
                    'front_month': front_month,
                    'back_month': back_month,
                    'spread_cost': spread_cost,
                    'iv_differential': iv_differential,
                    'score': score
                }
    
    # Set a minimum threshold score
    if best_score < MINIMUM_VIABLE_SCORE:
        return None  # No worthwhile play
    
    return best_spread


The key factors to include in your calculate_spread_score function:

IV Differential: Higher front-month IV compared to back-month (absolute difference)
IV Differential Ratio: Front-month IV divided by back-month IV (relative difference)
Cost Efficiency: IV differential divided by spread cost (bang for your buck)
Liquidity: Tighter bid-ask spreads in both options
Delta Neutrality: How close the strike is to current price (lower is better for pure volatility plays)
Days Between Expirations: Optimal separation (typically 30-45 days)
Time Until Front Expiration: Ideally 2-5 days after earnings

You might weight these factors differently based on your own trading priorities. For example, if minimizing capital requirements is important, you'd weight the cost efficiency factor higher.
The algorithm should also have a threshold score below which it indicates "no worthwhile play" even if the stock meets the three initial criteria. This prevents taking trades with marginal edge.