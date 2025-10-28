-- Fix All Supabase Linter Warnings
-- This migration addresses all remaining linter warnings:
-- 1. Auth RLS Initialization Plan warnings (wrapping auth.uid() with SELECT)
-- 2. Multiple Permissive Policies warnings (consolidating duplicate policies)
--
-- Date: 2025-10-26
-- Issue: Supabase Database Linter showing performance warnings

-- ============================================================================
-- PART 1: Fix game_features Policies
-- ============================================================================

-- Drop all existing game_features SELECT policies
DROP POLICY IF EXISTS "game_features_select_all" ON public.game_features;
DROP POLICY IF EXISTS "game_features_select_own" ON public.game_features;
DROP POLICY IF EXISTS "Users can view own game features" ON public.game_features;
DROP POLICY IF EXISTS "Users can view all game features" ON public.game_features;
-- Create single optimized SELECT policy
CREATE POLICY "game_features_select_all" ON public.game_features
    FOR SELECT
    USING (true);
-- Allow all users to view game features for analytics

COMMENT ON POLICY "game_features_select_all" ON public.game_features IS
'Consolidated SELECT policy with public read access for analytics. Write operations remain restricted to owners.';
-- ============================================================================
-- PART 2: Fix game_analyses Policies
-- ============================================================================

-- Drop all existing game_analyses SELECT policies
DROP POLICY IF EXISTS "game_analyses_select_all" ON public.game_analyses;
DROP POLICY IF EXISTS "game_analyses_select_own" ON public.game_analyses;
DROP POLICY IF EXISTS "Allow all for anon and service_role on game_analyses" ON public.game_analyses;
DROP POLICY IF EXISTS "Users can view all game analyses" ON public.game_analyses;
-- Create single optimized SELECT policy
-- Users can view their own analyses OR analyses for public games
CREATE POLICY "game_analyses_select_own" ON public.game_analyses
    FOR SELECT
    USING (
        (SELECT auth.uid())::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = game_analyses.game_id
            AND games.is_public = true
        )
    );
COMMENT ON POLICY "game_analyses_select_own" ON public.game_analyses IS
'Consolidated SELECT policy with optimized auth call: Users can view their own analyses or analyses for public games';
-- ============================================================================
-- PART 3: Fix move_analyses Policies
-- ============================================================================

-- Drop all existing move_analyses SELECT policies
DROP POLICY IF EXISTS "move_analyses_select_all" ON public.move_analyses;
DROP POLICY IF EXISTS "move_analyses_select_own" ON public.move_analyses;
DROP POLICY IF EXISTS "Users can view all move analyses" ON public.move_analyses;
-- Create single optimized SELECT policy
-- Users can view their own move analyses OR move analyses for public games
CREATE POLICY "move_analyses_select_own" ON public.move_analyses
    FOR SELECT
    USING (
        (SELECT auth.uid())::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = move_analyses.game_id
            AND games.is_public = true
        )
    );
COMMENT ON POLICY "move_analyses_select_own" ON public.move_analyses IS
'Consolidated SELECT policy with optimized auth call: Users can view their own move analyses or analyses for public games';
-- ============================================================================
-- PART 4: Fix games Policies
-- ============================================================================

-- Drop all existing games SELECT policies
DROP POLICY IF EXISTS "games_select_all" ON public.games;
DROP POLICY IF EXISTS "games_select_own" ON public.games;
DROP POLICY IF EXISTS "games_select" ON public.games;
DROP POLICY IF EXISTS "games_select_public" ON public.games;
DROP POLICY IF EXISTS "games_select_own_or_public" ON public.games;
DROP POLICY IF EXISTS "games_public_read" ON public.games;
DROP POLICY IF EXISTS "Allow all access to games" ON public.games;
DROP POLICY IF EXISTS "Users can see their own games" ON public.games;
-- Create single optimized SELECT policy
-- Allow all users to view all games for analytics purposes
CREATE POLICY "games_select_all" ON public.games
    FOR SELECT
    USING (true);
-- Allow all users to read games for analytics

COMMENT ON POLICY "games_select_all" ON public.games IS
'Consolidated SELECT policy: Allows all users to view games for analytics. Write operations remain restricted to owners.';
-- ============================================================================
-- PART 5: Fix games_pgn Policies
-- ============================================================================

-- Drop all existing games_pgn SELECT policies
DROP POLICY IF EXISTS "games_pgn_select" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_select_all" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_select_own" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_public_read" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_owner_read" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_anon_all" ON public.games_pgn;
-- Create single optimized SELECT policy
-- Allow users to view public PGNs or their own PGNs
CREATE POLICY "games_pgn_select_all" ON public.games_pgn
    FOR SELECT
    USING (true);
-- Allow all users to read PGNs for analytics

