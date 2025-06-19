"""
Unified Strike Selection Module

This module provides a centralized, robust strike selection system for all options strategies.
It ensures consistent strike selection across all endpoints and includes comprehensive
validation and fallback mechanisms.
"""

import logging
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd

logger = logging.getLogger(__name__)

class StrikeSelectionError(Exception):
    """Exception raised when strike selection fails."""
    pass

class UnifiedStrikeSelector:
    """
    Unified strike selector that provides consistent, robust strike selection
    across all options strategies and endpoints.
    """
    
    def __init__(self, ticker: str, current_price: float):
        """
        Initialize the strike selector.
        
        Args:
            ticker: Stock ticker symbol
            current_price: Current stock price
        """
        self.ticker = ticker
        self.current_price = current_price
        self.stock = yf.Ticker(ticker)
        self._expiration_cache = {}
        self._options_cache = {}
        
        logger.info(f"🎯 Initialized UnifiedStrikeSelector for {ticker} at ${current_price:.2f}")
    
    def get_available_expirations(self) -> List[str]:
        """
        Get all available expiration dates for the ticker.
        
        Returns:
            List of expiration dates in YYYY-MM-DD format
            
        Raises:
            StrikeSelectionError: If no expiration dates are available
        """
        try:
            if 'expirations' not in self._expiration_cache:
                expirations = self.stock.options
                if not expirations:
                    raise StrikeSelectionError(f"No expiration dates found for {self.ticker}")
                
                # Filter out past dates
                today = datetime.today().date()
                future_expirations = []
                
                for exp_str in expirations:
                    try:
                        exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
                        if exp_date > today:
                            future_expirations.append(exp_str)
                    except ValueError:
                        logger.warning(f"Invalid expiration date format: {exp_str}")
                        continue
                
                if not future_expirations:
                    raise StrikeSelectionError(f"No future expiration dates found for {self.ticker}")
                
                self._expiration_cache['expirations'] = sorted(future_expirations)
                logger.info(f"📅 Found {len(future_expirations)} future expirations for {self.ticker}")
            
            return self._expiration_cache['expirations']
            
        except Exception as e:
            raise StrikeSelectionError(f"Failed to get expiration dates for {self.ticker}: {str(e)}")
    
    def get_options_chain(self, expiration: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Get options chain for a specific expiration with caching.
        
        Args:
            expiration: Expiration date in YYYY-MM-DD format
            
        Returns:
            Tuple of (calls_df, puts_df)
            
        Raises:
            StrikeSelectionError: If options chain cannot be retrieved
        """
        try:
            if expiration not in self._options_cache:
                chain = self.stock.option_chain(expiration)
                calls = chain.calls
                puts = chain.puts
                
                if calls.empty and puts.empty:
                    raise StrikeSelectionError(f"Empty options chain for {self.ticker} on {expiration}")
                
                self._options_cache[expiration] = (calls, puts)
                logger.debug(f"📊 Cached options chain for {self.ticker} {expiration}: {len(calls)} calls, {len(puts)} puts")
            
            return self._options_cache[expiration]
            
        except Exception as e:
            raise StrikeSelectionError(f"Failed to get options chain for {self.ticker} {expiration}: {str(e)}")
    
    def get_available_strikes(self, expiration: str, option_type: str = 'both') -> List[float]:
        """
        Get all available strikes for a specific expiration.
        
        Args:
            expiration: Expiration date in YYYY-MM-DD format
            option_type: 'call', 'put', or 'both'
            
        Returns:
            Sorted list of available strike prices
            
        Raises:
            StrikeSelectionError: If no strikes are available
        """
        try:
            calls, puts = self.get_options_chain(expiration)
            
            strikes = set()
            
            if option_type in ['call', 'both'] and not calls.empty:
                strikes.update(calls['strike'].unique())
            
            if option_type in ['put', 'both'] and not puts.empty:
                strikes.update(puts['strike'].unique())
            
            if not strikes:
                raise StrikeSelectionError(f"No strikes available for {self.ticker} {expiration} {option_type}")
            
            sorted_strikes = sorted(list(strikes))
            logger.debug(f"🎯 Found {len(sorted_strikes)} strikes for {self.ticker} {expiration} {option_type}")
            
            return sorted_strikes
            
        except Exception as e:
            raise StrikeSelectionError(f"Failed to get strikes for {self.ticker} {expiration}: {str(e)}")
    
    def find_atm_strike(self, expiration: str, option_type: str = 'both', 
                       max_distance_pct: float = 0.05) -> float:
        """
        Find the At-The-Money (ATM) strike closest to current price.
        
        Args:
            expiration: Expiration date in YYYY-MM-DD format
            option_type: 'call', 'put', or 'both'
            max_distance_pct: Maximum allowed distance from current price (as percentage)
            
        Returns:
            ATM strike price
            
        Raises:
            StrikeSelectionError: If no suitable ATM strike is found
        """
        try:
            available_strikes = self.get_available_strikes(expiration, option_type)
            
            if not available_strikes:
                raise StrikeSelectionError(f"No strikes available for ATM selection")
            
            # Find the strike closest to current price
            atm_strike = min(available_strikes, key=lambda x: abs(x - self.current_price))
            
            # Validate the distance is reasonable
            distance_pct = abs(atm_strike - self.current_price) / self.current_price
            
            if distance_pct > max_distance_pct:
                logger.warning(f"⚠️ ATM strike ${atm_strike} is {distance_pct:.2%} from current price ${self.current_price:.2f}")
                
                # Try to find a better strike within the distance limit
                valid_strikes = [s for s in available_strikes 
                               if abs(s - self.current_price) / self.current_price <= max_distance_pct]
                
                if valid_strikes:
                    atm_strike = min(valid_strikes, key=lambda x: abs(x - self.current_price))
                    distance_pct = abs(atm_strike - self.current_price) / self.current_price
                    logger.info(f"✅ Found better ATM strike ${atm_strike} ({distance_pct:.2%} from current price)")
                else:
                    logger.warning(f"🚨 No strikes within {max_distance_pct:.1%} of current price, using closest: ${atm_strike}")
            
            logger.info(f"🎯 Selected ATM strike for {self.ticker} {expiration}: ${atm_strike} ({distance_pct:.2%} from ${self.current_price:.2f})")
            
            return atm_strike
            
        except Exception as e:
            raise StrikeSelectionError(f"Failed to find ATM strike for {self.ticker} {expiration}: {str(e)}")
    
    def validate_strike_availability(self, expiration: str, strike: float, 
                                   option_type: str) -> bool:
        """
        Validate that a specific strike is available for the given expiration and option type.
        
        Args:
            expiration: Expiration date in YYYY-MM-DD format
            strike: Strike price to validate
            option_type: 'call' or 'put'
            
        Returns:
            True if strike is available, False otherwise
        """
        try:
            calls, puts = self.get_options_chain(expiration)
            
            if option_type == 'call':
                available = not calls.empty and strike in calls['strike'].values
            elif option_type == 'put':
                available = not puts.empty and strike in puts['strike'].values
            else:
                raise ValueError(f"Invalid option_type: {option_type}")
            
            logger.debug(f"🔍 Strike validation for {self.ticker} {expiration} ${strike} {option_type}: {available}")
            
            return available
            
        except Exception as e:
            logger.error(f"Error validating strike availability: {str(e)}")
            return False
    
    def find_calendar_spread_strikes(self, earnings_date: str) -> Dict[str, Any]:
        """
        Find optimal strikes for a calendar spread around earnings.
        
        This is the UNIFIED method that both spread cost and liquidity calculations should use.
        
        Args:
            earnings_date: Earnings date in YYYY-MM-DD format
            
        Returns:
            Dictionary containing:
            - front_expiration: Front month expiration
            - back_expiration: Back month expiration  
            - strike: Selected strike price
            - option_type: 'call' or 'put'
            - validation_info: Additional validation details
            
        Raises:
            StrikeSelectionError: If suitable strikes cannot be found
        """
        try:
            logger.info(f"🎯 Finding calendar spread strikes for {self.ticker} with earnings {earnings_date}")
            
            # Get available expirations
            expirations = self.get_available_expirations()
            
            if len(expirations) < 2:
                raise StrikeSelectionError(f"Need at least 2 expirations for calendar spread, found {len(expirations)}")
            
            # Parse earnings date
            earnings_dt = datetime.strptime(earnings_date, '%Y-%m-%d').date()
            
            # Find front month (closest to earnings date, but after earnings)
            front_exp = None
            min_diff = float('inf')
            
            for exp_str in expirations:
                exp_date = datetime.strptime(exp_str, '%Y-%m-%d').date()
                if exp_date >= earnings_dt:  # Must be on or after earnings
                    diff = (exp_date - earnings_dt).days
                    if diff < min_diff:
                        min_diff = diff
                        front_exp = exp_str
            
            if not front_exp:
                raise StrikeSelectionError(f"Could not find suitable front month expiration after earnings {earnings_date}")
            
            # Find back month (approximately 30 days after front month)
            front_date = datetime.strptime(front_exp, '%Y-%m-%d').date()
            target_back_date = front_date + timedelta(days=30)
            
            back_exp = None
            min_diff = float('inf')
            
            for exp_str in expirations:
                exp_date = datetime.strptime(exp_str, '%Y-%m-%d').date()
                if exp_date > front_date:  # Must be after front month
                    diff = abs((exp_date - target_back_date).days)
                    if diff < min_diff:
                        min_diff = diff
                        back_exp = exp_str
            
            if not back_exp:
                raise StrikeSelectionError(f"Could not find suitable back month expiration")
            
            logger.info(f"📅 Selected expirations: Front={front_exp}, Back={back_exp}")
            
            # Find common strikes between front and back months
            front_strikes = set(self.get_available_strikes(front_exp))
            back_strikes = set(self.get_available_strikes(back_exp))
            common_strikes = sorted(list(front_strikes.intersection(back_strikes)))
            
            if not common_strikes:
                raise StrikeSelectionError(f"No common strikes found between {front_exp} and {back_exp}")
            
            logger.info(f"🎯 Found {len(common_strikes)} common strikes between expirations")
            
            # Find ATM strike from common strikes
            atm_strike = min(common_strikes, key=lambda x: abs(x - self.current_price))
            
            # Determine option type (calls if strike >= current price, puts if below)
            option_type = 'call' if atm_strike >= self.current_price else 'put'
            
            # Validate that both options exist
            front_valid = self.validate_strike_availability(front_exp, atm_strike, option_type)
            back_valid = self.validate_strike_availability(back_exp, atm_strike, option_type)
            
            if not front_valid or not back_valid:
                # Try to find alternative strikes
                logger.warning(f"⚠️ Primary strike ${atm_strike} not valid (front={front_valid}, back={back_valid})")
                
                # Try nearby strikes
                for candidate_strike in sorted(common_strikes, key=lambda x: abs(x - self.current_price)):
                    if candidate_strike == atm_strike:
                        continue
                    
                    # Determine option type for this candidate
                    candidate_option_type = 'call' if candidate_strike >= self.current_price else 'put'
                    
                    front_valid = self.validate_strike_availability(front_exp, candidate_strike, candidate_option_type)
                    back_valid = self.validate_strike_availability(back_exp, candidate_strike, candidate_option_type)
                    
                    if front_valid and back_valid:
                        atm_strike = candidate_strike
                        option_type = candidate_option_type
                        logger.info(f"✅ Found alternative valid strike: ${atm_strike} {option_type}")
                        break
                else:
                    raise StrikeSelectionError(f"No valid strikes found for calendar spread")
            
            distance_pct = abs(atm_strike - self.current_price) / self.current_price
            
            result = {
                'front_expiration': front_exp,
                'back_expiration': back_exp,
                'strike': atm_strike,
                'option_type': option_type,
                'validation_info': {
                    'distance_from_atm_pct': distance_pct,
                    'common_strikes_count': len(common_strikes),
                    'front_validated': front_valid,
                    'back_validated': back_valid,
                    'earnings_to_front_days': (datetime.strptime(front_exp, '%Y-%m-%d').date() - earnings_dt).days,
                    'front_to_back_days': (datetime.strptime(back_exp, '%Y-%m-%d').date() - datetime.strptime(front_exp, '%Y-%m-%d').date()).days
                }
            }
            
            logger.info(f"✅ Calendar spread strikes selected for {self.ticker}:")
            logger.info(f"   Strike: ${atm_strike} {option_type} ({distance_pct:.2%} from current price)")
            logger.info(f"   Front: {front_exp}, Back: {back_exp}")
            logger.info(f"   Validation: {result['validation_info']}")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to find calendar spread strikes for {self.ticker}: {str(e)}")
            raise StrikeSelectionError(f"Calendar spread strike selection failed: {str(e)}")


def create_strike_selector(ticker: str, current_price: float) -> UnifiedStrikeSelector:
    """
    Factory function to create a UnifiedStrikeSelector instance.
    
    Args:
        ticker: Stock ticker symbol
        current_price: Current stock price
        
    Returns:
        UnifiedStrikeSelector instance
    """
    return UnifiedStrikeSelector(ticker, current_price)