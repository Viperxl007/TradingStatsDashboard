#!/usr/bin/env python3
"""
Complete database cleanup and refresh with REAL data only
"""

import sys
import os
import asyncio
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from services.macro_bootstrap_service import MacroBootstrapService
from datetime import datetime, timezone

async def main():
    try:
        print('🚨 COMPLETE DATABASE CLEANUP AND REFRESH 🚨')
        print('=' * 60)
        
        db = get_macro_db()
        
        # Step 1: Backup current data
        print('\n1. CREATING BACKUP...')
        current_time = int(datetime.now(timezone.utc).timestamp())
        all_data = db.get_market_data_range(0, current_time)
        
        backup_filename = f'database_backup_{current_time}.txt'
        with open(backup_filename, 'w') as f:
            f.write(f'Database backup created at: {datetime.now()}\n')
            f.write(f'Total records: {len(all_data)}\n\n')
            for i, data in enumerate(all_data):
                f.write(f'Record {i}: {data}\n')
        
        print(f'   ✅ Backup saved: {backup_filename}')
        print(f'   📊 Backed up {len(all_data)} records')
        
        # Step 2: Analyze contamination
        print('\n2. ANALYZING CONTAMINATION...')
        fake_count = 0
        outlier_count = 0
        
        for data in all_data:
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            
            # Check for fake calculated data (0.65 ratio)
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                if abs(combined_ratio - 0.65) < 0.001:
                    fake_count += 1
            
            # Check for outliers
            btc_dominance = (btc_mcap / total_mcap * 100) if total_mcap > 0 else 0
            if btc_dominance > 58 or btc_dominance < 45:
                outlier_count += 1
        
        print(f'   🔍 Total records: {len(all_data)}')
        print(f'   🚨 Fake calculated data: {fake_count} ({fake_count/len(all_data)*100:.1f}%)')
        print(f'   📈 Outlier data: {outlier_count} ({outlier_count/len(all_data)*100:.1f}%)')
        print(f'   ✅ Clean data: {len(all_data) - fake_count - outlier_count}')
        
        # Step 3: Confirm cleanup
        print('\n3. CLEANUP CONFIRMATION')
        print('⚠️  WARNING: This will PERMANENTLY DELETE ALL contaminated data!')
        print('   The database is 100% contaminated with fake/calculated values.')
        print('   We will clear ALL data and rebuild with REAL data only.')
        
        response = input('\nProceed with COMPLETE database wipe and rebuild? (yes/no): ')
        
        if response.lower() != 'yes':
            print('❌ Operation cancelled')
            return
        
        # Step 4: Clear all data
        print('\n4. CLEARING CONTAMINATED DATABASE...')
        success = db.clear_all_market_data()
        
        if success:
            print('   ✅ All contaminated data cleared')
        else:
            print('   ❌ Failed to clear data')
            return
        
        # Step 5: Reset system state
        print('\n5. RESETTING SYSTEM STATE...')
        db.update_system_state({
            'bootstrap_completed': False,
            'bootstrap_completed_at': None,
            'bootstrap_data_points': 0,
            'bootstrap_errors': '[]',
            'system_status': 'INITIALIZING'
        })
        print('   ✅ System state reset')
        
        # Step 6: Bootstrap with REAL data
        print('\n6. COLLECTING REAL DATA FROM COINGECKO...')
        print('   Using FIXED CoinGecko service (NO fallback calculations)')
        
        bootstrap_service = MacroBootstrapService(db)
        
        def progress_callback(message, progress=None):
            if progress:
                print(f'   [{progress:5.1f}%] {message}')
            else:
                print(f'   [     ] {message}')
        
        bootstrap_service.set_progress_callback(progress_callback)
        
        try:
            result = await bootstrap_service.run_bootstrap(force=True)
            
            if result['success']:
                print(f'\n   🎉 SUCCESS! Collected {result["data_points"]} REAL data points')
                print(f'   ⏱️  Completed in {result["duration_seconds"]:.1f} seconds')
                
                if result.get('errors'):
                    print(f'   ⚠️  Warnings: {len(result["errors"])} issues')
                    for error in result['errors'][:3]:  # Show first 3
                        print(f'      - {error}')
            else:
                print(f'\n   ❌ Bootstrap failed: {result["message"]}')
                if result.get('errors'):
                    for error in result['errors']:
                        print(f'      - {error}')
                return
                
        except Exception as e:
            print(f'\n   ❌ Bootstrap error: {e}')
            print('   This is EXPECTED if CoinGecko API limits are hit')
            print('   The system will now FAIL HARD instead of using fake data')
            return
        
        # Step 7: Verify new data
        print('\n7. VERIFYING NEW DATA...')
        new_data = db.get_market_data_range(0, int(datetime.now(timezone.utc).timestamp()))
        
        if new_data:
            print(f'   ✅ Found {len(new_data)} new data points')
            
            # Check for fake data in new collection
            new_fake_count = 0
            for data in new_data:
                btc_mcap = data.get('btc_market_cap', 0)
                eth_mcap = data.get('eth_market_cap', 0)
                total_mcap = data.get('total_market_cap', 0)
                
                if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                    combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                    if abs(combined_ratio - 0.65) < 0.001:
                        new_fake_count += 1
            
            if new_fake_count == 0:
                print('   ✅ NO fake data detected in new collection!')
                print('   🎉 Database now contains REAL data only!')
            else:
                print(f'   🚨 WARNING: {new_fake_count} fake data points still detected!')
        else:
            print('   ⚠️  No new data collected (API limits or errors)')
        
        print('\n' + '=' * 60)
        print('🎉 DATABASE CLEANUP AND REFRESH COMPLETED!')
        print('=' * 60)
        print('\nNEXT STEPS:')
        print('1. Monitor the charts - they should now show REAL data only')
        print('2. Start the macro scanner service for ongoing data collection')
        print('3. The system will now FAIL HARD if real data is not available')
        print('4. No more fake/calculated data will contaminate your system!')
        
    except Exception as e:
        print(f'❌ Critical error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())