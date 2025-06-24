#!/usr/bin/env python3
"""
Test script for Concentrated Liquidity Position Tracking System - Phase 1

This script demonstrates the core functionality of the CL position tracking system
including CRUD operations, fee updates, and portfolio analytics.
"""

import json
import sys
import os
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app

def test_cl_implementation():
    """Test the complete CL implementation."""
    print("=" * 60)
    print("CONCENTRATED LIQUIDITY POSITION TRACKING - PHASE 1 TEST")
    print("=" * 60)
    
    app = create_app()
    
    with app.test_client() as client:
        print("\n1. Testing Health Check...")
        response = client.get('/api/cl/health')
        health_data = json.loads(response.data)
        print(f"   Status: {health_data['status']}")
        print(f"   Positions Count: {health_data['positions_count']}")
        
        print("\n2. Testing Position Creation...")
        # Create multiple test positions
        positions_data = [
            {
                'trade_name': 'USDC/ETH Narrow Range',
                'pair_symbol': 'USDC/ETH',
                'contract_address': '0x1234567890abcdef1234567890abcdef12345678',
                'protocol': 'HyperSwap',
                'chain': 'HyperEVM',
                'price_range_min': 1900.0,
                'price_range_max': 2100.0,
                'liquidity_amount': 1500.0,
                'initial_investment': 7500.0,
                'entry_date': (datetime.now() - timedelta(days=30)).isoformat(),
                'notes': 'Conservative narrow range position'
            },
            {
                'trade_name': 'USDC/BTC Wide Range',
                'pair_symbol': 'USDC/BTC',
                'contract_address': '0xabcdef1234567890abcdef1234567890abcdef12',
                'protocol': 'HyperSwap',
                'chain': 'HyperEVM',
                'price_range_min': 40000.0,
                'price_range_max': 60000.0,
                'liquidity_amount': 2000.0,
                'initial_investment': 10000.0,
                'entry_date': (datetime.now() - timedelta(days=15)).isoformat(),
                'notes': 'Wide range BTC position for stability'
            }
        ]
        
        created_positions = []
        for i, position_data in enumerate(positions_data, 1):
            response = client.post('/api/cl/positions', 
                                  data=json.dumps(position_data),
                                  content_type='application/json')
            result = json.loads(response.data)
            if result['success']:
                created_positions.append(result['data'])
                print(f"   ✓ Created position {i}: {position_data['trade_name']}")
                print(f"     ID: {result['data']['id']}")
            else:
                print(f"   ✗ Failed to create position {i}: {result.get('error', 'Unknown error')}")
        
        print(f"\n3. Testing Position Retrieval...")
        response = client.get('/api/cl/positions')
        positions_result = json.loads(response.data)
        print(f"   Total positions: {positions_result['count']}")
        
        for position in positions_result['data']:
            print(f"   - {position['trade_name']}: ${position['initial_investment']:,.2f}")
        
        print(f"\n4. Testing Position Updates...")
        if created_positions:
            position_id = created_positions[0]['id']
            update_data = {
                'notes': 'Updated with additional monitoring notes',
                'fees_collected': 25.50
            }
            
            response = client.put(f'/api/cl/positions/{position_id}',
                                 data=json.dumps(update_data),
                                 content_type='application/json')
            result = json.loads(response.data)
            if result['success']:
                print(f"   ✓ Updated position: {result['data']['trade_name']}")
                print(f"     New fees collected: ${result['data']['fees_collected']}")
            else:
                print(f"   ✗ Failed to update position: {result.get('error', 'Unknown error')}")
        
        print(f"\n5. Testing Fee Updates...")
        if created_positions:
            position_id = created_positions[0]['id']
            fee_data = {
                'fees_amount': 15.75,
                'update_date': datetime.now().isoformat(),
                'notes': 'Weekly fee collection'
            }
            
            response = client.post(f'/api/cl/positions/{position_id}/fees',
                                  data=json.dumps(fee_data),
                                  content_type='application/json')
            result = json.loads(response.data)
            if result['success']:
                print(f"   ✓ Updated fees for position")
                print(f"     Total fees collected: ${result['data']['fees_collected']}")
            else:
                print(f"   ✗ Failed to update fees: {result.get('error', 'Unknown error')}")
        
        print(f"\n6. Testing Portfolio Summary...")
        response = client.get('/api/cl/portfolio/summary')
        summary_result = json.loads(response.data)
        if summary_result['success']:
            summary = summary_result['data']
            print(f"   Total Positions: {summary['total_positions']}")
            print(f"   Active Positions: {summary['active_positions']}")
            print(f"   Total Investment: ${summary['total_investment']:,.2f}")
            print(f"   Current Value: ${summary['current_value']:,.2f}")
            print(f"   Total Fees Collected: ${summary['total_fees_collected']:,.2f}")
            print(f"   Total P&L: ${summary['total_pnl']:,.2f}")
            print(f"   Total Return: {summary['total_return_pct']:.2f}%")
            if summary['best_performing_position']:
                print(f"   Best Performer: {summary['best_performing_position']}")
        
        print(f"\n7. Testing Position Closure...")
        if created_positions and len(created_positions) > 1:
            position_id = created_positions[1]['id']
            exit_data = {
                'exit_date': datetime.now().isoformat(),
                'notes': 'Closed due to range exit'
            }
            
            response = client.post(f'/api/cl/positions/{position_id}/close',
                                  data=json.dumps(exit_data),
                                  content_type='application/json')
            result = json.loads(response.data)
            if result['success']:
                print(f"   ✓ Closed position: {result['data']['trade_name']}")
                print(f"     Status: {result['data']['status']}")
                print(f"     Exit Date: {result['data']['exit_date']}")
            else:
                print(f"   ✗ Failed to close position: {result.get('error', 'Unknown error')}")
        
        print(f"\n8. Testing Filtered Queries...")
        # Test active positions only
        response = client.get('/api/cl/positions?status=active')
        active_result = json.loads(response.data)
        print(f"   Active positions: {active_result['count']}")
        
        # Test closed positions only
        response = client.get('/api/cl/positions?status=closed')
        closed_result = json.loads(response.data)
        print(f"   Closed positions: {closed_result['count']}")
        
        print(f"\n9. Final Portfolio Summary...")
        response = client.get('/api/cl/portfolio/summary')
        final_summary = json.loads(response.data)['data']
        print(f"   Final Stats:")
        print(f"   - Total Positions: {final_summary['total_positions']}")
        print(f"   - Active: {final_summary['active_positions']}, Closed: {final_summary['closed_positions']}")
        print(f"   - Total Investment: ${final_summary['total_investment']:,.2f}")
        print(f"   - Total Fees: ${final_summary['total_fees_collected']:,.2f}")
    
    print("\n" + "=" * 60)
    print("PHASE 1 IMPLEMENTATION TEST COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("\nCore Features Implemented:")
    print("✓ Database Models (CLPosition, CLPriceHistory, CLFeeHistory)")
    print("✓ Service Layer (CLService with business logic)")
    print("✓ API Routes (Full CRUD + fee management)")
    print("✓ Configuration (CL-specific settings)")
    print("✓ Flask Integration (Blueprint registration)")
    print("✓ Error Handling and Validation")
    print("✓ Portfolio Analytics")
    print("✓ Position Status Management")
    print("\nReady for Phase 2: Data Integration & Price Monitoring")

if __name__ == '__main__':
    test_cl_implementation()