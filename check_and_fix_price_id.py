#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick script to check and fix the Stripe Price ID in the database
"""
import os
import sys
from supabase import create_client

# Fix encoding for Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# The correct Stripe Price ID for $49.05/year
CORRECT_PRICE_ID = 'price_1SNyJt0CDBdO3EY3KWhzm6er'
CORRECT_PRICE = 49.05

print("=" * 60)
print("Checking Stripe Price ID Configuration")
print("=" * 60)

# Load environment variables from .env.local files
def load_env_file(filepath):
    """Load environment variables from a file"""
    if not os.path.exists(filepath):
        return False

    print(f"Loading environment from: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Remove quotes if present
                value = value.strip().strip('"').strip("'")
                os.environ[key.strip()] = value
    return True

# Try to load from .env.local in root and python directories
env_loaded = False
for env_path in ['.env.local', 'python/.env.local', '.env']:
    if load_env_file(env_path):
        env_loaded = True
        break

if not env_loaded:
    print("\n⚠️  No .env.local or .env file found")

# Initialize Supabase
# Try VITE_ prefixed variables first (from frontend .env.local), then backend ones
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
supabase_key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY') or
                os.getenv('SUPABASE_SERVICE_KEY'))

print(f"\nDebug: SUPABASE_URL = {supabase_url[:30] if supabase_url else 'NOT SET'}...")
print(f"Debug: SUPABASE_SERVICE_ROLE_KEY = {'SET' if supabase_key else 'NOT SET'}")

if not supabase_url or not supabase_key:
    print("\n❌ ERROR: Missing environment variables")
    print("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    print("   OR VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY")
    print("\n   Checked files: .env.local, python/.env.local, .env")
    print("\n   Available environment variables:")
    for key in sorted(os.environ.keys()):
        if 'SUPABASE' in key:
            print(f"      {key} = {os.environ[key][:30]}...")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

# Check current configuration
print("\n[1] Checking current database configuration...")
try:
    result = supabase.table('payment_tiers').select(
        'id, name, price_yearly, stripe_price_id_yearly, updated_at'
    ).eq('id', 'pro_yearly').execute()

    if not result.data:
        print("❌ ERROR: pro_yearly tier not found in database!")
        exit(1)

    tier = result.data[0]
    print(f"\nCurrent Pro Yearly configuration:")
    print(f"  Price: ${tier.get('price_yearly', 'NOT SET')}")
    print(f"  Stripe Price ID: {tier.get('stripe_price_id_yearly', 'NOT SET')}")
    print(f"  Last Updated: {tier.get('updated_at', 'UNKNOWN')}")

    # Check if it needs updating
    needs_update = False
    current_price_id = tier.get('stripe_price_id_yearly')

    # Normalize price for comparison (PostgreSQL numeric returns as Decimal, not float)
    current_price = tier.get('price_yearly')
    if current_price is not None:
        current_price = float(current_price)
    else:
        current_price = 0.0

    if current_price_id != CORRECT_PRICE_ID:
        print(f"\n⚠️  MISMATCH: Database has '{current_price_id}'")
        print(f"             Should be '{CORRECT_PRICE_ID}'")
        needs_update = True

    if current_price != CORRECT_PRICE:
        print(f"\n⚠️  MISMATCH: Database has ${current_price}")
        print(f"             Should be ${CORRECT_PRICE}")
        needs_update = True

    if not needs_update:
        print("\n✅ Database is already correctly configured!")
        print("   If you're still seeing the wrong price in Stripe checkout,")
        print("   the issue might be:")
        print("   1. Browser cache - try hard refresh (Ctrl+Shift+R)")
        print("   2. Backend server needs restart")
        print("   3. Old Stripe session - check Stripe Dashboard for the price")
        exit(0)

    # Update the database
    print("\n[2] Updating database with correct values...")
    update_result = supabase.table('payment_tiers').update({
        'stripe_price_id_yearly': CORRECT_PRICE_ID,
        'price_yearly': CORRECT_PRICE
    }).eq('id', 'pro_yearly').execute()

    print("✅ Database updated successfully!")

    # Verify the update
    print("\n[3] Verifying update...")
    verify_result = supabase.table('payment_tiers').select(
        'id, name, price_yearly, stripe_price_id_yearly, updated_at'
    ).eq('id', 'pro_yearly').execute()

    tier = verify_result.data[0]
    print(f"\nUpdated Pro Yearly configuration:")
    print(f"  Price: ${tier['price_yearly']}")
    print(f"  Stripe Price ID: {tier['stripe_price_id_yearly']}")
    print(f"  Last Updated: {tier['updated_at']}")

    # Normalize price for verification (PostgreSQL numeric returns as Decimal, not float)
    verify_price = tier.get('price_yearly')
    if verify_price is not None:
        verify_price = float(verify_price)
    else:
        verify_price = 0.0

    if tier['stripe_price_id_yearly'] == CORRECT_PRICE_ID and verify_price == CORRECT_PRICE:
        print("\n✅ SUCCESS! Database is now correctly configured.")
        print("\nNext steps:")
        print("  1. Restart your backend server if it's running")
        print("  2. Clear browser cache or hard refresh (Ctrl+Shift+R)")
        print("  3. Try the 'Upgrade Now' button again")
        print("  4. Verify Stripe checkout shows $49.05")
    else:
        print("\n⚠️  Update may not have worked correctly. Please check manually.")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
