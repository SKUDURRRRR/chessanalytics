-- Migration: Normalize Lichess usernames to lowercase
-- Purpose: Lichess usernames are case-insensitive (same account), but we were storing
-- them with original casing, causing duplicate profiles (e.g. "pakrovejas69" vs "Pakrovejas69").
-- This migration lowercases all Lichess user_ids and merges duplicates.

-- Strategy for tables with unique constraints involving user_id:
--   1. Delete rows that would conflict (lowercase version already exists)
--   2. Update remaining rows to lowercase
-- For tables without unique constraints on user_id:
--   Just update to lowercase directly

BEGIN;

-- ============================================================================
-- 1. user_profiles — UNIQUE (user_id, platform)
-- Keep the profile with the most games (higher games_count), delete the other
-- ============================================================================
DELETE FROM user_profiles
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM user_profiles up2
    WHERE up2.platform = 'lichess'
      AND up2.user_id = LOWER(user_profiles.user_id)
  );

UPDATE user_profiles
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 2. games — UNIQUE (user_id, platform, provider_game_id)
-- Delete duplicate games where lowercase version already exists
-- ============================================================================
DELETE FROM games
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM games g2
    WHERE g2.platform = 'lichess'
      AND g2.provider_game_id = games.provider_game_id
      AND g2.user_id = LOWER(games.user_id)
  );

UPDATE games
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 3. games_pgn — UNIQUE (user_id, platform, provider_game_id)
-- ============================================================================
DELETE FROM games_pgn
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM games_pgn gp2
    WHERE gp2.platform = 'lichess'
      AND gp2.provider_game_id = games_pgn.provider_game_id
      AND gp2.user_id = LOWER(games_pgn.user_id)
  );

UPDATE games_pgn
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 4. game_features — UNIQUE (user_id, platform, game_id)
-- ============================================================================
DELETE FROM game_features
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM game_features gf2
    WHERE gf2.platform = 'lichess'
      AND gf2.game_id = game_features.game_id
      AND gf2.user_id = LOWER(game_features.user_id)
  );

UPDATE game_features
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 5. game_analyses — UNIQUE (user_id, platform, game_id, analysis_type)
-- ============================================================================
DELETE FROM game_analyses
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM game_analyses ga2
    WHERE ga2.platform = 'lichess'
      AND ga2.game_id = game_analyses.game_id
      AND ga2.analysis_type = game_analyses.analysis_type
      AND ga2.user_id = LOWER(game_analyses.user_id)
  );

UPDATE game_analyses
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 6. move_analyses — UNIQUE (user_id, platform, game_id, analysis_method)
-- ============================================================================
DELETE FROM move_analyses
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM move_analyses ma2
    WHERE ma2.platform = 'lichess'
      AND ma2.game_id = move_analyses.game_id
      AND ma2.analysis_method = move_analyses.analysis_method
      AND ma2.user_id = LOWER(move_analyses.user_id)
  );

UPDATE move_analyses
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 7. analysis_jobs — no unique constraint on user_id, just update
-- ============================================================================
UPDATE analysis_jobs
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 8. import_sessions — no unique constraint on user_id, just update
-- ============================================================================
UPDATE import_sessions
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

-- ============================================================================
-- 9. parity_logs — no unique constraint on user_id, just update
-- ============================================================================
UPDATE parity_logs
SET user_id = LOWER(user_id)
WHERE platform = 'lichess'
  AND user_id != LOWER(user_id);

COMMIT;
