#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update both Pro Monthly and Pro Yearly to USD prices
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

from supabase import create_client

# New USD Price IDs
MONTHLY_USD_PRICE_ID = 'price_1SO0bC0CDBdO3EY3X35lCZRH'  # New $5.45 USD
YEARLY_USD_PRICE_ID = 'price_1SNyJt0CDBdO3EY3KWhzm6er'   # $49.05 USD

print("=" * 70)
print("Updating Stripe Price IDs to USD")
print("=" * 70)

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
supabase_key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY'))

supabase = create_client(supabase_url, supabase_key)

print(f"\n[1] Checking current configuration...")
try:
    result = supabase.table('payment_tiers').select(
        'id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly'
    ).in_('id', ['pro_monthly', 'pro_yearly']).execute()

    print("\nCurrent configuration:")
    for tier in result.data:
        print(f"\n  {tier['name']} ({tier['id']}):")
        if tier.get('price_monthly'):
            print(f"    Monthly Price: ${tier['price_monthly']}")
            print(f"    Monthly Stripe ID: {tier.get('stripe_price_id_monthly')}")
        if tier.get('price_yearly'):
            print(f"    Yearly Price: ${tier['price_yearly']}")
            print(f"    Yearly Stripe ID: {tier.get('stripe_price_id_yearly')}")

    print(f"\n[2] Updating Pro Monthly to USD price...")
    result1 = supabase.table('payment_tiers').update({
        'stripe_price_id_monthly': MONTHLY_USD_PRICE_ID,
        'price_monthly': 5.45
    }).eq('id', 'pro_monthly').execute()
    print("✅ Updated Pro Monthly")

    print(f"\n[3] Updating Pro Yearly to USD price...")
    result2 = supabase.table('payment_tiers').update({
        'stripe_price_id_yearly': YEARLY_USD_PRICE_ID,
        'price_yearly': 49.05
    }).eq('id', 'pro_yearly').execute()
    print("✅ Updated Pro Yearly")

    print(f"\n[4] Verifying updates...")
    result = supabase.table('payment_tiers').select(
        'id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly'
    ).in_('id', ['pro_monthly', 'pro_yearly']).execute()

    print("\n✅ NEW configuration (All USD):")
    for tier in result.data:
        print(f"\n  {tier['name']} ({tier['id']}):")
        if tier.get('price_monthly'):
            print(f"    Monthly Price: ${tier['price_monthly']}")
            print(f"    Monthly Stripe ID: {tier.get('stripe_price_id_monthly')}")
        if tier.get('price_yearly'):
            print(f"    Yearly Price: ${tier['price_yearly']}")
            print(f"    Yearly Stripe ID: {tier.get('stripe_price_id_yearly')}")

    # Verify with Stripe
    print(f"\n[5] Verifying prices in Stripe...")
    try:
        import stripe
        stripe_key = os.getenv('STRIPE_SECRET_KEY') or os.getenv('VITE_STRIPE_SECRET_KEY')
        if stripe_key:
            stripe.api_key = stripe_key

            print("\n  Pro Monthly:")
            price = stripe.Price.retrieve(MONTHLY_USD_PRICE_ID)
            print(f"    Amount: ${price.unit_amount / 100:.2f}")
            print(f"    Currency: {price.currency.upper()}")
            print(f"    Active: {price.active}")

            if price.currency.lower() != 'usd':
                print(f"    ⚠️  WARNING: Currency is {price.currency.upper()}, not USD!")

            print("\n  Pro Yearly:")
            price = stripe.Price.retrieve(YEARLY_USD_PRICE_ID)
            print(f"    Amount: ${price.unit_amount / 100:.2f}")
            print(f"    Currency: {price.currency.upper()}")
            print(f"    Active: {price.active}")

            if price.currency.lower() != 'usd':
                print(f"    ⚠️  WARNING: Currency is {price.currency.upper()}, not USD!")

            print("\n✅ All prices verified in Stripe!")
        else:
            print("  ⚠️  Skipping Stripe verification (no API key)")
    except Exception as e:
        print(f"  ⚠️  Could not verify with Stripe: {e}")

    print("\n" + "=" * 70)
    print("✅ SUCCESS! All prices updated to USD")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Restart your backend server")
    print("2. Hard refresh your browser (Ctrl+Shift+R)")
    print("3. Try clicking 'Upgrade Now' again")
    print("4. Both monthly and yearly should now work in USD!")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
