-- Migration: Add game review limits for coach feature
-- Purpose: Allow free users 1 game review total. Pro users get unlimited.
-- game_reviews_used is a lifetime counter on authenticated_users (not rolling window).

BEGIN;

-- Add lifetime game review limit to payment tiers
ALTER TABLE payment_tiers
  ADD COLUMN IF NOT EXISTS coach_game_reviews_limit INTEGER;

COMMENT ON COLUMN payment_tiers.coach_game_reviews_limit IS 'Max coach game reviews total (NULL = unlimited)';

-- Free tier: 1 game review total
UPDATE payment_tiers
SET coach_game_reviews_limit = 1
WHERE id = 'free';

-- Pro tiers: unlimited
UPDATE payment_tiers
SET coach_game_reviews_limit = NULL
WHERE id IN ('pro_monthly', 'pro_yearly');

-- Add lifetime counter to authenticated_users
ALTER TABLE authenticated_users
  ADD COLUMN IF NOT EXISTS game_reviews_used INTEGER NOT NULL DEFAULT 0;

COMMIT;
