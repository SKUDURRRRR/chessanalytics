#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick test to see what the backend sees in the database
"""
import os
import sys
import asyncio

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

from supabase import create_client

print("=" * 70)
print("Testing Backend Database Query (Simulating create_checkout_session)")
print("=" * 70)

# Initialize Supabase like the backend does
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
supabase_key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'))

print(f"\nSupabase URL: {supabase_url}")
print(f"Service Key: {'SET' if supabase_key else 'NOT SET'}")

supabase = create_client(supabase_url, supabase_key)

print("\n[1] Querying payment_tiers for pro_yearly (exactly like backend does)...")
print("-" * 70)

# This is the EXACT query that stripe_service.py makes
tier_id = 'pro_yearly'
try:
    result = supabase.table('payment_tiers').select(
        'stripe_price_id_monthly, stripe_price_id_yearly, name'
    ).eq('id', tier_id).execute()

    if not result.data:
        print(f"❌ ERROR: No data returned for tier_id '{tier_id}'")
        print("   This means the backend can't find the pro_yearly tier!")
        exit(1)

    tier = result.data[0]
    print(f"✓ Found tier: {tier.get('name')}")
    print(f"\nData returned from database:")
    print(f"  name: {tier.get('name')}")
    print(f"  stripe_price_id_monthly: {tier.get('stripe_price_id_monthly')}")
    print(f"  stripe_price_id_yearly: {tier.get('stripe_price_id_yearly')}")

    # Now simulate what the backend does for yearly
    if 'yearly' in tier_id.lower():
        price_id = tier.get('stripe_price_id_yearly')
        subscription_type = 'yearly'
    else:
        price_id = tier.get('stripe_price_id_monthly')
        subscription_type = 'monthly'

    print(f"\n[2] Backend logic would use:")
    print(f"  subscription_type: {subscription_type}")
    print(f"  price_id: {price_id}")

    if not price_id:
        print(f"\n❌ ERROR: Price ID is None or empty!")
        print(f"   The backend would return error: 'Stripe price not configured for tier {tier_id}'")
        exit(1)

    print(f"\n✅ Price ID is set correctly: {price_id}")

    # Now test if Stripe can use this price
    print(f"\n[3] Testing if Stripe accepts this price ID...")
    try:
        import stripe
        stripe_key = os.getenv('STRIPE_SECRET_KEY') or os.getenv('VITE_STRIPE_SECRET_KEY')
        if not stripe_key:
            print("⚠️  STRIPE_SECRET_KEY not set, skipping Stripe test")
        else:
            stripe.api_key = stripe_key
            price = stripe.Price.retrieve(price_id)
            print(f"✓ Stripe Price is valid!")
            print(f"  Amount: ${price.unit_amount / 100:.2f}")
            print(f"  Active: {price.active}")
    except Exception as e:
        print(f"❌ Stripe error: {e}")
        exit(1)

    print("\n" + "=" * 70)
    print("✅ ALL CHECKS PASSED!")
    print("=" * 70)
    print("\nThe database is correctly configured.")
    print("If you're still getting errors, the issue might be:")
    print("1. Backend is using a different .env file")
    print("2. Backend Supabase client is cached")
    print("3. Check backend console for actual error messages")

except Exception as e:
    print(f"\n❌ ERROR querying database: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
