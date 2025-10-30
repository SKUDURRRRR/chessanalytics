"""
Quick script to update Stripe price IDs in the payment_tiers table
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from python/.env
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / 'python' / '.env')

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in python/.env")
    print(f"  SUPABASE_URL: {'SET' if SUPABASE_URL else 'NOT SET'}")
    print(f"  SUPABASE_SERVICE_ROLE_KEY: {'SET' if SUPABASE_SERVICE_KEY else 'NOT SET'}")
    exit(1)

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("[INFO] Updating Stripe price IDs...")

try:
    # Update Pro Monthly
    result1 = supabase.table('payment_tiers').update({
        'stripe_price_id_monthly': 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
    }).eq('id', 'pro_monthly').execute()
    print("[OK] Updated Pro Monthly price ID")

    # Update Pro Yearly
    result2 = supabase.table('payment_tiers').update({
        'stripe_price_id_yearly': 'price_1SNk2o0CDBdO3EY3LDSUOkzK'
    }).eq('id', 'pro_yearly').execute()
    print("[OK] Updated Pro Yearly price ID")

    # Verify
    print("\n[INFO] Current payment tiers:")
    tiers = supabase.table('payment_tiers').select(
        'id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly'
    ).order('display_order').execute()

    for tier in tiers.data:
        print(f"\n{tier['name']} ({tier['id']}):")
        if tier.get('price_monthly'):
            print(f"  Monthly: ${tier['price_monthly']}")
        if tier.get('price_yearly'):
            print(f"  Yearly: ${tier['price_yearly']}")
        if tier.get('stripe_price_id_monthly'):
            print(f"  Stripe Monthly ID: {tier['stripe_price_id_monthly']}")
        if tier.get('stripe_price_id_yearly'):
            print(f"  Stripe Yearly ID: {tier['stripe_price_id_yearly']}")

    print("\n[SUCCESS] All done! Try the upgrade button now.")

except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
    exit(1)
