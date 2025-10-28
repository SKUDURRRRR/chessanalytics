-- Database Health Checks
-- These queries should return 0 rows for a healthy database
-- If any query returns rows, the database has integrity issues

-- A) Check that totals equal wins+losses+draws per user (unchanged, existing check)
-- This ensures our analytics math is correct
WITH user_totals AS (
  SELECT user_id,
         count(*) AS total,
         count(*) FILTER (WHERE result='win')  AS wins,
         count(*) FILTER (WHERE result='loss') AS losses,
         count(*) FILTER (WHERE result='draw') AS draws
  FROM public.games
  GROUP BY 1
)
SELECT
  'MATH_MISMATCH' as check_type,
  user_id,
  total,
  wins,
  losses,
  draws,
  (wins + losses + draws) as calculated_total,
  (total - (wins + losses + draws)) as difference
FROM user_totals
WHERE total <> wins + losses + draws;

-- B) Check for duplicate provider game IDs per user/platform (existing)
-- This ensures our unique constraint is working
SELECT
  'DUPLICATE_GAMES' as check_type,
  user_id,
  platform,
  provider_game_id,
  COUNT(*) as duplicate_count
FROM public.games
GROUP BY 1,2,3
HAVING COUNT(*) > 1;

-- C) Check for invalid result values
-- This ensures data integrity constraints
SELECT
  'INVALID_RESULT' as check_type,
  user_id,
  provider_game_id,
  result
FROM public.games
WHERE result NOT IN ('win', 'loss', 'draw');

-- D) Check for invalid color values
-- This ensures data integrity constraints
SELECT
  'INVALID_COLOR' as check_type,
  user_id,
  provider_game_id,
  color
FROM public.games
WHERE color NOT IN ('white', 'black');

-- E) Check for invalid platform values
-- This ensures data integrity constraints
SELECT
  'INVALID_PLATFORM' as check_type,
  user_id,
  provider_game_id,
  platform
FROM public.games
WHERE platform NOT IN ('lichess', 'chess.com');

-- F) Check for missing required fields
-- This ensures data completeness
SELECT
  'MISSING_FIELDS' as check_type,
  user_id,
  provider_game_id,
  CASE
    WHEN user_id IS NULL THEN 'user_id'
    WHEN platform IS NULL THEN 'platform'
    WHEN provider_game_id IS NULL THEN 'provider_game_id'
    WHEN played_at IS NULL THEN 'played_at'
    WHEN result IS NULL THEN 'result'
    WHEN color IS NULL THEN 'color'
  END as missing_field
FROM public.games
WHERE user_id IS NULL
   OR platform IS NULL
   OR provider_game_id IS NULL
   OR played_at IS NULL
   OR result IS NULL
   OR color IS NULL;

-- G) Check for future dates (data quality)
-- This catches potential data import issues
SELECT
  'FUTURE_DATES' as check_type,
  user_id,
  provider_game_id,
  played_at
FROM public.games
WHERE played_at > NOW() + INTERVAL '1 day';

-- H) Check for very old dates (data quality)
-- This catches potential data import issues
SELECT
  'ANCIENT_DATES' as check_type,
  user_id,
  provider_game_id,
  played_at
FROM public.games
WHERE played_at < '1900-01-01'::timestamp;

-- I) Check for invalid rating ranges (existing)
-- This ensures data quality
SELECT
  'INVALID_RATINGS' as check_type,
  user_id,
  provider_game_id,
  opponent_rating
FROM public.games
WHERE opponent_rating IS NOT NULL
  AND (opponent_rating < 100 OR opponent_rating > 4000);

-- J) Check for invalid accuracy ranges (existing)

-- K) Check that total_moves statistics align with new analytics expectations
SELECT
  'GAME_LENGTH_MISSING' as check_type,
  user_id,
  provider_game_id
FROM public.games
WHERE total_moves IS NULL
   OR total_moves <= 0;

-- L) Ensure we have corresponding analysis rows for move-based insights
-- Updated to handle both internal UUID and provider_game_id in game_analyses.game_id
SELECT
  'ANALYSIS_MISSING' as check_type,
  g.user_id,
  g.provider_game_id
FROM public.games g
LEFT JOIN public.game_analyses ga
  ON ga.user_id = g.user_id
 AND ga.platform = g.platform
 AND (ga.game_id = g.provider_game_id OR ga.game_id = g.id::text)
WHERE ga.id IS NULL
  AND g.result IN ('win','loss','draw')
LIMIT 50;
-- J) Check for invalid accuracy ranges (existing)
SELECT
  'INVALID_ACCURACY' as check_type,
  user_id,
  provider_game_id,
  accuracy
FROM public.games
WHERE accuracy IS NOT NULL
  AND (accuracy < 0 OR accuracy > 100);
