-- FINAL migration to add opening_normalized column
-- This version is bulletproof and handles all edge cases

-- Step 1: Add the column (safe, won't fail if it already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'games' 
          AND column_name = 'opening_normalized'
    ) THEN
        ALTER TABLE games ADD COLUMN opening_normalized TEXT;
        RAISE NOTICE 'Column opening_normalized added successfully';
    ELSE
        RAISE NOTICE 'Column opening_normalized already exists';
    END IF;
END $$;

-- Step 2: Populate with simple normalization
UPDATE games 
SET opening_normalized = COALESCE(
    NULLIF(TRIM(opening_family), ''),
    NULLIF(TRIM(opening), ''),
    'Unknown'
)
WHERE opening_normalized IS NULL OR opening_normalized = '';

-- Step 3: Clean up null/empty values
UPDATE games 
SET opening_normalized = 'Unknown'
WHERE opening_normalized IN ('null', 'NULL', '') OR opening_normalized IS NULL;

-- Step 4: Set default for future inserts
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';

-- Step 5: Make column NOT NULL
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- Step 6: Create index (safe, won't fail if it already exists)
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Step 7: Add or replace constraint
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'opening_normalized_valid' 
          AND table_name = 'games'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT opening_normalized_valid;
    END IF;
    
    -- Add the constraint
    ALTER TABLE games ADD CONSTRAINT opening_normalized_valid 
        CHECK (opening_normalized IS NOT NULL AND opening_normalized != '');
        
    RAISE NOTICE 'Constraint opening_normalized_valid added successfully';
END $$;

-- Step 8: Add column comment
COMMENT ON COLUMN games.opening_normalized IS 'Normalized opening name for efficient filtering. Uses COALESCE(opening_family, opening, ''Unknown'') logic.';

-- Step 9: Verify the results
SELECT 
    'Total games' as description,
    COUNT(*) as count
FROM games
UNION ALL
SELECT 
    'Games with opening_normalized' as description,
    COUNT(*) as count
FROM games
WHERE opening_normalized IS NOT NULL AND opening_normalized != 'Unknown'
UNION ALL
SELECT 
    'Top openings' as description,
    0 as count;

-- Show top 10 openings
SELECT opening_normalized, COUNT(*) as game_count
FROM games
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 10;

