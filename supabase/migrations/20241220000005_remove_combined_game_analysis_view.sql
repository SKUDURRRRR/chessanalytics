-- Remove combined_game_analysis view
-- This view is redundant with unified_analyses and is not used in the application

-- Drop the combined_game_analysis view
DROP VIEW IF EXISTS combined_game_analysis CASCADE;
-- Add comment for documentation
COMMENT ON VIEW unified_analyses IS 'Primary unified view combining game_analyses and move_analyses data with smart merging and normalization';
