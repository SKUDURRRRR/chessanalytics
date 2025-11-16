-- ============================================================================
-- COMPREHENSIVE DIAGNOSTIC SCRIPT FOR SIGNUP ISSUE
-- Run this ENTIRE script in Supabase SQL Editor
-- It will check everything and show you what's wrong
-- ============================================================================

-- DIAGNOSTIC 1: Check if trigger exists
SELECT '========== DIAGNOSTIC 1: Check if trigger exists ==========' as diagnostic;

SELECT
    trigger_schema,
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
OR (event_object_table = 'users' AND trigger_schema = 'auth');

-- DIAGNOSTIC 2: Check function configuration
SELECT '========== DIAGNOSTIC 2: Check function configuration ==========' as diagnostic;

SELECT
    p.proname as function_name,
    CASE p.prosecdef
        WHEN true THEN 'SECURITY DEFINER ✓'
        ELSE 'SECURITY INVOKER ✗'
    END as security_type,
    COALESCE(p.proconfig::text, 'No config set ✗') as configuration
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- DIAGNOSTIC 3: Check table structure
SELECT '========== DIAGNOSTIC 3: Check table structure ==========' as diagnostic;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'authenticated_users'
ORDER BY ordinal_position;

-- DIAGNOSTIC 4: Check RLS policies for INSERT
SELECT '========== DIAGNOSTIC 4: Check RLS policies for INSERT ==========' as diagnostic;

SELECT
    policyname,
    CASE WHEN permissive = 'PERMISSIVE' THEN '✓ PERMISSIVE' ELSE '✗ RESTRICTIVE' END as permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'authenticated_users'
AND cmd IN ('INSERT', 'ALL')
ORDER BY policyname;

-- DIAGNOSTIC 5: Check permissions
SELECT '========== DIAGNOSTIC 5: Check permissions ==========' as diagnostic;

SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'authenticated_users'
AND privilege_type IN ('INSERT', 'ALL PRIVILEGES')
ORDER BY grantee;

-- DIAGNOSTIC 6: Check for blocking triggers
SELECT '========== DIAGNOSTIC 6: Check for blocking triggers ==========' as diagnostic;

SELECT
    trigger_name,
    action_timing || ' ' || event_manipulation as timing_event,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'authenticated_users'
AND action_timing = 'BEFORE'
ORDER BY action_timing;

-- DIAGNOSTIC 7: Test manual insert
SELECT '========== DIAGNOSTIC 7: Test manual insert ==========' as diagnostic;

DO $$
DECLARE
    test_uuid UUID := gen_random_uuid();
    insert_success BOOLEAN := false;
BEGIN
    BEGIN
        INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
        VALUES (test_uuid, 'free', 'active');
        insert_success := true;
        RAISE NOTICE '✓ Manual insert SUCCEEDED with UUID: %', test_uuid;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✗ Manual insert FAILED: % %', SQLERRM, SQLSTATE;
        insert_success := false;
    END;

    IF insert_success THEN
        DELETE FROM public.authenticated_users WHERE id = test_uuid;
        RAISE NOTICE '✓ Cleanup successful';
    END IF;
END $$;

-- DIAGNOSTIC 8: Check function source code
SELECT '========== DIAGNOSTIC 8: Check function source code ==========' as diagnostic;

SELECT
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- ============================================================================
-- SUMMARY: What to check in the results above
-- ============================================================================
-- Diagnostic 1: Should show "on_auth_user_created" trigger on auth.users table
-- Diagnostic 2: Should show "SECURITY DEFINER ✓" and "search_path=public"
-- Diagnostic 3: Should show all columns of authenticated_users table
-- Diagnostic 4: Should show RLS policies including "Service role full access"
-- Diagnostic 5: Should show INSERT permissions for various roles
-- Diagnostic 6: Should show any BEFORE INSERT triggers that might be blocking
-- Diagnostic 7: Check NOTICES tab - should show "✓ Manual insert SUCCEEDED"
-- Diagnostic 8: Should show complete function definition
--
-- If any diagnostic fails or returns 0 rows, that's the problem!
-- ============================================================================
