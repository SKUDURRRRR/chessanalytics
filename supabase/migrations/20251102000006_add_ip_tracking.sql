-- Migration: Add IP tracking to analytics system
-- Date: 2025-11-02
-- Description: Adds IP address tracking and additional time filters

-- ============================================================================
-- 1. ADD IP ADDRESS COLUMN TO analytics_events
-- ============================================================================

ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Add index for IP lookups
CREATE INDEX IF NOT EXISTS idx_analytics_events_ip ON analytics_events(ip_address);

-- ============================================================================
-- 2. UPDATE TRACKING FUNCTIONS TO CAPTURE IP
-- ============================================================================

-- Update track_player_search to include IP
CREATE OR REPLACE FUNCTION track_player_search(
    p_user_id UUID DEFAULT NULL,
    p_platform TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update track_game_analysis to include IP
CREATE OR REPLACE FUNCTION track_game_analysis(
    p_user_id UUID DEFAULT NULL,
    p_platform TEXT DEFAULT NULL,
    p_game_id TEXT DEFAULT NULL,
    p_analysis_type TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update track_pricing_page_view to include IP
CREATE OR REPLACE FUNCTION track_pricing_page_view(
    p_user_id UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. RECREATE MATERIALIZED VIEWS WITH UNIQUE IP COUNTS
-- ============================================================================

-- Drop existing views
DROP MATERIALIZED VIEW IF EXISTS analytics_hourly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics_weekly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics_monthly CASCADE;

-- Hourly aggregations with unique IPs
CREATE MATERIALIZED VIEW analytics_hourly AS
SELECT
    DATE_TRUNC('hour', created_at) AS hour,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count,
    COUNT(DISTINCT ip_address) AS unique_ips
FROM analytics_events
GROUP BY DATE_TRUNC('hour', created_at), event_type;

CREATE UNIQUE INDEX idx_analytics_hourly_unique ON analytics_hourly(hour, event_type);
CREATE INDEX idx_analytics_hourly_hour ON analytics_hourly(hour DESC);

-- Daily aggregations with unique IPs
CREATE MATERIALIZED VIEW analytics_daily AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count,
    COUNT(DISTINCT ip_address) AS unique_ips
FROM analytics_events
GROUP BY DATE_TRUNC('day', created_at), event_type;

CREATE UNIQUE INDEX idx_analytics_daily_unique ON analytics_daily(day, event_type);
CREATE INDEX idx_analytics_daily_day ON analytics_daily(day DESC);

-- Weekly aggregations with unique IPs
CREATE MATERIALIZED VIEW analytics_weekly AS
SELECT
    DATE_TRUNC('week', created_at) AS week,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count,
    COUNT(DISTINCT ip_address) AS unique_ips
FROM analytics_events
GROUP BY DATE_TRUNC('week', created_at), event_type;

CREATE UNIQUE INDEX idx_analytics_weekly_unique ON analytics_weekly(week, event_type);
CREATE INDEX idx_analytics_weekly_week ON analytics_weekly(week DESC);

-- Monthly aggregations with unique IPs
CREATE MATERIALIZED VIEW analytics_monthly AS
SELECT
    DATE_TRUNC('month', created_at) AS month,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(*) FILTER (WHERE is_anonymous = TRUE) AS anonymous_count,
    COUNT(DISTINCT ip_address) AS unique_ips
FROM analytics_events
GROUP BY DATE_TRUNC('month', created_at), event_type;

CREATE UNIQUE INDEX idx_analytics_monthly_unique ON analytics_monthly(month, event_type);
CREATE INDEX idx_analytics_monthly_month ON analytics_monthly(month DESC);

-- Grant permissions
GRANT SELECT ON analytics_hourly TO service_role;
GRANT SELECT ON analytics_daily TO service_role;
GRANT SELECT ON analytics_weekly TO service_role;
GRANT SELECT ON analytics_monthly TO service_role;

-- ============================================================================
-- 4. UPDATE get_dashboard_metrics FUNCTION
-- ============================================================================

-- Drop the existing function first to allow changing return type
DROP FUNCTION IF EXISTS get_dashboard_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_granularity TEXT DEFAULT 'day'
)
RETURNS TABLE (
    time_bucket TIMESTAMPTZ,
    event_type TEXT,
    event_count BIGINT,
    unique_users BIGINT,
    anonymous_count BIGINT,
    unique_ips BIGINT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO service_role;

-- Refresh all views with new structure
SELECT refresh_analytics_views();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Added:
-- 1. ip_address column to analytics_events table
-- 2. Updated all tracking functions to accept and store IP addresses
-- 3. Recreated materialized views with unique_ips count
-- 4. Updated get_dashboard_metrics to return unique_ips

COMMENT ON COLUMN analytics_events.ip_address IS 'IP address of the request (for unique visitor tracking)';
