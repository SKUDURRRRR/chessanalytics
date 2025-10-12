-- Add opening_normalized column for efficient filtering (SAFE VERSION)
-- This migration handles existing constraints and columns

-- Add column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'opening_normalized'
    ) THEN
        ALTER TABLE games ADD COLUMN opening_normalized TEXT;
    END IF;
END $$;

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

-- Add index for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Drop existing constraint if it exists, then add it
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'opening_normalized_valid' 
        AND table_name = 'games'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT opening_normalized_valid;
    END IF;
    
    -- Add the constraint
    ALTER TABLE games ADD CONSTRAINT opening_normalized_valid 
        CHECK (opening_normalized IS NOT NULL AND opening_normalized != '');
END $$;

-- Add comment for documentation
COMMENT ON COLUMN games.opening_normalized IS 'Normalized opening name for efficient filtering. Uses COALESCE(opening_family, opening, ''Unknown'') logic.';

