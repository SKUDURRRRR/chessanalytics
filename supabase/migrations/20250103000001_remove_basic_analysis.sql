-- Remove basic analysis support from database schema
-- This migration removes 'basic' from analysis_type constraints and updates defaults

-- Update analysis_jobs table to remove 'basic' from analysis_type constraint
ALTER TABLE public.analysis_jobs DROP CONSTRAINT IF EXISTS analysis_jobs_analysis_type_check;
ALTER TABLE public.analysis_jobs ADD CONSTRAINT analysis_jobs_analysis_type_check
    CHECK (analysis_type IN ('stockfish','deep'));
-- Update game_analyses table default to 'stockfish' instead of 'basic'
ALTER TABLE public.game_analyses ALTER COLUMN analysis_type SET DEFAULT 'stockfish';
-- Update unified_analyses view to use 'stockfish' as default instead of 'basic'
-- Must match the column order from 20250102000005_schema_consolidation.sql
DROP VIEW IF EXISTS public.unified_analyses;
CREATE VIEW public.unified_analyses AS
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
FROM public.game_analyses ga;
-- Grant permissions
GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT SELECT ON public.unified_analyses TO service_role;
GRANT SELECT ON public.unified_analyses TO anon;
COMMENT ON VIEW public.unified_analyses IS 'Canonical analysis view from game_analyses with provider_game_id alias for frontend matching.';
-- Add comment explaining the change
COMMENT ON COLUMN public.game_analyses.analysis_type IS 'Analysis type: stockfish or deep (basic analysis removed)';
COMMENT ON COLUMN public.analysis_jobs.analysis_type IS 'Analysis type: stockfish or deep (basic analysis removed)';
