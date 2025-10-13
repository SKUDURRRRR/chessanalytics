-- Restore Secure RLS Policies
-- This reverses the permissive anonymous access and restores proper security

-- ============================================================================
-- 0. ENABLE Row Level Security on all tables
-- ============================================================================

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_pgn ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. DROP the old insecure policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow anonymous access to games" ON games;
DROP POLICY IF EXISTS "Allow anonymous access to games_pgn" ON games_pgn;
DROP POLICY IF EXISTS "Allow anonymous access to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "games_select_own_or_public" ON games;
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON games_pgn;
DROP POLICY IF EXISTS "games_select_all" ON games;
DROP POLICY IF EXISTS "games_pgn_select_all" ON games_pgn;
DROP POLICY IF EXISTS "Allow all access to games" ON games;

-- ============================================================================
-- 2. CREATE secure policies for PUBLIC ANALYTICS APP
-- ============================================================================
-- This is a public analytics tool where:
-- - Anyone can VIEW all games and data (public read access)
-- - Only backend (service_role) can INSERT/UPDATE/DELETE data
-- - This prevents anonymous users from corrupting the database

-- GAMES TABLE
-- Everyone can READ all games (public analytics app)
CREATE POLICY "games_select_all" ON games
  FOR SELECT
  USING (true);  -- Public read access - anyone can view any game

-- Service role can do everything (backend API writes data)
CREATE POLICY "games_service_role_all" ON games
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- GAMES_PGN TABLE
-- Everyone can READ all PGN data (public analytics app)
CREATE POLICY "games_pgn_select_all" ON games_pgn
  FOR SELECT
  USING (true);  -- Public read access - anyone can view any PGN

-- Service role can do everything (backend API writes data)
CREATE POLICY "games_pgn_service_role_all" ON games_pgn
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- USER_PROFILES TABLE
-- Everyone can READ all profiles (for leaderboards, player search, etc.)
DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
CREATE POLICY "user_profiles_select_all" ON user_profiles
  FOR SELECT
  USING (true);  -- Public read access

-- Service role can do everything (backend manages profiles)
CREATE POLICY "user_profiles_service_role_all" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. Grant appropriate table-level permissions
-- ============================================================================

-- Anonymous: SELECT only (read-only access to public data)
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
-- SECURITY MODEL SUMMARY
-- ============================================================================
-- This configuration is for a PUBLIC ANALYTICS TOOL where:
-- 
-- ✅ Anyone can view all chess games and analyses (public data)
-- ✅ Backend API (using service_role key) handles all data writes
-- ❌ Anonymous users cannot directly INSERT/UPDATE/DELETE in database
-- 
-- This prevents:
-- - Database corruption by malicious users
-- - Spam/fake data insertion
-- - Deletion of legitimate data
-- 
-- While allowing:
-- - Public access to all chess analytics
-- - Backend to import and analyze games via API
-- - Fast read queries without authentication overhead

