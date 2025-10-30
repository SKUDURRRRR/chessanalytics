import requests

# Update via the production database connection
# The backend is already connected to the database

# We need to update the database directly. Let's use SQL via the backend
# Or we can just run SQL against the backend's database

import sys
sys.path.insert(0, 'python/core')

from python.core.unified_api_server import supabase

print("Updating pricing in the database...")

try:
    # Update Pro Monthly to $5.45
    result = supabase.table('payment_tiers').update({'price_monthly': 5.45}).eq('id', 'pro_monthly').execute()
    print(f"✓ Updated Pro Monthly to $5.45")

    # Update Pro Yearly to $49.50
    result = supabase.table('payment_tiers').update({'price_yearly': 49.50}).eq('id', 'pro_yearly').execute()
    print(f"✓ Updated Pro Yearly to $49.50")

    # Deactivate Enterprise
    result = supabase.table('payment_tiers').update({'is_active': False}).eq('id', 'enterprise').execute()
    print(f"✓ Deactivated Enterprise tier")

    print("\n✓ Done! Refresh http://localhost:3000/pricing to see the changes.")

except Exception as e:
    print(f"Error: {e}")
