-- Create user_profiles table if it doesn't exist
-- This ensures compatibility with the existing database

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
  display_name TEXT NOT NULL,
  current_rating INTEGER DEFAULT 1200,
  total_games INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  most_played_time_control TEXT,
  most_played_opening TEXT,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Create indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform ON user_profiles(platform);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_accessed ON user_profiles(last_accessed);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profiles" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own profiles" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;
