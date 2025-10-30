"""
Simple script to update Stripe Price IDs
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / 'python' / '.env')

# Get Supabase credentials
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] Could not load Supabase credentials")
    print("Please run these SQL commands in Supabase SQL Editor:")
    print("https://supabase.com/dashboard/project/eqeodgabrshqkxufvshf/sql/new")
    print()
    print("UPDATE payment_tiers SET stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ' WHERE id = 'pro_monthly';")
    print("UPDATE payment_tiers SET stripe_price_id_yearly = 'price_1SNk2o0CDBdO3EY3LDSUOkzK' WHERE id = 'pro_yearly';")
    exit(1)

try:
    from supabase import create_client

    print("[INFO] Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("[INFO] Updating Pro Monthly...")
    supabase.table('payment_tiers').update({
        'stripe_price_id_monthly': 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
    }).eq('id', 'pro_monthly').execute()

    print("[INFO] Updating Pro Yearly...")
    supabase.table('payment_tiers').update({
        'stripe_price_id_yearly': 'price_1SNk2o0CDBdO3EY3LDSUOkzK'
    }).eq('id', 'pro_yearly').execute()

    print("\n[SUCCESS] Price IDs updated!")
    print("[ACTION] Refresh your profile page (Ctrl+Shift+R) and try the upgrade button again.")

except Exception as e:
    print(f"\n[ERROR] {e}")
    print("\nPlease run these SQL commands manually in Supabase SQL Editor:")
    print("https://supabase.com/dashboard/project/eqeodgabrshqkxufvshf/sql/new")
    print()
    print("UPDATE payment_tiers SET stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ' WHERE id = 'pro_monthly';")
    print("UPDATE payment_tiers SET stripe_price_id_yearly = 'price_1SNk2o0CDBdO3EY3LDSUOkzK' WHERE id = 'pro_yearly';")
