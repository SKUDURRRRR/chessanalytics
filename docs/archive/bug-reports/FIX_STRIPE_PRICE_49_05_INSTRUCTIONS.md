# Fix Stripe Price: Create $49.05/year Price

## Problem
- UI shows: **$49.05/year**
- Stripe shows: **$49.50/year**
- Current Price ID: `price_1SNyJt0CDBdO3EY3KWhzm6er` (configured for $49.50)

## Solution Steps

### Step 1: Create New Stripe Price for $49.05

1. **Go to Stripe Dashboard:**
   - Navigate to: https://dashboard.stripe.com/products

2. **Find or Create Product:**
   - If you already have a "Pro Yearly" or "Chess Analytics Pro Yearly" product:
     - Click on the existing product
     - Click "Add another price"
   - If not, click "Add product" and create a new one

3. **Configure the New Price:**
   - **Pricing model:** Standard pricing
   - **Price:** `49.05` USD
   - **Billing period:** Yearly (or "Custom" → 12 months)
   - **Payment type:** Recurring
   - Click "Add price" or "Save product"

4. **Copy the New Price ID:**
   - After creation, you'll see the new price ID
   - It will look like: `price_XXXXXXXXXXXXXXXXXXXXX`
   - **Copy this ID** - you'll need it for Step 2

### Step 2: Update Your Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Update Pro Yearly with the new Stripe Price ID for $49.05
UPDATE payment_tiers
SET
    stripe_price_id_yearly = 'YOUR_NEW_PRICE_ID_HERE',
    price_yearly = 49.05,
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Verify the update
SELECT
    id,
    name,
    price_yearly,
    stripe_price_id_yearly,
    updated_at
FROM payment_tiers
WHERE id = 'pro_yearly';
```

**Replace** `YOUR_NEW_PRICE_ID_HERE` with the actual Price ID you copied from Stripe.

### Step 3: Update Environment Variables (Optional)

If you're using environment variables for price IDs, update your `.env` file:

```bash
STRIPE_PRICE_ID_PRO_YEARLY=YOUR_NEW_PRICE_ID_HERE
```

### Step 4: Test the Payment Flow

1. **Refresh your pricing page**
2. Click "Upgrade Now" on Pro Yearly
3. **Verify Stripe checkout shows $49.05**
4. Use test card to complete: `4242 4242 4242 4242`
5. Verify subscription activates correctly

---

## Quick Reference

### Current Configuration (WRONG)
- Price ID: `price_1SNyJt0CDBdO3EY3KWhzm6er`
- Amount in Stripe: **$49.50**

### Target Configuration (CORRECT)
- Price ID: *NEW PRICE ID FROM STRIPE*
- Amount in Stripe: **$49.05**

---

## Alternative: Python Script to Update Database

If you prefer, you can use this Python script after creating the new Stripe price:

```python
# update_price_id_49_05.py
import os
from supabase import create_client

# Your new Stripe Price ID for $49.05
NEW_STRIPE_PRICE_ID = 'price_YOUR_NEW_ID_HERE'  # Replace with actual ID

supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_KEY')
)

# Update the database
result = supabase.table('payment_tiers').update({
    'stripe_price_id_yearly': NEW_STRIPE_PRICE_ID,
    'price_yearly': 49.05
}).eq('id', 'pro_yearly').execute()

print("✅ Updated Pro Yearly price ID to:", NEW_STRIPE_PRICE_ID)
print("✅ Updated price_yearly to: $49.05")

# Verify
tier = supabase.table('payment_tiers').select('*').eq('id', 'pro_yearly').execute()
print("\nCurrent configuration:")
print(f"  Price: ${tier.data[0]['price_yearly']}")
print(f"  Stripe ID: {tier.data[0]['stripe_price_id_yearly']}")
```

Run with:
```bash
python update_price_id_49_05.py
```

---

## Why This Happened

The Price ID `price_1SNyJt0CDBdO3EY3KWhzm6er` was originally created in Stripe with $49.50, but the UI was later updated to show $49.05 to provide exactly 25% savings:

- Monthly × 12 = $5.45 × 12 = **$65.40**
- Yearly with 25% off = $65.40 × 0.75 = **$49.05** ✅

The $49.50 price would only be ~24.3% savings, not exactly 25%.

---

## Need Help?

If you need to check what price is currently in your Stripe dashboard:
1. Go to https://dashboard.stripe.com/products
2. Find the "Pro Yearly" product
3. Look at the price amount for ID `price_1SNyJt0CDBdO3EY3KWhzm6er`
4. Confirm it shows $49.50 (or another amount)
