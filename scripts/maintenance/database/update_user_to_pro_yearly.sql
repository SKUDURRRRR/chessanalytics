-- Update User to Pro Yearly Subscription
-- This script updates a user's subscription to Pro Yearly based on email
-- Usage: Update the email in the WHERE clause and run this script

-- Update user to Pro Yearly
UPDATE authenticated_users
SET
    account_tier = 'pro',
    subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '1 year',
    updated_at = NOW()
WHERE id = (
    SELECT id
    FROM auth.users
    WHERE email = 'michael.sarthou@gmail.com'
);

-- Verify the update
SELECT
    au.id,
    u.email,
    au.account_tier,
    au.subscription_status,
    au.subscription_end_date,
    au.updated_at
FROM authenticated_users au
JOIN auth.users u ON u.id = au.id
WHERE u.email = 'michael.sarthou@gmail.com';
