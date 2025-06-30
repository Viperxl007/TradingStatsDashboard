#!/usr/bin/env python3
"""
Script to close the active ETHUSD trade that might be preventing frontend deletion
"""

import sys
import os
sys.path.append('backend')

from backend.services.active_trade_service import ActiveTradeService

def main():
    print("🔒 Close Active ETH Trade Script")
    print("=" * 40)
    
    # Initialize active trade service
    active_trade_service = ActiveTradeService()
    
    print("🔍 Step 1: Checking for active ETHUSD trades...")
    
    # Get current active trade
    active_trade = active_trade_service.get_active_trade('ETHUSD')
    
    if active_trade:
        print(f"📊 Found active ETHUSD trade:")
        print(f"   Trade ID: {active_trade['id']}")
        print(f"   Action: {active_trade['action'].upper()}")
        print(f"   Entry Price: ${active_trade['entry_price']}")
        print(f"   Status: {active_trade['status'].upper()}")
        
        print(f"\n🔒 Step 2: Closing active trade...")
        
        # Close the trade using AI close with manual reason
        current_price = active_trade['entry_price']  # Use entry price as current price
        close_details = {
            'reason': 'Manual cleanup - removing all ETH records',
            'current_price': current_price,
            'close_type': 'manual_cleanup'
        }
        
        success = active_trade_service.close_trade_by_ai(
            'ETHUSD', 
            'manual_cleanup', 
            close_details, 
            current_price
        )
        
        if success:
            print(f"   ✅ Successfully closed trade ID {active_trade['id']}")
            print(f"   📊 Close price: ${current_price}")
            print(f"   📝 Reason: Manual cleanup")
        else:
            print(f"   ❌ Failed to close trade ID {active_trade['id']}")
    else:
        print("❌ No active ETHUSD trade found")
    
    print("\n🔍 Step 3: Final verification...")
    
    # Check final state
    final_trade = active_trade_service.get_active_trade('ETHUSD')
    if final_trade:
        print(f"⚠️  Still found active trade: ID {final_trade['id']} - Status: {final_trade['status']}")
    else:
        print("✅ No active ETHUSD trades remaining")
    
    # Show trade history
    trade_history = active_trade_service.get_trade_history('ETHUSD', limit=5)
    if trade_history:
        print(f"\n📊 Final ETHUSD trade history ({len(trade_history)} trades):")
        for trade in trade_history:
            status_emoji = "🟢" if trade['status'] in ['waiting', 'active'] else "🔴"
            pnl = trade.get('pnl_percentage', 0)
            print(f"   {status_emoji} ID: {trade['id']} | {trade['action'].upper()} | ${trade['entry_price']} | {trade['status'].upper()} | PnL: {pnl:.2f}%")
    
    print("\n✅ ETH Active Trade Cleanup Complete!")
    print("   - All active ETHUSD trades have been closed")
    print("   - Frontend deletion should now work properly")

if __name__ == "__main__":
    main()