#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Find and fix customer currency issues in Stripe
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
print("Diagnosing Stripe Customer Currency Issue")
print("=" * 70)

try:
    import stripe
    from supabase import create_client

    # Initialize Stripe
    stripe_key = os.getenv('STRIPE_SECRET_KEY') or os.getenv('VITE_STRIPE_SECRET_KEY')
    if not stripe_key:
        print("\n❌ STRIPE_SECRET_KEY not found")
        exit(1)

    stripe.api_key = stripe_key

    # Initialize Supabase
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
                    os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'))
    supabase = create_client(supabase_url, supabase_key)

    print("\n[1] Finding users with Stripe customer IDs...")
    result = supabase.table('authenticated_users').select(
        'id, username, stripe_customer_id, account_tier'
    ).not_.is_('stripe_customer_id', 'null').execute()

    if not result.data:
        print("No users with Stripe customer IDs found")
        exit(0)

    print(f"Found {len(result.data)} users with Stripe customer IDs")

    for user in result.data:
        customer_id = user.get('stripe_customer_id')
        if not customer_id:
            continue

        print(f"\n{'=' * 70}")
        print(f"User: {user.get('username', 'N/A')} ({user['id'][:8]}...)")
        print(f"Stripe Customer ID: {customer_id}")
        print(f"Current Tier: {user.get('account_tier', 'N/A')}")

        try:
            # Get customer from Stripe
            customer = stripe.Customer.retrieve(customer_id)
            print(f"Customer Email: {customer.email}")

            # Check for active subscriptions
            subscriptions = stripe.Subscription.list(customer=customer_id, status='all', limit=10)

            if subscriptions.data:
                print(f"\n  📋 Subscriptions ({len(subscriptions.data)}):")
                for sub in subscriptions.data:
                    print(f"\n    Subscription: {sub.id}")
                    print(f"      Status: {sub.status}")
                    print(f"      Currency: {sub.currency.upper()}")

                    if sub.items.data:
                        for item in sub.items.data:
                            price = item.price
                            print(f"      Price: {price.id}")
                            print(f"      Amount: {price.unit_amount / 100:.2f} {price.currency.upper()}")

                    # Check if it's EUR and active/trialing
                    if sub.currency.lower() == 'eur' and sub.status in ['active', 'trialing', 'past_due']:
                        print(f"\n      ⚠️  PROBLEM: Active EUR subscription!")
                        print(f"      This is blocking USD subscriptions.")
                        print(f"\n      To fix, cancel this subscription:")
                        print(f"      >>> Cancel in Stripe Dashboard or run fix below")

                        # Offer to cancel
                        response = input(f"\n      Cancel this EUR subscription? (yes/no): ").strip().lower()
                        if response == 'yes':
                            try:
                                stripe.Subscription.delete(sub.id)
                                print(f"      ✅ Cancelled subscription {sub.id}")
                            except Exception as e:
                                print(f"      ❌ Error cancelling: {e}")
            else:
                print(f"\n  No subscriptions found")

            # Check for other EUR items
            invoices = stripe.Invoice.list(customer=customer_id, limit=5)
            eur_invoices = [inv for inv in invoices.data if inv.currency.lower() == 'eur']
            if eur_invoices:
                print(f"\n  📄 EUR Invoices: {len(eur_invoices)}")
                for inv in eur_invoices[:3]:
                    print(f"    - {inv.id}: {inv.status} - {inv.total / 100:.2f} EUR")

        except stripe.error.InvalidRequestError as e:
            print(f"  ❌ Error retrieving customer: {e}")
        except Exception as e:
            print(f"  ❌ Unexpected error: {e}")

    print(f"\n{'=' * 70}")
    print("Summary:")
    print("If you found EUR subscriptions, you need to:")
    print("1. Cancel them in Stripe Dashboard, OR")
    print("2. Let them run and create a new test user for USD testing")
    print("=" * 70)

except ImportError:
    print("\n❌ Required packages not installed")
    print("Run: pip install stripe supabase")
    exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
