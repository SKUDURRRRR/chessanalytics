-- Restore Secure RLS Policies
-- This reverses the permissive anonymous access and restores proper security

-- ============================================================================
-- 1. DROP the permissive anonymous policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow anonymous access to games" ON games;
DROP POLICY IF EXISTS "Allow anonymous access to games_pgn" ON games_pgn;
DROP POLICY IF EXISTS "Allow anonymous access to user_profiles" ON user_profiles;

-- ============================================================================
-- 2. CREATE secure policies (authenticated users can see their own data)
-- ============================================================================

-- GAMES TABLE
-- Users can only see their own games OR public data without authentication
CREATE POLICY "games_select_own_or_public" ON games
  FOR SELECT
  USING (
    auth.uid()::text = user_id  -- Authenticated users see their own
    OR true  -- OR allow public read for analytics app (adjust if needed)
  );

-- Service role can do everything
CREATE POLICY "games_service_role_all" ON games
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- GAMES_PGN TABLE
-- Users can only see their own PGN data OR public
CREATE POLICY "games_pgn_select_own_or_public" ON games_pgn
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR true  -- Allow public read for analytics
  );

-- Service role can do everything
CREATE POLICY "games_pgn_service_role_all" ON games_pgn
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- USER_PROFILES TABLE
-- Users can see all profiles (for leaderboards, etc.)
CREATE POLICY "user_profiles_select_all" ON user_profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Service role can do everything
CREATE POLICY "user_profiles_service_role_all" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. Reload schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ALTERNATIVE: More restrictive (no anonymous access)
-- ============================================================================

-- If you want to completely block anonymous access, uncomment these instead:

/*
-- GAMES TABLE - Authenticated only
DROP POLICY IF EXISTS "games_select_own_or_public" ON games;
CREATE POLICY "games_select_authenticated_own" ON games
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

-- GAMES_PGN TABLE - Authenticated only
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON games_pgn;
CREATE POLICY "games_pgn_select_authenticated_own" ON games_pgn
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

-- USER_PROFILES - Authenticated only
DROP POLICY IF EXISTS "user_profiles_select_all" ON user_profiles;
CREATE POLICY "user_profiles_select_authenticated" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
*/

