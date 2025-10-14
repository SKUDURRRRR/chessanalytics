-- Verification script for ECO codes to names fix
-- This script can be run ad-hoc to verify the FIX_ECO_CODES_TO_NAMES.sql migration
-- It includes proper type-safe user_id handling

-- Option 1: Verify changes for a specific user (replace with actual UUID)
-- Uncomment and replace 'your-user-uuid-here' with the actual UUID
/*
SELECT
    opening_normalized,
    COUNT(*) as game_count
FROM games
WHERE user_id = 'your-user-uuid-here'::uuid AND platform = 'lichess'
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 20;
*/

-- Option 2: Verify changes for all users (type-safe)
SELECT
    opening_normalized,
    COUNT(*) as game_count
FROM games
WHERE platform = 'lichess'
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 20;

-- Check specifically for Scandinavian Defense for all users
SELECT COUNT(*) as scandinavian_count
FROM games
WHERE platform = 'lichess'
  AND opening_normalized = 'Scandinavian Defense';

-- Check for any remaining ECO codes that weren't converted
SELECT
    opening_normalized,
    COUNT(*) as remaining_eco_codes
FROM games
WHERE platform = 'lichess'
  AND opening_normalized ~ '^[A-E][0-9]{2}$'  -- Pattern for ECO codes
GROUP BY opening_normalized
ORDER BY remaining_eco_codes DESC;

-- Summary of conversion results
SELECT
    CASE
        WHEN opening_normalized ~ '^[A-E][0-9]{2}$' THEN 'ECO Code (not converted)'
        ELSE 'Opening Name (converted)'
    END as opening_type,
    COUNT(*) as count
FROM games
WHERE platform = 'lichess'
GROUP BY opening_type
ORDER BY count DESC;
