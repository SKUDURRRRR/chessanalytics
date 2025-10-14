-- Add opening_normalized column for efficient filtering
-- This migration adds a normalized opening name column to improve query performance
-- when filtering games by opening in the Match History component

-- Add column (nullable initially for migration)
ALTER TABLE games ADD COLUMN IF NOT EXISTS opening_normalized TEXT;

-- Populate with simplified logic: prefer opening_family, fallback to opening, default to 'Unknown'
UPDATE games 
SET opening_normalized = COALESCE(
  NULLIF(TRIM(opening_family), ''),
  NULLIF(TRIM(opening), ''),
  'Unknown'
)
WHERE opening_normalized IS NULL;

-- Filter out truly unknown values and normalize them to 'Unknown'
UPDATE games 
SET opening_normalized = 'Unknown'
WHERE opening_normalized IN ('null', 'NULL', '');

-- Set default value for future inserts
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';

-- Make column non-null now that existing data is populated
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- Add index for performance on opening filtering queries
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Add constraint to ensure data quality for new records
ALTER TABLE games ADD CONSTRAINT opening_normalized_valid 
  CHECK (opening_normalized IS NOT NULL AND opening_normalized != '');

-- Add comment for documentation
COMMENT ON COLUMN games.opening_normalized IS 'Normalized opening name for efficient filtering. Uses COALESCE(opening_family, opening, ''Unknown'') logic.';

