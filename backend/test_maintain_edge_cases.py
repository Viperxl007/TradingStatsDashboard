#!/usr/bin/env python3
"""
Edge case tests for MAINTAIN recommendation logic
"""

import os
import sys
import json

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(__file__))

from services.active_trade_service import ActiveTradeService

def test_edge_cases():
    """Test edge cases for MAINTAIN logic"""
    print("🧪 Testing MAINTAIN Logic Edge Cases")
    print("=" * 50)
    
    # Initialize service
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'test_edge_cases.db')
    
    # Clean up any existing test database
    if os.path.exists(db_path):
        os.remove(db_path)
    
    trade_service = ActiveTradeService(db_path)
    ticker = "EDGETEST"
    timeframe = "1h"
    
    # Test 1: context_assessment as string instead of dict
    print("\n1️⃣ Testing context_assessment as string (should not crash)...")
    
    analysis_data_string = {
        "currentPrice": 100.0,
        "recommendations": {
            "action": "buy",
            "entryPrice": 95.0,
            "targetPrice": 110.0,
            "stopLoss": 90.0,
            "reasoning": "Test string context"
        },
        "context_assessment": "This is a string instead of dict",  # Invalid format
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "test",
                    "entry_condition": "Test condition",
                    "entry_price": 95.0,
                    "probability": "high"
                }]
            }
        }
    }
    
    trade_id = trade_service.create_trade_from_analysis(
        ticker, timeframe, 1, analysis_data_string
    )
    
    if trade_id is not None:
        print("✅ String context_assessment correctly allowed trade creation (graceful handling)")
        trade_service.close_trade_by_user(ticker, 100.0, "Test cleanup")
    else:
        print("❌ String context_assessment incorrectly prevented trade creation")
        return False
    
    # Test 2: Empty context_assessment dict
    print("\n2️⃣ Testing empty context_assessment dict...")
    
    analysis_data_empty = {
        "currentPrice": 100.0,
        "recommendations": {
            "action": "buy",
            "entryPrice": 95.0,
            "targetPrice": 110.0,
            "stopLoss": 90.0,
            "reasoning": "Test empty context"
        },
        "context_assessment": {},  # Empty dict
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "test",
                    "entry_condition": "Test condition",
                    "entry_price": 95.0,
                    "probability": "high"
                }]
            }
        }
    }
    
    trade_id = trade_service.create_trade_from_analysis(
        ticker, timeframe, 2, analysis_data_empty
    )
    
    if trade_id is not None:
        print("✅ Empty context_assessment correctly allowed trade creation")
        trade_service.close_trade_by_user(ticker, 100.0, "Test cleanup")
    else:
        print("❌ Empty context_assessment incorrectly prevented trade creation")
        return False
    
    # Test 3: Mixed case MAINTAIN
    print("\n3️⃣ Testing mixed case 'Maintain'...")
    
    analysis_data_mixed = {
        "currentPrice": 100.0,
        "recommendations": {
            "action": "sell",
            "entryPrice": 105.0,
            "targetPrice": 90.0,
            "stopLoss": 110.0,
            "reasoning": "Test mixed case"
        },
        "context_assessment": {
            "previous_position_status": "Maintain",  # Mixed case
            "previous_position_reasoning": "Mixed case test"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "test",
                    "entry_condition": "Test condition",
                    "entry_price": 105.0,
                    "probability": "medium"
                }]
            }
        }
    }
    
    trade_id = trade_service.create_trade_from_analysis(
        ticker, timeframe, 3, analysis_data_mixed
    )
    
    if trade_id is None:
        print("✅ Mixed case 'Maintain' correctly prevented trade creation")
    else:
        print(f"❌ Mixed case 'Maintain' failed - trade {trade_id} was created")
        return False
    
    # Test 4: previous_position_status as non-string
    print("\n4️⃣ Testing previous_position_status as non-string...")
    
    analysis_data_nonstring = {
        "currentPrice": 100.0,
        "recommendations": {
            "action": "buy",
            "entryPrice": 95.0,
            "targetPrice": 110.0,
            "stopLoss": 90.0,
            "reasoning": "Test non-string status"
        },
        "context_assessment": {
            "previous_position_status": 123,  # Number instead of string
            "previous_position_reasoning": "Non-string test"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "test",
                    "entry_condition": "Test condition",
                    "entry_price": 95.0,
                    "probability": "low"
                }]
            }
        }
    }
    
    trade_id = trade_service.create_trade_from_analysis(
        ticker, timeframe, 4, analysis_data_nonstring
    )
    
    if trade_id is not None:
        print("✅ Non-string previous_position_status correctly allowed trade creation (graceful handling)")
        trade_service.close_trade_by_user(ticker, 100.0, "Test cleanup")
    else:
        print("❌ Non-string previous_position_status incorrectly prevented trade creation")
        return False
    
    # Test 5: Whitespace in MAINTAIN
    print("\n5️⃣ Testing MAINTAIN with whitespace...")
    
    analysis_data_whitespace = {
        "currentPrice": 100.0,
        "recommendations": {
            "action": "buy",
            "entryPrice": 95.0,
            "targetPrice": 110.0,
            "stopLoss": 90.0,
            "reasoning": "Test whitespace"
        },
        "context_assessment": {
            "previous_position_status": "  MAINTAIN  ",  # With whitespace
            "previous_position_reasoning": "Whitespace test"
        },
        "detailedAnalysis": {
            "tradingAnalysis": {
                "entry_strategies": [{
                    "strategy_type": "test",
                    "entry_condition": "Test condition",
                    "entry_price": 95.0,
                    "probability": "high"
                }]
            }
        }
    }
    
    trade_id = trade_service.create_trade_from_analysis(
        ticker, timeframe, 5, analysis_data_whitespace
    )
    
    if trade_id is None:
        print("✅ MAINTAIN with whitespace correctly prevented trade creation")
    else:
        print(f"❌ MAINTAIN with whitespace failed - trade {trade_id} was created")
        return False
    
    print("\n🎉 All edge case tests passed!")
    return True

if __name__ == "__main__":
    success = test_edge_cases()
    if success:
        print("\n✅ MAINTAIN logic is robust and handles all edge cases correctly!")
    else:
        print("\n❌ Some edge cases failed - review implementation!")