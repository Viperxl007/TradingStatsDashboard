"""
Datetime Format Fix Utility

Addresses datetime format issues in the active trades database that were causing
context retrieval failures with 'fromisoformat: argument must be str' errors.
"""

import sqlite3
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import json

logger = logging.getLogger(__name__)

class DatetimeFixer:
    """Utility class to fix datetime format issues in the database"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def diagnose_datetime_issues(self) -> Dict[str, Any]:
        """Diagnose datetime format issues in the active trades table"""
        issues = {
            'total_records': 0,
            'datetime_issues': [],
            'field_types': {},
            'sample_data': []
        }
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get table schema
                cursor.execute("PRAGMA table_info(active_trades)")
                schema = cursor.fetchall()
                
                # Get all records
                cursor.execute("SELECT * FROM active_trades")
                records = cursor.fetchall()
                issues['total_records'] = len(records)
                
                # Get column names
                column_names = [col[1] for col in schema]
                
                # Check each record for datetime issues
                for i, record in enumerate(records):
                    record_dict = dict(zip(column_names, record))
                    
                    # Check datetime fields
                    datetime_fields = ['created_at', 'updated_at', 'entry_date', 'exit_date']
                    for field in datetime_fields:
                        if field in record_dict and record_dict[field] is not None:
                            value = record_dict[field]
                            field_type = type(value).__name__
                            
                            if field not in issues['field_types']:
                                issues['field_types'][field] = {}
                            
                            if field_type not in issues['field_types'][field]:
                                issues['field_types'][field][field_type] = 0
                            issues['field_types'][field][field_type] += 1
                            
                            # Try to parse as datetime
                            try:
                                if isinstance(value, str):
                                    datetime.fromisoformat(value.replace('Z', '+00:00'))
                                elif isinstance(value, (int, float)):
                                    datetime.fromtimestamp(value / 1000 if value > 1e10 else value)
                                else:
                                    issues['datetime_issues'].append({
                                        'record_id': record_dict.get('id', i),
                                        'field': field,
                                        'value': value,
                                        'type': field_type,
                                        'issue': f'Unexpected type for datetime field: {field_type}'
                                    })
                            except (ValueError, TypeError) as e:
                                issues['datetime_issues'].append({
                                    'record_id': record_dict.get('id', i),
                                    'field': field,
                                    'value': value,
                                    'type': field_type,
                                    'issue': str(e)
                                })
                    
                    # Store sample data for first 3 records
                    if i < 3:
                        issues['sample_data'].append(record_dict)
                
        except Exception as e:
            logger.error(f"Error diagnosing datetime issues: {e}")
            issues['error'] = str(e)
        
        return issues
    
    def fix_datetime_formats(self) -> Dict[str, Any]:
        """Fix datetime format issues in the active trades table"""
        result = {
            'success': False,
            'records_updated': 0,
            'errors': []
        }
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get all records
                cursor.execute("SELECT * FROM active_trades")
                records = cursor.fetchall()
                
                # Get column names
                cursor.execute("PRAGMA table_info(active_trades)")
                schema = cursor.fetchall()
                column_names = [col[1] for col in schema]
                
                datetime_fields = ['created_at', 'updated_at', 'entry_date', 'exit_date']
                
                for record in records:
                    record_dict = dict(zip(column_names, record))
                    record_id = record_dict.get('id')
                    updated = False
                    
                    for field in datetime_fields:
                        if field in record_dict and record_dict[field] is not None:
                            value = record_dict[field]
                            
                            try:
                                # Convert to ISO format string
                                if isinstance(value, (int, float)):
                                    # Assume timestamp (handle both seconds and milliseconds)
                                    timestamp = value / 1000 if value > 1e10 else value
                                    dt = datetime.fromtimestamp(timestamp)
                                    iso_string = dt.isoformat()
                                    
                                    cursor.execute(
                                        f"UPDATE active_trades SET {field} = ? WHERE id = ?",
                                        (iso_string, record_id)
                                    )
                                    updated = True
                                    
                                elif isinstance(value, str):
                                    # Try to parse and reformat
                                    try:
                                        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                        iso_string = dt.isoformat()
                                        
                                        if iso_string != value:
                                            cursor.execute(
                                                f"UPDATE active_trades SET {field} = ? WHERE id = ?",
                                                (iso_string, record_id)
                                            )
                                            updated = True
                                    except ValueError:
                                        # Try parsing as timestamp string
                                        try:
                                            timestamp = float(value)
                                            timestamp = timestamp / 1000 if timestamp > 1e10 else timestamp
                                            dt = datetime.fromtimestamp(timestamp)
                                            iso_string = dt.isoformat()
                                            
                                            cursor.execute(
                                                f"UPDATE active_trades SET {field} = ? WHERE id = ?",
                                                (iso_string, record_id)
                                            )
                                            updated = True
                                        except (ValueError, TypeError):
                                            result['errors'].append(f"Could not parse {field} value '{value}' for record {record_id}")
                                
                            except Exception as e:
                                result['errors'].append(f"Error fixing {field} for record {record_id}: {e}")
                    
                    if updated:
                        result['records_updated'] += 1
                
                conn.commit()
                result['success'] = True
                
        except Exception as e:
            logger.error(f"Error fixing datetime formats: {e}")
            result['errors'].append(str(e))
        
        return result
    
    def validate_fixes(self) -> Dict[str, Any]:
        """Validate that datetime fixes were successful"""
        validation = {
            'success': True,
            'all_fields_valid': True,
            'validation_errors': []
        }
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute("SELECT * FROM active_trades")
                records = cursor.fetchall()
                
                cursor.execute("PRAGMA table_info(active_trades)")
                schema = cursor.fetchall()
                column_names = [col[1] for col in schema]
                
                datetime_fields = ['created_at', 'updated_at', 'entry_date', 'exit_date']
                
                for record in records:
                    record_dict = dict(zip(column_names, record))
                    record_id = record_dict.get('id')
                    
                    for field in datetime_fields:
                        if field in record_dict and record_dict[field] is not None:
                            value = record_dict[field]
                            
                            try:
                                if isinstance(value, str):
                                    datetime.fromisoformat(value.replace('Z', '+00:00'))
                                else:
                                    validation['validation_errors'].append(
                                        f"Record {record_id} field {field} is not a string: {type(value).__name__}"
                                    )
                                    validation['all_fields_valid'] = False
                            except ValueError as e:
                                validation['validation_errors'].append(
                                    f"Record {record_id} field {field} invalid format: {e}"
                                )
                                validation['all_fields_valid'] = False
                
        except Exception as e:
            validation['success'] = False
            validation['validation_errors'].append(str(e))
        
        return validation


def run_datetime_fix(db_path: str) -> Dict[str, Any]:
    """Main function to run the datetime fix process"""
    fixer = DatetimeFixer(db_path)
    
    print("🔍 Diagnosing datetime issues...")
    diagnosis = fixer.diagnose_datetime_issues()
    
    print(f"📊 Found {len(diagnosis['datetime_issues'])} datetime issues in {diagnosis['total_records']} records")
    
    if diagnosis['datetime_issues']:
        print("🔧 Fixing datetime formats...")
        fix_result = fixer.fix_datetime_formats()
        
        print(f"✅ Updated {fix_result['records_updated']} records")
        if fix_result['errors']:
            print(f"⚠️ {len(fix_result['errors'])} errors occurred")
        
        print("🔍 Validating fixes...")
        validation = fixer.validate_fixes()
        
        if validation['all_fields_valid']:
            print("✅ All datetime fields are now valid")
        else:
            print(f"❌ {len(validation['validation_errors'])} validation errors remain")
    else:
        print("✅ No datetime issues found")
    
    return {
        'diagnosis': diagnosis,
        'fix_result': fix_result if diagnosis['datetime_issues'] else None,
        'validation': validation if diagnosis['datetime_issues'] else None
    }


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python datetime_fix.py <database_path>")
        sys.exit(1)
    
    db_path = sys.argv[1]
    result = run_datetime_fix(db_path)
    
    print("\n📋 Summary:")
    print(json.dumps(result, indent=2, default=str))