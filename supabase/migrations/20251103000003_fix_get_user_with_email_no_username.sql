-- Migration: Fix get_user_with_email function to handle missing username column
-- Date: 2025-11-03
-- Description: Updates the function to work even if username column doesn't exist
-- Uses dynamic SQL to check if username column exists before selecting it

-- ============================================================================
-- FUNCTION: Get user with email (updated to handle missing username)
-- ============================================================================

-- First, try to add username column if it doesn't exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'authenticated_users'
        AND column_name = 'username'
    ) THEN
        ALTER TABLE authenticated_users ADD COLUMN username TEXT;
        CREATE INDEX IF NOT EXISTS idx_authenticated_users_username ON authenticated_users(username);
    END IF;
END $$;

-- Now recreate the function (it will work whether username exists or not after the above)
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
        au.username,  -- Will be NULL if column was just added and has no data
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

COMMENT ON FUNCTION get_user_with_email IS 'Retrieves user info including email from auth.users. Username column is added if missing.';
