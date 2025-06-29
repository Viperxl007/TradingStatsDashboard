#!/usr/bin/env python3
"""
Script to retrieve a recent historical chart analysis "Raw Data" entry from the database
and reduce its size by replacing large fields with placeholders for schema analysis.
"""

import sqlite3
import json
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional

def reduce_data_size(data: Any, max_string_length: int = 100) -> Any:
    """
    Recursively reduce the size of data by replacing large strings and binary data with placeholders.
    
    Args:
        data: The data to reduce
        max_string_length: Maximum length for string fields before replacement
        
    Returns:
        Reduced data with placeholders
    """
    if isinstance(data, dict):
        reduced = {}
        for key, value in data.items():
            # Handle specific known large fields
            if key.lower() in ['image', 'imagedata', 'chartimagebase64', 'markedupchartimagebase64', 'image_data']:
                reduced[key] = "<IMAGE_DATA>"
            elif key.lower() in ['raw_data', 'rawdata', 'binary_data', 'binarydata']:
                reduced[key] = "<BINARY_DATA>"
            elif key.lower() in ['full_text', 'fulltext', 'description', 'long_description']:
                if isinstance(value, str) and len(value) > max_string_length:
                    reduced[key] = f"<LONG_TEXT_FIELD_{len(value)}_CHARS>"
                else:
                    reduced[key] = value
            else:
                reduced[key] = reduce_data_size(value, max_string_length)
        return reduced
    elif isinstance(data, list):
        return [reduce_data_size(item, max_string_length) for item in data]
    elif isinstance(data, str):
        # Check if it looks like base64 encoded data (common for images)
        if len(data) > max_string_length:
            if data.startswith('data:image/') or (len(data) > 1000 and data.replace('+', '').replace('/', '').replace('=', '').isalnum()):
                return "<BASE64_ENCODED_DATA>"
            else:
                return f"<LONG_STRING_{len(data)}_CHARS>"
        return data
    else:
        return data

def get_recent_chart_analysis(db_path: str, limit: int = 1) -> Optional[Dict[str, Any]]:
    """
    Retrieve the most recent chart analysis from the database.
    
    Args:
        db_path: Path to the SQLite database
        limit: Number of records to retrieve
        
    Returns:
        Dictionary containing the analysis data or None if not found
    """
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get the most recent analysis
            cursor.execute('''
                SELECT id, ticker, analysis_timestamp, analysis_data, 
                       confidence_score, image_hash, context_data, created_at
                FROM chart_analyses
                ORDER BY analysis_timestamp DESC
                LIMIT ?
            ''', (limit,))
            
            row = cursor.fetchone()
            
            if row:
                # Convert to dictionary
                result = dict(row)
                
                # Parse JSON fields
                try:
                    result['analysis_data'] = json.loads(result['analysis_data'])
                except (json.JSONDecodeError, TypeError):
                    result['analysis_data'] = result['analysis_data']
                
                try:
                    if result['context_data']:
                        result['context_data'] = json.loads(result['context_data'])
                except (json.JSONDecodeError, TypeError):
                    pass
                
                return result
            else:
                return None
                
    except Exception as e:
        print(f"Error retrieving chart analysis: {str(e)}")
        return None

def main():
    """Main function to retrieve and process chart analysis data."""
    
    # Database path
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'chart_analysis.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        sys.exit(1)
    
    print(f"Retrieving data from: {db_path}")
    
    # Get recent analysis
    analysis = get_recent_chart_analysis(db_path)
    
    if not analysis:
        print("No chart analysis data found in database.")
        sys.exit(1)
    
    print(f"Found analysis for ticker: {analysis['ticker']}")
    print(f"Analysis timestamp: {analysis['analysis_timestamp']}")
    print(f"Confidence score: {analysis['confidence_score']}")
    
    # Reduce data size
    reduced_analysis = reduce_data_size(analysis, max_string_length=200)
    
    # Create output with schema information
    output = {
        "metadata": {
            "description": "Sample historical chart analysis 'Raw Data' entry with reduced size",
            "original_timestamp": analysis['analysis_timestamp'],
            "ticker": analysis['ticker'],
            "confidence_score": analysis['confidence_score'],
            "data_reduction_applied": True,
            "reduction_rules": {
                "image_fields": "Replaced with <IMAGE_DATA>",
                "binary_fields": "Replaced with <BINARY_DATA>", 
                "long_strings": "Replaced with <LONG_STRING_X_CHARS> or <LONG_TEXT_FIELD_X_CHARS>",
                "base64_data": "Replaced with <BASE64_ENCODED_DATA>",
                "max_string_length": 200
            }
        },
        "schema_sample": reduced_analysis
    }
    
    # Output as formatted JSON
    print("\n" + "="*80)
    print("REDUCED CHART ANALYSIS RAW DATA SAMPLE")
    print("="*80)
    print(json.dumps(output, indent=2, default=str))
    
    # Also save to file
    output_file = os.path.join(os.path.dirname(__file__), 'chart_analysis_sample_reduced.json')
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\nSample data also saved to: {output_file}")
    
    # Print schema summary
    print("\n" + "="*80)
    print("SCHEMA SUMMARY")
    print("="*80)
    
    def print_schema(obj, prefix="", max_depth=3, current_depth=0):
        """Print a simplified schema structure."""
        if current_depth >= max_depth:
            print(f"{prefix}... (max depth reached)")
            return
            
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, dict):
                    print(f"{prefix}{key}: {{")
                    print_schema(value, prefix + "  ", max_depth, current_depth + 1)
                    print(f"{prefix}}}")
                elif isinstance(value, list):
                    print(f"{prefix}{key}: [")
                    if value:
                        print_schema(value[0], prefix + "  ", max_depth, current_depth + 1)
                    print(f"{prefix}]")
                else:
                    value_type = type(value).__name__
                    if isinstance(value, str) and value.startswith('<') and value.endswith('>'):
                        print(f"{prefix}{key}: {value_type} ({value})")
                    else:
                        print(f"{prefix}{key}: {value_type}")
        elif isinstance(obj, list):
            if obj:
                print_schema(obj[0], prefix, max_depth, current_depth)
        else:
            print(f"{prefix}{type(obj).__name__}")
    
    print_schema(reduced_analysis)

if __name__ == "__main__":
    main()