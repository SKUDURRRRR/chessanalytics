-- ============================================================================
-- PRODUCTION FIX: Add missing signup trigger
-- Run this in Supabase SQL Editor to fix registration
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT)
-- ============================================================================

-- Create function to auto-create authenticated_users entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Create trigger on auth.users (drops old one first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users (creates authenticated_users for any existing auth.users)
INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
SELECT
    au.id,
    'free',
    'active'
FROM auth.users au
LEFT JOIN public.authenticated_users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify the fix
SELECT
    'Registration fix applied!' as status,
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM public.authenticated_users) as total_authenticated_users,
    EXISTS (
        SELECT FROM information_schema.triggers
        WHERE trigger_schema = 'auth'
        AND trigger_name = 'on_auth_user_created'
    ) as trigger_exists;
