-- Consolidate Multiple Permissive Policies
-- This migration addresses the "multiple_permissive_policies" warnings by consolidating
-- redundant policies into single, comprehensive policies where appropriate.

-- ============================================================================
-- PART 1: Consolidate game_analyses policies
-- ============================================================================

-- Remove redundant policies and keep comprehensive ones
-- The "Allow all for anon and service_role on game_analyses" policy is broad and covers the specific ones
-- So we can drop the specific "own" policies if the broad one exists and handles all cases

-- First, let's check if we need the broad policy. If it exists and allows everything,
-- the specific "own" policies are redundant.
-- For now, we'll keep both SELECT policies as they might serve different purposes
-- (one for all anon users, one for specific ownership checks)

-- However, for INSERT, UPDATE, DELETE we should consolidate

-- Keep the "own" policies and remove the overly broad "Allow all" policy for these operations
-- This is safer and follows principle of least privilege

DROP POLICY IF EXISTS "Allow all for anon and service_role on game_analyses" ON public.game_analyses;

-- ============================================================================
-- PART 2: Consolidate game_features policies
-- ============================================================================

-- Keep the "game_features_select_all" policy and remove the redundant "Users can view own game features"
-- if game_features_select_all already provides sufficient access
DROP POLICY IF EXISTS "Users can view own game features" ON public.game_features;
DROP POLICY IF EXISTS "game_features_select_all" ON public.game_features;

-- Recreate it as a single comprehensive policy if needed
CREATE POLICY "game_features_select_all" ON public.game_features
    FOR SELECT
    USING (true);  -- Adjust based on your security requirements

-- ============================================================================
-- PART 3: Consolidate games policies
-- ============================================================================

-- The games table has complex policy requirements with:
-- - "Allow all access to games" (very broad)
-- - "games_select_own" (ownership check)
-- - "games_public_read" (public access)
-- - Client write prevention policies

-- Strategy: Remove the overly broad "Allow all" policy and keep specific policies

DROP POLICY IF EXISTS "Allow all access to games" ON public.games;

-- The remaining policies (games_select_own, games_public_read, games_insert_own, etc.)
-- plus the no_client_* policies provide granular control

-- ============================================================================
-- PART 4: Consolidate games_pgn policies
-- ============================================================================

-- Remove the broad "games_pgn_anon_all" policy if it exists
DROP POLICY IF EXISTS "games_pgn_anon_all" ON public.games_pgn;

-- Keep specific policies:
-- - games_pgn_select_all / games_pgn_public_read / games_pgn_owner_read
-- - games_pgn_insert_own, games_pgn_update_own, games_pgn_delete_own
-- - games_pgn_no_client_* policies

-- Consolidate the multiple SELECT policies into one comprehensive policy
DROP POLICY IF EXISTS "games_pgn_select_all" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_public_read" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_owner_read" ON public.games_pgn;

CREATE POLICY "games_pgn_select" ON public.games_pgn
    FOR SELECT
    USING (
        is_public = true  -- Public games can be viewed by anyone
        OR user_id = (select auth.uid())::text  -- Owner can view their own games
        OR auth.role() = 'service_role'  -- Service role can view all
    );

-- Consolidate INSERT policies (keep the restrictive no_client_write, remove duplicates)
DROP POLICY IF EXISTS "games_pgn_no_client_write_ins" ON public.games_pgn;
-- Keep games_pgn_insert_own and games_pgn_no_client_write

-- Consolidate UPDATE policies (keep the restrictive ones, remove duplicates)
DROP POLICY IF EXISTS "games_pgn_no_client_write_upd" ON public.games_pgn;
-- Keep games_pgn_update_own and games_pgn_no_client_update

-- ============================================================================
-- PART 5: Consolidate import_sessions policies
-- ============================================================================

-- Remove the "Anon can read import sessions" policy as it's too broad
DROP POLICY IF EXISTS "Anon can read import sessions" ON public.import_sessions;

-- Keep "Users can read own import sessions" policy

-- ============================================================================
-- PART 6: Consolidate user_profiles policies
-- ============================================================================

-- user_profiles has multiple overlapping policies for each operation
-- Consolidate them into single policies per operation

-- For SELECT: multiple policies allow viewing profiles
DROP POLICY IF EXISTS "Allow all users to view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_public_read" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_all" ON public.user_profiles;

CREATE POLICY "user_profiles_select" ON public.user_profiles
    FOR SELECT
    USING (true);  -- All profiles are publicly readable

-- For INSERT: consolidate multiple insert policies
DROP POLICY IF EXISTS "Allow all users to insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
-- Keep user_profiles_insert_own (already fixed in previous migration)

-- For UPDATE: consolidate multiple update policies
DROP POLICY IF EXISTS "Allow all users to update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
-- Keep user_profiles_update_own (already fixed in previous migration)

-- For DELETE: keep user_profiles_delete_own

-- ============================================================================
-- PART 7: Add Comments
-- ============================================================================

COMMENT ON POLICY "games_pgn_select" ON public.games_pgn IS
'Consolidated SELECT policy: allows public games to be viewed by anyone, private games only by owner';

COMMENT ON POLICY "user_profiles_select" ON public.user_profiles IS
'Consolidated SELECT policy: all user profiles are publicly readable';

-- ============================================================================
-- Notes on remaining policies:
--
-- Some policies were left in place because they serve different purposes:
-- 1. Ownership-based policies (user can access their own data)
-- 2. Public read policies (anyone can read public data)
-- 3. Role-based policies (service_role has elevated access)
-- 4. Restrictive policies (no_client_write/update/delete prevent client access)
--
-- These serve as multiple layers of security and access control, which is
-- sometimes necessary for complex authorization requirements.
-- ============================================================================
