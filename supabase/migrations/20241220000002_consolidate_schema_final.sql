-- Final schema consolidation migration
-- This migration ensures all tables exist and are properly configured

-- First, ensure all required tables exist
-- (The individual table creation migrations should have run first)

ALTER TABLE IF EXISTS game_analyses
  ADD COLUMN IF NOT EXISTS endgame_score REAL;
ALTER TABLE IF EXISTS game_analyses
  ADD COLUMN IF NOT EXISTS opening_score REAL;
ALTER TABLE IF EXISTS move_analyses
  ADD COLUMN IF NOT EXISTS endgame_score REAL;
ALTER TABLE IF EXISTS move_analyses
  ADD COLUMN IF NOT EXISTS opening_score REAL;
-- Note: combined_game_analysis view was removed in migration 20241220000005
-- The unified_analyses view provides better functionality and is actively used

-- Create a comprehensive user profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    username TEXT,
    rating INTEGER,
    total_games INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable RLS on user_profiles if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- Create RLS policies for user_profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view all profiles') THEN
        CREATE POLICY "Users can view all profiles" ON user_profiles
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON user_profiles
            FOR INSERT WITH CHECK (auth.uid()::text = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON user_profiles
            FOR UPDATE USING (auth.uid()::text = user_id);
    END IF;
END $$;
-- Grant permissions on user_profiles
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;
-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform ON user_profiles(platform);
-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'User profile information for different platforms';
