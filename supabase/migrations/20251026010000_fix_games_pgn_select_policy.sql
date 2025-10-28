-- Fix games_pgn_select Policy That References Non-Existent is_public Column
--
-- The problem: An old policy "games_pgn_select" exists that references is_public column
-- which doesn't exist in games_pgn table (it exists in games table, not games_pgn)
--
-- Solution: Drop the problematic policy and ensure the correct one is in place
--
-- Date: 2025-10-26

-- ============================================================================
-- Drop the problematic games_pgn_select policy
-- ============================================================================

-- This policy incorrectly references is_public column which doesn't exist in games_pgn
DROP POLICY IF EXISTS "games_pgn_select" ON public.games_pgn;

-- Drop other potentially conflicting policies
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_public_read" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_owner_read" ON public.games_pgn;
DROP POLICY IF EXISTS "games_pgn_anon_all" ON public.games_pgn;

-- ============================================================================
-- Ensure the correct policy is in place
-- ============================================================================

-- The games_pgn_select_all policy should already exist from migration
-- 20251026000002_fix_all_supabase_linter_warnings.sql
-- But we'll ensure it exists here as a safety measure

DO $$
BEGIN
    -- Check if the policy already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'games_pgn'
        AND policyname = 'games_pgn_select_all'
    ) THEN
        -- Create the correct policy if it doesn't exist
        CREATE POLICY "games_pgn_select_all" ON public.games_pgn
            FOR SELECT
            USING (true);

        COMMENT ON POLICY "games_pgn_select_all" ON public.games_pgn IS
        'Consolidated SELECT policy: Allows all users to view PGNs for analytics. Write operations remain restricted to owners.';
    END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================
--
-- This migration fixes the error:
-- "ERROR: column "is_public" does not exist (SQLSTATE 42703)"
--
-- The games_pgn table has these columns:
-- - id, user_id, platform, provider_game_id, pgn, created_at, updated_at
--
-- It does NOT have an is_public column (that exists in the games table).
--
-- The old games_pgn_select policy was incorrectly trying to check is_public
-- on the games_pgn table, causing the migration to fail.
--
-- The new policy (games_pgn_select_all) simply allows all users to read PGNs,
-- which is appropriate for an analytics application where game data is
-- meant to be publicly viewable.
-- ============================================================================
