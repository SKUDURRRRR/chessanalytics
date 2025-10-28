-- Optimize unified_analyses view for better performance with large datasets
-- This migration improves the view structure and adds necessary indexes

-- Drop the existing view
DROP VIEW IF EXISTS public.unified_analyses;
-- Create an optimized view that prioritizes game_analyses table
-- and only includes move_analyses data when absolutely necessary
CREATE VIEW public.unified_analyses AS
-- Primary data from game_analyses (most complete and recent)
SELECT
    ga.game_id,
    ga.game_id AS provider_game_id,
    ga.user_id,
    ga.platform,
    ga.analysis_type,
    ga.accuracy,
    ga.analysis_date,
    ga.blunders,
    ga.mistakes,
    ga.inaccuracies,
    ga.brilliant_moves,
    ga.best_moves,
    ga.opening_score,
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
    1 as data_source_priority  -- game_analyses has priority
FROM public.game_analyses ga

UNION ALL

-- Only include move_analyses data for games that don't exist in game_analyses
-- Use a more efficient approach with LEFT JOIN instead of NOT EXISTS
SELECT
    ma.game_id,
    ma.game_id AS provider_game_id,
    ma.user_id,
    ma.platform,
    COALESCE(ma.analysis_method, 'stockfish') AS analysis_type,
    ma.accuracy,
    ma.analysis_date,
    0 AS blunders,
    0 AS mistakes,
    0 AS inaccuracies,
    0 AS brilliant_moves,
    0 AS best_moves,
    ma.opening_score,
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
    ma.opponent_accuracy,
    ma.good_moves,
    ma.acceptable_moves,
    ma.opponent_average_centipawn_loss,
    ma.opponent_worst_blunder_centipawn_loss,
    ma.opponent_time_management_score,
    ma.average_evaluation,
    ma.processing_time_ms,
    ma.stockfish_depth,
    2 as data_source_priority  -- move_analyses has lower priority
FROM public.move_analyses ma
LEFT JOIN public.game_analyses ga2 ON (
    ga2.game_id = ma.game_id
    AND ga2.user_id = ma.user_id
    AND ga2.platform = ma.platform
)
WHERE ga2.game_id IS NULL;
-- Only include if not in game_analyses

-- Grant permissions
GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT SELECT ON public.unified_analyses TO service_role;
GRANT SELECT ON public.unified_analyses TO anon;
-- Add critical indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_analyses_user_platform
ON public.game_analyses (user_id, platform, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_unified_analyses_game_id
ON public.game_analyses (game_id, user_id, platform);
CREATE INDEX IF NOT EXISTS idx_move_analyses_user_platform_game
ON public.move_analyses (user_id, platform, game_id, analysis_date DESC);
-- Add composite index for the LEFT JOIN optimization
CREATE INDEX IF NOT EXISTS idx_move_analyses_left_join
ON public.move_analyses (game_id, user_id, platform);
-- Add index for game_analyses lookup in LEFT JOIN
CREATE INDEX IF NOT EXISTS idx_game_analyses_lookup
ON public.game_analyses (game_id, user_id, platform);
COMMENT ON VIEW public.unified_analyses IS 'Optimized unified analysis view with improved performance for large datasets. Prioritizes game_analyses data and uses efficient LEFT JOIN for move_analyses.';
