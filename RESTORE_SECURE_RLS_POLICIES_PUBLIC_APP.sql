-- Restore Secure RLS Policies - PUBLIC ANALYTICS APP MODEL
-- This is for a public chess analytics tool where:
-- - Anyone can view all data (public read access)
-- - Only the backend (service_role) can write data
-- - Anonymous users cannot directly insert/update/delete

-- ============================================================================
-- 0. ENABLE Row Level Security on all tables
-- ============================================================================

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_pgn ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. DROP existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow anonymous access to games" ON games;
DROP POLICY IF EXISTS "Allow anonymous access to games_pgn" ON games_pgn;
DROP POLICY IF EXISTS "Allow anonymous access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "games_select_own_or_public" ON games;
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON games_pgn;
DROP POLICY IF EXISTS "games_select_all" ON games;
DROP POLICY IF EXISTS "games_pgn_select_all" ON games_pgn;

-- ============================================================================
-- 2. CREATE secure policies for PUBLIC ANALYTICS APP
-- ============================================================================

-- GAMES TABLE
-- Everyone can READ all games (public analytics)
-- Only service_role can WRITE (backend manages data)
DROP POLICY IF EXISTS "games_select_all" ON games;
CREATE POLICY "games_select_all" ON games
  FOR SELECT
  USING (true);  -- Public read access for analytics

DROP POLICY IF EXISTS "games_insert_service" ON games;
CREATE POLICY "games_insert_service" ON games
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "games_update_service" ON games;
CREATE POLICY "games_update_service" ON games
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "games_delete_service" ON games;
CREATE POLICY "games_delete_service" ON games
  FOR DELETE
  TO service_role
  USING (true);

-- GAMES_PGN TABLE
-- Everyone can READ all PGN data
-- Only service_role can WRITE
DROP POLICY IF EXISTS "games_pgn_select_all" ON games_pgn;
CREATE POLICY "games_pgn_select_all" ON games_pgn
  FOR SELECT
  USING (true);  -- Public read access

DROP POLICY IF EXISTS "games_pgn_insert_service" ON games_pgn;
CREATE POLICY "games_pgn_insert_service" ON games_pgn
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "games_pgn_update_service" ON games_pgn;
CREATE POLICY "games_pgn_update_service" ON games_pgn
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "games_pgn_delete_service" ON games_pgn;
CREATE POLICY "games_pgn_delete_service" ON games_pgn
  FOR DELETE
  TO service_role
  USING (true);

-- USER_PROFILES TABLE
-- Everyone can READ all profiles (for search and leaderboards)
-- Only service_role can WRITE (backend manages profiles)
DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
CREATE POLICY "user_profiles_select_all" ON user_profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "user_profiles_insert_service" ON user_profiles;
CREATE POLICY "user_profiles_insert_service" ON user_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "user_profiles_update_service" ON user_profiles;
CREATE POLICY "user_profiles_update_service" ON user_profiles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "user_profiles_delete_service" ON user_profiles;
CREATE POLICY "user_profiles_delete_service" ON user_profiles
  FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- 3. Grant appropriate table-level permissions
-- ============================================================================

-- Anonymous: SELECT only (read-only access)
GRANT SELECT ON games TO anon;
GRANT SELECT ON games_pgn TO anon;
GRANT SELECT ON user_profiles TO anon;

-- Authenticated: SELECT only (same as anon for this public app)
GRANT SELECT ON games TO authenticated;
GRANT SELECT ON games_pgn TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;

-- Service role: ALL (backend needs full control)
GRANT ALL ON games TO service_role;
GRANT ALL ON games_pgn TO service_role;
GRANT ALL ON user_profiles TO service_role;

-- ============================================================================
-- 4. Reload schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- NOTES
-- ============================================================================
-- This policy model is for a PUBLIC ANALYTICS TOOL where:
-- 1. Anyone can view all chess games and analyses (public data)
-- 2. Backend API (using service_role key) handles all data writes
-- 3. Anonymous users cannot directly modify database (prevents abuse)
-- 4. Frontend calls backend API endpoints which use service_role to write data

