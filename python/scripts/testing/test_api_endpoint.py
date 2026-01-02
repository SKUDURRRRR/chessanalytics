"""
Test the actual API endpoint that the frontend calls
"""
import asyncio
import requests
import json
from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv('.env.local')
load_dotenv('python/.env.local')

async def test_api_endpoint():
    """Test the /api/v1/auth/check-usage endpoint"""
    email = os.getenv('TEST_USER_EMAIL', 'test@example.com')

    # Initialize Supabase client
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    supabase = create_client(supabase_url, supabase_key)

    # Get user ID
    response = supabase.auth.admin.list_users()
    user_id = None
    for user in response.users:
        if user.email == email:
            user_id = user.id
            break

    if not user_id:
        print("[ERROR] User not found")
        return

    print(f"[OK] Testing API for user: {email}")
    print(f"User ID: {user_id}")

    # Get an auth token for this user
    # For testing, we'll use the anon key since we're calling from server-side
    anon_key = os.getenv('SUPABASE_ANON_KEY')

    # Test the API endpoint
    api_url = 'http://localhost:8002/api/v1/auth/check-usage'

    print(f"\n=== Calling API: POST {api_url} ===")

    response = requests.post(
        api_url,
        json={'user_id': user_id},
        headers={'Content-Type': 'application/json'},
        timeout=30
    )

    print(f"Status Code: {response.status_code}")
    print(f"\n=== Response ===")
    print(json.dumps(response.json(), indent=2))

    # Check if subscription_end_date is in the response
    data = response.json()
    if 'subscription_end_date' in data:
        print(f"\n[OK] subscription_end_date found: {data['subscription_end_date']}")
    else:
        print(f"\n[ERROR] subscription_end_date NOT in response!")
        print(f"Keys in response: {list(data.keys())}")

if __name__ == '__main__':
    asyncio.run(test_api_endpoint())
