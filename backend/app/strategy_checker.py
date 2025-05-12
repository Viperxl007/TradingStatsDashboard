"""
Strategy Checker Module

This module provides functions to quickly check if a strategy is available for a ticker
without running full analysis. This is used to optimize the scan process.
"""

import logging
import yfinance as yf
from datetime import datetime, timedelta
from app.data_fetcher import get_stock_data, get_options_data, get_current_price

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def check_calendar_spread_availability(ticker):
    """
    Quickly check if calendar spreads are available for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        bool: True if calendar spreads are available, False otherwise
    """
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) < 2:
            return False
            
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            return False
            
        # Get expiration dates
        exp_dates = sorted(stock.options)
        if len(exp_dates) < 2:
            return False
            
        # Get front and back month
        front_month = exp_dates[0]
        back_month = exp_dates[1]
        
        # Check if there are common strikes
        try:
            front_chain = stock.option_chain(front_month)
            back_chain = stock.option_chain(back_month)
            
            if front_chain.calls.empty or back_chain.calls.empty:
                return False
                
            front_strikes = set(front_chain.calls['strike'].unique())
            back_strikes = set(back_chain.calls['strike'].unique())
            
            common_strikes = front_strikes.intersection(back_strikes)
            
            # Check if there are strikes near the current price
            near_strikes = [strike for strike in common_strikes 
                           if current_price * 0.8 <= strike <= current_price * 1.2]
                           
            return len(near_strikes) > 0
        except Exception as e:
            logger.warning(f"Error checking calendar spread availability for {ticker}: {str(e)}")
            return False
            
    except Exception as e:
        logger.warning(f"Error checking calendar spread availability for {ticker}: {str(e)}")
        return False

def check_naked_options_availability(ticker):
    """
    Quickly check if naked options are available for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        bool: True if naked options are available, False otherwise
    """
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) == 0:
            return False
            
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            return False
            
        # Get nearest expiration
        exp_dates = sorted(stock.options)
        if not exp_dates:
            return False
            
        # Check if there are options available
        try:
            chain = stock.option_chain(exp_dates[0])
            
            if chain.calls.empty and chain.puts.empty:
                return False
                
            # Check if there are strikes near the current price
            if not chain.calls.empty:
                call_strikes = chain.calls['strike'].unique()
                near_call_strikes = [strike for strike in call_strikes 
                                   if current_price * 0.8 <= strike <= current_price * 1.2]
                if len(near_call_strikes) > 0:
                    return True
                    
            if not chain.puts.empty:
                put_strikes = chain.puts['strike'].unique()
                near_put_strikes = [strike for strike in put_strikes 
                                  if current_price * 0.8 <= strike <= current_price * 1.2]
                if len(near_put_strikes) > 0:
                    return True
                    
            return False
        except Exception as e:
            logger.warning(f"Error checking naked options availability for {ticker}: {str(e)}")
            return False
            
    except Exception as e:
        logger.warning(f"Error checking naked options availability for {ticker}: {str(e)}")
        return False

def check_iron_condor_availability(ticker):
    """
    Quickly check if iron condors are available for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        bool: True if iron condors are available, False otherwise
    """
    try:
        # Get stock data
        stock = get_stock_data(ticker)
        if not stock or len(stock.options) == 0:
            return False
            
        # Get current price
        current_price = get_current_price(stock)
        if current_price is None:
            return False
            
        # Get nearest expiration
        exp_dates = sorted(stock.options)
        if not exp_dates:
            return False
            
        # Check if there are options available
        try:
            chain = stock.option_chain(exp_dates[0])
            
            if chain.calls.empty or chain.puts.empty:
                return False
                
            # Check if there are enough OTM calls and puts for spreads
            otm_calls = chain.calls[chain.calls['strike'] > current_price]
            otm_puts = chain.puts[chain.puts['strike'] < current_price]
            
            # Need at least 2 OTM calls and 2 OTM puts for iron condor
            return len(otm_calls) >= 2 and len(otm_puts) >= 2
            
        except Exception as e:
            logger.warning(f"Error checking iron condor availability for {ticker}: {str(e)}")
            return False
            
    except Exception as e:
        logger.warning(f"Error checking iron condor availability for {ticker}: {str(e)}")
        return False

def check_strategies_availability(ticker):
    """
    Check availability of all strategies for a ticker.
    
    Args:
        ticker (str): Stock ticker symbol
        
    Returns:
        dict: Dictionary with availability for each strategy
    """
    calendar_available = check_calendar_spread_availability(ticker)
    naked_available = check_naked_options_availability(ticker)
    iron_condor_available = check_iron_condor_availability(ticker)
    
    return {
        "calendar_available": calendar_available,
        "naked_available": naked_available,
        "iron_condor_available": iron_condor_available
    }