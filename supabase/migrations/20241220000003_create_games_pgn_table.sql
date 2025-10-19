-- Create games_pgn table for storing PGN data
-- This table stores the actual PGN (Portable Game Notation) data for games

CREATE TABLE IF NOT EXISTS games_pgn (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    provider_game_id TEXT NOT NULL,
    pgn TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, platform, provider_game_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_pgn_user_id ON games_pgn(user_id);
CREATE INDEX IF NOT EXISTS idx_games_pgn_platform ON games_pgn(platform);
CREATE INDEX IF NOT EXISTS idx_games_pgn_provider_game_id ON games_pgn(provider_game_id);
CREATE INDEX IF NOT EXISTS idx_games_pgn_user_platform ON games_pgn(user_id, platform);

-- Enable RLS
ALTER TABLE games_pgn ENABLE ROW LEVEL SECURITY;

-- Add is_public column for selective public access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games_pgn' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE games_pgn ADD COLUMN is_public BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_games_pgn_is_public ON games_pgn(is_public) WHERE is_public = true;
  END IF;
END $$;

-- Create RLS policies (SECURE)
DROP POLICY IF EXISTS "games_pgn_select_all" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_select_own_or_public" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_insert_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_update_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_delete_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_service_role_all" ON games_pgn;

-- Users can see their own PGN data OR explicitly public PGN
CREATE POLICY "games_pgn_select_own_or_public" ON games_pgn
    FOR SELECT
    USING (auth.uid()::text = user_id OR is_public = true);

CREATE POLICY "games_pgn_insert_own" ON games_pgn
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "games_pgn_update_own" ON games_pgn
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "games_pgn_delete_own" ON games_pgn
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- Service role can do everything
CREATE POLICY "games_pgn_service_role_all" ON games_pgn
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Grant permissions (no ALL for anon)
GRANT SELECT ON games_pgn TO anon;
GRANT ALL ON games_pgn TO authenticated;
GRANT ALL ON games_pgn TO service_role;
