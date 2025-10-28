-- Fix RLS policies to use correct column name (provider_game_id instead of game_id)
-- This fixes the policies created in 20241220000001_complete_rls_policies_SECURE.sql

-- ============================================================================
-- Ensure is_public column exists (might be missing on remote)
-- ============================================================================

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
-- ============================================================================
-- Fix GAME_ANALYSES policies
-- ============================================================================

DROP POLICY IF EXISTS "game_analyses_select_own" ON game_analyses;
CREATE POLICY "game_analyses_select_own" ON game_analyses
    FOR SELECT
    USING (
        auth.uid()::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = game_analyses.game_id
            AND games.is_public = true
        )
    );
-- ============================================================================
-- Fix MOVE_ANALYSES policies
-- ============================================================================

DROP POLICY IF EXISTS "move_analyses_select_own" ON move_analyses;
CREATE POLICY "move_analyses_select_own" ON move_analyses
    FOR SELECT
    USING (
        auth.uid()::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = move_analyses.game_id
            AND games.is_public = true
        )
    );
-- ============================================================================
-- Fix GAME_FEATURES policies
-- ============================================================================

DROP POLICY IF EXISTS "game_features_select_own" ON game_features;
CREATE POLICY "game_features_select_own" ON game_features
    FOR SELECT
    USING (
        auth.uid()::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = game_features.game_id
            AND games.is_public = true
        )
    );
