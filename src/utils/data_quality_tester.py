import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
from scipy.interpolate import interp1d
import requests
import json

# Function to calculate Yang-Zhang volatility
def yang_zhang(price_data, window=30, trading_periods=252):
    log_ho = (price_data['High'] / price_data['Open']).apply(np.log)
    log_lo = (price_data['Low'] / price_data['Open']).apply(np.log)
    log_co = (price_data['Close'] / price_data['Open']).apply(np.log)
    
    log_oc = (price_data['Open'] / price_data['Close'].shift(1)).apply(np.log)
    log_oc_sq = log_oc**2
    
    log_cc = (price_data['Close'] / price_data['Close'].shift(1)).apply(np.log)
    log_cc_sq = log_cc**2
    
    rs = log_ho * (log_ho - log_co) + log_lo * (log_lo - log_co)
    
    close_vol = log_cc_sq.rolling(window=window, center=False).sum() * (1.0 / (window - 1.0))
    open_vol = log_oc_sq.rolling(window=window, center=False).sum() * (1.0 / (window - 1.0))
    window_rs = rs.rolling(window=window, center=False).sum() * (1.0 / (window - 1.0))

    k = 0.34 / (1.34 + ((window + 1) / (window - 1)))
    result = (open_vol + k * close_vol + (1 - k) * window_rs).apply(np.sqrt) * np.sqrt(trading_periods)
    
    return result.iloc[-1]

# Function to calculate term structure slope
def calculate_term_structure_slope(ticker):
    stock = yf.Ticker(ticker)
    
    # Get current price
    current_price = stock.history(period='1d')['Close'].iloc[-1]
    
    # Get options expirations
    exp_dates = stock.options
    
    if not exp_dates:
        return None, None, None
    
    # Calculate ATM IV for each expiration
    today = datetime.today().date()
    dtes = []
    ivs = []
    
    for exp_date in exp_dates[:8]:  # Limit to 8 expirations for clarity
        try:
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_expiry = (exp_date_obj - today).days
            
            chain = stock.option_chain(exp_date)
            calls = chain.calls
            puts = chain.puts
            
            if calls.empty or puts.empty:
                continue
                
            # Find ATM options
            call_diffs = (calls['strike'] - current_price).abs()
            call_idx = call_diffs.idxmin()
            call_iv = calls.loc[call_idx, 'impliedVolatility']
            
            put_diffs = (puts['strike'] - current_price).abs()
            put_idx = put_diffs.idxmin()
            put_iv = puts.loc[put_idx, 'impliedVolatility']
            
            # Average of call and put IV
            atm_iv = (call_iv + put_iv) / 2.0
            
            dtes.append(days_to_expiry)
            ivs.append(atm_iv)
            
            print(f"Expiration: {exp_date} (DTE: {days_to_expiry}), ATM IV: {atm_iv:.4f}")
        except Exception as e:
            print(f"Error processing {exp_date}: {e}")
    
    if len(dtes) < 2:
        return None, None, None
    
    # Sort by days to expiry
    sorted_idx = np.argsort(dtes)
    dtes = [dtes[i] for i in sorted_idx]
    ivs = [ivs[i] for i in sorted_idx]
    
    # Build term structure
    term_spline = interp1d(dtes, ivs, kind='linear', fill_value="extrapolate")
    
    # Calculate slope
    if dtes[0] < 45:
        ts_slope_0_45 = (term_spline(45) - term_spline(dtes[0])) / (45 - dtes[0])
    else:
        ts_slope_0_45 = 0  # Default if no near-term expiration
        
    return dtes, ivs, ts_slope_0_45

# Function to calculate IV/RV ratio
def calculate_iv_rv_ratio(ticker):
    stock = yf.Ticker(ticker)
    
    # Get price history
    price_history = stock.history(period='3mo')
    if len(price_history) < 30:
        return None, None, None
    
    # Calculate realized volatility using Yang-Zhang
    rv = yang_zhang(price_history)
    
    # Get IV for 30 days
    dtes, ivs, _ = calculate_term_structure_slope(ticker)
    if not dtes or not ivs:
        return rv, None, None
    
    # Build term structure
    term_spline = interp1d(dtes, ivs, kind='linear', fill_value="extrapolate")
    
    # Get 30-day IV
    if min(dtes) <= 30 <= max(dtes):
        iv30 = term_spline(30)
    elif min(dtes) > 30:
        iv30 = ivs[0]  # Use closest available
    else:
        iv30 = ivs[-1]  # Use closest available
    
    # Calculate IV/RV ratio
    iv_rv_ratio = iv30 / rv
    
    return rv, iv30, iv_rv_ratio

# Compare with alternative sources when possible
def compare_with_alternative_sources(ticker):
    # This is a placeholder - you'd need to implement API calls to other data providers
    # Examples might include:
    # - CBOE data
    # - IVolatility.com
    # - Interactive Brokers API
    # - TradingView API
    
    print("Note: To fully validate, subscribe to additional data sources such as:")
    print("- CBOE DataShop")
    print("- IVolatility.com")
    print("- Interactive Brokers API")
    print("- Bloomberg Terminal")
    
    return None

# Main function to test a ticker
def test_options_metrics(ticker):
    print(f"\n{'='*50}")
    print(f"Testing Options Metrics for {ticker}")
    print(f"{'='*50}")
    
    # Get basic info
    stock = yf.Ticker(ticker)
    current_price = stock.history(period='1d')['Close'].iloc[-1]
    avg_volume = stock.history(period='30d')['Volume'].mean()
    
    print(f"Current Price: ${current_price:.2f}")
    print(f"30-day Avg Volume: {avg_volume:.0f}")
    
    # Calculate IV/RV ratio
    print("\n--- IV/RV Ratio Calculation ---")
    rv, iv30, iv_rv_ratio = calculate_iv_rv_ratio(ticker)
    
    if rv is not None:
        print(f"Yang-Zhang RV (30-day): {rv:.4f}")
    else:
        print("Could not calculate RV")
    
    if iv30 is not None:
        print(f"Implied Volatility (30-day): {iv30:.4f}")
    else:
        print("Could not calculate 30-day IV")
    
    if iv_rv_ratio is not None:
        print(f"IV/RV Ratio: {iv_rv_ratio:.4f}")
        print(f"Meets threshold (>=1.25): {'Yes' if iv_rv_ratio >= 1.25 else 'No'}")
    else:
        print("Could not calculate IV/RV ratio")
    
    # Calculate term structure slope
    print("\n--- Term Structure Slope Calculation ---")
    dtes, ivs, ts_slope = calculate_term_structure_slope(ticker)
    
    if ts_slope is not None:
        print(f"Term Structure Slope (0-45 days): {ts_slope:.6f}")
        print(f"Meets threshold (≤-0.00406): {'Yes' if ts_slope <= -0.00406 else 'No'}")
    else:
        print("Could not calculate term structure slope")
    
    # Plot term structure if data is available
    if dtes and ivs:
        plt.figure(figsize=(10, 6))
        plt.plot(dtes, ivs, 'o-', label='IV Term Structure')
        plt.xlabel('Days to Expiration')
        plt.ylabel('Implied Volatility')
        plt.title(f'{ticker} Implied Volatility Term Structure')
        plt.grid(True)
        plt.legend()
        plt.show()
    
    # Compare with alternative sources
    print("\n--- Comparison with Alternative Sources ---")
    compare_with_alternative_sources(ticker)

# Test a few tickers
test_tickers = ["SPY", "AAPL", "MSFT", "NVDA", "TSLA"]
for ticker in test_tickers:
    test_options_metrics(ticker)