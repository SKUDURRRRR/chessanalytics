-- ============================================================================
-- DIAGNOSTIC SCRIPT FOR SIGNUP ISSUE
-- Run this in Supabase SQL Editor to diagnose the registration problem
-- ============================================================================

-- 1. Check if authenticated_users table exists and has correct structure
SELECT 'Table Structure Check' as check_name;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'authenticated_users'
ORDER BY ordinal_position;

-- 2. Check if the trigger exists
SELECT '---' as separator;
SELECT 'Trigger Existence Check' as check_name;
SELECT
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
OR event_object_table = 'users' AND trigger_schema = 'auth';

-- 3. Check the function definition
SELECT '---' as separator;
SELECT 'Function Definition Check' as check_name;
SELECT
    routine_name,
    routine_schema,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_new_user';

-- 4. Check RLS policies on authenticated_users
SELECT '---' as separator;
SELECT 'RLS Policies Check' as check_name;
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'authenticated_users';

-- 5. Check constraints on authenticated_users
SELECT '---' as separator;
SELECT 'Constraints Check' as check_name;
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.authenticated_users'::regclass;

-- 6. Check if there are any triggers on authenticated_users that might be causing issues
SELECT '---' as separator;
SELECT 'All Triggers on authenticated_users' as check_name;
SELECT
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'authenticated_users'
ORDER BY action_timing, event_manipulation;

-- 7. Test if we can manually insert (this simulates what the trigger does)
SELECT '---' as separator;
SELECT 'Manual Insert Test' as check_name;
-- NOTE: This is a dry run - we're checking if the SQL syntax would work
-- You can uncomment the INSERT to actually test, but use a test UUID
SELECT 'If you want to test manual insert, replace <test-uuid> with an actual test UUID' as note;
-- INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
-- VALUES ('<test-uuid>'::uuid, 'free', 'active')
-- ON CONFLICT (id) DO NOTHING;

-- 8. Check if there are any users in auth.users without authenticated_users entry
SELECT '---' as separator;
SELECT 'Orphaned Users Check' as check_name;
SELECT
    au.id,
    au.email,
    au.created_at,
    CASE WHEN pu.id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as profile_status
FROM auth.users au
LEFT JOIN public.authenticated_users pu ON pu.id = au.id
ORDER BY au.created_at DESC
LIMIT 10;

-- 9. Check grant permissions
SELECT '---' as separator;
SELECT 'Permissions Check' as check_name;
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'authenticated_users';

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- 1. Table should have: id, created_at, updated_at, account_tier, subscription_status,
--    stripe_customer_id, stripe_subscription_id, subscription_end_date, username
-- 2. Trigger 'on_auth_user_created' should exist on auth.users
-- 3. Function 'handle_new_user' should exist with SECURITY DEFINER
-- 4. RLS should have policies for: view, update, insert, service_role
-- 5. Constraints should include: account_tier_check, subscription_status_check
-- 6. Multiple triggers may exist on authenticated_users (validate_subscription_data_trigger, etc.)
-- 7. Orphaned users check should show if any users are missing profiles
-- ============================================================================
