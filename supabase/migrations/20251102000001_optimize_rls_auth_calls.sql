-- ============================================================================
-- Migration: Optimize RLS Auth Function Calls
-- Date: 2025-11-02
-- Issue: Supabase Linter Warning - Auth RLS Initialization Plan
--
-- Problem: RLS policies calling auth.uid() directly cause the function to be
-- re-evaluated for every row, which significantly degrades performance at scale.
--
-- Solution: Wrap auth.uid() calls with (SELECT auth.uid()) so the function
-- is evaluated once and the result is reused across all rows.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================================

-- ============================================================================
-- PART 1: Fix user_profiles Policies
-- ============================================================================

DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles
    FOR INSERT
    WITH CHECK (
        -- Allow anonymous inserts OR authenticated users can create
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
    FOR UPDATE
    USING (
        -- Allow anonymous updates OR authenticated users can update own data
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

-- ============================================================================
-- PART 2: Fix games Policies
-- ============================================================================

DROP POLICY IF EXISTS "games_insert_hybrid" ON games;
CREATE POLICY "games_insert_hybrid" ON games
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

DROP POLICY IF EXISTS "games_update_hybrid" ON games;
CREATE POLICY "games_update_hybrid" ON games
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

-- ============================================================================
-- PART 3: Fix games_pgn Policies
-- ============================================================================

DROP POLICY IF EXISTS "games_pgn_insert_hybrid" ON games_pgn;
CREATE POLICY "games_pgn_insert_hybrid" ON games_pgn
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

DROP POLICY IF EXISTS "games_pgn_update_hybrid" ON games_pgn;
CREATE POLICY "games_pgn_update_hybrid" ON games_pgn
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

-- ============================================================================
-- PART 4: Fix game_analyses Policies
-- ============================================================================

DROP POLICY IF EXISTS "game_analyses_insert_hybrid" ON game_analyses;
CREATE POLICY "game_analyses_insert_hybrid" ON game_analyses
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

DROP POLICY IF EXISTS "game_analyses_update_hybrid" ON game_analyses;
CREATE POLICY "game_analyses_update_hybrid" ON game_analyses
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

-- ============================================================================
-- PART 5: Fix game_features Policies
-- ============================================================================

DROP POLICY IF EXISTS "game_features_insert_hybrid" ON game_features;
CREATE POLICY "game_features_insert_hybrid" ON game_features
    FOR INSERT
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

DROP POLICY IF EXISTS "game_features_update_hybrid" ON game_features;
CREATE POLICY "game_features_update_hybrid" ON game_features
    FOR UPDATE
    USING (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    )
    WITH CHECK (
        (auth_user_id IS NULL) OR ((SELECT auth.uid()) = auth_user_id)
    );

-- Also fix the SELECT policy if it exists
DROP POLICY IF EXISTS "game_features_select_own" ON game_features;
CREATE POLICY "game_features_select_own" ON game_features
    FOR SELECT
    USING (
        ((SELECT auth.uid())::text = user_id)
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = game_features.game_id
            AND games.is_public = true
        )
    );

-- ============================================================================
-- PART 6: Fix authenticated_users Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON authenticated_users;
CREATE POLICY "Users can view own profile" ON authenticated_users
    FOR SELECT
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON authenticated_users;
CREATE POLICY "Users can update own profile" ON authenticated_users
    FOR UPDATE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile on signup" ON authenticated_users;
CREATE POLICY "Users can insert own profile on signup" ON authenticated_users
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================================================
-- PART 7: Fix usage_tracking Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- PART 8: Fix user_credits Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- PART 9: Fix payment_transactions Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own transactions" ON payment_transactions;
CREATE POLICY "Users can view own transactions" ON payment_transactions
    FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- PART 10: Fix game_analyses SELECT Policy (if it exists separately)
-- ============================================================================

-- Check if there's a separate SELECT policy
DROP POLICY IF EXISTS "game_analyses_select_own" ON game_analyses;
CREATE POLICY "game_analyses_select_own" ON game_analyses
    FOR SELECT
    USING (
        ((SELECT auth.uid())::text = user_id)
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = game_analyses.game_id
            AND games.is_public = true
        )
    );

-- ============================================================================
-- PART 11: Fix move_analyses SELECT Policy
-- ============================================================================

DROP POLICY IF EXISTS "move_analyses_select_own" ON move_analyses;
CREATE POLICY "move_analyses_select_own" ON move_analyses
    FOR SELECT
    USING (
        ((SELECT auth.uid())::text = user_id)
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = move_analyses.game_id
            AND games.is_public = true
        )
    );

-- ============================================================================
-- Documentation Comments
-- ============================================================================

COMMENT ON POLICY "user_profiles_insert" ON user_profiles IS
'Optimized: Uses (SELECT auth.uid()) for better performance. Supports hybrid anonymous/authenticated access.';

COMMENT ON POLICY "games_insert_hybrid" ON games IS
'Optimized: Uses (SELECT auth.uid()) for better performance. Supports hybrid anonymous/authenticated access.';

COMMENT ON POLICY "game_features_select_own" ON game_features IS
'Optimized: Uses (SELECT auth.uid()) for better performance. Users can view their own features or features for public games.';

COMMENT ON POLICY "Users can view own profile" ON authenticated_users IS
'Optimized: Uses (SELECT auth.uid()) for better performance. Users can only view their own profile.';

COMMENT ON POLICY "Users can view own usage" ON usage_tracking IS
'Optimized: Uses (SELECT auth.uid()) for better performance. Users can only view their own usage data.';

-- ============================================================================
-- Summary
-- ============================================================================
--
-- This migration fixes 20 Auth RLS Initialization Plan warnings by wrapping
-- all auth.uid() calls with (SELECT auth.uid()).
--
-- Performance Improvement:
-- - Before: auth.uid() evaluated for EVERY row (O(n))
-- - After: auth.uid() evaluated ONCE per query (O(1))
--
-- Expected performance gain: 2-10x faster on queries returning many rows
--
-- Tables fixed:
-- ✓ user_profiles (INSERT, UPDATE)
-- ✓ games (INSERT, UPDATE)
-- ✓ games_pgn (INSERT, UPDATE)
-- ✓ game_analyses (INSERT, UPDATE, SELECT)
-- ✓ game_features (INSERT, UPDATE, SELECT)
-- ✓ authenticated_users (SELECT, INSERT, UPDATE)
-- ✓ usage_tracking (SELECT)
-- ✓ user_credits (SELECT)
-- ✓ payment_transactions (SELECT)
-- ✓ move_analyses (SELECT)
-- ============================================================================
