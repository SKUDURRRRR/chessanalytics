-- Remove basic analysis support from database schema
-- This migration removes 'basic' from analysis_type constraints and updates defaults

-- Update analysis_jobs table to remove 'basic' from analysis_type constraint
ALTER TABLE public.analysis_jobs DROP CONSTRAINT IF EXISTS analysis_jobs_analysis_type_check;
ALTER TABLE public.analysis_jobs ADD CONSTRAINT analysis_jobs_analysis_type_check 
    CHECK (analysis_type IN ('stockfish','deep'));

-- Update game_analyses table default to 'stockfish' instead of 'basic'
ALTER TABLE public.game_analyses ALTER COLUMN analysis_type SET DEFAULT 'stockfish';

-- Update unified_analyses view to use 'stockfish' as default instead of 'basic'
CREATE OR REPLACE VIEW public.unified_analyses AS
SELECT 
    ga.id,
    ga.user_id,
    ga.platform,
    COALESCE(ga.analysis_type, 'stockfish') AS analysis_type,
    ga.accuracy,
    ga.analysis_date,
    ga.blunders,
    ga.mistakes,
    ga.inaccuracies,
    ga.brilliant_moves,
    ga.best_moves,
    ga.opening_accuracy,
    ga.middle_game_accuracy,
    ga.endgame_accuracy,
    ga.average_centipawn_loss,
    ga.worst_blunder_centipawn_loss,
    ga.time_management_score,
    ga.tactical_score,
    ga.positional_score,
    ga.aggressive_score,
    ga.patient_score,
    ga.novelty_score,
    ga.staleness_score,
    ga.tactical_patterns,
    ga.positional_patterns,
    ga.strategic_themes,
    ga.moves_analysis,
    ga.opponent_accuracy,
    ga.good_moves,
    ga.acceptable_moves,
    ga.opponent_average_centipawn_loss,
    ga.opponent_worst_blunder_centipawn_loss,
    ga.opponent_time_management_score,
    ga.average_evaluation,
    ga.processing_time_ms,
    ga.stockfish_depth,
    ga.total_moves,
    ga.created_at,
    ga.updated_at
FROM public.game_analyses ga
UNION ALL
SELECT 
    ma.id,
    ma.user_id,
    ma.platform,
    COALESCE(ma.analysis_method, 'stockfish') AS analysis_type,
    ma.best_move_percentage AS accuracy,
    ma.analysis_date,
    0 AS blunders,  -- These fields don't exist in move_analyses
    0 AS mistakes,
    0 AS inaccuracies,
    0 AS brilliant_moves,
    0 AS best_moves,
    ma.middle_game_accuracy AS opening_accuracy,  -- Map middle_game_accuracy to opening_accuracy
    ma.middle_game_accuracy,
    ma.endgame_accuracy,
    ma.average_centipawn_loss,
    ma.worst_blunder_centipawn_loss,
    ma.time_management_score,
    ma.tactical_score,
    ma.positional_score,
    ma.aggressive_score,
    ma.patient_score,
    ma.novelty_score,
    ma.staleness_score,
    ma.tactical_patterns,
    ma.positional_patterns,
    ma.strategic_themes,
    ma.moves_analysis,
    0 AS opponent_accuracy,  -- These fields don't exist in move_analyses
    0 AS good_moves,
    0 AS acceptable_moves,
    0 AS opponent_average_centipawn_loss,
    0 AS opponent_worst_blunder_centipawn_loss,
    0 AS opponent_time_management_score,
    ma.average_evaluation,
    ma.processing_time_ms,
    ma.stockfish_depth,
    0 AS total_moves,  -- This field doesn't exist in move_analyses
    ma.created_at,
    ma.updated_at
FROM public.move_analyses ma;

-- Add comment explaining the change
COMMENT ON COLUMN public.game_analyses.analysis_type IS 'Analysis type: stockfish or deep (basic analysis removed)';
COMMENT ON COLUMN public.analysis_jobs.analysis_type IS 'Analysis type: stockfish or deep (basic analysis removed)';
