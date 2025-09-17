-- Fix RLS policy to allow unauthenticated access for development
-- This allows the frontend to see all games without authentication

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can see their own games" ON games;

-- Create a new policy that allows everyone to see all games (for development)
CREATE POLICY "Allow all access to games" ON games
  FOR ALL USING (true);

-- Grant permissions to anon role
GRANT ALL ON games TO anon;
