# Both Issues Are Related - Quick Fix Guide

## Problem Summary

Both the **"Cancel Subscription"** and **"Upgrade to Yearly"** buttons are failing because of incomplete database setup after your manual upgrade to Pro Monthly.

### Issue 1: Cancel Subscription - Missing `stripe_subscription_id`
- **Error**: "400: No active subscription"
- **Cause**: Your user was manually upgraded in migration, but `stripe_subscription_id` was never set
- **Status**: ✅ **FIXED** - Updated `cancel_subscription()` to handle manually upgraded users

### Issue 2: Upgrade to Yearly - Missing Stripe Price IDs
- **Error**: "400: Stripe price not configured for tier pro_yearly"
- **Cause**: `payment_tiers` table is missing Stripe price IDs
- **Status**: ⚠️ **NEEDS ACTION** - Run SQL to add price IDs

## Quick Fix

### Step 1: Update Stripe Price IDs in Database

Go to your Supabase SQL Editor and run this:
```
https://supabase.com/dashboard/project/eqeodgabrshqkxufvshf/sql/new
```

Copy and paste this SQL:

```sql
-- Update Pro Monthly with Stripe price ID
UPDATE payment_tiers
SET stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
WHERE id = 'pro_monthly';

-- Update Pro Yearly with Stripe price ID
UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er'
WHERE id = 'pro_yearly';

-- Verify the updates
SELECT
    id,
    name,
    stripe_price_id_monthly,
    stripe_price_id_yearly
FROM payment_tiers
ORDER BY display_order;
```

### Step 2: Test Both Buttons

After running the SQL:

1. **Refresh your profile page** (hard refresh: Ctrl+Shift+R)
2. **Test "Upgrade to Yearly Pro"** button - should now redirect to Stripe checkout
3. **Test "Cancel Subscription"** button - should now work (will downgrade you to free since you were manually upgraded)

## Why Both Buttons Failed

### The Root Cause
When you were manually upgraded to Pro Monthly via the migration SQL (in `20251030000005_fix_account_tier_constraint.sql`), only the `account_tier` was set:

```sql
UPDATE authenticated_users
SET
    account_tier = 'pro_monthly',
    subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '1 month'
WHERE id = '<redacted>';
```

But this didn't set:
- ❌ `stripe_subscription_id` (needed for cancellation)
- ❌ Stripe price IDs in `payment_tiers` (needed for checkout)

### The Fixes

#### Cancel Subscription (Already Fixed in Code)
Updated `stripe_service.py` to handle three scenarios:
1. Has subscription ID → Cancel normally at period end
2. Has customer ID but no subscription ID → Try to find subscription from Stripe
3. No subscription ID found → Immediately downgrade to free tier

#### Upgrade to Yearly (Needs SQL Update)
The `payment_tiers` table needs the Stripe price IDs so checkout can create proper sessions.

## Expected Behavior After Fix

### Cancel Subscription Button
- For manually upgraded users (you): **Immediately downgrades to free tier**
- For real Stripe subscribers: **Cancels at end of billing period**

### Upgrade to Yearly Button
- Creates Stripe checkout session
- Redirects to Stripe payment page
- After payment, updates subscription to Pro Yearly

## Files Modified

1. **python/core/stripe_service.py**
   - Updated `cancel_subscription()` to handle missing subscription IDs

2. **fix_stripe_price_ids.sql** (Created)
   - SQL script to update payment_tiers with Stripe price IDs

## Next Steps

1. ✅ **Run the SQL above** in Supabase SQL Editor
2. ✅ **Refresh your profile page**
3. ✅ **Test both buttons**
4. ✅ **Let me know if you want to stay Pro Monthly or test the upgrade flow**

## Note About Your Current Subscription

Since you were manually upgraded (not through Stripe), you don't actually have a real Stripe subscription. This means:

- **Cancel button** will immediately downgrade you to free (not at period end)
- **Upgrade button** will create a NEW real Stripe subscription

If you want to keep Pro access for testing, I recommend:
1. Use the "Upgrade to Yearly" button to create a real Stripe subscription
2. Use test card: `4242 4242 4242 4242`
3. This will give you a real Pro Yearly subscription you can actually cancel later

Let me know what you'd like to do!
