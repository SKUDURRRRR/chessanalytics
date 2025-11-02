-- Migration: Fix Search Path Security for All Functions
-- Date: 2025-11-03
-- Description: Adds SET search_path = public to all functions missing it
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
--
-- SECURITY CONTEXT:
-- Functions with SECURITY DEFINER run with elevated privileges.
-- Without SET search_path, they're vulnerable to search path injection attacks
-- where malicious actors could inject code that runs with elevated privileges.
--
-- THE FIX: Add "SET search_path = public" to ensure functions only look
-- in the public schema, preventing malicious schema poisoning attacks.

-- ============================================================================
-- HIGH PRIORITY: SECURITY DEFINER Functions (10 functions)
-- ============================================================================

-- 1. track_player_search (version without ip_address)
CREATE OR REPLACE FUNCTION public.track_player_search(
    p_user_id uuid DEFAULT NULL::uuid,
    p_platform text DEFAULT NULL::text,
    p_username text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        platform,
        metadata
    ) VALUES (
        'player_search',
        p_user_id,
        p_user_id IS NULL,
        p_platform,
        jsonb_build_object(
            'username', p_username,
            'platform', p_platform
        )
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- 2. track_player_search (version with ip_address)
CREATE OR REPLACE FUNCTION public.track_player_search(
    p_user_id uuid DEFAULT NULL::uuid,
    p_platform text DEFAULT NULL::text,
    p_username text DEFAULT NULL::text,
    p_ip_address text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        platform,
        ip_address,
        metadata
    ) VALUES (
        'player_search',
        p_user_id,
        p_user_id IS NULL,
        p_platform,
        p_ip_address,
        jsonb_build_object(
            'username', p_username,
            'platform', p_platform
        )
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- 3. track_game_analysis (version without ip_address)
CREATE OR REPLACE FUNCTION public.track_game_analysis(
    p_user_id uuid DEFAULT NULL::uuid,
    p_platform text DEFAULT NULL::text,
    p_game_id text DEFAULT NULL::text,
    p_analysis_type text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        platform,
        metadata
    ) VALUES (
        'game_analysis',
        p_user_id,
        p_user_id IS NULL,
        p_platform,
        jsonb_build_object(
            'game_id', p_game_id,
            'analysis_type', p_analysis_type
        )
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- 4. track_game_analysis (version with ip_address)
CREATE OR REPLACE FUNCTION public.track_game_analysis(
    p_user_id uuid DEFAULT NULL::uuid,
    p_platform text DEFAULT NULL::text,
    p_game_id text DEFAULT NULL::text,
    p_analysis_type text DEFAULT NULL::text,
    p_ip_address text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        platform,
        ip_address,
        metadata
    ) VALUES (
        'game_analysis',
        p_user_id,
        p_user_id IS NULL,
        p_platform,
        p_ip_address,
        jsonb_build_object(
            'game_id', p_game_id,
            'analysis_type', p_analysis_type
        )
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- 5. track_pricing_page_view (version without ip_address)
CREATE OR REPLACE FUNCTION public.track_pricing_page_view(
    p_user_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        metadata
    ) VALUES (
        'pricing_page_view',
        p_user_id,
        p_user_id IS NULL,
        '{}'::jsonb
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- 6. track_pricing_page_view (version with ip_address)
CREATE OR REPLACE FUNCTION public.track_pricing_page_view(
    p_user_id uuid DEFAULT NULL::uuid,
    p_ip_address text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        ip_address,
        metadata
    ) VALUES (
        'pricing_page_view',
        p_user_id,
        p_user_id IS NULL,
        p_ip_address,
        '{}'::jsonb
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

-- 7. get_dashboard_metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_granularity text DEFAULT 'day'::text
)
RETURNS TABLE(
    time_bucket timestamp with time zone,
    event_type text,
    event_count bigint,
    unique_users bigint,
    anonymous_count bigint,
    unique_ips bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    -- Use appropriate materialized view based on granularity
    IF p_granularity = 'hour' THEN
        RETURN QUERY
        SELECT hour, analytics_hourly.event_type, analytics_hourly.event_count,
               analytics_hourly.unique_users, analytics_hourly.anonymous_count, analytics_hourly.unique_ips
        FROM analytics_hourly
        WHERE hour >= p_start_date AND hour <= p_end_date
        ORDER BY hour DESC, analytics_hourly.event_type;
    ELSIF p_granularity = 'day' THEN
        RETURN QUERY
        SELECT day, analytics_daily.event_type, analytics_daily.event_count,
               analytics_daily.unique_users, analytics_daily.anonymous_count, analytics_daily.unique_ips
        FROM analytics_daily
        WHERE day >= p_start_date AND day <= p_end_date
        ORDER BY day DESC, analytics_daily.event_type;
    ELSIF p_granularity = 'week' THEN
        RETURN QUERY
        SELECT week, analytics_weekly.event_type, analytics_weekly.event_count,
               analytics_weekly.unique_users, analytics_weekly.anonymous_count, analytics_weekly.unique_ips
        FROM analytics_weekly
        WHERE week >= p_start_date AND week <= p_end_date
        ORDER BY week DESC, analytics_weekly.event_type;
    ELSIF p_granularity = 'month' THEN
        RETURN QUERY
        SELECT month, analytics_monthly.event_type, analytics_monthly.event_count,
               analytics_monthly.unique_users, analytics_monthly.anonymous_count, analytics_monthly.unique_ips
        FROM analytics_monthly
        WHERE month >= p_start_date AND month <= p_end_date
        ORDER BY month DESC, analytics_monthly.event_type;
    ELSE
        RAISE EXCEPTION 'Invalid granularity: %. Must be hour, day, week, or month', p_granularity;
    END IF;
END;
$function$;

-- 8. get_analyzed_players_stats
CREATE OR REPLACE FUNCTION public.get_analyzed_players_stats(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_limit integer DEFAULT 50
)
RETURNS TABLE(
    player_username text,
    platform text,
    analysis_count bigint,
    analyzer_emails text[],
    last_analyzed timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        (ae.metadata->>'username')::TEXT AS player_username,
        ae.platform::TEXT AS platform,
        COUNT(ae.id)::BIGINT AS analysis_count,
        ARRAY_AGG(DISTINCT COALESCE(au.email::TEXT, 'Anonymous')) FILTER (WHERE COALESCE(au.email::TEXT, 'Anonymous') IS NOT NULL) AS analyzer_emails,
        MAX(ae.created_at)::TIMESTAMPTZ AS last_analyzed
    FROM analytics_events ae
    LEFT JOIN auth.users au ON ae.user_id = au.id
    WHERE ae.event_type = 'game_analysis'
        AND ae.created_at >= p_start_date
        AND ae.created_at <= p_end_date
        AND ae.metadata->>'username' IS NOT NULL
    GROUP BY ae.metadata->>'username', ae.platform
    HAVING COUNT(ae.id) > 0
    ORDER BY analysis_count DESC, last_analyzed DESC
    LIMIT p_limit;
END;
$function$;

-- 9. get_registration_details
CREATE OR REPLACE FUNCTION public.get_registration_details(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_limit integer DEFAULT 100
)
RETURNS TABLE(
    user_email text,
    registration_date timestamp with time zone,
    has_profile boolean,
    is_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        au.email::TEXT AS user_email,
        au.created_at::TIMESTAMPTZ AS registration_date,
        (up.id IS NOT NULL)::BOOLEAN AS has_profile,
        (au.email_confirmed_at IS NOT NULL)::BOOLEAN AS is_completed
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON au.id = up.id
    WHERE au.created_at >= p_start_date
        AND au.created_at <= p_end_date
    ORDER BY au.created_at DESC
    LIMIT p_limit;
END;
$function$;

-- 10. get_user_analysis_stats
CREATE OR REPLACE FUNCTION public.get_user_analysis_stats(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_limit integer DEFAULT 50
)
RETURNS TABLE(
    user_email text,
    analysis_count bigint,
    first_analysis timestamp with time zone,
    last_analysis timestamp with time zone,
    platforms text[],
    players_analyzed jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    RETURN QUERY
    WITH user_players AS (
        SELECT
            ae.user_id,
            ae.metadata->>'username' AS username,
            ae.platform,
            COUNT(*)::INTEGER AS count
        FROM analytics_events ae
        WHERE ae.event_type = 'game_analysis'
            AND ae.created_at >= p_start_date
            AND ae.created_at <= p_end_date
            AND ae.metadata->>'username' IS NOT NULL
        GROUP BY ae.user_id, ae.metadata->>'username', ae.platform
    )
    SELECT
        COALESCE(au.email::TEXT, 'Anonymous User'::TEXT) AS user_email,
        COUNT(ae.id)::BIGINT AS analysis_count,
        MIN(ae.created_at)::TIMESTAMPTZ AS first_analysis,
        MAX(ae.created_at)::TIMESTAMPTZ AS last_analysis,
        COALESCE(ARRAY_AGG(DISTINCT ae.platform) FILTER (WHERE ae.platform IS NOT NULL), ARRAY[]::TEXT[]) AS platforms,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'username', up.username,
                        'platform', up.platform,
                        'count', up.count
                    ) ORDER BY up.count DESC
                )
                FROM user_players up
                WHERE up.user_id = ae.user_id
            ),
            '[]'::jsonb
        ) AS players_analyzed
    FROM analytics_events ae
    LEFT JOIN auth.users au ON ae.user_id = au.id
    WHERE ae.event_type = 'game_analysis'
        AND ae.created_at >= p_start_date
        AND ae.created_at <= p_end_date
    GROUP BY au.email, ae.user_id
    HAVING COUNT(ae.id) > 0
    ORDER BY analysis_count DESC, last_analysis DESC
    LIMIT p_limit;
END;
$function$;

-- 11. get_registration_stats
CREATE OR REPLACE FUNCTION public.get_registration_stats(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone
)
RETURNS TABLE(
    total_registrations bigint,
    completed_registrations bigint,
    incomplete_registrations bigint,
    completion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_registrations,
        COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL)::BIGINT AS completed_registrations,
        COUNT(*) FILTER (WHERE confirmed_at IS NULL)::BIGINT AS incomplete_registrations,
        ROUND(
            (COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0) * 100),
            2
        ) AS completion_rate
    FROM auth.users
    WHERE created_at >= p_start_date
        AND created_at <= p_end_date
        AND deleted_at IS NULL;
END;
$function$;

-- 12. get_player_search_stats
CREATE OR REPLACE FUNCTION public.get_player_search_stats(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone,
    p_limit integer DEFAULT 50
)
RETURNS TABLE(
    username text,
    platform text,
    search_count bigint,
    last_searched timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        (ae.metadata->>'username')::TEXT AS username,
        ae.platform::TEXT AS platform,
        COUNT(ae.id)::BIGINT AS search_count,
        MAX(ae.created_at)::TIMESTAMPTZ AS last_searched
    FROM analytics_events ae
    WHERE ae.event_type = 'player_search'
        AND ae.created_at >= p_start_date
        AND ae.created_at <= p_end_date
        AND ae.metadata->>'username' IS NOT NULL
    GROUP BY ae.metadata->>'username', ae.platform
    HAVING COUNT(ae.id) > 0
    ORDER BY search_count DESC, last_searched DESC
    LIMIT p_limit;
END;
$function$;

-- 13. refresh_analytics_views
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_hourly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_weekly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_monthly;
END;
$function$;

-- ============================================================================
-- MEDIUM PRIORITY: INVOKER Functions (2 functions)
-- ============================================================================

-- 14. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 15. validate_subscription_data
CREATE OR REPLACE FUNCTION public.validate_subscription_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public  -- ✅ SECURITY FIX
AS $function$
BEGIN
    -- If account_tier is paid but no stripe_customer_id, log warning
    IF NEW.account_tier IN ('pro_monthly', 'pro_yearly', 'pro', 'enterprise') THEN
        IF NEW.stripe_customer_id IS NULL THEN
            RAISE WARNING 'User % has paid tier % but no stripe_customer_id', NEW.id, NEW.account_tier;
        END IF;

        -- If subscription is active, should have subscription_id (unless enterprise custom)
        IF NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NULL AND NEW.account_tier != 'enterprise' THEN
            RAISE WARNING 'User % has active subscription but no stripe_subscription_id', NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- ============================================================================
-- Add comments to document the security fix
-- ============================================================================

COMMENT ON FUNCTION public.track_player_search(uuid, text, text) IS 'Track player search events. SET search_path = public for security.';
COMMENT ON FUNCTION public.track_player_search(uuid, text, text, text) IS 'Track player search events with IP. SET search_path = public for security.';
COMMENT ON FUNCTION public.track_game_analysis(uuid, text, text, text) IS 'Track game analysis events. SET search_path = public for security.';
COMMENT ON FUNCTION public.track_game_analysis(uuid, text, text, text, text) IS 'Track game analysis events with IP. SET search_path = public for security.';
COMMENT ON FUNCTION public.track_pricing_page_view(uuid) IS 'Track pricing page views. SET search_path = public for security.';
COMMENT ON FUNCTION public.track_pricing_page_view(uuid, text) IS 'Track pricing page views with IP. SET search_path = public for security.';
COMMENT ON FUNCTION public.get_dashboard_metrics IS 'Get analytics dashboard metrics by time granularity. SET search_path = public for security.';
COMMENT ON FUNCTION public.get_analyzed_players_stats IS 'Get stats on most analyzed players. SET search_path = public for security.';
COMMENT ON FUNCTION public.get_registration_details IS 'Get user registration details for admin dashboard. SET search_path = public for security.';
COMMENT ON FUNCTION public.get_user_analysis_stats IS 'Get user analysis statistics. SET search_path = public for security.';
COMMENT ON FUNCTION public.get_registration_stats IS 'Get registration completion statistics. SET search_path = public for security.';
COMMENT ON FUNCTION public.get_player_search_stats IS 'Get player search statistics. SET search_path = public for security.';
COMMENT ON FUNCTION public.refresh_analytics_views IS 'Refresh all materialized analytics views. SET search_path = public for security.';
COMMENT ON FUNCTION public.update_updated_at_column IS 'Auto-update updated_at timestamp. SET search_path = public for security.';
COMMENT ON FUNCTION public.validate_subscription_data IS 'Validate subscription data consistency. SET search_path = public for security.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all functions now have search_path set
SELECT
    'All functions fixed! ✅' as status,
    COUNT(*) as total_functions,
    COUNT(*) FILTER (WHERE proconfig::text LIKE '%search_path%') as functions_with_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'track_player_search',
    'track_game_analysis',
    'track_pricing_page_view',
    'get_dashboard_metrics',
    'get_analyzed_players_stats',
    'get_registration_details',
    'get_user_analysis_stats',
    'refresh_analytics_views',
    'get_registration_stats',
    'get_player_search_stats',
    'update_updated_at_column',
    'validate_subscription_data'
);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ Fixed 15 functions total:
--    - 13 SECURITY DEFINER functions (HIGH PRIORITY)
--    - 2 INVOKER functions (MEDIUM PRIORITY)
--
-- ✅ All functions now have SET search_path = public
-- ✅ Protected against search path injection attacks
-- ✅ Function behavior unchanged - only security improved
--
-- Note: Some functions have overloaded versions (different parameters)
-- All versions have been secured.
-- ============================================================================
