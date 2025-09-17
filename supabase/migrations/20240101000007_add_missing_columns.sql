-- Add missing columns referenced in health checks
-- This ensures the health check queries work correctly

-- Add color column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS color TEXT CHECK (color IN ('white', 'black'));

-- Add provider_game_id column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS provider_game_id TEXT;

-- Create index for provider_game_id for better performance
CREATE INDEX IF NOT EXISTS idx_games_provider_game_id ON games(provider_game_id);

-- Create unique constraint for provider_game_id per user/platform
-- This ensures no duplicate games from the same provider
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_provider_game_per_user'
    ) THEN
        ALTER TABLE games 
        ADD CONSTRAINT unique_provider_game_per_user 
        UNIQUE (user_id, platform, provider_game_id);
    END IF;
END $$;

-- Add comments explaining the new columns
COMMENT ON COLUMN games.color IS 'Player color: white or black';
COMMENT ON COLUMN games.provider_game_id IS 'Original game ID from the chess platform (Lichess/Chess.com)';
