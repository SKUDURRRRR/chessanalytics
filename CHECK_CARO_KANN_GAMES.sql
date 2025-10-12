-- Check what Caro-Kann related games exist in the database
-- Run this in Supabase SQL Editor to see the problem

SELECT 
    opening,
    opening_family,
    COUNT(*) as game_count
FROM games
WHERE 
    user_id = 'skudurrrrr'
    AND platform = 'chess.com'
    AND (
        opening LIKE '%Caro%' 
        OR opening_family LIKE '%Caro%'
        OR opening_family IN ('B10', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19')
    )
GROUP BY opening, opening_family
ORDER BY game_count DESC;

-- Also check total games
SELECT COUNT(*) as total_games
FROM games
WHERE user_id = 'skudurrrrr' AND platform = 'chess.com';

