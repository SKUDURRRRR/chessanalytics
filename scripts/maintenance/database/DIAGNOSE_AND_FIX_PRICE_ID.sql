-- ============================================================================
-- DIAGNOSE AND FIX STRIPE PRICE ID MISMATCH
-- ============================================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- This script will show you what's currently in your database and fix it
-- if needed.
-- ============================================================================

-- STEP 1: CHECK CURRENT CONFIGURATION
-- ============================================================================
SELECT
    '=== CURRENT CONFIGURATION ===' as info,
    id,
    name,
    price_yearly,
    stripe_price_id_yearly,
    TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM payment_tiers
WHERE id = 'pro_yearly';

-- Look at the output above.
-- If stripe_price_id_yearly is NOT 'price_1SNyJt0CDBdO3EY3KWhzm6er',
-- then that's your problem! Continue with STEP 2 below.
--
-- If stripe_price_id_yearly IS 'price_1SNyJt0CDBdO3EY3KWhzm6er',
-- then the database is correct and the issue is elsewhere (see bottom).

-- ============================================================================
-- STEP 2: FIX THE DATABASE (if needed)
-- ============================================================================
-- Uncomment the lines below (remove the --) if you need to update:

-- UPDATE payment_tiers
-- SET
--     stripe_price_id_yearly = 'price_1SNyJt0CDBdO3EY3KWhzm6er',
--     price_yearly = 49.05,
--     updated_at = NOW()
-- WHERE id = 'pro_yearly';

-- ============================================================================
-- STEP 3: VERIFY THE FIX
-- ============================================================================
-- After running the UPDATE, run this to verify:

-- SELECT
--     '=== AFTER UPDATE ===' as info,
--     id,
--     name,
--     price_yearly,
--     stripe_price_id_yearly,
--     TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_updated
-- FROM payment_tiers
-- WHERE id = 'pro_yearly';

-- ============================================================================
-- EXPECTED RESULT:
-- ============================================================================
-- id: pro_yearly
-- name: Pro Yearly
-- price_yearly: 49.05
-- stripe_price_id_yearly: price_1SNyJt0CDBdO3EY3KWhzm6er
-- last_updated: (current timestamp)
--
-- ============================================================================
-- IF DATABASE IS ALREADY CORRECT:
-- ============================================================================
-- If the query shows the correct Price ID but you're still seeing the wrong
-- price in Stripe checkout, the issue might be:
--
-- 1. BROWSER CACHE: Hard refresh your page (Ctrl+Shift+R or Cmd+Shift+R)
--
-- 2. BACKEND CACHE: Restart your backend server
--    - Stop the current server
--    - Run: python python/core/unified_api_server.py
--
-- 3. OLD STRIPE SESSION: Your browser might have an old checkout session
--    - Clear browser cookies for your site
--    - Try in an incognito/private window
--
-- 4. WRONG PRICE IN STRIPE: Verify in Stripe Dashboard that the price
--    ID 'price_1SNyJt0CDBdO3EY3KWhzm6er' is actually set to $49.05  # pragma: allowlist secret
--    Go to: https://dashboard.stripe.com/products
--    Find the product and check the price amount
--
-- ============================================================================
