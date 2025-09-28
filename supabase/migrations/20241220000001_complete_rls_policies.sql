-- Complete RLS Policy Coverage Migration
-- This migration ensures all tables have comprehensive Row Level Security policies

-- ============================================================================
-- 1. DROP EXISTING POLICIES (to avoid conflicts)
-- ============================================================================

-- Drop existing policies to recreate them consistently
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

-- Drop previously standardized policy names if present
DROP POLICY IF EXISTS "games_select_own" ON games;
DROP POLICY IF EXISTS "games_insert_own" ON games;
DROP POLICY IF EXISTS "games_update_own" ON games;
DROP POLICY IF EXISTS "games_delete_own" ON games;
DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_own" ON user_profiles;
DROP POLICY IF EXISTS "game_analyses_select_all" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_insert_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_update_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_delete_own" ON game_analyses;
DROP POLICY IF EXISTS "move_analyses_select_all" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_insert_own" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_update_own" ON move_analyses;
DROP POLICY IF EXISTS "move_analyses_delete_own" ON move_analyses;
DROP POLICY IF EXISTS "game_features_select_all" ON game_features;
DROP POLICY IF EXISTS "game_features_insert_own" ON game_features;
DROP POLICY IF EXISTS "game_features_update_own" ON game_features;
DROP POLICY IF EXISTS "game_features_delete_own" ON game_features;

-- ============================================================================
-- 2. GAMES TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own games
CREATE POLICY "games_select_own" ON games
    FOR SELECT
    USING (auth.uid()::text = user_id);

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
-- 3. USER_PROFILES TABLE RLS POLICIES
-- ============================================================================

-- Users can view all profiles (for search functionality)
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
-- 4. GAME_ANALYSES TABLE RLS POLICIES
-- ============================================================================

-- Users can view all game analyses (for public analytics)
CREATE POLICY "game_analyses_select_all" ON game_analyses
    FOR SELECT
    USING (true);

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
-- 5. MOVE_ANALYSES TABLE RLS POLICIES
-- ============================================================================

-- Users can view all move analyses (for public analytics)
CREATE POLICY "move_analyses_select_all" ON move_analyses
    FOR SELECT
    USING (true);

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
-- 6. GAME_FEATURES TABLE RLS POLICIES
-- ============================================================================

-- Users can view all game features (for public analytics)
CREATE POLICY "game_features_select_all" ON game_features
    FOR SELECT
    USING (true);

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
-- These policies are automatically granted to service_role through table permissions

-- ============================================================================
-- 8. CREATE RLS POLICY VALIDATION FUNCTION
-- ============================================================================

-- Function to validate RLS policies are working correctly
-- Legacy validation/test helper functions removed in favor of consolidated schema tools.
-- See 20250102000005_schema_consolidation.sql for current integrity and RLS validation helpers.
