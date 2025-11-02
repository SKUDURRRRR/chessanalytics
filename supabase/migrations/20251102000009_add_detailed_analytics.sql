-- Migration: Add detailed analytics functions
-- Date: 2025-11-02
-- Description: Adds functions to show which players' games were analyzed and registration details

-- ============================================================================
-- FUNCTION TO GET PLAYERS WHOSE GAMES WERE ANALYZED
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analyzed_players_stats(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    player_username TEXT,
    platform TEXT,
    analysis_count BIGINT,
    analyzer_emails TEXT[],
    last_analyzed TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_analyzed_players_stats TO service_role;

COMMENT ON FUNCTION get_analyzed_players_stats IS 'Returns list of players whose games were analyzed';

-- ============================================================================
-- FUNCTION TO GET REGISTRATION DETAILS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_registration_details(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    user_email TEXT,
    registration_date TIMESTAMPTZ,
    has_profile BOOLEAN,
    is_completed BOOLEAN
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_registration_details TO service_role;

COMMENT ON FUNCTION get_registration_details IS 'Returns detailed registration information including completion status';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created:
-- 1. get_analyzed_players_stats() - Shows which players' games were analyzed and by whom
-- 2. get_registration_details() - Shows registration details with completion status

-- Usage Examples:
-- SELECT * FROM get_analyzed_players_stats(NOW() - INTERVAL '7 days', NOW(), 50);
-- SELECT * FROM get_registration_details(NOW() - INTERVAL '7 days', NOW(), 100);
