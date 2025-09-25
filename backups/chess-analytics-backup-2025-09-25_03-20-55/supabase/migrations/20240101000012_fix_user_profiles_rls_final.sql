-- Final fix for user_profiles RLS policies
-- Ensure anonymous users can insert and update profiles

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous insert to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous update to user_profiles" ON user_profiles;
-- Create new policies that allow anonymous access
CREATE POLICY "Allow all users to view profiles" ON user_profiles
  FOR SELECT USING (true);
CREATE POLICY "Allow all users to insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all users to update profiles" ON user_profiles
  FOR UPDATE USING (true);
-- Ensure proper permissions
GRANT ALL ON user_profiles TO anon;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;
