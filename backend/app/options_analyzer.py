"""
Options Analyzer Module

This module contains the core analysis functions for options data.
Extracted and refactored from the original calculator.py file.
"""

import numpy as np
from datetime import datetime, timedelta
from scipy.interpolate import interp1d
from app.data_fetcher import get_stock_data, get_options_data, get_current_price

def filter_dates(dates):
    """
    Filter option expiration dates to include only those within 45 days.
    
    Args:
        dates (list): List of date strings in YYYY-MM-DD format
        
    Returns:
        list: Filtered list of date strings
        
    Raises:
        ValueError: If no suitable dates are found
    """
    today = datetime.today().date()
    cutoff_date = today + timedelta(days=45)
    
    sorted_dates = sorted(datetime.strptime(date, "%Y-%m-%d").date() for date in dates)

    arr = []
    for i, date in enumerate(sorted_dates):
        if date >= cutoff_date:
            arr = [d.strftime("%Y-%m-%d") for d in sorted_dates[:i+1]]  
            break
    
    if len(arr) > 0:
        if arr[0] == today.strftime("%Y-%m-%d"):
            return arr[1:]
        return arr

    raise ValueError("No date 45 days or more in the future found.")


def yang_zhang(price_data, window=30, trading_periods=252, return_last_only=True):
    """
    Calculate Yang-Zhang volatility estimator.
    
    Args:
        price_data (DataFrame): Price data with High, Low, Open, Close columns
        window (int): Window size for rolling calculation
        trading_periods (int): Number of trading periods in a year
        return_last_only (bool): Whether to return only the last value
        
    Returns:
        float or Series: Volatility estimate
    """
    log_ho = (price_data['High'] / price_data['Open']).apply(np.log)
    log_lo = (price_data['Low'] / price_data['Open']).apply(np.log)
    log_co = (price_data['Close'] / price_data['Open']).apply(np.log)
    
    log_oc = (price_data['Open'] / price_data['Close'].shift(1)).apply(np.log)
    log_oc_sq = log_oc**2
    
    log_cc = (price_data['Close'] / price_data['Close'].shift(1)).apply(np.log)
    log_cc_sq = log_cc**2
    
    rs = log_ho * (log_ho - log_co) + log_lo * (log_lo - log_co)
    
    close_vol = log_cc_sq.rolling(
        window=window,
        center=False
    ).sum() * (1.0 / (window - 1.0))

    open_vol = log_oc_sq.rolling(
        window=window,
        center=False
    ).sum() * (1.0 / (window - 1.0))

    window_rs = rs.rolling(
        window=window,
        center=False
    ).sum() * (1.0 / (window - 1.0))

    k = 0.34 / (1.34 + ((window + 1) / (window - 1)) )
    result = (open_vol + k * close_vol + (1 - k) * window_rs).apply(np.sqrt) * np.sqrt(trading_periods)

    if return_last_only:
        return result.iloc[-1]
    else:
        return result.dropna()


def build_term_structure(days, ivs):
    """
    Build a term structure spline from days to expiry and implied volatilities.
    
    Args:
        days (list): List of days to expiry
        ivs (list): List of implied volatilities
        
    Returns:
        function: Spline function that maps days to implied volatility
    """
    days = np.array(days)
    ivs = np.array(ivs)

    sort_idx = days.argsort()
    days = days[sort_idx]
    ivs = ivs[sort_idx]

    spline = interp1d(days, ivs, kind='linear', fill_value="extrapolate")

    def term_spline(dte):
        if dte < days[0]:  
            return ivs[0]
        elif dte > days[-1]:
            return ivs[-1]
        else:  
            return float(spline(dte))

    return term_spline


