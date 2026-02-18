-- Migration: Fix Supabase Security Advisor Issues
-- Date: 2026-02-20
-- Fixes:
--   1. unified_analyses view: Recreate with explicit security_invoker = on
--   2. check_usage_limits: Add SET search_path = public
--   3. check_anonymous_usage_limits: Add SET search_path = public
--   4. increment_anonymous_usage: Add SET search_path = public
--   5. import_sessions: Remove overly permissive anon INSERT/UPDATE policies
--   6. Materialized views: REVOKE public API access (production only)

-- ============================================================================
-- 1. SECURITY DEFINER VIEW: unified_analyses
-- Recreate with explicit security_invoker = on to clear the advisor error.
-- ============================================================================

DROP VIEW IF EXISTS public.unified_analyses;

CREATE VIEW public.unified_analyses
WITH (security_invoker = on)
AS
SELECT
    ga.game_id,
    ga.game_id AS provider_game_id,
    ga.user_id,
    ga.platform,
    ga.analysis_type,
    ga.accuracy,
    ga.analysis_date,
    ga.blunders,
    ga.mistakes,
    ga.inaccuracies,
    ga.brilliant_moves,
    ga.best_moves,
    ga.opening_accuracy,
    ga.middle_game_accuracy,
    ga.endgame_accuracy,
    ga.average_centipawn_loss,
    ga.worst_blunder_centipawn_loss,
    ga.time_management_score,
    ga.tactical_score,
    ga.positional_score,
    ga.aggressive_score,
    ga.patient_score,
    ga.novelty_score,
    ga.staleness_score,
    ga.tactical_patterns,
    ga.positional_patterns,
    ga.strategic_themes,
    ga.moves_analysis,
    ga.opponent_accuracy,
    ga.good_moves,
    ga.acceptable_moves,
    ga.opponent_average_centipawn_loss,
    ga.opponent_worst_blunder_centipawn_loss,
    ga.opponent_time_management_score,
    ga.average_evaluation,
    ga.processing_time_ms,
    ga.stockfish_depth,
    1 AS data_source_priority
FROM public.game_analyses ga;

GRANT SELECT ON public.unified_analyses TO anon;
GRANT SELECT ON public.unified_analyses TO authenticated;
GRANT ALL ON public.unified_analyses TO service_role;

COMMENT ON VIEW public.unified_analyses IS 'Unified view over game_analyses with security_invoker = on';

-- ============================================================================
-- 2. FUNCTION SEARCH PATH: check_usage_limits
-- Was SECURITY DEFINER without SET search_path in 20250115000001.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_usage_limits(
    p_user_id UUID,
    p_action_type TEXT
)
RETURNS JSON AS $$
DECLARE
    v_account_tier TEXT;
    v_tier_import_limit INTEGER;
    v_tier_analysis_limit INTEGER;
    v_current_imports INTEGER := 0;
    v_current_analyses INTEGER := 0;
    v_total_games INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_can_proceed BOOLEAN := false;
    v_reason TEXT := NULL;
