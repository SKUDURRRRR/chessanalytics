-- Proper migration that converts ECO codes to opening names
-- This will make the opening filter work correctly

-- Step 1: Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'opening_normalized'
    ) THEN
        ALTER TABLE games ADD COLUMN opening_normalized TEXT;
    END IF;
END $$;

-- Step 2: Create a function to map ECO codes to opening names
CREATE OR REPLACE FUNCTION eco_to_opening_name(eco_code TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN CASE
        -- Scandinavian Defense
        WHEN eco_code = 'B01' THEN 'Scandinavian Defense'
        -- Caro-Kann Defense
        WHEN eco_code IN ('B10', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19') THEN 'Caro-Kann Defense'
        -- Sicilian Defense
        WHEN eco_code ~ '^B[2-4]' THEN 'Sicilian Defense'
        -- French Defense
        WHEN eco_code ~ '^C0[0-1]' THEN 'French Defense'
        -- King''s Indian Defense
        WHEN eco_code ~ '^E[6-9]' THEN 'King''s Indian Defense'
        -- Queen''s Gambit
        WHEN eco_code ~ '^D[3-6]' THEN 'Queen''s Gambit'
        -- Italian Game
        WHEN eco_code IN ('C50', 'C51', 'C52', 'C53', 'C54', 'C55') THEN 'Italian Game'
        -- Ruy Lopez
        WHEN eco_code ~ '^C[6-9]' THEN 'Ruy Lopez'
        -- English Opening
        WHEN eco_code ~ '^A[1-3]' THEN 'English Opening'
        -- King''s Gambit
        WHEN eco_code ~ '^C3' THEN 'King''s Gambit'
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Populate opening_normalized with ECO code conversion
UPDATE games 
SET opening_normalized = CASE
    -- First try to convert ECO code if opening_family is an ECO code
    WHEN opening_family ~ '^[A-E][0-9]{2}$' THEN 
        COALESCE(eco_to_opening_name(opening_family), opening_family)
    -- Otherwise use opening_family or opening
    ELSE 
        COALESCE(
            NULLIF(TRIM(opening_family), ''),
            NULLIF(TRIM(opening), ''),
            'Unknown'
        )
END
WHERE opening_normalized IS NULL OR opening_normalized = '';

-- Step 4: Clean up unknown values
UPDATE games 
SET opening_normalized = 'Unknown'
WHERE opening_normalized IN ('null', 'NULL', '') OR opening_normalized IS NULL;

-- Step 5: Set default and NOT NULL
ALTER TABLE games ALTER COLUMN opening_normalized SET DEFAULT 'Unknown';
ALTER TABLE games ALTER COLUMN opening_normalized SET NOT NULL;

-- Step 6: Create index
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized ON games(opening_normalized);

-- Step 7: Add constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'opening_normalized_valid' AND table_name = 'games'
    ) THEN
        ALTER TABLE games DROP CONSTRAINT opening_normalized_valid;
    END IF;
    
    ALTER TABLE games ADD CONSTRAINT opening_normalized_valid 
        CHECK (opening_normalized IS NOT NULL AND opening_normalized != '');
END $$;

-- Step 8: Verify results
SELECT 
    opening_normalized,
    COUNT(*) as game_count
FROM games
WHERE user_id = 'krecetas' AND platform = 'lichess'
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 20;

-- Check specifically for Scandinavian Defense
SELECT COUNT(*) as scandinavian_count
FROM games
WHERE user_id = 'krecetas' 
  AND platform = 'lichess'
  AND opening_normalized = 'Scandinavian Defense';

