-- Migration: Add Linked Chess Accounts and Coach Limits
-- Date: 2026-02-15
-- Description: Links chess platform usernames to authenticated users,
--              adds coach feature limits to payment tiers, and coach usage tracking.

-- ============================================================================
-- 1. ADD LINKED ACCOUNT COLUMNS TO AUTHENTICATED_USERS
-- ============================================================================

ALTER TABLE authenticated_users
  ADD COLUMN IF NOT EXISTS chess_com_username TEXT,
  ADD COLUMN IF NOT EXISTS lichess_username TEXT,
  ADD COLUMN IF NOT EXISTS primary_platform TEXT CHECK (primary_platform IN ('chess.com', 'lichess')),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Indexes for looking up users by chess platform username
CREATE INDEX IF NOT EXISTS idx_authenticated_users_chess_com ON authenticated_users(chess_com_username);
CREATE INDEX IF NOT EXISTS idx_authenticated_users_lichess ON authenticated_users(lichess_username);

COMMENT ON COLUMN authenticated_users.chess_com_username IS 'Linked Chess.com username';
COMMENT ON COLUMN authenticated_users.lichess_username IS 'Linked Lichess username';
COMMENT ON COLUMN authenticated_users.primary_platform IS 'User preferred chess platform for default data lookup';
COMMENT ON COLUMN authenticated_users.onboarding_completed IS 'Whether user has completed the account setup flow';

-- ============================================================================
-- 2. ADD COACH LIMITS TO PAYMENT_TIERS
-- ============================================================================

ALTER TABLE payment_tiers
  ADD COLUMN IF NOT EXISTS coach_lessons_limit INTEGER,
  ADD COLUMN IF NOT EXISTS coach_puzzles_daily_limit INTEGER;

COMMENT ON COLUMN payment_tiers.coach_lessons_limit IS 'Max coach lessons per week (NULL = unlimited)';
COMMENT ON COLUMN payment_tiers.coach_puzzles_daily_limit IS 'Max coach puzzles per day (NULL = unlimited)';

-- Free tier: limited coach access
UPDATE payment_tiers
SET coach_lessons_limit = 1,
    coach_puzzles_daily_limit = 3,
    features = '["5 game analyses per day", "100 game imports per day", "1 coach lesson per week", "3 coach puzzles per day", "Basic analytics"]'::jsonb
WHERE id = 'free';

-- Pro tiers: unlimited coach access
UPDATE payment_tiers
SET coach_lessons_limit = NULL,
    coach_puzzles_daily_limit = NULL
WHERE id IN ('pro_monthly', 'pro_yearly');

-- ============================================================================
-- 3. ADD COACH USAGE TRACKING
-- ============================================================================

ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS coach_lessons_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coach_puzzles_used INTEGER DEFAULT 0;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 1. authenticated_users: chess_com_username, lichess_username, primary_platform, onboarding_completed
-- 2. payment_tiers: coach_lessons_limit, coach_puzzles_daily_limit
-- 3. usage_tracking: coach_lessons_used, coach_puzzles_used
-- ============================================================================