BEGIN
    SELECT account_tier INTO v_account_tier
    FROM authenticated_users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_anonymous', true,
            'reason', 'Anonymous users have temporary unlimited access'
        );
    END IF;

    SELECT import_limit, analysis_limit
    INTO v_tier_import_limit, v_tier_analysis_limit
    FROM payment_tiers
    WHERE id = v_account_tier;

    IF NOT FOUND THEN
        SELECT import_limit, analysis_limit
        INTO v_tier_import_limit, v_tier_analysis_limit
        FROM payment_tiers
        WHERE id = 'free';
    END IF;

    IF (p_action_type = 'import' AND v_tier_import_limit IS NULL) OR
       (p_action_type = 'analyze' AND v_tier_analysis_limit IS NULL) THEN
        RETURN json_build_object(
            'can_proceed', true,
            'is_unlimited', true,
            'account_tier', v_account_tier
        );
    END IF;

    SELECT
        COALESCE(games_imported, 0),
        COALESCE(games_analyzed, 0),
        reset_at
    INTO v_current_imports, v_current_analyses, v_reset_at
    FROM usage_tracking
    WHERE user_id = p_user_id
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        v_can_proceed := true;
    ELSE
        IF p_action_type = 'import' THEN
            IF v_tier_import_limit IS NULL THEN
                v_can_proceed := true;
            ELSE
                v_can_proceed := v_current_imports < v_tier_import_limit;
                IF NOT v_can_proceed THEN
                    v_reason := format('Import limit reached: %s/%s', v_current_imports, v_tier_import_limit);
                END IF;
            END IF;
        ELSIF p_action_type = 'analyze' THEN
            IF v_tier_analysis_limit IS NULL THEN
                v_can_proceed := true;
            ELSE
                v_can_proceed := v_current_analyses < v_tier_analysis_limit;
                IF NOT v_can_proceed THEN
                    v_reason := format('Analysis limit reached: %s/%s', v_current_analyses, v_tier_analysis_limit);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN json_build_object(
        'can_proceed', v_can_proceed,
        'account_tier', v_account_tier,
        'current_imports', v_current_imports,
        'current_analyses', v_current_analyses,
        'import_limit', v_tier_import_limit,
        'analysis_limit', v_tier_analysis_limit,
        'reset_at', v_reset_at,
        'reason', v_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION check_usage_limits(UUID, TEXT) TO authenticated, service_role;

-- ============================================================================
-- 3. FUNCTION SEARCH PATH: check_anonymous_usage_limits
-- Was SECURITY DEFINER without SET search_path in 20251107000001.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_anonymous_usage_limits(
    p_ip_address TEXT,
    p_action_type TEXT
)
RETURNS JSON AS $$
DECLARE
    v_import_limit INTEGER := 50;
    v_analysis_limit INTEGER := 2;
    v_current_imports INTEGER := 0;
    v_current_analyses INTEGER := 0;
    v_reset_at TIMESTAMPTZ;
    v_can_proceed BOOLEAN := false;
    v_reason TEXT := NULL;
BEGIN
    SELECT
        COALESCE(games_imported, 0),
        COALESCE(games_analyzed, 0),
        reset_at
    INTO v_current_imports, v_current_analyses, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address::TEXT = p_ip_address
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        v_can_proceed := true;
    ELSE
        IF p_action_type = 'import' THEN
            v_can_proceed := v_current_imports < v_import_limit;
            IF NOT v_can_proceed THEN
                v_reason := format('Import limit reached: %s/%s', v_current_imports, v_import_limit);
            END IF;
        ELSIF p_action_type = 'analyze' THEN
            v_can_proceed := v_current_analyses < v_analysis_limit;
            IF NOT v_can_proceed THEN
                v_reason := format('Analysis limit reached: %s/%s', v_current_analyses, v_analysis_limit);
            END IF;
        END IF;
    END IF;

    RETURN json_build_object(
        'can_proceed', v_can_proceed,
        'current_imports', v_current_imports,
        'current_analyses', v_current_analyses,
        'import_limit', v_import_limit,
        'analysis_limit', v_analysis_limit,
        'reset_at', v_reset_at,
        'reason', v_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION check_anonymous_usage_limits(TEXT, TEXT) TO service_role;

-- ============================================================================
-- 4. FUNCTION SEARCH PATH: increment_anonymous_usage
-- Was SECURITY DEFINER without SET search_path in 20251107000002.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_anonymous_usage(
    p_ip_address TEXT,
    p_action_type TEXT,
    p_count INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    v_record_id UUID;
    v_current_value INTEGER;
    v_reset_at TIMESTAMPTZ;
    v_new_value INTEGER;
    v_found_record BOOLEAN := false;
BEGIN
    SELECT id,
           CASE WHEN p_action_type = 'import' THEN games_imported ELSE games_analyzed END,
           reset_at
    INTO v_record_id, v_current_value, v_reset_at
    FROM anonymous_usage_tracking
    WHERE ip_address::TEXT = p_ip_address
      AND reset_at > NOW() - INTERVAL '24 hours'
    ORDER BY reset_at DESC
    LIMIT 1;

    IF v_record_id IS NOT NULL THEN
        v_found_record := true;
        v_new_value := COALESCE(v_current_value, 0) + p_count;
    ELSE
        SELECT id,
               CASE WHEN p_action_type = 'import' THEN games_imported ELSE games_analyzed END,
               reset_at
        INTO v_record_id, v_current_value, v_reset_at
        FROM anonymous_usage_tracking
        WHERE ip_address::TEXT = p_ip_address
        ORDER BY reset_at DESC
        LIMIT 1;

        IF v_record_id IS NOT NULL THEN
            IF v_reset_at IS NULL OR NOW() - v_reset_at > INTERVAL '24 hours' THEN
                v_new_value := p_count;
            ELSE
                v_new_value := COALESCE(v_current_value, 0) + p_count;
            END IF;
        ELSE
            v_new_value := p_count;
        END IF;
    END IF;

    IF v_found_record AND v_record_id IS NOT NULL THEN
        UPDATE anonymous_usage_tracking
        SET games_imported = CASE
                WHEN p_action_type = 'import' THEN v_new_value
                ELSE games_imported
            END,
            games_analyzed = CASE
                WHEN p_action_type = 'analyze' THEN v_new_value
                ELSE games_analyzed
            END,
            reset_at = NOW(),
            updated_at = NOW()
        WHERE id = v_record_id;
    ELSE
        INSERT INTO anonymous_usage_tracking (ip_address, date, games_imported, games_analyzed, reset_at)
        VALUES (
            p_ip_address::INET,
            CURRENT_DATE,
            CASE WHEN p_action_type = 'import' THEN v_new_value ELSE 0 END,
            CASE WHEN p_action_type = 'analyze' THEN v_new_value ELSE 0 END,
            NOW()
        )
        ON CONFLICT (ip_address, date) DO UPDATE SET
            games_imported = CASE
                WHEN p_action_type = 'import' THEN v_new_value
                ELSE anonymous_usage_tracking.games_imported
            END,
            games_analyzed = CASE
                WHEN p_action_type = 'analyze' THEN v_new_value
                ELSE anonymous_usage_tracking.games_analyzed
            END,
            reset_at = NOW(),
            updated_at = NOW();
    END IF;

    RETURN json_build_object(
        'success', true,
        'new_value', v_new_value,
        'action_type', p_action_type,
        'found_existing', v_found_record
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION increment_anonymous_usage(TEXT, TEXT, INTEGER) TO service_role;

-- ============================================================================
-- 5. RLS POLICY: import_sessions - Remove overly permissive anon policies
-- Backend inserts/updates via service_role, so anon write access is unnecessary.
-- ============================================================================

DROP POLICY IF EXISTS "Anon can insert import sessions" ON public.import_sessions;
DROP POLICY IF EXISTS "Anon can update import sessions" ON public.import_sessions;

DROP POLICY IF EXISTS "Service role full access on import sessions" ON public.import_sessions;
CREATE POLICY "Service role full access on import sessions" ON public.import_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Keep anon read and authenticated owner read
DROP POLICY IF EXISTS "Anon can read import sessions" ON public.import_sessions;
CREATE POLICY "Anon can read import sessions" ON public.import_sessions
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Users can read own import sessions" ON public.import_sessions;
CREATE POLICY "Users can read own import sessions" ON public.import_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid())::text);

REVOKE INSERT, UPDATE, DELETE ON public.import_sessions FROM anon;
GRANT SELECT ON public.import_sessions TO anon;
GRANT SELECT ON public.import_sessions TO authenticated;
GRANT ALL ON public.import_sessions TO service_role;

-- ============================================================================
-- 6. MATERIALIZED VIEWS: Revoke PostgREST API Access (production only)
-- These views exist in production but not in local migrations.
-- SECURITY DEFINER functions (get_dashboard_metrics) can still read them.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'analytics_hourly' AND schemaname = 'public') THEN
        EXECUTE 'REVOKE SELECT ON public.analytics_hourly FROM anon';
        EXECUTE 'REVOKE SELECT ON public.analytics_hourly FROM authenticated';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'analytics_daily' AND schemaname = 'public') THEN
        EXECUTE 'REVOKE SELECT ON public.analytics_daily FROM anon';
        EXECUTE 'REVOKE SELECT ON public.analytics_daily FROM authenticated';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'analytics_weekly' AND schemaname = 'public') THEN
        EXECUTE 'REVOKE SELECT ON public.analytics_weekly FROM anon';
        EXECUTE 'REVOKE SELECT ON public.analytics_weekly FROM authenticated';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'analytics_monthly' AND schemaname = 'public') THEN
        EXECUTE 'REVOKE SELECT ON public.analytics_monthly FROM anon';
        EXECUTE 'REVOKE SELECT ON public.analytics_monthly FROM authenticated';
    END IF;
END $$;
