-- Migration: Track which single game a free user has unlocked coach chat for.
-- Purpose: Free users get coach chat for one game (their "1 game review" credit).
-- The first chat from a free user pins a game_id; subsequent chats are
-- allowed only for that same game. Premium users ignore this column.

BEGIN;

ALTER TABLE authenticated_users
  ADD COLUMN IF NOT EXISTS coach_chat_unlocked_game_id TEXT;

COMMENT ON COLUMN authenticated_users.coach_chat_unlocked_game_id IS
  'Free-tier only: the single game_id whose coach chat has been unlocked. NULL means unused.';

COMMIT;
