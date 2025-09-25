-- Clean up and optimize the database schema
-- Remove unused tables and add missing fields

-- Drop the unused game_analyses table if it exists
DROP TABLE IF EXISTS game_analyses CASCADE;
-- Add missing analysis fields to games table if they don't exist
DO $$ 
BEGIN
    -- Add analysis_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'analysis_date') THEN
        ALTER TABLE games ADD COLUMN analysis_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add blunders column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'blunders') THEN
        ALTER TABLE games ADD COLUMN blunders INTEGER DEFAULT 0;
    END IF;
    
    -- Add mistakes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'mistakes') THEN
        ALTER TABLE games ADD COLUMN mistakes INTEGER DEFAULT 0;
    END IF;
    
    -- Add inaccuracies column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'inaccuracies') THEN
        ALTER TABLE games ADD COLUMN inaccuracies INTEGER DEFAULT 0;
    END IF;
    
    -- Add brilliant_moves column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'brilliant_moves') THEN
        ALTER TABLE games ADD COLUMN brilliant_moves INTEGER DEFAULT 0;
    END IF;
    
    -- Add opening_accuracy column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'opening_accuracy') THEN
        ALTER TABLE games ADD COLUMN opening_accuracy FLOAT DEFAULT 0;
    END IF;
    
    -- Add middle_game_accuracy column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'middle_game_accuracy') THEN
        ALTER TABLE games ADD COLUMN middle_game_accuracy FLOAT DEFAULT 0;
    END IF;
    
    -- Add endgame_accuracy column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'endgame_accuracy') THEN
        ALTER TABLE games ADD COLUMN endgame_accuracy FLOAT DEFAULT 0;
    END IF;
    
    -- Add material_sacrifices column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'material_sacrifices') THEN
        ALTER TABLE games ADD COLUMN material_sacrifices INTEGER DEFAULT 0;
    END IF;
    
    -- Add aggressiveness_index column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'aggressiveness_index') THEN
        ALTER TABLE games ADD COLUMN aggressiveness_index FLOAT DEFAULT 0;
    END IF;
END $$;
-- Add indexes for better performance on analysis queries
CREATE INDEX IF NOT EXISTS idx_games_analysis_date ON games(analysis_date);
CREATE INDEX IF NOT EXISTS idx_games_accuracy ON games(accuracy);
CREATE INDEX IF NOT EXISTS idx_games_blunders ON games(blunders);
CREATE INDEX IF NOT EXISTS idx_games_analyzed ON games(analysis_date) WHERE analysis_date IS NOT NULL;
-- Update sample data to include some analyzed games
UPDATE games 
SET 
    analysis_date = NOW() - INTERVAL '1 day',
    accuracy = 75.5,
    blunders = 2,
    mistakes = 4,
    inaccuracies = 6,
    brilliant_moves = 1,
    opening_accuracy = 78.0,
    middle_game_accuracy = 72.0,
    endgame_accuracy = 76.0,
    material_sacrifices = 0,
    aggressiveness_index = 0.3
WHERE provider_game_id = 'testgame1';
UPDATE games 
SET 
    analysis_date = NOW() - INTERVAL '2 days',
    accuracy = 68.2,
    blunders = 3,
    mistakes = 5,
    inaccuracies = 8,
    brilliant_moves = 0,
    opening_accuracy = 70.0,
    middle_game_accuracy = 65.0,
    endgame_accuracy = 69.0,
    material_sacrifices = 1,
    aggressiveness_index = 0.5
WHERE provider_game_id = 'testgame2';
-- Add some sample analyzed games for skudurelis (the user in your image)
INSERT INTO games (user_id, platform, result, color, provider_game_id, opening, opening_family, accuracy, opponent_rating, my_rating, time_control, played_at, analysis_date, blunders, mistakes, inaccuracies, brilliant_moves, opening_accuracy, middle_game_accuracy, endgame_accuracy, material_sacrifices, aggressiveness_index) VALUES
('skudurelis', 'lichess', 'win', 'white', 'skudurelis_game_1', 'Sicilian Defense', 'Sicilian Defense', 82.3, 1850, 1900, '600+0', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 1, 3, 5, 2, 85.0, 80.0, 82.0, 0, 0.4),
('skudurelis', 'lichess', 'loss', 'black', 'skudurelis_game_2', 'French Defense', 'French Defense', 71.8, 1950, 1900, '600+0', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 3, 6, 8, 0, 75.0, 70.0, 70.0, 1, 0.6),
('skudurelis', 'lichess', 'win', 'white', 'skudurelis_game_3', 'Queen''s Gambit', 'Queen''s Gambit', 88.5, 1800, 1900, '600+0', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 0, 2, 3, 3, 90.0, 87.0, 88.0, 0, 0.2),
('skudurelis', 'lichess', 'draw', 'black', 'skudurelis_game_4', 'King''s Indian Defense', 'King''s Indian Defense', 76.2, 1920, 1900, '600+0', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 2, 4, 6, 1, 78.0, 75.0, 76.0, 0, 0.3),
('skudurelis', 'lichess', 'win', 'white', 'skudurelis_game_5', 'Italian Game', 'Italian Game', 84.1, 1880, 1900, '600+0', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 1, 3, 4, 2, 86.0, 83.0, 83.0, 0, 0.3);
