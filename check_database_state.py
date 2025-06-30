#!/usr/bin/env python3
import sys
import os
sys.path.append('backend')
sys.path.append('backend/app')
from chart_context import ChartContextManager
import sqlite3

# Initialize chart context manager
context_manager = ChartContextManager()

print('Current SOLUSD database state:')
with sqlite3.connect(context_manager.db_path) as conn:
    cursor = conn.cursor()
    
    # Check if chart_analysis table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chart_analysis'")
    if cursor.fetchone():
        records = cursor.execute('SELECT id, timestamp, action, summary, confidence, entry_price, target_price, stop_loss FROM chart_analysis WHERE ticker = ? ORDER BY timestamp DESC LIMIT 5', ('SOLUSD',)).fetchall()
        for record in records:
            print(f'   ID: {record[0]}')
            print(f'   Time: {record[1]}')
            print(f'   Action: {record[2]}')
            print(f'   Entry: ${record[5]}')
            print(f'   Target: ${record[6]}')
            print(f'   Stop: ${record[7]}')
            print(f'   Confidence: {record[4]:.2f}')
            print(f'   Summary: {record[3][:100]}...')
            print()
    else:
        print('chart_analysis table does not exist')
        
    # Check if chart_analyses table exists (newer table)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chart_analyses'")
    if cursor.fetchone():
        print('\nChecking chart_analyses table:')
        records = cursor.execute('SELECT id, ticker, analysis_timestamp FROM chart_analyses WHERE ticker = ? ORDER BY analysis_timestamp DESC LIMIT 5', ('SOLUSD',)).fetchall()
        for record in records:
            print(f'   ID: {record[0]}, Ticker: {record[1]}, Time: {record[2]}')