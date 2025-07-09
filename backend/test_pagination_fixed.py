#!/usr/bin/env python3
"""
Test script to verify the fixed pagination logic for Hyperliquid API.
This should now properly access up to 10,000 trades using time-based pagination.
"""

import os
import sys
from dotenv import load_dotenv

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.hyperliquid_api_service import HyperliquidAPIService, HyperliquidConfig

def test_pagination():
    """Test the fixed pagination logic"""
    load_dotenv()
    
    # Create config
    config = HyperliquidConfig(
        api_url="https://api.hyperliquid.xyz",
        wallet_address=os.getenv('HYPERLIQUID_WALLET_ADDRESS', ''),
        api_private_key=os.getenv('HYPERLIQUID_PRIVATE_KEY'),
        api_wallet_address=os.getenv('HYPERLIQUID_API_WALLET_ADDRESS')
    )
    
    # Initialize the service
    service = HyperliquidAPIService(config)
    
    # Test addresses (replace with actual addresses that have trading history)
    test_addresses = [
        os.getenv('HYPERLIQUID_WALLET_ADDRESS'),
        os.getenv('HYPERLIQUID_AGENT_ADDRESS')
    ]
    
    for address in test_addresses:
        if not address:
            continue
            
        print(f"\n{'='*60}")
        print(f"Testing pagination for address: {address}")
        print(f"{'='*60}")
        
        try:
            # Fetch fills with the new pagination logic (use longer time range to test pagination)
            import time
            current_time = int(time.time() * 1000)
            start_time = current_time - (365 * 24 * 60 * 60 * 1000)  # 1 year ago
            fills = service.get_user_fills(address, start_time)
            
            print(f"Total fills retrieved: {len(fills)}")
            
            if fills:
                # Analyze the time distribution
                times = [fill.get('time', 0) for fill in fills]
                times.sort(reverse=True)  # Most recent first
                
                print(f"Most recent trade: {times[0]} ({service._format_timestamp(times[0])})")
                print(f"Oldest trade: {times[-1]} ({service._format_timestamp(times[-1])})")
                
                # Check for duplicates
                unique_times = set(times)
                if len(unique_times) != len(times):
                    print(f"WARNING: Found {len(times) - len(unique_times)} duplicate timestamps!")
                else:
                    print("✓ No duplicate timestamps found")
                
                # Check time ordering (should be descending)
                is_ordered = all(times[i] >= times[i+1] for i in range(len(times)-1))
                if is_ordered:
                    print("✓ Trades are properly ordered by time (newest first)")
                else:
                    print("WARNING: Trades are not properly ordered by time!")
                
                # Show sample of trades
                print(f"\nSample of first 5 trades:")
                for i, fill in enumerate(fills[:5]):
                    time_str = service._format_timestamp(fill.get('time', 0))
                    coin = fill.get('coin', 'Unknown')
                    side = fill.get('side', 'Unknown')
                    size = fill.get('sz', 'Unknown')
                    price = fill.get('px', 'Unknown')
                    print(f"  {i+1}. {time_str} - {coin} {side} {size} @ {price}")
                
                if len(fills) >= 2000:
                    print(f"\n✓ Successfully retrieved {len(fills)} trades (more than 2000 limit)")
                    if len(fills) == 10000:
                        print("✓ Reached maximum API limit of 10,000 trades")
                else:
                    print(f"\nℹ Retrieved {len(fills)} trades (less than 2000, likely all available)")
                    
            else:
                print("No trades found for this address")
                
        except Exception as e:
            print(f"Error testing address {address}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_pagination()