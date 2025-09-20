-- Create analysis tables required by application logic

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- ---------------------------------------------------------------------------
-- Helper function for updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ---------------------------------------------------------------------------
-- game_analyses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
  game_id TEXT NOT NULL,
  total_moves INTEGER,
  accuracy REAL,
  blunders INTEGER DEFAULT 0,
  mistakes INTEGER DEFAULT 0,
  inaccuracies INTEGER DEFAULT 0,
  brilliant_moves INTEGER DEFAULT 0,
  best_moves INTEGER DEFAULT 0,
  opening_accuracy REAL,
  middle_game_accuracy REAL,
  endgame_accuracy REAL,
  average_centipawn_loss REAL,
  worst_blunder_centipawn_loss REAL,
  time_management_score REAL,
  tactical_score REAL,
  positional_score REAL,
  aggressive_score REAL,
  patient_score REAL,
  novelty_score REAL,
  staleness_score REAL,
  tactical_patterns JSONB DEFAULT '[]'::jsonb,
  positional_patterns JSONB DEFAULT '[]'::jsonb,
  strategic_themes JSONB DEFAULT '[]'::jsonb,
  moves_analysis JSONB DEFAULT '[]'::jsonb,
  average_evaluation REAL,
  analysis_type TEXT DEFAULT 'basic',
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  stockfish_depth INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform, game_id)
);
ALTER TABLE public.game_analyses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform
  ON public.game_analyses (user_id, platform);
CREATE INDEX IF NOT EXISTS idx_game_analyses_game_id
  ON public.game_analyses (game_id);
CREATE INDEX IF NOT EXISTS idx_game_analyses_analysis_type
  ON public.game_analyses (analysis_type);
DROP TRIGGER IF EXISTS trg_game_analyses_updated_at ON public.game_analyses;
CREATE TRIGGER trg_game_analyses_updated_at
  BEFORE UPDATE ON public.game_analyses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ---------------------------------------------------------------------------
-- move_analyses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.move_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
  game_id TEXT NOT NULL,
  average_centipawn_loss REAL,
  worst_blunder_centipawn_loss REAL,
  best_move_percentage REAL,
  middle_game_accuracy REAL,
  endgame_accuracy REAL,
  time_management_score REAL,
  material_sacrifices INTEGER DEFAULT 0,
  aggressiveness_index REAL,
  average_evaluation REAL,
  tactical_score REAL,
  positional_score REAL,
  aggressive_score REAL,
  patient_score REAL,
  novelty_score REAL,
  staleness_score REAL,
  tactical_patterns JSONB DEFAULT '[]'::jsonb,
  positional_patterns JSONB DEFAULT '[]'::jsonb,
  strategic_themes JSONB DEFAULT '[]'::jsonb,
  moves_analysis JSONB DEFAULT '[]'::jsonb,
  analysis_method TEXT DEFAULT 'stockfish',
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  stockfish_depth INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform, game_id)
);
ALTER TABLE public.move_analyses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_move_analyses_user_platform
  ON public.move_analyses (user_id, platform);
CREATE INDEX IF NOT EXISTS idx_move_analyses_game_id
  ON public.move_analyses (game_id);
CREATE INDEX IF NOT EXISTS idx_move_analyses_method
  ON public.move_analyses (analysis_method);
DROP TRIGGER IF EXISTS trg_move_analyses_updated_at ON public.move_analyses;
CREATE TRIGGER trg_move_analyses_updated_at
  BEFORE UPDATE ON public.move_analyses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ---------------------------------------------------------------------------
-- game_features
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
  game_id TEXT NOT NULL,
  forcing_rate REAL DEFAULT 0 CHECK (forcing_rate >= 0 AND forcing_rate <= 1),
  quiet_rate REAL DEFAULT 0 CHECK (quiet_rate >= 0 AND quiet_rate <= 1),
  early_queen INTEGER DEFAULT 0,
  castle_move INTEGER DEFAULT 12 CHECK (castle_move >= 0),
  opposite_castle BOOLEAN DEFAULT FALSE,
  long_game BOOLEAN DEFAULT FALSE,
  piece_trades_early INTEGER DEFAULT 0,
  sac_events INTEGER DEFAULT 0,
  king_attack_moves INTEGER DEFAULT 0,
  double_checks INTEGER DEFAULT 0,
  first_to_give_check BOOLEAN DEFAULT FALSE,
  non_pawn_developments INTEGER DEFAULT 0,
  minor_developments INTEGER DEFAULT 0,
  castled_by_move_10 BOOLEAN DEFAULT FALSE,
  opening_ply INTEGER DEFAULT 8 CHECK (opening_ply >= 0),
  total_moves INTEGER DEFAULT 0 CHECK (total_moves >= 0),
  queenless BOOLEAN DEFAULT FALSE,
  quiet_move_streaks INTEGER DEFAULT 0,
  queenless_conv REAL DEFAULT 0,
  rook_endgames INTEGER DEFAULT 0,
  endgame_reach BOOLEAN DEFAULT FALSE,
  tactical_score REAL DEFAULT 50,
  positional_score REAL DEFAULT 50,
  aggressive_score REAL DEFAULT 50,
  patient_score REAL DEFAULT 50,
  endgame_score REAL DEFAULT 50,
  opening_score REAL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform, game_id)
);
ALTER TABLE public.game_features ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_game_features_user_platform
  ON public.game_features (user_id, platform);
CREATE INDEX IF NOT EXISTS idx_game_features_game_id
  ON public.game_features (game_id);
CREATE INDEX IF NOT EXISTS idx_game_features_scores
  ON public.game_features (tactical_score, positional_score, aggressive_score, patient_score, endgame_score, opening_score);
DROP TRIGGER IF EXISTS trg_game_features_updated_at ON public.game_features;
CREATE TRIGGER trg_game_features_updated_at
  BEFORE UPDATE ON public.game_features
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
