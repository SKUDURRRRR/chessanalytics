-- Fix RLS policies for games table to allow anonymous access
-- This allows the frontend to read games without authentication

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can see their own games" ON games;

-- Create new policies that allow anonymous access for development
CREATE POLICY "Allow anonymous access to games" ON games
  FOR ALL USING (true);

-- Grant permissions to anon role
GRANT ALL ON games TO anon;
GRANT ALL ON games TO authenticated;
GRANT ALL ON games TO service_role;

-- Also ensure user_profiles has proper anon access
GRANT ALL ON user_profiles TO anon;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;
