#!/usr/bin/env python3
"""
Clean fake/calculated data from the production database
"""

import sys
import os
sys.path.append('./backend')

from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

def main():
    try:
        db = get_macro_db()
        
        print('=== CLEANING FAKE DATA FROM PRODUCTION DATABASE ===')
        
        # Get all data
        all_data = db.get_market_data_range(0, int(datetime.now(timezone.utc).timestamp()))
        print(f'Total data points in database: {len(all_data)}')
        
        fake_data_ids = []
        
        for data in all_data:
            btc_mcap = data.get('btc_market_cap', 0)
            eth_mcap = data.get('eth_market_cap', 0)
            total_mcap = data.get('total_market_cap', 0)
            
            is_fake = False
            
            # Check for calculated ratios that indicate fake data
            if btc_mcap > 0:
                eth_btc_ratio = eth_mcap / btc_mcap
                if abs(eth_btc_ratio - 0.35) < 0.001:
                    is_fake = True
                    
            if total_mcap > 0 and (btc_mcap + eth_mcap) > 0:
                combined_ratio = (btc_mcap + eth_mcap) / total_mcap
                if abs(combined_ratio - 0.65) < 0.001:
                    is_fake = True
            
            # Check for exact test data values
            if (data.get('btc_price') == 50000 or 
                data.get('total_market_cap') == 2500000000000 or 
                data.get('btc_market_cap') == 1000000000000):
                is_fake = True
            
            if is_fake:
                fake_data_ids.append(data.get('id'))
        
        print(f'Found {len(fake_data_ids)} fake data points to remove')
        
        if fake_data_ids:
            print('⚠️  WARNING: This will permanently delete fake data from the database!')
            print('This includes data with calculated ratios and test values.')
            
            response = input('Do you want to proceed? (yes/no): ')
            
            if response.lower() == 'yes':
                # Note: We would need to implement a delete method in the database class
                # For now, just report what would be deleted
                print(f'Would delete {len(fake_data_ids)} fake data points')
                print('✅ Database cleanup would be completed')
                
                # Create a backup of the fake data for analysis
                print('Creating backup of fake data for analysis...')
                with open('fake_data_backup.txt', 'w') as f:
                    f.write('Fake data points found:\n')
                    for data in all_data:
                        if data.get('id') in fake_data_ids:
                            f.write(f'{data}\n')
                print('✅ Backup saved to fake_data_backup.txt')
                
            else:
                print('❌ Database cleanup cancelled')
        else:
            print('✅ No fake data found to clean')
            
    except Exception as e:
        print(f'❌ Error cleaning fake data: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()