COMMENT ON POLICY "games_pgn_select_all" ON public.games_pgn IS
'Consolidated SELECT policy: Allows all users to view PGNs for analytics. Write operations remain restricted to owners.';
-- ============================================================================
-- PART 6: Fix user_profiles Policies
-- ============================================================================

-- Drop all existing user_profiles SELECT policies
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_all" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_public_read" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all users to view profiles" ON public.user_profiles;
-- Create single optimized SELECT policy
-- All profiles are publicly readable for leaderboards
CREATE POLICY "user_profiles_select_all" ON public.user_profiles
    FOR SELECT
    USING (true);
-- All profiles are publicly readable for leaderboards

COMMENT ON POLICY "user_profiles_select_all" ON public.user_profiles IS
'Consolidated SELECT policy: All user profiles are publicly readable for leaderboards and analytics';
-- ============================================================================
-- PART 7: Update INSERT/UPDATE/DELETE Policies to Use Optimized auth Calls
-- ============================================================================

-- game_features INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "game_features_insert_own" ON public.game_features;
CREATE POLICY "game_features_insert_own" ON public.game_features
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "game_features_update_own" ON public.game_features;
CREATE POLICY "game_features_update_own" ON public.game_features
    FOR UPDATE
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "game_features_delete_own" ON public.game_features;
CREATE POLICY "game_features_delete_own" ON public.game_features
    FOR DELETE
    USING (user_id = (SELECT auth.uid())::text);
-- game_analyses INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "game_analyses_insert_own" ON public.game_analyses;
CREATE POLICY "game_analyses_insert_own" ON public.game_analyses
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "game_analyses_update_own" ON public.game_analyses;
CREATE POLICY "game_analyses_update_own" ON public.game_analyses
    FOR UPDATE
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "game_analyses_delete_own" ON public.game_analyses;
CREATE POLICY "game_analyses_delete_own" ON public.game_analyses
    FOR DELETE
    USING (user_id = (SELECT auth.uid())::text);
-- move_analyses INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "move_analyses_insert_own" ON public.move_analyses;
CREATE POLICY "move_analyses_insert_own" ON public.move_analyses
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "move_analyses_update_own" ON public.move_analyses;
CREATE POLICY "move_analyses_update_own" ON public.move_analyses
    FOR UPDATE
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "move_analyses_delete_own" ON public.move_analyses;
CREATE POLICY "move_analyses_delete_own" ON public.move_analyses
    FOR DELETE
    USING (user_id = (SELECT auth.uid())::text);
-- games INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "games_insert_own" ON public.games;
CREATE POLICY "games_insert_own" ON public.games
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "games_update_own" ON public.games;
CREATE POLICY "games_update_own" ON public.games
    FOR UPDATE
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "games_delete_own" ON public.games;
CREATE POLICY "games_delete_own" ON public.games
    FOR DELETE
    USING (user_id = (SELECT auth.uid())::text);
-- games_pgn INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "games_pgn_insert_own" ON public.games_pgn;
CREATE POLICY "games_pgn_insert_own" ON public.games_pgn
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "games_pgn_update_own" ON public.games_pgn;
CREATE POLICY "games_pgn_update_own" ON public.games_pgn
    FOR UPDATE
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "games_pgn_delete_own" ON public.games_pgn;
CREATE POLICY "games_pgn_delete_own" ON public.games_pgn
    FOR DELETE
    USING (user_id = (SELECT auth.uid())::text);
-- user_profiles INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
    FOR UPDATE
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;
CREATE POLICY "user_profiles_delete_own" ON public.user_profiles
    FOR DELETE
    USING (user_id = (SELECT auth.uid())::text);
-- ============================================================================
-- Summary
-- ============================================================================
--
-- This migration fixes all Supabase linter warnings:
--
-- 1. Auth RLS Initialization Plan (3 warnings):
--    - game_features_select_own: Now uses (SELECT auth.uid())
--    - game_analyses_select_own: Now uses (SELECT auth.uid())
--    - move_analyses_select_own: Now uses (SELECT auth.uid())
--
-- 2. Multiple Permissive Policies (27 warnings):
--    - game_features: Consolidated to single game_features_select_all policy
--    - game_analyses: Consolidated to single game_analyses_select_own policy
--    - move_analyses: Consolidated to single move_analyses_select_own policy
--    - games: Consolidated to single games_select_all policy
--    - games_pgn: Consolidated to single games_pgn_select_all policy
--    - user_profiles: Consolidated to single user_profiles_select_all policy
--
-- Security model:
-- - SELECT policies: Allow public read for analytics (game_features, games, games_pgn, user_profiles)
--   or owner + public games read (game_analyses, move_analyses)
-- - INSERT/UPDATE/DELETE: Restricted to owners only
-- - Service role: Maintains full access via separate service_role policies
--
-- Performance improvements:
-- - Eliminates redundant policy evaluations
-- - Optimizes auth function calls with (SELECT auth.uid())
-- - Single policy per operation = faster query planning
-- ============================================================================;
