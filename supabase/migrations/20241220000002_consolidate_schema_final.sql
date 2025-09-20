-- Final schema consolidation migration
-- This migration ensures all tables exist and are properly configured

-- First, ensure all required tables exist
-- (The individual table creation migrations should have run first)

ALTER TABLE IF EXISTS game_analyses
  ADD COLUMN IF NOT EXISTS endgame_score REAL;
ALTER TABLE IF EXISTS game_analyses
  ADD COLUMN IF NOT EXISTS opening_score REAL;
ALTER TABLE IF EXISTS move_analyses
  ADD COLUMN IF NOT EXISTS endgame_score REAL;
ALTER TABLE IF EXISTS move_analyses
  ADD COLUMN IF NOT EXISTS opening_score REAL;

-- Update the combined_game_analysis view to handle missing tables gracefully
DROP VIEW IF EXISTS combined_game_analysis CASCADE;
CREATE OR REPLACE VIEW combined_game_analysis AS
SELECT 
    ga.id as basic_analysis_id,
    ga.user_id,
    ga.platform,
    ga.game_id,
    ga.total_moves,
    
    -- Basic analysis data from game_analyses
    ga.accuracy,
    ga.blunders,
    ga.mistakes,
    ga.inaccuracies,
    ga.brilliant_moves,
    ga.opening_accuracy,
    ga.middle_game_accuracy,
    ga.endgame_accuracy,
    ga.average_evaluation,
    ga.time_management_score,
    ga.tactical_patterns as basic_tactical_patterns,
    ga.positional_patterns as basic_positional_patterns,
    ga.moves_analysis as basic_moves_analysis,
    ga.tactical_score as basic_tactical_score,
    ga.positional_score as basic_positional_score,
    ga.aggressive_score as basic_aggressive_score,
    ga.patient_score as basic_patient_score,
    ga.endgame_score as basic_endgame_score,
    ga.opening_score as basic_opening_score,
    ga.novelty_score as basic_novelty_score,
    ga.staleness_score as basic_staleness_score,
    ga.analysis_date as basic_analysis_date,
    
    -- Deep analysis data from move_analyses (if available)
    ma.id as deep_analysis_id,
    ma.average_centipawn_loss,
    ma.worst_blunder_centipawn_loss,
    ma.best_move_percentage,
    ma.middle_game_accuracy as deep_middle_game_accuracy,
    ma.endgame_accuracy as deep_endgame_accuracy,
    ma.time_management_score as deep_time_management_score,
    ma.material_sacrifices,
    ma.aggressiveness_index,
    ma.average_evaluation as deep_average_evaluation,
    ma.tactical_score as deep_tactical_score,
    ma.positional_score as deep_positional_score,
    ma.aggressive_score as deep_aggressive_score,
    ma.patient_score as deep_patient_score,
    ma.endgame_score as deep_endgame_score,
    ma.opening_score as deep_opening_score,
    ma.novelty_score as deep_novelty_score,
    ma.staleness_score as deep_staleness_score,
    ma.tactical_patterns as deep_tactical_patterns,
    ma.positional_patterns as deep_positional_patterns,
    ma.strategic_themes,
    ma.moves_analysis as deep_moves_analysis,
    ma.analysis_method as deep_analysis_method,
    ma.analysis_date as deep_analysis_date,
    ma.stockfish_depth,
    ma.processing_time_ms,
    
    -- Flags
    CASE WHEN ma.id IS NOT NULL THEN true ELSE false END as has_deep_analysis,
    CASE WHEN ma.analysis_method = 'stockfish' THEN true ELSE false END as has_stockfish_analysis
    
FROM game_analyses ga
LEFT JOIN move_analyses ma ON ga.id = ma.game_analysis_id;

-- Create a comprehensive user profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    username TEXT,
    rating INTEGER,
    total_games INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_profiles if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view all profiles') THEN
        CREATE POLICY "Users can view all profiles" ON user_profiles
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON user_profiles
            FOR INSERT WITH CHECK (auth.uid()::text = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON user_profiles
            FOR UPDATE USING (auth.uid()::text = user_id);
    END IF;
END $$;

-- Grant permissions on user_profiles
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform ON user_profiles(platform);

-- Add comments for documentation
COMMENT ON VIEW combined_game_analysis IS 'Unified view combining basic and deep analysis data';
COMMENT ON TABLE user_profiles IS 'User profile information for different platforms';
