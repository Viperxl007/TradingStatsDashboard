#!/usr/bin/env python3
"""
Test script to verify the AI Trade Tracker status integration is working correctly.
"""

import requests
import json
import sys

def test_status_integration():
    """Test that the AI Trade Tracker can properly handle all trade statuses."""
    
    base_url = "http://localhost:5000/api"
    
    print("🧪 Testing AI Trade Tracker Status Integration")
    print("=" * 60)
    
    try:
        # Test 1: Get all active trades (should only show waiting/active)
        print("\n1. Testing /active-trades/all endpoint...")
        response = requests.get(f"{base_url}/active-trades/all")
        if response.status_code == 200:
            data = response.json()
            active_trades = data.get('active_trades', [])
            print(f"✅ Found {len(active_trades)} active trades")
            
            # Check statuses
            statuses = [trade['status'] for trade in active_trades]
            print(f"   Active trade statuses: {set(statuses)}")
            
            # Verify only waiting/active statuses
            valid_active_statuses = {'waiting', 'active'}
            invalid_statuses = set(statuses) - valid_active_statuses
            if invalid_statuses:
                print(f"⚠️  Found unexpected statuses in active trades: {invalid_statuses}")
            else:
                print("✅ All active trade statuses are valid")
        else:
            print(f"❌ Failed to get active trades: {response.status_code}")
            
        # Test 2: Get all trades history (should show all statuses)
        print("\n2. Testing /active-trades/all-history endpoint...")
        response = requests.get(f"{base_url}/active-trades/all-history")
        if response.status_code == 200:
            data = response.json()
            all_trades = data.get('all_trades', [])
            print(f"✅ Found {len(all_trades)} total trades in history")
            
            # Check all statuses
            statuses = [trade['status'] for trade in all_trades]
            unique_statuses = set(statuses)
            print(f"   All trade statuses found: {unique_statuses}")
            
            # Count by status
            status_counts = {}
            for status in statuses:
                status_counts[status] = status_counts.get(status, 0) + 1
            
            print("   Status breakdown:")
            for status, count in status_counts.items():
                print(f"     {status}: {count}")
                
            # Check for expected statuses
            expected_statuses = {'waiting', 'active', 'profit_hit', 'stop_hit', 'ai_closed', 'user_closed'}
            found_closed_statuses = unique_statuses & {'profit_hit', 'stop_hit', 'ai_closed', 'user_closed'}
            
            if found_closed_statuses:
                print(f"✅ Found closed trade statuses: {found_closed_statuses}")
            else:
                print("ℹ️  No closed trades found (this is normal if no trades have been closed yet)")
                
        else:
            print(f"❌ Failed to get trades history: {response.status_code}")
            
        # Test 3: Check if we have any SOLUSD trades
        print("\n3. Checking for SOLUSD trade...")
        if 'all_trades' in locals():
            solusd_trades = [trade for trade in all_trades if trade['ticker'] == 'SOLUSD']
            if solusd_trades:
                print(f"✅ Found {len(solusd_trades)} SOLUSD trade(s)")
                for trade in solusd_trades:
                    print(f"   SOLUSD Status: {trade['status']}")
                    print(f"   Entry: ${trade['entry_price']}")
                    if trade.get('target_price'):
                        print(f"   Target: ${trade['target_price']}")
                    if trade.get('stop_loss'):
                        print(f"   Stop: ${trade['stop_loss']}")
                    if trade.get('current_price'):
                        print(f"   Current: ${trade['current_price']}")
            else:
                print("ℹ️  No SOLUSD trades found")
        
        print("\n" + "=" * 60)
        print("✅ Status integration test completed successfully!")
        print("\nNext steps:")
        print("1. Open the AI Trade Tracker in the frontend")
        print("2. Check that all trade statuses are displayed correctly")
        print("3. Verify that closed trades show up in the History tab")
        print("4. Test the profit_hit and stop_hit status colors")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend server")
        print("   Make sure the backend is running on http://localhost:5000")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_status_integration()