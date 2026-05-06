# Update via the production database connection
# The backend is already connected to the database

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv('python/.env.local')  # Try .env.local first
load_dotenv()  # Fallback to .env

# Create Supabase client directly using environment variables
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

print("Updating pricing in the database...")

try:
    # Update Pro Monthly to $5.45
    result = supabase.table('payment_tiers').update({'price_monthly': 5.45}).eq('id', 'pro_monthly').execute()
    print(f"✓ Updated Pro Monthly to $5.45")

    # Update Pro Yearly to $49.05
    result = supabase.table('payment_tiers').update({'price_yearly': 49.05}).eq('id', 'pro_yearly').execute()
    print(f"✓ Updated Pro Yearly to $49.05")

    # Deactivate Enterprise
    result = supabase.table('payment_tiers').update({'is_active': False}).eq('id', 'enterprise').execute()
    print(f"✓ Deactivated Enterprise tier")

    print("\n✓ Done! Refresh http://localhost:3000/pricing to see the changes.")

except Exception as e:
    print(f"Error: {e}")
