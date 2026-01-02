"""
Quick script to update Stripe price IDs in the payment_tiers table
"""
import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from .env in root directory
load_dotenv()

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Get Stripe price IDs from environment variables
STRIPE_PRICE_ID_PRO_MONTHLY = os.getenv('STRIPE_PRICE_ID_PRO_MONTHLY')
STRIPE_PRICE_ID_PRO_YEARLY = os.getenv('STRIPE_PRICE_ID_PRO_YEARLY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    print(f"  SUPABASE_URL: {'SET' if SUPABASE_URL else 'NOT SET'}")
    print(f"  SUPABASE_SERVICE_ROLE_KEY: {'SET' if SUPABASE_SERVICE_KEY else 'NOT SET'}")
    exit(1)

if not STRIPE_PRICE_ID_PRO_MONTHLY or not STRIPE_PRICE_ID_PRO_YEARLY:
    print("[ERROR] STRIPE_PRICE_ID_PRO_MONTHLY and STRIPE_PRICE_ID_PRO_YEARLY must be set in .env")
    print(f"  STRIPE_PRICE_ID_PRO_MONTHLY: {'SET' if STRIPE_PRICE_ID_PRO_MONTHLY else 'NOT SET'}")
    print(f"  STRIPE_PRICE_ID_PRO_YEARLY: {'SET' if STRIPE_PRICE_ID_PRO_YEARLY else 'NOT SET'}")
    exit(1)

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("[INFO] Updating Stripe price IDs...")

try:
    # Update Pro Monthly
    result1 = supabase.table('payment_tiers').update({
        'stripe_price_id_monthly': STRIPE_PRICE_ID_PRO_MONTHLY
    }).eq('id', 'pro_monthly').execute()
    print("[OK] Updated Pro Monthly price ID")

    # Update Pro Yearly
    result2 = supabase.table('payment_tiers').update({
        'stripe_price_id_yearly': STRIPE_PRICE_ID_PRO_YEARLY
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
