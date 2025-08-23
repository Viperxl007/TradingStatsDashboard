#!/usr/bin/env python3
"""
Complete database cleanup and refresh with real data only
"""

import sys
import os
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone
import asyncio

def main():
    try:
        db = get_macro_db()
        
        print('=== COMPLETE DATABASE CLEANUP AND REFRESH ===')
        
        # Step 1: Analyze current data issues
        print('\n1. ANALYZING CURRENT DATA ISSUES...')
        current_time = int(datetime.now(timezone.utc).timestamp())
        all_data = db.get_market_data_range(0, current_time)
        
        fake_data_count = 0
        outlier_count = 0
        
        for data in all_data:
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            
            # Check for fake calculated data
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                if abs(combined_ratio - 0.65) < 0.001:
                    fake_data_count += 1
            
            # Check for outliers
            btc_dominance = (btc_mcap / total_mcap * 100) if total_mcap > 0 else 0
            if btc_dominance > 58 or btc_dominance < 45:
                outlier_count += 1
        
        print(f'   Total data points: {len(all_data)}')
        print(f'   Fake calculated data: {fake_data_count}')
        print(f'   Outlier data points: {outlier_count}')
        print(f'   Clean data points: {len(all_data) - fake_data_count - outlier_count}')
        
        # Step 2: Backup current data
        print('\n2. CREATING BACKUP OF CURRENT DATA...')
        backup_filename = f'database_backup_{int(datetime.now().timestamp())}.txt'
        with open(backup_filename, 'w') as f:
            f.write('Database backup created at: ' + str(datetime.now()) + '\n\n')
            for i, data in enumerate(all_data):
                f.write(f'Record {i}: {data}\n')
        print(f'   ✅ Backup saved to: {backup_filename}')
        
        # Step 3: Identify data to remove
        print('\n3. IDENTIFYING DATA TO REMOVE...')
        
        # Get IDs of fake/outlier data
        remove_ids = []
        for data in all_data:
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            
            should_remove = False
            
            # Remove fake calculated data
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                if abs(combined_ratio - 0.65) < 0.001:
                    should_remove = True
            
            # Remove outliers
            btc_dominance = (btc_mcap / total_mcap * 100) if total_mcap > 0 else 0
            if btc_dominance > 58 or btc_dominance < 45:
                should_remove = True
            
            # Remove test data
            if (data.get('btc_price') == 50000 or 
                data.get('total_market_cap') == 2500000000000 or 
                data.get('btc_market_cap') == 1000000000000):
                should_remove = True
            
            if should_remove:
                remove_ids.append(data.get('id'))
        
        print(f'   Found {len(remove_ids)} records to remove')
        
        # Step 4: Ask for confirmation
        print('\n4. CLEANUP CONFIRMATION')
        print('⚠️  WARNING: This will permanently delete corrupted data!')
        print(f'   - {fake_data_count} fake calculated data points')
        print(f'   - {outlier_count} outlier data points')
        print(f'   - Total to remove: {len(remove_ids)} records')
        print(f'   - Remaining clean data: {len(all_data) - len(remove_ids)} records')
        
        response = input('\nProceed with cleanup? (yes/no): ')
        
        if response.lower() != 'yes':
            print('❌ Cleanup cancelled')
            return
        
        # Step 5: Perform cleanup (Note: would need delete method in database)
        print('\n5. PERFORMING CLEANUP...')
        print('⚠️  Note: Database delete method needs to be implemented')
        print(f'   Would delete {len(remove_ids)} records')
        
        # Step 6: Refresh with real data
        print('\n6. REFRESHING WITH REAL DATA...')
        print('   This will use the fixed CoinGecko service (no fallback calculations)')
        print('   If real data is not available, the system will throw errors instead of using fake data')
        
        # Reset bootstrap status to allow fresh data collection
        db.update_system_state({
            'bootstrap_completed': False,
            'bootstrap_completed_at': None,
            'bootstrap_data_points': 0,
            'bootstrap_errors': '[]',
            'system_status': 'INITIALIZING'
        })
        
        print('   ✅ Bootstrap status reset')
        print('   ✅ System ready for fresh data collection')
        
        print('\n=== NEXT STEPS ===')
        print('1. Run the bootstrap service to collect fresh real data:')
        print('   python -c "from backend.services.macro_bootstrap_service import run_bootstrap; import asyncio; asyncio.run(run_bootstrap(force=True))"')
        print('2. Start the scanner service to collect ongoing real data')
        print('3. Monitor for any errors - the system will now fail hard instead of using fake data')
        
        print('\n✅ Database cleanup preparation completed!')
        
    except Exception as e:
        print(f'❌ Error during cleanup: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()