-- Speed Optimization: Additional Performance Indexes
-- Created: 2025-10-29
-- Purpose: Optimize query performance for analytics, match history, and deep analysis

-- ==============================================================================
-- GAMES TABLE INDEXES
-- ==============================================================================

-- Composite index for analytics queries (most common pattern)
-- Speeds up queries that filter by user/platform and order by played_at
CREATE INDEX IF NOT EXISTS idx_games_user_platform_played
  ON games(user_id, platform, played_at DESC);

-- Composite index for deep analysis queries (rated games only)
-- Used when fetching highest-rated games for personality analysis
CREATE INDEX IF NOT EXISTS idx_games_analytics_rated
  ON games(user_id, platform, my_rating DESC, played_at DESC)
  WHERE my_rating IS NOT NULL;

-- Index for opening-based filtering (match history with opening filter)
-- Significantly speeds up queries like "show me all Caro-Kann games"
CREATE INDEX IF NOT EXISTS idx_games_opening_normalized
  ON games(user_id, platform, opening_normalized);

-- Index for color-based queries (white/black statistics)
CREATE INDEX IF NOT EXISTS idx_games_color
  ON games(user_id, platform, color);

-- ==============================================================================
-- GAME_ANALYSES TABLE INDEXES
-- ==============================================================================

-- Composite index for fetching analyses by user/platform
-- Speeds up loading analysis results
CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform
  ON game_analyses(user_id, platform, game_id);

-- Index for ordering by analysis date
CREATE INDEX IF NOT EXISTS idx_game_analyses_date
  ON game_analyses(user_id, platform, analysis_date DESC);

-- ==============================================================================
-- MOVE_ANALYSES TABLE INDEXES
-- ==============================================================================

-- Composite index for fetching move analyses for a game
-- Critical for game analysis page performance
CREATE INDEX IF NOT EXISTS idx_move_analyses_game
  ON move_analyses(game_id, move_number);

-- Index for user/platform queries
CREATE INDEX IF NOT EXISTS idx_move_analyses_user_platform
  ON move_analyses(user_id, platform, game_id);

-- ==============================================================================
-- GAMES_PGN TABLE INDEXES
-- ==============================================================================

-- Index for PGN lookup by provider_game_id
-- Speeds up single game analysis when fetching PGN
CREATE INDEX IF NOT EXISTS idx_games_pgn_provider_game
  ON games_pgn(user_id, platform, provider_game_id);

-- ==============================================================================
-- USER_PROFILES TABLE INDEXES
-- ==============================================================================

-- Composite index for user profile queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_platform
  ON user_profiles(user_id, platform);

-- ==============================================================================
-- ANALYZE TABLES FOR BETTER QUERY PLANNING
-- ==============================================================================

-- Update PostgreSQL statistics for better query optimization
ANALYZE games;
ANALYZE game_analyses;
ANALYZE move_analyses;
ANALYZE games_pgn;
ANALYZE user_profiles;

-- ==============================================================================
-- EXPECTED IMPACT
-- ==============================================================================
--
-- Analytics page load: 2-5s → 0.5-1.5s (3-5x faster)
-- Match history: 500ms-2s → 100-400ms (2-5x faster)
-- Deep analysis: 3-8s → 1-3s (2-3x faster)
-- Single game PGN fetch: 200ms → 50ms (4x faster)
--
-- Storage cost: ~5-10 MB for all indexes
-- Maintenance: Indexes update automatically with inserts
--
-- ==============================================================================
