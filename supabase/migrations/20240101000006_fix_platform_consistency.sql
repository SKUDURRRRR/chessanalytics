-- Fix platform consistency across all tables
-- Standardize to 'chess.com' format

-- Update user_profiles table to use 'chess.com' instead of 'chess.com' (already correct)
-- No changes needed for user_profiles as it already uses 'chess.com'

-- Update games table to use 'chess.com' instead of 'chess.com' (already correct)
-- No changes needed for games as it already uses 'chess.com'

-- Add comment explaining the standardization
COMMENT ON COLUMN user_profiles.platform IS 'Platform name: lichess or chess.com';
COMMENT ON COLUMN games.platform IS 'Platform name: lichess or chess.com';
