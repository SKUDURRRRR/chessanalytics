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
-- SUMMARY
-- ============================================================================
-- Updated account_tier CHECK constraint to accept 'pro_monthly' and 'pro_yearly'
-- Now webhooks and manual updates can use full tier names
--
-- To manually upgrade users, use the manual_upgrade_user.sql script
-- with proper placeholders instead of hardcoded IDs
-- ============================================================================
