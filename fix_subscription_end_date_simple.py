"""
Simple script to fix subscription_end_date for a user by fetching from Stripe
"""
import asyncio
from python.core.stripe_service import StripeService
from supabase import create_client
import os
from dotenv import load_dotenv
import stripe
from datetime import datetime, timezone
import sys

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv('.env.local')
load_dotenv('python/.env.local')

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key)

# Initialize Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

async def fix_subscription_end_date(email: str):
    """Fix subscription end date for a given user email"""

    # Get user ID from email via auth.admin
    try:
        users_response = supabase.auth.admin.list_users()
        users = getattr(users_response, 'users', [])
        user_id = None
        for user in users:
            if user.email == email:
                user_id = user.id
                break

        if not user_id:
            print(f"[ERROR] User with email {email} not found")
            return

        print(f"[OK] Found user: {email} (ID: {user_id})")

        # Get user data from authenticated_users
        result = supabase.table('authenticated_users').select('*').eq('id', user_id).execute()

        if not result.data:
            print(f"[ERROR] No authenticated_users record found")
            return

        user_data = result.data[0]
        print(f"\n[INFO] Current Status:")
        print(f"   Account Tier: {user_data.get('account_tier')}")
        print(f"   Subscription Status: {user_data.get('subscription_status')}")
        print(f"   Subscription End Date: {user_data.get('subscription_end_date')}")
        print(f"   Stripe Subscription ID: {user_data.get('stripe_subscription_id')}")

        # Get subscription from Stripe
        stripe_sub_id = user_data.get('stripe_subscription_id')
        if not stripe_sub_id:
            print(f"\n[WARNING] No Stripe subscription ID found")
            return

        print(f"\n[INFO] Fetching subscription from Stripe...")
        subscription = stripe.Subscription.retrieve(stripe_sub_id)

        print(f"   Status: {subscription.status}")
        print(f"   Cancel at period end: {subscription.cancel_at_period_end}")
        print(f"   Current period end: {subscription.current_period_end}")

        if subscription.current_period_end:
            end_date = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)
            print(f"   End date: {end_date.strftime('%B %d, %Y')}")

            # Update database
            print(f"\n[INFO] Updating database...")
            supabase.table('authenticated_users').update({
                'subscription_end_date': end_date.isoformat()
            }).eq('id', user_id).execute()

            print(f"[SUCCESS] Updated subscription_end_date!")
        else:
            print(f"[WARNING] No current_period_end found in Stripe")

    except Exception as e:
        print(f"[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_subscription_end_date_simple.py <user-email>")
        sys.exit(1)

    email = sys.argv[1]
    print(f"Fixing subscription end date for {email}...")
    asyncio.run(fix_subscription_end_date(email))
