-- Migration: Normalize all usernames to lowercase
-- Purpose: Both Chess.com and Lichess usernames are case-insensitive, but some were
-- stored with mixed casing, causing duplicate profiles (e.g. "pakrovejas69" vs "Pakrovejas69").
-- This migration lowercases all user_ids and merges duplicates.

-- Strategy:
--   1. Drop FK constraints that reference games(user_id, platform, ...)
--   2. Delete duplicate rows (where lowercase version already exists) per unique constraint
--   3. Update all remaining rows to lowercase
--   4. Re-add FK constraints
--   5. Add CHECK constraints to prevent future mixed-case inserts

BEGIN;

-- ============================================================================
-- STEP 1: Drop FK constraints so updates don't fail on cross-table references
-- ============================================================================
ALTER TABLE games_pgn      DROP CONSTRAINT IF EXISTS fk_games_pgn_games;
ALTER TABLE game_analyses   DROP CONSTRAINT IF EXISTS fk_game_analyses_game;

-- ============================================================================
-- STEP 2: Delete duplicates & update — tables with unique constraints
-- For each table, delete rows where a lowercase equivalent already exists,
-- then update remaining rows to lowercase. Applies to ALL platforms.
-- ============================================================================

-- move_analyses — UNIQUE (user_id, platform, game_id, analysis_method)
DELETE FROM move_analyses t
WHERE user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM move_analyses t2
    WHERE t2.platform = t.platform
      AND t2.game_id = t.game_id
      AND t2.analysis_method = t.analysis_method
      AND t2.user_id = LOWER(t.user_id)
  );

UPDATE move_analyses
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- game_analyses — UNIQUE (user_id, platform, game_id, analysis_type)
DELETE FROM game_analyses t
WHERE user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM game_analyses t2
    WHERE t2.platform = t.platform
      AND t2.game_id = t.game_id
      AND t2.analysis_type = t.analysis_type
      AND t2.user_id = LOWER(t.user_id)
  );

UPDATE game_analyses
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- games_pgn — UNIQUE (user_id, platform, provider_game_id)
DELETE FROM games_pgn t
WHERE user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM games_pgn t2
    WHERE t2.platform = t.platform
      AND t2.provider_game_id = t.provider_game_id
      AND t2.user_id = LOWER(t.user_id)
  );

UPDATE games_pgn
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- game_features — UNIQUE (user_id, platform, game_id)
DELETE FROM game_features t
WHERE user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM game_features t2
    WHERE t2.platform = t.platform
      AND t2.game_id = t.game_id
      AND t2.user_id = LOWER(t.user_id)
  );

UPDATE game_features
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- games — UNIQUE (user_id, platform, provider_game_id)
DELETE FROM games t
WHERE user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM games t2
    WHERE t2.platform = t.platform
      AND t2.provider_game_id = t.provider_game_id
      AND t2.user_id = LOWER(t.user_id)
  );

UPDATE games
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- user_profiles — UNIQUE (user_id, platform)
DELETE FROM user_profiles t
WHERE user_id != LOWER(user_id)
  AND EXISTS (
    SELECT 1 FROM user_profiles t2
    WHERE t2.platform = t.platform
      AND t2.user_id = LOWER(t.user_id)
  );

UPDATE user_profiles
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- ============================================================================
-- STEP 3: Update tables without unique constraints on user_id
-- ============================================================================

UPDATE analysis_jobs
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

UPDATE import_sessions
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

UPDATE parity_logs
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);

-- ============================================================================
-- STEP 4: Re-add FK constraints
-- ============================================================================
ALTER TABLE games_pgn
  ADD CONSTRAINT fk_games_pgn_games
  FOREIGN KEY (user_id, platform, provider_game_id)
  REFERENCES games(user_id, platform, provider_game_id)
  ON DELETE CASCADE;

ALTER TABLE game_analyses
  ADD CONSTRAINT fk_game_analyses_game
  FOREIGN KEY (user_id, platform, game_id)
  REFERENCES games(user_id, platform, provider_game_id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 5: Prevent future non-lowercase user_ids
-- Both Chess.com and Lichess usernames are case-insensitive.
-- ============================================================================
ALTER TABLE user_profiles   ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE games            ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE games_pgn        ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE game_features    ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE game_analyses    ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE move_analyses    ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE analysis_jobs    ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE import_sessions  ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));
ALTER TABLE parity_logs      ADD CONSTRAINT chk_user_id_lowercase CHECK (user_id = LOWER(user_id));

COMMIT;
