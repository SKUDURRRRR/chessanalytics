-- Add composite indexes for common puzzle query patterns

-- Supports: SELECT * FROM puzzle_bank WHERE rating BETWEEN x AND y AND themes @> '{fork}'
-- The existing single-column indexes (idx_puzzle_bank_rating, idx_puzzle_bank_themes)
-- cannot efficiently serve queries filtering on both columns.
CREATE INDEX IF NOT EXISTS idx_puzzle_bank_rating_themes
ON puzzle_bank(rating, themes);

-- Supports: SELECT * FROM puzzle_attempts WHERE user_id = x AND puzzle_bank_id = y ORDER BY attempted_at DESC
-- The existing idx_puzzle_attempts_user_date only covers (user_id, attempted_at)
-- and idx_puzzle_attempts_bank only covers (puzzle_bank_id).
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user_bank_date
ON puzzle_attempts(user_id, puzzle_bank_id, attempted_at DESC);
