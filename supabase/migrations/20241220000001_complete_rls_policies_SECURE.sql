-- Complete RLS Policy Coverage Migration (SECURE VERSION)
-- This migration ensures all tables have comprehensive Row Level Security policies
-- This replaces 20241220000001_complete_rls_policies.sql with secure defaults

-- ============================================================================
-- 0. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_features ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. DROP EXISTING POLICIES (to avoid conflicts)
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can see their own games" ON games;
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view all game analyses" ON game_analyses;
DROP POLICY IF EXISTS "Users can insert own game analyses" ON game_analyses;
DROP POLICY IF EXISTS "Users can update own game analyses" ON game_analyses;
DROP POLICY IF EXISTS "Users can delete own game analyses" ON game_analyses;
DROP POLICY IF EXISTS "Users can view all move analyses" ON move_analyses;
DROP POLICY IF EXISTS "Users can insert own move analyses" ON move_analyses;
DROP POLICY IF EXISTS "Users can update own move analyses" ON move_analyses;
DROP POLICY IF EXISTS "Users can delete own move analyses" ON move_analyses;
DROP POLICY IF EXISTS "Users can view all game features" ON game_features;
DROP POLICY IF EXISTS "Users can insert own game features" ON game_features;
DROP POLICY IF EXISTS "Users can update own game features" ON game_features;
DROP POLICY IF EXISTS "Users can delete own game features" ON game_features;

-- Drop standardized policy names
DROP POLICY IF EXISTS "games_select_own" ON games;
DROP POLICY IF EXISTS "games_insert_own" ON games;
DROP POLICY IF EXISTS "games_update_own" ON games;
DROP POLICY IF EXISTS "games_delete_own" ON games;
DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own" ON user_profiles;
DROP POLICY IF EXISTS "game_analyses_select_all" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_select_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_insert_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_update_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_delete_own" ON game_analyses;
DROP POLICY IF EXISTS "move_analyses_select_all" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_select_own" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_insert_own" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_update_own" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_delete_own" ON move_analyses;
DROP POLICY IF EXISTS "game_features_select_all" ON game_features;
DROP POLICY IF EXISTS "game_features_select_own" ON game_features;
DROP POLICY IF EXISTS "game_features_insert_own" ON game_features;
DROP POLICY IF EXISTS "game_features_update_own" ON game_features;
DROP POLICY IF EXISTS "game_features_delete_own" ON game_features;

-- ============================================================================
-- 2. GAMES TABLE RLS POLICIES (SECURE - own games only by default)
-- ============================================================================

-- Add is_public column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE games ADD COLUMN is_public BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_games_is_public ON games(is_public) WHERE is_public = true;
  END IF;
END $$;

-- Users can view their own games OR games marked as public
CREATE POLICY "games_select_own_or_public" ON games
    FOR SELECT
    USING (auth.uid()::text = user_id OR is_public = true);

-- Users can insert their own games
CREATE POLICY "games_insert_own" ON games
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own games
CREATE POLICY "games_update_own" ON games
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own games
CREATE POLICY "games_delete_own" ON games
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 3. USER_PROFILES TABLE RLS POLICIES (Public read for leaderboards)
-- ============================================================================

-- Users can view all profiles (for leaderboards and search)
CREATE POLICY "user_profiles_select_all" ON user_profiles
    FOR SELECT
    USING (true);

-- Users can insert their own profile
CREATE POLICY "user_profiles_insert_own" ON user_profiles
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own" ON user_profiles
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own profile
CREATE POLICY "user_profiles_delete_own" ON user_profiles
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 4. GAME_ANALYSES TABLE RLS POLICIES (SECURE - follows game access)
-- ============================================================================

-- Users can view game analyses for their own games OR public games
CREATE POLICY "game_analyses_select_own" ON game_analyses
    FOR SELECT
    USING (
        auth.uid()::text = user_id 
        OR EXISTS (
            SELECT 1 FROM games 
            WHERE games.game_id = game_analyses.game_id 
            AND games.is_public = true
        )
    );

-- Users can insert their own game analyses
CREATE POLICY "game_analyses_insert_own" ON game_analyses
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own game analyses
CREATE POLICY "game_analyses_update_own" ON game_analyses
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own game analyses
CREATE POLICY "game_analyses_delete_own" ON game_analyses
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 5. MOVE_ANALYSES TABLE RLS POLICIES (SECURE - follows game access)
-- ============================================================================

-- Users can view move analyses for their own games OR public games
CREATE POLICY "move_analyses_select_own" ON move_analyses
    FOR SELECT
    USING (
        auth.uid()::text = user_id 
        OR EXISTS (
            SELECT 1 FROM games 
            WHERE games.game_id = move_analyses.game_id 
            AND games.is_public = true
        )
    );

-- Users can insert their own move analyses
CREATE POLICY "move_analyses_insert_own" ON move_analyses
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own move analyses
CREATE POLICY "move_analyses_update_own" ON move_analyses
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own move analyses
CREATE POLICY "move_analyses_delete_own" ON move_analyses
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 6. GAME_FEATURES TABLE RLS POLICIES (SECURE - follows game access)
-- ============================================================================

-- Users can view game features for their own games OR public games
CREATE POLICY "game_features_select_own" ON game_features
    FOR SELECT
    USING (
        auth.uid()::text = user_id 
        OR EXISTS (
            SELECT 1 FROM games 
            WHERE games.game_id = game_features.game_id 
            AND games.is_public = true
        )
    );

-- Users can insert their own game features
CREATE POLICY "game_features_insert_own" ON game_features
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own game features
CREATE POLICY "game_features_update_own" ON game_features
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can delete their own game features
CREATE POLICY "game_features_delete_own" ON game_features
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- 7. SERVICE ROLE POLICIES (for backend operations)
-- ============================================================================

-- Service role can perform all operations on all tables
CREATE POLICY "games_service_role_all" ON games
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "user_profiles_service_role_all" ON user_profiles
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "game_analyses_service_role_all" ON game_analyses
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "move_analyses_service_role_all" ON move_analyses
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "game_features_service_role_all" ON game_features
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. RELOAD SCHEMA CACHE
-- ============================================================================

NOTIFY pgrst, 'reload schema';

