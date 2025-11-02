-- Migration: Create Admin Analytics System
-- Date: 2025-11-02
-- Description: Creates tables and views for tracking app usage metrics for admin dashboard

-- ============================================================================
-- 1. ANALYTICS_EVENTS TABLE
-- Tracks all key events for dashboard metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'player_search',
        'game_analysis',
        'user_registration',
        'pricing_page_view',
        'profile_view'
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for anonymous users
    is_anonymous BOOLEAN DEFAULT FALSE,
    platform TEXT CHECK (platform IN ('lichess', 'chess.com')),
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional event-specific data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created_at ON analytics_events(event_type, created_at DESC);

-- Enable RLS (only service role and admins can access)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on analytics" ON analytics_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON analytics_events TO authenticated;
GRANT ALL ON analytics_events TO service_role;

COMMENT ON TABLE analytics_events IS 'Tracks all key events for admin analytics dashboard';

-- ============================================================================
-- 2. MATERIALIZED VIEWS FOR FAST ANALYTICS
-- Pre-computed aggregations for dashboard performance
-- ============================================================================

-- Hourly aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly AS
SELECT
    DATE_TRUNC('hour', created_at) AS hour,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count
FROM analytics_events
GROUP BY DATE_TRUNC('hour', created_at), event_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_hourly_unique ON analytics_hourly(hour, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_hourly_hour ON analytics_hourly(hour DESC);

-- Daily aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_daily AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count
FROM analytics_events
GROUP BY DATE_TRUNC('day', created_at), event_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_unique ON analytics_daily(day, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_day ON analytics_daily(day DESC);

-- Weekly aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_weekly AS
SELECT
    DATE_TRUNC('week', created_at) AS week,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count
FROM analytics_events
GROUP BY DATE_TRUNC('week', created_at), event_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_weekly_unique ON analytics_weekly(week, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_weekly_week ON analytics_weekly(week DESC);

-- Monthly aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_monthly AS
SELECT
    DATE_TRUNC('month', created_at) AS month,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count
FROM analytics_events
GROUP BY DATE_TRUNC('month', created_at), event_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_monthly_unique ON analytics_monthly(month, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_monthly_month ON analytics_monthly(month DESC);

-- Grant select on materialized views
GRANT SELECT ON analytics_hourly TO service_role;
GRANT SELECT ON analytics_daily TO service_role;
GRANT SELECT ON analytics_weekly TO service_role;
GRANT SELECT ON analytics_monthly TO service_role;

-- ============================================================================
-- 3. USER REGISTRATION STATUS VIEW
-- Tracks users who haven't completed registration (confirmed email)
-- ============================================================================

CREATE OR REPLACE VIEW user_registration_status AS
SELECT
    au.id,
    au.email,
    au.created_at AS registration_started_at,
    au.confirmed_at,
    au.last_sign_in_at,
    CASE
        WHEN au.confirmed_at IS NULL THEN 'incomplete'
        ELSE 'complete'
    END AS registration_status,
    authenticated_users.account_tier,
    authenticated_users.subscription_status
FROM auth.users au
LEFT JOIN authenticated_users ON authenticated_users.id = au.id
WHERE au.deleted_at IS NULL;

GRANT SELECT ON user_registration_status TO service_role;

COMMENT ON VIEW user_registration_status IS 'Shows user registration completion status';

-- ============================================================================
-- 4. HELPER FUNCTIONS FOR TRACKING EVENTS
-- ============================================================================

-- Function to track a player search event
CREATE OR REPLACE FUNCTION track_player_search(
    p_user_id UUID DEFAULT NULL,
    p_platform TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track a game analysis event
CREATE OR REPLACE FUNCTION track_game_analysis(
    p_user_id UUID DEFAULT NULL,
    p_platform TEXT DEFAULT NULL,
    p_game_id TEXT DEFAULT NULL,
    p_analysis_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track pricing page view
CREATE OR REPLACE FUNCTION track_pricing_page_view(
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track user registration (triggered automatically)
CREATE OR REPLACE FUNCTION track_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO analytics_events (
        event_type,
        user_id,
        is_anonymous,
        metadata
    ) VALUES (
        'user_registration',
        NEW.id,
        FALSE,
        jsonb_build_object('email', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-track user registrations
DROP TRIGGER IF EXISTS on_user_registration ON auth.users;
CREATE TRIGGER on_user_registration
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION track_user_registration();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION track_player_search TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION track_game_analysis TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION track_pricing_page_view TO authenticated, anon, service_role;

-- ============================================================================
-- 5. FUNCTION TO REFRESH MATERIALIZED VIEWS
-- Should be called periodically (e.g., every hour via cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_hourly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_weekly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_monthly;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_analytics_views TO service_role;

COMMENT ON FUNCTION refresh_analytics_views IS 'Refreshes all analytics materialized views. Should be run periodically via cron.';

-- ============================================================================
-- 6. FUNCTION TO GET DASHBOARD METRICS
-- Returns aggregated metrics for a given time period
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_granularity TEXT DEFAULT 'day' -- 'hour', 'day', 'week', 'month'
)
RETURNS TABLE (
    time_bucket TIMESTAMPTZ,
    event_type TEXT,
    event_count BIGINT,
    unique_users BIGINT,
    anonymous_count BIGINT
) AS $$
BEGIN
    -- Use appropriate materialized view based on granularity
    IF p_granularity = 'hour' THEN
        RETURN QUERY
        SELECT hour, analytics_hourly.event_type, analytics_hourly.event_count, analytics_hourly.unique_users, analytics_hourly.anonymous_count
        FROM analytics_hourly
        WHERE hour >= p_start_date AND hour <= p_end_date
        ORDER BY hour DESC, analytics_hourly.event_type;
    ELSIF p_granularity = 'day' THEN
        RETURN QUERY
        SELECT day, analytics_daily.event_type, analytics_daily.event_count, analytics_daily.unique_users, analytics_daily.anonymous_count
        FROM analytics_daily
        WHERE day >= p_start_date AND day <= p_end_date
        ORDER BY day DESC, analytics_daily.event_type;
    ELSIF p_granularity = 'week' THEN
        RETURN QUERY
        SELECT week, analytics_weekly.event_type, analytics_weekly.event_count, analytics_weekly.unique_users, analytics_weekly.anonymous_count
        FROM analytics_weekly
        WHERE week >= p_start_date AND week <= p_end_date
        ORDER BY week DESC, analytics_weekly.event_type;
    ELSIF p_granularity = 'month' THEN
        RETURN QUERY
        SELECT month, analytics_monthly.event_type, analytics_monthly.event_count, analytics_monthly.unique_users, analytics_monthly.anonymous_count
        FROM analytics_monthly
        WHERE month >= p_start_date AND month <= p_end_date
        ORDER BY month DESC, analytics_monthly.event_type;
    ELSE
        RAISE EXCEPTION 'Invalid granularity: %. Must be hour, day, week, or month', p_granularity;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO service_role;

-- ============================================================================
-- 7. FUNCTION TO GET USER REGISTRATION STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_registration_stats(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_registrations BIGINT,
    completed_registrations BIGINT,
    incomplete_registrations BIGINT,
    completion_rate NUMERIC
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_registration_stats TO service_role;

-- ============================================================================
-- INITIAL DATA POPULATION
-- Backfill existing data where possible
-- ============================================================================

-- Backfill user registrations from auth.users
INSERT INTO analytics_events (event_type, user_id, is_anonymous, created_at, metadata)
SELECT
    'user_registration',
    id,
    FALSE,
    created_at,
    jsonb_build_object('email', email, 'backfilled', true)
FROM auth.users
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Backfill game analyses from game_analyses table
INSERT INTO analytics_events (event_type, user_id, is_anonymous, platform, created_at, metadata)
SELECT
    'game_analysis',
    au.id,
    FALSE,
    ga.platform,
    ga.created_at,
    jsonb_build_object(
        'game_id', ga.game_id,
        'analysis_type', ga.analysis_type,
        'backfilled', true
    )
FROM game_analyses ga
LEFT JOIN authenticated_users au ON au.id = (
    SELECT id FROM auth.users WHERE LOWER(email) = LOWER(ga.user_id) LIMIT 1
)
WHERE ga.created_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Refresh all materialized views after backfill
SELECT refresh_analytics_views();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created:
-- 1. analytics_events table for tracking all events
-- 2. Materialized views for hourly, daily, weekly, monthly aggregations
-- 3. user_registration_status view for tracking registration completion
-- 4. Helper functions for tracking events
-- 5. Auto-trigger for user registration tracking
-- 6. Dashboard query functions
-- 7. Backfilled historical data

-- Usage Example:
-- SELECT * FROM get_dashboard_metrics(NOW() - INTERVAL '7 days', NOW(), 'day');
-- SELECT * FROM get_registration_stats(NOW() - INTERVAL '30 days', NOW());
-- SELECT * FROM user_registration_status WHERE registration_status = 'incomplete';
