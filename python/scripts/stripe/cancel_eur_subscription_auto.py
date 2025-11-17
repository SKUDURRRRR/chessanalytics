#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cancel EUR subscription (auto-confirm version)
"""
import os
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Load environment variables
def load_env_file(filepath):
    if not os.path.exists(filepath):
        return False
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                value = value.strip().strip('"').strip("'")
                os.environ[key.strip()] = value
    return True

# Load env
for env_path in ['.env.local', 'python/.env.local', '.env']:
    if load_env_file(env_path):
        break

print("=" * 70)
print("Cancel EUR Subscription to Enable USD Payments")
print("=" * 70)

try:
    import stripe

    # Initialize Stripe
    stripe_key = os.getenv('STRIPE_SECRET_KEY') or os.getenv('VITE_STRIPE_SECRET_KEY')
    if not stripe_key:
        print("\n❌ STRIPE_SECRET_KEY not found")
        exit(1)

    stripe.api_key = stripe_key

    # The EUR subscription ID from the error
    EUR_SUBSCRIPTION_ID = 'sub_1SNtmQ0CDBdO3EY39ZEbhDzJ'
    CUSTOMER_ID = 'cus_TKYsg05ae5sq5M'

    print(f"\nCustomer: {CUSTOMER_ID}")
    print(f"EUR Subscription: {EUR_SUBSCRIPTION_ID}")

    # Get subscription details
    print(f"\n[1] Checking subscription...")
    try:
        sub = stripe.Subscription.retrieve(EUR_SUBSCRIPTION_ID)
        print(f"  Status: {sub.status}")
        print(f"  Currency: {sub.currency.upper()}")

        if sub.status == 'active':
            print(f"\n  ⚠️  This is an ACTIVE EUR subscription")
            print(f"     It's blocking new USD subscriptions")

    except Exception as e:
        print(f"  ❌ Error retrieving subscription: {e}")
        exit(1)

    # Cancel the subscription
    print(f"\n[2] Cancelling EUR subscription...")
    print(f"    (This will allow USD subscriptions)")

    try:
        cancelled_sub = stripe.Subscription.delete(EUR_SUBSCRIPTION_ID)
        print(f"\n  ✅ Subscription cancelled!")
        print(f"     ID: {cancelled_sub.id}")
        print(f"     Status: {cancelled_sub.status}")

    except Exception as e:
        print(f"\n  ❌ Error cancelling subscription: {e}")
        exit(1)

    # Verify customer can now use USD
    print(f"\n[3] Verifying customer can now use USD...")
    try:
        subscriptions = stripe.Subscription.list(customer=CUSTOMER_ID, status='active')
        active_subs = subscriptions.data

        if not active_subs:
            print(f"  ✅ No active subscriptions - ready for USD!")
        else:
            print(f"  ⚠️  Still has {len(active_subs)} active subscription(s)")
            for sub in active_subs:
                print(f"     - {sub.id}: {sub.currency.upper()}")
    except Exception as e:
        print(f"  ⚠️  Could not verify: {e}")

    # Update database to reflect cancelled status
    print(f"\n[4] Updating database...")
    try:
        from supabase import create_client
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
                        os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'))
        supabase = create_client(supabase_url, supabase_key)

        # Find user with this Stripe customer ID
        result = supabase.table('authenticated_users').update({
            'account_tier': 'free',
            'subscription_status': 'cancelled',
            'stripe_subscription_id': None
        }).eq('stripe_customer_id', CUSTOMER_ID).execute()

        print(f"  ✅ Database updated - user downgraded to free tier")
    except Exception as e:
        print(f"  ⚠️  Could not update database: {e}")
        print(f"     You may need to manually update the user's tier")

    print(f"\n{'=' * 70}")
    print("✅ SUCCESS! EUR subscription cancelled")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Restart your backend server")
    print("2. Refresh your browser (Ctrl+Shift+R)")
    print("3. Try 'Upgrade Now' on Pro Yearly - should work with USD now!")
    print("\nThe customer can now subscribe to USD plans.")

except ImportError as ie:
    print(f"\n❌ Package not installed: {ie}")
    print("Run: pip install stripe supabase")
    exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
