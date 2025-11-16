-- Fix subscription_end_date for cancelled subscriptions
-- This query helps find users with cancelled subscriptions but missing end dates

-- Step 1: Find users with cancelled subscriptions but no end date
SELECT
    id,
    account_tier,
    subscription_status,
    subscription_end_date,
    stripe_customer_id,
    stripe_subscription_id
FROM authenticated_users
WHERE subscription_status = 'cancelled'
    AND subscription_end_date IS NULL;

-- Step 2: If you know the end date from Stripe, update it manually:
-- Replace 'USER_ID_HERE' with actual user ID
-- Replace '2025-11-30T00:00:00+00:00' with actual subscription end date from Stripe

-- UPDATE authenticated_users
-- SET subscription_end_date = '2025-11-30T00:00:00+00:00'
-- WHERE id = 'USER_ID_HERE';
