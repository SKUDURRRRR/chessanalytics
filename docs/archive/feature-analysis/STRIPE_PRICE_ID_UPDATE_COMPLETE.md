# Stripe Price ID Update Complete - Pro Yearly $49.05

## Overview
Updated all references to the new Stripe Price ID for Pro Yearly ($49.05/year) plan.

## New Stripe Price IDs

### Pro Monthly
- **Price:** $5.45/month
- **Stripe Price ID:** `price_1SNk0Q0CDBdO3EY30yDl3NMQ`

### Pro Yearly ✨ NEW
- **Price:** $49.05/year
- **Stripe Price ID:** `price_1SNyJt0CDBdO3EY3KWhzm6er`
- **Monthly Equivalent:** $4.09/month
- **Savings:** $16.35/year (25% discount)

## Files Updated

### 1. Environment Configuration
- ✅ **env.example** - Updated STRIPE_PRICE_ID_PRO_YEARLY to new ID

### 2. SQL Scripts (Ready to Run)
- ✅ **fix_stripe_price_ids.sql** - Updated with new Price ID
- ✅ **update_stripe_price_ids.sql** - Updated with new Price ID
- ✅ **UPDATE_STRIPE_PRICE_ID_49_05.sql** - NEW comprehensive script

### 3. Documentation
- ✅ **STRIPE_PRICE_IDS_FIX.md** - Updated example
- ✅ **docs/BOTH_BUTTONS_FIX_GUIDE.md** - Updated SQL example

## Quick Start - Apply to Database

### Option 1: Use the Comprehensive Script
Run the new `UPDATE_STRIPE_PRICE_ID_49_05.sql` in your Supabase SQL Editor. This script:
- Updates the price to $49.05
- Updates the Stripe Price ID
- Updates the description
- Verifies all changes

### Option 2: Use Individual Scripts
```sql
-- Just update the Stripe Price IDs
-- Run fix_stripe_price_ids.sql or update_stripe_price_ids.sql
```

### Option 3: Manual SQL Query
```sql
-- Update Pro Yearly Stripe Price ID
UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er'
WHERE id = 'pro_yearly';

-- Verify
SELECT id, name, price_yearly, stripe_price_id_yearly
FROM payment_tiers
WHERE id = 'pro_yearly';
```

## Environment Variables Setup

### Backend (.env or Railway/Render)
```bash
# Stripe Price IDs
STRIPE_PRICE_ID_PRO_MONTHLY=price_1SNk0Q0CDBdO3EY30yDl3NMQ
STRIPE_PRICE_ID_PRO_YEARLY=price_1SNyJt0CDBdO3EY3KWhzm6er
```

### Important Notes
1. **Database First:** Update the database with the SQL script
2. **Environment Variables:** Update your environment variables if using them
3. **Stripe Dashboard:** Ensure the Price ID exists in your Stripe account at $49.05/year
4. **Test Mode:** Make sure you're using the correct Price ID for test vs production

## Verification Steps

### 1. Database Verification
```sql
SELECT
    id,
    name,
    price_yearly,
    stripe_price_id_yearly,
    description
FROM payment_tiers
WHERE id = 'pro_yearly';
```

Expected result:
```
id: pro_yearly
name: Pro Yearly
price_yearly: 49.05
stripe_price_id_yearly: price_1SNyJt0CDBdO3EY3KWhzm6er
description: Save 25% with annual billing
```

### 2. Frontend Verification
1. Go to `/pricing` page
2. Verify Pro Yearly shows **$49.05/year**
3. Verify savings shows **$16.35/year**
4. Click "Upgrade Now" and verify Stripe checkout shows correct price

### 3. Stripe Dashboard Verification
1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Find the product with Price ID `price_1SNyJt0CDBdO3EY3KWhzm6er`
3. Verify it shows:
   - Amount: **$49.05**
   - Billing: **Yearly**
   - Status: **Active**

## Testing Checklist

- [ ] SQL script runs without errors
- [ ] Database shows correct price ($49.05)
- [ ] Database shows correct Stripe Price ID
- [ ] Frontend pricing page displays $49.05
- [ ] Frontend calculates 25% savings correctly
- [ ] Stripe checkout redirects successfully
- [ ] Stripe checkout shows $49.05/year
- [ ] Test subscription creation completes
- [ ] Webhook processes subscription correctly

## Rollback Plan

If you need to revert to the old Price ID:

```sql
UPDATE payment_tiers
SET stripe_price_id_yearly = 'price_1SNk2o0CDBdO3EY3LDSUOkzK'
WHERE id = 'pro_yearly';
```

Note: Only rollback if the old Price ID is still active in Stripe.

## What's Next?

1. ✅ Pricing updated to $49.05
2. ✅ All code references updated
3. ✅ SQL scripts ready to run
4. ⏳ Run the SQL script in Supabase
5. ⏳ Update production environment variables (if used)
6. ⏳ Test the checkout flow
7. ⏳ Monitor for any webhook errors

## Support

If you encounter issues:
1. Check Stripe Dashboard logs
2. Check Supabase logs
3. Verify the Price ID exists and is active
4. Ensure webhook is configured correctly
5. Test with Stripe test cards first

---

**Last Updated:** October 30, 2025
**Status:** Ready to Deploy
**Price ID:** `price_1SNyJt0CDBdO3EY3KWhzm6er`
