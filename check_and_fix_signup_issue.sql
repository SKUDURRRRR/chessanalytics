-- ============================================================================
-- Script to Check and Fix Signup Issue
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- Step 1: Check if the usage columns exist
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'authenticated_users'
    AND column_name IN ('games_imported_count', 'games_analyzed_count', 'usage_reset_at')
ORDER BY column_name;

-- Expected result: 3 rows showing the usage columns
-- If you get 0 rows, the migration WASN'T applied!

-- ============================================================================

-- Step 2: Check for stuck/partial user records
SELECT
    au.id,
    au.email,
    au.created_at,
    pu.id as profile_exists
FROM auth.users au
LEFT JOIN authenticated_users pu ON au.id = pu.id
WHERE au.email IN ('test@test.com', 'jonas@ponas.com')
ORDER BY au.created_at DESC;

-- If you see users with profile_exists = NULL, they're stuck!

-- ============================================================================

-- Step 3: Clean up stuck test users (if any exist)
-- Only run this if Step 2 showed stuck users

-- First, delete from auth.users (this will cascade to authenticated_users if it exists)
DELETE FROM auth.users
WHERE email IN ('test@test.com', 'jonas@ponas.com');

-- ============================================================================

-- Step 4: Verify the trigger function includes the new columns
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Check if the function INSERT statement includes games_imported_count, games_analyzed_count, usage_reset_at
-- If it doesn't, you need to update the trigger function!

-- ============================================================================
-- SUMMARY OF WHAT TO CHECK:
-- ============================================================================
-- 1. Step 1: Verify usage columns exist (should return 3 rows)
-- 2. Step 2: Look for stuck users (should return 0 rows ideally)
-- 3. Step 3: Clean up test users if needed
-- 4. Step 4: Verify trigger function (should show the INSERT statement)
-- ============================================================================
