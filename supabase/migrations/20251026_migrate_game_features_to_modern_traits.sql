-- Migration: Update game_features table to use modern personality traits
-- Date: 2025-10-26
-- Purpose: Replace deprecated endgame_score/opening_score with novelty_score/staleness_score

-- Step 1: Add new columns for modern traits
ALTER TABLE public.game_features
  ADD COLUMN IF NOT EXISTS novelty_score REAL DEFAULT 50
    CHECK (novelty_score >= 0 AND novelty_score <= 100),
  ADD COLUMN IF NOT EXISTS staleness_score REAL DEFAULT 50
    CHECK (staleness_score >= 0 AND staleness_score <= 100);

-- Step 2: Migrate existing data (if any)
-- Note: Since endgame_score and opening_score don't directly map to novelty/staleness,
-- we'll preserve the old columns temporarily and set new ones to neutral (50)
UPDATE public.game_features
SET
  novelty_score = 50.0,
  staleness_score = 50.0
WHERE novelty_score IS NULL OR staleness_score IS NULL;

-- Step 3: Add comments for clarity
COMMENT ON COLUMN public.game_features.novelty_score IS 'Creativity and variety in play (0-100, 50 = neutral). Replaced opening_score in v2.0.';
COMMENT ON COLUMN public.game_features.staleness_score IS 'Tendency toward repetitive patterns (0-100, 50 = neutral). Replaced endgame_score in v2.0.';
COMMENT ON COLUMN public.game_features.endgame_score IS 'DEPRECATED: Use patient_score + positional_score for endgame evaluation. Will be removed in future version.';
COMMENT ON COLUMN public.game_features.opening_score IS 'DEPRECATED: Use novelty_score + tactical_score for opening evaluation. Will be removed in future version.';

-- Step 4: Update the index to include new columns
DROP INDEX IF EXISTS idx_game_features_scores;
CREATE INDEX idx_game_features_scores ON public.game_features (
  tactical_score,
  positional_score,
  aggressive_score,
  patient_score,
  novelty_score,      -- New
  staleness_score,    -- New
  endgame_score,      -- Keep for backward compatibility (temporary)
  opening_score       -- Keep for backward compatibility (temporary)
);

-- Step 5: Create a view that shows only modern traits
CREATE OR REPLACE VIEW public.game_features_modern AS
SELECT
  id,
  user_id,
  platform,
  game_id,

  -- Move statistics
  forcing_rate,
  quiet_rate,
  early_queen,
  castle_move,
  opposite_castle,
  long_game,
  piece_trades_early,

  -- Advanced features
  sac_events,
  king_attack_moves,
  double_checks,
  first_to_give_check,
  non_pawn_developments,
  minor_developments,
  castled_by_move_10,

  -- Game phases
  opening_ply,
  total_moves,
  queenless,
  quiet_move_streaks,

  -- Endgame features
  queenless_conv,
  rook_endgames,
  endgame_reach,

  -- Modern personality scores (6 traits)
  tactical_score,
  positional_score,
  aggressive_score,
  patient_score,
  novelty_score,      -- Modern trait
  staleness_score,    -- Modern trait

  -- Metadata
  created_at,
  updated_at
FROM public.game_features;

-- Step 6: Grant permissions on the new view
GRANT SELECT ON public.game_features_modern TO anon;
GRANT SELECT ON public.game_features_modern TO authenticated;
GRANT ALL ON public.game_features_modern TO service_role;

-- Step 7: Add migration metadata
COMMENT ON TABLE public.game_features IS 'Game feature extraction for personality analysis. Schema updated 2025-10-26 to include modern personality traits (novelty/staleness). Legacy columns (endgame_score/opening_score) deprecated but retained for backward compatibility.';

-- Migration Notes:
-- - This is a NON-BREAKING migration
-- - Old columns (endgame_score, opening_score) are preserved for backward compatibility
-- - New columns (novelty_score, staleness_score) are added with default values
-- - Applications should transition to using game_features_modern view
-- - Future migration (v3.0) will remove deprecated columns entirely

-- To complete the migration in the future (breaking change):
-- DROP COLUMN endgame_score, DROP COLUMN opening_score
