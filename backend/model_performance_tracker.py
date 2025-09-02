#!/usr/bin/env python3
"""
Model Performance Tracker

This script demonstrates how to track and analyze the performance of different
Claude models used in chart analysis and macro sentiment analysis.
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json

def get_chart_analysis_model_performance(db_path: str = None) -> List[Dict[str, Any]]:
    """
    Get model performance data from chart analysis records.
    
    Args:
        db_path (str): Path to the database file
        
    Returns:
        List[Dict]: Model performance statistics
    """
    if not db_path:
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check if chart_analyses table exists and has model information
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='chart_analyses'
        """)
        
        if not cursor.fetchone():
            print("⚠️  Chart analyses table not found")
            return []
        
        # Get table schema to check for model columns
        cursor.execute("PRAGMA table_info(chart_analyses)")
        columns = [row[1] for row in cursor.fetchall()]
        
        print(f"📋 Chart analyses table columns: {columns}")
        
        # Try to get model performance data
        if 'model_used' in columns:
            cursor.execute("""
                SELECT 
                    model_used,
                    COUNT(*) as analysis_count,
                    AVG(confidence) as avg_confidence,
                    MIN(timestamp) as first_used,
                    MAX(timestamp) as last_used
                FROM chart_analyses 
                WHERE model_used IS NOT NULL
                GROUP BY model_used
                ORDER BY analysis_count DESC
            """)
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'model': row['model_used'],
                    'analysis_count': row['analysis_count'],
                    'avg_confidence': round(row['avg_confidence'] or 0, 2),
                    'first_used': row['first_used'],
                    'last_used': row['last_used']
                })
            
            return results
        else:
            print("⚠️  Model tracking not yet implemented in chart_analyses table")
            return []
            
    except Exception as e:
        print(f"❌ Error querying chart analysis performance: {e}")
        return []
    finally:
        if 'conn' in locals():
            conn.close()

