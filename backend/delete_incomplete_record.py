import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.database_service import DatabaseService

# Initialize database
db = DatabaseService()

# Delete the incomplete record (Analysis ID 130)
print('Deleting incomplete record (Analysis ID 130)...')
result = db.execute_query('DELETE FROM chart_analysis WHERE id = ?', (130,))
print(f'Deleted {result} record(s)')

# Check what SOLUSD records remain
print('\nRemaining SOLUSD records:')
records = db.fetch_all('SELECT id, timestamp, action, summary, confidence FROM chart_analysis WHERE ticker = ? ORDER BY timestamp DESC LIMIT 5', ('SOLUSD',))
for record in records:
    print(f'   ID: {record[0]}, Time: {record[1]}, Action: {record[2]}, Confidence: {record[4]:.2f}')
    print(f'   Summary: {record[3][:100]}...')
    print()