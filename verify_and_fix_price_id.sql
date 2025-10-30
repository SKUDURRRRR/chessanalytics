-- ============================================================================
-- VERIFY AND FIX STRIPE PRICE ID FOR PRO YEARLY
-- ============================================================================
-- The correct Stripe Price ID for $49.05/year is: price_1SNyJt0CDBdO3EY3KWhzm6er
-- This script checks what's currently in the database and updates it if needed
-- ============================================================================

-- Step 1: Check what's currently stored in the database
SELECT
    id,
    name,
    price_yearly,
    stripe_price_id_yearly,
    updated_at
FROM payment_tiers
WHERE id = 'pro_yearly';

-- If the stripe_price_id_yearly is NOT 'price_1SNyJt0CDBdO3EY3KWhzm6er',
-- run the update below:

-- Step 2: Update to the correct Price ID
UPDATE payment_tiers
SET
    stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er',
    price_yearly = 49.05,
    updated_at = NOW()
WHERE id = 'pro_yearly';

-- Step 3: Verify the update
SELECT
    id,
    name,
    price_yearly,
    stripe_price_id_yearly,
    updated_at
FROM payment_tiers
WHERE id = 'pro_yearly';

-- Expected result after update:
-- id: pro_yearly
-- name: Pro Yearly
-- price_yearly: 49.05
-- stripe_price_id_yearly: price_1SNyJt0CDBdO3EY3KWhzm6er
-- updated_at: (current timestamp)
