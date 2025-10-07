-- Fix user_profiles table schema to match frontend expectations
-- Add missing columns that the frontend code expects

-- Add missing columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS current_rating INTEGER DEFAULT 1200,
ADD COLUMN IF NOT EXISTS win_rate FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS most_played_time_control TEXT,
ADD COLUMN IF NOT EXISTS most_played_opening TEXT;

-- Update existing records to have default values
UPDATE user_profiles 
SET 
  display_name = COALESCE(display_name, username, user_id),
  last_accessed = COALESCE(last_accessed, created_at),
  current_rating = COALESCE(current_rating, rating, 1200),
  win_rate = COALESCE(win_rate, 0.0)
WHERE display_name IS NULL OR last_accessed IS NULL OR current_rating IS NULL OR win_rate IS NULL;

-- Add constraints (drop first if they exist)
DO $$
BEGIN
  -- Add win_rate constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_win_rate_check'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_win_rate_check 
    CHECK (win_rate >= 0.0 AND win_rate <= 1.0);
  END IF;

  -- Add current_rating constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_current_rating_check'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_current_rating_check 
    CHECK (current_rating > 0 AND current_rating < 4000);
  END IF;
END $$;

-- Create index on last_accessed for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_accessed 
ON user_profiles(last_accessed DESC);

-- Update RLS policies to allow anonymous access to new columns
DROP POLICY IF EXISTS "Allow anonymous insert to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous update to user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anonymous select from user_profiles" ON user_profiles;

CREATE POLICY "Allow anonymous access to user_profiles" ON user_profiles
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON user_profiles TO anon;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;
