-- Fix games SELECT Policy to Allow Public Read Access
-- This migration fixes the issue where the games_select policy was too restrictive
-- and prevented users from viewing analytics for other players.
--
-- The original setup had games_public_read which allowed all authenticated users
-- to read games. We consolidated this but made it too restrictive (owner-only).
-- This restores the ability to view games publicly while maintaining security
-- for write operations.

-- ============================================================================
-- Fix games SELECT Policy
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "games_select" ON public.games;
-- Create a more permissive SELECT policy that allows:
-- 1. All authenticated users to view all games (for analytics)
-- 2. Anonymous users to view all games (for public analytics)
-- This matches the original games_public_read behavior
CREATE POLICY "games_select_public" ON public.games
    FOR SELECT
    USING (true);
-- Allow all users to read games for analytics

-- Note: Write operations (INSERT, UPDATE, DELETE) remain restricted to owners
-- via games_insert_own, games_update_own, games_delete_own policies

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON POLICY "games_select_public" ON public.games IS
'Allows all users (authenticated and anonymous) to view games for analytics purposes. Write operations remain restricted to game owners.';
-- ============================================================================
-- Summary
-- ============================================================================
--
-- This fixes the console error "ELO Graph Data Quality Issues" that occurred
-- because the previous migration made games readable only by their owner.
--
-- For a chess analytics app, users need to view games of any player to display:
-- - ELO graphs
-- - Win/loss statistics
-- - Opening performance
-- - Color performance
--
-- Security is maintained because:
-- - Only owners can INSERT their own games (games_insert_own)
-- - Only owners can UPDATE their own games (games_update_own)
-- - Only owners can DELETE their own games (games_delete_own)
-- - Service role maintains full access (games_service_role_all)
-- ============================================================================;
