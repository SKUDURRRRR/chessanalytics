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
    worst_blunder_centipawn_loss FLOAT DEFAULT 0,
    best_move_percentage FLOAT CHECK (best_move_percentage >= 0 AND best_move_percentage <= 100),
    
    -- Detailed phase analysis from Stockfish
    middle_game_accuracy FLOAT CHECK (middle_game_accuracy >= 0 AND middle_game_accuracy <= 100),
    endgame_accuracy FLOAT CHECK (endgame_accuracy >= 0 AND endgame_accuracy <= 100),
    
    -- Advanced metrics
    time_management_score FLOAT CHECK (time_management_score >= 0 AND time_management_score <= 100),
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

-- Create a view for easy access to combined analysis data
CREATE OR REPLACE VIEW combined_game_analysis AS
SELECT 
    ga.id as basic_analysis_id,
    ga.user_id,
    ga.platform,
    ga.game_id,
    ga.total_moves,
    
    -- Basic analysis data from game_analyses
    ga.accuracy,
    ga.blunders,
    ga.mistakes,
    ga.inaccuracies,
    ga.brilliant_moves,
    ga.opening_accuracy,
    ga.middle_game_accuracy,
    ga.endgame_accuracy,
    ga.average_evaluation,
    ga.time_management_score,
    ga.tactical_patterns as basic_tactical_patterns,
    ga.positional_patterns as basic_positional_patterns,
    ga.moves_analysis as basic_moves_analysis,
    ga.tactical_score as basic_tactical_score,
    ga.positional_score as basic_positional_score,
    ga.aggressive_score as basic_aggressive_score,
    ga.patient_score as basic_patient_score,
    ga.endgame_score as basic_endgame_score,
    ga.opening_score as basic_opening_score,
    ga.analysis_date as basic_analysis_date,
    
    -- Deep analysis data from move_analyses (if available)
    ma.id as deep_analysis_id,
    ma.average_centipawn_loss,
    ma.worst_blunder_centipawn_loss,
    ma.best_move_percentage,
    ma.middle_game_accuracy as deep_middle_game_accuracy,
    ma.endgame_accuracy as deep_endgame_accuracy,
    ma.time_management_score as deep_time_management_score,
    ma.material_sacrifices,
    ma.aggressiveness_index,
    ma.average_evaluation as deep_average_evaluation,
    ma.tactical_score as deep_tactical_score,
    ma.positional_score as deep_positional_score,
    ma.aggressive_score as deep_aggressive_score,
    ma.patient_score as deep_patient_score,
    ma.endgame_score as deep_endgame_score,
    ma.opening_score as deep_opening_score,
    ma.tactical_patterns as deep_tactical_patterns,
    ma.positional_patterns as deep_positional_patterns,
    ma.strategic_themes,
    ma.moves_analysis as deep_moves_analysis,
    ma.analysis_method as deep_analysis_method,
    ma.analysis_date as deep_analysis_date,
    ma.stockfish_depth,
    ma.processing_time_ms,
    
    -- Flags
    CASE WHEN ma.id IS NOT NULL THEN true ELSE false END as has_deep_analysis,
    CASE WHEN ma.analysis_method = 'stockfish' THEN true ELSE false END as has_stockfish_analysis
    
FROM game_analyses ga
LEFT JOIN move_analyses ma ON ga.id = ma.game_analysis_id;

-- Grant permissions on the view
GRANT SELECT ON combined_game_analysis TO authenticated;
GRANT SELECT ON combined_game_analysis TO service_role;
