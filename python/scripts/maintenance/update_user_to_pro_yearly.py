#!/usr/bin/env python3
"""
Update User to Pro Yearly Subscription
This script updates a user's subscription to Pro Yearly based on email address.
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Add parent directory to path for imports
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

# Load environment variables
load_dotenv(BASE_DIR / '.env.local')
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR / 'python' / '.env.local')
load_dotenv(BASE_DIR / 'python' / '.env')

# Get Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment")
    print("   Check your .env.local file")
    sys.exit(1)

def update_user_to_pro_yearly(email: str):
    """Update user subscription to Pro Yearly."""
    print("=" * 80)
    print("UPDATE USER TO PRO YEARLY")
    print("=" * 80)
    print()

    # Create Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("[OK] Connected to Supabase")
    print(f"[*] Looking up user: {email}")
    print()

    # Get user from auth.users
    try:
        auth_response = supabase.auth.admin.list_users()
        user_id = None
        user_email = None

        # Handle both response formats (list vs object with users attribute)
        users = auth_response.users if hasattr(auth_response, 'users') else auth_response

        for user in users:
            if user.email == email:
                user_id = user.id
                user_email = user.email
                print(f"[OK] Found user:")
                print(f"   ID: {user_id}")
                print(f"   Email: {user_email}")
                break

        if not user_id:
            print(f"[ERROR] User not found with email: {email}")
            return False

    except Exception as e:
        print(f"[ERROR] Getting user from auth: {e}")
        import traceback
        traceback.print_exc()
        return False

    # Check if user exists in authenticated_users
    try:
        result = supabase.table('authenticated_users').select('*').eq('id', user_id).execute()

        if not result.data:
            print(f"[WARN] User not found in authenticated_users table. Creating entry...")
            # Create entry
            supabase.table('authenticated_users').insert({
                'id': user_id,
                'account_tier': 'pro',
                'subscription_status': 'active',
                'subscription_end_date': (datetime.now() + timedelta(days=365)).isoformat(),
                'updated_at': datetime.now().isoformat()
            }).execute()
            print(f"[OK] Created authenticated_users entry")
        else:
            current_data = result.data[0]
            print(f"[INFO] Current subscription:")
            print(f"   Account Tier: {current_data.get('account_tier', 'N/A')}")
            print(f"   Status: {current_data.get('subscription_status', 'N/A')}")
            print(f"   End Date: {current_data.get('subscription_end_date', 'N/A')}")
            print()

            # Update to Pro Yearly
            subscription_end_date = datetime.now() + timedelta(days=365)

            update_data = {
                'account_tier': 'pro',
                'subscription_status': 'active',
                'subscription_end_date': subscription_end_date.isoformat(),
                'updated_at': datetime.now().isoformat()
            }

            print(f"[*] Updating to Pro Yearly...")
            supabase.table('authenticated_users').update(update_data).eq('id', user_id).execute()
            print(f"[OK] Updated successfully!")

    except Exception as e:
        print(f"[ERROR] Updating user: {e}")
        import traceback
        traceback.print_exc()
        return False

    # Verify the update
    print()
    print("=" * 80)
    print("VERIFICATION")
    print("=" * 80)
    try:
        result = supabase.table('authenticated_users').select('*').eq('id', user_id).execute()
        if result.data:
            user_data = result.data[0]
            print(f"[OK] Updated user subscription:")
            print(f"   Email: {email}")
            print(f"   User ID: {user_id}")
            print(f"   Account Tier: {user_data.get('account_tier')}")
            print(f"   Subscription Status: {user_data.get('subscription_status')}")
            print(f"   Subscription End Date: {user_data.get('subscription_end_date')}")
            print(f"   Updated At: {user_data.get('updated_at')}")
            return True
        else:
            print("[ERROR] Could not verify update")
            return False
    except Exception as e:
        print(f"[ERROR] Verifying update: {e}")
        return False

if __name__ == "__main__":
    email = "michael.sarthou@gmail.com"

    if len(sys.argv) > 1:
        email = sys.argv[1]

    success = update_user_to_pro_yearly(email)
    sys.exit(0 if success else 1)
