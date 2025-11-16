-- ============================================================================
-- EMERGENCY FIX: Add missing search_path to handle_new_user function
-- Date: 2025-11-02
-- Description: Fixes the handle_new_user() function to include SET search_path
--              This ensures the trigger can find public.authenticated_users table
-- ============================================================================

-- Recreate the function with the correct search_path setting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public  -- CRITICAL: Ensures function finds the correct schema
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Verify the trigger still exists (should already exist from previous migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.triggers
        WHERE trigger_schema = 'auth'
        AND trigger_name = 'on_auth_user_created'
        AND event_object_table = 'users'
    ) THEN
        -- Recreate trigger if it doesn't exist
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();

        RAISE NOTICE 'Trigger on_auth_user_created was recreated';
    ELSE
        RAISE NOTICE 'Trigger on_auth_user_created already exists';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the function now has the correct settings
SELECT
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE p.prosecdef
        WHEN true THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Fixed handle_new_user() function to include:
-- 1. SECURITY DEFINER - runs with elevated privileges
-- 2. SET search_path = public - ensures table can be found
-- 3. Proper error handling with ON CONFLICT
--
-- This fix should resolve the "Database error saving new user" issue
-- ============================================================================
