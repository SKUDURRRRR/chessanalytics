-- Migration: Verify and Fix Security Settings
-- Date: 2025-11-03
-- Description: Re-enable RLS on authenticated_users and remove unsafe views

-- ============================================================================
-- 1. RE-ENABLE RLS ON AUTHENTICATED_USERS
-- ============================================================================

-- Force enable RLS (in case it was disabled)
ALTER TABLE public.authenticated_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. REMOVE UNSAFE VIEWS
-- ============================================================================

-- Drop user_registration_status view if it exists
-- This view exposes auth.users data and uses SECURITY DEFINER
DROP VIEW IF EXISTS public.user_registration_status CASCADE;

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

-- Verify RLS is enabled
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE tablename = 'authenticated_users' AND schemaname = 'public';

    IF NOT rls_enabled THEN
        RAISE EXCEPTION 'CRITICAL: RLS is NOT enabled on authenticated_users table!';
    ELSE
        RAISE NOTICE 'SUCCESS: RLS is enabled on authenticated_users';
    END IF;
END $$;

-- Verify policies exist
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'authenticated_users' AND schemaname = 'public';

    IF policy_count < 4 THEN
        RAISE WARNING 'WARNING: Expected at least 4 RLS policies, found %', policy_count;
    ELSE
        RAISE NOTICE 'SUCCESS: Found % RLS policies on authenticated_users', policy_count;
    END IF;
END $$;

-- Verify no unsafe views exist
DO $$
DECLARE
    view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO view_count
    FROM pg_views
    WHERE viewname = 'user_registration_status' AND schemaname = 'public';

    IF view_count > 0 THEN
        RAISE WARNING 'WARNING: user_registration_status view still exists!';
    ELSE
        RAISE NOTICE 'SUCCESS: No unsafe user_registration_status view found';
    END IF;
END $$;

-- ============================================================================
-- 4. SECURITY AUDIT REPORT
-- ============================================================================

SELECT
    'Security Audit Report' as report,
    NOW() as timestamp,
    json_build_object(
        'authenticated_users_rls_enabled', (
            SELECT rowsecurity
            FROM pg_tables
            WHERE tablename = 'authenticated_users' AND schemaname = 'public'
        ),
        'authenticated_users_policy_count', (
            SELECT COUNT(*)
            FROM pg_policies
            WHERE tablename = 'authenticated_users' AND schemaname = 'public'
        ),
        'unsafe_view_exists', (
            SELECT COUNT(*) > 0
            FROM pg_views
            WHERE viewname = 'user_registration_status' AND schemaname = 'public'
        ),
        'policies', (
            SELECT json_agg(policyname)
            FROM pg_policies
            WHERE tablename = 'authenticated_users' AND schemaname = 'public'
        )
    ) as security_status;

-- ============================================================================
-- EXPECTED RESULT
-- ============================================================================
-- {
--   "authenticated_users_rls_enabled": true,
--   "authenticated_users_policy_count": 4,
--   "unsafe_view_exists": false,
--   "policies": [
--     "Users can view own profile",
--     "Users can update own profile",
--     "Users can insert own profile on signup",
--     "Service role full access"
--   ]
-- }
-- ============================================================================
