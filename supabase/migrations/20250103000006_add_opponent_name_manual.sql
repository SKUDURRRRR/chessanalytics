-- Manually add opponent_name field to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS opponent_name TEXT;

-- Add an index for better query performance when filtering by opponent name
CREATE INDEX IF NOT EXISTS idx_games_opponent_name ON games(opponent_name) WHERE opponent_name IS NOT NULL;

-- Add a comment to document the new field
COMMENT ON COLUMN games.opponent_name IS 'Username of the opponent player';
