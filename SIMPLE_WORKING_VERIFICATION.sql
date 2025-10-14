-- Post-migration verification script for SIMPLE_WORKING_MIGRATION.sql
-- This script contains user-specific verification queries that were removed from the migration
-- Run this script after the migration to verify the opening_normalized column was populated correctly
--
-- USAGE:
-- 1. Replace 'krecetas' with your actual user_id for testing
-- 2. Run this script after the migration completes successfully
-- 3. Review the results to ensure the migration worked as expected

-- Verify Scandinavian Defense games were properly normalized
SELECT COUNT(*) as scandinavian_count
FROM games
WHERE user_id = 'krecetas'
  AND platform = 'lichess'
  AND opening_normalized = 'Scandinavian Defense';

-- Show top openings for the user to verify normalization
SELECT
    opening_normalized,
    COUNT(*) as game_count
FROM games
WHERE user_id = 'krecetas' AND platform = 'lichess'
GROUP BY opening_normalized
ORDER BY game_count DESC
LIMIT 20;

-- Additional verification queries (optional)
-- Check for any remaining NULL or empty values
SELECT COUNT(*) as null_or_empty_count
FROM games
WHERE user_id = 'krecetas'
  AND platform = 'lichess'
  AND (opening_normalized IS NULL OR opening_normalized = '' OR opening_normalized = 'Unknown');

-- Check distribution of normalized openings
SELECT
    opening_normalized,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM games
WHERE user_id = 'krecetas' AND platform = 'lichess'
GROUP BY opening_normalized
ORDER BY count DESC;
