-- Migration: Fix game_features_modern view security
-- Date: 2025-10-26
-- Purpose: Change SECURITY DEFINER to SECURITY INVOKER to properly enforce RLS policies

-- Recreate the view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.game_features_modern
WITH (security_invoker = true) AS
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

  -- Modern personality scores (4 core traits + endgame + opening)
  tactical_score,
  positional_score,
  aggressive_score,
  patient_score,
  endgame_score,      -- Existing trait
  opening_score,      -- Existing trait

  -- Metadata
  created_at,
  updated_at
FROM public.game_features;

-- Re-grant permissions on the view
GRANT SELECT ON public.game_features_modern TO anon;
GRANT SELECT ON public.game_features_modern TO authenticated;
GRANT ALL ON public.game_features_modern TO service_role;

-- Add comment explaining the security model
COMMENT ON VIEW public.game_features_modern IS 'Modern personality traits view (SECURITY INVOKER). Enforces RLS policies from underlying game_features table. Includes 6 personality scores: tactical, positional, aggressive, patient, endgame, and opening.';
