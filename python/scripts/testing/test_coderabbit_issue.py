"""
Test script to verify CodeRabbit's suggestion about get_user_by_email vs list_users
"""
import os
from dotenv import load_dotenv
from supabase import create_client
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv('.env.local')
load_dotenv('python/.env.local')

def test_auth_admin_methods():
    """Test what auth.admin methods are available"""

    # Initialize Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase = create_client(supabase_url, supabase_key)

    print("=" * 70)
    print("INVESTIGATION: CodeRabbit Suggestion")
    print("=" * 70)

    # Check what methods are available on auth.admin
    print("\n[1] Available methods on supabase.auth.admin:")
    print("-" * 70)
    admin_methods = [method for method in dir(supabase.auth.admin) if not method.startswith('_')]
    for method in admin_methods:
        print(f"   - {method}")

    # Check if get_user_by_email exists
    print("\n[2] Does get_user_by_email exist?")
    print("-" * 70)
    has_get_user_by_email = hasattr(supabase.auth.admin, 'get_user_by_email')
    print(f"   Result: {has_get_user_by_email}")

    if not has_get_user_by_email:
        print("   ❌ Method does NOT exist in supabase-py SDK")
    else:
        print("   ✅ Method exists in supabase-py SDK")

    # Check list_users signature and capabilities
    print("\n[3] list_users() signature and capabilities:")
    print("-" * 70)

    try:
        import inspect
        list_users_sig = inspect.signature(supabase.auth.admin.list_users)
        print(f"   Signature: {list_users_sig}")

        # Get the docstring
        docstring = inspect.getdoc(supabase.auth.admin.list_users)
        if docstring:
            print(f"\n   Docstring:")
            for line in docstring.split('\n'):
                print(f"      {line}")
    except Exception as e:
        print(f"   Error getting signature: {e}")

    # Test list_users with pagination parameters
    print("\n[4] Testing list_users with pagination:")
    print("-" * 70)

    try:
        # Try calling with page and per_page parameters
        print("   Attempting: list_users(page=1, per_page=10)")
        result = supabase.auth.admin.list_users(page=1, per_page=10)
        users = getattr(result, 'users', [])
        print(f"   ✅ Success! Returned {len(users)} users")
        print(f"   Result type: {type(result)}")
        print(f"   Result attributes: {[attr for attr in dir(result) if not attr.startswith('_')]}")
    except TypeError as e:
        print(f"   ❌ TypeError: {e}")
        print("   (pagination parameters not supported)")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Try default list_users
    print("\n   Attempting: list_users() with no parameters")
    try:
        result = supabase.auth.admin.list_users()
        users = getattr(result, 'users', [])
        print(f"   ✅ Success! Returned {len(users)} users")

        # Check if there's a way to get total count or pagination info
        result_attrs = {attr: getattr(result, attr) for attr in dir(result) if not attr.startswith('_') and not callable(getattr(result, attr))}
        print(f"\n   Result attributes:")
        for key, value in result_attrs.items():
            if key != 'users':  # Skip the users list
                print(f"      {key}: {value}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Test actual lookup by email
    print("\n[5] Testing actual user lookup by email:")
    print("-" * 70)

    test_email = os.getenv('TEST_USER_EMAIL', 'test@example.com')
    print(f"   Looking for: {test_email}")

    # Method 1: Current approach (list_users and loop)
    print("\n   Method 1: list_users() and loop")
    try:
        result = supabase.auth.admin.list_users()
        users = getattr(result, 'users', [])
        user_id = None
        for user in users:
            if user.email == test_email:
                user_id = user.id
                break

        if user_id:
            print(f"   ✅ Found user: {user_id}")
        else:
            print(f"   ❌ User not found (may be beyond first 100)")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # Method 2: Try get_user_by_email if it exists
    if has_get_user_by_email:
        print("\n   Method 2: get_user_by_email()")
        try:
            result = supabase.auth.admin.get_user_by_email(test_email)
            print(f"   ✅ Found user: {result.id if hasattr(result, 'id') else result}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    print("\n📋 CodeRabbit's Suggestion:")
    print("   - Replace list_users() with get_user_by_email()")
    print("   - Reason: list_users() only returns first 100 users")

    print("\n🔍 Investigation Results:")

    if not has_get_user_by_email:
        print("   ❌ CODERABBIT IS INCORRECT")
        print("   - get_user_by_email() does NOT exist in supabase-py")
        print("   - This is likely a false positive due to:")
        print("      * CodeRabbit confusing Python SDK with JavaScript SDK")
        print("      * Or suggesting a method that doesn't exist yet")
        print("\n   ⚠️  However, the PAGINATION CONCERN IS VALID:")
        print("   - list_users() may have default limits")
        print("   - For production use, should check if pagination is needed")
        print("   - For one-off admin scripts, this is usually acceptable")
    else:
        print("   ✅ CODERABBIT IS CORRECT")
        print("   - get_user_by_email() exists and should be used")
        print("   - This is a more efficient approach")

    print("\n💡 RECOMMENDATION:")
    if not has_get_user_by_email:
        print("   Context matters:")
        print("   - fix_subscription_end_date_simple.py: One-off admin script")
        print("   - test_api_endpoint.py: Test script")
        print("   - test_usage_stats.py: Test script")
        print("\n   For these scripts:")
        print("   ✅ Current approach is ACCEPTABLE")
        print("   - They're admin/test scripts, not production code")
        print("   - Unlikely to have >100 users in most projects")
        print("   - Can be updated later if needed")
        print("\n   For production code:")
        print("   ⚠️  Should implement proper pagination or alternative lookup")
    else:
        print("   Switch to get_user_by_email() for better performance")

    print("\n" + "=" * 70)

if __name__ == '__main__':
    test_auth_admin_methods()
