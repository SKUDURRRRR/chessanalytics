-- Migration: Fix user analysis stats functions with proper type casting
-- Date: 2025-11-02
-- Description: Fixes type casting issues in analytics stats functions

-- Drop existing functions
DROP FUNCTION IF EXISTS get_user_analysis_stats(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS get_player_search_stats(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);

-- Recreate with proper type casting
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
