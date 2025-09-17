-- Fix RLS policy for user_profiles to allow anonymous access for development
-- This allows the frontend to create user profiles without authentication

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Users can insert own profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profiles" ON user_profiles;

-- Create new policies that allow anonymous access for development
CREATE POLICY "Allow anonymous insert to user_profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update to user_profiles" ON user_profiles
  FOR UPDATE USING (true);

-- Grant permissions to anon role
GRANT ALL ON user_profiles TO anon;
