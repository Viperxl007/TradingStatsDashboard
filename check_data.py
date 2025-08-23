import sys
import sqlite3
sys.path.append('backend')
from models.macro_sentiment_models import get_macro_db
from datetime import datetime, timezone

db = get_macro_db()

# Check total data points using direct SQL
with sqlite3.connect(db.db_path) as conn:
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute("SELECT COUNT(*) FROM macro_market_data")
    total_count = cursor.fetchone()[0]
    print(f'Total data points in database: {total_count}')
    
    # Get date range
    cursor.execute("SELECT MIN(timestamp), MAX(timestamp) FROM macro_market_data")
    min_ts, max_ts = cursor.fetchone()
    
    if min_ts and max_ts:
        start_date = datetime.fromtimestamp(min_ts, timezone.utc)
        end_date = datetime.fromtimestamp(max_ts, timezone.utc)
        print(f'Date range: {start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")}')
        print(f'Days of data: {(max_ts - min_ts) / (24*60*60):.1f}')
    
    # Get recent data sample
    cursor.execute("""
        SELECT timestamp, btc_price, btc_dominance, alt_strength_ratio
        FROM macro_market_data
        ORDER BY timestamp DESC
        LIMIT 5
    """)
    recent_data = cursor.fetchall()
    
    if recent_data:
        print('\nRecent data sample:')
        for row in recent_data:
            date = datetime.fromtimestamp(row[0], timezone.utc)
            print(f'{date.strftime("%Y-%m-%d %H:%M")}: BTC=${row[1]:,.0f}, Dom={row[2]:.1f}%, Alt={row[3]:,.0f}')
    
    # Check for outliers
    print('\nChecking for data outliers...')
    cursor.execute("""
        SELECT timestamp, btc_price, btc_dominance, alt_strength_ratio
        FROM macro_market_data
        WHERE btc_price > 200000 OR btc_price < 10000
           OR btc_dominance > 90 OR btc_dominance < 20
           OR alt_strength_ratio > 50000000
        ORDER BY timestamp DESC
        LIMIT 10
    """)
    outlier_data = cursor.fetchall()
    
    if outlier_data:
        print('Found suspicious outliers:')
        for row in outlier_data:
            date = datetime.fromtimestamp(row[0], timezone.utc)
            print(f'{date.strftime("%Y-%m-%d %H:%M")}: BTC=${row[1]:,.0f}, Dom={row[2]:.1f}%, Alt={row[3]:,.0f}')
    else:
        print('No obvious outliers found')
    
    # Check data distribution over time
    print('\nData distribution by month:')
    cursor.execute("""
        SELECT
            strftime('%Y-%m', datetime(timestamp, 'unixepoch')) as month,
            COUNT(*) as count,
            AVG(btc_price) as avg_btc_price,
            AVG(btc_dominance) as avg_dominance
        FROM macro_market_data
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
    """)
    monthly_data = cursor.fetchall()
    
    for row in monthly_data:
        print(f'{row[0]}: {row[1]} points, BTC avg=${row[2]:,.0f}, Dom avg={row[3]:.1f}%')