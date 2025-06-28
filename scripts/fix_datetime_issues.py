#!/usr/bin/env python3
"""
Script to fix datetime format issues in the trading system database.

This script addresses the 'fromisoformat: argument must be str' errors
that were preventing proper context retrieval for AI trade analysis.
"""

import os
import sys
import json
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from utils.datetime_fix import run_datetime_fix

def main():
    """Main function to run datetime fixes"""
    
    # Default database path
    default_db_path = backend_path / "instance" / "chart_analysis.db"
    
    # Check if database exists
    if not default_db_path.exists():
        print(f"❌ Database not found at {default_db_path}")
        print("Please ensure the backend has been initialized and the database exists.")
        return 1
    
    print("🔧 AI Trade Context Synchronization - Datetime Fix Utility")
    print("=" * 60)
    print(f"📁 Database: {default_db_path}")
    print()
    
    try:
        # Run the datetime fix
        result = run_datetime_fix(str(default_db_path))
        
        print("\n" + "=" * 60)
        print("📋 SUMMARY REPORT")
        print("=" * 60)
        
        diagnosis = result.get('diagnosis', {})
        print(f"📊 Total Records: {diagnosis.get('total_records', 0)}")
        print(f"🔍 Datetime Issues Found: {len(diagnosis.get('datetime_issues', []))}")
        
        if diagnosis.get('field_types'):
            print("\n📈 Field Type Analysis:")
            for field, types in diagnosis['field_types'].items():
                print(f"  {field}: {types}")
        
        if result.get('fix_result'):
            fix_result = result['fix_result']
            print(f"\n🔧 Records Updated: {fix_result.get('records_updated', 0)}")
            if fix_result.get('errors'):
                print(f"⚠️ Errors: {len(fix_result['errors'])}")
                for error in fix_result['errors'][:3]:  # Show first 3 errors
                    print(f"  - {error}")
        
        if result.get('validation'):
            validation = result['validation']
            if validation.get('all_fields_valid'):
                print("\n✅ All datetime fields are now properly formatted")
            else:
                print(f"\n❌ {len(validation.get('validation_errors', []))} validation errors remain")
        
        print("\n🎯 Next Steps:")
        if diagnosis.get('datetime_issues'):
            if result.get('validation', {}).get('all_fields_valid'):
                print("  ✅ Datetime issues have been resolved")
                print("  🚀 You can now test the AI trade context synchronization")
                print("  📝 Check the SOL trade scenario to verify trigger detection works")
            else:
                print("  ⚠️ Some issues remain - check the validation errors above")
                print("  🔄 You may need to run this script again or investigate manually")
        else:
            print("  ✅ No datetime issues found - database is healthy")
            print("  🔍 If you're still experiencing context sync issues, check:")
            print("     - Backend API endpoints are responding")
            print("     - Network connectivity between frontend and backend")
            print("     - Context assessment parsing logic")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error running datetime fix: {e}")
        print("\n🔍 Troubleshooting:")
        print("  - Ensure the backend database is not in use")
        print("  - Check file permissions on the database")
        print("  - Verify the database schema is correct")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)