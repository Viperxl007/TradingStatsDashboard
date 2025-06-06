"""
Option Price Fetcher - Dedicated module for fetching specific option contract prices
This module is EXCLUSIVELY for the Active Trades panel to fetch real-time prices
for exact option contracts in a spread.
"""

import yfinance as yf
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

def fetch_specific_option_prices(ticker: str, option_contracts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Fetch prices for specific option contracts using yfinance.
    
    Args:
        ticker (str): Stock ticker symbol
        option_contracts (List[Dict]): List of option contract specifications
            Each contract should have:
            - optionType: 'call' or 'put'
            - strike: strike price (float)
            - expiration: expiration date (YYYY-MM-DD string)
            - quantity: number of contracts (int)
            - isLong: position direction (bool)
    
    Returns:
        Dict containing:
        - success: bool
        - prices: Dict[str, float] - prices keyed by leg index
        - errors: List[str] - any errors encountered
        - timestamp: str - when prices were fetched
    """
    
    try:
        # Initialize yfinance ticker
        stock = yf.Ticker(ticker)
        
        result = {
            'success': True,
            'prices': {},
            'errors': [],
            'timestamp': datetime.now().isoformat(),
            'ticker': ticker
        }
        
        # Group contracts by expiration date to minimize API calls
        contracts_by_expiration = {}
        for i, contract in enumerate(option_contracts):
            exp_date = contract['expiration']
            if exp_date not in contracts_by_expiration:
                contracts_by_expiration[exp_date] = []
            contracts_by_expiration[exp_date].append((i, contract))
        
        # Fetch option chains for each unique expiration
        for exp_date, contracts in contracts_by_expiration.items():
            try:
                logger.info(f"Fetching option chain for {ticker} expiration {exp_date}")
                
                # Get option chain for this expiration
                option_chain = stock.option_chain(exp_date)
                
                # Process each contract for this expiration
                for leg_index, contract in contracts:
                    try:
                        option_type = contract['optionType'].lower()
                        strike = float(contract['strike'])
                        
                        # Get the appropriate option chain (calls or puts)
                        if option_type == 'call':
                            options_df = option_chain.calls
                        elif option_type == 'put':
                            options_df = option_chain.puts
                        else:
                            raise ValueError(f"Invalid option type: {option_type}")
                        
                        # Find the exact strike price match
                        matching_options = options_df[abs(options_df['strike'] - strike) < 0.01]
                        
                        if len(matching_options) == 0:
                            error_msg = f"No {option_type} option found for strike ${strike} on {exp_date}"
                            result['errors'].append(error_msg)
                            logger.warning(error_msg)
                            continue
                        
                        # Get the first (and should be only) matching option
                        option_data = matching_options.iloc[0]
                        
                        # Calculate mid price (bid + ask) / 2, fallback to last price
                        bid = option_data.get('bid', 0)
                        ask = option_data.get('ask', 0)
                        last_price = option_data.get('lastPrice', 0)
                        
                        if bid > 0 and ask > 0:
                            current_price = (bid + ask) / 2
                        elif last_price > 0:
                            current_price = last_price
                        else:
                            current_price = 0
                            result['errors'].append(f"No valid price data for {option_type} ${strike} {exp_date}")
                        
                        # Store the price with leg index as key
                        result['prices'][f'leg_{leg_index}'] = round(current_price, 2)
                        
                        logger.info(f"Found price for leg {leg_index}: {option_type} ${strike} {exp_date} = ${current_price:.2f}")
                        
                    except Exception as e:
                        error_msg = f"Error processing leg {leg_index}: {str(e)}"
                        result['errors'].append(error_msg)
                        logger.error(error_msg)
                        continue
                        
            except Exception as e:
                error_msg = f"Error fetching option chain for {exp_date}: {str(e)}"
                result['errors'].append(error_msg)
                logger.error(error_msg)
                continue
        
        # Set success to False if we have errors and no prices
        if result['errors'] and not result['prices']:
            result['success'] = False
            
        return result
        
    except Exception as e:
        logger.error(f"Critical error in fetch_specific_option_prices: {str(e)}")
        return {
            'success': False,
            'prices': {},
            'errors': [f"Critical error: {str(e)}"],
            'timestamp': datetime.now().isoformat(),
            'ticker': ticker
        }

def validate_option_contracts(option_contracts: List[Dict[str, Any]]) -> List[str]:
    """
    Validate option contract specifications.
    
    Args:
        option_contracts: List of option contract dictionaries
        
    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []
    
    if not option_contracts:
        errors.append("No option contracts provided")
        return errors
    
    for i, contract in enumerate(option_contracts):
        # Check required fields
        required_fields = ['optionType', 'strike', 'expiration', 'quantity', 'isLong']
        for field in required_fields:
            if field not in contract:
                errors.append(f"Contract {i}: Missing required field '{field}'")
        
        # Validate option type
        if 'optionType' in contract:
            if contract['optionType'].lower() not in ['call', 'put']:
                errors.append(f"Contract {i}: Invalid optionType '{contract['optionType']}' (must be 'call' or 'put')")
        
        # Validate strike price
        if 'strike' in contract:
            try:
                strike = float(contract['strike'])
                if strike <= 0:
                    errors.append(f"Contract {i}: Strike price must be positive")
            except (ValueError, TypeError):
                errors.append(f"Contract {i}: Invalid strike price '{contract['strike']}'")
        
        # Validate expiration date format
        if 'expiration' in contract:
            try:
                datetime.strptime(contract['expiration'], '%Y-%m-%d')
            except ValueError:
                errors.append(f"Contract {i}: Invalid expiration date format '{contract['expiration']}' (expected YYYY-MM-DD)")
        
        # Validate quantity
        if 'quantity' in contract:
            try:
                quantity = int(contract['quantity'])
                if quantity <= 0:
                    errors.append(f"Contract {i}: Quantity must be positive")
            except (ValueError, TypeError):
                errors.append(f"Contract {i}: Invalid quantity '{contract['quantity']}'")
        
        # Validate isLong
        if 'isLong' in contract:
            if not isinstance(contract['isLong'], bool):
                errors.append(f"Contract {i}: isLong must be boolean")
    
    return errors