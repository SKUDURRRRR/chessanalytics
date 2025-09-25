-- Game features table for chess personality analysis
-- This table stores detailed personality analysis data calculated from Stockfish analysis
CREATE TABLE IF NOT EXISTS game_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chesscom')),
  game_id TEXT NOT NULL,
  
  -- Basic move statistics
  forcing_rate REAL NOT NULL DEFAULT 0,
  quiet_rate REAL NOT NULL DEFAULT 0,
  early_queen INTEGER NOT NULL DEFAULT 0,
  castle_move INTEGER NOT NULL DEFAULT 12, -- 12 = never castled
  opposite_castle BOOLEAN NOT NULL DEFAULT false,
  long_game BOOLEAN NOT NULL DEFAULT false,
  piece_trades_early INTEGER NOT NULL DEFAULT 0,
  
  -- Advanced features
  sac_events INTEGER NOT NULL DEFAULT 0,
  king_attack_moves INTEGER NOT NULL DEFAULT 0,
  double_checks INTEGER NOT NULL DEFAULT 0,
  first_to_give_check BOOLEAN NOT NULL DEFAULT false,
  non_pawn_developments INTEGER NOT NULL DEFAULT 0,
  minor_developments INTEGER NOT NULL DEFAULT 0,
  castled_by_move_10 BOOLEAN NOT NULL DEFAULT false,
  
  -- Game phases
  opening_ply INTEGER NOT NULL DEFAULT 8,
  total_moves INTEGER NOT NULL DEFAULT 0,
  queenless BOOLEAN NOT NULL DEFAULT false,
  quiet_move_streaks INTEGER NOT NULL DEFAULT 0,
  
  -- Endgame features
  queenless_conv REAL NOT NULL DEFAULT 0.5, -- Win rate in queenless positions
  rook_endgames INTEGER NOT NULL DEFAULT 0,
  endgame_reach BOOLEAN NOT NULL DEFAULT false,
  
  -- Personality scores (0-100)
  tactical_score REAL NOT NULL DEFAULT 50,
  positional_score REAL NOT NULL DEFAULT 50,
  aggressive_score REAL NOT NULL DEFAULT 50,
  patient_score REAL NOT NULL DEFAULT 50,
  endgame_score REAL NOT NULL DEFAULT 50,
  opening_score REAL NOT NULL DEFAULT 50,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, platform, game_id),
  CHECK (forcing_rate >= 0 AND forcing_rate <= 1),
  CHECK (quiet_rate >= 0 AND quiet_rate <= 1),
  CHECK (castle_move >= 1 AND castle_move <= 20),
  CHECK (opening_ply >= 0 AND opening_ply <= 30),
  CHECK (total_moves >= 0),
  CHECK (tactical_score >= 0 AND tactical_score <= 100),
  CHECK (positional_score >= 0 AND positional_score <= 100),
  CHECK (aggressive_score >= 0 AND aggressive_score <= 100),
  CHECK (patient_score >= 0 AND patient_score <= 100),
  CHECK (endgame_score >= 0 AND endgame_score <= 100),
  CHECK (opening_score >= 0 AND opening_score <= 100)
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_features_user_platform ON game_features(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_game_features_created_at ON game_features(created_at);
CREATE INDEX IF NOT EXISTS idx_game_features_scores ON game_features(tactical_score, positional_score, aggressive_score, patient_score, endgame_score, opening_score);
-- RLS policies
ALTER TABLE game_features ENABLE ROW LEVEL SECURITY;
-- Users can only see their own game features
CREATE POLICY "Users can view own game features" ON game_features
  FOR SELECT USING (auth.uid()::text = user_id);
-- Users can insert their own game features
CREATE POLICY "Users can insert own game features" ON game_features
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
-- Users can update their own game features
CREATE POLICY "Users can update own game features" ON game_features
  FOR UPDATE USING (auth.uid()::text = user_id);
-- Users can delete their own game features
CREATE POLICY "Users can delete own game features" ON game_features
  FOR DELETE USING (auth.uid()::text = user_id);
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger to automatically update updated_at
CREATE TRIGGER update_game_features_updated_at
  BEFORE UPDATE ON game_features
  FOR EACH ROW
  EXECUTE FUNCTION update_game_features_updated_at();
