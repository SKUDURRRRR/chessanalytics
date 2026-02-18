-- Migration: Fix Remaining Supabase Advisor Warnings
-- Date: 2026-02-20
-- Fixes:
--   1. game_analyses: SELECT policy uses bare auth.uid() (overwritten by remote_schema dump)
--   2. move_analyses: SELECT policy uses bare auth.uid() (overwritten by remote_schema dump)
--   3. increment_goal_progress: Ensure SET search_path = public is applied

-- ============================================================================
-- 1. game_analyses: Fix SELECT policy auth.uid() -> (select auth.uid())
-- The 20251026231203_remote_schema.sql dump recreated this policy with
-- bare auth.uid(), undoing the fix from 20251026000002.
-- ============================================================================

DROP POLICY IF EXISTS "game_analyses_select_own" ON public.game_analyses;
CREATE POLICY "game_analyses_select_own" ON public.game_analyses
    FOR SELECT
    TO public
    USING (
        (select auth.uid())::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = game_analyses.game_id
            AND games.is_public = true
        )
    );

-- ============================================================================
-- 2. move_analyses: Fix SELECT policy auth.uid() -> (select auth.uid())
-- Same issue as game_analyses - remote_schema dump overwrote the fix.
-- ============================================================================

DROP POLICY IF EXISTS "move_analyses_select_own" ON public.move_analyses;
CREATE POLICY "move_analyses_select_own" ON public.move_analyses
    FOR SELECT
    TO public
    USING (
        (select auth.uid())::text = user_id
        OR EXISTS (
            SELECT 1 FROM games
            WHERE games.provider_game_id = move_analyses.game_id
            AND games.is_public = true
        )
    );

-- ============================================================================
-- 3. increment_goal_progress: Ensure SET search_path = public
-- This was fixed in 20260219000001 but may not have been deployed.
-- CREATE OR REPLACE is safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_goal_progress(
    p_user_id UUID,
    p_plan_id UUID,
    p_goal_type TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE user_goals
    SET current_value = current_value + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND study_plan_id = p_plan_id
      AND goal_type = p_goal_type
      AND status = 'in_progress';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
