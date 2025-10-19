-- Fix: Add opening_normalized column to games table
-- Run this in your Supabase SQL Editor

-- Step 1: Add the column if it doesn't exist
ALTER TABLE games ADD COLUMN IF NOT EXISTS opening_normalized TEXT;

-- Step 2: Populate existing rows
UPDATE games 
SET opening_normalized = COALESCE(
  NULLIF(TRIM(opening_family), ''),
  NULLIF(TRIM(opening), ''),
  'Unknown'
)
WHERE opening_normalized IS NULL OR opening_normalized = '';

-- Step 3: Set default value
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';

-- Step 4: Make it NOT NULL (now that all rows have values)
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- Step 5: Add constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'opening_normalized_valid' AND table_name = 'games'
    ) THEN
        ALTER TABLE games ADD CONSTRAINT opening_normalized_valid 
        CHECK (opening_normalized IS NOT NULL AND opening_normalized != '');
    END IF;
END $$;

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Step 7: Reload PostgREST schema cache (IMPORTANT!)
NOTIFY pgrst, 'reload schema';

-- Step 8: Verify the column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'games' 
  AND column_name = 'opening_normalized';

