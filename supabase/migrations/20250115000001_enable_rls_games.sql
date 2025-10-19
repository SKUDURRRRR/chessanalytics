-- Enable RLS on games table and create basic policies
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "games_select_own" ON public.games;
DROP POLICY IF EXISTS "games_insert_own" ON public.games;
DROP POLICY IF EXISTS "games_update_own" ON public.games;
DROP POLICY IF EXISTS "games_delete_own" ON public.games;
DROP POLICY IF EXISTS "games_select_public" ON public.games;
DROP POLICY IF EXISTS "games_service_role_all" ON public.games;

-- Create policies for games table
-- Users can only see their own games
CREATE POLICY "games_select_own" ON public.games
    FOR SELECT
    USING (auth.uid()::text = user_id);

-- Users can only insert their own games
CREATE POLICY "games_insert_own" ON public.games
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own games
CREATE POLICY "games_update_own" ON public.games
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Users can only delete their own games
CREATE POLICY "games_delete_own" ON public.games
    FOR DELETE
    USING (auth.uid()::text = user_id);

-- Service role has full access
CREATE POLICY "games_service_role_all" ON public.games
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Grant permissions
-- Anonymous users cannot directly access games table
REVOKE ALL ON public.games FROM anon;
GRANT ALL ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
