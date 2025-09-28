-- Schema Consolidation & Security Hardening
-- Unifies analysis data model, removes legacy artifacts, and tightens permissions

BEGIN;

-- Remove deprecated diagnostic helpers in favour of consolidated schema
DROP FUNCTION IF EXISTS public.validate_rls_policies();
DROP FUNCTION IF EXISTS public.test_rls_policies(TEXT);
DROP FUNCTION IF EXISTS public.test_rls_policies();
DROP FUNCTION IF EXISTS public.validate_data_consistency();
DROP FUNCTION IF EXISTS public.validate_rls_security();

-- 1. Remove legacy seed data
DELETE FROM public.games
WHERE provider_game_id LIKE 'testgame%'
   OR provider_game_id LIKE 'skudurelis_game_%';

-- 2. Drop legacy analysis columns from games
ALTER TABLE public.games DROP COLUMN IF EXISTS analysis_date;
ALTER TABLE public.games DROP COLUMN IF EXISTS blunders;
ALTER TABLE public.games DROP COLUMN IF EXISTS mistakes;
ALTER TABLE public.games DROP COLUMN IF EXISTS inaccuracies;
ALTER TABLE public.games DROP COLUMN IF EXISTS brilliant_moves;
ALTER TABLE public.games DROP COLUMN IF EXISTS opening_accuracy;
ALTER TABLE public.games DROP COLUMN IF EXISTS middle_game_accuracy;
ALTER TABLE public.games DROP COLUMN IF EXISTS endgame_accuracy;
ALTER TABLE public.games DROP COLUMN IF EXISTS material_sacrifices;
ALTER TABLE public.games DROP COLUMN IF EXISTS aggressiveness_index;

-- 3. Standardise game_analyses structure
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS accuracy REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS blunders INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS mistakes INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS inaccuracies INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS brilliant_moves INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS best_moves INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS opening_accuracy REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS middle_game_accuracy REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS endgame_accuracy REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS average_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS worst_blunder_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS time_management_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS tactical_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS positional_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS aggressive_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS patient_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS novelty_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS staleness_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS analysis_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS moves_analysis JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS tactical_patterns JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS positional_patterns JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS strategic_themes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS opponent_accuracy REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS good_moves INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS acceptable_moves INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS opponent_average_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS opponent_worst_blunder_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS opponent_time_management_score REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS average_evaluation REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS stockfish_depth INTEGER;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS total_moves INTEGER DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS analysis_type TEXT DEFAULT 'basic';
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS average_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.game_analyses ADD COLUMN IF NOT EXISTS worst_blunder_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN analysis_type SET DEFAULT 'basic';
ALTER TABLE public.game_analyses ALTER COLUMN analysis_type SET NOT NULL;
ALTER TABLE public.game_analyses ALTER COLUMN accuracy SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN blunders SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN mistakes SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN inaccuracies SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN brilliant_moves SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN best_moves SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN opening_accuracy SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN middle_game_accuracy SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN endgame_accuracy SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN average_centipawn_loss SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN worst_blunder_centipawn_loss SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN time_management_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN tactical_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN positional_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN aggressive_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN patient_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN novelty_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN staleness_score SET DEFAULT 0;
ALTER TABLE public.game_analyses ALTER COLUMN analysis_date SET DEFAULT NOW();
ALTER TABLE public.game_analyses ALTER COLUMN moves_analysis SET DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ALTER COLUMN tactical_patterns SET DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ALTER COLUMN positional_patterns SET DEFAULT '[]'::jsonb;
ALTER TABLE public.game_analyses ALTER COLUMN strategic_themes SET DEFAULT '[]'::jsonb;

ALTER TABLE public.game_analyses DROP CONSTRAINT IF EXISTS game_analyses_user_id_platform_game_id_key;
ALTER TABLE public.game_analyses ADD CONSTRAINT game_analyses_user_platform_game_id_analysis_type_key UNIQUE (user_id, platform, game_id, analysis_type);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND constraint_name = 'fk_game_analyses_game'
    ) THEN
        ALTER TABLE public.game_analyses DROP CONSTRAINT fk_game_analyses_game;
    END IF;
END $$;

ALTER TABLE public.game_analyses
ADD CONSTRAINT fk_game_analyses_game FOREIGN KEY (user_id, platform, game_id)
REFERENCES public.games(user_id, platform, provider_game_id)
ON DELETE CASCADE;

