-- Add missing performance indexes for common query patterns
-- These indexes improve query performance for the most frequent access patterns

-- Index on games.user_id for direct user lookups (currently only composite indexes exist)
CREATE INDEX IF NOT EXISTS idx_games_user_id ON public.games(user_id);

-- Index on game_analyses.created_at for time-series queries and sorting
CREATE INDEX IF NOT EXISTS idx_game_analyses_created_at ON public.game_analyses(created_at);

-- Index on move_analyses.move_number for sequential move lookups
CREATE INDEX IF NOT EXISTS idx_move_analyses_move_number ON public.move_analyses(move_number);

-- Index on game_features.game_id for feature lookups by game
CREATE INDEX IF NOT EXISTS idx_game_features_game_id ON public.game_features(game_id);
