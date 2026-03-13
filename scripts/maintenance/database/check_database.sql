-- ============================================================================
-- Database Diagnostic Script
-- Run this in your Supabase SQL Editor to check the database state
-- ============================================================================

-- Check if authenticated_users table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'authenticated_users'
) as authenticated_users_table_exists;

-- Check if the trigger exists
SELECT EXISTS (
    SELECT FROM information_schema.triggers
    WHERE trigger_schema = 'auth'
    AND trigger_name = 'on_auth_user_created'
) as trigger_exists;

-- Check if the function exists
SELECT EXISTS (
    SELECT FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'handle_new_user'
) as function_exists;

-- Check RLS policies on authenticated_users
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
WHERE tablename = 'authenticated_users'
ORDER BY policyname;

-- Count existing auth.users
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- Count existing authenticated_users
SELECT COUNT(*) as total_authenticated_users FROM public.authenticated_users;
