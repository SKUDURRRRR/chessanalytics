-- Add performance indexes for frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_games_user_platform ON games(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
-- Add indexes for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
-- Add index for platform-specific game lookups
CREATE INDEX IF NOT EXISTS idx_games_platform_provider_game_id ON games(platform, provider_game_id);
