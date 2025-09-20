-- Simple Chess Analytics Database Schema
-- One table, everything you need

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  opening TEXT,
  accuracy FLOAT CHECK (accuracy >= 0 AND accuracy <= 100),
  opponent_rating INTEGER CHECK (opponent_rating > 0 AND opponent_rating < 4000),
  my_rating INTEGER CHECK (my_rating > 0 AND my_rating < 4000),
  time_control TEXT,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Simple indexes for performance
CREATE INDEX idx_games_user_id ON games(user_id);
CREATE INDEX idx_games_played_at ON games(played_at);
CREATE INDEX idx_games_platform ON games(platform);
CREATE INDEX idx_games_result ON games(result);
-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
-- Simple policy - users can see their own games
CREATE POLICY "Users can see their own games" ON games
  FOR ALL USING (auth.uid()::text = user_id);
-- Grant permissions
GRANT ALL ON games TO authenticated;
GRANT ALL ON games TO service_role;
-- Insert sample data for testing
INSERT INTO games (user_id, platform, result, opening, accuracy, opponent_rating, my_rating, time_control, played_at) VALUES
('testuser', 'lichess', 'win', 'Sicilian Defense', 85.5, 1200, 1250, '600+0', NOW() - INTERVAL '1 day'),
('testuser', 'lichess', 'loss', 'French Defense', 72.3, 1300, 1250, '600+0', NOW() - INTERVAL '2 days'),
('testuser', 'lichess', 'draw', 'Italian Game', 78.9, 1280, 1250, '600+0', NOW() - INTERVAL '3 days'),
('testuser', 'lichess', 'win', 'Sicilian Defense', 88.2, 1180, 1250, '600+0', NOW() - INTERVAL '4 days'),
('testuser', 'lichess', 'win', 'Queen''s Gambit', 91.1, 1220, 1250, '600+0', NOW() - INTERVAL '5 days'),
('testuser', 'lichess', 'loss', 'King''s Indian Defense', 69.8, 1350, 1250, '600+0', NOW() - INTERVAL '6 days'),
('testuser', 'lichess', 'win', 'Sicilian Defense', 82.4, 1150, 1250, '600+0', NOW() - INTERVAL '7 days'),
('testuser', 'lichess', 'draw', 'English Opening', 75.6, 1280, 1250, '600+0', NOW() - INTERVAL '8 days');
