-- Revoke Insecure Write Permissions
-- This script revokes dangerous WRITE permissions granted to anonymous users
-- READ access is preserved (this is a public analytics tool)
-- Run this IMMEDIATELY if the insecure migrations have been applied

-- ============================================================================
-- CRITICAL: Revoke ALL from app_admins (anonymous should have ZERO access)
-- ============================================================================

REVOKE ALL ON TABLE public.app_admins FROM anon;
REVOKE ALL ON TABLE public.app_admins FROM authenticated;

-- Only service_role should access app_admins
GRANT ALL ON TABLE public.app_admins TO service_role;

-- Create RLS policy for app_admins (service role only)
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_admins_service_role_only" ON public.app_admins;
CREATE POLICY "app_admins_service_role_only" ON public.app_admins
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- Revoke dangerous function permissions from anonymous users
-- ============================================================================

REVOKE ALL ON FUNCTION public.cleanup_old_parity_logs() FROM anon;
REVOKE ALL ON FUNCTION public.upsert_games_batch(jsonb[]) FROM anon;
REVOKE ALL ON FUNCTION public.update_game_analyses_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.update_user_profile_updated_at() FROM anon;

-- Grant EXECUTE only to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.cleanup_old_parity_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_parity_logs() TO service_role;

GRANT EXECUTE ON FUNCTION public.upsert_games_batch(jsonb[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_games_batch(jsonb[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_game_analyses_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_game_analyses_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.update_user_profile_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_updated_at() TO service_role;

-- ============================================================================
-- Revoke ALL from tables and grant appropriate permissions
-- ============================================================================
-- For a PUBLIC ANALYTICS TOOL:
-- - REVOKE ALL removes write permissions (INSERT/UPDATE/DELETE)
-- - GRANT SELECT restores read access (public data)

-- GAMES table
REVOKE ALL ON TABLE public.games FROM anon;
REVOKE ALL ON TABLE public.games FROM authenticated;
GRANT SELECT ON TABLE public.games TO anon;  -- Read-only for public analytics
GRANT SELECT ON TABLE public.games TO authenticated;  -- Same as anon (public tool)
GRANT ALL ON TABLE public.games TO service_role;  -- Backend does all writes

-- GAMES_PGN table
REVOKE ALL ON TABLE public.games_pgn FROM anon;
REVOKE ALL ON TABLE public.games_pgn FROM authenticated;
GRANT SELECT ON TABLE public.games_pgn TO anon;  -- Read-only for public PGN
GRANT SELECT ON TABLE public.games_pgn TO authenticated;  -- Same as anon
GRANT ALL ON TABLE public.games_pgn TO service_role;  -- Backend does all writes

-- GAME_ANALYSES table
REVOKE ALL ON TABLE public.game_analyses FROM anon;
REVOKE ALL ON TABLE public.game_analyses FROM authenticated;
GRANT SELECT ON TABLE public.game_analyses TO anon;  -- Read-only
GRANT SELECT ON TABLE public.game_analyses TO authenticated;  -- Same as anon
GRANT ALL ON TABLE public.game_analyses TO service_role;  -- Backend does all writes

-- ANALYSIS_SUMMARY view/table
REVOKE ALL ON TABLE public.analysis_summary FROM anon;
REVOKE ALL ON TABLE public.analysis_summary FROM authenticated;
GRANT SELECT ON TABLE public.analysis_summary TO anon;  -- Read-only summary data
GRANT SELECT ON TABLE public.analysis_summary TO authenticated;  -- Same as anon
GRANT ALL ON TABLE public.analysis_summary TO service_role;  -- Backend manages

-- IMPORT_SESSIONS table (should be private)
REVOKE ALL ON TABLE public.import_sessions FROM anon;
REVOKE ALL ON TABLE public.import_sessions FROM authenticated;
GRANT ALL ON TABLE public.import_sessions TO service_role;

-- Create RLS for import_sessions (service role only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'import_sessions') THEN
    ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "import_sessions_service_role_only" ON public.import_sessions;
    CREATE POLICY "import_sessions_service_role_only" ON public.import_sessions
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- PARITY_LOGS table (should be private)
REVOKE ALL ON TABLE public.parity_logs FROM anon;
REVOKE ALL ON TABLE public.parity_logs FROM authenticated;
GRANT ALL ON TABLE public.parity_logs TO service_role;

-- Create RLS for parity_logs (service role only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'parity_logs') THEN
    ALTER TABLE public.parity_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "parity_logs_service_role_only" ON public.parity_logs;
    CREATE POLICY "parity_logs_service_role_only" ON public.parity_logs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- PARITY_LOGS sequence
REVOKE ALL ON SEQUENCE public.parity_logs_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.parity_logs_id_seq FROM authenticated;
GRANT ALL ON SEQUENCE public.parity_logs_id_seq TO service_role;

-- USER_PROFILES table (read-only for everyone, backend manages)
REVOKE ALL ON TABLE public.user_profiles FROM anon;
REVOKE ALL ON TABLE public.user_profiles FROM authenticated;
GRANT SELECT ON TABLE public.user_profiles TO anon;  -- Read-only for leaderboards
GRANT SELECT ON TABLE public.user_profiles TO authenticated;  -- Same as anon
GRANT ALL ON TABLE public.user_profiles TO service_role;  -- Backend manages profiles

-- ============================================================================
-- Verify revocations
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Permissions revoked successfully. Verify with:';
  RAISE NOTICE '  SELECT * FROM information_schema.table_privileges WHERE grantee = ''anon'';';
  RAISE NOTICE '  SELECT * FROM information_schema.routine_privileges WHERE grantee = ''anon'';';
END $$;

-- ============================================================================
-- Next steps: Apply proper RLS policies
-- ============================================================================

-- After running this script, run:
-- 1. RESTORE_SECURE_RLS_POLICIES.sql (public READ, service_role WRITE)

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- WHAT THIS SCRIPT DID
-- ============================================================================
-- ✅ Removed INSERT/UPDATE/DELETE permissions from anon and authenticated
-- ✅ Preserved SELECT (read) permissions for public analytics
-- ✅ Secured app_admins table (service_role only)
-- ✅ Secured system tables (import_sessions, parity_logs)
-- ✅ Backend (service_role) retains full control
--
-- Your public analytics app will still work:
-- ✅ Anyone can view all games and analyses
-- ✅ Backend API can import and analyze games
-- ❌ Anonymous users cannot corrupt the database

