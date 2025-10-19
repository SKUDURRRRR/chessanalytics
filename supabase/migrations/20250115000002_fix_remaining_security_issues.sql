-- Fix 1: Enable RLS on games_pgn table (has policies but RLS not enabled)
ALTER TABLE public.games_pgn ENABLE ROW LEVEL SECURITY;

-- Fix 2: Enable RLS on app_admins table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_admins') THEN
        ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

        -- Create policies for app_admins (admin-only access)
        DROP POLICY IF EXISTS "app_admins_service_role_all" ON public.app_admins;
        CREATE POLICY "app_admins_service_role_all" ON public.app_admins
            FOR ALL TO service_role
            USING (true) WITH CHECK (true);

        -- Revoke public access from app_admins
        REVOKE ALL ON public.app_admins FROM anon;
        REVOKE ALL ON public.app_admins FROM authenticated;
        GRANT ALL ON public.app_admins TO service_role;
    END IF;
END $$;

-- Fix 3: Remove SECURITY DEFINER from unified_analyses view
-- Drop the view and let the existing migration recreate it properly
-- The view will be recreated by 20250112000001_optimize_unified_analyses_performance.sql
DROP VIEW IF EXISTS public.unified_analyses CASCADE;

-- Fix 4: Remove SECURITY DEFINER from analysis_summary view (if it exists)
DROP VIEW IF EXISTS public.analysis_summary CASCADE;
