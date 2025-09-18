-- Create unified analyses view
-- This view merges game_analyses and move_analyses tables into a consistent format

CREATE OR REPLACE VIEW unified_analyses AS
SELECT 
    game_id,
    user_id,
    platform,
    'basic' as analysis_type,
    accuracy,
    blunders,
    mistakes,
    inaccuracies,
    brilliant_moves,
    0 as best_moves, -- Not available in game_analyses
    opening_accuracy,
    middle_game_accuracy,
    endgame_accuracy,
    tactical_score,
    positional_score,
    aggressive_score,
    patient_score,
    endgame_score,
    opening_score,
    0 as average_centipawn_loss, -- Not available in game_analyses
    0 as worst_blunder_centipawn_loss, -- Not available in game_analyses
    time_management_score,
    0 as material_sacrifices, -- Not available in game_analyses
    0 as aggressiveness_index, -- Not available in game_analyses
    average_evaluation,
    tactical_patterns,
    positional_patterns,
    strategic_themes,
    '[]'::jsonb as moves_analysis, -- Not available in game_analyses
    analysis_date,
    COALESCE(processing_time_ms, 0) as processing_time_ms,
    COALESCE(stockfish_depth, 0) as stockfish_depth
FROM game_analyses
UNION ALL
SELECT 
    game_id,
    user_id,
    platform,
    COALESCE(analysis_method, 'stockfish') as analysis_type,
    COALESCE(accuracy, best_move_percentage) as accuracy,
    -- Calculate blunders, mistakes, inaccuracies from moves_analysis JSONB
    (SELECT COUNT(*) FROM jsonb_array_elements(moves_analysis) WHERE value->>'is_blunder' = 'true') as blunders,
    (SELECT COUNT(*) FROM jsonb_array_elements(moves_analysis) WHERE value->>'is_mistake' = 'true') as mistakes,
    (SELECT COUNT(*) FROM jsonb_array_elements(moves_analysis) WHERE value->>'is_inaccuracy' = 'true') as inaccuracies,
    COALESCE(material_sacrifices, 0) as brilliant_moves,
    (SELECT COUNT(*) FROM jsonb_array_elements(moves_analysis) WHERE value->>'is_best' = 'true') as best_moves,
    -- Calculate opening accuracy from first 15 moves
    (SELECT ROUND(
        (COUNT(*) FILTER (WHERE value->>'is_best' = 'true')::FLOAT / NULLIF(COUNT(*), 0)) * 100, 1
    ) FROM jsonb_array_elements(moves_analysis) 
    WHERE (value->>'opening_ply')::INT <= 15) as opening_accuracy,
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
    COALESCE(aggressive_score, 0) as aggressiveness_index, -- Map aggressive_score to aggressiveness_index
    average_evaluation,
    tactical_patterns,
    positional_patterns,
    strategic_themes,
    moves_analysis,
    analysis_date,
    processing_time_ms,
    stockfish_depth
FROM move_analyses;

-- Create index on the view for better performance
CREATE INDEX IF NOT EXISTS idx_unified_analyses_user_platform ON unified_analyses(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_unified_analyses_analysis_date ON unified_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_analyses_analysis_type ON unified_analyses(analysis_type);

-- Grant permissions
GRANT SELECT ON unified_analyses TO authenticated;
GRANT SELECT ON unified_analyses TO anon;
