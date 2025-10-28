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
-- Create RLS policies
DROP POLICY IF EXISTS "games_pgn_select_all" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_insert_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_update_own" ON games_pgn;
DROP POLICY IF EXISTS "games_pgn_delete_own" ON games_pgn;
CREATE POLICY "games_pgn_select_all" ON games_pgn
    FOR SELECT
    USING (true);
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
-- Grant permissions
GRANT ALL ON games_pgn TO authenticated;
GRANT ALL ON games_pgn TO service_role;
GRANT ALL ON games_pgn TO anon;
