-- Simplified migration that definitely works
-- Wrapped in transaction for atomic execution
-- All sections execute atomically - either all succeed or all fail
--
-- SAFETY NOTES:
-- - This migration is wrapped in a single transaction
-- - If any statement fails, the entire migration will be rolled back
-- - For testing, consider using SAVEPOINT/ROLLBACK TO SAVEPOINT
-- - For psql, use: \set ON_ERROR_ROLLBACK on
-- - Example testing approach:
--   BEGIN;
--   SAVEPOINT test_migration;
--   -- run migration statements here
--   -- if errors occur, use: ROLLBACK TO SAVEPOINT test_migration;
--   -- if successful, use: RELEASE SAVEPOINT test_migration; COMMIT;

BEGIN;

-- SECTION 1: Add column
ALTER TABLE games ADD COLUMN IF NOT EXISTS opening_normalized TEXT;

-- SECTION 2: Populate for B01 (Scandinavian Defense) specifically
UPDATE games
SET opening_normalized = 'Scandinavian Defense'
WHERE opening_family = 'B01';

-- SECTION 3: Populate for other ECO codes
UPDATE games
SET opening_normalized = CASE opening_family
    -- Caro-Kann
    WHEN 'B10' THEN 'Caro-Kann Defense'
    WHEN 'B11' THEN 'Caro-Kann Defense'
    WHEN 'B12' THEN 'Caro-Kann Defense'
    WHEN 'B13' THEN 'Caro-Kann Defense'
    WHEN 'B14' THEN 'Caro-Kann Defense'
    WHEN 'B15' THEN 'Caro-Kann Defense'
    WHEN 'B16' THEN 'Caro-Kann Defense'
    WHEN 'B17' THEN 'Caro-Kann Defense'
    WHEN 'B18' THEN 'Caro-Kann Defense'
    WHEN 'B19' THEN 'Caro-Kann Defense'
    -- King's Indian
    WHEN 'E60' THEN 'King''s Indian Defense'
    WHEN 'E61' THEN 'King''s Indian Defense'
    WHEN 'E62' THEN 'King''s Indian Defense'
    WHEN 'E70' THEN 'King''s Indian Defense'
    WHEN 'E71' THEN 'King''s Indian Defense'
    WHEN 'E72' THEN 'King''s Indian Defense'
    WHEN 'E73' THEN 'King''s Indian Defense'
    WHEN 'E74' THEN 'King''s Indian Defense'
    WHEN 'E75' THEN 'King''s Indian Defense'
    WHEN 'E76' THEN 'King''s Indian Defense'
    WHEN 'E77' THEN 'King''s Indian Defense'
    WHEN 'E80' THEN 'King''s Indian Defense'
    WHEN 'E81' THEN 'King''s Indian Defense'
    WHEN 'E90' THEN 'King''s Indian Defense'
    WHEN 'E91' THEN 'King''s Indian Defense'
    WHEN 'E92' THEN 'King''s Indian Defense'
    WHEN 'E97' THEN 'King''s Indian Defense'
    -- Italian Game
    WHEN 'C50' THEN 'Italian Game'
    WHEN 'C53' THEN 'Italian Game'
    WHEN 'C54' THEN 'Italian Game'
    ELSE opening_family
END
WHERE opening_family ~ '^[A-E][0-9]{2}$'
  AND (opening_normalized IS NULL OR opening_normalized = '');

-- SECTION 4: Populate for non-ECO codes (use opening_family or opening as-is)
UPDATE games
SET opening_normalized = COALESCE(
    NULLIF(TRIM(opening_family), ''),
    NULLIF(TRIM(opening), ''),
    'Unknown'
)
WHERE opening_normalized IS NULL OR opening_normalized = '';

-- SECTION 5: Clean up
UPDATE games
SET opening_normalized = 'Unknown'
WHERE opening_normalized IN ('null', 'NULL', '') OR opening_normalized IS NULL;

-- SECTION 6: Set default and NOT NULL
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- SECTION 7: Create index
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Commit the transaction - all changes are now permanent
COMMIT;

-- NOTE: For verification queries, see SIMPLE_WORKING_VERIFICATION.sql
-- This migration only contains schema and data changes, no user-specific queries
