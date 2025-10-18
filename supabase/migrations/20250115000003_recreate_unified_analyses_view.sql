-- Recreate unified_analyses view without SECURITY DEFINER
-- This view combines data from game_analyses (priority 1) and move_analyses (priority 2)
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
    1 as data_source_priority
FROM public.game_analyses ga;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.unified_analyses TO anon;
GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT ALL ON public.unified_analyses TO service_role;
