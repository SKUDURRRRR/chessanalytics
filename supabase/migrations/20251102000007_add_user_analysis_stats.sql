-- Migration: Add user analysis statistics
-- Date: 2025-11-02
-- Description: Adds function to track which users have done analyses and counts

-- ============================================================================
-- FUNCTION TO GET USER ANALYSIS STATISTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_analysis_stats(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    user_email TEXT,
    analysis_count BIGINT,
    first_analysis TIMESTAMPTZ,
    last_analysis TIMESTAMPTZ,
    platforms TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(au.email::TEXT, 'Anonymous User'::TEXT) AS user_email,
        COUNT(ae.id)::BIGINT AS analysis_count,
        MIN(ae.created_at)::TIMESTAMPTZ AS first_analysis,
        MAX(ae.created_at)::TIMESTAMPTZ AS last_analysis,
        COALESCE(ARRAY_AGG(DISTINCT ae.platform) FILTER (WHERE ae.platform IS NOT NULL), ARRAY[]::TEXT[]) AS platforms
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_analysis_stats TO service_role;

COMMENT ON FUNCTION get_user_analysis_stats IS 'Returns list of users with their analysis counts and activity details';

-- ============================================================================
-- FUNCTION TO GET PLAYER SEARCH STATISTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_player_search_stats(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    username TEXT,
    platform TEXT,
    search_count BIGINT,
    last_searched TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_player_search_stats TO service_role;

COMMENT ON FUNCTION get_player_search_stats IS 'Returns list of most searched players';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created:
-- 1. get_user_analysis_stats() - Shows which users did analyses and how many
-- 2. get_player_search_stats() - Shows which players were most searched

-- Usage Examples:
-- SELECT * FROM get_user_analysis_stats(NOW() - INTERVAL '7 days', NOW(), 50);
-- SELECT * FROM get_player_search_stats(NOW() - INTERVAL '7 days', NOW(), 20);
