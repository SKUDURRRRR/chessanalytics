-- Migration: Link Existing Tables to Authentication System
-- Date: 2025-10-30
-- Description: Adds auth_user_id to existing tables to support both anonymous and authenticated users

-- ============================================================================
-- 1. ADD AUTH_USER_ID TO EXISTING TABLES
-- ============================================================================

-- Add auth_user_id to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES authenticated_users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);

-- Add auth_user_id to games
ALTER TABLE games
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES authenticated_users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_games_auth_user_id ON games(auth_user_id);

-- Add auth_user_id to games_pgn
ALTER TABLE games_pgn
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES authenticated_users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_games_pgn_auth_user_id ON games_pgn(auth_user_id);

-- Add auth_user_id to game_analyses
ALTER TABLE game_analyses
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES authenticated_users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_game_analyses_auth_user_id ON game_analyses(auth_user_id);

-- Add auth_user_id to game_features
ALTER TABLE game_features
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES authenticated_users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_game_features_auth_user_id ON game_features(auth_user_id);

-- ============================================================================
-- 2. UPDATE RLS POLICIES TO SUPPORT BOTH ANONYMOUS AND AUTHENTICATED ACCESS
-- ============================================================================

-- USER_PROFILES: Allow both anonymous (user_id) and authenticated (auth_user_id) access

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow anonymous insert to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous update to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;

-- Create new policies supporting both modes
DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
CREATE POLICY "user_profiles_select_all" ON user_profiles
    FOR SELECT
    USING (true); -- Public read access for analytics

DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles
    FOR INSERT
    WITH CHECK (
        -- Allow anonymous inserts OR authenticated users can create
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
    FOR UPDATE
    USING (
        -- Allow anonymous updates OR authenticated users can update own data
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

-- GAMES: Similar policy structure

-- Drop existing potentially conflicting policies
DROP POLICY IF EXISTS "games_insert_own" ON games;
DROP POLICY IF EXISTS "games_update_own" ON games;
DROP POLICY IF EXISTS "games_insert_hybrid" ON games;
DROP POLICY IF EXISTS "games_update_hybrid" ON games;

-- Recreate with hybrid support
CREATE POLICY "games_insert_hybrid" ON games
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

CREATE POLICY "games_update_hybrid" ON games
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

-- GAMES_PGN: Similar policy structure

DROP POLICY IF EXISTS "games_pgn_insert_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_update_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_insert_hybrid" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_update_hybrid" ON games_pgn;

CREATE POLICY "games_pgn_insert_hybrid" ON games_pgn
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

CREATE POLICY "games_pgn_update_hybrid" ON games_pgn
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

-- GAME_ANALYSES: Similar policy structure

DROP POLICY IF EXISTS "game_analyses_insert_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_update_own" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_insert_hybrid" ON game_analyses;
DROP POLICY IF EXISTS "game_analyses_update_hybrid" ON game_analyses;

CREATE POLICY "game_analyses_insert_hybrid" ON game_analyses
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

CREATE POLICY "game_analyses_update_hybrid" ON game_analyses
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

-- GAME_FEATURES: Similar policy structure

DROP POLICY IF EXISTS "game_features_insert_own" ON game_features;
DROP POLICY IF EXISTS "game_features_update_own" ON game_features;
DROP POLICY IF EXISTS "game_features_insert_hybrid" ON game_features;
DROP POLICY IF EXISTS "game_features_update_hybrid" ON game_features;

CREATE POLICY "game_features_insert_hybrid" ON game_features
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

CREATE POLICY "game_features_update_hybrid" ON game_features
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR (auth.uid() = auth_user_id)
    );

-- ============================================================================
-- 3. HELPER FUNCTION: CLAIM ANONYMOUS DATA
-- ============================================================================

-- Function to link anonymous user data to authenticated user after registration
CREATE OR REPLACE FUNCTION claim_anonymous_data(
    p_auth_user_id UUID,
    p_platform TEXT,
    p_anonymous_user_id TEXT
)
RETURNS JSON AS $$
DECLARE
    v_games_count INTEGER;
    v_analyses_count INTEGER;
    v_profiles_count INTEGER;
BEGIN
    -- Update user_profiles
    UPDATE user_profiles
    SET auth_user_id = p_auth_user_id
    WHERE platform = p_platform
      AND user_id = p_anonymous_user_id
      AND auth_user_id IS NULL;

    GET DIAGNOSTICS v_profiles_count = ROW_COUNT;

    -- Update games
    UPDATE games
    SET auth_user_id = p_auth_user_id
    WHERE platform = p_platform
      AND user_id = p_anonymous_user_id
      AND auth_user_id IS NULL;

    GET DIAGNOSTICS v_games_count = ROW_COUNT;

    -- Update games_pgn
    UPDATE games_pgn
    SET auth_user_id = p_auth_user_id
    WHERE platform = p_platform
      AND user_id = p_anonymous_user_id
      AND auth_user_id IS NULL;

    -- Update game_analyses
    UPDATE game_analyses
    SET auth_user_id = p_auth_user_id
    WHERE platform = p_platform
      AND user_id = p_anonymous_user_id
      AND auth_user_id IS NULL;

    GET DIAGNOSTICS v_analyses_count = ROW_COUNT;

    -- Update game_features
    UPDATE game_features
    SET auth_user_id = p_auth_user_id
    WHERE platform = p_platform
      AND user_id = p_anonymous_user_id
      AND auth_user_id IS NULL;

    -- Return summary
    RETURN json_build_object(
        'success', true,
        'profiles_claimed', v_profiles_count,
        'games_claimed', v_games_count,
        'analyses_claimed', v_analyses_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_anonymous_data(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION claim_anonymous_data IS 'Links anonymous user data to authenticated user after registration';

-- ============================================================================
-- 4. HELPER FUNCTION: CHECK USER USAGE LIMITS
-- ============================================================================

-- Function to check if user has exceeded their limits
CREATE OR REPLACE FUNCTION check_usage_limits(
    p_user_id UUID,
    p_action_type TEXT -- 'import' or 'analyze'
)
RETURNS JSON AS $$
DECLARE
    v_account_tier TEXT;
    v_tier_import_limit INTEGER;
    v_tier_analysis_limit INTEGER;
    v_current_imports INTEGER := 0;
    v_current_analyses INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_can_proceed BOOLEAN := false;
    v_reason TEXT := NULL;
BEGIN
    -- Get user's account tier
    SELECT account_tier INTO v_account_tier
    FROM authenticated_users
    WHERE id = p_user_id;

    -- If user not found, they're anonymous (legacy behavior - no limits yet)
    IF NOT FOUND THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_anonymous', true,
            'reason', 'Anonymous users have temporary unlimited access'
        );
    END IF;

    -- Get tier limits
    SELECT import_limit, analysis_limit INTO v_tier_import_limit, v_tier_analysis_limit
    FROM payment_tiers
    WHERE id = v_account_tier;

    -- NULL limit means unlimited
    IF (p_action_type = 'import' AND v_tier_import_limit IS NULL) OR
       (p_action_type = 'analyze' AND v_tier_analysis_limit IS NULL) THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_unlimited', true,
            'account_tier', v_account_tier
        );
    END IF;

    -- Get current usage (within 24-hour window)
    SELECT
        COALESCE(games_imported, 0),
        COALESCE(games_analyzed, 0),
        reset_at
    INTO v_current_imports, v_current_analyses, v_reset_at
    FROM usage_tracking
    WHERE user_id = p_user_id
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    -- If no recent usage record, user can proceed
    IF NOT FOUND THEN
        v_can_proceed := true;
    ELSE
        -- Check limits
        IF p_action_type = 'import' THEN
            v_can_proceed := v_current_imports < v_tier_import_limit;
            IF NOT v_can_proceed THEN
                v_reason := format('Import limit reached: %s/%s', v_current_imports, v_tier_import_limit);
            END IF;
        ELSIF p_action_type = 'analyze' THEN
            v_can_proceed := v_current_analyses < v_tier_analysis_limit;
            IF NOT v_can_proceed THEN
                v_reason := format('Analysis limit reached: %s/%s', v_current_analyses, v_tier_analysis_limit);
            END IF;
        END IF;
    END IF;

    RETURN json_build_object(
        'can_proceed', v_can_proceed,
        'account_tier', v_account_tier,
        'current_imports', v_current_imports,
        'current_analyses', v_current_analyses,
        'import_limit', v_tier_import_limit,
        'analysis_limit', v_tier_analysis_limit,
        'reset_at', v_reset_at,
        'reason', v_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_usage_limits(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION check_usage_limits IS 'Checks if user has exceeded their usage limits (24h rolling window)';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 1. Added auth_user_id (nullable) to: user_profiles, games, games_pgn, game_analyses, game_features
-- 2. Updated RLS policies to support both anonymous and authenticated access
-- 3. Created claim_anonymous_data() function to link anonymous data after registration
-- 4. Created check_usage_limits() function to validate usage against tier limits
-- 5. All changes are backwards compatible with existing anonymous users
-- ============================================================================
