-- ============================================================================
-- UPDATE STRIPE PRICE IDs FOR $49.05/YEAR PRO YEARLY PLAN
-- ============================================================================
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/nhpsnvhvfscrmyniihdn/sql/new
--
-- This script updates both the pricing and Stripe Price IDs for:
-- - Pro Monthly: $5.45/month (price_1SNk0Q0CDBdO3EY30yDl3NMQ)
-- - Pro Yearly:  $49.05/year (price_1SNyJt0CDBdO3EY3KWhzm6er)
--
-- Created: October 30, 2025
-- ============================================================================

BEGIN;

-- Step 1: Update pricing to $49.05/year
UPDATE payment_tiers
SET
    price_yearly = 49.05,
    description = 'Save 25% with annual billing',
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Step 2: Update Stripe Price ID for Pro Yearly ($49.05/year)
UPDATE payment_tiers
SET
    stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er',
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Step 3: Ensure Pro Monthly has correct Price ID ($5.45/month)
UPDATE payment_tiers
SET
    stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ',
    updated_at = NOW()
WHERE id = 'pro_monthly';

-- Step 4: Verify the updates
SELECT
    id,
    name,
    price_monthly,
    price_yearly,
    stripe_price_id_monthly,
    stripe_price_id_yearly,
    description,
    is_active,
    updated_at
FROM payment_tiers
WHERE id IN ('pro_monthly', 'pro_yearly')
ORDER BY display_order;

COMMIT;

-- ============================================================================
-- VERIFICATION CHECKLIST
-- ============================================================================
-- After running this script, verify:
-- ✓ Pro Yearly price_yearly = 49.05
-- ✓ Pro Yearly stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er'
-- ✓ Pro Yearly description = 'Save 25% with annual billing'
-- ✓ Pro Monthly stripe_price_id_monthly = 'price_1SNk0Q0CDBdO3EY30yDl3NMQ'
-- ✓ Both tiers are is_active = true
--
-- Expected results:
-- - Pro Monthly: $5.45/month with Stripe ID price_1SNk0Q0CDBdO3EY30yDl3NMQ
-- - Pro Yearly:  $49.05/year with Stripe ID price_1SNyJt0CDBdO3EY3KWhzm6er
-- - Annual savings: $16.35 (25% discount)
-- ============================================================================
