import sys
import sqlite3
sys.path.append('backend')
from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

db = get_macro_db()

print("Cleaning outlier data from macro sentiment database...")

with sqlite3.connect(db.db_path) as conn:
    cursor = conn.cursor()
    
    # Find and display outliers before deletion
    print("\nFinding outlier entries...")
    cursor.execute("""
        SELECT timestamp, btc_price, btc_dominance, alt_strength_ratio
        FROM macro_market_data
        WHERE (btc_price < 60000 OR btc_price > 200000)
           OR (btc_dominance < 35 OR btc_dominance > 75)
           OR (alt_strength_ratio > 25000000 OR alt_strength_ratio < 5000000)
        ORDER BY timestamp DESC
    """)
    outliers = cursor.fetchall()
    
    if outliers:
        print(f"Found {len(outliers)} outlier entries:")
        for row in outliers:
            date = datetime.fromtimestamp(row[0], timezone.utc)
            print(f'  {date.strftime("%Y-%m-%d %H:%M")}: BTC=${row[1]:,.0f}, Dom={row[2]:.1f}%, Alt={row[3]:,.0f}')
        
        # Delete outliers
        print(f"\nDeleting {len(outliers)} outlier entries...")
        cursor.execute("""
            DELETE FROM macro_market_data
            WHERE (btc_price < 60000 OR btc_price > 200000)
               OR (btc_dominance < 35 OR btc_dominance > 75)
               OR (alt_strength_ratio > 25000000 OR alt_strength_ratio < 5000000)
        """)
        
        deleted_count = cursor.rowcount
        print(f"Deleted {deleted_count} outlier entries")
        
        # Get updated stats
        cursor.execute("SELECT COUNT(*) FROM macro_market_data")
        remaining_count = cursor.fetchone()[0]
        print(f"Remaining data points: {remaining_count}")
        
        conn.commit()
        print("Database cleaned successfully!")
        
    else:
        print("No outliers found to clean")

print("\nUpdated data sample:")
cursor.execute("""
    SELECT timestamp, btc_price, btc_dominance, alt_strength_ratio 
    FROM macro_market_data 
    ORDER BY timestamp DESC 
    LIMIT 5
""")
recent_data = cursor.fetchall()

for row in recent_data:
    date = datetime.fromtimestamp(row[0], timezone.utc)
    print(f'{date.strftime("%Y-%m-%d %H:%M")}: BTC=${row[1]:,.0f}, Dom={row[2]:.1f}%, Alt={row[3]:,.0f}')