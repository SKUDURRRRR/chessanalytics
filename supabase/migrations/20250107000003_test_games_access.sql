-- Test script to verify games table access and insert test data
-- This will help us debug the RLS issue

-- First, let's check if there are any games in the database
-- (This is just for debugging - we'll remove this later)

-- Insert a test game to verify the table is accessible
INSERT INTO games (
  user_id, 
  platform, 
  result, 
  opening, 
  accuracy, 
  opponent_rating, 
  my_rating, 
  time_control, 
  played_at
) VALUES (
  'skudurrrrr', 
  'chess.com', 
  'win', 
  'Sicilian Defense', 
  85.5, 
  1200, 
  1250, 
  '600+0', 
  NOW() - INTERVAL '1 day'
) ON CONFLICT DO NOTHING;

-- Verify the game was inserted
-- (This will show in the logs)
SELECT COUNT(*) as total_games FROM games WHERE user_id = 'skudurrrrr';
