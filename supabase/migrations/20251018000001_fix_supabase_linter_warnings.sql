-- Fix Supabase Linter Warnings
-- This migration addresses:
-- 1. Auth RLS Initialization Plan warnings (wrapping auth.uid() with SELECT)
-- 2. Duplicate indexes
-- 3. Multiple permissive policies (will be addressed in a follow-up if needed)

-- ============================================================================
-- PART 1: Fix Auth RLS Initplan Issues
-- Replace auth.uid() with (select auth.uid()) for better query performance
-- ============================================================================

-- Fix game_features policies
DROP POLICY IF EXISTS "Users can view own game features" ON public.game_features;
CREATE POLICY "Users can view own game features" ON public.game_features
    FOR SELECT
    USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "game_features_insert_own" ON public.game_features;
CREATE POLICY "game_features_insert_own" ON public.game_features
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "game_features_update_own" ON public.game_features;
CREATE POLICY "game_features_update_own" ON public.game_features
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "game_features_delete_own" ON public.game_features;
CREATE POLICY "game_features_delete_own" ON public.game_features
    FOR DELETE
    USING (user_id = (select auth.uid())::text);

-- Fix games_pgn policies
DROP POLICY IF EXISTS "games_pgn_owner_read" ON public.games_pgn;
CREATE POLICY "games_pgn_owner_read" ON public.games_pgn
    FOR SELECT
    USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "games_pgn_insert_own" ON public.games_pgn;
CREATE POLICY "games_pgn_insert_own" ON public.games_pgn
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "games_pgn_update_own" ON public.games_pgn;
CREATE POLICY "games_pgn_update_own" ON public.games_pgn
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "games_pgn_delete_own" ON public.games_pgn;
CREATE POLICY "games_pgn_delete_own" ON public.games_pgn
    FOR DELETE
    USING (user_id = (select auth.uid())::text);

-- Fix import_sessions policies
DROP POLICY IF EXISTS "Users can read own import sessions" ON public.import_sessions;
CREATE POLICY "Users can read own import sessions" ON public.import_sessions
    FOR SELECT
    USING (user_id = (select auth.uid())::text);

-- Fix parity_logs policies
-- Note: parity_logs uses app_admins table for admin checks
DROP POLICY IF EXISTS "parity_logs_admin_read" ON public.parity_logs;
CREATE POLICY "parity_logs_admin_read" ON public.parity_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.app_admins a
            WHERE a.email = ((select auth.jwt()) ->> 'email')
        )
    );

-- Fix user_profiles policies
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own" ON public.user_profiles
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "user_profiles_delete_own" ON public.user_profiles;
CREATE POLICY "user_profiles_delete_own" ON public.user_profiles
    FOR DELETE
    USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

-- Fix game_analyses policies
DROP POLICY IF EXISTS "game_analyses_insert_own" ON public.game_analyses;
CREATE POLICY "game_analyses_insert_own" ON public.game_analyses
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "game_analyses_update_own" ON public.game_analyses;
CREATE POLICY "game_analyses_update_own" ON public.game_analyses
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "game_analyses_delete_own" ON public.game_analyses;
CREATE POLICY "game_analyses_delete_own" ON public.game_analyses
    FOR DELETE
    USING (user_id = (select auth.uid())::text);

-- Fix move_analyses policies
DROP POLICY IF EXISTS "move_analyses_insert_own" ON public.move_analyses;
CREATE POLICY "move_analyses_insert_own" ON public.move_analyses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_analyses
            WHERE game_analyses.id = move_analyses.game_analysis_id
            AND game_analyses.user_id = (select auth.uid())::text
        )
    );

DROP POLICY IF EXISTS "move_analyses_update_own" ON public.move_analyses;
CREATE POLICY "move_analyses_update_own" ON public.move_analyses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.game_analyses
            WHERE game_analyses.id = move_analyses.game_analysis_id
            AND game_analyses.user_id = (select auth.uid())::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_analyses
            WHERE game_analyses.id = move_analyses.game_analysis_id
            AND game_analyses.user_id = (select auth.uid())::text
        )
    );

DROP POLICY IF EXISTS "move_analyses_delete_own" ON public.move_analyses;
CREATE POLICY "move_analyses_delete_own" ON public.move_analyses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.game_analyses
            WHERE game_analyses.id = move_analyses.game_analysis_id
            AND game_analyses.user_id = (select auth.uid())::text
        )
    );

-- Fix analysis_jobs policies
DROP POLICY IF EXISTS "analysis_jobs_select_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_select_own" ON public.analysis_jobs
    FOR SELECT
    USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "analysis_jobs_insert_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_insert_own" ON public.analysis_jobs
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "analysis_jobs_update_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_update_own" ON public.analysis_jobs
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "analysis_jobs_delete_own" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_delete_own" ON public.analysis_jobs
    FOR DELETE
    USING (user_id = (select auth.uid())::text);

-- Fix games policies
DROP POLICY IF EXISTS "games_select_own" ON public.games;
CREATE POLICY "games_select_own" ON public.games
    FOR SELECT
    USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "games_insert_own" ON public.games;
CREATE POLICY "games_insert_own" ON public.games
    FOR INSERT
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "games_update_own" ON public.games;
CREATE POLICY "games_update_own" ON public.games
    FOR UPDATE
    USING (user_id = (select auth.uid())::text)
    WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "games_delete_own" ON public.games;
CREATE POLICY "games_delete_own" ON public.games
    FOR DELETE
    USING (user_id = (select auth.uid())::text);

-- ============================================================================
-- PART 2: Remove Duplicate Indexes
-- ============================================================================

-- Drop duplicate index on game_analyses (keep idx_game_analyses_user_platform_game)
DROP INDEX IF EXISTS public.idx_game_analyses_lookup;

-- Drop duplicate index on games (keep idx_games_played_at)
DROP INDEX IF EXISTS public.idx_games_played_at_health;

-- Drop duplicate index on games_pgn (keep idx_games_pgn_user_id)
DROP INDEX IF EXISTS public.idx_games_pgn_user;

-- Drop duplicate index on move_analyses (keep idx_move_analyses_method)
DROP INDEX IF EXISTS public.idx_move_analyses_analysis_method;

-- Note: user_profiles_user_id_platform_key is a constraint index, not a duplicate
-- It's maintained by the UNIQUE constraint and should not be dropped

-- ============================================================================
-- PART 3: Add Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view own game features" ON public.game_features IS
'Optimized RLS policy using (select auth.uid()) for better performance';

COMMENT ON POLICY "games_pgn_owner_read" ON public.games_pgn IS
'Optimized RLS policy using (select auth.uid()) for better performance';

COMMENT ON POLICY "Users can read own import sessions" ON public.import_sessions IS
'Optimized RLS policy using (select auth.uid()) for better performance';

-- Note: Multiple permissive policies warnings remain. These require more careful
-- consolidation to avoid breaking existing functionality. They should be addressed
-- in a separate migration after thorough testing.
