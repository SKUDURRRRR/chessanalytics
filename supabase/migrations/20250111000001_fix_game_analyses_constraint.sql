-- Fix game_analyses unique constraint to include analysis_type
-- This allows re-analysis of games and multiple analysis types per game

BEGIN;

-- Drop the old constraint regardless of its exact name
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop any unique constraint on (user_id, platform, game_id)
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.game_analyses'::regclass 
        AND contype = 'u' -- unique constraint
        AND array_length(conkey, 1) = 3 -- 3 columns
    LOOP
        EXECUTE format('ALTER TABLE public.game_analyses DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Drop any index that might be enforcing uniqueness on (user_id, platform, game_id)
DROP INDEX IF EXISTS idx_game_analyses_user_platform_game;
DROP INDEX IF EXISTS game_analyses_user_id_platform_game_id_key;

-- Add the correct constraint with analysis_type included
ALTER TABLE public.game_analyses 
DROP CONSTRAINT IF EXISTS game_analyses_user_platform_game_id_analysis_type_key;

ALTER TABLE public.game_analyses 
ADD CONSTRAINT game_analyses_user_platform_game_id_analysis_type_key 
UNIQUE (user_id, platform, game_id, analysis_type);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform_game 
ON public.game_analyses (user_id, platform, game_id);

COMMIT;