def get_macro_sentiment_model_performance(db_path: str = None) -> List[Dict[str, Any]]:
    """
    Get model performance data from macro sentiment analysis records.
    
    Args:
        db_path (str): Path to the database file
        
    Returns:
        List[Dict]: Model performance statistics
    """
    if not db_path:
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check if macro_sentiment_analysis table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='macro_sentiment_analysis'
        """)
        
        if not cursor.fetchone():
            print("⚠️  Macro sentiment analysis table not found")
            return []
        
        # Get table schema
        cursor.execute("PRAGMA table_info(macro_sentiment_analysis)")
        columns = [row[1] for row in cursor.fetchall()]
        
        print(f"📋 Macro sentiment analysis table columns: {columns}")
        
        # Get model performance data
        if 'model_used' in columns:
            cursor.execute("""
                SELECT 
                    model_used,
                    COUNT(*) as analysis_count,
                    AVG(overall_confidence) as avg_confidence,
                    AVG(processing_time_ms) as avg_processing_time,
                    MIN(analysis_timestamp) as first_used,
                    MAX(analysis_timestamp) as last_used
                FROM macro_sentiment_analysis 
                WHERE model_used IS NOT NULL
                GROUP BY model_used
                ORDER BY analysis_count DESC
            """)
            
            results = []
            for row in cursor.fetchall():
                results.append({
                    'model': row['model_used'],
                    'analysis_count': row['analysis_count'],
                    'avg_confidence': round(row['avg_confidence'] or 0, 2),
                    'avg_processing_time_ms': round(row['avg_processing_time'] or 0, 2),
                    'first_used': datetime.fromtimestamp(row['first_used']).isoformat() if row['first_used'] else None,
                    'last_used': datetime.fromtimestamp(row['last_used']).isoformat() if row['last_used'] else None
                })
            
            return results
        else:
            print("⚠️  Model tracking not yet implemented in macro_sentiment_analysis table")
            return []
            
    except Exception as e:
        print(f"❌ Error querying macro sentiment performance: {e}")
        return []
    finally:
        if 'conn' in locals():
            conn.close()

def display_model_performance():
    """Display model performance statistics."""
    print("📊 Model Performance Tracking Report")
    print("=" * 60)
    
    # Chart Analysis Performance
    print("\n🎯 Chart Analysis Model Performance")
    print("-" * 40)
    
    chart_performance = get_chart_analysis_model_performance()
    if chart_performance:
        for model_data in chart_performance:
            print(f"📈 {model_data['model']}")
            print(f"   Analyses: {model_data['analysis_count']}")
            print(f"   Avg Confidence: {model_data['avg_confidence']}%")
            print(f"   First Used: {model_data['first_used']}")
            print(f"   Last Used: {model_data['last_used']}")
            print()
    else:
        print("   No chart analysis data available yet")
    
    # Macro Sentiment Performance
    print("\n🌍 Macro Sentiment Model Performance")
    print("-" * 40)
    
    macro_performance = get_macro_sentiment_model_performance()
    if macro_performance:
        for model_data in macro_performance:
            print(f"📊 {model_data['model']}")
            print(f"   Analyses: {model_data['analysis_count']}")
            print(f"   Avg Confidence: {model_data['avg_confidence']}%")
            print(f"   Avg Processing Time: {model_data['avg_processing_time_ms']}ms")
            print(f"   First Used: {model_data['first_used']}")
            print(f"   Last Used: {model_data['last_used']}")
            print()
    else:
        print("   No macro sentiment data available yet")

def create_performance_tracking_queries():
    """Create useful SQL queries for model performance tracking."""
    print("\n📝 Useful Model Performance Queries")
    print("=" * 60)
    
    queries = {
        "Chart Analysis - Model Usage Over Time": """
            SELECT 
                DATE(timestamp) as date,
                model_used,
                COUNT(*) as daily_count
            FROM chart_analyses 
            WHERE model_used IS NOT NULL
            GROUP BY DATE(timestamp), model_used
            ORDER BY date DESC, daily_count DESC;
        """,
        
        "Chart Analysis - Model Confidence Comparison": """
            SELECT 
                model_used,
                AVG(confidence) as avg_confidence,
                MIN(confidence) as min_confidence,
                MAX(confidence) as max_confidence,
                COUNT(*) as sample_size
            FROM chart_analyses 
            WHERE model_used IS NOT NULL AND confidence IS NOT NULL
            GROUP BY model_used
            ORDER BY avg_confidence DESC;
        """,
        
        "Macro Sentiment - Model Performance Metrics": """
            SELECT 
                model_used,
                COUNT(*) as total_analyses,
                AVG(overall_confidence) as avg_confidence,
                AVG(processing_time_ms) as avg_processing_time,
                AVG(btc_trend_strength) as avg_btc_trend_strength,
                AVG(eth_trend_strength) as avg_eth_trend_strength,
                AVG(alt_trend_strength) as avg_alt_trend_strength
            FROM macro_sentiment_analysis 
            WHERE model_used IS NOT NULL
            GROUP BY model_used
            ORDER BY total_analyses DESC;
        """,
        
        "Recent Model Usage (Last 7 Days)": """
            SELECT 
                model_used,
                COUNT(*) as recent_usage,
                'chart_analysis' as source
            FROM chart_analyses 
            WHERE model_used IS NOT NULL 
                AND timestamp >= datetime('now', '-7 days')
            GROUP BY model_used
            
            UNION ALL
            
            SELECT 
                model_used,
                COUNT(*) as recent_usage,
                'macro_sentiment' as source
            FROM macro_sentiment_analysis 
            WHERE model_used IS NOT NULL 
                AND analysis_timestamp >= strftime('%s', datetime('now', '-7 days'))
            GROUP BY model_used
            ORDER BY recent_usage DESC;
        """
    }
    
    for query_name, query in queries.items():
        print(f"\n🔍 {query_name}:")
        print(query.strip())
        print()

def main():
    """Main function to demonstrate model performance tracking."""
    print("🚀 Claude Model Performance Tracking")
    print("=" * 60)
    
    # Display current performance data
    display_model_performance()
    
    # Show useful queries
    create_performance_tracking_queries()
    
    print("\n💡 How to Use Model Performance Tracking:")
    print("=" * 60)
    print("1. 📊 Chart Analysis: Model info is stored in 'modelUsed' and 'analysisMetadata' fields")
    print("2. 🌍 Macro Sentiment: Model info is stored in 'model_used' field in database")
    print("3. 📈 Performance Metrics: Track confidence, processing time, and usage patterns")
    print("4. 🔍 Analysis: Use the SQL queries above to analyze model performance")
    print("5. 📋 Comparison: Compare different models' effectiveness over time")
    
    print("\n🎯 Next Steps:")
    print("- Run some chart analyses with different models to populate data")
    print("- Trigger macro sentiment analyses with various models")
    print("- Use the SQL queries to analyze model performance")
    print("- Set up automated reporting for model performance metrics")

if __name__ == "__main__":
    main()