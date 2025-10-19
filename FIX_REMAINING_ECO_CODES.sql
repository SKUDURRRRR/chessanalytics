-- Fix the remaining ECO codes that weren't converted yet
-- All updates wrapped in a transaction with error handling

DO $$
BEGIN
    -- Begin transaction
    
    -- Caro-Kann Defense (B10-B19) - Add missing B11
    UPDATE games 
    SET opening_normalized = 'Caro-Kann Defense'
    WHERE opening_normalized IN ('B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19')
      AND opening_normalized IS DISTINCT FROM 'Caro-Kann Defense';

    -- Sicilian Defense (B20-B99)
    UPDATE games 
    SET opening_normalized = 'Sicilian Defense'
    WHERE opening_normalized ~ '^B[2-9][0-9]$'
      AND opening_normalized IS DISTINCT FROM 'Sicilian Defense';

    -- French Defense (C00-C19)
    UPDATE games 
    SET opening_normalized = 'French Defense'
    WHERE (opening_normalized ~ '^C0[0-9]$' OR opening_normalized ~ '^C1[0-9]$')
      AND opening_normalized IS DISTINCT FROM 'French Defense';

    -- Petrov Defense (C42-C43)
    UPDATE games 
    SET opening_normalized = 'Petrov Defense'
    WHERE opening_normalized IN ('C42', 'C43')
      AND opening_normalized IS DISTINCT FROM 'Petrov Defense';

    -- Italian Game (C50-C55)
    UPDATE games 
    SET opening_normalized = 'Italian Game'
    WHERE opening_normalized IN ('C50', 'C51', 'C52', 'C53', 'C54', 'C55')
      AND opening_normalized IS DISTINCT FROM 'Italian Game';

    -- Two Knights Defense (C56-C59)
    UPDATE games 
    SET opening_normalized = 'Two Knights Defense'
    WHERE opening_normalized IN ('C56', 'C57', 'C58', 'C59')
      AND opening_normalized IS DISTINCT FROM 'Two Knights Defense';

    -- Scotch Game (C44-C45)
    UPDATE games 
    SET opening_normalized = 'Scotch Game'
    WHERE opening_normalized IN ('C44', 'C45')
      AND opening_normalized IS DISTINCT FROM 'Scotch Game';

    -- King's Pawn Game (C40, C41, C46, B00)
    UPDATE games 
    SET opening_normalized = 'King''s Pawn Game'
    WHERE opening_normalized IN ('C40', 'C41', 'C46', 'B00')
      AND opening_normalized IS DISTINCT FROM 'King''s Pawn Game';

    -- Vienna Game (C23-C29)
    UPDATE games 
    SET opening_normalized = 'Vienna Game'
    WHERE opening_normalized IN ('C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29')
      AND opening_normalized IS DISTINCT FROM 'Vienna Game';

    -- Queen's Pawn Game (D00-D06)
    UPDATE games 
    SET opening_normalized = 'Queen''s Pawn Game'
    WHERE opening_normalized IN ('D00', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06')
      AND opening_normalized IS DISTINCT FROM 'Queen''s Pawn Game';

    -- Modern Defense (B06)
    UPDATE games 
    SET opening_normalized = 'Modern Defense'
    WHERE opening_normalized = 'B06'
      AND opening_normalized IS DISTINCT FROM 'Modern Defense';

    -- Uncommon Opening (A00)
    UPDATE games 
    SET opening_normalized = 'Uncommon Opening'
    WHERE opening_normalized = 'A00'
      AND opening_normalized IS DISTINCT FROM 'Uncommon Opening';

    -- Queen's Gambit (D30-D69)
    UPDATE games 
    SET opening_normalized = 'Queen''s Gambit'
    WHERE opening_normalized ~ '^D[3-6][0-9]$'
      AND opening_normalized IS DISTINCT FROM 'Queen''s Gambit';

    -- Ruy Lopez (C60-C99)
    UPDATE games 
    SET opening_normalized = 'Ruy Lopez'
    WHERE opening_normalized ~ '^C[6-9][0-9]$'
      AND opening_normalized IS DISTINCT FROM 'Ruy Lopez';

    -- English Opening (A10-A39)
    UPDATE games 
    SET opening_normalized = 'English Opening'
    WHERE opening_normalized ~ '^A[1-3][0-9]$'
      AND opening_normalized IS DISTINCT FROM 'English Opening';

    -- Pirc Defense (B07-B09)
    UPDATE games 
    SET opening_normalized = 'Pirc Defense'
    WHERE opening_normalized IN ('B07', 'B08', 'B09')
      AND opening_normalized IS DISTINCT FROM 'Pirc Defense';

    -- King's Indian Defense (E60-E99)
    UPDATE games 
    SET opening_normalized = 'King''s Indian Defense'
    WHERE opening_normalized ~ '^E[6-9][0-9]$'
      AND opening_normalized IS DISTINCT FROM 'King''s Indian Defense';

    -- Scandinavian Defense (B01)
    UPDATE games 
    SET opening_normalized = 'Scandinavian Defense'
    WHERE opening_normalized = 'B01'
      AND opening_normalized IS DISTINCT FROM 'Scandinavian Defense';

    -- Queen's Pawn Game / Indian Game (A45, A46, A49)
    UPDATE games 
    SET opening_normalized = 'Queen''s Pawn Game'
    WHERE opening_normalized IN ('A45', 'A46', 'A49')
      AND opening_normalized IS DISTINCT FROM 'Queen''s Pawn Game';

    -- Reti Opening (A04–A09)
    UPDATE games 
    SET opening_normalized = 'Reti Opening'
    WHERE opening_normalized IN ('A04', 'A05', 'A06', 'A07', 'A08', 'A09')
      AND opening_normalized IS DISTINCT FROM 'Reti Opening';

    -- Old Indian Defense (A41)
    UPDATE games 
    SET opening_normalized = 'Indian Defense'
    WHERE opening_normalized IN ('A41', 'A42', 'A43', 'A44')
      AND opening_normalized IS DISTINCT FROM 'Indian Defense';

    -- King's Pawn Game (C20)
    UPDATE games 
    SET opening_normalized = 'King''s Pawn Game'
    WHERE opening_normalized IN ('C20', 'C21', 'C22')
      AND opening_normalized IS DISTINCT FROM 'King''s Pawn Game';

    -- If we reach here, commit the transaction
    RAISE NOTICE 'Successfully updated all ECO codes';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically on exception in DO block
        RAISE EXCEPTION 'Error updating ECO codes: %', SQLERRM;
END $$;

-- Verify results for skudurrrrr
SELECT 
    opening_normalized,
    COUNT(*) as game_count
FROM games
WHERE user_id = 'skudurrrrr' AND platform = 'chess.com'
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 20;

-- Check specific counts
SELECT 
    'Caro-Kann Defense' as opening,
    COUNT(*) as count
FROM games
WHERE user_id = 'skudurrrrr' AND platform = 'chess.com' AND opening_normalized = 'Caro-Kann Defense'
UNION ALL
SELECT 
    'Scandinavian Defense' as opening,
    COUNT(*) as count
FROM games
WHERE user_id = 'skudurrrrr' AND platform = 'chess.com' AND opening_normalized = 'Scandinavian Defense';

