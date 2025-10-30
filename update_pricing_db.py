#!/usr/bin/env python3
"""
Update pricing in the database
"""
import os
from supabase import create_client, Client

# Read credentials from environment variables
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Validate that both env vars are present
if not url:
    raise ValueError("SUPABASE_URL environment variable is required but not set")
if not key:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is required but not set")

supabase: Client = create_client(url, key)

try:
    # Update Pro Monthly price to $5.45
    result = supabase.table('payment_tiers').update({
        'price_monthly': 5.45,
    }).eq('id', 'pro_monthly').execute()
    print(f"✅ Updated Pro Monthly: {result.data}")

    # Update Pro Yearly price to $49.05
    result = supabase.table('payment_tiers').update({
        'price_yearly': 49.05,
        'description': 'Save 25% with annual billing'
    }).eq('id', 'pro_yearly').execute()
    print(f"✅ Updated Pro Yearly: {result.data}")

    # Deactivate Enterprise tier
    result = supabase.table('payment_tiers').update({
        'is_active': False
    }).eq('id', 'enterprise').execute()
    print(f"✅ Deactivated Enterprise: {result.data}")

    # Verify changes
    result = supabase.table('payment_tiers').select('id, name, price_monthly, price_yearly, is_active').order('display_order').execute()
    print("\n📋 Current payment tiers:")
    for tier in result.data:
        print(f"  - {tier['name']}: Monthly=${tier.get('price_monthly', 'N/A')}, Yearly=${tier.get('price_yearly', 'N/A')}, Active={tier['is_active']}")

except Exception as e:
    print(f"❌ Error: {e}")
