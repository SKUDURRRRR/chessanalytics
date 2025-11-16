#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test if the Stripe Price ID is valid and accessible
"""
import os
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Load environment variables from .env.local files
def load_env_file(filepath):
    """Load environment variables from a file"""
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

# Try to load from .env.local files
for env_path in ['.env.local', 'python/.env.local', '.env']:
    if load_env_file(env_path):
        break

print("=" * 60)
print("Testing Stripe Configuration")
print("=" * 60)

# Get Stripe key
stripe_key = os.getenv('STRIPE_SECRET_KEY') or os.getenv('VITE_STRIPE_SECRET_KEY')

if not stripe_key:
    print("\n❌ ERROR: STRIPE_SECRET_KEY not found in environment")
    print("   Please set STRIPE_SECRET_KEY in your .env.local file")
    exit(1)

# Check if it's test or live mode
if stripe_key.startswith('sk_test_'):
    print("\n✓ Using Stripe TEST mode")
    mode = "test"
elif stripe_key.startswith('sk_live_'):
    print("\n⚠️  Using Stripe LIVE mode")
    mode = "live"
else:
    print("\n❌ ERROR: Invalid Stripe key format")
    exit(1)

try:
    import stripe
    stripe.api_key = stripe_key

    # Test the connection
    print("\n[1] Testing Stripe API connection...")
    try:
        stripe.Account.retrieve()
        print("✓ Stripe API connection successful")
    except stripe.error.AuthenticationError as e:
        print(f"❌ Authentication failed: {e}")
        exit(1)
    except Exception as e:
        print(f"❌ Error connecting to Stripe: {e}")
        exit(1)

    # Check the yearly price ID
    price_id = 'price_1SNyJt0CDBdO3EY3KWhzm6er'
    print(f"\n[2] Checking Price ID: {price_id}")

    try:
        price = stripe.Price.retrieve(price_id)
        print(f"✓ Price exists!")
        print(f"  Amount: ${price.unit_amount / 100:.2f} {price.currency.upper()}")
        print(f"  Recurring: {price.recurring['interval'] if price.recurring else 'One-time'}")
        print(f"  Active: {price.active}")
        print(f"  Product: {price.product}")

        if not price.active:
            print("\n⚠️  WARNING: This price is NOT ACTIVE in Stripe!")
            print("   Go to Stripe Dashboard and activate it")

        if price.unit_amount != 4905:  # $49.05 in cents
            print(f"\n⚠️  WARNING: Price amount is ${price.unit_amount / 100:.2f}, not $49.05!")
            print(f"   Expected: $49.05 (4905 cents)")
            print(f"   Got: ${price.unit_amount / 100:.2f} ({price.unit_amount} cents)")

        if not price.recurring or price.recurring['interval'] != 'year':
            print(f"\n⚠️  WARNING: This is not a yearly recurring price!")
            print(f"   Recurring: {price.recurring}")

        print("\n✅ Price ID is valid and ready to use!")

    except stripe.error.InvalidRequestError as e:
        print(f"❌ Price ID not found in Stripe!")
        print(f"   Error: {e}")
        print(f"\n   This price ID does not exist in your Stripe {mode} account.")
        print(f"   Please create it in Stripe Dashboard:")
        print(f"   https://dashboard.stripe.com/{'test/' if mode == 'test' else ''}products")
        exit(1)
    except Exception as e:
        print(f"❌ Error retrieving price: {e}")
        exit(1)

    # Check monthly price too
    monthly_price_id = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
    print(f"\n[3] Checking Monthly Price ID: {monthly_price_id}")

    try:
        price = stripe.Price.retrieve(monthly_price_id)
        print(f"✓ Monthly price exists!")
        print(f"  Amount: ${price.unit_amount / 100:.2f} {price.currency.upper()}")
        print(f"  Active: {price.active}")
    except stripe.error.InvalidRequestError:
        print(f"⚠️  Monthly price not found (this is OK if you only need yearly)")

    print("\n" + "=" * 60)
    print("✅ All checks passed!")
    print("=" * 60)
    print("\nIf you're still getting errors:")
    print("1. Restart your backend server")
    print("2. Check backend console for detailed error messages")
    print("3. Ensure you're using the correct Stripe keys (test vs live)")

except ImportError:
    print("\n❌ ERROR: 'stripe' package not installed")
    print("   Run: pip install stripe")
    exit(1)
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
