-- Migration: Auto-create authenticated_users entry on sign-up
-- Date: 2025-10-30
-- Description: Automatically creates authenticated_users entry when user signs up in auth.users

-- ============================================================================
-- FUNCTION: Auto-create authenticated_users entry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Create authenticated_users on auth.users insert
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- BACKFILL: Create authenticated_users for existing auth.users
-- ============================================================================

-- Insert authenticated_users entries for any existing users that don't have one
INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
SELECT
    au.id,
    'free',
    'active'
FROM auth.users au
LEFT JOIN public.authenticated_users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 1. Created handle_new_user() function to auto-create authenticated_users entry
-- 2. Added trigger on auth.users INSERT to call the function
-- 3. Backfilled authenticated_users for any existing auth.users
-- ============================================================================
