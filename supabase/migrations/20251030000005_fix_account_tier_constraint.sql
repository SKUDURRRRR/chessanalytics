-- Migration: Update account_tier constraint to accept pro_monthly and pro_yearly
-- Date: 2025-10-30
-- Description: Allows authenticated_users.account_tier to store 'pro_monthly' and 'pro_yearly'

-- ============================================================================
-- UPDATE CHECK CONSTRAINT
-- ============================================================================

-- Drop the old constraint
ALTER TABLE authenticated_users
DROP CONSTRAINT IF EXISTS authenticated_users_account_tier_check;

-- Add new constraint with pro_monthly and pro_yearly
ALTER TABLE authenticated_users
ADD CONSTRAINT authenticated_users_account_tier_check
CHECK (account_tier IN ('free', 'pro', 'pro_monthly', 'pro_yearly', 'enterprise'));

-- ============================================================================
-- MANUALLY UPGRADE USER TO PRO_MONTHLY
-- ============================================================================

-- Upgrade the user who just paid to pro_monthly
UPDATE authenticated_users
SET
    account_tier = 'pro_monthly',
    subscription_status = 'active',
    subscription_end_date = NOW() + INTERVAL '1 month'
WHERE id = '194590d4-8d56-44b2-872a-e3e514a7eed6';

-- Verify the update
SELECT
    id,
    account_tier,
    subscription_status,
    stripe_customer_id,
    stripe_subscription_id
FROM authenticated_users
WHERE id = '194590d4-8d56-44b2-872a-e3e514a7eed6';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 1. Updated account_tier CHECK constraint to accept 'pro_monthly' and 'pro_yearly'
-- 2. Upgraded current user to pro_monthly tier
-- 3. Now webhooks and manual updates can use full tier names
-- ============================================================================
