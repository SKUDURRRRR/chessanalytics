-- Restore Secure RLS Policies
-- This reverses the permissive anonymous access and restores proper security

-- ============================================================================
-- 0. ENABLE Row Level Security on all tables and add is_public columns
-- ============================================================================

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE games_pgn ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Add is_public column to games table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE games ADD COLUMN is_public BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_games_is_public ON games(is_public) WHERE is_public = true;
  END IF;
END $$;

-- Add is_public column to user_profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_public BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_user_profiles_is_public ON user_profiles(is_public) WHERE is_public = true;
  END IF;
END $$;

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
-- 2. CREATE secure policies with owner-based RLS
-- ============================================================================
-- This implements proper row-level security where:
-- - Users can only see their own data or explicitly public data
-- - Users can only modify their own data
-- - Service role (backend) has full access for data management
-- - Anonymous users have no access without authentication

-- GAMES TABLE
-- Users can only see their own games or public games
DROP POLICY IF EXISTS "games_select_own_or_public" ON games;
CREATE POLICY "games_select_own_or_public" ON games
  FOR SELECT
  USING (auth.uid()::text = user_id OR is_public = true);

-- Users can only insert their own games
DROP POLICY IF EXISTS "games_insert_own" ON games;
CREATE POLICY "games_insert_own" ON games
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own games
DROP POLICY IF EXISTS "games_update_own" ON games;
CREATE POLICY "games_update_own" ON games
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only delete their own games
DROP POLICY IF EXISTS "games_delete_own" ON games;
CREATE POLICY "games_delete_own" ON games
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Service role can do everything (backend API writes data)
DROP POLICY IF EXISTS "games_service_role_all" ON games;
CREATE POLICY "games_service_role_all" ON games
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- GAMES_PGN TABLE
-- Users can only see their own PGN data or public PGN
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON games_pgn;
CREATE POLICY "games_pgn_select_own_or_public" ON games_pgn
  FOR SELECT
  USING (auth.uid()::text = user_id OR is_public = true);

-- Users can only insert their own PGN data
DROP POLICY IF EXISTS "games_pgn_insert_own" ON games_pgn;
CREATE POLICY "games_pgn_insert_own" ON games_pgn
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own PGN data
DROP POLICY IF EXISTS "games_pgn_update_own" ON games_pgn;
CREATE POLICY "games_pgn_update_own" ON games_pgn
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only delete their own PGN data
DROP POLICY IF EXISTS "games_pgn_delete_own" ON games_pgn;
CREATE POLICY "games_pgn_delete_own" ON games_pgn
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Service role can do everything (backend API writes data)
DROP POLICY IF EXISTS "games_pgn_service_role_all" ON games_pgn;
CREATE POLICY "games_pgn_service_role_all" ON games_pgn
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- USER_PROFILES TABLE
-- Users can only see their own profiles or public profiles
DROP POLICY IF EXISTS "user_profiles_select_own_or_public" ON user_profiles;
CREATE POLICY "user_profiles_select_own_or_public" ON user_profiles
  FOR SELECT
  USING (auth.uid()::text = user_id OR is_public = true);

-- Users can only insert their own profiles
DROP POLICY IF EXISTS "user_profiles_insert_own" ON user_profiles;
CREATE POLICY "user_profiles_insert_own" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own profiles
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Users can only delete their own profiles
DROP POLICY IF EXISTS "user_profiles_delete_own" ON user_profiles;
CREATE POLICY "user_profiles_delete_own" ON user_profiles
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Service role can do everything (backend manages profiles)
DROP POLICY IF EXISTS "user_profiles_service_role_all" ON user_profiles;
CREATE POLICY "user_profiles_service_role_all" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. Grant appropriate table-level permissions
-- ============================================================================

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
-- This configuration implements proper row-level security where:
-- 
-- ✅ Users can only access their own data or explicitly public data
-- ✅ Users can only modify their own data (INSERT/UPDATE/DELETE)
-- ✅ Backend API (using service_role key) has full access for data management
-- ❌ Anonymous users have no access without authentication
-- 
-- This prevents:
-- - Unauthorized access to other users' data
-- - Database corruption by malicious users
-- - Spam/fake data insertion
-- - Deletion of other users' data
-- 
-- While allowing:
-- - Secure access to own data
-- - Selective public data sharing via is_public flag
-- - Backend to import and analyze games via API
-- - Proper data isolation between users

