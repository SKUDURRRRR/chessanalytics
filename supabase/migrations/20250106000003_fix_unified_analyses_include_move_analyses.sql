-- Fix unified_analyses view to include data from both game_analyses and move_analyses tables
-- This ensures that all analyzed games (regardless of which table they're stored in) are visible to the frontend

CREATE OR REPLACE VIEW public.unified_analyses AS
-- First, get data from game_analyses table
SELECT
    ga.game_id,
    ga.game_id AS provider_game_id,  -- Alias for frontend compatibility
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
    ga.stockfish_depth
FROM public.game_analyses ga

UNION ALL

-- Then, get data from move_analyses table for games not in game_analyses
SELECT
    ma.game_id,
    ma.game_id AS provider_game_id,  -- Alias for frontend compatibility
    ma.user_id,
    ma.platform,
    ma.analysis_method AS analysis_type,
    ma.accuracy,
    ma.analysis_date,
    NULL AS blunders,  -- Not available in move_analyses
    NULL AS mistakes,  -- Not available in move_analyses
    NULL AS inaccuracies,  -- Not available in move_analyses
    NULL AS brilliant_moves,  -- Not available in move_analyses
    NULL AS best_moves,  -- Not available in move_analyses
    NULL AS opening_accuracy,  -- Not available in move_analyses
    NULL AS middle_game_accuracy,  -- Not available in move_analyses
    NULL AS endgame_accuracy,  -- Not available in move_analyses
    NULL AS average_centipawn_loss,  -- Not available in move_analyses
    NULL AS worst_blunder_centipawn_loss,  -- Not available in move_analyses
    NULL AS time_management_score,  -- Not available in move_analyses
    NULL AS tactical_score,  -- Not available in move_analyses
    NULL AS positional_score,  -- Not available in move_analyses
    NULL AS aggressive_score,  -- Not available in move_analyses
    NULL AS patient_score,  -- Not available in move_analyses
    NULL AS novelty_score,  -- Not available in move_analyses
    NULL AS staleness_score,  -- Not available in move_analyses
    NULL AS tactical_patterns,  -- Not available in move_analyses
    NULL AS positional_patterns,  -- Not available in move_analyses
    NULL AS strategic_themes,  -- Not available in move_analyses
    NULL AS moves_analysis,  -- Not available in move_analyses
    NULL AS opponent_accuracy,  -- Not available in move_analyses
    NULL AS good_moves,  -- Not available in move_analyses
    NULL AS acceptable_moves,  -- Not available in move_analyses
    NULL AS opponent_average_centipawn_loss,  -- Not available in move_analyses
    NULL AS opponent_worst_blunder_centipawn_loss,  -- Not available in move_analyses
    NULL AS opponent_time_management_score,  -- Not available in move_analyses
    NULL AS average_evaluation,  -- Not available in move_analyses
    NULL AS processing_time_ms,  -- Not available in move_analyses
    NULL AS stockfish_depth  -- Not available in move_analyses
FROM public.move_analyses ma
WHERE NOT EXISTS (
    SELECT 1 FROM public.game_analyses ga2
    WHERE ga2.game_id = ma.game_id
    AND ga2.user_id = ma.user_id
    AND ga2.platform = ma.platform
);
-- Grant permissions
GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT SELECT ON public.unified_analyses TO service_role;
GRANT SELECT ON public.unified_analyses TO anon;
COMMENT ON VIEW public.unified_analyses IS 'Unified analysis view combining game_analyses and move_analyses tables to show all analyzed games.';
