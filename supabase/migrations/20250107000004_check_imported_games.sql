-- Check what games are actually in the database for skudurrrrr
-- This will help us debug why only 1 game is showing

-- Count total games for skudurrrrr
SELECT
  COUNT(*) as total_games,
  platform,
  user_id
FROM games
WHERE user_id = 'skudurrrrr'
GROUP BY platform, user_id;
-- Show all games for skudurrrrr with details
SELECT
  id,
  user_id,
  platform,
  result,
  played_at,
  opening,
  accuracy,
  my_rating,
  opponent_rating,
  time_control,
  provider_game_id
FROM games
WHERE user_id = 'skudurrrrr'
ORDER BY played_at DESC
LIMIT 10;
-- Check if there are any games with different user_id variations
SELECT
  user_id,
  platform,
  COUNT(*) as game_count
FROM games
WHERE user_id ILIKE '%skudurrrrr%'
GROUP BY user_id, platform;
