"""
Simple script to update Stripe Price IDs
"""
import os
from dotenv import load_dotenv

# Load environment from .env in root directory
load_dotenv()


def get_project_sql_url(supabase_url: str | None = None) -> str:
    """
    Extract Supabase project ID from SUPABASE_URL and construct SQL editor URL.
    Falls back to generic placeholder if extraction fails.

    Format: https://<project-id>.supabase.co -> https://supabase.com/dashboard/project/<project-id>/sql/new

    Args:
        supabase_url: The Supabase URL (e.g., https://project-id.supabase.co)

    Returns:
        The Supabase SQL editor URL with project ID if extractable, otherwise generic placeholder
    """
    project_url = "https://supabase.com/dashboard/project/<YOUR_PROJECT_ID>/sql/new"
    if supabase_url:
        try:
            # Extract project ID from format: https://<project-id>.supabase.co
            project_id = supabase_url.split('//')[1].split('.')[0]
            project_url = f"https://supabase.com/dashboard/project/{project_id}/sql/new"
        except (IndexError, AttributeError):
            # Silently fall back to generic placeholder if extraction fails
            pass
    return project_url


# Get Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Get Stripe price IDs from environment variables
STRIPE_PRICE_ID_PRO_MONTHLY = os.getenv('STRIPE_PRICE_ID_PRO_MONTHLY')
STRIPE_PRICE_ID_PRO_YEARLY = os.getenv('STRIPE_PRICE_ID_PRO_YEARLY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Could not load Supabase credentials")
    print("Please run these SQL commands in Supabase SQL Editor:")
    project_url = get_project_sql_url(SUPABASE_URL)
    print(project_url)
    print()
    print(f"UPDATE payment_tiers SET stripe_price_id_monthly = '{STRIPE_PRICE_ID_PRO_MONTHLY or 'YOUR_MONTHLY_PRICE_ID'}' WHERE id = 'pro_monthly';")
    print(f"UPDATE payment_tiers SET stripe_price_id_yearly = '{STRIPE_PRICE_ID_PRO_YEARLY or 'YOUR_YEARLY_PRICE_ID'}' WHERE id = 'pro_yearly';")
    exit(1)

if not STRIPE_PRICE_ID_PRO_MONTHLY or not STRIPE_PRICE_ID_PRO_YEARLY:
    print("[ERROR] STRIPE_PRICE_ID_PRO_MONTHLY and STRIPE_PRICE_ID_PRO_YEARLY must be set in .env")
    print(f"  STRIPE_PRICE_ID_PRO_MONTHLY: {'SET' if STRIPE_PRICE_ID_PRO_MONTHLY else 'NOT SET'}")
    print(f"  STRIPE_PRICE_ID_PRO_YEARLY: {'SET' if STRIPE_PRICE_ID_PRO_YEARLY else 'NOT SET'}")
    exit(1)

try:
    from supabase import create_client

    print("[INFO] Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("[INFO] Updating Pro Monthly...")
    supabase.table('payment_tiers').update({
        'stripe_price_id_monthly': STRIPE_PRICE_ID_PRO_MONTHLY
    }).eq('id', 'pro_monthly').execute()

    print("[INFO] Updating Pro Yearly...")
    supabase.table('payment_tiers').update({
        'stripe_price_id_yearly': STRIPE_PRICE_ID_PRO_YEARLY
    }).eq('id', 'pro_yearly').execute()

    print("\n[SUCCESS] Price IDs updated!")
    print("[ACTION] Refresh your profile page (Ctrl+Shift+R) and try the upgrade button again.")

except Exception as e:
    print(f"\n[ERROR] {e}")
    print("\nPlease run these SQL commands manually in Supabase SQL Editor:")
    project_url = get_project_sql_url(SUPABASE_URL)
    print(project_url)
    print()
    print(f"UPDATE payment_tiers SET stripe_price_id_monthly = '{STRIPE_PRICE_ID_PRO_MONTHLY or 'YOUR_MONTHLY_PRICE_ID'}' WHERE id = 'pro_monthly';")
    print(f"UPDATE payment_tiers SET stripe_price_id_yearly = '{STRIPE_PRICE_ID_PRO_YEARLY or 'YOUR_YEARLY_PRICE_ID'}' WHERE id = 'pro_yearly';")
