-- Migration: Add detailed player list to user analysis stats
-- Date: 2025-11-02
-- Description: Updates function to include list of players analyzed by each user

DROP FUNCTION IF EXISTS get_user_analysis_stats(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);

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
    platforms TEXT[],
    players_analyzed JSONB
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_analysis_stats TO service_role;

COMMENT ON FUNCTION get_user_analysis_stats IS 'Returns list of users with their analysis counts, activity details, and players analyzed';
