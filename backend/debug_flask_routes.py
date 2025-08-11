#!/usr/bin/env python3
"""
Debug Flask routes registration.

This script helps identify why the macro sentiment routes might not be registering.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

def test_route_registration():
    """Test if the macro sentiment routes can be registered."""
    print("🔍 DEBUGGING FLASK ROUTE REGISTRATION")
    print("=" * 50)
    
    try:
        # Test importing the registration function
        print("1. Testing route import...")
        from routes.macro_sentiment_routes import register_macro_sentiment_routes, macro_sentiment_bp
        print("✅ Successfully imported macro sentiment routes")
        
        # Test creating a Flask app
        print("\n2. Testing Flask app creation...")
        from flask import Flask
        app = Flask(__name__)
        print("✅ Flask app created")
        
        # Test registering routes
        print("\n3. Testing route registration...")
        register_macro_sentiment_routes(app)
        print("✅ Routes registered successfully")
        
        # List all registered routes
        print("\n4. Listing all registered routes...")
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods),
                'rule': rule.rule
            })
        
        # Filter macro sentiment routes
        macro_routes = [r for r in routes if 'macro' in r['endpoint'] or 'macro-sentiment' in r['rule']]
        
        if macro_routes:
            print(f"✅ Found {len(macro_routes)} macro sentiment routes:")
            for route in macro_routes:
                methods = [m for m in route['methods'] if m not in ['HEAD', 'OPTIONS']]
                print(f"   {route['rule']} [{', '.join(methods)}] -> {route['endpoint']}")
        else:
            print("❌ No macro sentiment routes found!")
            print("\n📋 All registered routes:")
            for route in routes:
                methods = [m for m in route['methods'] if m not in ['HEAD', 'OPTIONS']]
                if methods:  # Only show routes with actual methods
                    print(f"   {route['rule']} [{', '.join(methods)}] -> {route['endpoint']}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("🔧 Possible issues:")
        print("   - Missing dependencies")
        print("   - Import path problems")
        return False
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        print("🔧 Possible issues:")
        print("   - Blueprint registration failed")
        print("   - Route definition problems")
        return False

def test_app_creation():
    """Test creating the full app using the create_app function."""
    print("\n🔍 TESTING FULL APP CREATION")
    print("=" * 50)
    
    try:
        print("1. Testing app creation...")
        from app import create_app
        app = create_app()
        print("✅ App created successfully")
        
        # List all routes
        print("\n2. Listing all routes in created app...")
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods),
                'rule': rule.rule
            })
        
        # Filter macro sentiment routes
        macro_routes = [r for r in routes if 'macro' in r['endpoint'] or 'macro-sentiment' in r['rule']]
        
        print(f"📊 Total routes: {len(routes)}")
        print(f"📊 Macro sentiment routes: {len(macro_routes)}")
        
        if macro_routes:
            print("\n✅ Macro sentiment routes found:")
            for route in macro_routes:
                methods = [m for m in route['methods'] if m not in ['HEAD', 'OPTIONS']]
                print(f"   {route['rule']} [{', '.join(methods)}] -> {route['endpoint']}")
        else:
            print("\n❌ No macro sentiment routes found in full app!")
            print("🔧 This suggests the registration is failing in create_app()")
            
        return len(macro_routes) > 0
        
    except Exception as e:
        print(f"❌ App creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_dependencies():
    """Check if all required dependencies are available."""
    print("\n🔍 CHECKING DEPENDENCIES")
    print("=" * 50)
    
    required_modules = [
        'flask',
        'services.macro_bootstrap_service',
        'services.macro_scanner_service', 
        'services.macro_ai_service',
        'services.macro_chart_service',
        'models.macro_sentiment_models'
    ]
    
    missing = []
    for module in required_modules:
        try:
            __import__(module)
            print(f"✅ {module}")
        except ImportError as e:
            print(f"❌ {module}: {e}")
            missing.append(module)
    
    if missing:
        print(f"\n⚠️  Missing {len(missing)} required modules")
        print("🔧 This could prevent route registration")
        return False
    else:
        print("\n✅ All dependencies available")
        return True

def main():
    """Main debug function."""
    print("🔧 FLASK ROUTE REGISTRATION DEBUG")
    print("📊 Investigating why macro sentiment routes aren't working")
    print()
    
    # Check dependencies
    deps_ok = check_dependencies()
    
    # Test route registration
    routes_ok = test_route_registration()
    
    # Test full app creation
    app_ok = test_app_creation()
    
    # Summary
    print("\n" + "=" * 60)
    print("DEBUG SUMMARY")
    print("=" * 60)
    
    print(f"✅ Dependencies: {'PASS' if deps_ok else 'FAIL'}")
    print(f"✅ Route Registration: {'PASS' if routes_ok else 'FAIL'}")
    print(f"✅ Full App Creation: {'PASS' if app_ok else 'FAIL'}")
    
    if all([deps_ok, routes_ok, app_ok]):
        print("\n🎉 SUCCESS: Routes should be working!")
        print("🔧 If you're still getting 404:")
        print("   1. Make sure Flask app is running: python backend/run.py")
        print("   2. Check the console for any registration errors")
        print("   3. Verify the app is listening on port 5000")
        
    else:
        print("\n❌ ISSUES FOUND:")
        if not deps_ok:
            print("   - Missing dependencies - install requirements")
        if not routes_ok:
            print("   - Route registration failing - check imports")
        if not app_ok:
            print("   - App creation failing - check create_app() function")
            
        print("\n🔧 NEXT STEPS:")
        print("   1. Fix the issues above")
        print("   2. Try running: python backend/run.py")
        print("   3. Check console output for errors")

if __name__ == "__main__":
    main()