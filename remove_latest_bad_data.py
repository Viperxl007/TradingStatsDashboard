#!/usr/bin/env python3
"""
Remove the latest corrupted data entry that's causing chart spikes.
"""

import sqlite3
from datetime import datetime

def remove_bad_data():
    """Remove the corrupted data entry from timestamp 1754519045"""
    
    # Connect to database
    conn = sqlite3.connect('backend/instance/chart_analysis.db')
    cursor = conn.cursor()
    
    try:
        # First, let's verify the bad entry exists
        cursor.execute("""
            SELECT timestamp, btc_price, btc_dominance, alt_strength_ratio 
            FROM macro_market_data 
            WHERE timestamp = 1754519045
        """)
        
        bad_entry = cursor.fetchone()
        if bad_entry:
            print(f"Found bad entry: timestamp={bad_entry[0]}, btc_dominance={bad_entry[2]:.2f}%, alt_strength={bad_entry[3]:.2e}")
            
            # Delete the corrupted entry
            cursor.execute("DELETE FROM macro_market_data WHERE timestamp = 1754519045")
            deleted_count = cursor.rowcount
            
            if deleted_count > 0:
                print(f"✅ Successfully deleted {deleted_count} corrupted entry")
                
                # Verify deletion
                cursor.execute("SELECT COUNT(*) FROM macro_market_data WHERE timestamp = 1754519045")
                remaining = cursor.fetchone()[0]
                
                if remaining == 0:
                    print("✅ Verified: Bad entry completely removed")
                else:
                    print(f"⚠️  Warning: {remaining} entries still remain with that timestamp")
                
                # Show the new most recent entries
                cursor.execute("""
                    SELECT timestamp, btc_price, btc_dominance, alt_strength_ratio 
                    FROM macro_market_data 
                    ORDER BY timestamp DESC 
                    LIMIT 3
                """)
                
                recent_entries = cursor.fetchall()
                print("\nMost recent entries after cleanup:")
                for entry in recent_entries:
                    print(f"  timestamp={entry[0]}, btc_dominance={entry[2]:.2f}%, alt_strength={entry[3]:.2e}")
                
            else:
                print("❌ No entries were deleted")
        else:
            print("❌ Bad entry not found - may have already been removed")
        
        # Commit the changes
        conn.commit()
        print("\n✅ Database changes committed successfully")
        
    except Exception as e:
        print(f"❌ Error removing bad data: {e}")
        conn.rollback()
        
    finally:
        conn.close()

if __name__ == "__main__":
    print("🧹 Removing corrupted data entry that's causing chart spikes...")
    remove_bad_data()
    print("🎉 Data cleanup complete!")