-- Migration: Create function to get user with email from auth.users
-- Date: 2025-10-30
-- Description: Creates a function to retrieve user info including email from auth.users

-- ============================================================================
-- FUNCTION: Get user with email
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_with_email(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    stripe_customer_id TEXT,
    account_tier TEXT,
    subscription_status TEXT,
    stripe_subscription_id TEXT,
    email TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        au.id,
        au.username,
        au.stripe_customer_id,
        au.account_tier,
        au.subscription_status,
        au.stripe_subscription_id,
        u.email
    FROM authenticated_users au
    JOIN auth.users u ON u.id = au.id
    WHERE au.id = p_user_id;
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION get_user_with_email(UUID) TO service_role;

COMMENT ON FUNCTION get_user_with_email IS 'Retrieves user info including email from auth.users for Stripe integration';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created function get_user_with_email that:
-- 1. Takes user_id as parameter
-- 2. Joins authenticated_users with auth.users to get email
-- 3. Returns all relevant user info including email
-- 4. Uses SECURITY DEFINER to allow service_role to access auth.users
-- ============================================================================
