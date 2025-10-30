-- Migration: Fix authenticated_users schema and add missing fields
-- Date: 2025-10-30
-- Description: Adds username field, improves constraints, and fixes data consistency

-- ============================================================================
-- 1. ADD MISSING USERNAME COLUMN
-- ============================================================================

-- Add username column if it doesn't exist
ALTER TABLE authenticated_users
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_authenticated_users_username ON authenticated_users(username);

COMMENT ON COLUMN authenticated_users.username IS 'User''s display name or username';

-- ============================================================================
-- 2. IMPROVE SUBSCRIPTION_STATUS CONSTRAINT
-- ============================================================================

-- Drop and recreate subscription_status constraint with better validation
ALTER TABLE authenticated_users
DROP CONSTRAINT IF EXISTS authenticated_users_subscription_status_check;

ALTER TABLE authenticated_users
ADD CONSTRAINT authenticated_users_subscription_status_check
CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trialing', 'past_due', 'incomplete'));

-- ============================================================================
-- 3. ADD DATA CONSISTENCY CONSTRAINTS
-- ============================================================================

-- If subscription_status is 'active', stripe_subscription_id should be present (unless free tier)
-- This is a soft check - we'll log warnings but not enforce strictly
COMMENT ON COLUMN authenticated_users.stripe_subscription_id IS 'Stripe subscription ID - should be present for active paid subscriptions';

-- Add constraint: stripe_customer_id should be present if user has any paid subscription
COMMENT ON COLUMN authenticated_users.stripe_customer_id IS 'Stripe customer ID - created on first payment attempt';

-- ============================================================================
-- 4. ADD HELPER FUNCTION TO VALIDATE SUBSCRIPTION DATA
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_subscription_data()
RETURNS TRIGGER AS $$
BEGIN
    -- If account_tier is paid but no stripe_customer_id, log warning
    IF NEW.account_tier IN ('pro_monthly', 'pro_yearly', 'pro', 'enterprise') THEN
        IF NEW.stripe_customer_id IS NULL THEN
            RAISE WARNING 'User % has paid tier % but no stripe_customer_id', NEW.id, NEW.account_tier;
        END IF;

        -- If subscription is active, should have subscription_id (unless enterprise custom)
        IF NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NULL AND NEW.account_tier != 'enterprise' THEN
            RAISE WARNING 'User % has active subscription but no stripe_subscription_id', NEW.id;
        END IF;
    END IF;

    -- If subscription is cancelled or expired, don't require subscription_id
    -- (webhooks might clear it or it might have been deleted)

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for validation
DROP TRIGGER IF EXISTS validate_subscription_data_trigger ON authenticated_users;

CREATE TRIGGER validate_subscription_data_trigger
    BEFORE INSERT OR UPDATE ON authenticated_users
    FOR EACH ROW
    EXECUTE FUNCTION validate_subscription_data();

-- ============================================================================
-- 5. ADD FUNCTION TO CHECK USER TIER PERMISSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_has_tier(
    p_user_id UUID,
    p_required_tier TEXT DEFAULT 'free'
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_tier TEXT;
    v_subscription_status TEXT;
BEGIN
    -- Get user's current tier and subscription status
    SELECT account_tier, subscription_status
    INTO v_user_tier, v_subscription_status
    FROM authenticated_users
    WHERE id = p_user_id;

    -- User doesn't exist
    IF v_user_tier IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check subscription is active (for paid tiers)
    IF v_user_tier IN ('pro_monthly', 'pro_yearly', 'pro', 'enterprise') THEN
        IF v_subscription_status NOT IN ('active', 'trialing') THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Tier hierarchy check
    IF p_required_tier = 'free' THEN
        RETURN TRUE; -- Everyone has at least free tier
    ELSIF p_required_tier IN ('pro', 'pro_monthly', 'pro_yearly') THEN
        -- Any pro tier qualifies
        RETURN v_user_tier IN ('pro', 'pro_monthly', 'pro_yearly', 'enterprise');
    ELSIF p_required_tier = 'enterprise' THEN
        RETURN v_user_tier = 'enterprise';
    END IF;

    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_has_tier(UUID, TEXT) TO service_role, authenticated;

COMMENT ON FUNCTION public.check_user_has_tier IS 'Checks if user has required tier with active subscription';

-- ============================================================================
-- 6. FIX get_user_with_email FUNCTION
-- ============================================================================

-- Recreate the function to handle the username field properly
CREATE OR REPLACE FUNCTION get_user_with_email(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    stripe_customer_id TEXT,
    account_tier TEXT,
    subscription_status TEXT,
    stripe_subscription_id TEXT,
    subscription_end_date TIMESTAMPTZ,
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
        au.subscription_end_date,
        u.email
    FROM authenticated_users au
    JOIN auth.users u ON u.id = au.id
    WHERE au.id = p_user_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_with_email(UUID) TO service_role;

COMMENT ON FUNCTION get_user_with_email IS 'Retrieves user info including email from auth.users for Stripe integration';

-- ============================================================================
-- 7. ADD FUNCTION TO CLEANUP EXPIRED SUBSCRIPTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    -- Update users with past subscription_end_date to 'expired'
    UPDATE authenticated_users
    SET
        subscription_status = 'expired',
        account_tier = 'free'
    WHERE
        subscription_end_date < NOW()
        AND subscription_status IN ('active', 'cancelled')
        AND account_tier IN ('pro_monthly', 'pro_yearly', 'pro');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RAISE NOTICE 'Updated % expired subscriptions to free tier', v_updated_count;

    RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_subscriptions() TO service_role;

COMMENT ON FUNCTION public.cleanup_expired_subscriptions IS 'Marks expired subscriptions as expired and downgrades to free tier';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 1. Added username column to authenticated_users
-- 2. Improved subscription_status constraint to include 'past_due' and 'incomplete'
-- 3. Added validation trigger for subscription data consistency
-- 4. Created check_user_has_tier() function for tier permission checks
-- 5. Fixed get_user_with_email() to include all fields
-- 6. Created cleanup_expired_subscriptions() for automated subscription management
-- ============================================================================
