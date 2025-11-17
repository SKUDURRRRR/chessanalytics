import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Get Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment")
    sys.exit(1)

supabase: Client = create_client(url, key)

# Query the user by email
email = "m.prevelis@gmail.com"
print(f"Looking up user: {email}")

# Get user from auth.users
auth_response = supabase.auth.admin.list_users()
user_id = None
for user in auth_response:
    if user.email == email:
        user_id = user.id
        print(f"Found user ID: {user_id}")
        break

if not user_id:
    print(f"ERROR: User not found: {email}")
    sys.exit(1)

# Query authenticated_users table
result = supabase.table('authenticated_users').select('*').eq('id', user_id).execute()

if result.data:
    user_data = result.data[0]
    print("\nUser Data from authenticated_users:")
    print(f"  - account_tier: {user_data.get('account_tier')}")
    print(f"  - subscription_status: {user_data.get('subscription_status')}")
    print(f"  - subscription_end_date: {user_data.get('subscription_end_date')}")
    print(f"  - stripe_customer_id: {user_data.get('stripe_customer_id')}")
    print(f"  - stripe_subscription_id: {user_data.get('stripe_subscription_id')}")
else:
    print(f"ERROR: No data found in authenticated_users table for user {user_id}")
