-- Fix ECO codes to opening names for ALL users (not just krecetas)
-- This will fix the opening_normalized column for everyone

BEGIN;

-- Scandinavian Defense (B01)
UPDATE games 
SET opening_normalized = 'Scandinavian Defense'
WHERE opening_normalized = 'B01';

-- Caro-Kann Defense (B10-B19)  
UPDATE games 
SET opening_normalized = 'Caro-Kann Defense'
WHERE opening_normalized IN ('B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19');

-- Sicilian Defense (B20-B99)
UPDATE games 
SET opening_normalized = 'Sicilian Defense'
WHERE opening_normalized ~ '^B[2-9][0-9]$';

-- French Defense (C00-C19)
UPDATE games 
SET opening_normalized = 'French Defense'
WHERE opening_normalized ~ '^C0[0-9]$' OR opening_normalized ~ '^C1[0-9]$';

-- Petrov Defense (C42-C43)
UPDATE games 
SET opening_normalized = 'Petrov Defense'
WHERE opening_normalized IN ('C42', 'C43');

-- Italian Game (C50-C55)
UPDATE games 
SET opening_normalized = 'Italian Game'
WHERE opening_normalized IN ('C50', 'C51', 'C52', 'C53', 'C54', 'C55');

-- Two Knights Defense (C56-C59)
UPDATE games 
SET opening_normalized = 'Two Knights Defense'
WHERE opening_normalized IN ('C56', 'C57', 'C58', 'C59');

-- Scotch Game (C44-C45)
UPDATE games 
SET opening_normalized = 'Scotch Game'
WHERE opening_normalized IN ('C44', 'C45');

-- King's Pawn Game (C40, C41, C46)
UPDATE games 
SET opening_normalized = 'King''s Pawn Game'
WHERE opening_normalized IN ('C40', 'C41', 'C46');

-- Vienna Game (C23-C29)
UPDATE games 
SET opening_normalized = 'Vienna Game'
WHERE opening_normalized IN ('C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29');

-- Queen's Pawn Game (D00-D06)
UPDATE games 
SET opening_normalized = 'Queen''s Pawn Game'
WHERE opening_normalized IN ('D00', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06');

-- King's Pawn Opening (B00)
UPDATE games 
SET opening_normalized = 'King''s Pawn Game'
WHERE opening_normalized = 'B00';

-- Modern Defense (B06)
UPDATE games 
SET opening_normalized = 'Modern Defense'
WHERE opening_normalized = 'B06';

-- Uncommon Opening (A00)
UPDATE games 
SET opening_normalized = 'Uncommon Opening'
WHERE opening_normalized = 'A00';

-- King's Indian Defense (E60-E99)
UPDATE games 
SET opening_normalized = 'King''s Indian Defense'
WHERE opening_normalized ~ '^E[6-9][0-9]$';

-- Queen's Gambit (D30-D69)
UPDATE games 
SET opening_normalized = 'Queen''s Gambit'
WHERE opening_normalized ~ '^D[3-6][0-9]$';

-- Ruy Lopez / Spanish Opening (C60-C99)
UPDATE games 
SET opening_normalized = 'Ruy Lopez'
WHERE opening_normalized ~ '^C[6-9][0-9]$';

-- English Opening (A10-A39)
UPDATE games 
SET opening_normalized = 'English Opening'
WHERE opening_normalized ~ '^A[1-3][0-9]$';

-- Verify - show top openings for skudurrrrr
SELECT 
    opening_normalized,
    COUNT(*) as game_count
FROM games
WHERE user_id = 'skudurrrrr' AND platform = 'chess.com'
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 20;

-- Check Caro-Kann count for skudurrrrr
SELECT COUNT(*) as caro_kann_count
FROM games
WHERE user_id = 'skudurrrrr' 
  AND platform = 'chess.com'
  AND opening_normalized = 'Caro-Kann Defense';

-- Check Scandinavian count for skudurrrrr  
SELECT COUNT(*) as scandinavian_count
FROM games
WHERE user_id = 'skudurrrrr' 
  AND platform = 'chess.com'
  AND opening_normalized = 'Scandinavian Defense';

COMMIT;
