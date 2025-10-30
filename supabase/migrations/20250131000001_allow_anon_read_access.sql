-- Migration: Allow Anonymous Read Access for Public Chess Analytics Tool
-- Date: 2025-01-31
-- Description: Grants SELECT permissions to anonymous users so they can view all chess data
--              This aligns with the public analytics tool model where anyone can view anyone's games
--              INSERT/UPDATE/DELETE remain blocked - only backend (service_role) can write

-- ============================================================================
-- GRANT SELECT PERMISSIONS TO ANONYMOUS USERS
-- ============================================================================

-- Grant SELECT on main tables
GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.games_pgn TO anon;
GRANT SELECT ON public.move_analyses TO anon;
GRANT SELECT ON public.game_analyses TO anon;
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT ON public.game_features TO anon;

-- Keep these blocked (system tables)
REVOKE ALL ON public.app_admins FROM anon;
REVOKE ALL ON public.import_sessions FROM anon;
REVOKE ALL ON public.parity_logs FROM anon;
REVOKE ALL ON public.authenticated_users FROM anon;
REVOKE ALL ON public.usage_tracking FROM anon;

-- ============================================================================
-- CREATE RLS POLICIES FOR ANONYMOUS SELECT
-- ============================================================================

-- Drop existing anonymous policies if they exist
DROP POLICY IF EXISTS "games_select_all_anon" ON public.games;
DROP POLICY IF EXISTS "games_pgn_select_all_anon" ON public.games_pgn;
DROP POLICY IF EXISTS "move_analyses_select_all_anon" ON public.move_analyses;
DROP POLICY IF EXISTS "game_analyses_select_all_anon" ON public.game_analyses;
DROP POLICY IF EXISTS "user_profiles_select_all_anon" ON public.user_profiles;
DROP POLICY IF EXISTS "game_features_select_all_anon" ON public.game_features;

-- Create policies for anonymous SELECT (read-only)
CREATE POLICY "games_select_all_anon" ON public.games
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "games_pgn_select_all_anon" ON public.games_pgn
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "move_analyses_select_all_anon" ON public.move_analyses
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "game_analyses_select_all_anon" ON public.game_analyses
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "user_profiles_select_all_anon" ON public.user_profiles
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "game_features_select_all_anon" ON public.game_features
    FOR SELECT TO anon
    USING (true);

-- ============================================================================
-- VERIFY ANONYMOUS USERS CANNOT WRITE
-- ============================================================================

-- Ensure anonymous users CANNOT write to data tables
-- (Only backend with service_role can write)
REVOKE INSERT, UPDATE, DELETE ON public.games FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.games_pgn FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.move_analyses FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.game_analyses FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.game_features FROM anon;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration enables the PUBLIC ANALYTICS TOOL model:
-- ✅ Anonymous users CAN view all chess data (SELECT)
-- ❌ Anonymous users CANNOT modify data (INSERT/UPDATE/DELETE blocked)
-- ✅ Backend (service_role) can do everything
-- ✅ Authenticated users can still access their own data
--
-- This allows visitors to:
-- 1. Search for any chess player
-- 2. Trigger backend import (backend writes with service_role)
-- 3. View imported games and analyses
-- 4. Trigger backend analysis (backend writes with service_role)
-- 5. View analysis results
--
-- Security maintained by:
-- - Only backend can write (service_role)
-- - Rate limiting on backend endpoints
-- - Anonymous users have strict rate limits
-- - System tables (admins, usage_tracking) remain protected