def analyze_options(ticker):
    """
    Analyze options data for a given ticker and provide a recommendation.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict: Analysis results including metrics and recommendation
        
    Raises:
        ValueError: If there's an issue with the data or analysis
    """
    try:
        ticker = ticker.strip().upper()
        if not ticker:
            raise ValueError("No stock symbol provided.")
        
        # Get stock and options data
        stock_data = get_stock_data(ticker)
        if not stock_data or len(stock_data.options) == 0:
            raise ValueError(f"No options found for stock symbol '{ticker}'.")
        
        # Filter expiration dates
        exp_dates = list(stock_data.options)
        try:
            exp_dates = filter_dates(exp_dates)
        except Exception:
            raise ValueError("Error: Not enough option data.")
        
        # Get options chains for each expiration date
        options_chains = {}
        for exp_date in exp_dates:
            options_chains[exp_date] = stock_data.option_chain(exp_date)
        
        # Get current price
        underlying_price = get_current_price(stock_data)
        if underlying_price is None:
            raise ValueError("No market price found.")
        
        # Calculate ATM IV for each expiration
        atm_iv = {}
        straddle = None 
        i = 0
        for exp_date, chain in options_chains.items():
            calls = chain.calls
            puts = chain.puts
            
            if calls.empty or puts.empty:
                continue
            
            call_diffs = (calls['strike'] - underlying_price).abs()
            call_idx = call_diffs.idxmin()
            call_iv = calls.loc[call_idx, 'impliedVolatility']
            
            put_diffs = (puts['strike'] - underlying_price).abs()
            put_idx = put_diffs.idxmin()
            put_iv = puts.loc[put_idx, 'impliedVolatility']
            
            atm_iv_value = (call_iv + put_iv) / 2.0
            atm_iv[exp_date] = atm_iv_value
            
            if i == 0:
                call_bid = calls.loc[call_idx, 'bid']
                call_ask = calls.loc[call_idx, 'ask']
                put_bid = puts.loc[put_idx, 'bid']
                put_ask = puts.loc[put_idx, 'ask']
                
                if call_bid is not None and call_ask is not None:
                    call_mid = (call_bid + call_ask) / 2.0
                else:
                    call_mid = None
                
                if put_bid is not None and put_ask is not None:
                    put_mid = (put_bid + put_ask) / 2.0
                else:
                    put_mid = None
                
                if call_mid is not None and put_mid is not None:
                    straddle = (call_mid + put_mid)
            
            i += 1
        
        if not atm_iv:
            raise ValueError("Could not determine ATM IV for any expiration dates.")
        
        # Calculate days to expiry and build term structure
        today = datetime.today().date()
        dtes = []
        ivs = []
        for exp_date, iv in atm_iv.items():
            exp_date_obj = datetime.strptime(exp_date, "%Y-%m-%d").date()
            days_to_expiry = (exp_date_obj - today).days
            dtes.append(days_to_expiry)
            ivs.append(iv)
        
        term_spline = build_term_structure(dtes, ivs)
        
        # Calculate metrics
        ts_slope_0_45 = (term_spline(45) - term_spline(dtes[0])) / (45-dtes[0])
        
        price_history = stock_data.history(period='3mo')
        iv30_rv30 = term_spline(30) / yang_zhang(price_history)
        
        avg_volume = price_history['Volume'].rolling(30).mean().dropna().iloc[-1]
        
        expected_move = round(straddle / underlying_price * 100, 2) if straddle else None
        expected_move_str = f"{expected_move}%" if expected_move is not None else "N/A"
        
        # Determine recommendation
        avg_volume_pass = avg_volume >= 1500000
        iv30_rv30_pass = iv30_rv30 >= 1.25
        ts_slope_pass = ts_slope_0_45 <= -0.00406
        
        if avg_volume_pass and iv30_rv30_pass and ts_slope_pass:
            recommendation = "Recommended"
        elif ts_slope_pass and ((avg_volume_pass and not iv30_rv30_pass) or (iv30_rv30_pass and not avg_volume_pass)):
            recommendation = "Consider"
        else:
            recommendation = "Avoid"
        
        # Prepare result
        result = {
            "ticker": ticker,
            "currentPrice": underlying_price,
            "metrics": {
                "avgVolume": float(avg_volume),
                "avgVolumePass": avg_volume_pass,
                "iv30Rv30": float(iv30_rv30),
                "iv30Rv30Pass": iv30_rv30_pass,
                "tsSlope": float(ts_slope_0_45),
                "tsSlopePass": ts_slope_pass
            },
            "expectedMove": expected_move_str,
            "recommendation": recommendation,
            "timestamp": datetime.now().timestamp()
        }
        
        return result
    
    except Exception as e:
        raise ValueError(f"Error analyzing options: {str(e)}")