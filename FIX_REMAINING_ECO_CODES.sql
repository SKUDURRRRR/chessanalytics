-- Fix the remaining ECO codes that weren't converted yet
-- All updates wrapped in a transaction with error handling

DO $$
BEGIN
    -- Begin transaction
    
    -- Pirc Defense (B07-B09)
    UPDATE games 
    SET opening_normalized = 'Pirc Defense'
    WHERE opening_normalized IN ('B07', 'B08', 'B09')
      AND opening_normalized IS DISTINCT FROM 'Pirc Defense';

    -- King's Indian Defense (E90-E99, A48)
    UPDATE games 
    SET opening_normalized = 'King''s Indian Defense'
    WHERE (opening_normalized ~ '^E9' OR opening_normalized = 'A48')
      AND opening_normalized IS DISTINCT FROM 'King''s Indian Defense';

    -- Queen's Pawn Game / Indian Game (A45, A46, A49)
    UPDATE games 
    SET opening_normalized = 'Queen''s Pawn Game'
    WHERE opening_normalized IN ('A45', 'A46', 'A49')
      AND opening_normalized IS DISTINCT FROM 'Queen''s Pawn Game';

    -- Reti Opening (A04, A05)
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

