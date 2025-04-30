import yfinance as yf
import pandas as pd
import time
from datetime import datetime

# Set display options to show more data
pd.set_option('display.max_rows', 100)
pd.set_option('display.max_columns', 20)
pd.set_option('display.width', 1000)

# Get the ticker and expiration dates
ticker = "K"  # Replace with your ticker
stock = yf.Ticker(ticker)
print(f"Current price of {ticker}: ${stock.info.get('regularMarketPrice', 'N/A')}")
print(f"Available expiration dates for {ticker}: {stock.options}")

# Check all expirations to compare strike availability
for i, expiration in enumerate(stock.options[:3]):  # Only check first 3 expirations to keep output manageable
    print(f"\n{'-'*50}")
    print(f"Checking expiration {i+1}: {expiration}")
    
    # Add a small delay to avoid overwhelming the API
    time.sleep(1)
    
    try:
        # Get the option chain
        chain = stock.option_chain(expiration)
        
        # Print information about the calls
        print(f"Calls shape: {chain.calls.shape}")
        print(f"Calls strikes: {sorted(chain.calls['strike'].unique())}")
        
        # Print information about the puts
        print(f"Puts shape: {chain.puts.shape}")
        print(f"Puts strikes: {sorted(chain.puts['strike'].unique())}")
        
    except Exception as e:
        print(f"Error retrieving data for {expiration}: {e}")

# Try another ticker with known high options volume for comparison
compare_ticker = "AAPL"
compare_stock = yf.Ticker(compare_ticker)
print(f"\n{'-'*50}")
print(f"For comparison - {compare_ticker} first expiration:")
try:
    compare_chain = compare_stock.option_chain(compare_stock.options[0])
    print(f"AAPL calls strikes count: {len(compare_chain.calls['strike'].unique())}")
    print(f"AAPL first few strikes: {sorted(compare_chain.calls['strike'].unique())[:10]}")
except Exception as e:
    print(f"Error retrieving {compare_ticker} data: {e}")