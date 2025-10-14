-- Fix CodeRabbit Issue: Add missing is_public column to games_pgn table
-- This ensures RLS policies that reference is_public = true will work correctly

-- Add is_public column to games_pgn table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games_pgn' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE games_pgn ADD COLUMN is_public BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_games_pgn_is_public ON games_pgn(is_public) WHERE is_public = true;
    RAISE NOTICE 'Added is_public column to games_pgn table';
  ELSE
    RAISE NOTICE 'is_public column already exists in games_pgn table';
  END IF;
END $$;

-- Verify the column was added successfully
SELECT
    CASE
        WHEN COUNT(*) > 0 THEN '✅ SUCCESS: is_public column now exists'
        ELSE '❌ ERROR: is_public column still missing'
    END as status,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'games_pgn'
  AND column_name = 'is_public'
GROUP BY table_name, column_name, data_type, is_nullable, column_default;
