"""
Update Stripe Price IDs using the backend's Supabase connection
"""
import sys
import os

# Add python directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from core.config import ChessAnalysisConfig
from supabase import create_client

print("[INFO] Loading configuration...")
config = ChessAnalysisConfig()

print("[INFO] Connecting to Supabase...")
print(f"[INFO] Using Supabase URL: {config.database.url[:50]}...")

# Create Supabase client with service role key for admin operations
supabase = create_client(
    config.database.url,
    config.database.service_role_key or config.database.anon_key
)

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

    print("\n[SUCCESS] All done! Refresh your profile page and try the upgrade button.")

except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
    exit(1)
