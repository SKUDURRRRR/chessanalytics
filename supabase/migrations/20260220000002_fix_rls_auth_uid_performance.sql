-- Migration: Fix RLS auth.uid() Performance (Initplan Optimization)
-- Date: 2026-02-20
-- Fixes: Replace auth.uid() with (select auth.uid()) in all RLS policies
-- that the Supabase Performance Advisor flags as "Auth RLS Initialization Plan".
-- Wrapping in SELECT causes PostgreSQL to evaluate the function once as a
-- subplan rather than once per row, significantly improving query performance.
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata

-- ============================================================================
-- 1. authenticated_users (3 policies) - uses auth.uid() = id
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON authenticated_users;
CREATE POLICY "Users can view own profile" ON authenticated_users
    FOR SELECT
    USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON authenticated_users;
CREATE POLICY "Users can update own profile" ON authenticated_users
    FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile on signup" ON authenticated_users;
CREATE POLICY "Users can insert own profile on signup" ON authenticated_users
    FOR INSERT
    WITH CHECK ((select auth.uid()) = id);

-- ============================================================================
-- 2. usage_tracking (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. user_credits (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. payment_transactions (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own transactions" ON payment_transactions;
CREATE POLICY "Users can view own transactions" ON payment_transactions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 5. analytics_events (conditional - production only, table may not exist locally)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'analytics_events' AND n.nspname = 'public'
    ) THEN
        -- Drop and recreate any user-scoped policies
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own analytics" ON public.analytics_events';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own analytics events" ON public.analytics_events';
        EXECUTE 'CREATE POLICY "Users can view own analytics events" ON public.analytics_events
            FOR SELECT
            USING ((select auth.uid()) = user_id)';
    END IF;
END $$;

-- ============================================================================
-- 6. lessons (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own lessons" ON lessons;
CREATE POLICY "Users can view own lessons" ON lessons
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 7. lesson_progress (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own lesson progress" ON lesson_progress;
CREATE POLICY "Users can manage own lesson progress" ON lesson_progress
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 8. puzzles (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own puzzles" ON puzzles;
CREATE POLICY "Users can view own puzzles" ON puzzles
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 9. puzzle_attempts (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own puzzle attempts" ON puzzle_attempts;
CREATE POLICY "Users can manage own puzzle attempts" ON puzzle_attempts
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 10. study_plans (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own study plans" ON study_plans;
CREATE POLICY "Users can manage own study plans" ON study_plans
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 11. user_goals (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own goals" ON user_goals;
CREATE POLICY "Users can manage own goals" ON user_goals
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 12. game_tags (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own game tags" ON game_tags;
CREATE POLICY "Users can manage own game tags" ON game_tags
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 13. saved_positions (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own saved positions" ON saved_positions;
CREATE POLICY "Users can manage own saved positions" ON saved_positions
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 14. opening_repertoire (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own opening repertoire" ON opening_repertoire;
CREATE POLICY "Users can manage own opening repertoire" ON opening_repertoire
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 15. user_puzzle_rating (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own puzzle rating" ON user_puzzle_rating;
CREATE POLICY "Users can view own puzzle rating" ON user_puzzle_rating
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 16. daily_challenge (1 policy - FOR ALL)
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own daily challenges" ON daily_challenge;
CREATE POLICY "Users can manage own daily challenges" ON daily_challenge
    FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- SUMMARY: Fixed 16 tables, ~20 policies
-- All auth.uid() calls now wrapped in (select auth.uid()) for initplan optimization
-- ============================================================================
