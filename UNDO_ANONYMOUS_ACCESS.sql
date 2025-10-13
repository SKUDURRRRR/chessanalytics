-- ============================================================================
-- UNDO Anonymous Access and Restore Secure RLS Policies
-- ============================================================================
-- This removes the overly permissive anonymous policies and sets up
-- proper security where:
-- 1. Anyone with valid anon key can read (public analytics)
-- 2. Only service_role can write (backend operations)
-- 3. No truly anonymous access without authentication
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================================

-- Drop anonymous policies
DROP POLICY IF EXISTS "Allow anonymous access to games" ON games;
DROP POLICY IF EXISTS "Allow anonymous access to games_pgn" ON games_pgn;
DROP POLICY IF EXISTS "Allow anonymous access to user_profiles" ON user_profiles;

-- Drop any existing secure policies
DROP POLICY IF EXISTS "games_public_read" ON games;
DROP POLICY IF EXISTS "games_service_role_all" ON games;
DROP POLICY IF EXISTS "games_no_client_write" ON games;
DROP POLICY IF EXISTS "games_no_client_update" ON games;
DROP POLICY IF EXISTS "games_no_client_delete" ON games;

DROP POLICY IF EXISTS "games_pgn_public_read" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_service_role_all" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_no_client_write" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_no_client_update" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_no_client_delete" ON games_pgn;

DROP POLICY IF EXISTS "user_profiles_public_read" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role_all" ON user_profiles;

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY on all affected tables
-- ============================================================================

-- Enable RLS on all tables that will have policies
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_pgn ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE proper secure policies
-- ============================================================================

-- GAMES TABLE
-- Public read (requires anon key), service_role can do everything
CREATE POLICY "games_public_read" ON games
  FOR SELECT
  USING (true);  -- Anyone with anon key can read

CREATE POLICY "games_service_role_all" ON games
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Block direct client writes (only backend via service_role)
CREATE POLICY "games_no_client_write" ON games
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "games_no_client_update" ON games
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "games_no_client_delete" ON games
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- GAMES_PGN TABLE
-- Public read (requires anon key), service_role can do everything
CREATE POLICY "games_pgn_public_read" ON games_pgn
  FOR SELECT
  USING (true);

CREATE POLICY "games_pgn_service_role_all" ON games_pgn
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Block direct client writes
CREATE POLICY "games_pgn_no_client_write" ON games_pgn
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "games_pgn_no_client_update" ON games_pgn
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "games_pgn_no_client_delete" ON games_pgn
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- USER_PROFILES TABLE
-- Public read, users can update their own, service_role can do everything
CREATE POLICY "user_profiles_public_read" ON user_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "user_profiles_service_role_all" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. GRANT TABLE PRIVILEGES
-- ============================================================================

-- Grant SELECT to anon and authenticated for public read access
GRANT SELECT ON games TO anon, authenticated;
GRANT SELECT ON games_pgn TO anon, authenticated;
GRANT SELECT ON user_profiles TO anon, authenticated;

-- Grant ALL privileges to service_role for backend operations
GRANT ALL ON games TO service_role;
GRANT ALL ON games_pgn TO service_role;
GRANT ALL ON user_profiles TO service_role;

-- Revoke INSERT/UPDATE/DELETE from anon and authenticated (if previously granted)
-- This ensures only service_role can write data
REVOKE INSERT, UPDATE, DELETE ON games FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON games_pgn FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_profiles FROM anon, authenticated;

-- ============================================================================
-- 5. FORCE ROW LEVEL SECURITY for stricter enforcement
-- ============================================================================

-- Force RLS to ensure policies are always enforced
ALTER TABLE games FORCE ROW LEVEL SECURITY;
ALTER TABLE games_pgn FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Reload schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify policies are set correctly:

-- Check games policies
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'games'
-- ORDER BY policyname;

-- Check games_pgn policies
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'games_pgn'
-- ORDER BY policyname;

-- Check user_profiles policies
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'user_profiles'
-- ORDER BY policyname;

