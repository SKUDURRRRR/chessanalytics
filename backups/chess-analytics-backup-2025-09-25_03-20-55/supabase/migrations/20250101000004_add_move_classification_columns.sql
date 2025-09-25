-- Add new move classification columns to unified_analyses table
-- These columns support the new industry-standard move classification system

-- Add new columns for detailed move classification
ALTER TABLE unified_analyses 
ADD COLUMN IF NOT EXISTS good_moves INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS acceptable_moves INTEGER DEFAULT 0;

-- Update existing records to have default values
UPDATE unified_analyses 
SET 
    good_moves = 0,
    acceptable_moves = 0
WHERE good_moves IS NULL OR acceptable_moves IS NULL;

-- Add comments to document the new columns
COMMENT ON COLUMN unified_analyses.good_moves IS 'Number of good moves (10-50 centipawn loss)';
COMMENT ON COLUMN unified_analyses.acceptable_moves IS 'Number of acceptable moves (50-100 centipawn loss)';

-- Update the view to include the new columns
CREATE OR REPLACE VIEW unified_analyses_view AS
SELECT 
    game_id,
    user_id,
    platform,
    analysis_type,
    accuracy,
    blunders,
    mistakes,
    inaccuracies,
    brilliant_moves,
    best_moves,
    good_moves,
    acceptable_moves,
    opening_accuracy,
    middle_game_accuracy,
    endgame_accuracy,
    tactical_score,
    positional_score,
    aggressive_score,
    patient_score,
    endgame_score,
    opening_score,
    average_centipawn_loss,
    worst_blunder_centipawn_loss,
    time_management_score,
    material_sacrifices,
    aggressiveness_index,
    average_evaluation,
    tactical_patterns,
    positional_patterns,
    strategic_themes,
    moves_analysis,
    analysis_date,
    processing_time_ms,
    stockfish_depth,
    created_at,
    updated_at
FROM unified_analyses;
