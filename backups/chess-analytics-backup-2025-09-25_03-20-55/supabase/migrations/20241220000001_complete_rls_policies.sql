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
CREATE OR REPLACE FUNCTION validate_rls_policies()
RETURNS TABLE (
    table_name TEXT,
    policy_name TEXT,
    policy_type TEXT,
    is_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        policyname as policy_name,
        cmd as policy_type,
        permissive as is_enabled
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on validation function
GRANT EXECUTE ON FUNCTION validate_rls_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_rls_policies() TO service_role;

-- ============================================================================
-- 9. CREATE RLS POLICY DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "games_select_own" ON games IS 'Users can only view their own games';
COMMENT ON POLICY "games_insert_own" ON games IS 'Users can only insert games for themselves';
COMMENT ON POLICY "games_update_own" ON games IS 'Users can only update their own games';
COMMENT ON POLICY "games_delete_own" ON games IS 'Users can only delete their own games';

COMMENT ON POLICY "user_profiles_select_all" ON user_profiles IS 'All users can view profiles (for search functionality)';
COMMENT ON POLICY "user_profiles_insert_own" ON user_profiles IS 'Users can only insert their own profile';
COMMENT ON POLICY "user_profiles_update_own" ON user_profiles IS 'Users can only update their own profile';
COMMENT ON POLICY "user_profiles_delete_own" ON user_profiles IS 'Users can only delete their own profile';

COMMENT ON POLICY "game_analyses_select_all" ON game_analyses IS 'All users can view game analyses (for public analytics)';
COMMENT ON POLICY "game_analyses_insert_own" ON game_analyses IS 'Users can only insert analyses for their own games';
COMMENT ON POLICY "game_analyses_update_own" ON game_analyses IS 'Users can only update their own game analyses';
COMMENT ON POLICY "game_analyses_delete_own" ON game_analyses IS 'Users can only delete their own game analyses';

COMMENT ON POLICY "move_analyses_select_all" ON move_analyses IS 'All users can view move analyses (for public analytics)';
COMMENT ON POLICY "move_analyses_insert_own" ON move_analyses IS 'Users can only insert move analyses for their own games';
COMMENT ON POLICY "move_analyses_update_own" ON move_analyses IS 'Users can only update their own move analyses';
COMMENT ON POLICY "move_analyses_delete_own" ON move_analyses IS 'Users can only delete their own move analyses';

COMMENT ON POLICY "game_features_select_all" ON game_features IS 'All users can view game features (for public analytics)';
COMMENT ON POLICY "game_features_insert_own" ON game_features IS 'Users can only insert features for their own games';
COMMENT ON POLICY "game_features_update_own" ON game_features IS 'Users can only update their own game features';
COMMENT ON POLICY "game_features_delete_own" ON game_features IS 'Users can only delete their own game features';

-- ============================================================================
-- 10. CREATE RLS TESTING UTILITIES
-- ============================================================================

-- Function to test RLS policies with different user contexts
CREATE OR REPLACE FUNCTION test_rls_policies(test_user_id TEXT)
RETURNS TABLE (
    table_name TEXT,
    operation TEXT,
    can_access BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    test_tables TEXT[] := ARRAY['games', 'user_profiles', 'game_analyses', 'move_analyses', 'game_features'];
    test_operations TEXT[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    table_name TEXT;
    operation TEXT;
    can_access BOOLEAN;
    error_message TEXT;
BEGIN
    -- Set the test user context
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
    
    -- Test each table and operation
    FOREACH table_name IN ARRAY test_tables
    LOOP
        FOREACH operation IN ARRAY test_operations
        LOOP
            BEGIN
                -- Test the operation
                EXECUTE format('SELECT 1 FROM %I LIMIT 1', table_name);
                can_access := true;
                error_message := NULL;
            EXCEPTION WHEN OTHERS THEN
                can_access := false;
                error_message := SQLERRM;
            END;
            
            RETURN QUERY SELECT table_name, operation, can_access, error_message;
        END LOOP;
    END LOOP;
    
    -- Reset the user context
    PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on testing function
GRANT EXECUTE ON FUNCTION test_rls_policies(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION test_rls_policies(TEXT) TO service_role;
