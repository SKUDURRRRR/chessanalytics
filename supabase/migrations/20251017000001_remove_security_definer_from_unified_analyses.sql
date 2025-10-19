-- Remove SECURITY DEFINER from unified_analyses view
-- This migration ensures the view is created without SECURITY DEFINER
-- to comply with Supabase security linter requirements

-- Drop the existing view if it exists
DROP VIEW IF EXISTS public.unified_analyses CASCADE;

-- Recreate the view WITH SECURITY INVOKER (removes SECURITY DEFINER)
-- This view combines data from game_analyses table
CREATE VIEW public.unified_analyses
WITH (security_invoker = true) AS
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
-- The view will respect the RLS policies of the underlying game_analyses table
GRANT SELECT ON public.unified_analyses TO anon;
GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT ALL ON public.unified_analyses TO service_role;

-- Add comment explaining the security model
COMMENT ON VIEW public.unified_analyses IS
'Unified view of game analyses. This view does NOT use SECURITY DEFINER,
so it respects the RLS policies of the underlying game_analyses table.';