-- Accuracy-range constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'game_analyses_accuracy_check'
    ) THEN
        ALTER TABLE public.game_analyses
        ADD CONSTRAINT game_analyses_accuracy_check CHECK (accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'game_analyses_opening_accuracy_check'
    ) THEN
        ALTER TABLE public.game_analyses
        ADD CONSTRAINT game_analyses_opening_accuracy_check CHECK (opening_accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'game_analyses_middle_game_accuracy_check'
    ) THEN
        ALTER TABLE public.game_analyses
        ADD CONSTRAINT game_analyses_middle_game_accuracy_check CHECK (middle_game_accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'game_analyses_endgame_accuracy_check'
    ) THEN
        ALTER TABLE public.game_analyses
        ADD CONSTRAINT game_analyses_endgame_accuracy_check CHECK (endgame_accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform_type ON public.game_analyses (user_id, platform, analysis_type);
CREATE INDEX IF NOT EXISTS idx_game_analyses_analysis_date ON public.game_analyses (analysis_date DESC);

-- 4. Ensure analysis_jobs tracking
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
    game_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('basic','stockfish','deep')),
    status TEXT NOT NULL CHECK (status IN ('pending','in_progress','completed','failed','retrying')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    analysis_data JSONB,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_job_id ON public.analysis_jobs (job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_platform ON public.analysis_jobs (user_id, platform);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON public.analysis_jobs (status);
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analysis_jobs_select_own" ON public.analysis_jobs;
DROP POLICY IF EXISTS "analysis_jobs_insert_own" ON public.analysis_jobs;
DROP POLICY IF EXISTS "analysis_jobs_update_own" ON public.analysis_jobs;
DROP POLICY IF EXISTS "analysis_jobs_delete_own" ON public.analysis_jobs;
DROP POLICY IF EXISTS "analysis_jobs_service_role_all" ON public.analysis_jobs;
CREATE POLICY "analysis_jobs_select_own" ON public.analysis_jobs FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "analysis_jobs_insert_own" ON public.analysis_jobs FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "analysis_jobs_update_own" ON public.analysis_jobs FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "analysis_jobs_delete_own" ON public.analysis_jobs FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "analysis_jobs_service_role_all" ON public.analysis_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON public.analysis_jobs TO service_role;
GRANT ALL ON public.analysis_jobs TO authenticated;

-- 4. Standardise move_analyses structure
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'move_analyses'
          AND column_name = 'best_move_percentage'
    ) THEN
        EXECUTE 'ALTER TABLE public.move_analyses RENAME COLUMN best_move_percentage TO accuracy';
    END IF;
END $$;

ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS accuracy REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS average_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS worst_blunder_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS middle_game_accuracy REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS endgame_accuracy REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS time_management_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS material_sacrifices INTEGER DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS aggressiveness_index REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS tactical_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS positional_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS aggressive_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS patient_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS novelty_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS staleness_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS tactical_patterns JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS positional_patterns JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS strategic_themes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS moves_analysis JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS analysis_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS stockfish_depth INTEGER;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS analysis_method TEXT DEFAULT 'stockfish';
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS game_analysis_id UUID;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS opponent_accuracy REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS good_moves INTEGER DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS acceptable_moves INTEGER DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS opponent_average_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS opponent_worst_blunder_centipawn_loss REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS opponent_time_management_score REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS material_sacrifices INTEGER DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS aggressiveness_index REAL DEFAULT 0;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE public.move_analyses ADD COLUMN IF NOT EXISTS stockfish_depth INTEGER;
ALTER TABLE public.move_analyses ALTER COLUMN analysis_method SET DEFAULT 'stockfish';
ALTER TABLE public.move_analyses ALTER COLUMN analysis_method SET NOT NULL;
ALTER TABLE public.move_analyses ALTER COLUMN accuracy SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN middle_game_accuracy SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN endgame_accuracy SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN average_centipawn_loss SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN worst_blunder_centipawn_loss SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN time_management_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN tactical_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN positional_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN aggressive_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN patient_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN novelty_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN staleness_score SET DEFAULT 0;
ALTER TABLE public.move_analyses ALTER COLUMN tactical_patterns SET DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ALTER COLUMN positional_patterns SET DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ALTER COLUMN strategic_themes SET DEFAULT '[]'::jsonb;
ALTER TABLE public.move_analyses ALTER COLUMN moves_analysis SET DEFAULT '[]'::jsonb;

ALTER TABLE public.move_analyses DROP CONSTRAINT IF EXISTS move_analyses_user_id_platform_game_id_key;
ALTER TABLE public.move_analyses ADD CONSTRAINT move_analyses_user_platform_game_analysis_method_key UNIQUE (user_id, platform, game_id, analysis_method);

ALTER TABLE public.move_analyses DROP CONSTRAINT IF EXISTS fk_move_analyses_game_analysis;
ALTER TABLE public.move_analyses
  ADD CONSTRAINT fk_move_analyses_game_analysis
  FOREIGN KEY (game_analysis_id)
  REFERENCES public.game_analyses(id)
  ON DELETE CASCADE;

-- Backfill game_analysis_id where possible
UPDATE public.move_analyses ma
SET game_analysis_id = ga.id
FROM public.game_analyses ga
WHERE ma.game_analysis_id IS NULL
  AND ga.user_id = ma.user_id
  AND ga.platform = ma.platform
  AND ga.game_id = ma.game_id
  AND lower(ga.analysis_type) = lower(ma.analysis_method);

-- Ensure accuracy within range
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'move_analyses_accuracy_check'
    ) THEN
        ALTER TABLE public.move_analyses
        ADD CONSTRAINT move_analyses_accuracy_check CHECK (accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'move_analyses_middle_game_accuracy_check'
    ) THEN
        ALTER TABLE public.move_analyses
        ADD CONSTRAINT move_analyses_middle_game_accuracy_check CHECK (middle_game_accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'move_analyses_endgame_accuracy_check'
    ) THEN
        ALTER TABLE public.move_analyses
        ADD CONSTRAINT move_analyses_endgame_accuracy_check CHECK (endgame_accuracy BETWEEN 0 AND 100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_move_analyses_user_platform_method ON public.move_analyses (user_id, platform, analysis_method);
CREATE INDEX IF NOT EXISTS idx_move_analyses_game_analysis_id ON public.move_analyses (game_analysis_id);

-- 5. Fix game_features platform constraint
ALTER TABLE public.game_features DROP CONSTRAINT IF EXISTS game_features_platform_check;
ALTER TABLE public.game_features ADD CONSTRAINT game_features_platform_check CHECK (platform IN ('lichess', 'chess.com'));

-- 6. Recreate unified_analyses view with canonical column set
DROP VIEW IF EXISTS public.unified_analyses;

CREATE VIEW public.unified_analyses AS
SELECT
    ga.game_id,
    ga.user_id,
    ga.platform,
    ga.analysis_type,
    ga.accuracy,
    ga.opponent_accuracy,
    ga.blunders,
    ga.mistakes,
    ga.inaccuracies,
    ga.brilliant_moves,
    ga.best_moves,
    ga.good_moves,
    ga.acceptable_moves,
    ga.opening_accuracy,
    COALESCE(ma.middle_game_accuracy, ga.middle_game_accuracy) AS middle_game_accuracy,
    COALESCE(ma.endgame_accuracy, ga.endgame_accuracy) AS endgame_accuracy,
    COALESCE(ma.accuracy, ga.accuracy) AS best_move_percentage,
    ga.average_centipawn_loss,
    ga.opponent_average_centipawn_loss,
    ga.worst_blunder_centipawn_loss,
    ga.opponent_worst_blunder_centipawn_loss,
    COALESCE(ma.time_management_score, ga.time_management_score) AS time_management_score,
    COALESCE(ma.opponent_time_management_score, ga.opponent_time_management_score) AS opponent_time_management_score,
    COALESCE(ma.material_sacrifices, 0) AS material_sacrifices,
    COALESCE(ma.aggressiveness_index, ga.aggressive_score) AS aggressiveness_index,
    ga.tactical_score,
    ga.positional_score,
    ga.aggressive_score,
    ga.patient_score,
    ga.novelty_score,
    ga.staleness_score,
    COALESCE(ma.average_evaluation, ga.average_evaluation) AS average_evaluation,
    COALESCE(ma.moves_analysis, ga.moves_analysis) AS moves_analysis,
    COALESCE(ma.tactical_patterns, ga.tactical_patterns) AS tactical_patterns,
    COALESCE(ma.positional_patterns, ga.positional_patterns) AS positional_patterns,
    COALESCE(ma.strategic_themes, ga.strategic_themes) AS strategic_themes,
    ga.analysis_date,
    COALESCE(ma.processing_time_ms, ga.processing_time_ms) AS processing_time_ms,
    COALESCE(ma.stockfish_depth, ga.stockfish_depth) AS stockfish_depth
FROM public.game_analyses ga
LEFT JOIN LATERAL (
    SELECT ma.*
    FROM public.move_analyses ma
    WHERE ma.user_id = ga.user_id
      AND ma.platform = ga.platform
      AND ma.game_id = ga.game_id
      AND lower(ma.analysis_method) = lower(ga.analysis_type)
    ORDER BY ma.updated_at DESC NULLS LAST
    LIMIT 1
) ma ON TRUE;

GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT SELECT ON public.unified_analyses TO service_role;
GRANT SELECT ON public.unified_analyses TO anon;

COMMENT ON VIEW public.unified_analyses IS 'Canonical analysis view combining game_analyses and move_analyses with consistent naming.';

-- 7. Harden games_pgn permissions
REVOKE ALL ON public.games_pgn FROM anon;
GRANT SELECT ON public.games_pgn TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games_pgn TO authenticated;
GRANT ALL ON public.games_pgn TO service_role;

-- 8. Consolidate validation helper functions
DROP FUNCTION IF EXISTS public.validate_data_consistency();
DROP FUNCTION IF EXISTS public.validate_rls_security();

CREATE OR REPLACE FUNCTION public.validate_data_consistency()
RETURNS TABLE (
    table_name TEXT,
    issue_type TEXT,
    issue_description TEXT,
    affected_rows BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'game_analyses', 'accuracy_range', 'Game accuracy outside 0-100', COUNT(*)
    FROM public.game_analyses
    WHERE accuracy < 0 OR accuracy > 100;

    RETURN QUERY
    SELECT 'game_analyses', 'phase_accuracy_range', 'Phase accuracy outside 0-100', COUNT(*)
    FROM public.game_analyses
    WHERE opening_accuracy NOT BETWEEN 0 AND 100
       OR middle_game_accuracy NOT BETWEEN 0 AND 100
       OR endgame_accuracy NOT BETWEEN 0 AND 100;

    RETURN QUERY
    SELECT 'move_analyses', 'accuracy_range', 'Move accuracy outside 0-100', COUNT(*)
    FROM public.move_analyses
    WHERE accuracy < 0 OR accuracy > 100;

    RETURN QUERY
    SELECT 'move_analyses', 'phase_accuracy_range', 'Move phase accuracy outside 0-100', COUNT(*)
    FROM public.move_analyses
    WHERE middle_game_accuracy NOT BETWEEN 0 AND 100
       OR endgame_accuracy NOT BETWEEN 0 AND 100;

    RETURN QUERY
    SELECT 'game_analyses', 'missing_required', 'Game analyses missing critical metrics', COUNT(*)
    FROM public.game_analyses
    WHERE moves_analysis IS NULL
       OR analysis_type IS NULL;

    RETURN QUERY
    SELECT 'move_analyses', 'missing_required', 'Move analyses missing critical metrics', COUNT(*)
    FROM public.move_analyses
    WHERE analysis_method IS NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.validate_rls_security()
RETURNS TABLE (
    table_name TEXT,
    policy_name TEXT,
    policy_type TEXT,
    is_secure BOOLEAN,
    issue_description TEXT
) AS $$
BEGIN
    -- Ensure anon cannot write critical tables
    RETURN QUERY
    SELECT 'games', 'anon_write', 'privilege', NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE grantee = 'anon'
          AND table_schema = 'public'
          AND role_table_grants.table_name = 'games'
          AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ), 'anon should not have write access to games';

    RETURN QUERY
    SELECT 'games_pgn', 'anon_write', 'privilege', NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE grantee = 'anon'
          AND table_schema = 'public'
          AND role_table_grants.table_name = 'games_pgn'
          AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ), 'anon should not have write access to games_pgn';

    -- Service role should have ALL privileges
    RETURN QUERY
    SELECT t.table_name,
           'service_role_all',
           'privilege',
           EXISTS (
               SELECT 1
               FROM information_schema.role_table_grants
               WHERE grantee = 'service_role'
                 AND table_schema = 'public'
                 AND role_table_grants.table_name = t.table_name
                 AND privilege_type = 'ALL'
           ),
           'service_role requires full access'
    FROM (VALUES ('games'),('game_analyses'),('move_analyses'),('game_features'),('games_pgn'),('analysis_jobs')) AS t(table_name);

    -- Row Level Security enabled
    RETURN QUERY
    SELECT c.relname::text,
           'rls_enabled',
           'security',
           c.relrowsecurity,
           CASE WHEN c.relrowsecurity THEN 'RLS enabled' ELSE 'RLS disabled' END
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('games','game_analyses','move_analyses','game_features','games_pgn','analysis_jobs');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.validate_data_consistency() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_data_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_rls_security() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_rls_security() TO service_role;

COMMENT ON FUNCTION public.validate_data_consistency() IS 'Runs integrity checks across analysis tables.';
COMMENT ON FUNCTION public.validate_rls_security() IS 'Reports on RLS posture for critical tables.';

COMMIT;
