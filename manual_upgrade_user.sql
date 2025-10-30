-- ============================================================================
-- WARNING: SET THE USER EMAIL PARAMETER BEFORE RUNNING THIS SCRIPT
-- ============================================================================
-- This script upgrades a user to Pro tier manually.
--
-- REQUIRED: Replace :user_email with the actual user's email address
-- throughout this entire script before executing any queries.
--
-- Example: Change :user_email to 'actual.user@example.com'
--
-- Run this in your Supabase SQL editor or psql
-- ============================================================================

-- First, let's find the user
SELECT
    au.id,
    au.account_tier,
    au.subscription_status,
    au.stripe_customer_id,
    u.email
FROM authenticated_users au
JOIN auth.users u ON u.id = au.id
WHERE u.email = :user_email;

-- If user is found, update their tier to pro_monthly
-- UNCOMMENT the lines below after verifying the user exists:

-- UPDATE authenticated_users
-- SET
--     account_tier = 'pro_monthly',
--     subscription_status = 'active',
--     subscription_end_date = NOW() + INTERVAL '1 month'
-- WHERE id = (
--     SELECT au.id
--     FROM authenticated_users au
--     JOIN auth.users u ON u.id = au.id
--     WHERE u.email = :user_email
-- );

-- Verify the update
-- SELECT
--     au.id,
--     au.account_tier,
--     au.subscription_status,
--     au.subscription_end_date,
--     u.email
-- FROM authenticated_users au
-- JOIN auth.users u ON u.id = au.id
-- WHERE u.email = :user_email;
