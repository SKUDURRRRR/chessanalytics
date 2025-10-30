"""
Test script to directly query usage stats and see what's returned
"""
import asyncio
import sys
from dotenv import load_dotenv

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv('.env.local')
load_dotenv('python/.env.local')

from python.core.usage_tracker import UsageTracker
from supabase import create_client
import os

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key)

async def test_usage_stats():
    """Test getting usage stats for a user"""
    email = "baisustipas@gmail.com"

    # Get user ID from email
    response = supabase.auth.admin.list_users()
    user_id = None
    for user in response.users:
        if user.email == email:
            user_id = user.id
            break

    if not user_id:
        print(f"[ERROR] User not found")
        return

    print(f"[OK] Testing for user: {email} (ID: {user_id})")

    # Test 1: Direct database query
    print(f"\n=== Test 1: Direct Database Query ===")
    result = supabase.table('authenticated_users').select(
        'account_tier, subscription_status, subscription_end_date'
    ).eq('id', user_id).execute()

    if result.data:
        user_data = result.data[0]
        print(f"account_tier: {user_data.get('account_tier')}")
        print(f"subscription_status: {user_data.get('subscription_status')}")
        print(f"subscription_end_date: {user_data.get('subscription_end_date')}")
        print(f"subscription_end_date type: {type(user_data.get('subscription_end_date'))}")
    else:
        print("[ERROR] No data returned")

    # Test 2: UsageTracker
    print(f"\n=== Test 2: UsageTracker.get_usage_stats() ===")
    tracker = UsageTracker(supabase)
    stats = await tracker.get_usage_stats(user_id)

    print(f"account_tier: {stats.get('account_tier')}")
    print(f"subscription_status: {stats.get('subscription_status')}")
    print(f"subscription_end_date: {stats.get('subscription_end_date')}")
    print(f"subscription_end_date type: {type(stats.get('subscription_end_date'))}")

    print(f"\n=== Full Stats Object ===")
    import json
    print(json.dumps(stats, indent=2, default=str))

if __name__ == '__main__':
    asyncio.run(test_usage_stats())
