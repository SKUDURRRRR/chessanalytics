-- Add total_moves column to games table if it doesn't exist
DO $$
BEGIN
  -- Check if total_moves column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'games'
      AND column_name = 'total_moves'
  ) THEN
    -- Add the column
    ALTER TABLE public.games
      ADD COLUMN total_moves INTEGER DEFAULT 0 CHECK (total_moves >= 0);
    
    -- Add comment
    COMMENT ON COLUMN public.games.total_moves IS 'Total number of moves in the game';
    
    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_games_total_moves ON public.games(total_moves);
    
    RAISE NOTICE 'Added total_moves column to games table';
  ELSE
    RAISE NOTICE 'total_moves column already exists in games table';
  END IF;
END;
$$;
