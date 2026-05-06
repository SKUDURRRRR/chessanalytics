-- ============================================================================
-- EMERGENCY FIX: Ensure trigger exists and function works
-- Run this if the diagnostic shows the trigger is missing or broken
-- ============================================================================

-- STEP 1: Recreate the function with all correct settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Log for debugging (will show in Supabase logs)
    RAISE LOG 'handle_new_user triggered for user: %', NEW.id;

    -- Insert into authenticated_users
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;

    RAISE LOG 'Successfully created authenticated_users record for: %', NEW.id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE LOG 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    -- Still return NEW so user creation succeeds even if profile creation fails
    RETURN NEW;
END;
$$;

-- STEP 2: Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- STEP 3: Verify the trigger was created
SELECT
    'Trigger created successfully!' as status,
    trigger_name,
    event_object_schema,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- STEP 4: Verify function has correct settings
SELECT
    'Function configured correctly!' as status,
    p.proname,
    CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security,
    COALESCE(p.proconfig::text, 'No config') as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- ============================================================================
-- Now try signing up again!
-- Check Supabase logs for "handle_new_user triggered" messages
-- ============================================================================
