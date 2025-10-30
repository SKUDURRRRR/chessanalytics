#!/usr/bin/env python3
"""
Update pricing in the database
"""
import os
from supabase import create_client, Client

# Connect to local Supabase
url = "http://127.0.0.1:54321"
key = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"  # Service role key from supabase start output

supabase: Client = create_client(url, key)

try:
    # Update Pro Monthly price to $5.45
    result = supabase.table('payment_tiers').update({
        'price_monthly': 5.45,
    }).eq('id', 'pro_monthly').execute()
    print(f"✅ Updated Pro Monthly: {result.data}")

    # Update Pro Yearly price to $49.50
    result = supabase.table('payment_tiers').update({
        'price_yearly': 49.50,
        'description': 'Save 20% with annual billing'
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
