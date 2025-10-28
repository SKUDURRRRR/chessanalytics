-- Create move_analyses table for Stockfish analysis
-- This table stores detailed move-by-move analysis from Stockfish

CREATE TABLE move_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    game_id TEXT NOT NULL,

    -- Reference to basic analysis in game_analyses table
    game_analysis_id UUID REFERENCES game_analyses(id) ON DELETE CASCADE,

    -- Advanced accuracy metrics from Stockfish
    average_centipawn_loss FLOAT DEFAULT 0,
    opponent_average_centipawn_loss FLOAT DEFAULT 0,
    worst_blunder_centipawn_loss FLOAT DEFAULT 0,
    opponent_worst_blunder_centipawn_loss FLOAT DEFAULT 0,
    best_move_percentage FLOAT CHECK (best_move_percentage >= 0 AND best_move_percentage <= 100),
    opponent_accuracy FLOAT DEFAULT 0,
    good_moves INTEGER DEFAULT 0,
    acceptable_moves INTEGER DEFAULT 0,

    -- Detailed phase analysis from Stockfish
    middle_game_accuracy FLOAT CHECK (middle_game_accuracy >= 0 AND middle_game_accuracy <= 100),
    endgame_accuracy FLOAT CHECK (endgame_accuracy >= 0 AND endgame_accuracy <= 100),

    -- Advanced metrics
    time_management_score FLOAT CHECK (time_management_score >= 0 AND time_management_score <= 100),
    opponent_time_management_score FLOAT DEFAULT 0,
    material_sacrifices INTEGER DEFAULT 0,
    aggressiveness_index FLOAT DEFAULT 0,
    average_evaluation FLOAT,

    -- Detailed personality scores from Stockfish analysis (0-100 scale)
    tactical_score FLOAT CHECK (tactical_score >= 0 AND tactical_score <= 100),
    positional_score FLOAT CHECK (positional_score >= 0 AND positional_score <= 100),
    aggressive_score FLOAT CHECK (aggressive_score >= 0 AND aggressive_score <= 100),
    patient_score FLOAT CHECK (patient_score >= 0 AND patient_score <= 100),
    endgame_score FLOAT CHECK (endgame_score >= 0 AND endgame_score <= 100),
    opening_score FLOAT CHECK (opening_score >= 0 AND opening_score <= 100),

    -- Pattern analysis from Stockfish (JSONB for flexibility)
    tactical_patterns JSONB DEFAULT '[]',
    positional_patterns JSONB DEFAULT '[]',
    strategic_themes JSONB DEFAULT '[]',

    -- Move-by-move analysis from Stockfish (JSONB)
    moves_analysis JSONB DEFAULT '[]',

    -- Processing metadata
    analysis_method TEXT DEFAULT 'stockfish',
    stockfish_depth INTEGER DEFAULT 15,
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, platform, game_id)
);
-- Create indexes for performance
CREATE INDEX idx_move_analyses_user_platform ON move_analyses(user_id, platform);
CREATE INDEX idx_move_analyses_game_analysis_id ON move_analyses(game_analysis_id);
CREATE INDEX idx_move_analyses_personality_scores ON move_analyses(tactical_score, positional_score, aggressive_score);
CREATE INDEX idx_move_analyses_analysis_date ON move_analyses(analysis_date);
CREATE INDEX idx_move_analyses_analysis_method ON move_analyses(analysis_method);
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_move_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create trigger for updated_at
CREATE TRIGGER trigger_update_move_analyses_updated_at
  BEFORE UPDATE ON move_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_move_analyses_updated_at();
-- Enable RLS
ALTER TABLE move_analyses ENABLE ROW LEVEL SECURITY;
-- Create RLS policies
CREATE POLICY "Users can view all move analyses" ON move_analyses
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own move analyses" ON move_analyses
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own move analyses" ON move_analyses
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own move analyses" ON move_analyses
  FOR DELETE USING (auth.uid()::text = user_id);
-- Grant permissions
GRANT ALL ON move_analyses TO authenticated;
GRANT ALL ON move_analyses TO service_role;
GRANT ALL ON FUNCTION update_move_analyses_updated_at() TO authenticated;
GRANT ALL ON FUNCTION update_move_analyses_updated_at() TO service_role;
-- Note: combined_game_analysis view was removed in migration 20241220000005
-- The unified_analyses view provides better functionality and is actively used;
