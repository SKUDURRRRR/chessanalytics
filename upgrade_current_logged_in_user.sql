-- Upgrade the CURRENTLY LOGGED IN user to pro_monthly
-- Run this in Supabase SQL Editor

-- Update the user who is currently logged in (2c002b04-2389-42b1-9d66-2f8d521861a9)
UPDATE authenticated_users
SET
    account_tier = 'pro_monthly',
    subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '1 month'
WHERE id = '2c002b04-2389-42b1-9d66-2f8d521861a9';

-- Verify the update
SELECT
    id,
    username,
    account_tier,
    subscription_status,
    stripe_customer_id
FROM authenticated_users
WHERE id = '2c002b04-2389-42b1-9d66-2f8d521861a9';

-- ALSO show which email paid (the other user)
SELECT
    au.id,
    au.username,
    au.account_tier,
    au.stripe_customer_id,
    u.email
FROM authenticated_users au
LEFT JOIN auth.users u ON au.id = u.id
WHERE au.id = '194590d4-8d56-44b2-872a-e3e514a7eed6';
